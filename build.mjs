// Builds the static site into /dist. Run: node build.mjs
// Articles live in content/articles/*.md — add a file there and it appears on the site.
import { fontSetup } from "./lib/fonts.js";
import { palette, validHex } from "./lib/colors.js";
import { LANGS, TARGETS, NOTE, REGION, langOf } from "./lib/i18n.js";
import fs from "node:fs";
import path from "node:path";
import { markdown, frontmatter } from "./lib/markdown.js";
import { icon } from "./lib/icons.js";
import { LAUNCHED } from "./lib/site-config.js";
import { texts, TRANSLATABLE } from "./lib/site-schema.js";

// Site wording, editable in the console (content/site.json). The site is built once per language:
// LANG is the language being built; T() gives its words (translated in the console → Languages),
// falling back to English. Brand names, legal text and settings never change (see site-schema.js).
const T_EN = texts(JSON.parse(fs.readFileSync("content/site.json", "utf8")));
let LANG = "en";
const SITE_TR = {};
for (const l of TARGETS) {
  const f = `content/translations/site/${l.code}.json`;
  try { if (fs.existsSync(f)) SITE_TR[l.code] = JSON.parse(fs.readFileSync(f, "utf8")).strings || {}; } catch {}
}
const TR_KEYS = new Set(TRANSLATABLE.map((f) => f.key));
const T = (k) => { const v = LANG !== "en" && TR_KEYS.has(k) ? SITE_TR[LANG]?.[k] : null; return v && v.trim() ? v : T_EN(k); };
const LOCALE = { en: "en-US", de: "de-DE", es: "es-ES", fr: "fr-FR", he: "he-IL", ja: "ja-JP", ko: "ko-KR" };
const H = (p) => (LANG === "en" || !String(p).startsWith("/") ? p : `/${LANG}${p}`); // a link inside the language being built
const DIR = () => langOf(LANG)?.dir || "ltr";
const EN = () => (LANG === "en" ? "" : ' lang="en"'); // words that stay in English on every language's pages
const catName = (c) => (c === T_EN("issues.category") ? T("issues.category") : (LANG !== "en" && SITE_TR[LANG]?.["cat:" + c]) || c);
// "3 min read": languages written with spaces get one after the number even if a translation dropped it
const minRead = (a) => { let t = T("ui.minRead"); if (!["ja", "ko"].includes(LANG)) t = t.replace(/\{n\}(?=[^\s\d])/g, "{n} "); return t.replace(/\{n\}/g, a.minutes); };
// Fonts chosen in the console (content/fonts.json); the site always stays in its light look for now
const FONTS = fontSetup(fs.existsSync("content/fonts.json") ? JSON.parse(fs.readFileSync("content/fonts.json", "utf8")) : {});

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
const V = crypto.createHash("md5").update(fs.readFileSync("public/assets/site.css")).update(fs.readFileSync("public/assets/site.js")).update(fs.readFileSync("public/assets/flipbook.js")).update(fs.readFileSync("public/assets/lava.js")).update(fs.readFileSync("public/assets/logo-animated.mp4")).update(fs.readFileSync("public/assets/logo-animated-dark.mp4")).digest("hex").slice(0, 8);

// Footer video. The console can replace it (content/video/footer.json lists the uploaded parts,
// which are joined back into files at build time). Without an upload, the original video is used.
const VIDEO_MANIFEST = fs.existsSync("content/video/footer.json") ? JSON.parse(fs.readFileSync("content/video/footer.json", "utf8")) : null;
const VIDEO = VIDEO_MANIFEST
  ? { wide: `/assets/footer-video/${VIDEO_MANIFEST.id}-wide.mp4`, small: `/assets/footer-video/${VIDEO_MANIFEST.id}-small.mp4`, poster: `/assets/footer-video/${VIDEO_MANIFEST.id}-poster.jpg` }
  : { wide: `/assets/strip-wide.mp4?v=${V}`, small: `/assets/strip-small.mp4?v=${V}`, poster: `/assets/strip-poster.jpg?v=${V}` };

// Meta Pixel (console → Site texts → Ads and tracking). Runs only after the visitor accepts.
const PIXEL = (T("meta.pixelId") || "").replace(/\D/g, "");
const PIXEL_ON = PIXEL.length >= 8;
const consentTag = PIXEL_ON ? `\n<script src="/assets/consent.js?v=${V}" data-pixel="${PIXEL}" defer></script>` : "";

// Coming-soon mode: the live site (zazzimag.com) shows only the coming-soon page.
// Preview deployments and local builds still show the full site so you can work on it.
// When ready to launch, set LAUNCHED to true in lib/site-config.js.
const COMING_SOON = process.env.COMING_SOON
  ? process.env.COMING_SOON === "1"
  : !LAUNCHED && process.env.VERCEL_ENV === "production";

const abs = (u) => (/^https?:/.test(u) ? u : SITE.url + u);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString(LOCALE[LANG] || "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// ---------- load articles ----------
const dir = "content/articles";
const articles = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((file) => {
  const { data, body } = frontmatter(fs.readFileSync(path.join(dir, file), "utf8"));
  const slug = data.slug || file.replace(/\.md$/, "");
  const words = body.split(/\s+/).length;
  // one or several categories: "category: Guide" or "category: [Guide, Street Style]"
  const categories = [...new Set((Array.isArray(data.category) ? data.category : String(data.category || "").split(",")).map((c) => String(c).trim()).filter(Boolean))];
  return { ...data, categories, category: categories[0] || "", slug, html: markdown(body), minutes: Math.max(1, Math.round(words / 220)), url: `/articles/${slug}/` };
}).filter((a) => a.draft !== true).sort((a, b) => (a.date < b.date ? 1 : -1));

for (const a of articles) {
  for (const k of ["title", "date", "category", "cover"]) if (!a[k]) throw new Error(`Article "${a.slug}" is missing "${k}" in its frontmatter`);
}

// Translations of each article (console → Languages; content/translations/<slug>/<lang>.json)
for (const a of articles) {
  a.tr = {};
  for (const l of TARGETS) {
    const f = `content/translations/${a.slug}/${l.code}.json`;
    if (!fs.existsSync(f)) continue;
    try {
      const t = JSON.parse(fs.readFileSync(f, "utf8"));
      if (t.body) a.tr[l.code] = { title: t.title || a.title, dek: t.dek || "", html: markdown(t.body), edited: !!t.edited, coverCaption: t.coverCaption || "", coverAlt: t.coverAlt || "" };
    } catch {}
  }
}

// Copyright notice shown in every footer
const LEGAL = esc(T_EN("footer.copyright").replace(/\{year\}/g, new Date().getFullYear())).replace(/\n/g, "<br>");

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
    category: T_EN("issues.category"), categories: [T_EN("issues.category")],
  };
}).filter((i) => i.draft !== true && i.title && i.date && i.pages.length).sort((a, b) => (a.date < b.date ? 1 : -1));

// Articles and issues together, newest first (home grid and the All articles page)
// newest first, except items pinned in the console, which stay on top (newest pinned first)
const stories = [...articles, ...issues].sort((a, b) => (Boolean(b.pinned) - Boolean(a.pinned)) || (a.date < b.date ? 1 : -1));
// The site's colour comes from the lead article (pinned first, otherwise the newest): its cover's main
// colour, worked out in the console when the cover is chosen (or picked there by hand).
const LEAD = stories.find((s) => s.kind !== "issue");
const PAL = palette(validHex(LEAD?.color) ? String(LEAD.color).replace("#", "") : "");
const COLOR_CSS = `:root{--accent:${PAL.accent};--accent-fill:${PAL.accent};--on-accent:#ffffff}`;

// ---------- templates ----------
// The same address in another language (English has no prefix)
const inLang = (code, p) => (code === "en" ? p : `/${code}${p}`);
// Hebrew letters: Heebo next to the chosen fonts, Frank Ruhl Libre for article text
const HE_FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@300..900&display=swap">`;
const heCss = (css) => css.replace(/(--(?:head|display|text|mono):"[^"]+",)/g, '$1"Heebo",').replace(/(--serif:"[^"]+",)/g, '$1"Heebo",');
// words the page scripts need, in the language being built
const UI_KEYS = ["ui.previous", "ui.next", "ui.pauseCarousel", "ui.playCarousel", "ui.pauseAnimation", "ui.playAnimation", "ui.pauseVideo", "ui.playVideo", "ui.post", "ui.openPost", "ui.instagramPost", "ui.viewOnInstagram", "ui.close", "ui.showing", "ui.prevPage", "ui.nextPage", "ui.zoomIn", "ui.zoomOut", "ui.a11yText", "ui.a11yContrast", "ui.a11yLinks", "ui.a11yFont", "ui.a11yStill", "ui.a11yReset", "ui.language", "issues.pages", "home.followTile", "issues.category", "articles.allFilter"];

function layout({ title, description, active, body, image, type = "website", pathname = "/", scripts = [], head = "", bodyAttrs = "", langs = null }) {
  const full = title ? `${title} · ${SITE.name}` : SITE.name;
  const nav = (href, label, key, cls = "") => `<a href="${H(href)}"${cls ? ` class="${cls}"` : ""}${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  // every language version of this page, for search engines (pathname is the English address)
  const alts = (langs || LANGS.map((l) => l.code)).map((c) => `<link rel="alternate" hreflang="${c}" href="${SITE.url}${inLang(c, pathname)}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${SITE.url}${pathname}">`;
  const ui = Object.fromEntries(UI_KEYS.map((k) => [k, T(k)]));
  return `<!doctype html>
<html lang="${LANG}" dir="${DIR()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || SITE.tagline)}">
<link rel="canonical" href="${SITE.url}${H(pathname)}">
${alts}
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title || SITE.name)}">
<meta property="og:description" content="${esc(description || SITE.tagline)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${SITE.url}${H(pathname)}">
<meta property="og:image" content="${abs(image || "/assets/logo-poster.png")}">${COMING_SOON ? '\n<meta name="robots" content="noindex">' : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${PAL.accent}">
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${FONTS.links.map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join("\n")}
<link rel="stylesheet" href="/assets/site.css?v=${V}">${LANG === "he" ? "\n" + HE_FONTS : ""}
<style>${LANG === "he" ? heCss(FONTS.css) : FONTS.css}
${COLOR_CSS}</style>${head}
</head>
<body${bodyAttrs} data-lang="${LANG}" data-base="${LANG === "en" ? "" : "/" + LANG}" data-handle="${esc(SITE.handle)}" data-follow="${tx("home.followTile")}" data-issue-label="${tx("issues.category")}">
<script type="application/json" id="zz-ui">${JSON.stringify(ui).replace(/</g, "\\u003c")}</script>
<a class="skip" href="#main">${tx("ui.skip")}</a>
<header class="site-header"><div class="wrap bar">
  <a class="logo" href="${H(COMING_SOON ? "/preview/" : "/")}" aria-label="${tx("ui.homeLink")}">${logoVideo(56)}</a>
  ${on("show.ticker") ? ticker() : `<div class="ticker-space"></div>`}
  <nav class="site-nav" aria-label="Main">
    ${langMenu()}
    ${nav("/about/", tx("nav.info"), "about")}
    ${on("show.storeNav") ? nav("/store/", tx("nav.store"), "store") : ""}
    ${nav("/articles/", `${tx("nav.articles")} ${icon("arrow-right")}`, "articles", "cta")}
  </nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer">${on("show.videoStrip") && active === "home" ? `<div class="vstrip" role="img" aria-label="${tx("home.videoLabel")}">
  <video muted loop playsinline preload="none" poster="${VIDEO.poster}" aria-hidden="true" tabindex="-1">
    <source media="(max-width: 700px)" src="${VIDEO.small}" type="video/mp4">
    <source src="${VIDEO.wide}" type="video/mp4">
  </video>
  <button class="vstrip-btn" type="button" aria-label="${tx("ui.pauseVideo")}" aria-pressed="false"><span class="i-pause">${icon("pause")}</span><span class="i-play">${icon("play")}</span></button>
</div>` : ""}<div class="wrap">
  <a class="logo" href="${H(COMING_SOON ? "/preview/" : "/")}" aria-label="${tx("ui.homeLink")}"><img src="/assets/logo.png" alt="" width="56" height="56"></a>
  <nav aria-label="Footer" class="label"><a href="${H("/articles/")}">${tx("ui.footerArticles")}</a><a href="${H("/about/")}">${tx("ui.footerInfo")}</a>${on("show.storeNav") ? `<a href="${H("/store/")}">${tx("ui.footerStore")}</a>` : ""}<a href="${H("/accessibility/")}">${tx("ui.footerA11y")}</a><a href="${H("/privacy/")}">${tx("ui.footerPrivacy")}</a>${PIXEL_ON ? `<a href="${H("/privacy/")}#cookies" data-consent-open>${tx("ui.cookieSettings")}</a>` : ""}</nav>
  <div class="social"><a class="icon-btn" href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram @${SITE.handle}">${icon("instagram")}</a><a class="icon-btn" href="mailto:${SITE.email}" aria-label="Email ${SITE.email}">${icon("mail")}</a></div>
  <p class="legal" lang="en" dir="ltr">${LEGAL}</p>
</div></footer>
<div class="modal" id="modal" hidden></div>
<div class="a11y">
  <button class="a11y-toggle" id="a11y-toggle" type="button" aria-expanded="false" aria-controls="a11y-panel" aria-label="${tx("ui.a11yOptions")}">${icon("accessibility")}</button>
  <div class="a11y-panel" id="a11y-panel" role="dialog" aria-label="${tx("ui.a11yOptions")}" hidden>
    <h2>${tx("ui.a11yTitle")} <button class="a11y-close" type="button" data-a11y-close aria-label="${tx("ui.close")}">${icon("x")}</button></h2>
    <div class="a11y-opts"></div>
    <a href="${H("/accessibility/")}">${tx("ui.a11yStatement")}</a>
  </div>
</div>
<template id="fb-icons"><span class="x">${icon("x")}</span><span class="l">${icon("chevron-left")}</span><span class="r">${icon("chevron-right")}</span><span class="zi">${icon("zoom-in")}</span><span class="zo">${icon("zoom-out")}</span></template>
<script src="/assets/site.js?v=${V}" defer></script>
<script src="/assets/flipbook.js?v=${V}" defer></script>${active === "home" && on("show.lava") ? `\n<script src="/assets/lava.js?v=${V}" defer></script>` : ""}${consentTag}${scripts.join("")}
</body>
</html>`;
}

// Where the cover is centred when it's cropped (set in the console: "Position on the home page")
// coverPosition = home tiles, heroPosition = top of the article (each set separately in the console)
const coverPos = (a, key = "coverPosition") => (/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(String(a[key] || "").trim()) ? ` style="object-position:${String(a[key]).trim()}"` : "");
const catAttr = (a) => esc((a.categories || [a.category]).map(catName).join("|")); // for the category filters
// an article's title and description in the language being built (English when not translated yet)
const trOf = (a) => (LANG !== "en" && a.tr?.[LANG]) || null;
const enAttr = (a) => (LANG !== "en" && !trOf(a) ? ' lang="en" dir="ltr"' : "");
const artTile = (a, feat = false) => a.kind === "issue" ? issueTile(a, feat) : `<a class="tile art${feat ? " feat" : ""}" href="${H(a.url)}" data-cat="${catAttr(a)}" data-slug="${esc(a.slug)}">
  <div class="ph"><img src="${esc(a.cover)}" alt="${esc(a.coverAlt || a.title)}" loading="lazy"${coverPos(a)}>${a.categories.length ? `<span class="badges">${a.categories.map((c) => `<span class="badge a">${esc(catName(c))}</span>`).join("")}</span>` : ""}</div>
  <span class="label">${fmtDate(a.date)} · ${esc(minRead(a))}</span><h3${enAttr(a)}>${esc(trOf(a)?.title || a.title)}</h3>${feat && (trOf(a)?.dek || a.dek) ? `<p class="cap"${enAttr(a)}>${esc(trOf(a)?.dek || a.dek)}</p>` : ""}</a>`;
// Issues look like a printed magazine: the cover sits on a little stack of pages.
// Clicking opens the flip-through popup (flipbook.js); the link still works on its own.
const pagesLabel = (i) => T("issues.pages").replace(/\{n\}/g, i.pages.length);
const issueTile = (a, feat = false) => `<a class="tile art issue${feat ? " feat" : ""}" href="${H(a.url)}" data-issue="${esc(a.slug)}" data-cat="${catAttr(a)}">
  <div class="ph"><div class="mag"${(() => { const d = a.cover && a.cover.startsWith("/") && imgDims(a.cover); return d ? ` style="aspect-ratio:${d.w}/${d.h}"` : ""; })()}><img src="${esc(fbPage({ image: a.cover }).imageM || a.cover)}" alt="${esc(a.coverAlt || a.title)}" loading="lazy"></div></div>
  <span class="label issue-label">${icon("book-open")}<span${EN()}>${tx("issues.category")} · ${esc(pagesLabel(a))}</span></span><h3 lang="en" dir="ltr">${esc(a.title)}</h3>${feat && a.dek ? `<p class="cap" lang="en" dir="ltr">${esc(a.dek)}</p>` : ""}</a>`;
const igSlot = () => `<div class="tile ig ig-slot" aria-hidden="true"><div class="ph"></div></div>`;

// Animated heart logo (looping video, falls back to the still logo)
const logoVideo = (size) => `<video class="logo-vid" width="${size}" height="${size}" autoplay muted loop playsinline preload="metadata" poster="/assets/logo.png" aria-hidden="true" data-light="/assets/logo-animated.mp4?v=${V}" data-dark="/assets/logo-animated-dark.mp4?v=${V}"><source src="/assets/logo-animated.mp4?v=${V}" type="video/mp4"></video><span class="sr">${esc(SITE.name)}</span>`;

// Header ticker: words drift slowly between the logo and the buttons (decorative, hidden from screen readers)
function ticker() {
  const words = T("header.ticker").split("\n").map((w) => w.trim()).filter(Boolean);
  if (!words.length) return `<div class="ticker-space"></div>`;
  const run = words.map((w) => `<span class="tk-word">${esc(w)}</span>${icon("heart", "tk-heart")}`).join("");
  const dur = Math.max(18, words.join(" ").length * 0.45).toFixed(1);
  return `<div class="ticker" aria-hidden="true" dir="ltr"><div class="ticker-track" style="animation-duration:${dur}s">${run}${run}</div></div>`;
}

// ---------- pages ----------
function home() {
  // The home page in sections:
  //  1. the newest article (big, 2×2, left) · the newest Instagram post, the newest issue and 2 more posts (right)
  //  2. carousels that move on their own: more articles + "More articles" (left) · more Instagram posts (right)
  //  3. more issues
  // Pinned items come first in their kind. Instagram slots are filled in by site.js, in page order.
  const feed = on("show.feed");
  const arts = stories.filter((s) => s.kind !== "issue"), iss = stories.filter((s) => s.kind === "issue");
  let ai = 0;
  const nextArt = () => (ai < arts.length ? artTile(arts[ai++]) : "");
  const igOr = () => (feed ? igSlot() : nextArt()); // without the feed, articles take the Instagram places
  const igLink = `<a class="label with-ic" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}<bdi>@${SITE.handle}</bdi></a>`;
  const sections = [];

  const big = arts[ai] ? artTile(arts[ai++], true) : "";
  const s1 = [big, igOr(), iss[0] ? artTile(iss[0]) : igOr(), igOr(), igOr()].filter(Boolean);
  if (s1.length) sections.push(`<section class="wrap home-sec sec-hero" aria-label="${tx("ui.latest")}">${s1.join("")}</section>`);

  // a carousel: header with arrows and pause, then a row of tiles that scrolls sideways
  const car = (title, tiles, extra = "", foot = "") => `<div class="half carousel" data-carousel>
      <div class="section-h"><h2${EN()}>${title}</h2><div class="car-ctl">${extra}
        <button class="car-btn" type="button" data-car="prev" aria-label="${tx("ui.previous")}">${icon("arrow-left")}</button>
        <button class="car-btn" type="button" data-car="next" aria-label="${tx("ui.next")}">${icon("arrow-right")}</button>
        <button class="car-btn" type="button" data-car="pause" aria-label="${tx("ui.pauseCarousel")}" aria-pressed="false"><span class="i-pause">${icon("pause")}</span><span class="i-play">${icon("play")}</span></button></div></div>
      <div class="car-track" role="region" aria-label="${esc(title)}" tabindex="0">${tiles.join("")}</div>${foot}</div>`;
  const left = [], right = [];
  for (let i = 0; i < 10; i++) { const t = nextArt(); if (t) left.push(t); }
  if (feed) for (let i = 0; i < 9; i++) right.push(igSlot());
  const more = `<a class="btn alt more-btn" href="${H("/articles/")}">${tx("home.moreArticles")} ${icon("arrow-right")}</a>`;
  const halves = [left.length ? car(tx("home.secStories"), left, "", more) : "", right.length ? car(tx("home.secInstagram"), right, igLink) : ""].filter(Boolean);
  if (halves.length) sections.push(`<section class="wrap home-sec sec-car${halves.length === 1 ? " solo" : ""}">${halves.join("")}</section>`);

  const moreIssues = iss.slice(1, 5);
  if (moreIssues.length) sections.push(`<section class="wrap home-sec sec-issues"><div class="section-h"><h2${EN()}>${tx("home.secIssues")}</h2></div><div class="row4">${moreIssues.map((x) => artTile(x)).join("")}</div></section>`);
  const grid = sections.filter(Boolean).join("\n");
  // headline on the lava strip: size (% of normal), place (tl…br) and colour, from the console
  const hlSize = Math.min(2, Math.max(0.4, (parseFloat(T("home.headlineSize")) || 100) / 100));
  const hlPos = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"].includes(T("home.headlinePos")) ? T("home.headlinePos") : "bl";
  const hlColor = ["white", "pink", "yellow", "black"].includes(T("home.headlineColor")) ? T("home.headlineColor") : "white";
  const introSize = Math.min(3, Math.max(0.6, (parseFloat(T("home.introSize")) || 100) / 100));
  const introAlign = ["left", "center", "right"].includes(T("home.introAlign")) ? T("home.introAlign") : "left";
  const lava = on("show.lava"), sw = ""; // the light switch is off until it gets a new place

  return layout({
    active: "home", pathname: "/",
    description: `${SITE.name}. ${SITE.tagline}`,
    body: `${lava ? `<div class="wrap lava-wrap"><section class="lava-band" data-lava data-colors="${esc(JSON.stringify(PAL.lava))}" style="--hs:${hlSize};background:linear-gradient(90deg,${PAL.lava.bgL},${PAL.lava.bgR})">
      <canvas aria-hidden="true"></canvas>${sw}
      ${T("home.headline") || T("home.intro") ? `<div class="lava-in pos-${hlPos} hl-${hlColor}" style="--is:${introSize}"${LANG === "en" ? "" : ' lang="en" dir="ltr"'}>${T("home.headline") ? `<h1 class="brand-hl">${br("home.headline")}</h1>` : ""}${T("home.intro") ? `<div class="lava-sub">${md("home.intro")}</div>` : ""}</div>` : ""}
      <button class="lava-pause" type="button" data-lava-pause aria-label="${tx("ui.pauseAnimation")}" aria-pressed="false"><span class="i-pause">${icon("pause")}</span><span class="i-play">${icon("play")}</span></button></section></div>` : ""}
    <section class="wrap intro${lava ? " after-lava" : ""} align-${introAlign}" style="--hs:${hlSize};--is:${introSize}">${lava && !T("home.headline") ? `<h1 class="visually-hidden">${esc(SITE.name)}</h1>` : ""}
      ${lava ? "" : sw}
      ${lava ? "" : `<div>${T("home.headline") ? `<h1>${br("home.headline")}</h1>` : ""}
      ${md("home.intro")}</div>`}
      ${on("show.igButton") ? `<a class="handle" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}<bdi>@${SITE.handle}</bdi>${icon("arrow-up-right")}</a>` : ""}</section>
    <div class="home-sections">${grid}</div>
    ${on("show.band") ? `<section class="band"><div class="wrap"><h2>${tx("home.bandHeading")}</h2><a class="btn alt" href="${H("/articles/")}">${tx("home.bandButton")} ${icon("arrow-right")}</a></div></section>` : ""}`,
  });
}

function articlesIndex() {
  const ALL = T("articles.allFilter");
  const cats = [ALL, ...new Set(stories.flatMap((a) => a.categories || [a.category]).map(catName))];
  return layout({
    title: T("articles.heading"), active: "articles", pathname: "/articles/",
    description: T("ui.articlesDescription"),
    body: `<section class="wrap intro"><div><span class="label">${esc(T("articles.count").replace(/\{n\}/g, stories.length))}</span><h1>${tx("articles.heading")}</h1></div></section>
    <p id="filter-status" class="visually-hidden" aria-live="polite"></p>
    <div class="wrap filters" role="group" aria-label="${tx("ui.filterBy")}">${cats.map((c) => `<button class="chip" type="button" data-filter="${esc(c)}" aria-pressed="${c === ALL}">${esc(c)}</button>`).join("")}</div>
    <section class="wrap grid">${stories.map((a) => artTile(a)).join("")}</section>`,
  });
}

// Language menu in the header: the article languages, by their own names (decorative until site.js runs)
const langMenu = () => `<div class="lang" data-lang-menu>
  <button class="lang-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="${tx("ui.language")}: ${esc(langOf(LANG).native)}">${icon("globe")}<span class="lang-code">${LANG.toUpperCase()}</span></button>
  <ul class="lang-list" role="menu" hidden>${LANGS.map((l) => `<li role="none"><button type="button" role="menuitemradio" aria-checked="${l.code === LANG}" data-lang="${l.code}" lang="${l.code}" dir="${l.dir}">${esc(l.native)}</button></li>`).join("")}</ul></div>`;

// Share box next to the article (a row under it on phones). Plain names and simple icons, no company logos.
// KakaoTalk has no share link: phones open the device's share menu, computers copy the link.
const shareBox = (title, url) => {
  const u = encodeURIComponent(url), t = encodeURIComponent(title), tu = encodeURIComponent(`${title} ${url}`);
  const link = (href, ic, name, ext = true) => `<a class="sh" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ""}>${icon(ic)}<span>${name}</span></a>`;
  return `<aside class="share" aria-label="${tx("ui.share")}"><span class="label">${tx("ui.share")}</span>
    ${link(`mailto:?subject=${t}&body=${u}`, "mail", tx("ui.shareEmail"), false)}
    <button class="sh" type="button" data-copy="${esc(url)}" data-done="${tx("ui.linkCopied")}">${icon("link")}<span>${tx("ui.copyLink")}</span></button>
    ${link(`https://www.facebook.com/sharer/sharer.php?u=${u}`, "thumbs-up", "Facebook")}
    ${link(`https://wa.me/?text=${tu}`, "phone", "WhatsApp")}
    ${link(`https://social-plugins.line.me/lineit/share?url=${u}`, "message-circle", "LINE")}
    <button class="sh" type="button" data-native-share="${esc(url)}" data-title="${esc(title)}" data-done="${tx("ui.pasteKakao")}">${icon("message-circle")}<span>KakaoTalk</span></button>
    ${link(`viber://forward?text=${tu}`, "phone", "Viber", false)}
    <span class="sh-done" role="status" aria-live="polite"></span></aside>`;
};

function articlePage(a) {
  const more = articles.filter((x) => x.slug !== a.slug).slice(0, 4);
  const byline = (a.author || "").trim();
  const t = trOf(a), en = LANG !== "en" && !t; // en: this language has no translation of the article yet
  const title = t ? t.title : a.title, dek = t ? t.dek : a.dek, html = t ? t.html : a.html;
  const content = en ? ' lang="en" dir="ltr"' : "";
  return layout({
    title, description: dek, active: "articles", pathname: a.url, image: a.cover, type: "article",
    bodyAttrs: ` data-article="${esc(a.slug)}" data-langs="${Object.keys(a.tr).join(",")}"`,
    body: `<article>
    <header class="wrap"><div class="article-head">
      <div class="crumbs label"><a href="${H("/articles/")}">${tx("articles.heading")}</a><span>/</span><span>${a.categories.map((c) => esc(catName(c))).join(" · ")}</span></div>
      <h1${content}>${esc(title)}</h1>${dek ? `<p class="dek"${content}>${esc(dek)}</p>` : ""}
      <div class="meta label"><time datetime="${a.date}">${fmtDate(a.date)}</time><span>${esc(minRead(a))}</span>${byline ? `<span${LANG === "en" ? "" : ' lang="en" dir="ltr"'}>${tx("articles.byline")} ${esc(byline)}</span>` : ""}</div>
      ${t ? `<p class="tr-note">${icon("globe")}<span>${esc(NOTE[LANG][t.edited ? 1 : 0])} · <a href="${a.url}" data-lang-pick="en" lang="en" dir="ltr">${esc(NOTE[LANG][2])}</a></span></p>` : en ? `<p class="tr-note">${icon("globe")}<span>${tx("ui.notTranslated")}</span></p>` : ""}</div></header>
    <figure class="wrap hero${a.heroShape === "vertical" ? " vertical" : ""}"><div class="ph"><img src="${esc(a.cover)}" alt="${esc(t?.coverAlt || a.coverAlt || title)}"${coverPos(a, "heroPosition")}></div>${a.coverCaption ? `<figcaption${t?.coverCaption ? "" : content}>${esc(t?.coverCaption || a.coverCaption)}</figcaption>` : ""}</figure>
    <div class="wrap art-wrap">${shareBox(title, SITE.url + H(a.url))}<div class="body"${content}>${html}</div></div>
    <div class="wrap">
      ${more.length && on("show.readNext") ? `<div class="section-h"><h2>${tx("articles.readNext")}</h2><a class="label with-ic" href="${H("/articles/")}">${tx("articles.allLink")} ${icon("arrow-right")}</a></div><div class="grid">${more.map((x) => artTile(x)).join("")}</div>` : ""}
      ${on("show.feedStrip") ? `<section data-ig-section><div class="section-h"><h2${EN()}>${tx("articles.feedHeading")}</h2><a class="label with-ic" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}<bdi>@${SITE.handle}</bdi></a></div>
      <div class="strip" data-ig-strip>${'<div class="tile ig-slot" aria-hidden="true"><div class="ph"></div></div>'.repeat(6)}</div></section>` : ""}
    </div></article>`,
  });
}

// width and height of a JPEG or PNG on the site (read from the file header), or null
const dimsCache = new Map();
function imgDims(url) {
  if (dimsCache.has(url)) return dimsCache.get(url);
  let out = null;
  try {
    const b = fs.readFileSync(path.join("public", url));
    if (b[0] === 0x89 && b[1] === 0x50) out = { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    else if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length - 9;) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1], len = b.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { out = { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }; break; }
        i += 2 + len;
      }
    }
  } catch {}
  dimsCache.set(url, out);
  return out;
}
// an issue page for the flipbook, with its lighter phone copy (images/issues/<slug>/m/<file>) when there is one
const fbPage = (p) => {
  const m = /^\/images\/issues\/([a-z0-9-]+)\/([^/]+)$/.exec(p.image);
  const light = m && fs.existsSync(`public/images/issues/${m[1]}/m/${m[2]}`) ? `/images/issues/${m[1]}/m/${m[2]}` : "";
  const d = p.image.startsWith("/") ? imgDims(p.image) : null;
  return { image: p.image, ...(light ? { imageM: light } : {}), ...(d ? { w: d.w, h: d.h } : {}), caption: p.caption || "", alt: p.alt || "" };
};
function issuePage(i) {
  const data = JSON.stringify(i.pages.map(fbPage)).replace(/</g, "\\u003c");
  return layout({
    title: i.title, description: i.dek || `${i.title}: ${pagesLabel(i)}`, active: "articles", pathname: i.url, image: i.cover, type: "article",
    body: `<article class="issue">
    <header class="wrap"><div class="article-head issue-head">
      <div class="crumbs label"><a href="${H("/articles/")}">${tx("articles.heading")}</a><span>/</span><span>${tx("issues.category")}</span></div>
      <h1 lang="en" dir="ltr">${esc(i.title)}</h1>${i.dek ? `<p class="dek" lang="en" dir="ltr">${esc(i.dek)}</p>` : ""}
      <div class="meta label"><time datetime="${i.date}">${fmtDate(i.date)}</time><span>${esc(pagesLabel(i))}</span></div></div></header>
    <section class="wrap flipbook" dir="ltr" data-flipbook aria-label="${esc(i.title)}">
      <div class="fb-stage"><div class="fb-book"></div></div>
      <div class="fb-controls">
        <button class="fb-btn" type="button" data-fb="prev" aria-label="${tx("ui.prevPage")}">${icon("chevron-left")}</button>
        <span class="fb-count label" aria-live="polite"></span>
        <button class="fb-btn" type="button" data-fb="next" aria-label="${tx("ui.nextPage")}">${icon("chevron-right")}</button>
        <button class="fb-btn fb-zoom-btn" type="button" data-fb="zoom" aria-label="${tx("ui.zoomIn")}" aria-pressed="false"><span class="i-in">${icon("zoom-in")}</span><span class="i-out">${icon("zoom-out")}</span></button>
      </div>
      <p class="fb-caption"></p>
      <p class="fb-hint label" dir="${DIR()}">${tx("issues.hint")}</p>
      <noscript><div class="fb-fallback">${i.pages.map((p) => `<figure><img src="${esc(p.image)}" alt="${esc(p.alt || "")}" loading="lazy">${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}</figure>`).join("")}</div></noscript>
      <script type="application/json" class="fb-data">${data}</script>
    </section>
    </article>`,
  });
}

function about() {
  return layout({
    title: T("nav.info"), active: "about", pathname: "/about/",
    description: T("ui.aboutDescription"),
    body: `<section class="wrap page"><h1>${tx("about.heading")}</h1><div class="cols">
    <div>${md("about.text")}
    <div class="contact-cards">
      <a class="contact-card" href="mailto:${SITE.email}">${icon("mail")}<span><span class="label">${tx("ui.formEmail")}</span><bdi>${SITE.email}</bdi></span></a>
      <a class="contact-card" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}<span><span class="label">Instagram</span><bdi>@${SITE.handle}</bdi></span></a>
    </div></div>
    <form data-mailto="${SITE.email}"><span class="label">${tx("about.formHeading")}</span>
      <label for="name">${tx("ui.formName")}<input id="name" name="name" required autocomplete="name"></label>
      <label for="email">${tx("ui.formEmail")}<input id="email" name="email" type="email" required autocomplete="email" dir="ltr"></label>
      <label for="topic">${tx("ui.formTopic")}<select id="topic" name="topic">${T("about.topics").split("\n").map((o) => o.trim()).filter(Boolean).map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>
      <label for="message">${tx("ui.formMessage")}<textarea id="message" name="message" required></textarea></label>
      <button class="btn" type="submit">${tx("about.sendButton")} ${icon("arrow-right")}</button>
      <p class="ok" hidden>${tx("about.sentMessage")}</p></form></div></section>`,
  });
}

// Store products, managed in the console (content/products.json)
const slugify = (t) => String(t).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "item";
const ilsNumber = (v) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;
const PRODUCTS = (() => { // names and descriptions stay as written
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
  return `<a class="product${p.status === "soldout" ? " sold" : ""}" href="${H(p.url)}">
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
      <div class="crumbs label"><a href="${H("/store/")}">${tx("store.heading")}</a><span>/</span><span>${esc(p.name)}</span></div>
      <div class="pp-grid">
        <div class="pp-image${p.status === "soldout" ? " sold" : ""}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.imageAlt || p.name)}">` : `<span class="p-name-ph">${esc(p.name)}</span>`}</div>
        <div class="pp-info">
          ${badgeText(p) ? `<span class="label">${esc(badgeText(p))}</span>` : ""}
          <h1>${esc(p.name)}</h1>
          ${price(p, "pp-price")}
          ${p.description ? `<div class="pp-desc">${markdown(p.description)}</div>` : ""}
          <div class="pp-action">${productAction(p)}</div>
          <a class="label with-ic pp-back" href="${H("/store/")}">${tx("store.backLink")} ${icon("arrow-right")}</a>
        </div>
      </div>
    </section>`,
  });
}

function store() {
  const items = T("store.items").split("\n").map((t) => t.trim()).filter(Boolean);
  const notify = `<form data-mailto="${SITE.email}" data-subject="Store: notify me"><label for="notify">${tx("ui.formEmail")}<input id="notify" name="email" type="email" required autocomplete="email" dir="ltr"></label>
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
    body: `<section class="wrap page statement" lang="en" dir="ltr">
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
  const updated = PIXEL_ON ? "October 27, 2026" : "October 24, 2026";
  const mail = `<a href="mailto:${SITE.email}">${SITE.email}</a>`;
  return layout({
    title: "Privacy policy", pathname: "/privacy/",
    description: `How ${SITE.name} handles information when you visit zazzimag.com.`,
    body: `<section class="wrap page statement" lang="en" dir="ltr">
    <h1>Privacy</h1>
    <div id="en" lang="en">
      <p>This policy explains what information is collected when you use zazzimag.com, run by ${esc(SITE.name)} ("we"). We keep it short because we collect very little: there are no visitor accounts${PIXEL_ON ? ", the only tracking is Meta's pixel, which runs only if you agree," : ", no advertising and no tracking cookies,"} and we never sell your information.</p>
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
        ${PIXEL_ON ? "" : "<li>We don't use analytics, advertising or tracking cookies.</li>"}
      </ul>${PIXEL_ON ? `
      <h2 id="cookies">Meta Pixel (only if you agree)</h2>
      <p>We advertise on Instagram. With your permission, the site loads Meta's pixel, which sets cookies and tells Meta (Meta Platforms Ireland Ltd. / Meta Platforms, Inc.) which pages you visit, along with your IP address and browser details. We use it to measure our ads and to show Zazzi to people who might like it, including people similar to our visitors. Meta handles this data under <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener">its own privacy policy</a>, and it may be processed outside Israel and the EU.</p>
      <ul>
        <li>The pixel is off until you choose Accept. If you choose Decline, it never loads.</li>
        <li>Your choice is saved in your browser. You can change it at any time: <a href="#cookies" data-consent-open>Cookie settings</a>.</li>
        <li>You can also control the ads you see in your Meta account under Accounts Center → Ad preferences.</li>
      </ul>` : ""}
      <h2>Content from other services</h2>
      <p>Some parts of the site load content directly from other companies, which means your browser connects to them and they receive your IP address:</p>
      <ul>
        <li><strong>Instagram (Meta):</strong> the photos in our feed and links to our Instagram account. Some articles include Instagram posts; these load from Instagram only when you choose "Show it here", or straight away if you accepted cookies, and Instagram may then set its own cookies.</li>
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
  return layout({ title: T("ui.notFound"), pathname: "/404", langs: ["en"], body: `<section class="wrap page"><h1>${tx("ui.notFound")}</h1><p class="label">${tx("ui.notFoundText")}</p><p><a class="btn alt" href="${H("/")}">${tx("ui.backHome")}</a></p></section>` });
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
  <a class="a11y-link" href="/privacy/">Privacy policy</a>${PIXEL_ON ? `\n  <a class="a11y-link" href="/privacy/#cookies" data-consent-open>Cookie settings</a>` : ""}
  <p class="legal">${esc(T("footer.copyright").replace(/\{year\}/g, new Date().getFullYear()).split(/(?<=reserved\.)/)[0])}</p>
</footer>
<script>
(() => {
  const v = document.querySelector("video.logo"), b = document.getElementById("pp");
  const set = (paused) => { paused ? v.pause() : v.play().catch(() => {}); b.setAttribute("aria-pressed", String(paused)); b.lastChild.textContent = paused ? "Play animation" : "Pause animation"; };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) set(true);
  b.addEventListener("click", () => set(!v.paused));
})();
</script>${consentTag}
</body>
</html>`;
}

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync("public", OUT, { recursive: true });
if (VIDEO_MANIFEST) { // join the uploaded parts back into the footer video files
  const dir = path.join(OUT, "assets/footer-video");
  fs.mkdirSync(dir, { recursive: true });
  for (const [kind, ext] of [["wide", "mp4"], ["small", "mp4"], ["poster", "jpg"]]) {
    const parts = (VIDEO_MANIFEST[kind] || []).map((p) => fs.readFileSync(path.join("content/video", VIDEO_MANIFEST.id, p)));
    fs.writeFileSync(path.join(dir, `${VIDEO_MANIFEST.id}-${kind}.${ext}`), Buffer.concat(parts));
  }
}
const write = (p, html) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

// Old article addresses (after a title change in the console) forward to the new ones
const REDIRECTS = fs.existsSync("content/redirects.json") ? JSON.parse(fs.readFileSync("content/redirects.json", "utf8")) : {};
for (const [from, to] of Object.entries(REDIRECTS)) {
  if (!/^\/articles\/[a-z0-9-]+\/$/.test(from) || !/^\/articles\/[a-z0-9-]+\/$/.test(to)) continue;
  if (articles.some((a) => a.url === from)) continue; // a real article lives there now
  write(`${from.slice(1)}index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE.url}${to}"><meta http-equiv="refresh" content="0; url=${to}"><script>location.replace(${JSON.stringify(to)} + location.hash)</script></head><body><p>This article moved: <a href="${to}">continue to the new address</a>.</p></body></html>`);
}

// Full site, once per language: English at the root, the others under /<code>/ (e.g. /he/articles/…).
// While coming-soon is on, the home page lives at /preview/ (hidden from search engines).
for (const l of LANGS) {
  LANG = l.code;
  const pre = l.code === "en" ? "" : `${l.code}/`;
  write(`${pre}preview/index.html`, home()); // private preview, always password-protected
  if (!COMING_SOON) write(`${pre}index.html`, home());
  write(`${pre}articles/index.html`, articlesIndex());
  for (const a of articles) write(`${pre}articles/${a.slug}/index.html`, articlePage(a));
  for (const i of issues) write(`${pre}issues/${i.slug}/index.html`, issuePage(i));
  write(`${pre}issues/data.json`, JSON.stringify(Object.fromEntries(issues.map((i) => [i.slug, { title: i.title, dek: i.dek || "", pagesLabel: pagesLabel(i), pages: i.pages.map(fbPage) }]))));
  write(`${pre}about/index.html`, about());
  write(`${pre}store/index.html`, store());
  for (const p of PRODUCTS) write(`${pre}store/${p.slug}/index.html`, productPage(p));
  write(`${pre}accessibility/index.html`, accessibility());
  write(`${pre}privacy/index.html`, privacy());
  if (l.code !== "en") for (const [from, to] of Object.entries(REDIRECTS)) { // old article addresses, in this language too
    if (!/^\/articles\/[a-z0-9-]+\/$/.test(from) || !/^\/articles\/[a-z0-9-]+\/$/.test(to) || articles.some((a) => a.url === from)) continue;
    const t2 = `/${l.code}${to}`;
    write(`${pre}${from.slice(1)}index.html`, `<!doctype html><html lang="${l.code}"><head><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE.url}${t2}"><meta http-equiv="refresh" content="0; url=${t2}"><script>location.replace(${JSON.stringify(t2)} + location.hash)</script></head><body><p><a href="${t2}">${t2}</a></p></body></html>`);
  }
}
LANG = "en";
write("i18n/langs.json", JSON.stringify({ langs: LANGS.map(({ code, native, dir }) => ({ code, native, dir })), region: REGION }));
write("articles.json", JSON.stringify(articles.map(({ html, ...a }) => a), null, 2));
// Admin console helpers (shared with the build so the preview matches the site)
fs.copyFileSync("lib/markdown.js", path.join(OUT, "admin/markdown.js"));
fs.copyFileSync("lib/icons.js", path.join(OUT, "admin/icons.js"));
fs.copyFileSync("lib/site-schema.js", path.join(OUT, "admin/site-schema.js"));
fs.copyFileSync("lib/ig-schedule.js", path.join(OUT, "admin/ig-schedule.js"));
fs.copyFileSync("lib/fonts.js", path.join(OUT, "admin/fonts.js"));
fs.copyFileSync("lib/colors.js", path.join(OUT, "admin/colors.js"));
fs.copyFileSync("lib/i18n.js", path.join(OUT, "admin/i18n.js"));
{ // the console always loads the newest helper files (no stale browser copies after a deploy)
  const av = crypto.createHash("md5").update(fs.readFileSync("lib/markdown.js")).update(fs.readFileSync("lib/icons.js")).update(fs.readFileSync("lib/site-schema.js")).update(fs.readFileSync("lib/ig-schedule.js")).update(fs.readFileSync("lib/fonts.js")).update(fs.readFileSync("lib/colors.js")).update(fs.readFileSync("lib/i18n.js")).digest("hex").slice(0, 8);
  const f = path.join(OUT, "admin/index.html");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/from "\.\/(markdown|icons|site-schema|ig-schedule|fonts|colors|i18n)\.js"/g, `from "./$1.js?v=${av}"`));
}

if (COMING_SOON) {
  const page = comingSoon();
  write("index.html", page);
  write("404.html", page);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /preview/\nDisallow: /articles/\nDisallow: /about/\nDisallow: /store/\nDisallow: /issues/\nDisallow: /admin/\nDisallow: /ig-queue/\n${TARGETS.map((l) => `Disallow: /${l.code}/\n`).join("")}`);
} else {
  write("404.html", notFound());
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${LANGS.flatMap((l) => ["/", "/articles/", "/about/", "/store/", "/accessibility/", "/privacy/", ...articles.map((a) => a.url), ...issues.map((i) => i.url), ...PRODUCTS.map((p) => p.url)].map((u) => inLang(l.code, u))).map((u) => `  <url><loc>${SITE.url}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /preview/\nDisallow: /ig-queue/\nSitemap: ${SITE.url}/sitemap.xml\n`);
}

console.log(`Built ${articles.length} articles and ${issues.length} issues into /${OUT}${COMING_SOON ? " (coming-soon mode)" : ""}`);
