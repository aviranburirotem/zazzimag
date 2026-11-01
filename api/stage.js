// Preview of unpublished changes, for the console owner only.
// While the "zz_stage" cookie is on (console → Publish → Preview changes), middleware.js sends every page
// request here. The pages are built from the newest saved version on GitHub: the files of the published
// version come with this function, and only the files changed since then are downloaded.
//   /api/stage?enter=1&p=/preview/   turn preview on and open a page
//   /api/stage?exit=1&p=/preview/    turn it off and go back to the published site
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";

const REPO = process.env.GITHUB_REPO || "aviranburirotem/zazzimag";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const ROOT = process.cwd(); // the published version's files (vercel.json → includeFiles)
const TMP = "/tmp/zzstage";
const STAGE_COOKIE = "zz_stage";

const sign = (exp) => crypto.createHmac("sha256", process.env.ADMIN_PASSWORD || "").update(`admin:${exp}`).digest("hex");
function isLoggedIn(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("zz_admin="));
  if (!raw || !process.env.ADMIN_PASSWORD) return false;
  const [exp, mac] = raw.slice("zz_admin=".length).split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const a = Buffer.from(mac, "hex"), b = Buffer.from(sign(exp), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function gh(p) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${p}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "zazzimag-stage" },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

let headCache = { sha: "", at: 0 };
async function headSha() {
  if (Date.now() - headCache.at < 4000) return headCache.sha;
  const sha = (await gh(`/git/ref/heads/${BRANCH}`)).object.sha;
  headCache = { sha, at: Date.now() };
  return sha;
}

const SMALL = ["build.mjs", "package.json", "lib", "content"]; // what the build needs besides the site's files
const building = new Map();
function ensureBuilt(sha) {
  const dir = path.join(TMP, sha);
  if (fs.existsSync(path.join(dir, "ok"))) return Promise.resolve(dir);
  if (!building.has(sha)) building.set(sha, build(sha, dir).finally(() => building.delete(sha)));
  return building.get(sha);
}
async function build(sha, dir) {
  // keep only this version (the /tmp space is limited)
  for (const d of fs.existsSync(TMP) ? fs.readdirSync(TMP) : []) if (d !== sha) fs.rmSync(path.join(TMP, d), { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
  const src = path.join(dir, "src"), over = path.join(dir, "public");
  fs.mkdirSync(over, { recursive: true });
  for (const f of SMALL) fs.cpSync(path.join(ROOT, f), path.join(src, f), { recursive: true });
  // files changed since the published version
  const base = process.env.VERCEL_GIT_COMMIT_SHA;
  if (base && base !== sha) {
    const cmp = await gh(`/compare/${base}...${sha}`);
    const files = cmp.files || [];
    await Promise.all(files.map(async (f) => {
      const rel = f.filename;
      const inPublic = rel.startsWith("public/");
      if (!inPublic && !SMALL.some((s) => rel === s || rel.startsWith(s + "/"))) return;
      const target = inPublic ? path.join(over, rel.slice("public/".length)) : path.join(src, rel);
      if (f.status === "removed") { if (!inPublic) fs.rmSync(target, { force: true }); return; }
      if (f.status === "renamed" && f.previous_filename && !f.previous_filename.startsWith("public/")) fs.rmSync(path.join(src, f.previous_filename), { force: true });
      const blob = await gh(`/git/blobs/${f.sha}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(blob.content, blob.encoding === "base64" ? "base64" : "utf8"));
    }));
  }
  await new Promise((ok, bad) => execFile(process.execPath, ["build.mjs"], {
    cwd: src, timeout: 45000, env: { ...process.env, ZZ_STAGE: "1", ZZ_PUBLIC: `${over}${path.delimiter}${path.join(ROOT, "public")}` },
  }, (err, out, errOut) => (err ? bad(new Error((errOut || err.message).slice(-600))) : ok())));
  fs.writeFileSync(path.join(dir, "ok"), sha);
  return dir;
}

const TYPES = { html: "text/html; charset=utf-8", json: "application/json", xml: "application/xml", txt: "text/plain; charset=utf-8", css: "text/css", js: "text/javascript", mjs: "text/javascript", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf", mp4: "video/mp4" };
const safeNext = (p) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "/preview/");
const cookie = (on) => `${STAGE_COOKIE}=${on ? "1" : ""}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${on ? 8 * 3600 : 0}`;

function bar(pagePath) {
  const exit = `/api/stage?exit=1&p=${encodeURIComponent(pagePath)}`;
  return `<div id="zz-stage" role="region" aria-label="Preview" style="position:fixed;z-index:2147483000;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:14px;align-items:center;padding:10px 16px;border-radius:999px;background:#111;color:#fff;font:600 13px/1.2 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3);direction:ltr;white-space:nowrap">`
    + `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffd34d"></span>Preview: unpublished changes`
    + `<a href="/admin/" style="color:#ffd34d">Console</a><a href="${exit}" style="color:#fff;opacity:.8">Exit preview</a></div>`;
}

export default async function handler(req, res) {
  const q = req.query || {};
  const next = safeNext(q.p);
  if (!isLoggedIn(req)) {
    res.setHeader("Set-Cookie", cookie(false));
    return res.redirect(307, q.exit ? next.replace(/[?&]zzlive=1/, "") : `/admin/?next=${encodeURIComponent(next)}`);
  }
  if (q.enter || q.exit) {
    res.setHeader("Set-Cookie", cookie(Boolean(q.enter)));
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(307, next);
  }
  const url = new URL(next, "https://x");
  const live = () => { url.searchParams.set("zzlive", "1"); res.setHeader("Cache-Control", "no-store"); return res.redirect(307, url.pathname + url.search); };
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return res.status(400).end(); }
  if (rel.includes("..") || rel.includes("\0")) return res.status(400).end();
  try {
    const dir = await ensureBuilt(await headSha());
    const dist = path.join(dir, "src", "dist"), over = path.join(dir, "public");
    let f = path.join(dist, rel);
    if (rel.endsWith("/") || !path.extname(rel)) f = path.join(dist, rel, "index.html");
    let file = fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
    if (!file) { const o = path.join(over, rel); if (fs.existsSync(o) && fs.statSync(o).isFile()) file = o; }
    if (!file) {
      if (path.extname(rel) || rel.startsWith("/assets/")) return live(); // unchanged file: the published one
      file = path.join(dist, "404.html"); res.status(404);
    }
    const ext = path.extname(file).slice(1).toLowerCase();
    if (fs.statSync(file).size > 4 * 1024 * 1024) return live(); // too big to send from here
    res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    if (ext === "html") {
      const html = fs.readFileSync(file, "utf8").replace(/<script defer src="\/_vercel\/insights\/script\.js"><\/script>/g, "") // your own previews aren't counted
        .replace(/<\/body>/i, `${bar(url.pathname)}</body>`);
      return res.send(html);
    }
    return res.send(fs.readFileSync(file));
  } catch (err) {
    res.status(500).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(`<!doctype html><meta charset="utf-8"><title>Preview</title><body style="font:15px system-ui;padding:40px;max-width:640px"><h1>The preview couldn't be built</h1><p>${String(err.message).replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</p><p><a href="/api/stage?exit=1&amp;p=${encodeURIComponent(url.pathname)}">Exit preview</a> · <a href="/admin/">Console</a></p></body>`);
  }
}
