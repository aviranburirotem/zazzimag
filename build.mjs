// Builds the static site into /dist. Run: node build.mjs
// Articles live in content/articles/*.md — add a file there and it appears on the site.
import fs from "node:fs";
import path from "node:path";
import { markdown, frontmatter } from "./lib/markdown.js";

const SITE = {
  name: "Zazzi Magazine",
  url: "https://www.zazzimag.com",
  handle: "zazzimag",
  email: "hello@zazzimag.com",
  tagline: "Streetwear, trends, self-expression and city vibes.",
};
const IG_URL = `https://www.instagram.com/${SITE.handle}/`;
const OUT = "dist";

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// ---------- load articles ----------
const dir = "content/articles";
const articles = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((file) => {
  const { data, body } = frontmatter(fs.readFileSync(path.join(dir, file), "utf8"));
  const slug = data.slug || file.replace(/\.md$/, "");
  const words = body.split(/\s+/).length;
  return { ...data, slug, html: markdown(body), readTime: `${Math.max(1, Math.round(words / 220))} min`, url: `/articles/${slug}/` };
}).filter((a) => a.draft !== true).sort((a, b) => (a.date < b.date ? 1 : -1));

for (const a of articles) {
  for (const k of ["title", "date", "category", "cover"]) if (!a[k]) throw new Error(`Article "${a.slug}" is missing "${k}" in its frontmatter`);
}

// ---------- templates ----------
function layout({ title, description, active, body, image, type = "website", pathname = "/" }) {
  const full = title ? `${title} · ${SITE.name}` : SITE.name;
  const nav = (href, label, key, cls = "") => `<a href="${href}"${cls ? ` class="${cls}"` : ""}${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || SITE.tagline)}">
<link rel="canonical" href="${SITE.url}${pathname}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title || SITE.name)}">
<meta property="og:description" content="${esc(description || SITE.tagline)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${SITE.url}${pathname}">
<meta property="og:image" content="${SITE.url}${image || "/assets/logo.png"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#e30613">
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,400..900;1,62..125,400..900&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap bar">
  <a class="logo" href="/" aria-label="Zazzi magazine home"><img src="/assets/logo.png" alt="Zazzi magazine" width="60" height="60"></a>
  <nav class="site-nav" aria-label="Main">
    ${nav("/about/", "Info", "about")}
    ${nav("/store/", "Store", "store")}
    ${nav("/articles/", "All articles", "articles", "cta")}
  </nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap">
  <a class="logo" href="/"><img src="/assets/logo.png" alt="Zazzi magazine" width="60" height="60"></a>
  <nav aria-label="Footer" class="label"><a href="/articles/">Articles</a><a href="/about/">Info &amp; contact</a><a href="/store/">Store</a><a href="${IG_URL}" target="_blank" rel="noopener">Instagram ↗</a></nav>
  <span class="label">© ${new Date().getFullYear()} Zazzi</span>
</div></footer>
<div class="modal" id="modal" hidden></div>
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

const artTile = (a, feat = false) => `<a class="tile art${feat ? " feat" : ""}" href="${a.url}" data-cat="${esc(a.category)}">
  <div class="ph"><img src="${esc(a.cover)}" alt="${esc(a.coverAlt || a.title)}" loading="lazy"><span class="badge a">${esc(a.category)}</span></div>
  <span class="label">${fmtDate(a.date)} · ${a.readTime}</span><h3>${esc(a.title)}</h3>${feat && a.dek ? `<p class="cap">${esc(a.dek)}</p>` : ""}</a>`;
const igSlot = () => `<div class="tile ig ig-slot" aria-hidden="true"><div class="ph"></div></div>`;

// ---------- pages ----------
function home() {
  // Newest article large, then two Instagram posts per article.
  const items = [];
  const [first, ...rest] = articles;
  if (first) items.push(artTile(first, true));
  const IG_COUNT = 12;
  let a = 0;
  for (let i = 0; i < IG_COUNT; i++) {
    items.push(igSlot());
    if (i % 2 === 1 && a < rest.length && a < 6) items.push(artTile(rest[a++]));
  }
  return layout({
    active: "home", pathname: "/",
    description: `Zazzi Magazine. ${SITE.tagline} Street style from @${SITE.handle} and stories from the city.`,
    body: `<section class="wrap intro"><div>
      <h1>Street style,<br>straight from the feed</h1>
      <p>${esc(SITE.tagline)} Fresh looks from our Instagram, mixed with longer stories from the street.</p></div>
      <a class="handle" href="${IG_URL}" target="_blank" rel="noopener"><span class="dot"></span>@${SITE.handle} ↗</a></section>
    <section class="wrap grid" aria-label="Latest posts and stories">${items.join("")}</section>
    <section class="band"><div class="wrap"><h2>Every story, in one place</h2><a class="btn alt" href="/articles/">See all articles</a></div></section>`,
  });
}

function articlesIndex() {
  const cats = ["All", ...new Set(articles.map((a) => a.category))];
  return layout({
    title: "Articles", active: "articles", pathname: "/articles/",
    description: "All Zazzi stories: street style, trends, guides and interviews.",
    body: `<section class="wrap intro"><div><span class="label">${articles.length} stories</span><h1>Articles</h1></div></section>
    <div class="wrap filters" role="group" aria-label="Filter by category">${cats.map((c) => `<button class="chip" type="button" data-filter="${esc(c)}" aria-pressed="${c === "All"}">${esc(c)}</button>`).join("")}</div>
    <section class="wrap grid">${articles.map((a) => artTile(a)).join("")}</section>`,
  });
}

function articlePage(a) {
  const more = articles.filter((x) => x.slug !== a.slug).slice(0, 4);
  const byline = a.author || "Zazzi";
  return layout({
    title: a.title, description: a.dek, active: "articles", pathname: a.url, image: a.cover, type: "article",
    body: `<article>
    <header class="wrap"><div class="article-head">
      <div class="crumbs label"><a href="/articles/">Articles</a><span>/</span><span>${esc(a.category)}</span></div>
      <h1>${esc(a.title)}</h1>${a.dek ? `<p class="dek">${esc(a.dek)}</p>` : ""}
      <div class="meta label"><time datetime="${a.date}">${fmtDate(a.date)}</time><span>${a.readTime} read</span><span>Words: ${esc(byline)}</span></div></div></header>
    <figure class="wrap hero"><div class="ph"><img src="${esc(a.cover)}" alt="${esc(a.coverAlt || a.title)}"></div>${a.coverCaption ? `<figcaption>${esc(a.coverCaption)}</figcaption>` : ""}</figure>
    <div class="wrap"><div class="body">${a.html}</div>
      <section data-ig-section><div class="section-h"><h2>From the feed</h2><a class="label" href="${IG_URL}" target="_blank" rel="noopener">@${SITE.handle} ↗</a></div>
      <div class="strip" data-ig-strip>${'<div class="tile ig-slot" aria-hidden="true"><div class="ph"></div></div>'.repeat(6)}</div></section>
      ${more.length ? `<div class="section-h"><h2>Read next</h2><a class="label" href="/articles/">All articles →</a></div><div class="grid">${more.map((x) => artTile(x)).join("")}</div>` : ""}
    </div></article>`,
  });
}

function about() {
  return layout({
    title: "Info", active: "about", pathname: "/about/",
    description: "Who we are and how to reach Zazzi Magazine.",
    body: `<section class="wrap page"><h1>Who we are</h1><div class="cols">
    <div><p>Zazzi is a street style magazine about streetwear, trends, self-expression and city vibes. We spot great outfits on the street, share them every day on Instagram under <a href="${IG_URL}" target="_blank" rel="noopener">#ZazziSpotting</a>, and write longer stories about the people and ideas behind them.</p>
    <p>Spotted a look we should cover, want to be photographed, or have an idea for a story? Get in touch.</p>
    <span class="label">Email</span><div class="contact-line"><span>${SITE.email}</span></div>
    <span class="label">Instagram</span><div class="contact-line"><a href="${IG_URL}" target="_blank" rel="noopener">@${SITE.handle}</a></div></div>
    <form data-mailto="${SITE.email}"><span class="label">Contact</span>
      <label for="name">Name<input id="name" name="name" required autocomplete="name"></label>
      <label for="email">Email<input id="email" name="email" type="email" required autocomplete="email"></label>
      <label for="topic">Topic<select id="topic" name="topic"><option>General</option><option>Collaboration</option><option>Press</option><option>Get photographed</option></select></label>
      <label for="message">Message<textarea id="message" name="message" required></textarea></label>
      <button class="btn" type="submit">Send message</button>
      <p class="ok" hidden>Your email app should open with the message ready to send.</p></form></div></section>`,
  });
}

function store() {
  const items = ["Tote bag", "Logo tee", "Photo zine Vol. 1", "Cap"];
  return layout({
    title: "Store", active: "store", pathname: "/store/",
    description: "The Zazzi store is coming soon.",
    body: `<section class="wrap page"><span class="label">Coming soon</span><h1>Store</h1>
    <div class="cols"><p>Our first drop is on the way: printed zines of our best street photos and a small run of Zazzi merch. Leave your email and you'll hear first.</p>
    <form data-mailto="${SITE.email}" data-subject="Store: notify me"><label for="notify">Email<input id="notify" name="email" type="email" required autocomplete="email"></label>
      <button class="btn alt" type="submit">Notify me</button><p class="ok" hidden>Your email app should open. Send it and you're on the list.</p></form></div>
    <div class="store-grid">${items.map((t) => `<div class="tile"><div class="ph"><span>Soon</span></div><h3>${t}</h3></div>`).join("")}</div></section>`,
  });
}

function notFound() {
  return layout({ title: "Page not found", pathname: "/404", body: `<section class="wrap page"><h1>Not found</h1><p class="label">This page doesn't exist.</p><p><a class="btn alt" href="/">Back to home</a></p></section>` });
}

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync("public", OUT, { recursive: true });
const write = (p, html) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

write("index.html", home());
write("articles/index.html", articlesIndex());
for (const a of articles) write(`articles/${a.slug}/index.html`, articlePage(a));
write("about/index.html", about());
write("store/index.html", store());
write("404.html", notFound());
write("articles.json", JSON.stringify(articles.map(({ html, ...a }) => a), null, 2));
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/articles/", "/about/", "/store/", ...articles.map((a) => a.url)].map((u) => `  <url><loc>${SITE.url}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`);

console.log(`Built ${articles.length} articles into /${OUT}`);
