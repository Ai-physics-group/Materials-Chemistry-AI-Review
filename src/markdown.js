const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

/**
 * 极简 Markdown 渲染器：只覆盖报告导出实际用到的语法
 * （标题、无序列表、引用块、粗体、行内代码、段落）。
 * 先转义再套标签，因此原文里的 HTML 不会被执行。
 */
export function renderMarkdown(markdown) {
  const html = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const raw of String(markdown ?? "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else if (/^[ \t]+- /.test(line)) {
      // 缩进的子项（论断下面的适用条件、原文引用）
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li class="markdown-sub">${inline(line.trim().slice(2))}</li>`);
    } else if (line.startsWith("- ")) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else {
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }

  closeList();
  return html.join("\n");
}
