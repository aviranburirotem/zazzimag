// Small markdown → HTML converter for articles (no dependencies).
// Supports: ## / ### headings, paragraphs, **bold**, *italic*, [links](url),
// > quotes, - lists, and images. Images on consecutive lines become a photo row.
//   ![alt text](/images/articles/slug/photo.jpg "Optional caption")

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_, t, u) => {
      const ext = /^https?:/.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    });
}

function figure(line) {
  const m = line.match(/^!\[(.*?)\]\((\S+?)(?:\s+"(.*?)")?\)$/);
  if (!m) return "";
  const [, alt, src, cap] = m;
  return `<figure><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
}

export function markdown(src) {
  const blocks = src.replace(/\r/g, "").trim().split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => l.startsWith("!["))) {
      const figs = lines.map(figure).join("");
      if (lines.length === 1) return figs;
      return `<div class="gallery${lines.length >= 3 ? " g3" : ""}">${figs}</div>`;
    }
    const first = lines[0];
    if (first.startsWith("### ")) return `<h3>${inline(first.slice(4))}</h3>`;
    if (first.startsWith("## ")) return `<h2>${inline(first.slice(3))}</h2>`;
    if (first.startsWith("> ")) return `<blockquote><p>${inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "))}</p></blockquote>`;
    if (lines.every((l) => /^[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
    return `<p>${inline(lines.join(" "))}</p>`;
  }).join("\n");
}

// Frontmatter between --- lines: `key: value` or `key: [a, b]`
export function frontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (/^\[.*\]$/.test(val)) val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    else val = val.replace(/^["']|["']$/g, "");
    if (val === "true") val = true;
    if (val === "false") val = false;
    data[key] = val;
  }
  return { data, body: m[2] };
}
