import { useCallback, useEffect, useState } from "react";

import { api } from "./api.js";
import CollabView from "./views/CollabView.jsx";
import HistoryView from "./views/HistoryView.jsx";
import ProjectDetailView from "./views/ProjectDetailView.jsx";
import ProjectsView from "./views/ProjectsView.jsx";
import SettingsView from "./views/SettingsView.jsx";

const NAV = [
  { key: "projects", label: "材料研究", hint: "课题 · 证据 · 文献综合" },
  { key: "collab", label: "科研协作", hint: "材料数据 · AI 建模 · 论文证据" },
  { key: "history", label: "历史", hint: "版本记载与回退" },
  { key: "settings", label: "模型设置", hint: "Claude Code · 兼容 API" },
];

export default function App() {
  const [view, setView] = useState("projects");
  const [activeProjectId, setActiveProjectId] = useState("");
  const [collabTaskId, setCollabTaskId] = useState("");
  const [online, setOnline] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [collabBackend, setCollabBackend] = useState("");
  const [collabConfigured, setCollabConfigured] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshStatus = useCallback(async () => {
    try {
      await api.health();
      setOnline(true);
      const settings = await api.getSettings();
      setConfigured(Boolean(settings.api_configured ?? (settings.base_url && settings.model && settings.has_api_key)));
      setCollabBackend(settings.collab_backend || "api");
      setCollabConfigured(Boolean(settings.collab_configured));
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus, refreshKey]);

  const openProject = (id) => {
    setActiveProjectId(id);
    setView("project");
  };

  const goProjects = () => {
    setActiveProjectId("");
    setView("projects");
    setRefreshKey((value) => value + 1);
  };

  // 从课题详情页「发起科研协作」：带着刚建好的任务直接跳到协作页
  const openCollabWithTask = (taskId) => {
    setCollabTaskId(taskId || "");
    setView("collab");
  };

  const projectsActive = view === "projects" || view === "project";
  const navActive = {
    projects: projectsActive,
    collab: view === "collab",
    history: view === "history",
    settings: view === "settings",
  };

  const openNav = (key) => {
    if (key === "projects") goProjects();
    else if (key === "collab") {
      setCollabTaskId("");
      setView("collab");
    } else setView(key);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">知</span>
          <div>
            <div className="brand-name">知析台</div>
            <div className="brand-sub">材料化学与 AI 论文工作台</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => {
            const isActive = Boolean(navActive[item.key]);
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item${isActive ? " is-active" : ""}`}
                onClick={() => openNav(item.key)}
              >
                <span className="nav-label">{item.label}</span>
                <span className="nav-hint">{item.hint}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className={`status status--${online === null ? "wait" : online ? "ok" : "bad"}`}>
            <span className="dot" />
            {online === null ? "正在连接后端…" : online ? "后端已连接" : "后端未连接"}
          </div>
          <div className="status-note">{configured ? "文献分析 API 已配置" : "文献分析 API 未配置"}</div>
          <div className="status-note">
            科研协作：{collabConfigured ? (collabBackend === "claude_code" ? "Claude Code" : "兼容 API") : "未配置"}
          </div>
          <div className="status-note">出站请求仅由所选模型后端发起</div>
        </div>
      </aside>

      <main className="main">
        {view === "settings" && <SettingsView onSaved={() => setRefreshKey((value) => value + 1)} />}

        {view === "projects" && (
          <ProjectsView
            key={refreshKey}
            configured={configured}
            onOpenProject={openProject}
            onOpenSettings={() => setView("settings")}
          />
        )}

        {view === "project" && activeProjectId && (
          <ProjectDetailView
            projectId={activeProjectId}
            configured={configured}
            onBack={goProjects}
            onOpenSettings={() => setView("settings")}
            onStartCollab={openCollabWithTask}
          />
        )}

        {view === "collab" && <CollabView initialTaskId={collabTaskId} />}

        {view === "history" && <HistoryView />}
      </main>
    </div>
  );
}
