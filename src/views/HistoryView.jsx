import { useCallback, useEffect, useState } from "react";

import { collab } from "../api.js";
import HistoryItem from "../components/HistoryItem.jsx";

const DAY_OPTIONS = [
  { value: 7, label: "最近 7 天" },
  { value: 30, label: "最近 30 天" },
  { value: 90, label: "最近 90 天" },
  { value: 0, label: "全部" },
];

const ORDER_OPTIONS = [
  { value: "new", label: "最新在前" },
  { value: "old", label: "最早在前" },
];

function EmptyHistory() {
  return (
    <div className="empty">
      <p>暂无历史版本</p>
      <p className="muted">协作任务产生修改后，版本会出现在这里。</p>
    </div>
  );
}

export default function HistoryView() {
  const [days, setDays] = useState(30);
  const [order, setOrder] = useState("new");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({ versions: 0, tasks: 0, today: 0 });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [restoringId, setRestoringId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await collab.listHistory({ days, q: query, order, limit: 100 });
      setStats(data.stats || { versions: 0, tasks: 0, today: 0 });
      setItems(Array.isArray(data.items) ? data.items : []);
      setError("");
    } catch (err) {
      setItems([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days, query, order]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const applySearch = (event) => {
    event.preventDefault();
    setNotice("");
    setQuery(search.trim());
  };

  const refresh = () => {
    setNotice("");
    setReloadKey((value) => value + 1);
  };

  const restore = async (item) => {
    const confirmed = window.confirm(
      `确定回到版本 ${item.sha} 吗？这会用该版本的产物覆盖当前工作目录，未提交的改动将会丢失。`
    );
    if (!confirmed) return;
    setRestoringId(item.id);
    setError("");
    setNotice("");
    try {
      const result = await collab.restoreVersion(item.task_id, item.sha);
      setNotice(result?.message || `已回退到 ${item.sha}`);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId("");
    }
  };

  return (
    <div className="page page--wide">
      <header className="page-head">
        <div>
          <h1>修改历史</h1>
          <p className="muted">查看每次修改产生的版本，并回退到任意一次。</p>
        </div>
        <div className="history-stats">
          <div className="stat">
            <span className="stat-value">{stats.versions ?? 0}</span>
            <span className="stat-label">版本总数</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.tasks ?? 0}</span>
            <span className="stat-label">协作任务</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.today ?? 0}</span>
            <span className="stat-label">今日提交</span>
          </div>
        </div>
      </header>

      <form className="panel history-filters" onSubmit={applySearch}>
        <label className="field">
          <span className="field-label">日期范围</span>
          <select
            className="input"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--grow">
          <span className="field-label">搜索</span>
          <span className="history-search">
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="标题、成员或文件名"
            />
            <button type="submit" className="icon-btn history-search-btn" title="搜索" aria-label="搜索">
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <line
                  x1="10.6"
                  y1="10.6"
                  x2="14.4"
                  y2="14.4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        </label>

        <label className="field">
          <span className="field-label">排序</span>
          <select
            className="input"
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          >
            {ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="btn history-refresh" onClick={refresh} disabled={loading}>
          {loading ? "刷新中…" : "刷新"}
        </button>
      </form>

      {error ? <p className="alert alert--bad">{error}</p> : null}
      {notice ? <p className="alert alert--ok">{notice}</p> : null}

      <section className="panel">
        <header className="panel-head">
          <h2>版本列表</h2>
          <span className="muted">{loading ? "读取中…" : `${items.length} 条`}</span>
        </header>

        {loading ? (
          <p className="muted">正在加载历史版本</p>
        ) : items.length === 0 ? (
          <EmptyHistory />
        ) : (
          <ul className="history-list">
            {items.map((item) => (
              <HistoryItem
                key={item.id || `${item.task_id || "task"}:${item.sha || "sha"}`}
                item={item}
                restoring={restoringId === item.id}
                onRestore={restore}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
