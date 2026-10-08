import { useCallback, useEffect, useRef, useState } from "react";

import { collab } from "../api.js";
import AgentCard from "../components/AgentCard.jsx";
import ArtifactPanel from "../components/ArtifactPanel.jsx";
import CaptainConsole from "../components/CaptainConsole.jsx";
import CollabTerminal from "../components/CollabTerminal.jsx";
import { AGENT_ROLES, BADGE_STATUS, ROLE_META, TASK_STATUS, formatTime } from "../collab.js";

// 协作任务除了文献，还能直接传实验/计算数据给材料数据员与 AI 建模员使用
const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.tsv,.json,.xlsx,.xls";
const POLL_INTERVAL = 1200;
const MAX_EVENTS = 400;

function emptyAgents() {
  return AGENT_ROLES.map((role) => ({
    role,
    name: ROLE_META[role].name,
    en: ROLE_META[role].en,
    status: "idle",
    progress: 0,
    speed: 0,
    current_step: "",
    message_count: 0,
    error: "",
    checklist: [],
    artifacts: { chart: 0, code: 0, data: 0, paper: 0 },
  }));
}

export default function CollabView({ initialTaskId = "" }) {
  const [tasks, setTasks] = useState([]);
  const [task, setTask] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", goal: "" });
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInput = useRef(null);
  const lastEventId = useRef(0);

  const applyEvents = useCallback((incoming) => {
    const list = incoming || [];
    if (list.length === 0) return;
    for (const item of list) {
      const value = Number(item.id);
      if (Number.isFinite(value) && value > lastEventId.current) lastEventId.current = value;
    }
    setEvents((prev) => {
      const known = new Set(prev.map((item) => item.id));
      return prev.concat(list.filter((item) => !known.has(item.id))).slice(-MAX_EVENTS);
    });
  }, []);

  const loadTask = useCallback(
    async (taskId) => {
      const detail = await collab.getTask(taskId);
      lastEventId.current = 0;
      setEvents([]);
      applyEvents(detail.events);
      setTask(detail);
      return detail;
    },
    [applyEvents]
  );

  const refreshList = useCallback(async () => {
    const data = await collab.listTasks();
    setTasks(data);
    return data;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await collab.listTasks();
        if (!alive) return;
        setTasks(data);
        // 从课题发起协作时会指定要打开的任务，否则默认选最近一个
        const preferred =
          initialTaskId && data.some((item) => item.id === initialTaskId) ? initialTaskId : data[0]?.id;
        if (preferred) await loadTask(preferred);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadTask, initialTaskId]);

  const taskId = task?.id;
  const taskStatus = task?.status;
  const running = taskStatus === "running";

  useEffect(() => {
    if (!taskId || taskStatus !== "running") return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const detail = await collab.getTask(taskId);
        if (stopped) return;
        setTask(detail);
        const fresh = await collab.getEvents(taskId, lastEventId.current);
        if (stopped) return;
        applyEvents(fresh);
        if (detail.status !== "running") await refreshList();
      } catch (err) {
        if (!stopped) setError(err.message);
      }
    };
    const interval = setInterval(tick, POLL_INTERVAL);
    tick();
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [taskId, taskStatus, applyEvents, refreshList]);

  const refreshTask = useCallback(async () => {
    if (!taskId) return null;
    setRefreshing(true);
    try {
      const [detail, fresh] = await Promise.all([
        collab.getTask(taskId),
        collab.getEvents(taskId, lastEventId.current),
      ]);
      setTask(detail);
      applyEvents(fresh);
      setError("");
      return detail;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [taskId, applyEvents]);

  const selectTask = async (nextId) => {
    if (!nextId || nextId === taskId) return;
    setError("");
    setNotice("");
    try {
      await loadTask(nextId);
    } catch (err) {
      setError(err.message);
    }
  };

  const createTask = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const created = await collab.createTask({ name, goal: form.goal.trim() });
      setForm({ name: "", goal: "" });
      lastEventId.current = 0;
      setEvents([]);
      applyEvents(created.events);
      setTask(created);
      setTasks((prev) => [created].concat(prev.filter((item) => item.id !== created.id)));
      setNotice(`任务「${created.name}」已创建，可以上传文档并开始协作。`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const upload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0 || !taskId) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const result = await collab.uploadDocuments(taskId, files);
      setNotice(`已上传 ${result.input_name || `${files.length} 个文件`}（${result.chars || 0} 字）。`);
      await refreshTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const startTask = async () => {
    if (!taskId) return;
    setStarting(true);
    setError("");
    setNotice("");
    try {
      const result = await collab.startTask(taskId);
      setTask((prev) => (prev ? { ...prev, status: result.status || "running" } : prev));
      setNotice("已启动协作，材料数据、AI 建模与论文证据三位成员开始并行工作。");
      await refreshTask();
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const cancelTask = async () => {
    if (!taskId) return;
    setCancelling(true);
    setError("");
    setNotice("");
    try {
      await collab.cancelTask(taskId);
      setNotice("任务已撤销。");
      await refreshTask();
      await refreshList();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const pickFiles = () => {
    if (fileInput.current) fileInput.current.click();
  };

  const agents = task && (task.agents || []).length > 0 ? task.agents : emptyAgents();
  const artifacts = task ? task.artifacts || [] : [];
  const status = task?.status || "";
  const taskOptions =
    !task || tasks.some((item) => item.id === task.id) ? tasks : [task].concat(tasks);

  if (loading) {
    return (
      <div className="page">
        <p className="muted">正在载入协作任务…</p>
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <header className="toolbar">
        <div className="tabs">
          <button type="button" className="tab is-active">
            协作
          </button>
          <button type="button" className="tab" disabled>
            任务详情
          </button>
          <button type="button" className="tab" disabled>
            一键式工作流
          </button>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={pickFiles} disabled={!task || uploading}>
            {uploading ? "上传中…" : "文档上传"}
          </button>
          {task ? (
            <a className="btn btn--primary" href={collab.downloadAllUrl(task.id)} download>
              下载全部产物
            </a>
          ) : (
            <button type="button" className="btn btn--primary" disabled>
              下载全部产物
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          className="hidden-input"
          type="file"
          accept={ACCEPT}
          multiple
          onChange={(event) => upload(event.target.files)}
        />
      </header>

      <header className="page-head">
        <div>
          <h1>{task ? task.name : "尚未选择任务"}</h1>
          <p className="muted">{task ? task.goal || "未填写目标描述" : "还没有求解任务"}</p>
          {task ? (
            <div className="card-meta">
              <span className="pill">成员 {task.agent_count || agents.length}</span>
              <span className="pill">产物 {task.artifact_count || artifacts.length}</span>
              <span className="pill">输入 {task.input_name || "未上传"}</span>
              <span className="pill">更新于 {formatTime(task.updated_at)}</span>
            </div>
          ) : null}
        </div>
        {taskOptions.length > 0 ? (
          <label className="field field--compact">
            <span className="field-label">当前任务</span>
            <select
              className="input"
              value={task ? task.id : ""}
              onChange={(event) => selectTask(event.target.value)}
            >
              {taskOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      {error ? <p className="alert alert--bad">{error}</p> : null}
      {notice ? <p className="alert alert--ok">{notice}</p> : null}

      {!task ? (
        <form className="panel" onSubmit={createTask}>
          <header className="panel-head">
            <div>
              <h2>新建协作任务</h2>
              <p className="muted">上传论文、实验记录或数据，让材料数据、AI 建模和论文证据成员并行协作。</p>
            </div>
          </header>
          <div className="form-row">
            <label className="field">
              <span className="field-label">任务名称</span>
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例如：高镍正极循环寿命预测"
                maxLength={120}
                required
              />
            </label>
            <label className="field field--grow">
              <span className="field-label">目标 / 题目描述</span>
              <input
                className="input"
                value={form.goal}
                onChange={(event) => setForm((prev) => ({ ...prev, goal: event.target.value }))}
                placeholder="例如：审计数据质量，建立避免数据泄漏的基线模型，并产出带证据标记的论文草稿。"
                maxLength={2000}
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={creating || !form.name.trim()}>
              {creating ? "创建中…" : "创建任务"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="collab-body">
        <div className="collab-main">
          <section className="collab-team">
            <header className="section-head">
              <div>
                <span className="eyebrow">AI TEAM</span>
                <h2>材料数据、AI 建模与论文证据协作</h2>
              </div>
              <div className="section-actions">
                <span className={`badge badge--${task ? BADGE_STATUS[status] || "run" : "idle"}`}>
                  ● {task ? TASK_STATUS[status] || status : "未选择任务"}
                </span>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={startTask}
                  disabled={!task || running || starting}
                >
                  {running ? "协作进行中…" : starting ? "正在启动…" : "开始协作"}
                </button>
              </div>
            </header>
            <div className="agent-grid">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.role}
                  agent={agent}
                  taskId={taskId}
                  taskStatus={status}
                  onChanged={refreshTask}
                />
              ))}
            </div>
          </section>

          <CollabTerminal events={events} />
          <ArtifactPanel artifacts={artifacts} onChanged={refreshTask} />
        </div>

        <CaptainConsole
          task={task || { id: "", status: "draft", progress: 0, agents: [], artifacts: [] }}
          events={events}
          refreshing={refreshing}
          cancelling={cancelling}
          onRefresh={refreshTask}
          onCancel={cancelTask}
          onReupload={pickFiles}
        />
      </div>
    </div>
  );
}
