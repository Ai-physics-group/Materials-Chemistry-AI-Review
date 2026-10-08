import { formatTime, roleMeta } from "../collab.js";

const FILE_STATUS = {
  A: { label: "新增", tone: "add" },
  M: { label: "修改", tone: "mod" },
  D: { label: "删除", tone: "del" },
};

const VISIBLE_FILES = 8;

function fileMeta(status) {
  return FILE_STATUS[status] || { label: status || "变更", tone: "mod" };
}

export default function HistoryItem({ item, restoring, onRestore }) {
  const tone = roleMeta(item.author_role).tone;
  const files = item.files || [];
  const fileCount = item.file_count === undefined || item.file_count === null ? files.length : item.file_count;
  const shown = files.slice(0, VISIBLE_FILES);
  const hidden = Math.max(0, files.length - shown.length);

  return (
    <li className="history-item">
      <div className="history-item-head">
        <div className="history-item-title">
          <span className="history-task">{item.task_name || "未命名任务"}</span>
          <span className={`badge badge--${tone}`}>
            {item.author_name || roleMeta(item.author_role).name}
          </span>
        </div>
        <div className="history-item-actions">
          <span className="history-sha" title={item.sha}>
            {item.sha}
          </span>
          <span className="history-time">{formatTime(item.created_at)}</span>
          <button
            type="button"
            className="btn btn--ghost history-restore"
            onClick={() => onRestore(item)}
            disabled={restoring}
          >
            {restoring ? "回退中…" : "回到此版本"}
          </button>
        </div>
      </div>

      <p className="history-message">{item.message || "（无提交说明）"}</p>

      <div className="history-files">
        <span className="muted">{fileCount} 个文件变更</span>
        {shown.map((file) => {
          const meta = fileMeta(file.status);
          return (
            <span key={`${file.status}-${file.path}`} className={`file-tag file-tag--${meta.tone}`}>
              <span className={`file-tag-status file-tag-status--${meta.tone}`}>{file.status}</span>
              <span className="file-tag-path" title={file.path}>
                {file.path}
              </span>
            </span>
          );
        })}
        {hidden > 0 ? <span className="pill">+{hidden} 个文件</span> : null}
      </div>
    </li>
  );
}
