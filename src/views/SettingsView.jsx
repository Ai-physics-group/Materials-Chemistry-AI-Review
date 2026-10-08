import { useEffect, useState } from "react";

import { api } from "../api.js";

const PRESETS = [
  { label: "OpenAI", base_url: "https://api.openai.com/v1" },
  { label: "DeepSeek", base_url: "https://api.deepseek.com/v1" },
  { label: "阿里百炼兼容模式", base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { label: "本地 Ollama", base_url: "http://127.0.0.1:11434/v1" },
];

export default function SettingsView({ onSaved }) {
  const [form, setForm] = useState({
    base_url: "",
    model: "",
    api_key: "",
    collab_backend: "api",
    claude_model: "",
  });
  const [hasKey, setHasKey] = useState(false);
  const [claude, setClaude] = useState({ available: false, authenticated: false, version: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .getSettings()
      .then((data) => {
        if (!alive) return;
        setForm({
          base_url: data.base_url || "",
          model: data.model || "",
          api_key: "",
          collab_backend: data.collab_backend || "api",
          claude_model: data.claude_model || "",
        });
        setHasKey(Boolean(data.has_api_key));
        setClaude(data.claude || { available: false, authenticated: false, version: "" });
      })
      .catch((error) => {
        if (alive) setMessage({ kind: "bad", text: error.message });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.saveSettings(form);
      setHasKey(Boolean(result.has_api_key));
      setClaude(result.claude || claude);
      setForm((prev) => ({ ...prev, api_key: "" }));
      setMessage({
        kind: "ok",
        text: `配置已保存；科研协作将使用${result.collab_backend === "claude_code" ? " Claude Code" : "兼容 API"}。`,
      });
      if (onSaved) onSaved();
    } catch (error) {
      setMessage({ kind: "bad", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const result = await api.testSettings();
      setMessage({ kind: "ok", text: `连接成功：${result.message}` });
    } catch (error) {
      setMessage({ kind: "bad", text: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>接口设置</h1>
          <p className="muted">
            科研协作可直接调用本机 Claude Code，也可继续使用 OpenAI 兼容接口。API 密钥使用 Windows
            DPAPI 加密后保存在本机，不会写入日志。
          </p>
        </div>
      </header>

      {message ? <p className={`alert alert--${message.kind}`}>{message.text}</p> : null}

      <form className="panel" onSubmit={save}>
        {loading ? (
          <p className="muted">正在读取本机配置…</p>
        ) : (
          <>
            <div className="field">
              <span className="field-label">科研协作执行后端</span>
              <div className="preset-row">
                <button
                  type="button"
                  className={`chip${form.collab_backend === "claude_code" ? " is-active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, collab_backend: "claude_code" }))}
                  disabled={!claude.available || !claude.authenticated}
                >
                  Claude Code
                </button>
                <button
                  type="button"
                  className={`chip${form.collab_backend === "api" ? " is-active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, collab_backend: "api" }))}
                >
                  OpenAI 兼容 API
                </button>
              </div>
              <span className="field-hint">
                {claude.available
                  ? claude.authenticated
                    ? `Claude Code ${claude.version || "已安装"}，当前已登录。`
                    : "已检测到 Claude Code，但尚未登录。"
                  : "本机尚未检测到 Claude Code。"}
              </span>
            </div>

            {form.collab_backend === "claude_code" ? (
              <label className="field">
                <span className="field-label">Claude 模型（可选）</span>
                <input
                  className="input"
                  value={form.claude_model}
                  onChange={update("claude_model")}
                  placeholder="sonnet / opus（留空默认 sonnet）"
                  spellCheck={false}
                />
                <span className="field-hint">
                  每个科研角色使用独立、可续接的 Claude Code 会话；文件权限仍由知析台质量门禁控制。
                </span>
              </label>
            ) : null}

            <div className="section-kicker">兼容 API（文献分析与备用后端）</div>
            <label className="field">
              <span className="field-label">Base URL</span>
              <input
                className="input"
                value={form.base_url}
                onChange={update("base_url")}
                placeholder="https://api.example.com/v1"
                spellCheck={false}
                required={form.collab_backend === "api"}
              />
              <span className="field-hint">需要是 OpenAI Chat Completions 兼容地址，末尾不要带 /chat/completions。</span>
            </label>

            <div className="preset-row">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="chip"
                  onClick={() => setForm((prev) => ({ ...prev, base_url: preset.base_url }))}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <label className="field">
              <span className="field-label">模型名称</span>
              <input
                className="input"
                value={form.model}
                onChange={update("model")}
                placeholder="gpt-4o-mini / deepseek-chat / qwen-plus"
                spellCheck={false}
                required={form.collab_backend === "api"}
              />
            </label>

            <label className="field">
              <span className="field-label">API Key</span>
              <input
                className="input"
                type="password"
                value={form.api_key}
                onChange={update("api_key")}
                placeholder={hasKey ? "已保存，留空表示不修改" : "sk-..."}
                autoComplete="off"
                spellCheck={false}
              />
              <span className="field-hint">
                {hasKey ? "本机已存在加密密钥，留空即可保持不变。" : "首次配置必须填写。"}
              </span>
            </label>

            <div className="actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? "保存中…" : "保存配置"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={test}
                disabled={testing || (form.collab_backend === "api" ? !hasKey : !claude.authenticated)}
              >
                {testing ? "测试中…" : "测试连接"}
              </button>
            </div>
          </>
        )}
      </form>

      <section className="panel panel--quiet">
        <h2>网络边界</h2>
        <ul className="plain-list">
          <li>后端仅监听 127.0.0.1，不对局域网或公网开放。</li>
          <li>已硬性禁止配置学术坊域名（含子域名）。</li>
          <li>Claude Code 仅通过官方本机 CLI 调用，不读取或复制网页版登录协议。</li>
          <li>Claude Code 内置文件工具已关闭，所有文件操作仍经过本应用的角色权限与质量门禁。</li>
          <li>不包含会员、余额、充值或支付功能。</li>
          <li>报告与文献全部存放在本机 data 目录。</li>
        </ul>
      </section>
    </div>
  );
}
