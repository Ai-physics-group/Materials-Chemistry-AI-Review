import { useCallback, useEffect, useState } from "react";

import { collab } from "../api.js";
import { renderMarkdown } from "../markdown.js";

const MAX_TABLE_ROWS = 50;
const MAX_TABLE_COLS = 8;
const BINARY_HINT = "该类型不支持在线预览，请下载后查看。";

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// 极简分隔符解析：支持引号包裹、双引号转义，够 CSV/TSV 预览用
function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index];
    if (quoted) {
      if (ch === '"') {
        if (line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(value);
      value = "";
    } else {
      value += ch;
    }
  }
  cells.push(value);
  return cells;
}

function pickDelimiter(text) {
  const first = String(text ?? "").split("\n")[0];
  const tabs = (first.match(/\t/g) || []).length;
  const commas = (first.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function tryJsonMatrix(text) {
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length === 0) return null;
  if (data.every((row) => Array.isArray(row))) {
    return data.map((row) => row.map((cell) => formatCell(cell)));
  }
  if (data.every((row) => row && typeof row === "object")) {
    const headers = [];
    for (const row of data) {
      for (const key of Object.keys(row)) {
        if (!headers.includes(key)) headers.push(key);
      }
    }
    return [headers].concat(data.map((row) => headers.map((key) => formatCell(row[key]))));
  }
  return data.map((item) => [formatCell(item)]);
}

function textToMatrix(text) {
  const trimmed = String(text ?? "").replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!trimmed) return [];
  const stripped = trimmed.trimStart();
  if (stripped.startsWith("[") || stripped.startsWith("{")) {
    const matrix = tryJsonMatrix(stripped);
    if (matrix) return matrix;
  }
  const delimiter = pickDelimiter(trimmed);
  return trimmed.split("\n").map((line) => parseDelimitedLine(line, delimiter));
}

function TablePreview({ content }) {
  const rows = textToMatrix(content);
  if (rows.length === 0) {
    return <p className="muted">表格内容为空，请下载后查看。</p>;
  }

  const header = rows[0];
  const body = rows.slice(1);
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const columns = Math.max(1, Math.min(columnCount, MAX_TABLE_COLS));
  const visibleBody = body.slice(0, MAX_TABLE_ROWS);
  const rowTruncated = body.length > MAX_TABLE_ROWS;
  const colTruncated = columnCount > MAX_TABLE_COLS;
  const blanks = Array.from({ length: columns }, (_, index) => index);

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {blanks.map((index) => (
                <th key={index}>{header[index] ?? ""}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleBody.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {blanks.map((index) => (
                  <td key={index}>{row[index] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rowTruncated || colTruncated ? (
        <p className="artifact-table-note">
          {rowTruncated ? `仅显示前 ${MAX_TABLE_ROWS} 行` : ""}
          {rowTruncated && colTruncated ? " · " : ""}
          {colTruncated ? `仅显示前 ${MAX_TABLE_COLS} 列` : ""}
        </p>
      ) : null}
    </>
  );
}

export default function ArtifactPreview({ artifact, onChanged }) {
  const artifactId = artifact?.id;
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendUrl, setSendUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState("");
  const [sendError, setSendError] = useState("");

  const load = useCallback(async () => {
    if (!artifactId) return;
    setLoading(true);
    setError("");
    try {
      const data = await collab.artifactPreview(artifactId);
      setPreview(data);
      setDraft(typeof data.content === "string" ? data.content : "");
    } catch (err) {
      setPreview(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    setEditing(false);
    setSaveError("");
    setSavedNote("");
    setImageFailed(false);
    setSendNote("");
    setSendError("");
    load();
  }, [load]);

  const content = preview && typeof preview.content === "string" ? preview.content : "";
  const canEdit = Boolean(preview && preview.editable && !preview.truncated && !loading && !error);
  const downloadUrl = collab.artifactUrl(artifactId);

  const startEdit = () => {
    setDraft(content);
    setSaveError("");
    setSavedNote("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(content);
    setSaveError("");
    setEditing(false);
  };

  const save = async () => {
    if (!preview || saving) return;
    if (draft === content) {
      setEditing(false);
      setSaveError("");
      return;
    }
    setSaving(true);
    setSaveError("");
    setSavedNote("");
    let done = false;
    try {
      const result = await collab.saveArtifactContent(artifactId, draft);
      done = true;
      setEditing(false);
      const sha = result && result.sha ? result.sha : "";
      setSavedNote(sha ? `已保存，版本 ${sha}` : "已保存（内容没有变化）。");
      await load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
    if (done && onChanged) {
      try {
        await onChanged();
      } catch {
        // 父级刷新失败不影响保存结果
      }
    }
  };

  const send = async () => {
    const url = sendUrl.trim();
    if (!url || sending) return;
    setSending(true);
    setSendNote("");
    setSendError("");
    try {
      const result = await collab.sendArtifact(artifactId, url);
      setSendNote(`已发送 ${result.filename}（HTTP ${result.status}）`);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  const renderBody = () => {
    if (!preview) return null;

    if (preview.kind === "image") {
      if (imageFailed) {
        return (
          <div className="artifact-binary">
            <p className="alert alert--bad">图片加载失败，请下载查看。</p>
            <div className="actions">
              <a className="btn btn--ghost" href={downloadUrl} download>
                下载图片
              </a>
            </div>
          </div>
        );
      }
      return (
        <a className="artifact-image-link" href={downloadUrl} target="_blank" rel="noreferrer">
          <img
            className="artifact-image"
            src={downloadUrl}
            alt={preview.filename || "产物图片"}
            onError={() => setImageFailed(true)}
          />
        </a>
      );
    }

    if (preview.kind === "markdown") {
      return (
        <article
          className="markdown"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      );
    }

    if (preview.kind === "table") {
      return <TablePreview content={content} />;
    }

    if (preview.kind === "code" || preview.kind === "text") {
      return <pre className="artifact-code">{content}</pre>;
    }

    return (
      <div className="artifact-binary">
        <p className="alert alert--info">{BINARY_HINT}</p>
        {preview.message && preview.message !== BINARY_HINT ? (
          <p className="muted">{preview.message}</p>
        ) : null}
        <div className="actions">
          <a className="btn btn--ghost" href={downloadUrl} download>
            下载查看
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="artifact-preview">
      <div className="artifact-preview-head">
        <span className="eyebrow">PREVIEW</span>
        <div className="actions">
          {editing ? <span className="muted">编辑中</span> : null}
          {canEdit && !editing ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={startEdit}
              disabled={preview.truncated}
              title={preview.truncated ? "内容被截断，保存会破坏文件，已禁用编辑" : "编辑内容"}
            >
              编辑
            </button>
          ) : null}
          {!editing ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setSendOpen((value) => !value)}
              title="把这个产物发到一个网址"
            >
              {sendOpen ? "收起发送" : "发送"}
            </button>
          ) : null}
        </div>
      </div>

      {sendOpen ? (
        <div className="artifact-send">
          <input
            className="input"
            value={sendUrl}
            onChange={(event) => setSendUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
            placeholder="接收地址，例如 https://example.com/upload"
            spellCheck={false}
            aria-label="接收地址"
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={send}
            disabled={sending || !sendUrl.trim()}
          >
            {sending ? "发送中…" : "发送"}
          </button>
        </div>
      ) : null}
      {sendNote ? <p className="alert alert--ok">{sendNote}</p> : null}
      {sendError ? <p className="alert alert--bad">{sendError}</p> : null}

      {loading ? <p className="muted artifact-preview-state">正在载入预览…</p> : null}

      {!loading && error ? <p className="alert alert--bad">{error}</p> : null}

      {!loading && !error && preview ? (
        <>
          {preview.truncated ? (
            <p className="alert alert--warn">
              内容较长，仅显示开头部分
              {preview.editable ? "；为避免保存时截断文件，编辑已禁用。" : "。"}
            </p>
          ) : null}
          {savedNote ? <p className="alert alert--ok">{savedNote}</p> : null}
          {saveError ? <p className="alert alert--bad">{saveError}</p> : null}

          {editing ? (
            <>
              <textarea
                className="input artifact-editor"
                value={draft}
                aria-label="产物内容"
                spellCheck={false}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="artifact-editor-foot">
                <span className="muted">共 {draft.length} 字</span>
                <div className="actions">
                  <button type="button" className="btn btn--ghost" onClick={cancelEdit} disabled={saving}>
                    取消
                  </button>
                  <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
                    {saving ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            renderBody()
          )}
        </>
      ) : null}
    </div>
  );
}
