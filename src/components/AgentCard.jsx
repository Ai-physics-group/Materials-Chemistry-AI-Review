import AgentChat from "./AgentChat.jsx";
import { AGENT_STATUS, CATEGORY_META, clampPercent, roleMeta } from "../collab.js";

const CATEGORIES = ["chart", "code", "data", "paper"];

export default function AgentCard({ agent, taskId, taskStatus, onChanged }) {
  const meta = roleMeta(agent.role);
  const status = agent.status || "idle";
  const progress = clampPercent(agent.progress);
  const speed = clampPercent(agent.speed);
  const checklist = agent.checklist || [];
  const artifacts = agent.artifacts || {};
  const pills = CATEGORIES.filter((key) => Number(artifacts[key]) > 0);

  return (
    <article className={`agent-card agent-card--${meta.tone}`}>
      <header className="agent-head">
        <span className="agent-avatar">{meta.name.slice(0, 1)}</span>
        <div className="agent-id">
          <div className="agent-name">
            {agent.name || meta.name}
            <span className="agent-en">/ {agent.en || meta.en}</span>
          </div>
          <div className="agent-state">
            <span className={`agent-dot agent-dot--${status}`} />
            {AGENT_STATUS[status] || status}
          </div>
        </div>
      </header>

      <div className="agent-block">
        <span className="agent-label">本轮任务</span>
        <p className="agent-step">{agent.current_step || "等待队长分配任务"}</p>
      </div>

      <div className="agent-block">
        <div className="agent-meter">
          <span className="agent-label">速度</span>
          <span className="agent-meter-value">{speed}%</span>
        </div>
        <div className="bar">
          <div className={`bar-fill bar-fill--${meta.tone}`} style={{ width: `${speed}%` }} />
        </div>
      </div>

      <div className="agent-block">
        <div className="agent-meter">
          <span className="agent-label">进度</span>
          <span className="agent-meter-value">{progress}%</span>
        </div>
        <div className="bar">
          <div className={`bar-fill bar-fill--${meta.tone}`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="agent-block">
        <span className="agent-label">任务清单</span>
        {checklist.length === 0 ? (
          <p className="muted">还没有分配清单。</p>
        ) : (
          <ul className="agent-checks">
            {checklist.map((item, index) => (
              <li
                key={`${item.label || "item"}-${index}`}
                className={`agent-check${item.done ? " is-done" : ""}`}
              >
                <span className="agent-check-dot" />
                <span className="agent-check-label">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="agent-foot">
        <span className="agent-label">产出</span>
        {pills.length === 0 ? (
          <span className="muted">暂无产物</span>
        ) : (
          <div className="agent-pills">
            {pills.map((key) => (
              <span key={key} className={`pill pill--${meta.tone}`}>
                {CATEGORY_META[key] ? CATEGORY_META[key].label : key} {artifacts[key]}
              </span>
            ))}
          </div>
        )}
      </footer>

      {agent.error ? <p className="alert alert--bad">{agent.error}</p> : null}

      <AgentChat
        taskId={taskId || ""}
        role={agent.role}
        agent={agent}
        taskStatus={taskStatus}
        onChanged={onChanged}
      />
    </article>
  );
}
