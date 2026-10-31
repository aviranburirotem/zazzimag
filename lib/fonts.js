// Fonts for the site (console → Fonts). Content lives in content/fonts.json:
//   { roles: { head, main, article, desc, label }, custom: [ ... ] }
// roles: which font each kind of text uses (a name from FREE below, or a custom font's name)
// custom: fonts added in the console
//   { name, kind: "files", files: [{ file: "/fonts/x.woff2", weight: 400, italic: false }] }  uploaded font files
//   { name, kind: "link", url: "https://use.typekit.net/abc.css" }  a font service's stylesheet (e.g. Adobe Fonts)
//
// FREE: Google Fonts, all under the SIL Open Font License or Apache 2.0, so free for commercial use.
// spec = the styles to load (Google Fonts css2 syntax); fallback = the generic family behind it.
export const FREE = [
  { name: "Archivo", spec: "ital,wdth,wght@0,62..125,400..900;1,62..125,400..900", fallback: "sans-serif", note: "Current headline & text font" },
  { name: "Inter", spec: "ital,opsz,wght@0,14..32,400..900;1,14..32,400..900", fallback: "sans-serif" },
  { name: "DM Sans", spec: "ital,opsz,wght@0,9..40,400..900;1,9..40,400..900", fallback: "sans-serif" },
  { name: "Space Grotesk", spec: "wght@400..700", fallback: "sans-serif" },
  { name: "Manrope", spec: "wght@400..800", fallback: "sans-serif" },
  { name: "Plus Jakarta Sans", spec: "ital,wght@0,400..800;1,400..800", fallback: "sans-serif" },
  { name: "Work Sans", spec: "ital,wght@0,400..900;1,400..900", fallback: "sans-serif" },
  { name: "Rubik", spec: "ital,wght@0,400..900;1,400..900", fallback: "sans-serif" },
  { name: "Montserrat", spec: "ital,wght@0,400..900;1,400..900", fallback: "sans-serif" },
  { name: "Outfit", spec: "wght@400..900", fallback: "sans-serif" },
  { name: "Sora", spec: "wght@400..800", fallback: "sans-serif" },
  { name: "Bricolage Grotesque", spec: "opsz,wdth,wght@12..96,75..100,400..800", fallback: "sans-serif" },
  { name: "Syne", spec: "wght@400..800", fallback: "sans-serif" },
  { name: "Unbounded", spec: "wght@400..900", fallback: "sans-serif" },
  { name: "Oswald", spec: "wght@400..700", fallback: "sans-serif" },
  { name: "Anton", spec: "", fallback: "sans-serif" },
  { name: "Bebas Neue", spec: "", fallback: "sans-serif" },
  { name: "Newsreader", spec: "ital,opsz,wght@0,6..72,400..800;1,6..72,400..800", fallback: "serif", note: "Current article font" },
  { name: "Fraunces", spec: "ital,opsz,wght@0,9..144,400..900;1,9..144,400..900", fallback: "serif" },
  { name: "Playfair Display", spec: "ital,wght@0,400..900;1,400..900", fallback: "serif" },
  { name: "DM Serif Display", spec: "ital@0;1", fallback: "serif" },
  { name: "Instrument Serif", spec: "ital@0;1", fallback: "serif" },
  { name: "Lora", spec: "ital,wght@0,400..700;1,400..700", fallback: "serif" },
  { name: "IBM Plex Mono", spec: "ital,wght@0,400;0,500;0,700;1,400", fallback: "monospace", note: "Current label font" },
  { name: "JetBrains Mono", spec: "ital,wght@0,400..800;1,400..800", fallback: "monospace" },
  { name: "Space Mono", spec: "ital,wght@0,400;0,700;1,400;1,700", fallback: "monospace" },
  { name: "DM Mono", spec: "ital,wght@0,400;0,500;1,400", fallback: "monospace" },
];

// Kinds of text on the site → the CSS variable they use, and the font they start with
export const ROLES = [
  { key: "head", label: "Big headlines", hint: "Home headline, page titles, section titles, article headings", css: "--head", default: "Archivo" },
  { key: "main", label: "Main text", hint: "Menus, buttons, tile titles and most other text", css: "--display", default: "Archivo" },
  { key: "article", label: "Article text", hint: "The body of articles", css: "--serif", default: "Newsreader" },
  { key: "desc", label: "Descriptions", hint: "Page intros and short descriptions", css: "--text", default: "Archivo" },
  { key: "label", label: "Small labels", hint: "Dates, categories, badges, prices", css: "--mono", default: "IBM Plex Mono" },
];

const FALLBACK = { "sans-serif": 'system-ui,-apple-system,"Segoe UI",Arial,sans-serif', serif: 'Georgia,"Times New Roman",serif', monospace: "ui-monospace,Menlo,monospace" };
const q = (name) => `"${String(name).replace(/["\\]/g, "")}"`;
export const googleUrl = (names) => {
  const fams = [...new Set(names)].map((n) => FREE.find((f) => f.name === n)).filter(Boolean)
    .map((f) => `family=${f.name.replace(/ /g, "+")}${f.spec ? ":" + f.spec : ""}`);
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.join("&")}&display=swap` : "";
};

// Everything the page head needs: { links: [stylesheet urls], css: "@font-face … :root{…}" }
export function fontSetup(cfg = {}) {
  const roles = cfg.roles || {}, custom = Array.isArray(cfg.custom) ? cfg.custom : [];
  const pick = ROLES.map((r) => {
    const name = roles[r.key] || r.default;
    const free = FREE.find((f) => f.name === name), own = custom.find((c) => c.name === name);
    return free || own ? { r, name, fallback: free ? free.fallback : own.fallback || "sans-serif" } : { r, name: r.default, fallback: FREE.find((f) => f.name === r.default).fallback };
  });
  const links = [];
  const g = googleUrl(pick.map((p) => p.name).filter((n) => FREE.some((f) => f.name === n)));
  if (g) links.push(g);
  let css = "";
  for (const c of custom) {
    if (!pick.some((p) => p.name === c.name)) continue; // only load what is used
    if (c.kind === "link" && /^https:\/\/[^\s"'<>]+$/.test(c.url || "")) links.push(c.url);
    if (c.kind === "files") for (const f of c.files || []) {
      if (!/^\/fonts\/[\w.-]+\.(woff2?|ttf|otf)$/i.test(f.file || "")) continue;
      const fmt = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" }[f.file.split(".").pop().toLowerCase()];
      css += `@font-face{font-family:${q(c.name)};src:url("${f.file}") format("${fmt}");font-weight:${Number(f.weight) || 400};font-style:${f.italic ? "italic" : "normal"};font-display:swap}\n`;
    }
  }
  css += `:root{${pick.map((p) => `${p.r.css}:${q(p.name)},${FALLBACK[p.fallback] || FALLBACK["sans-serif"]}`).join(";")}}`;
  return { links, css };
}
