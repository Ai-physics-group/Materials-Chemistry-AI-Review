import { api } from "../api.js";
import { renderMarkdown } from "../markdown.js";

export default function ReportPanel({ report, loading, onClose }) {
  if (loading) {
    return (
      <section className="panel">
        <p className="muted">正在载入报告…</p>
      </section>
    );
  }
  if (!report) return null;

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>{report.title}</h2>
          <p className="muted">
            生成于 {new Date(report.created_at).toLocaleString("zh-CN", { hour12: false })}
          </p>
        </div>
        <div className="actions">
          <a className="btn btn--ghost" href={api.downloadUrl(report.id, "markdown")}>
            下载 Markdown
          </a>
          <a className="btn btn--ghost" href={api.downloadUrl(report.id, "json")}>
            下载 JSON
          </a>
          <a className="btn btn--ghost" href={api.downloadUrl(report.id, "docx")}>
            下载 DOCX
          </a>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            收起
          </button>
        </div>
      </header>

      <article
        className="markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(report.markdown) }}
      />
    </section>
  );
}
