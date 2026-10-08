import { useCallback, useEffect, useRef, useState } from "react";

import { collab } from "../api.js";
import { formatClock, roleMeta } from "../collab.js";

const POLL_INTERVAL = 1500;

function normalize(item, index) {
  return {
    id: item.id != null ? String(item.id) : `${item.created_at || "msg"}-${index}`,
    sender: item.sender === "user" ? "user" : "agent",
    content: item.content || "",
    created_at: item.created_at || "",
    delivery_status: item.delivery_status || "completed",
  };
}

// 乐观插入的本地消息一旦在服务端出现（按内容匹配），就不再重复展示
function mergeMessages(server, pending) {
  const remote = (server || []).map(normalize);
  const remoteUserText = new Set(
    remote.filter((item) => item.sender === "user").map((item) => item.content)
  );
  const rest = pending.filter((item) => !remoteUserText.has(item.content));
  return remote.concat(rest);
}

export default function AgentChat({ taskId, role, agent, taskStatus, onChanged }) {
  const meta = roleMeta(role);
  const status = agent?.status || "idle";
  const taskRunning = taskStatus === "running";
  const deliversLive = taskRunning && ["idle", "running", "waiting"].includes(status);

  const [messages, setMessages] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadMessages = useCallback(async () => {
    if (!taskId) {
      setMessages([]);
      return;
    }
    try {
      const data = await collab.agentMessages(taskId, role, 50);
      if (!alive.current) return null;
      setMessages(Array.isArray(data) ? data : []);
      setError("");
      return data;
    } catch (err) {
      if (alive.current) setError(err.message);
      return null;
    }
  }, [taskId, role]);

  // 切换任务或角色时重新拉一遍历史消息
  useEffect(() => {
    if (!taskId) {
      setMessages([]);
      setPendingMessages([]);
      setError("");
      return undefined;
    }
    let stopped = false;
    setLoading(true);
    setPendingMessages([]);
    loadMessages().finally(() => {
      if (!stopped && alive.current) setLoading(false);
    });
    return () => {
      stopped = true;
    };
  }, [taskId, role, loadMessages]);

  // 角色会话是持久频道；无论协作是否运行，都持续同步消息与投递状态。
  useEffect(() => {
    if (!taskId) return undefined;
    const timer = setInterval(loadMessages, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [taskId, loadMessages]);

  const shown = mergeMessages(messages, pendingMessages);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [shown.length, loading]);

  const locked = !taskId || sending;

  const hint = !taskId
    ? "创建或选择任务后即可给角色留言。"
    : !taskRunning
      ? "消息已保存为下轮待办；点击“开始协作”后会进入该角色上下文。"
      : status === "waiting" || status === "idle"
        ? "消息已排队，将在该角色第一次模型调用时生效。"
        : status === "running"
          ? "消息会在下一次模型调用前进入当前上下文并改变后续方向。"
          : "该角色本轮已结束；消息会保留到下一轮，不会丢失。";

  const send = async (event) => {
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text || locked) return;

    const local = {
      id: `local-${Date.now()}`,
      sender: "user",
      content: text,
      created_at: new Date().toISOString(),
      delivery_status: deliversLive ? "queued" : "pending_next_run",
    };

    setPendingMessages((prev) => prev.concat(local));
    setInput("");
    setError("");
    setSending(true);
    try {
      await collab.sendAgentMessage(taskId, role, text);
      setSending(false);
      await loadMessages();
      if (onChanged) onChanged();
    } catch (err) {
      setSending(false);
      // 失败就把输入内容还回输入框，并撤掉乐观消息
      setPendingMessages((prev) => prev.filter((item) => item.id !== local.id));
      setInput(text);
      setError(err.message);
    }
  };

  return (
    <section className={`chat chat--${meta.tone}`}>
      <header className="chat-head">
        <span className="chat-title">角色会话</span>
        <span className="chat-state">
          {loading
            ? "载入中…"
            : sending
              ? "正在发送…"
              : deliversLive
                ? status === "waiting" || status === "idle" ? "可排队" : "可插入"
                : taskId ? "可留言" : `${shown.length} 条`}
        </span>
      </header>

      <div className="chat-list" ref={listRef}>
        {shown.length === 0 ? (
          <p className="chat-empty">
            {loading
              ? "正在载入对话…"
              : `可随时给${meta.name}留言；运行中改变当前方向，其他时候进入下轮待办。`}
          </p>
        ) : (
          shown.map((item) => (
            <div
              key={item.id}
              className={`chat-msg chat-msg--${item.sender === "user" ? "user" : meta.tone}`}
            >
              <div className="chat-bubble">{item.content}</div>
              <span className="chat-time">
                {item.sender === "user" ? "我" : meta.name} · {formatClock(item.created_at)}
                {item.sender === "user" && item.delivery_status === "queued" ? " · 等待注入" : ""}
                {item.sender === "user" && item.delivery_status === "injected" ? " · 已注入" : ""}
                {item.sender === "user" && item.delivery_status === "pending_next_run" ? " · 下轮待办" : ""}
                {item.sender === "user" && item.delivery_status === "not_applied" ? " · 待重新运行" : ""}
              </span>
            </div>
          ))
        )}
      </div>

      {error ? <p className="alert alert--bad chat-alert">{error}</p> : null}

      <form className="chat-form" onSubmit={send}>
        <textarea
          className="input chat-input"
          rows={2}
          value={input}
          disabled={locked}
          placeholder={
            deliversLive
              ? `发送要求，改变${meta.name}后续工作方向…`
              : `给${meta.name}留言，下一轮协作时执行…`
          }
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="btn btn--primary chat-send" disabled={locked || !input.trim()}>
          {sending ? "正在发送…" : "发送"}
        </button>
      </form>

      {hint ? <p className="chat-hint muted">{hint}</p> : null}
    </section>
  );
}
