// Builds the static site into /dist. Run: node build.mjs
// Articles live in content/articles/*.md — add a file there and it appears on the site.
import fs from "node:fs";
import path from "node:path";
import { markdown, frontmatter } from "./lib/markdown.js";
import { icon } from "./lib/icons.js";
import { LAUNCHED } from "./lib/site-config.js";
import { texts } from "./lib/site-schema.js";

// Site wording, editable in the console (content/site.json)
const T = texts(JSON.parse(fs.readFileSync("content/site.json", "utf8")));

const SITE = {
  name: T("brand.name"),
  url: "https://www.zazzimag.com",
  handle: T("brand.instagram").replace(/^@/, "").trim(),
  email: T("brand.email").trim(),
  tagline: T("brand.tagline"),
};
const on = (k) => T(k) !== "off";                              // show/hide switches
const tx = (k) => esc(T(k));                                  // one line of text
const br = (k) => esc(T(k)).replace(/\n/g, "<br>");           // text with line breaks
const md = (k) => markdown(T(k));                             // paragraphs with bold/italic/links
const IG_URL = `https://www.instagram.com/${SITE.handle}/`;
const OUT = "dist";
import crypto from "node:crypto";
// Version stamp for CSS/JS so browsers always load the latest files after a deploy
const V = crypto.createHash("md5").update(fs.readFileSync("public/assets/site.css")).update(fs.readFileSync("public/assets/site.js")).update(fs.readFileSync("public/assets/flipbook.js")).update(fs.readFileSync("public/assets/logo-animated.mp4")).update(fs.readFileSync("public/assets/logo-animated-dark.mp4")).update(fs.readFileSync("public/assets/strip-wide.mp4")).update(fs.readFileSync("public/assets/strip-small.mp4")).digest("hex").slice(0, 8);

// Coming-soon mode: the live site (zazzimag.com) shows only the coming-soon page.
// Preview deployments and local builds still show the full site so you can work on it.
// When ready to launch, set LAUNCHED to true in lib/site-config.js.
const COMING_SOON = process.env.COMING_SOON
  ? process.env.COMING_SOON === "1"
  : !LAUNCHED && process.env.VERCEL_ENV === "production";

const abs = (u) => (/^https?:/.test(u) ? u : SITE.url + u);
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

// Copyright notice shown in every footer
const LEGAL = esc(T("footer.copyright").replace(/\{year\}/g, new Date().getFullYear())).replace(/\n/g, "<br>");

// ---------- load issues (flip-through magazines, managed in the console) ----------
const idir = "content/issues";
const issues = (fs.existsSync(idir) ? fs.readdirSync(idir) : []).filter((f) => f.endsWith(".json")).map((file) => {
  let d = {};
  try { d = JSON.parse(fs.readFileSync(path.join(idir, file), "utf8")); } catch (e) { throw new Error(`Issue "${file}" isn't valid JSON`); }
  const slug = file.replace(/\.json$/, "");
  const pages = (d.pages || []).filter((p) => p && p.image && p.hidden !== true);
  return {
    ...d, kind: "issue", slug, pages, url: `/issues/${slug}/`,
    cover: pages[0]?.image || "", coverAlt: pages[0]?.alt || d.title,
    category: T("issues.category"), readTime: T("issues.pages").replace(/\{n\}/g, pages.length),
  };
}).filter((i) => i.draft !== true && i.title && i.date && i.pages.length).sort((a, b) => (a.date < b.date ? 1 : -1));

// Articles and issues together, newest first (home grid and the All articles page)
const stories = [...articles, ...issues].sort((a, b) => (a.date < b.date ? 1 : -1));

// ---------- templates ----------
function layout({ title, description, active, body, image, type = "website", pathname = "/", scripts = [] }) {
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
<meta property="og:image" content="${abs(image || "/assets/logo-poster.png")}">${COMING_SOON ? '\n<meta name="robots" content="noindex">' : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#e30613">
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,400..900;1,62..125,400..900&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<script>try{if(localStorage.getItem("zz-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}</script>
<link rel="stylesheet" href="/assets/site.css?v=${V}">
</head>
<body data-handle="${esc(SITE.handle)}" data-follow="${tx("home.followTile")}" data-issue-label="${tx("issues.category")}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap bar">
  <a class="logo" href="${COMING_SOON ? "/preview/" : "/"}" aria-label="Zazzi magazine home">${logoVideo(56)}</a>
  ${on("show.ticker") ? ticker() : `<div class="ticker-space"></div>`}
  <nav class="site-nav" aria-label="Main">
    ${nav("/about/", tx("nav.info"), "about")}
    ${on("show.storeNav") ? nav("/store/", tx("nav.store"), "store") : ""}
    ${nav("/articles/", `${tx("nav.articles")} ${icon("arrow-right")}`, "articles", "cta")}
  </nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap">
  <a class="logo" href="${COMING_SOON ? "/preview/" : "/"}" aria-label="Zazzi magazine home"><img src="/assets/logo.png" alt="" width="56" height="56"></a>
  <nav aria-label="Footer" class="label"><a href="/articles/">Articles</a><a href="/about/">Info &amp; contact</a>${on("show.storeNav") ? `<a href="/store/">Store</a>` : ""}<a href="/accessibility/">Accessibility</a><a href="/privacy/">Privacy</a></nav>
  <div class="social"><a class="icon-btn" href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram @${SITE.handle}">${icon("instagram")}</a><a class="icon-btn" href="mailto:${SITE.email}" aria-label="Email ${SITE.email}">${icon("mail")}</a></div>
  <p class="legal">${LEGAL}</p>
</div></footer>
<div class="modal" id="modal" hidden></div>
<div class="a11y">
  <button class="a11y-toggle" id="a11y-toggle" type="button" aria-expanded="false" aria-controls="a11y-panel" aria-label="Accessibility options">${icon("accessibility")}</button>
  <div class="a11y-panel" id="a11y-panel" role="dialog" aria-label="Accessibility options" hidden>
    <h2>Accessibility <button class="a11y-close" type="button" data-a11y-close aria-label="Close accessibility options">${icon("x")}</button></h2>
    <div class="a11y-opts"></div>
    <a href="/accessibility/">Accessibility statement</a>
  </div>
</div>
<template id="fb-icons"><span class="x">${icon("x")}</span><span class="l">${icon("chevron-left")}</span><span class="r">${icon("chevron-right")}</span><span class="zi">${icon("zoom-in")}</span><span class="zo">${icon("zoom-out")}</span></template>
<script src="/assets/site.js?v=${V}" defer></script>
<script src="/assets/flipbook.js?v=${V}" defer></script>${scripts.join("")}
</body>
</html>`;
}

const artTile = (a, feat = false) => a.kind === "issue" ? issueTile(a, feat) : `<a class="tile art${feat ? " feat" : ""}" href="${a.url}" data-cat="${esc(a.category)}">
  <div class="ph"><img src="${esc(a.cover)}" alt="${esc(a.coverAlt || a.title)}" loading="lazy"></div>
  <span class="label">${fmtDate(a.date)} · ${a.readTime}</span><h3>${esc(a.title)}</h3>${feat && a.dek ? `<p class="cap">${esc(a.dek)}</p>` : ""}</a>`;
// Issues look like a printed magazine: the cover sits on a little stack of pages.
// Clicking opens the flip-through popup (flipbook.js); the link still works on its own.
const issueTile = (a, feat = false) => `<a class="tile art issue${feat ? " feat" : ""}" href="${a.url}" data-issue="${esc(a.slug)}" data-cat="${esc(a.category)}">
  <div class="ph"><div class="mag"><img src="${esc(a.cover)}" alt="${esc(a.coverAlt || a.title)}" loading="lazy"></div></div>
  <span class="label issue-label">${icon("book-open")}${tx("issues.category")} · ${esc(a.readTime)}</span><h3>${esc(a.title)}</h3>${feat && a.dek ? `<p class="cap">${esc(a.dek)}</p>` : ""}</a>`;
const igSlot = () => `<div class="tile ig ig-slot" aria-hidden="true"><div class="ph"></div></div>`;

// Animated heart logo (looping video, falls back to the still logo)
const logoVideo = (size) => `<video class="logo-vid" width="${size}" height="${size}" autoplay muted loop playsinline preload="metadata" poster="/assets/logo.png" aria-hidden="true" data-light="/assets/logo-animated.mp4?v=${V}" data-dark="/assets/logo-animated-dark.mp4?v=${V}"><source src="/assets/logo-animated.mp4?v=${V}" type="video/mp4"></video><span class="sr">Zazzi magazine</span>`;

// Header ticker: words drift slowly between the logo and the buttons (decorative, hidden from screen readers)
function ticker() {
  const words = T("header.ticker").split("\n").map((w) => w.trim()).filter(Boolean);
  if (!words.length) return `<div class="ticker-space"></div>`;
  const run = words.map((w) => `<span class="tk-word">${esc(w)}</span>${icon("heart", "tk-heart")}`).join("");
  const dur = Math.max(18, words.join(" ").length * 0.45).toFixed(1);
  return `<div class="ticker" aria-hidden="true"><div class="ticker-track" style="animation-duration:${dur}s">${run}${run}</div></div>`;
}

// ---------- pages ----------
function home() {
  // Newest article large, then two Instagram posts per article.
  const items = [];
  // the big tile is the newest article; issues always sit in the grid at normal size
  const fi = Math.max(0, stories.findIndex((s) => s.kind !== "issue"));
  const first = stories[fi], rest = stories.filter((_, i) => i !== fi);
  if (first) items.push(artTile(first, true));
  if (on("show.feed")) {
    const IG_COUNT = 12;
    let a = 0;
    for (let i = 0; i < IG_COUNT; i++) {
      items.push(igSlot());
      if (i % 2 === 1 && a < rest.length && a < 6) items.push(artTile(rest[a++]));
    }
  } else {
    rest.slice(0, 15).forEach((x) => items.push(artTile(x))); // no Instagram posts: stories only
  }
  return layout({
    active: "home", pathname: "/",
    description: `${SITE.name}. ${SITE.tagline}`,
    body: `<section class="wrap intro">
      ${on("show.lightSwitch") ? `<button class="lightswitch" type="button" id="light-switch" aria-pressed="false" aria-label="Turn off the light" data-tip="Turn off the light"><span class="plate"><span class="screw"></span><span class="slot"><span class="lever"></span></span><span class="screw"></span></span></button>` : ""}
      <div>
      <h1>${br("home.headline")}</h1>
      ${md("home.intro")}</div>
      ${on("show.igButton") ? `<a class="handle" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}@${SITE.handle}${icon("arrow-up-right")}</a>` : ""}</section>
    ${on("show.videoStrip") ? `<section class="vstrip" aria-label="${esc(T("home.videoLabel"))}">
      <video muted loop playsinline preload="none" poster="/assets/strip-poster.jpg?v=${V}" aria-hidden="true" tabindex="-1">
        <source media="(max-width: 700px)" src="/assets/strip-small.mp4?v=${V}" type="video/mp4">
        <source src="/assets/strip-wide.mp4?v=${V}" type="video/mp4">
      </video>
      <button class="vstrip-btn" type="button" aria-label="Pause video" aria-pressed="false"><span class="i-pause">${icon("pause")}</span><span class="i-play">${icon("play")}</span></button>
    </section>` : ""}
    <section class="wrap grid" aria-label="Latest posts and stories">${items.join("")}</section>
    ${on("show.band") ? `<section class="band"><div class="wrap"><h2>${tx("home.bandHeading")}</h2><a class="btn alt" href="/articles/">${tx("home.bandButton")} ${icon("arrow-right")}</a></div></section>` : ""}`,
  });
}

function articlesIndex() {
  const ALL = T("articles.allFilter");
  const cats = [ALL, ...new Set(stories.map((a) => a.category))];
  return layout({
    title: T("articles.heading"), active: "articles", pathname: "/articles/",
    description: "All Zazzi stories: street style, trends, guides and interviews.",
    body: `<section class="wrap intro"><div><span class="label">${esc(T("articles.count").replace(/\{n\}/g, stories.length))}</span><h1>${tx("articles.heading")}</h1></div></section>
    <p id="filter-status" class="visually-hidden" aria-live="polite"></p>
    <div class="wrap filters" role="group" aria-label="Filter by category">${cats.map((c) => `<button class="chip" type="button" data-filter="${esc(c)}" aria-pressed="${c === ALL}">${esc(c)}</button>`).join("")}</div>
    <section class="wrap grid">${stories.map((a) => artTile(a)).join("")}</section>`,
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
      <div class="meta label"><time datetime="${a.date}">${fmtDate(a.date)}</time><span>${a.readTime} read</span><span>${tx("articles.byline")} ${esc(byline)}</span></div></div></header>
    <figure class="wrap hero"><div class="ph"><img src="${esc(a.cover)}" alt="${esc(a.coverAlt || a.title)}"></div>${a.coverCaption ? `<figcaption>${esc(a.coverCaption)}</figcaption>` : ""}</figure>
    <div class="wrap"><div class="body">${a.html}</div>
      ${on("show.feedStrip") ? `<section data-ig-section><div class="section-h"><h2>${tx("articles.feedHeading")}</h2><a class="label with-ic" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}@${SITE.handle}</a></div>
      <div class="strip" data-ig-strip>${'<div class="tile ig-slot" aria-hidden="true"><div class="ph"></div></div>'.repeat(6)}</div></section>` : ""}
      ${more.length && on("show.readNext") ? `<div class="section-h"><h2>${tx("articles.readNext")}</h2><a class="label with-ic" href="/articles/">${tx("articles.allLink")} ${icon("arrow-right")}</a></div><div class="grid">${more.map((x) => artTile(x)).join("")}</div>` : ""}
    </div></article>`,
  });
}

function issuePage(i) {
  const data = JSON.stringify(i.pages.map((p) => ({ image: p.image, caption: p.caption || "", alt: p.alt || "" }))).replace(/</g, "\\u003c");
  return layout({
    title: i.title, description: i.dek || `${i.title}: ${T("issues.pages").replace(/\{n\}/g, i.pages.length)}`, active: "articles", pathname: i.url, image: i.cover, type: "article",
    body: `<article class="issue">
    <header class="wrap"><div class="article-head issue-head">
      <div class="crumbs label"><a href="/articles/">${tx("articles.heading")}</a><span>/</span><span>${tx("issues.category")}</span></div>
      <h1>${esc(i.title)}</h1>${i.dek ? `<p class="dek">${esc(i.dek)}</p>` : ""}
      <div class="meta label"><time datetime="${i.date}">${fmtDate(i.date)}</time><span>${esc(i.readTime)}</span></div></div></header>
    <section class="wrap flipbook" data-flipbook aria-roledescription="flip-through magazine" aria-label="${esc(i.title)}">
      <div class="fb-stage"><div class="fb-book"></div></div>
      <div class="fb-controls">
        <button class="fb-btn" type="button" data-fb="prev" aria-label="Previous page">${icon("chevron-left")}</button>
        <span class="fb-count label" aria-live="polite"></span>
        <button class="fb-btn" type="button" data-fb="next" aria-label="Next page">${icon("chevron-right")}</button>
        <button class="fb-btn fb-zoom-btn" type="button" data-fb="zoom" aria-label="Zoom in" aria-pressed="false"><span class="i-in">${icon("zoom-in")}</span><span class="i-out">${icon("zoom-out")}</span></button>
      </div>
      <p class="fb-caption"></p>
      <p class="fb-hint label">${tx("issues.hint")}</p>
      <noscript><div class="fb-fallback">${i.pages.map((p) => `<figure><img src="${esc(p.image)}" alt="${esc(p.alt || "")}" loading="lazy">${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}</figure>`).join("")}</div></noscript>
      <script type="application/json" class="fb-data">${data}</script>
    </section>
    </article>`,
  });
}

function about() {
  return layout({
    title: T("nav.info"), active: "about", pathname: "/about/",
    description: "Who we are and how to reach Zazzi Magazine.",
    body: `<section class="wrap page"><h1>${tx("about.heading")}</h1><div class="cols">
    <div>${md("about.text")}
    <div class="contact-cards">
      <a class="contact-card" href="mailto:${SITE.email}">${icon("mail")}<span><span class="label">Email</span>${SITE.email}</span></a>
      <a class="contact-card" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}<span><span class="label">Instagram</span>@${SITE.handle}</span></a>
    </div></div>
    <form data-mailto="${SITE.email}"><span class="label">${tx("about.formHeading")}</span>
      <label for="name">Name<input id="name" name="name" required autocomplete="name"></label>
      <label for="email">Email<input id="email" name="email" type="email" required autocomplete="email"></label>
      <label for="topic">Topic<select id="topic" name="topic">${T("about.topics").split("\n").map((o) => o.trim()).filter(Boolean).map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>
      <label for="message">Message<textarea id="message" name="message" required></textarea></label>
      <button class="btn" type="submit">${tx("about.sendButton")} ${icon("arrow-right")}</button>
      <p class="ok" hidden>${tx("about.sentMessage")}</p></form></div></section>`,
  });
}

// Store products, managed in the console (content/products.json)
const slugify = (t) => String(t).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "item";
const ilsNumber = (v) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;
const PRODUCTS = (() => {
  let list = [];
  try { list = (JSON.parse(fs.readFileSync("content/products.json", "utf8")).products || []).filter((p) => p && p.name && !p.hidden); } catch {}
  const used = new Set();
  return list.map((p) => {
    let slug = p.slug || slugify(p.name), n = 2;
    while (used.has(slug)) slug = `${p.slug || slugify(p.name)}-${n++}`;
    used.add(slug);
    return { ...p, slug, ils: ilsNumber(p.price), url: `/store/${slug}/` };
  });
})();

// Price in shekels; the page script converts it to the visitor's currency (₪ ¥ ₩ € $)
const price = (p, cls = "p-price") => (p.ils ? `<span class="${cls}" data-ils="${p.ils}">₪${p.ils.toLocaleString("en-US")}</span>` : "");
const badgeText = (p) => (p.status === "soldout" ? T("store.soldOutBadge") : (p.status || "soon") === "soon" ? T("store.soonBadge") : "");

function productCard(p) {
  const badge = badgeText(p);
  return `<a class="product${p.status === "soldout" ? " sold" : ""}" href="${p.url}">
    <div class="ph">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.imageAlt || p.name)}" loading="lazy">` : `<span class="p-name-ph">${esc(p.name)}</span>`}${badge ? `<span class="p-badge">${esc(badge)}</span>` : ""}</div>
    <div class="p-info"><h3>${esc(p.name)}</h3>${price(p)}</div>
  </a>`;
}

function productAction(p) {
  const status = p.status || "soon";
  const safeLink = /^https?:\/\//.test(p.link || "") ? p.link : "";
  if (status === "available") {
    return safeLink
      ? `<a class="btn alt" href="${esc(safeLink)}" target="_blank" rel="noopener">${tx("store.buyButton")} ${icon("arrow-up-right")}</a>`
      : `<a class="btn" href="mailto:${SITE.email}?subject=${encodeURIComponent(`Store: ${p.name}`)}">${icon("mail")} ${tx("store.askButton")}</a>`;
  }
  return `<span class="p-status">${esc(badgeText(p))}</span>`;
}

function productPage(p) {
  return layout({
    title: p.name, active: "store", pathname: p.url, image: p.image || undefined,
    description: (p.description || `${p.name} from the ${SITE.name} store.`).replace(/\s+/g, " ").slice(0, 160),
    body: `<section class="wrap page product-page">
      <div class="crumbs label"><a href="/store/">${tx("store.heading")}</a><span>/</span><span>${esc(p.name)}</span></div>
      <div class="pp-grid">
        <div class="pp-image${p.status === "soldout" ? " sold" : ""}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.imageAlt || p.name)}">` : `<span class="p-name-ph">${esc(p.name)}</span>`}</div>
        <div class="pp-info">
          ${badgeText(p) ? `<span class="label">${esc(badgeText(p))}</span>` : ""}
          <h1>${esc(p.name)}</h1>
          ${price(p, "pp-price")}
          ${p.description ? `<div class="pp-desc">${markdown(p.description)}</div>` : ""}
          <div class="pp-action">${productAction(p)}</div>
          <a class="label with-ic pp-back" href="/store/">${tx("store.backLink")} ${icon("arrow-right")}</a>
        </div>
      </div>
    </section>`,
  });
}

function store() {
  const items = T("store.items").split("\n").map((t) => t.trim()).filter(Boolean);
  const notify = `<form data-mailto="${SITE.email}" data-subject="Store: notify me"><label for="notify">Email<input id="notify" name="email" type="email" required autocomplete="email"></label>
      <button class="btn alt" type="submit">${icon("mail")} ${tx("store.button")}</button><p class="ok" hidden>${tx("store.sentMessage")}</p></form>`;
  const grid = PRODUCTS.length
    ? `<div class="products">${PRODUCTS.map(productCard).join("")}</div>`
    : `<div class="store-grid">${items.map((t) => `<div class="tile"><div class="ph"><span>${tx("store.itemBadge")}</span></div><h3>${esc(t)}</h3></div>`).join("")}</div>`;
  return layout({
    title: T("nav.store"), active: "store", pathname: "/store/",
    description: `${SITE.name} store. ${T("store.text").slice(0, 140)}`,
    body: `<section class="wrap page"><span class="label with-ic">${icon("shopping-bag")}${tx("store.label")}</span><h1>${tx("store.heading")}</h1>
    <div class="cols"><div>${md("store.text")}</div>${PRODUCTS.length ? "" : notify}</div>
    ${grid}
    ${PRODUCTS.length ? `<div class="cols notify-row"><h2 class="section-title">${tx("store.notifyHeading")}</h2>${notify}</div>` : ""}</section>`,
  });
}

function accessibility() {
  const updated = "October 24, 2026";
  return layout({
    title: "Accessibility statement", pathname: "/accessibility/",
    description: "Zazzi Magazine accessibility statement, in line with Israeli Standard 5568 (WCAG 2.0 level AA).",
    body: `<section class="wrap page statement">
    <h1>Accessibility</h1>
    <div id="en" lang="en">
      <p>Zazzi Magazine wants everyone to be able to read and enjoy the site, including people with disabilities. We designed it to meet Israeli Standard 5568 (Web Content Accessibility Guidelines) at level AA, which is based on the international WCAG 2.0 guidelines, as required by the Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 2013.</p>
      <h2>What we've done</h2>
      <ul>
        <li>Clear page structure with headings, landmarks and a "Skip to content" link.</li>
        <li>Everything works with a keyboard. Focused items are clearly outlined, and Esc closes pop-ups.</li>
        <li>Text and buttons meet AA colour-contrast requirements.</li>
        <li>Images have text descriptions, and captions are written as text.</li>
        <li>The animated logo pauses when you point at it or move keyboard focus to it, and the "Stop animations" option in the accessibility menu stops it completely. Motion is also turned off for visitors who ask their device to reduce motion.</li>
        <li>Forms have visible labels, and errors are explained in words.</li>
        <li>The layout adapts to phones, tablets and computers and supports zooming up to 200%.</li>
      </ul>
      <h2>Accessibility menu</h2>
      <p>The round blue button at the bottom of every page opens a menu with: larger text, high contrast, highlighted links, a simpler readable font and stop animations. Your choices are remembered on this device.</p>
      <h2>Known limitations</h2>
      <ul>
        <li>Instagram posts come straight from our Instagram account. Their descriptions are based on the post captions and may not describe every photo in detail.</li>
        <li>Some article photos come from Wikimedia Commons and other external sites, and some links lead to sites we don't control.</li>
      </ul>
      <p>If you find a part of the site that isn't accessible, please tell us and we'll fix it.</p>
      <h2>Contact our accessibility coordinator</h2>
      <p>Name: Aviran Rotem<br>Phone: <a href="tel:+972528131212">052-813-1212</a><br>Email: <a href="mailto:${SITE.email}">${SITE.email}</a><br>Please include the page address, what you were trying to do, and the browser, device and any assistive technology you use. We aim to reply within 5 working days.</p>
      <p class="label">Last updated: ${updated}</p>
    </div>
    </section>`,
  });
}

function privacy() {
  const updated = "October 24, 2026";
  const mail = `<a href="mailto:${SITE.email}">${SITE.email}</a>`;
  return layout({
    title: "Privacy policy", pathname: "/privacy/",
    description: `How ${SITE.name} handles information when you visit zazzimag.com.`,
    body: `<section class="wrap page statement">
    <h1>Privacy</h1>
    <div id="en" lang="en">
      <p>This policy explains what information is collected when you use zazzimag.com, run by ${esc(SITE.name)} ("we"). We keep it short because we collect very little: there are no visitor accounts, no advertising and no tracking cookies, and we never sell your information.</p>
      <h2>Information you send us</h2>
      <ul>
        <li><strong>Contact form and store sign-up.</strong> These open your own email app with a message to ${mail}. We receive only what you choose to send, such as your name, email address and message, and use it to reply to you or to tell you about new store items you asked to hear about.</li>
        <li><strong>Email.</strong> Mail sent to ${mail} is forwarded by ImprovMX and stored in our Google (Gmail) mailbox.</li>
        <li>We keep these messages only as long as we need them, and you can ask us to delete them at any time.</li>
      </ul>
      <h2>Information collected automatically</h2>
      <ul>
        <li><strong>Hosting.</strong> The site is hosted by Vercel. Like any web host, Vercel processes technical data such as your IP address, browser type and the pages you request, to deliver the site and keep it secure.</li>
        <li><strong>Showing prices in your currency.</strong> To show store prices in your local currency, the site checks which country you're browsing from, based on your IP address. We don't store this; your browser keeps the result only until you close the tab.</li>
        <li><strong>Settings on your device.</strong> If you use the accessibility menu or the light switch, your choices (for example larger text or the dark look) are saved in your browser's local storage so they stay on next time. This never leaves your device.</li>
        <li>We don't use analytics, advertising or tracking cookies.</li>
      </ul>
      <h2>Content from other services</h2>
      <p>Some parts of the site load content directly from other companies, which means your browser connects to them and they receive your IP address:</p>
      <ul>
        <li><strong>Instagram (Meta):</strong> the photos in our feed and links to our Instagram account.</li>
        <li><strong>Google Fonts:</strong> the typefaces used on the site.</li>
        <li><strong>Wikimedia Commons</strong> and other image hosts: some photos in articles.</li>
      </ul>
      <p>These companies handle data under their own privacy policies. Links to other websites lead to sites we don't control.</p>
      <h2>Your rights</h2>
      <p>Under the Israeli Privacy Protection Law, you can ask to see the information we hold about you and to have it corrected or deleted. Write to ${mail} and we'll respond as soon as we can.</p>
      <h2>Changes</h2>
      <p>If we change how we handle information, for example when the store starts selling online, we'll update this page and the date below.</p>
      <p class="label">Last updated: ${updated}</p>
    </div>
    </section>`,
  });
}

function notFound() {
  return layout({ title: "Page not found", pathname: "/404", body: `<section class="wrap page"><h1>Not found</h1><p class="label">This page doesn't exist.</p><p><a class="btn alt" href="/">Back to home</a></p></section>` });
}

function comingSoon() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(SITE.name)} · ${tx("comingSoon.heading")}</title>
<meta name="description" content="${esc(SITE.name)}: ${esc(SITE.tagline)}">
<meta property="og:title" content="${esc(SITE.name)} · ${tx("comingSoon.heading")}">
<meta property="og:description" content="${esc(SITE.tagline)}">
<meta property="og:image" content="${SITE.url}/assets/logo-poster.png">
<meta property="og:url" content="${SITE.url}/">
<meta name="theme-color" content="#ffffff">
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@1,62..125,700..900&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  :root{--bg:#ffffff;--fg:#111214;--muted:#6b6e76;--line:#e4e5e9;--accent:#e30613;color-scheme:light}
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--fg);font-family:"Archivo",system-ui,sans-serif;display:flex;flex-direction:column;min-height:100%}
  main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:32px max(16px,env(safe-area-inset-right,0px)) 24px max(16px,env(safe-area-inset-left,0px))}
  .logo{width:min(420px,78vw);aspect-ratio:1;display:block}
  h1{margin:0;font-style:italic;font-weight:900;font-stretch:70%;font-size:clamp(44px,9vw,96px);line-height:.9;letter-spacing:-.02em;text-transform:uppercase}
  p{margin:6px 0 0;color:var(--muted);font-size:15px;max-width:40ch}
  footer{border-top:1px solid var(--line);padding:20px max(16px,env(safe-area-inset-right,0px)) max(24px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));display:flex;flex-wrap:wrap;gap:12px 28px;justify-content:center;align-items:center;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:13px}
  .label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  a{color:inherit}
  .btn{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;text-decoration:none;padding:10px 16px;border-radius:2px;font-family:"Archivo",system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase}
  .btn.dark{background:var(--fg)}
  a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .ic{width:18px;height:18px;flex:none}
  .pause{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font:600 12px "Archivo",system-ui,sans-serif;color:var(--muted);cursor:pointer}
  .pause .ic{width:14px;height:14px}
  .pause:hover{color:var(--fg);border-color:var(--fg)}
  .pause:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .legal{flex-basis:100%;text-align:center;margin:4px 0 0;font-family:"Archivo",system-ui,sans-serif;font-size:12px;color:var(--muted);max-width:none}
  /* contact: round icon buttons (email, Instagram) on every screen size */
  .btn{width:48px;height:48px;padding:0;border-radius:50%;justify-content:center;transition:transform .15s}
  .btn:hover{transform:translateY(-2px)}
  .btn .t{display:none}
  .btn .ic{width:22px;height:22px}
  @media (max-width:640px){
    footer{gap:12px 16px}
    footer .label{flex-basis:100%;text-align:center}
    .a11y-link{flex-basis:100%;justify-content:center}
  }
  .a11y-link{display:inline-flex;align-items:center;gap:6px;font-size:12px;text-decoration:underline;color:var(--fg)}
</style>
</head>
<body>
<main id="main">
  <video class="logo" autoplay muted loop playsinline poster="/assets/logo-poster.png" aria-label="Zazzi magazine logo" preload="auto">
    <source src="/assets/logo-animated.mp4?v=${V}" type="video/mp4">
    <img src="/assets/logo-poster.png" alt="Zazzi magazine">
  </video>
  <button class="pause" type="button" id="pp" aria-pressed="false">${icon("pause")}<span>Pause animation</span></button>
  <h1>${tx("comingSoon.heading")}</h1>
  ${md("comingSoon.text")}
</main>
<footer>
  <span class="label">${tx("comingSoon.contactLabel")}</span>
  <a class="btn" href="mailto:${SITE.email}" aria-label="Email ${SITE.email}">${icon("mail")}<span class="t">${SITE.email}</span></a>
  <a class="btn dark" href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram @${SITE.handle}">${icon("instagram")}<span class="t">@${SITE.handle}</span></a>
  <a class="a11y-link" href="/accessibility/">${icon("accessibility")}Accessibility statement</a>
  <a class="a11y-link" href="/privacy/">Privacy policy</a>
  <p class="legal">${esc(T("footer.copyright").replace(/\{year\}/g, new Date().getFullYear()).split(/(?<=reserved\.)/)[0])}</p>
</footer>
<script>
(() => {
  const v = document.querySelector("video.logo"), b = document.getElementById("pp");
  const set = (paused) => { paused ? v.pause() : v.play().catch(() => {}); b.setAttribute("aria-pressed", String(paused)); b.lastChild.textContent = paused ? "Play animation" : "Pause animation"; };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) set(true);
  b.addEventListener("click", () => set(!v.paused));
})();
</script>
</body>
</html>`;
}

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync("public", OUT, { recursive: true });
const write = (p, html) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

// Full site. While coming-soon is on, the home page lives at /preview/ (hidden from search engines).
write("preview/index.html", home()); // private preview, always password-protected
if (!COMING_SOON) write("index.html", home());
write("articles/index.html", articlesIndex());
for (const a of articles) write(`articles/${a.slug}/index.html`, articlePage(a));
for (const i of issues) write(`issues/${i.slug}/index.html`, issuePage(i));
write("issues/data.json", JSON.stringify(Object.fromEntries(issues.map((i) => [i.slug, { title: i.title, dek: i.dek || "", pagesLabel: i.readTime, pages: i.pages.map((p) => ({ image: p.image, caption: p.caption || "", alt: p.alt || "" })) }]))));
write("about/index.html", about());
write("store/index.html", store());
for (const p of PRODUCTS) write(`store/${p.slug}/index.html`, productPage(p));
write("accessibility/index.html", accessibility());
write("privacy/index.html", privacy());
write("articles.json", JSON.stringify(articles.map(({ html, ...a }) => a), null, 2));
// Admin console helpers (shared with the build so the preview matches the site)
fs.copyFileSync("lib/markdown.js", path.join(OUT, "admin/markdown.js"));
fs.copyFileSync("lib/icons.js", path.join(OUT, "admin/icons.js"));
fs.copyFileSync("lib/site-schema.js", path.join(OUT, "admin/site-schema.js"));

if (COMING_SOON) {
  const page = comingSoon();
  write("index.html", page);
  write("404.html", page);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /preview/\nDisallow: /articles/\nDisallow: /about/\nDisallow: /store/\nDisallow: /issues/\nDisallow: /admin/\n`);
} else {
  write("404.html", notFound());
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/articles/", "/about/", "/store/", "/accessibility/", "/privacy/", ...articles.map((a) => a.url), ...issues.map((i) => i.url), ...PRODUCTS.map((p) => p.url)].map((u) => `  <url><loc>${SITE.url}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /preview/\nSitemap: ${SITE.url}/sitemap.xml\n`);
}

console.log(`Built ${articles.length} articles and ${issues.length} issues into /${OUT}${COMING_SOON ? " (coming-soon mode)" : ""}`);
