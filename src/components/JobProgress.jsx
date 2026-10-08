const STAGES = [
  { key: "queued", label: "排队" },
  { key: "prepare", label: "解析准备" },
  { key: "analyze", label: "逐篇分析" },
  { key: "synthesize", label: "跨文献综合" },
  { key: "export", label: "生成导出" },
  { key: "completed", label: "完成" },
];

function stageIndex(stage) {
  const index = STAGES.findIndex((item) => item.key === stage);
  if (index >= 0) return index;
  if (stage === "failed") return STAGES.length - 1;
  return 0;
}

export default function JobProgress({ job }) {
  if (!job) return null;

  const failed = job.status === "failed";
  const done = job.status === "completed";
  const current = stageIndex(job.stage);
  const progress = Math.max(0, Math.min(100, Number(job.progress) || 0));
  const events = [...(job.events || [])].reverse().slice(0, 40);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>分析任务</h2>
          <p className="muted">{job.message || "等待执行"}</p>
        </div>
        <span className={`badge badge--${failed ? "bad" : done ? "ok" : "run"}`}>
          {failed ? "失败" : done ? "已完成" : "进行中"}
        </span>
      </header>

      <ol className="steps">
        {STAGES.map((stage, index) => {
          let state = "todo";
          if (failed) state = index < current ? "done" : index === current ? "bad" : "todo";
          else if (done) state = "done";
          else if (index < current) state = "done";
          else if (index === current) state = "now";
          return (
            <li key={stage.key} className={`step step--${state}`}>
              <span className="step-dot" />
              <span className="step-label">{stage.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="bar">
        <div className={`bar-fill${failed ? " is-bad" : ""}`} style={{ width: `${progress}%` }} />
      </div>
      <div className="bar-meta">
        <span>{progress}%</span>
        <span>{job.stage}</span>
      </div>

      {job.error ? <p className="alert alert--bad">{job.error}</p> : null}

      <div className="log">
        {events.length === 0 ? (
          <p className="muted">暂无日志</p>
        ) : (
          events.map((event, index) => (
            <div className="log-row" key={`${event.created_at}-${index}`}>
              <span className="log-time">
                {new Date(event.created_at).toLocaleTimeString("zh-CN", { hour12: false })}
              </span>
              <span className="log-msg">{event.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
