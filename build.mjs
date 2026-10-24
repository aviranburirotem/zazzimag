// Builds the static site into /dist. Run: node build.mjs
// Articles live in content/articles/*.md — add a file there and it appears on the site.
import fs from "node:fs";
import path from "node:path";
import { markdown, frontmatter } from "./lib/markdown.js";
import { icon } from "./lib/icons.js";

const SITE = {
  name: "Zazzi Magazine",
  url: "https://www.zazzimag.com",
  handle: "zazzimag",
  email: "hello@zazzimag.com",
  tagline: "Streetwear, trends, self-expression and city vibes.",
};
const IG_URL = `https://www.instagram.com/${SITE.handle}/`;
const OUT = "dist";
import crypto from "node:crypto";
// Version stamp for CSS/JS so browsers always load the latest files after a deploy
const V = crypto.createHash("md5").update(fs.readFileSync("public/assets/site.css")).update(fs.readFileSync("public/assets/site.js")).digest("hex").slice(0, 8);

// Coming-soon mode: the live site (zazzimag.com) shows only the coming-soon page.
// Preview deployments and local builds still show the full site so you can work on it.
// When ready to launch, change LAUNCHED to true (or set COMING_SOON=0 in Vercel).
const LAUNCHED = false;
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
<meta property="og:image" content="${abs(image || "/assets/logo-poster.png")}">${COMING_SOON ? '\n<meta name="robots" content="noindex">' : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#e30613">
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,400..900;1,62..125,400..900&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${V}">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap bar">
  <a class="logo" href="${COMING_SOON ? "/preview/" : "/"}" aria-label="Zazzi magazine home">${logoVideo(64)}</a>
  <nav class="site-nav" aria-label="Main">
    ${nav("/about/", "Info", "about")}
    ${nav("/store/", "Store", "store")}
    ${nav("/articles/", `All articles ${icon("arrow-right")}`, "articles", "cta")}
  </nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap">
  <a class="logo" href="${COMING_SOON ? "/preview/" : "/"}" aria-label="Zazzi magazine home"><img src="/assets/logo.png" alt="" width="56" height="56"></a>
  <nav aria-label="Footer" class="label"><a href="/articles/">Articles</a><a href="/about/">Info &amp; contact</a><a href="/store/">Store</a><a href="/accessibility/">Accessibility</a></nav>
  <div class="social"><a class="icon-btn" href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram @${SITE.handle}">${icon("instagram")}</a><a class="icon-btn" href="mailto:${SITE.email}" aria-label="Email ${SITE.email}">${icon("mail")}</a><span class="label">© ${new Date().getFullYear()} Zazzi</span></div>
</div></footer>
<div class="modal" id="modal" hidden></div>
<div class="a11y">
  <button class="a11y-toggle" id="a11y-toggle" type="button" aria-expanded="false" aria-controls="a11y-panel" aria-label="Accessibility options">${icon("accessibility")}</button>
  <div class="a11y-panel" id="a11y-panel" role="dialog" aria-label="Accessibility options" hidden>
    <h2>Accessibility <button class="a11y-close" type="button" data-a11y-close aria-label="Close accessibility options">${icon("x")}</button></h2>
    <div class="a11y-opts"></div>
    <a href="/accessibility/">Accessibility statement · הצהרת נגישות</a>
  </div>
</div>
<script src="/assets/site.js?v=${V}" defer></script>
</body>
</html>`;
}

const artTile = (a, feat = false) => `<a class="tile art${feat ? " feat" : ""}" href="${a.url}" data-cat="${esc(a.category)}">
  <div class="ph"><img src="${esc(a.cover)}" alt="${esc(a.coverAlt || a.title)}" loading="lazy"><span class="badge a">${esc(a.category)}</span></div>
  <span class="label">${fmtDate(a.date)} · ${a.readTime}</span><h3>${esc(a.title)}</h3>${feat && a.dek ? `<p class="cap">${esc(a.dek)}</p>` : ""}</a>`;
const igSlot = () => `<div class="tile ig ig-slot" aria-hidden="true"><div class="ph"></div></div>`;

// Animated heart logo (looping video, falls back to the still logo)
const logoVideo = (size) => `<video class="logo-vid" width="${size}" height="${size}" autoplay muted loop playsinline preload="metadata" poster="/assets/logo.png" aria-hidden="true"><source src="/assets/logo-animated.mp4" type="video/mp4"></video><span class="sr">Zazzi magazine</span>`;

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
      <a class="handle" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}@${SITE.handle}${icon("arrow-up-right")}</a></section>
    <section class="wrap grid" aria-label="Latest posts and stories">${items.join("")}</section>
    <section class="band"><div class="wrap"><h2>Every story, in one place</h2><a class="btn alt" href="/articles/">See all articles ${icon("arrow-right")}</a></div></section>`,
  });
}

function articlesIndex() {
  const cats = ["All", ...new Set(articles.map((a) => a.category))];
  return layout({
    title: "Articles", active: "articles", pathname: "/articles/",
    description: "All Zazzi stories: street style, trends, guides and interviews.",
    body: `<section class="wrap intro"><div><span class="label">${articles.length} stories</span><h1>Articles</h1></div></section>
    <p id="filter-status" class="visually-hidden" aria-live="polite"></p>
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
    <div class="wrap"><div class="body">${a.aiAssisted === true ? `<p class="ai-note">${icon("info")}<span>Researched and drafted with AI from the sources listed at the end of this article.</span></p>` : ""}${a.html}</div>
      <section data-ig-section><div class="section-h"><h2>From the feed</h2><a class="label with-ic" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}@${SITE.handle}</a></div>
      <div class="strip" data-ig-strip>${'<div class="tile ig-slot" aria-hidden="true"><div class="ph"></div></div>'.repeat(6)}</div></section>
      ${more.length ? `<div class="section-h"><h2>Read next</h2><a class="label with-ic" href="/articles/">All articles ${icon("arrow-right")}</a></div><div class="grid">${more.map((x) => artTile(x)).join("")}</div>` : ""}
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
    <div class="contact-cards">
      <a class="contact-card" href="mailto:${SITE.email}">${icon("mail")}<span><span class="label">Email</span>${SITE.email}</span></a>
      <a class="contact-card" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}<span><span class="label">Instagram</span>@${SITE.handle}</span></a>
    </div></div>
    <form data-mailto="${SITE.email}"><span class="label">Contact</span>
      <label for="name">Name<input id="name" name="name" required autocomplete="name"></label>
      <label for="email">Email<input id="email" name="email" type="email" required autocomplete="email"></label>
      <label for="topic">Topic<select id="topic" name="topic"><option>General</option><option>Collaboration</option><option>Press</option><option>Get photographed</option></select></label>
      <label for="message">Message<textarea id="message" name="message" required></textarea></label>
      <button class="btn" type="submit">Send message ${icon("arrow-right")}</button>
      <p class="ok" hidden>Your email app should open with the message ready to send.</p></form></div></section>`,
  });
}

function store() {
  const items = ["Tote bag", "Logo tee", "Photo zine Vol. 1", "Cap"];
  return layout({
    title: "Store", active: "store", pathname: "/store/",
    description: "The Zazzi store is coming soon.",
    body: `<section class="wrap page"><span class="label with-ic">${icon("shopping-bag")}Coming soon</span><h1>Store</h1>
    <div class="cols"><p>Our first drop is on the way: printed zines of our best street photos and a small run of Zazzi merch. Leave your email and you'll hear first.</p>
    <form data-mailto="${SITE.email}" data-subject="Store: notify me"><label for="notify">Email<input id="notify" name="email" type="email" required autocomplete="email"></label>
      <button class="btn alt" type="submit">${icon("mail")} Notify me</button><p class="ok" hidden>Your email app should open. Send it and you're on the list.</p></form></div>
    <div class="store-grid">${items.map((t) => `<div class="tile"><div class="ph"><span>Soon</span></div><h3>${t}</h3></div>`).join("")}</div></section>`,
  });
}

function accessibility() {
  const updated = "October 24, 2026", updatedHe = "24.10.2026";
  return layout({
    title: "Accessibility statement", pathname: "/accessibility/",
    description: "Zazzi Magazine accessibility statement, in line with Israeli Standard 5568 (WCAG 2.0 level AA).",
    body: `<section class="wrap page statement">
    <h1>Accessibility</h1>
    <div class="lang-switch"><a class="chip" href="#en">English</a><a class="chip" href="#he" lang="he">עברית</a></div>

    <div id="en" lang="en">
      <p>Zazzi Magazine wants everyone to be able to read and enjoy the site, including people with disabilities. We designed it to meet Israeli Standard 5568 (Web Content Accessibility Guidelines) at level AA, which is based on the international WCAG 2.0 guidelines, as required by the Equal Rights for Persons with Disabilities (Service Accessibility Adjustments) Regulations, 2013.</p>
      <h2>What we've done</h2>
      <ul>
        <li>Clear page structure with headings, landmarks and a "Skip to content" link.</li>
        <li>Everything works with a keyboard. Focused items are clearly outlined, and Esc closes pop-ups.</li>
        <li>Text and buttons meet AA colour-contrast requirements.</li>
        <li>Images have text descriptions. Photo credits and captions are written as text.</li>
        <li>The animated logo stops by itself after a few seconds. Motion is also turned off for visitors who ask their device to reduce motion.</li>
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
      <p>Email: <a href="mailto:${SITE.email}">${SITE.email}</a><br>Please include the page address, what you were trying to do, and the browser, device and any assistive technology you use. We aim to reply within 5 working days.</p>
      <p class="label">Last updated: ${updated}</p>
    </div>

    <div id="he" lang="he" dir="rtl" style="margin-top:56px;border-top:1px solid var(--line);padding-top:8px">
      <h2>הצהרת נגישות</h2>
      <p>זאזי מגזין רוצה שכל אחד ואחת יוכלו לקרוא וליהנות מהאתר, כולל אנשים עם מוגבלות. האתר תוכנן לעמוד בדרישות תקן ישראלי 5568 (קווים מנחים לנגישות תכנים באינטרנט) ברמה AA, המבוסס על הנחיות WCAG 2.0 הבינלאומיות, בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013.</p>
      <h2>מה עשינו</h2>
      <ul>
        <li>מבנה עמודים ברור עם כותרות, אזורים מוגדרים וקישור "דלג לתוכן".</li>
        <li>ניתן לנווט באתר כולו באמצעות המקלדת. הרכיב הפעיל מסומן בבירור, והמקש Esc סוגר חלונות קופצים.</li>
        <li>הטקסטים והכפתורים עומדים בדרישות ניגודיות הצבעים ברמה AA.</li>
        <li>לתמונות יש תיאור טקסטואלי, וקרדיטים וכיתובים מופיעים כטקסט.</li>
        <li>הלוגו המונפש נעצר מעצמו אחרי כמה שניות, והאנימציות מבוטלות עבור מי שהגדיר במכשיר "הפחתת תנועה".</li>
        <li>לטפסים יש תוויות גלויות, והודעות שגיאה מוסברות במילים.</li>
        <li>העיצוב מותאם לטלפונים, טאבלטים ומחשבים, ותומך בהגדלה עד 200%.</li>
      </ul>
      <h2>תפריט הנגישות</h2>
      <p>הכפתור הכחול העגול בתחתית כל עמוד פותח תפריט עם: הגדלת טקסט, ניגודיות גבוהה, הדגשת קישורים, גופן קריא ועצירת אנימציות. הבחירות נשמרות במכשיר שלכם.</p>
      <h2>מגבלות ידועות</h2>
      <ul>
        <li>הפוסטים מאינסטגרם מגיעים ישירות מחשבון האינסטגרם שלנו. תיאור התמונות מבוסס על הכיתוב של הפוסט, ועשוי שלא לתאר כל תמונה בפירוט.</li>
        <li>חלק מתמונות הכתבות מגיעות מוויקישיתוף (Wikimedia Commons) ומאתרים חיצוניים, וחלק מהקישורים מובילים לאתרים שאינם בשליטתנו.</li>
      </ul>
      <p>אם נתקלתם בחלק באתר שאינו נגיש, נשמח שתספרו לנו ונתקן.</p>
      <h2>פנייה לרכז/ת הנגישות</h2>
      <p>דוא"ל: <a href="mailto:${SITE.email}">${SITE.email}</a><br>נא לציין את כתובת העמוד, מה ניסיתם לעשות, ואת הדפדפן, המכשיר וכל טכנולוגיה מסייעת שבה אתם משתמשים. נשתדל להשיב בתוך 5 ימי עבודה.</p>
      <p class="label">עודכן לאחרונה: ${updatedHe}</p>
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
<title>Zazzi Magazine · Coming soon</title>
<meta name="description" content="Zazzi Magazine is coming soon. ${esc(SITE.tagline)}">
<meta property="og:title" content="Zazzi Magazine · Coming soon">
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
  .a11y-link{display:inline-flex;align-items:center;gap:6px;font-size:12px;text-decoration:underline;color:var(--fg)}
</style>
</head>
<body>
<main id="main">
  <video class="logo" autoplay muted loop playsinline poster="/assets/logo-poster.png" aria-label="Zazzi magazine logo" preload="auto">
    <source src="/assets/logo-animated.mp4" type="video/mp4">
    <img src="/assets/logo-poster.png" alt="Zazzi magazine">
  </video>
  <button class="pause" type="button" id="pp" aria-pressed="false">${icon("pause")}<span>Pause animation</span></button>
  <h1>Coming soon</h1>
  <p>${esc(SITE.tagline)} The full magazine is on its way.</p>
</main>
<footer>
  <span class="label">Get in touch</span>
  <a class="btn" href="mailto:${SITE.email}">${icon("mail")}${SITE.email}</a>
  <a class="btn dark" href="${IG_URL}" target="_blank" rel="noopener">${icon("instagram")}@${SITE.handle}</a>
  <a class="a11y-link" href="/accessibility/">${icon("accessibility")}Accessibility statement · הצהרת נגישות</a>
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
write(COMING_SOON ? "preview/index.html" : "index.html", home());
write("articles/index.html", articlesIndex());
for (const a of articles) write(`articles/${a.slug}/index.html`, articlePage(a));
write("about/index.html", about());
write("store/index.html", store());
write("accessibility/index.html", accessibility());
write("articles.json", JSON.stringify(articles.map(({ html, ...a }) => a), null, 2));
// Admin console helpers (shared with the build so the preview matches the site)
fs.copyFileSync("lib/markdown.js", path.join(OUT, "admin/markdown.js"));
fs.copyFileSync("lib/icons.js", path.join(OUT, "admin/icons.js"));

if (COMING_SOON) {
  const page = comingSoon();
  write("index.html", page);
  write("404.html", page);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /preview/\nDisallow: /articles/\nDisallow: /about/\nDisallow: /store/\nDisallow: /admin/\n`);
} else {
  write("404.html", notFound());
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/articles/", "/about/", "/store/", ...articles.map((a) => a.url)].map((u) => `  <url><loc>${SITE.url}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${SITE.url}/sitemap.xml\n`);
}

console.log(COMING_SOON ? `Built coming-soon page into /${OUT}` : `Built ${articles.length} articles into /${OUT}`);
