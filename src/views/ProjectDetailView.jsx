import { useCallback, useEffect, useRef, useState } from "react";

import { api, collab } from "../api.js";
import JobProgress from "../components/JobProgress.jsx";
import ReportPanel from "../components/ReportPanel.jsx";

const ACCEPT = ".pdf,.docx,.txt,.md";
const TERMINAL = ["completed", "failed"];
const DOC_STATUS = { ready: "已解析", failed: "解析失败", pending: "等待中" };
const STUDY_TYPES = {
  materials_ai: "材料化学 + AI",
  experimental: "材料实验研究",
  computational: "计算材料研究",
  literature_review: "综述 / 系统评价",
};
const SOURCE_TYPES = {
  research_paper: "研究论文",
  review: "综述论文",
  patent: "专利",
  experiment_note: "实验记录",
  dataset: "数据集说明",
  supplementary: "补充材料",
  problem_statement: "研究题目 / 方案",
};

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

export default function ProjectDetailView({ projectId, configured, onBack, onOpenSettings, onStartCollab }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sourceType, setSourceType] = useState("research_paper");
  const [dragActive, setDragActive] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [projectForm, setProjectForm] = useState(null);
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [collabStarting, setCollabStarting] = useState(false);

  // 一键把课题交到科研协作：名称、研究问题、材料体系、目标期刊和已解析文献都会带过去
  const startCollab = async () => {
    setCollabStarting(true);
    setNotice("");
    try {
      const created = await collab.createTaskFromProject(projectId);
      if (onStartCollab) onStartCollab(created.id, created.input_name || "");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setCollabStarting(false);
    }
  };
  const fileInput = useRef(null);

  const loadProject = useCallback(async () => {
    try {
      const data = await api.getProject(projectId);
      setProject(data);
      setProjectForm((current) => current || ({
        name: data.name || "",
        research_question: data.research_question || "",
        study_type: data.study_type || "materials_ai",
        material_system: data.material_system || "",
        target_journal: data.target_journal || "",
      }));
      setError("");
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await loadProject();
      if (!alive || !data) return;
      const active = (data.jobs || []).find((item) => !TERMINAL.includes(item.status));
      if (active) setJob(active);
    })();
    return () => {
      alive = false;
    };
  }, [loadProject]);

  const jobId = job?.id;
  const jobStatus = job?.status;

  useEffect(() => {
    if (!jobId || TERMINAL.includes(jobStatus)) return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const state = await api.getJob(jobId);
        if (stopped) return;
        setJob(state);
        if (TERMINAL.includes(state.status)) await loadProject();
      } catch (err) {
        if (!stopped) setNotice(err.message);
      }
    };
    const interval = setInterval(tick, 1200);
    tick();
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [jobId, jobStatus, loadProject]);

  const upload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setUploading(true);
    setNotice("");
    try {
      const results = await api.uploadDocuments(projectId, files, sourceType);
      const failed = results.filter((item) => item.status !== "ready");
      if (failed.length > 0) {
        setNotice(
          `${results.length - failed.length} 篇解析成功，${failed.length} 篇失败：` +
            failed.map((item) => `${item.filename}（${item.error || "未知原因"}）`).join("；")
        );
      } else {
        setNotice(`${results.length} 篇文献解析完成。`);
      }
      await loadProject();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const saveProject = async (event) => {
    event.preventDefault();
    if (!projectForm?.name.trim()) return;
    setSavingProject(true);
    setNotice("");
    try {
      const updated = await api.updateProject(projectId, {
        ...projectForm,
        name: projectForm.name.trim(),
        research_question: projectForm.research_question.trim(),
        material_system: projectForm.material_system.trim(),
        target_journal: projectForm.target_journal.trim(),
      });
      setProject((prev) => ({ ...prev, ...updated }));
      setNotice("研究设置已保存。");
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSavingProject(false);
    }
  };

  const startAnalysis = async () => {
    setStarting(true);
    setNotice("");
    setReport(null);
    try {
      const created = await api.analyze(projectId);
      setJob({
        id: created.id,
        status: created.status,
        stage: "queued",
        progress: 0,
        message: "等待执行",
        events: [],
      });
    } catch (err) {
      setNotice(err.message);
    } finally {
      setStarting(false);
    }
  };

  const openReport = async (reportId) => {
    setReportLoading(true);
    setNotice("");
    try {
      setReport(await api.getReport(reportId));
    } catch (err) {
      setNotice(err.message);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className="muted">正在载入项目…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page">
        <p className="alert alert--bad">{error || "项目不存在"}</p>
        <button type="button" className="btn" onClick={onBack}>
          返回项目列表
        </button>
      </div>
    );
  }

  const documents = project.documents || [];
  const reports = project.reports || [];
  const readyCount = documents.filter((item) => item.status === "ready").length;
  const running = Boolean(job && !TERMINAL.includes(job.status));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <button type="button" className="link" onClick={onBack}>
            ← 返回项目列表
          </button>
          <h1>{project.name}</h1>
          <p className="muted">研究问题：{project.research_question || "未设置"}</p>
          <div className="card-meta">
            <span className="pill">{STUDY_TYPES[project.study_type] || "材料研究"}</span>
            {project.material_system ? <span className="pill">材料：{project.material_system}</span> : null}
            {project.target_journal ? <span className="pill">目标：{project.target_journal}</span> : null}
          </div>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={startCollab}
            disabled={collabStarting}
            title="把本课题的名称、研究问题与已解析文献带到科研协作，新建一个协作任务"
          >
            {collabStarting ? "正在创建…" : "发起科研协作"}
          </button>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <span className="stat-value">{documents.length}</span>
          <span className="stat-label">文献总数</span>
        </div>
        <div className="stat">
          <span className="stat-value">{readyCount}</span>
          <span className="stat-label">可分析</span>
        </div>
        <div className="stat">
          <span className="stat-value">{reports.length}</span>
          <span className="stat-label">报告</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatTime(project.updated_at)}</span>
          <span className="stat-label">最近更新</span>
        </div>
      </div>

      {!configured ? (
        <p className="alert alert--warn">
          模型接口尚未配置，分析无法启动。
          <button type="button" className="link" onClick={onOpenSettings}>
            去设置
          </button>
        </p>
      ) : null}

      {notice ? <p className="alert alert--info">{notice}</p> : null}

      {projectForm ? (
        <form className="panel" onSubmit={saveProject}>
          <header className="panel-head">
            <div>
              <h2>研究设置</h2>
              <p className="muted">这些信息会进入文献分析提示与最终报告，旧项目也可以在这里修订。</p>
            </div>
            <button type="submit" className="btn" disabled={savingProject || !projectForm.name.trim()}>
              {savingProject ? "保存中…" : "保存设置"}
            </button>
          </header>
          <div className="form-row">
            <label className="field">
              <span className="field-label">项目名称</span>
              <input className="input" value={projectForm.name} maxLength={120} required
                onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label className="field field--grow">
              <span className="field-label">研究问题</span>
              <input className="input" value={projectForm.research_question} maxLength={1000}
                placeholder="写成可验证的问题，并明确材料、性能指标和适用范围"
                onChange={(event) => setProjectForm((prev) => ({ ...prev, research_question: event.target.value }))} />
            </label>
          </div>
          <div className="form-row form-row--spaced">
            <label className="field">
              <span className="field-label">研究类型</span>
              <select className="input" value={projectForm.study_type}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, study_type: event.target.value }))}>
                {Object.entries(STUDY_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">材料体系</span>
              <input className="input" value={projectForm.material_system} maxLength={300}
                placeholder="组成、结构或材料家族"
                onChange={(event) => setProjectForm((prev) => ({ ...prev, material_system: event.target.value }))} />
            </label>
            <label className="field">
              <span className="field-label">目标期刊</span>
              <input className="input" value={projectForm.target_journal} maxLength={300}
                placeholder="用于约束写作风格与完整性"
                onChange={(event) => setProjectForm((prev) => ({ ...prev, target_journal: event.target.value }))} />
            </label>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>上传文献</h2>
            <p className="muted">先标明来源性质，避免把研究题目、计划或背景描述误当成实验发现。</p>
          </div>
          <div className="actions">
            <label className="field field--compact">
              <span className="field-label">本批资料类型</span>
              <select className="input" value={sourceType}
                onChange={(event) => setSourceType(event.target.value)} disabled={uploading}>
                {Object.entries(SOURCE_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => fileInput.current && fileInput.current.click()}
              disabled={uploading}
            >
              {uploading ? "上传中…" : "选择文件"}
            </button>
          </div>
        </header>

        <div
          className={`drop${dragActive ? " is-active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            upload(event.dataTransfer.files);
          }}
        >
          <p>把文献拖到这里，或点右上角"选择文件"</p>
          <input
            ref={fileInput}
            className="hidden-input"
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(event) => upload(event.target.files)}
          />
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>文献列表</h2>
            <p className="muted">扫描型 PDF 会解析失败，需要先做 OCR 再上传。</p>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={startAnalysis}
            disabled={starting || running || readyCount === 0 || !configured}
          >
            {running ? "分析进行中…" : starting ? "正在启动…" : "开始分析"}
          </button>
        </header>

        {documents.length === 0 ? (
          <p className="empty">还没有文献。</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>来源类型</th>
                  <th>页数</th>
                  <th>字数</th>
                  <th>状态</th>
                  <th>上传时间</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="cell-name">{document.filename}</td>
                    <td>{SOURCE_TYPES[document.source_type] || document.source_type || "研究论文"}</td>
                    <td>{document.page_count}</td>
                    <td>{formatNumber(document.char_count)}</td>
                    <td>
                      <span className={`badge badge--${document.status === "ready" ? "ok" : "bad"}`}>
                        {DOC_STATUS[document.status] || document.status}
                      </span>
                    </td>
                    <td>{formatTime(document.created_at)}</td>
                    <td className="cell-error">{document.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <JobProgress job={job} />

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>历史报告</h2>
            <p className="muted">每次分析都会生成 Markdown、JSON 与 DOCX 三种格式。</p>
          </div>
        </header>

        {reports.length === 0 ? (
          <p className="empty">还没有报告。</p>
        ) : (
          <ul className="list">
            {reports.map((item) => (
              <li key={item.id} className="list-row">
                <div>
                  <div className="list-title">{item.title}</div>
                  <div className="muted">{formatTime(item.created_at)}</div>
                </div>
                <div className="actions">
                  <button type="button" className="btn btn--ghost" onClick={() => openReport(item.id)}>
                    预览
                  </button>
                  <a className="btn btn--ghost" href={api.downloadUrl(item.id, "markdown")}>
                    MD
                  </a>
                  <a className="btn btn--ghost" href={api.downloadUrl(item.id, "json")}>
                    JSON
                  </a>
                  <a className="btn btn--ghost" href={api.downloadUrl(item.id, "docx")}>
                    DOCX
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReportPanel report={report} loading={reportLoading} onClose={() => setReport(null)} />
    </div>
  );
}
