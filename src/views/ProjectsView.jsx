import { useEffect, useState } from "react";

import { api } from "../api.js";

const STUDY_TYPES = {
  materials_ai: "材料化学 + AI",
  experimental: "材料实验研究",
  computational: "计算材料研究",
  literature_review: "综述 / 系统评价",
};

const EMPTY_FORM = {
  name: "",
  research_question: "",
  study_type: "materials_ai",
  material_system: "",
  target_journal: "",
};

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

export default function ProjectsView({ configured, onOpenProject, onOpenSettings }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .listProjects()
      .then((data) => {
        if (alive) setProjects(data);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const create = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const project = await api.createProject({
        ...form,
        name: form.name.trim(),
        research_question: form.research_question.trim(),
        material_system: form.material_system.trim(),
        target_journal: form.target_journal.trim(),
      });
      setForm(EMPTY_FORM);
      onOpenProject(project.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>研究项目</h1>
          <p className="muted">围绕材料体系组织论文、专利、实验记录与数据，生成带证据门禁的综合报告。</p>
        </div>
      </header>

      {!configured ? (
        <p className="alert alert--warn">
          还没有配置模型接口。分析任务需要它才能运行。
          <button type="button" className="link" onClick={onOpenSettings}>
            去设置
          </button>
        </p>
      ) : null}

      {error ? <p className="alert alert--bad">{error}</p> : null}

      <form className="panel" onSubmit={create}>
        <h2>新建项目</h2>
        <div className="form-row">
          <label className="field">
            <span className="field-label">项目名称</span>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="例如：钙钛矿氧化物性能预测"
              maxLength={120}
              required
            />
          </label>
          <label className="field field--grow">
            <span className="field-label">研究问题</span>
            <input
              className="input"
              value={form.research_question}
              onChange={(event) => setForm((prev) => ({ ...prev, research_question: event.target.value }))}
              placeholder="例如：掺杂组成如何影响离子电导率，模型能否可靠外推？"
              maxLength={1000}
            />
          </label>
        </div>
        <div className="form-row form-row--spaced">
          <label className="field">
            <span className="field-label">研究类型</span>
            <select
              className="input"
              value={form.study_type}
              onChange={(event) => setForm((prev) => ({ ...prev, study_type: event.target.value }))}
            >
              {Object.entries(STUDY_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">材料体系</span>
            <input
              className="input"
              value={form.material_system}
              onChange={(event) => setForm((prev) => ({ ...prev, material_system: event.target.value }))}
              placeholder="例如：锂离子电池高镍层状正极"
              maxLength={300}
            />
          </label>
          <label className="field">
            <span className="field-label">目标期刊</span>
            <input
              className="input"
              value={form.target_journal}
              onChange={(event) => setForm((prev) => ({ ...prev, target_journal: event.target.value }))}
              placeholder="例如：Advanced Energy Materials"
              maxLength={300}
            />
          </label>
          <button type="submit" className="btn btn--primary" disabled={creating || !form.name.trim()}>
            {creating ? "创建中…" : "创建项目"}
          </button>
        </div>
      </form>

      <section className="panel">
        <header className="panel-head">
          <h2>全部项目</h2>
          <span className="muted">{projects.length} 个</span>
        </header>

        {loading ? (
          <p className="muted">正在读取…</p>
        ) : projects.length === 0 ? (
          <p className="empty">还没有项目，先在上面创建一个。</p>
        ) : (
          <div className="grid">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="card"
                onClick={() => onOpenProject(project.id)}
              >
                <span className="card-title">{project.name}</span>
                <span className="card-question">
                  {project.research_question || "未设置研究问题"}
                </span>
                <span className="card-meta">
                  <span className="pill">{STUDY_TYPES[project.study_type] || "材料研究"}</span>
                  {project.material_system ? <span className="pill">{project.material_system}</span> : null}
                  <span className="pill">{project.document_count} 篇文献</span>
                  <span className="pill">{project.report_count} 份报告</span>
                </span>
                <span className="card-time">更新于 {formatTime(project.updated_at)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
