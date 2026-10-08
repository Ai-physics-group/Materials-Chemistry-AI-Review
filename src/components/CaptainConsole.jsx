import { collab } from "../api.js";
import {
  AGENT_STATUS,
  BADGE_STATUS,
  TASK_STATUS,
  clampPercent,
  formatClock,
  roleMeta,
} from "../collab.js";

const LOG_LIMIT = 12;

export default function CaptainConsole({
  task,
  events,
  refreshing,
  cancelling,
  onRefresh,
  onCancel,
  onReupload,
}) {
  const agents = task.agents || [];
  const progress = clampPercent(task.progress);
  const status = task.status || "draft";
  const busy = status === "running";
  const doneAgents = agents.filter((agent) => agent.status === "done").length;

  const checklist = agents.flatMap((agent) => agent.checklist || []);
  const doneTasks = checklist.filter((item) => item.done).length;

  const logs = (events || []).slice(-LOG_LIMIT).reverse();

  return (
    <aside className="panel console">
      <header className="panel-head">
        <div>
          <span className="eyebrow">CAPTAIN CONSOLE</span>
          <h2>队长控制台</h2>
        </div>
        <button
          type="button"
          className="icon-btn"
          title="刷新状态"
          onClick={onRefresh}
          disabled={refreshing}
        >
          ↻
        </button>
      </header>

      <div className="console-progress">
        <span className="console-percent">{progress}%</span>
        <span className={`badge badge--${BADGE_STATUS[status] || "run"}`}>
          {TASK_STATUS[status] || status}
        </span>
      </div>

      <div className="console-stats">
        <div className="console-stat">
          <span className="console-stat-value">
            {doneAgents}/{agents.length}
          </span>
          <span className="stat-label">成员</span>
        </div>
        <div className="console-stat">
          <span className="console-stat-value">
            {doneTasks}/{checklist.length}
          </span>
          <span className="stat-label">完成任务</span>
        </div>
        <div className="console-stat">
          <span className="console-stat-value">{(events || []).length}</span>
          <span className="stat-label">消息条数</span>
        </div>
      </div>

      <div className="console-block">
        <span className="console-title">成员状态</span>
        <ul className="console-agents">
          {agents.length === 0 ? (
            <li className="muted">还没有成员。</li>
          ) : (
            agents.map((agent) => {
              const meta = roleMeta(agent.role);
              return (
                <li key={agent.role} className="console-agent">
                  <div className="console-agent-top">
                    <span className="console-agent-name">{agent.name || meta.name}</span>
                    <span className="console-agent-value">{clampPercent(agent.progress)}%</span>
                  </div>
                  <div className="console-agent-step">
                    {AGENT_STATUS[agent.status] || agent.status} · {agent.current_step || "等待分配"}
                  </div>
                  <div className="bar bar--slim">
                    <div
                      className={`bar-fill bar-fill--${meta.tone}`}
                      style={{ width: `${clampPercent(agent.progress)}%` }}
                    />
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="console-block">
        <span className="console-title">任务控制</span>
        <div className="console-actions">
          <button type="button" className="btn btn--ghost" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "刷新中…" : "刷新状态"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={cancelling || !busy}>
            {cancelling ? "撤销中…" : "撤销任务"}
          </button>
          {task.id ? (
            <a className="btn btn--ghost" href={collab.downloadAllUrl(task.id)} download>
              下载产物
            </a>
          ) : (
            <button type="button" className="btn btn--ghost" disabled>
              下载产物
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onReupload}>
            重新上传
          </button>
        </div>
      </div>

      <div className="console-block">
        <div className="console-block-head">
          <span className="console-title">过程日志</span>
          <span className="muted">{logs.length} 条</span>
        </div>
        {logs.length === 0 ? (
          <p className="muted">任务开始后，关键事件会记录在这里。</p>
        ) : (
          <ul className="console-logs">
            {logs.map((event) => (
              <li key={event.id} className={`console-log console-log--${event.level || "info"}`}>
                <span className="console-log-time">{formatClock(event.created_at)}</span>
                <span className="console-log-role">{roleMeta(event.agent_role).name}</span>
                <span className="console-log-msg">{event.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
