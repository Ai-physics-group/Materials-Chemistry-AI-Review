// 协作工作台共用的角色元数据与格式化工具。

export const ROLE_META = {
  captain: { name: "队长", en: "Captain", tone: "captain" },
  chart: { name: "材料数据员", en: "Materials Data", tone: "chart" },
  coder: { name: "AI 建模员", en: "ML Researcher", tone: "coder" },
  writer: { name: "论文证据员", en: "Manuscript & Evidence", tone: "writer" },
  // 用户在预览里手动编辑产物时用的身份
  user: { name: "我", en: "You", tone: "user" },
};

export const AGENT_ROLES = ["chart", "coder", "writer"];

export const CATEGORY_META = {
  chart: { label: "图表", ext: "IMG" },
  code: { label: "代码", ext: "PY" },
  data: { label: "数据", ext: "CSV" },
  paper: { label: "论文", ext: "DOC" },
};

export const ARTIFACT_TABS = [
  { key: "chart", label: "图表", empty: "暂无图表文件，材料数据员生成产物后会显示在这里。" },
  { key: "code", label: "代码", empty: "暂无代码文件，AI 建模员生成产物后会显示在这里。" },
  { key: "data", label: "数据", empty: "暂无数据文件，任务产出数据后会显示在这里。" },
  { key: "paper", label: "论文", empty: "暂无论文文件，论文证据员生成产物后会显示在这里。" },
];

export const TASK_STATUS = {
  draft: "尚未开始",
  running: "协作进行中",
  completed: "协作已完成",
  failed: "协作已失败",
  cancelled: "协作已取消",
};

export const AGENT_STATUS = {
  idle: "待命",
  waiting: "等待前序阶段",
  running: "协作中",
  done: "已完成",
  blocked: "前序阻断",
  failed: "已失败",
};

export const BADGE_STATUS = {
  draft: "run",
  running: "run",
  completed: "ok",
  failed: "bad",
  cancelled: "bad",
};

export function roleMeta(role) {
  return ROLE_META[role] || { name: role || "未知角色", en: role || "Unknown", tone: "captain" };
}

export function roleLabel(role) {
  return roleMeta(role).name;
}

export function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}

export function formatClock(value) {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString("zh-CN", { hour12: false });
}

export function formatSize(value) {
  const num = Number(value) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / 1024 / 1024).toFixed(1)} MB`;
}
