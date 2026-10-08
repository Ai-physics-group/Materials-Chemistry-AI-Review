import { useEffect, useRef } from "react";

import { formatClock, roleLabel, roleMeta } from "../collab.js";

const MAX_ROWS = 160;

export default function CollabTerminal({ events }) {
  const bodyRef = useRef(null);
  const rows = (events || []).slice(-MAX_ROWS);
  const count = rows.length;

  useEffect(() => {
    const node = bodyRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count]);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <span className="eyebrow">LIVE OUTPUT</span>
          <h2>协作终端</h2>
        </div>
        <span className="muted">{count} 条最新记录</span>
      </header>

      <div className="terminal">
        <div className="terminal-bar">
          <span className="terminal-dots">
            <i className="terminal-dot terminal-dot--a" />
            <i className="terminal-dot terminal-dot--b" />
            <i className="terminal-dot terminal-dot--c" />
          </span>
          <span className="terminal-name">SOLVER TERMINAL</span>
        </div>

        <div className="terminal-body" ref={bodyRef}>
          {count === 0 ? (
            <p className="terminal-empty">从上传提交任务后，将在这里看到 solver 端事件流。</p>
          ) : (
            rows.map((event) => {
              const tone = roleMeta(event.agent_role).tone;
              return (
                <div className="terminal-row" key={event.id}>
                  <span className="terminal-time">{formatClock(event.created_at)}</span>
                  <span className="terminal-role">·</span>
                  <span className={`terminal-role terminal-role--${tone}`}>
                    [{roleLabel(event.agent_role)}]
                  </span>
                  <span className={`terminal-msg terminal-msg--${event.level || "info"}`}>
                    {event.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
