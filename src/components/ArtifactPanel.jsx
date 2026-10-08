import { Fragment, useState } from "react";

import { collab } from "../api.js";
import ArtifactPreview from "./ArtifactPreview.jsx";
import { ARTIFACT_TABS, CATEGORY_META, formatSize, formatTime } from "../collab.js";

export default function ArtifactPanel({ artifacts, onChanged }) {
  const [tab, setTab] = useState("chart");
  const [openId, setOpenId] = useState(null);
  const all = artifacts || [];
  const current = ARTIFACT_TABS.find((item) => item.key === tab) || ARTIFACT_TABS[0];
  const files = all.filter((item) => item.category === current.key);

  // 同一时刻只展开一个文件，点另一个就收起上一个
  const toggle = (artifactId) => {
    setOpenId((prev) => (prev === artifactId ? null : artifactId));
  };

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <span className="eyebrow">DELIVERABLES</span>
          <h2>协作产物</h2>
        </div>
        <span className="muted">共 {all.length} 个文件</span>
      </header>

      <div className="tabs tabs--inline">
        {ARTIFACT_TABS.map((item) => {
          const total = all.filter((entry) => entry.category === item.key).length;
          return (
            <button
              key={item.key}
              type="button"
              className={`tab${item.key === current.key ? " is-active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              <span className="tab-count">{total}</span>
            </button>
          );
        })}
      </div>

      {files.length === 0 ? (
        <p className="empty">{current.empty}</p>
      ) : (
        <ul className="artifact-list">
          {files.map((file) => {
            const opened = openId === file.id;
            return (
              <Fragment key={file.id}>
                <li className={`artifact-row${opened ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className="artifact-main"
                    onClick={() => toggle(file.id)}
                    aria-expanded={opened}
                  >
                    <span className="artifact-icon">
                      {CATEGORY_META[file.category] ? CATEGORY_META[file.category].ext : "FILE"}
                    </span>
                    <span className="artifact-info">
                      <span className="artifact-name">{file.filename}</span>
                      <span className="muted">
                        {formatSize(file.size)} · {formatTime(file.created_at)}
                      </span>
                    </span>
                    <span className="artifact-toggle">{opened ? "收起" : "预览"}</span>
                  </button>
                  <a className="btn btn--ghost" href={collab.artifactUrl(file.id)} download>
                    下载
                  </a>
                </li>
                {opened ? (
                  <li className="artifact-detail">
                    <ArtifactPreview artifact={file} onChanged={onChanged} />
                  </li>
                ) : null}
              </Fragment>
            );
          })}
        </ul>
      )}
    </section>
  );
}
