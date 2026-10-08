const JSON_HEADERS = { "Content-Type": "application/json" };

async function toError(response) {
  let detail = `请求失败（HTTP ${response.status}）`;
  try {
    const body = await response.json();
    if (body && body.detail) {
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    }
  } catch {
    // 响应体不是 JSON，沿用默认提示
  }
  return new Error(detail);
}

async function request(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  health: () => request("/api/health"),

  getSettings: () => request("/api/settings"),
  saveSettings: (payload) =>
    request("/api/settings", { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(payload) }),
  testSettings: () => request("/api/settings/test", { method: "POST" }),

  listProjects: () => request("/api/projects"),
  createProject: (payload) =>
    request("/api/projects", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(payload) }),
  updateProject: (id, payload) =>
    request(`/api/projects/${id}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }),
  getProject: (id) => request(`/api/projects/${id}`),

  uploadDocuments: (projectId, files, sourceType = "research_paper") => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    form.append("source_type", sourceType);
    return request(`/api/projects/${projectId}/documents`, { method: "POST", body: form });
  },

  analyze: (projectId) => request(`/api/projects/${projectId}/analyze`, { method: "POST" }),
  getJob: (jobId) => request(`/api/jobs/${jobId}`),
  getReport: (reportId) => request(`/api/reports/${reportId}`),
  downloadUrl: (reportId, kind) => `/api/reports/${reportId}/download/${kind}`,
};

export const collab = {
  listTasks: () => request("/api/collab/tasks"),
  createTask: (payload) =>
    request("/api/collab/tasks", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(payload) }),
  // 从材料研究课题发起协作：带上课题信息与已解析的文献
  createTaskFromProject: (projectId) =>
    request("/api/collab/tasks/from-project", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ project_id: projectId }),
    }),
  getTask: (taskId) => request(`/api/collab/tasks/${taskId}`),

  uploadDocuments: (taskId, files) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    return request(`/api/collab/tasks/${taskId}/documents`, { method: "POST", body: form });
  },

  startTask: (taskId) => request(`/api/collab/tasks/${taskId}/start`, { method: "POST" }),
  cancelTask: (taskId) => request(`/api/collab/tasks/${taskId}/cancel`, { method: "POST" }),
  getEvents: (taskId, after = 0) => request(`/api/collab/tasks/${taskId}/events?after=${after}`),

  artifactUrl: (artifactId) => `/api/collab/artifacts/${artifactId}/download`,
  downloadAllUrl: (taskId) => `/api/collab/tasks/${taskId}/download-all`,

  // 内联预览：返回 kind/content/editable/truncated 等字段
  artifactPreview: (artifactId) => request(`/api/collab/artifacts/${artifactId}/preview`),
  // 就地编辑保存：成功返回 { ok, sha, size, filename }
  saveArtifactContent: (artifactId, content) =>
    request(`/api/collab/artifacts/${artifactId}/content`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ content }),
    }),
  // 把产物直接发到一个网址：以 multipart/form-data 上传，字段名默认 file
  sendArtifact: (artifactId, url, field = "file") =>
    request(`/api/collab/artifacts/${artifactId}/send`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ url, field }),
    }),

  // 持久角色会话：运行中注入当前上下文，其他状态保存为下一轮待办
  agentMessages: (taskId, role, limit = 50) =>
    request(`/api/collab/tasks/${taskId}/agents/${role}/messages?limit=${limit}`),
  sendAgentMessage: (taskId, role, message) =>
    request(`/api/collab/tasks/${taskId}/agents/${role}/messages`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ message }),
    }),

  // 修改历史：days 取 7/30/90/0，order 取 "new" | "old"
  listHistory: ({ days = 30, q = "", order = "new", limit = 100 } = {}) => {
    const params = new URLSearchParams({
      days: String(days),
      q,
      order,
      limit: String(limit),
    });
    return request(`/api/collab/history?${params.toString()}`);
  },
  taskHistory: (taskId, limit = 50) => request(`/api/collab/tasks/${taskId}/history?limit=${limit}`),
  restoreVersion: (taskId, sha) =>
    request(`/api/collab/tasks/${taskId}/history/${sha}/restore`, { method: "POST" }),
};

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];
