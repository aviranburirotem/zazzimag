// Admin console API: /api/admin?action=...
// Saves articles and photos straight into the GitHub repository. Each save is one
// commit, and Vercel publishes it automatically about a minute later.
//
// Needs these Vercel environment variables:
//   ADMIN_PASSWORD  the console password
//   GITHUB_TOKEN    fine-grained token with "Contents: Read and write" on the repo
//   GITHUB_REPO     optional, defaults to aviranburirotem/zazzimag
import crypto from "node:crypto";
import { frontmatter } from "../lib/markdown.js";
import { SCHEMA } from "../lib/site-schema.js";
import { getToken, saveToken, getHiddenPosts, setHiddenPosts, hasStore, getJSON, setJSON } from "../lib/token.js";
import { run as runIgQueue, KEYS as IGK, DEFAULT_SCHEDULE } from "../lib/ig-publish.js";
import { fetchPosts } from "./instagram.js";

const REPO = process.env.GITHUB_REPO || "aviranburirotem/zazzimag";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const COOKIE = "zz_admin";
const SESSION_DAYS = 14;
const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const IMG_NAME = /^[a-z0-9][a-z0-9._-]{0,100}\.(jpe?g|png|webp|gif)$/;

// ---------- auth ----------
const sign = (exp) => crypto.createHmac("sha256", process.env.ADMIN_PASSWORD || "").update(`admin:${exp}`).digest("hex");

function isLoggedIn(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw || !process.env.ADMIN_PASSWORD) return false;
  const [exp, mac] = raw.slice(COOKIE.length + 1).split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const a = Buffer.from(mac, "hex"), b = Buffer.from(sign(exp), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function setSession(res, on) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const value = on ? `${exp}.${sign(exp)}` : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${on ? SESSION_DAYS * 86400 : 0}`);
}

function passwordMatches(input) {
  const a = crypto.createHash("sha256").update(String(input || "")).digest();
  const b = crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD || "").digest();
  return Boolean(process.env.ADMIN_PASSWORD) && crypto.timingSafeEqual(a, b);
}

// ---------- GitHub ----------
async function gh(pathname, { method = "GET", body, raw = false } = {}) {
  const r = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zazzimag-admin",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 404 && method === "GET") return null;
  if (!r.ok) {
    const text = await r.text();
    const err = new Error(`GitHub ${r.status}: ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return raw ? r.text() : r.json();
}

const repo = (p) => `/repos/${REPO}${p}`;

async function listArticles() {
  const files = (await gh(repo(`/contents/content/articles?ref=${BRANCH}`))) || [];
  const md = files.filter((f) => f.type === "file" && f.name.endsWith(".md"));
  const items = await Promise.all(md.map(async (f) => {
    const text = await gh(repo(`/contents/${f.path}?ref=${BRANCH}`), { raw: true });
    const { data } = frontmatter(text || "");
    return {
      slug: f.name.replace(/\.md$/, ""),
      title: data.title || f.name,
      date: data.date || "",
      category: data.category || "",
      cover: data.cover || "",
      draft: data.draft === true,
      pinned: data.pinned === true,
    };
  }));
  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// One commit containing every change. Entries: {path, content} | {path, sha} | {path, remove: true}
async function commit(entries, message) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ref = await gh(repo(`/git/ref/heads/${BRANCH}`));
    const parent = await gh(repo(`/git/commits/${ref.object.sha}`));
    const tree = await gh(repo("/git/trees"), {
      method: "POST",
      body: {
        base_tree: parent.tree.sha,
        tree: entries.map((e) => e.remove
          ? { path: e.path, mode: "100644", type: "blob", sha: null }
          : e.sha
            ? { path: e.path, mode: "100644", type: "blob", sha: e.sha }
            : { path: e.path, mode: "100644", type: "blob", content: e.content }),
      },
    });
    const c = await gh(repo("/git/commits"), { method: "POST", body: { message, tree: tree.sha, parents: [ref.object.sha] } });
    try {
      await gh(repo(`/git/refs/heads/${BRANCH}`), { method: "PATCH", body: { sha: c.sha } });
      return c.sha;
    } catch (err) {
      if (err.status !== 422 || attempt === 1) throw err; // someone else committed first: retry once
    }
  }
}

async function imagePaths(slug) {
  const ref = await gh(repo(`/git/ref/heads/${BRANCH}`));
  const parent = await gh(repo(`/git/commits/${ref.object.sha}`));
  const tree = await gh(repo(`/git/trees/${parent.tree.sha}?recursive=1`));
  const prefix = `public/images/articles/${slug}/`;
  return (tree.tree || []).filter((t) => t.type === "blob" && t.path.startsWith(prefix)).map((t) => t.path);
}

// ---------- Instagram token check ----------
async function igStatus(token) {
  if (!token) return { connected: false };
  const API = "https://graph.instagram.com/v26.0";
  try {
    const me = await (await fetch(`${API}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`)).json();
    if (me.error || !me.user_id) return { connected: false, error: me.error?.message };
    // only tokens with the publishing permission may read the publishing limit
    const lim = await (await fetch(`${API}/${me.user_id}/content_publishing_limit?access_token=${encodeURIComponent(token)}`)).json();
    return { connected: true, username: me.username, canPublish: !lim.error };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// ---------- handler ----------
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const action = req.query?.action;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const fail = (code, error) => res.status(code).json({ error });

  try {
    if (action === "login" && req.method === "POST") {
      if (!process.env.ADMIN_PASSWORD) return fail(500, "ADMIN_PASSWORD is not set in Vercel.");
      if (!passwordMatches(body.password)) {
        await new Promise((r) => setTimeout(r, 800));
        return fail(401, "Wrong password.");
      }
      setSession(res, true);
      return res.json({ ok: true });
    }
    if (action === "logout") { setSession(res, false); return res.json({ ok: true }); }
    if (action === "me") return res.json({ loggedIn: isLoggedIn(req), github: Boolean(process.env.GITHUB_TOKEN) });

    if (!isLoggedIn(req)) return fail(401, "Please log in again.");

    // Instagram: list recent posts and choose which ones the site hides (stored in Redis, no redeploy needed)
    // ---- Instagram connection: which account the token belongs to, and whether it may publish posts ----
    if (action === "igStatus") return res.json(await igStatus(await getToken()));
    if (action === "saveIgToken" && req.method === "POST") {
      const token = String(body.token || "").trim();
      if (!/^[A-Za-z0-9_.|-]{40,1000}$/.test(token)) return fail(400, "That doesn't look like an Instagram token. Copy the whole token from the Meta dashboard.");
      const s = await igStatus(token);
      if (!s.connected) return fail(400, `Instagram didn't accept this token${s.error ? `: ${s.error}` : "."}`);
      if (!hasStore()) return fail(500, "The token store (Redis) isn't connected, so the token can't be saved here.");
      await saveToken(token); // the weekly job keeps renewing it from here
      return res.json(s);
    }

    // ---- Instagram posting queue (Scheduled posts tab) ----
    if (action === "igQueue") {
      const [queue, schedule, history, logos] = await Promise.all([getJSON(IGK.queue, []), getJSON(IGK.schedule, {}), getJSON(IGK.history, []), getJSON(IGK.logos, [])]);
      return res.json({ queue, schedule: { ...DEFAULT_SCHEDULE, ...schedule, logo: { ...DEFAULT_SCHEDULE.logo, ...(schedule.logo || {}) }, frame: { ...DEFAULT_SCHEDULE.frame, ...(schedule.frame || {}) } }, history, logos, store: hasStore() });
    }
    if (action === "saveIgQueue" && req.method === "POST") {
      if (!hasStore()) return fail(500, "The store (Redis) isn't connected, so the queue can't be saved.");
      const LOGO = /^[a-z0-9][a-z0-9-]{0,60}\.png$/;
      const logos = await getJSON(IGK.logos, []); // the gallery is saved on its own (igLogoAdd / igLogoRemove)
      const logoOk = (id) => id === "default" || logos.some((l) => l.file === id);
      const USER = /^[A-Za-z0-9._]{1,30}$/;
      const FILE = /^[a-z0-9][a-z0-9-]{0,80}\.jpg$/, SHA = /^[a-f0-9]{40}$/, AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
      const posted = new Set((await getJSON(IGK.history, [])).map((h) => h.id));
      const old = new Map((await getJSON(IGK.queue, [])).map((it) => [it.id, it]));
      const queue = [];
      for (const it of Array.isArray(body.queue) ? body.queue.slice(0, 100) : []) {
        const id = String(it.id || "");
        if (!/^[a-z0-9]{6,24}$/.test(id) || posted.has(id)) continue; // never bring back something already posted
        const images = (Array.isArray(it.images) ? it.images : []).slice(0, 10)
          .filter((p) => FILE.test(p.file) && (!p.orig || FILE.test(p.orig)))
          .map((p) => ({ file: p.file, orig: p.orig || p.file, ...(FILE.test(p.first || "") ? { first: p.first } : {}), logo: p.logo !== false, frame: p.frame === true,
            tags: (Array.isArray(p.tags) ? p.tags : []).filter((t) => USER.test(t.u || "")).slice(0, 20)
              .map((t) => ({ u: t.u.toLowerCase(), x: Math.round(Math.min(1, Math.max(0, +t.x || 0)) * 1000) / 1000, y: Math.round(Math.min(1, Math.max(0, +t.y || 0)) * 1000) / 1000 })) }));
        if (!images.length) continue;
        const caption = String(it.caption || "").slice(0, 2200);
        const custom = it.custom === true && AT.test(it.at || "");
        const was = old.get(id);
        let status = it.status === "queued" ? "queued" : (was?.status || "queued"); // "Try again" sends queued
        if (was?.status === "posting") status = "posting";
        queue.push({ id, images, caption, custom, at: custom ? it.at : "", corner: ["tl", "tc", "tr", "bl", "bc", "br", "c"].includes(it.corner) ? it.corner : "", logoSrc: logoOk(it.logoSrc) ? it.logoSrc : "", collabs: [...new Set((Array.isArray(it.collabs) ? it.collabs : []).filter((c) => USER.test(c)).map((c) => c.toLowerCase()))].slice(0, 3), status, error: status === "error" ? was?.error || "" : "", created: it.created || new Date().toISOString() });
      }
      const s = body.schedule || {}, prev = await getJSON(IGK.schedule, {});
      const schedule = {
        on: s.on === true, every: Math.min(30, Math.max(1, Math.round(Number(s.every) || 1))),
        time: /^\d{1,2}:\d{2}$/.test(s.time || "") ? s.time : "18:00", lastAuto: prev.lastAuto || null,
        frame: { on: s.frame?.on !== false, size: Math.min(12, Math.max(0, Math.round(Number(s.frame?.size ?? 5)))) },
        logo: { src: logoOk(s.logo?.src) ? s.logo.src : "default", on: s.logo?.on !== false, corner: ["tl", "tc", "tr", "bl", "bc", "br", "c"].includes(s.logo?.corner) ? s.logo.corner : "br",
          size: Math.min(40, Math.max(6, Number(s.logo?.size) || 16)), opacity: Math.min(100, Math.max(20, Number(s.logo?.opacity) || 90)) },
      };
      // photos: add the new ones, remove the ones no post uses any more (one commit)
      const keep = new Set(queue.flatMap((it) => it.images.flatMap((p) => [p.file, p.orig, p.first].filter(Boolean))));
      const adds = (Array.isArray(body.files) ? body.files : []).filter((f) => FILE.test(f.file) && SHA.test(f.sha) && keep.has(f.file))
        .map((f) => ({ path: `public/ig-queue/${f.file}`, sha: f.sha }));
      // (logo files are added by igLogoAdd and never removed here)
      const ref = await gh(repo(`/git/ref/heads/${BRANCH}`));
      const parent = await gh(repo(`/git/commits/${ref.object.sha}`));
      const tree = await gh(repo(`/git/trees/${parent.tree.sha}?recursive=1`));
      const removes = (tree.tree || []).filter((t) => t.type === "blob" && (
        t.path.startsWith("public/ig-queue/") && !keep.has(t.path.slice("public/ig-queue/".length)))).map((t) => ({ path: t.path, remove: true }));
      if (adds.length || removes.length) await commit([...adds, ...removes], `Instagram queue: ${adds.length} file${adds.length === 1 ? "" : "s"} added`);
      await setJSON(IGK.queue, queue);
      await setJSON(IGK.schedule, schedule);
      return res.json({ ok: true, queue, schedule, logos, photosAdded: adds.filter((a) => a.path.startsWith("public/ig-queue/")).length });
    }
    // ---- logo gallery: saved straight away, stays until you remove it ----
    if (action === "igLogoAdd" && req.method === "POST") {
      if (!hasStore()) return fail(500, "The store (Redis) isn't connected.");
      const file = String(body.file || ""), name = String(body.name || "Logo").slice(0, 40);
      const data = String(body.data || "").replace(/^data:image\/png;base64,/, "");
      if (!/^[a-z0-9][a-z0-9-]{0,60}\.png$/.test(file) || !data) return fail(400, "That logo couldn't be read.");
      if (data.length > 4_000_000) return fail(413, "That logo is too large. Try a smaller PNG.");
      const blob = await gh(repo("/git/blobs"), { method: "POST", body: { content: data, encoding: "base64" } });
      await commit([{ path: `public/ig-logos/${file}`, sha: blob.sha }], `Logo gallery: add ${name}`);
      const logos = (await getJSON(IGK.logos, [])).filter((l) => l.file !== file);
      logos.push({ file, name });
      await setJSON(IGK.logos, logos);
      return res.json({ ok: true, logos });
    }
    if (action === "igLogoRemove" && req.method === "POST") {
      const file = String(body.file || "");
      const logos = (await getJSON(IGK.logos, [])).filter((l) => l.file !== file);
      await setJSON(IGK.logos, logos);
      const sch = await getJSON(IGK.schedule, {});
      if (sch.logo?.src === file) await setJSON(IGK.schedule, { ...sch, logo: { ...sch.logo, src: "default" } });
      // the file itself stays on the site, so photos already made with it are unaffected
      return res.json({ ok: true, logos });
    }

    if (action === "igPostNow" && req.method === "POST") {
      const out = await runIgQueue({ onlyId: String(body.id || "") });
      if (!out.ok) return fail(400, out.error || "Couldn't post.");
      return res.json(out);
    }

    if (action === "igPosts") {
      const token = await getToken();
      if (!token) return fail(503, "Instagram isn't connected (IG_ACCESS_TOKEN is missing in Vercel).");
      const [posts, hidden] = await Promise.all([fetchPosts(token, 50), getHiddenPosts()]);
      return res.json({ posts, hidden });
    }
    if (action === "saveIgHidden" && req.method === "POST") {
      if (!hasStore()) return fail(500, "Storage (Upstash Redis) isn't connected in Vercel, so hidden posts can't be saved.");
      const ids = (Array.isArray(body.hidden) ? body.hidden : []).map(String).filter((id) => /^[0-9_]{1,40}$/.test(id)).slice(0, 200);
      await setHiddenPosts(ids);
      return res.json({ ok: true, hidden: ids });
    }

    if (!process.env.GITHUB_TOKEN) return fail(500, "GITHUB_TOKEN is not set in Vercel, so the console can't save.");

    if (action === "list") return res.json({ articles: await listArticles() });

    if (action === "article") {
      const slug = String(req.query.slug || "");
      if (!SLUG.test(slug)) return fail(400, "Invalid article address.");
      const text = await gh(repo(`/contents/content/articles/${slug}.md?ref=${BRANCH}`), { raw: true });
      return text == null ? fail(404, "Article not found.") : res.json({ slug, raw: text });
    }

    // Upload one photo (base64). Returns a blob id that the next save attaches.
    if (action === "upload" && req.method === "POST") {
      const data = String(body.data || "").replace(/^data:[^,]+,/, "");
      if (!data) return fail(400, "No photo received.");
      if (data.length > 6_000_000) return fail(413, "That photo is too large. Try a smaller one.");
      const blob = await gh(repo("/git/blobs"), { method: "POST", body: { content: data, encoding: "base64" } });
      return res.json({ sha: blob.sha });
    }

    if (action === "save" && req.method === "POST") {
      const slug = String(body.slug || "");
      const content = String(body.content || "");
      if (!SLUG.test(slug)) return fail(400, "The article address can only use lowercase letters, numbers and dashes.");
      if (!content.startsWith("---\n") || !/\ntitle:\s*\S/.test(content)) return fail(400, "The article needs a title.");
      if (body.isNew) {
        const exists = await gh(repo(`/contents/content/articles/${slug}.md?ref=${BRANCH}`));
        if (exists) return fail(409, "An article with this address already exists. Change the address.");
      }
      let content2 = content;
      const entries = [];
      // a changed web address: move the article and its photos, and forward the old address to the new one
      const from = body.renameFrom ? String(body.renameFrom) : "";
      if (from && from !== slug && !body.isNew) {
        if (!SLUG.test(from)) return fail(400, "Invalid old address.");
        if (await gh(repo(`/contents/content/articles/${slug}.md?ref=${BRANCH}`))) return fail(409, "Another article already uses this address. Change the address.");
        content2 = content.split(`/images/articles/${from}/`).join(`/images/articles/${slug}/`);
        const ref = await gh(repo(`/git/ref/heads/${BRANCH}`));
        const parent = await gh(repo(`/git/commits/${ref.object.sha}`));
        const tree = await gh(repo(`/git/trees/${parent.tree.sha}?recursive=1`));
        for (const t of tree.tree || []) {
          if (t.type === "blob" && t.path.startsWith(`public/images/articles/${from}/`)) {
            entries.push({ path: `public/images/articles/${slug}/${t.path.slice(`public/images/articles/${from}/`.length)}`, sha: t.sha }, { path: t.path, remove: true });
          }
        }
        entries.push({ path: `content/articles/${from}.md`, remove: true });
        let redirects = {};
        try { redirects = JSON.parse((await gh(repo(`/contents/content/redirects.json?ref=${BRANCH}`), { raw: true })) || "{}"); } catch {}
        const oldUrl = `/articles/${from}/`, newUrl = `/articles/${slug}/`;
        for (const k of Object.keys(redirects)) if (redirects[k] === oldUrl) redirects[k] = newUrl; // keep older links working too
        redirects[oldUrl] = newUrl;
        delete redirects[newUrl]; // the new address is a real page again
        entries.push({ path: "content/redirects.json", content: JSON.stringify(redirects, null, 2) + "\n" });
      }
      entries.unshift({ path: `content/articles/${slug}.md`, content: content2 });
      for (const img of body.images || []) {
        const name = String(img.name || "");
        if (!IMG_NAME.test(name) || !/^[a-f0-9]{40}$/.test(img.sha)) return fail(400, `Invalid photo: ${name}`);
        entries.push({ path: `public/images/articles/${slug}/${name}`, sha: img.sha });
      }
      const title = (content.match(/\ntitle:\s*(.+)/) || [])[1] || slug;
      const sha = await commit(entries, `${body.isNew ? "Add" : from && from !== slug ? "Rename" : "Update"} article: ${title.slice(0, 70)}`);
      return res.json({ ok: true, commit: sha });
    }

    // Site texts (content/site.json)
    if (action === "settings") {
      const text = await gh(repo(`/contents/content/site.json?ref=${BRANCH}`), { raw: true });
      let saved = {};
      try { saved = JSON.parse(text || "{}"); } catch {}
      return res.json({ saved });
    }

    if (action === "saveSettings" && req.method === "POST") {
      const input = body.values || {};
      const out = {};
      for (const g of SCHEMA) for (const f of g.fields) {
        const v = input[f.key];
        if (v === undefined) continue;
        if (typeof v !== "string" || v.length > 5000) return fail(400, `"${f.label}" is too long.`);
        const [a, b] = f.key.split(".");
        (out[a] ??= {})[b] = v.replace(/\r/g, "");
      }
      if (out.brand?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.brand.email.trim())) return fail(400, "The contact email doesn't look right.");
      await commit([{ path: "content/site.json", content: JSON.stringify(out, null, 2) + "\n" }], "Update site texts");
      return res.json({ ok: true });
    }

    // Store products (content/products.json)
    if (action === "products") {
      const text = await gh(repo(`/contents/content/products.json?ref=${BRANCH}`), { raw: true });
      let data = { products: [] };
      try { data = JSON.parse(text || '{"products":[]}'); } catch {}
      return res.json({ products: data.products || [] });
    }

    if (action === "saveProducts" && req.method === "POST") {
      const list = Array.isArray(body.products) ? body.products : [];
      if (list.length > 200) return fail(400, "That's too many products.");
      const str = (v, max) => String(v ?? "").replace(/\s*\n\s*/g, " ").trim().slice(0, max);
      const products = [];
      for (const p of list) {
        const name = str(p.name, 120);
        if (!name) return fail(400, "Every product needs a name.");
        const link = str(p.link, 500);
        if (link && !/^https?:\/\//.test(link)) return fail(400, `The link for "${name}" must start with https://`);
        const image = str(p.image, 500);
        if (image && !/^(\/images\/store\/[a-z0-9._-]+|https:\/\/\S+)$/.test(image)) return fail(400, `The photo for "${name}" isn't valid.`);
        const ils = Number(String(p.price ?? "").replace(/[^0-9.]/g, "")) || 0;
        let slug = String(name).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "item";
        const base = slug; let n = 2;
        while (products.some((x) => x.slug === slug)) slug = `${base}-${n++}`;
        products.push({
          name, slug, price: ils ? String(Math.round(ils * 100) / 100) : "", description: String(p.description ?? "").replace(/\r/g, "").trim().slice(0, 3000),
          image, imageAlt: str(p.imageAlt, 200),
          status: ["available", "soon", "soldout"].includes(p.status) ? p.status : "soon",
          link, hidden: p.hidden === true,
        });
      }
      const entries = [{ path: "content/products.json", content: JSON.stringify({ products }, null, 2) + "\n" }];
      for (const img of body.images || []) {
        const name = String(img.name || "");
        if (!IMG_NAME.test(name) || !/^[a-f0-9]{40}$/.test(img.sha)) return fail(400, `Invalid photo: ${name}`);
        if (products.some((p) => p.image === `/images/store/${name}`)) entries.push({ path: `public/images/store/${name}`, sha: img.sha });
      }
      await commit(entries, "Update store products");
      return res.json({ ok: true });
    }

    // Issues: flip-through magazines (content/issues/<slug>.json + public/images/issues/<slug>/)
    if (action === "issues") {
      const files = (await gh(repo(`/contents/content/issues?ref=${BRANCH}`))) || [];
      const list = await Promise.all(files.filter((f) => f.type === "file" && f.name.endsWith(".json")).map(async (f) => {
        let d = {};
        try { d = JSON.parse(await gh(repo(`/contents/${f.path}?ref=${BRANCH}`), { raw: true })); } catch {}
        return { slug: f.name.replace(/\.json$/, ""), title: d.title || f.name, date: d.date || "", cover: d.pages?.[0]?.image || "", pages: (d.pages || []).length, draft: d.draft === true, pinned: d.pinned === true };
      }));
      return res.json({ issues: list.sort((a, b) => (a.date < b.date ? 1 : -1)) });
    }
    if (action === "issue") {
      const slug = String(req.query.slug || "");
      if (!SLUG.test(slug)) return fail(400, "Invalid issue address.");
      const text = await gh(repo(`/contents/content/issues/${slug}.json?ref=${BRANCH}`), { raw: true });
      if (text == null) return fail(404, "Issue not found.");
      return res.json({ slug, issue: JSON.parse(text) });
    }
    if (action === "saveIssue" && req.method === "POST") {
      const slug = String(body.slug || "");
      const d = body.issue || {};
      if (!SLUG.test(slug)) return fail(400, "The web address can only use lowercase letters, numbers and dashes.");
      const title = String(d.title || "").trim().slice(0, 160);
      if (!title) return fail(400, "The issue needs a title.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ""))) return fail(400, "Choose a date.");
      const pagesIn = Array.isArray(d.pages) ? d.pages.slice(0, 200) : [];
      const pages = [];
      for (const p of pagesIn) {
        const image = String(p.image || "");
        if (!/^(\/images\/issues\/[a-z0-9-]+\/[a-z0-9._-]+|https:\/\/\S+)$/.test(image)) return fail(400, "One of the pages has an invalid photo.");
        pages.push({ image, caption: String(p.caption || "").replace(/\s*\n\s*/g, " ").trim().slice(0, 300), alt: String(p.alt || "").replace(/\s*\n\s*/g, " ").trim().slice(0, 200), ...(p.hidden === true ? { hidden: true } : {}) });
      }
      if (!pages.length && d.draft !== true) return fail(400, "Add at least one page, or untick Published to save a draft.");
      if (body.isNew && (await gh(repo(`/contents/content/issues/${slug}.json?ref=${BRANCH}`)))) return fail(409, "An issue with this address already exists. Change the address.");
      const issue = { title, dek: String(d.dek || "").replace(/\s*\n\s*/g, " ").trim().slice(0, 400), date: d.date, ...(d.draft === true ? { draft: true } : {}), ...(d.pinned === true ? { pinned: true } : {}), pages };
      const entries = [{ path: `content/issues/${slug}.json`, content: JSON.stringify(issue, null, 2) + "\n" }];
      for (const img of body.images || []) {
        const name = String(img.name || "");
        if (!IMG_NAME.test(name) || !/^[a-f0-9]{40}$/.test(img.sha)) return fail(400, `Invalid photo: ${name}`);
        if (pages.some((p) => p.image === `/images/issues/${slug}/${name}`)) {
          entries.push({ path: `public/images/issues/${slug}/${name}`, sha: img.sha });
          if (/^[a-f0-9]{40}$/.test(img.smallSha || "")) entries.push({ path: `public/images/issues/${slug}/m/${name}`, sha: img.smallSha }); // phone copy
        }
      }
      await commit(entries, `${body.isNew ? "Add" : "Update"} issue: ${title.slice(0, 70)}`);
      return res.json({ ok: true });
    }
    if (action === "deleteIssue" && req.method === "POST") {
      const slug = String(body.slug || "");
      if (!SLUG.test(slug)) return fail(400, "Invalid issue address.");
      const ref = await gh(repo(`/git/ref/heads/${BRANCH}`));
      const parent = await gh(repo(`/git/commits/${ref.object.sha}`));
      const tree = await gh(repo(`/git/trees/${parent.tree.sha}?recursive=1`));
      const imgs = (tree.tree || []).filter((t) => t.type === "blob" && t.path.startsWith(`public/images/issues/${slug}/`)).map((t) => t.path);
      await commit([{ path: `content/issues/${slug}.json`, remove: true }, ...imgs.map((p) => ({ path: p, remove: true }))], `Delete issue: ${slug}`);
      return res.json({ ok: true });
    }

    // ---- footer video (Video tab) ----
    // The console shrinks the video in the browser, then sends it in parts small enough for the server.
    if (action === "video") {
      const text = await gh(repo(`/contents/content/video/footer.json?ref=${BRANCH}`), { raw: true });
      return res.json({ video: text ? JSON.parse(text) : null });
    }
    if (action === "videoPart" && req.method === "POST") {
      const data = String(body.data || "").replace(/^data:[^,]+,/, "");
      if (!data) return fail(400, "No video data received.");
      if (data.length > 4_000_000) return fail(413, "That part is too large.");
      const blob = await gh(repo("/git/blobs"), { method: "POST", body: { content: data, encoding: "base64" } });
      return res.json({ sha: blob.sha });
    }
    if ((action === "saveVideo" || action === "resetVideo") && req.method === "POST") {
      const SHA = /^[a-f0-9]{40}$/;
      const ref = await gh(repo(`/git/ref/heads/${BRANCH}`));
      const parent = await gh(repo(`/git/commits/${ref.object.sha}`));
      const tree = await gh(repo(`/git/trees/${parent.tree.sha}?recursive=1`));
      const old = (tree.tree || []).filter((t) => t.type === "blob" && t.path.startsWith("content/video/")).map((t) => ({ path: t.path, remove: true }));
      if (action === "resetVideo") {
        if (!old.length) return res.json({ ok: true });
        await commit(old, "Footer video: back to the original");
        return res.json({ ok: true });
      }
      const id = Date.now().toString(36);
      const manifest = { id, updated: new Date().toISOString(), start: Number(body.start) || 0, length: Number(body.length) || 0 };
      const entries = [];
      for (const kind of ["wide", "small", "poster"]) {
        const shas = Array.isArray(body[kind]) ? body[kind] : [];
        if (!shas.length || shas.length > 30 || !shas.every((s) => SHA.test(s))) return fail(400, "The video upload is incomplete. Please try again.");
        manifest[kind] = shas.map((_, i) => `${kind}.${String(i).padStart(3, "0")}`);
        shas.forEach((sha, i) => entries.push({ path: `content/video/${id}/${manifest[kind][i]}`, sha }));
      }
      entries.push({ path: "content/video/footer.json", content: JSON.stringify(manifest, null, 2) + "\n" });
      await commit([...old.filter((o) => o.path !== "content/video/footer.json"), ...entries], "Footer video: new video");
      return res.json({ ok: true, id });
    }

    // One-click show/hide for an article or issue (from the console lists)
    if (action === "setVisibility" && req.method === "POST") {
      const slug = String(body.slug || ""), hide = body.hidden === true;
      if (!SLUG.test(slug)) return fail(400, "Invalid address.");
      if (body.type === "article") {
        const path = `content/articles/${slug}.md`;
        const text = await gh(repo(`/contents/${path}?ref=${BRANCH}`), { raw: true });
        if (text == null) return fail(404, "Article not found.");
        const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        if (!m) return fail(400, "This article's header couldn't be read.");
        let fm = m[1].split("\n").filter((l) => !/^draft\s*:/.test(l));
        if (hide) fm.push("draft: true");
        await commit([{ path, content: `---\n${fm.join("\n")}\n---\n${m[2]}` }], `${hide ? "Hide" : "Show"} article: ${slug}`);
        return res.json({ ok: true });
      }
      if (body.type === "issue") {
        const path = `content/issues/${slug}.json`;
        const text = await gh(repo(`/contents/${path}?ref=${BRANCH}`), { raw: true });
        if (text == null) return fail(404, "Issue not found.");
        const d = JSON.parse(text);
        if (hide) d.draft = true; else delete d.draft;
        if (!hide && !(d.pages || []).length) return fail(400, "This issue has no pages yet, so it can't be shown.");
        await commit([{ path, content: JSON.stringify(d, null, 2) + "\n" }], `${hide ? "Hide" : "Show"} issue: ${slug}`);
        return res.json({ ok: true });
      }
      return fail(400, "Unknown item type.");
    }

    if (action === "delete" && req.method === "POST") {
      const slug = String(body.slug || "");
      if (!SLUG.test(slug)) return fail(400, "Invalid article address.");
      const imgs = await imagePaths(slug);
      const entries = [{ path: `content/articles/${slug}.md`, remove: true }, ...imgs.map((p) => ({ path: p, remove: true }))];
      await commit(entries, `Delete article: ${slug}`);
      return res.json({ ok: true });
    }

    return fail(404, "Unknown action.");
  } catch (err) {
    console.error(err);
    const gh = (String(err.message).match(/"message":"([^"]+)"/) || [])[1] || "";
    let msg = "Something went wrong while talking to GitHub. Try again in a moment.";
    if (err.status === 401) msg = "GitHub doesn't recognise GITHUB_TOKEN (it may be mistyped or expired). Create a new token and update it in Vercel.";
    else if (err.status === 403 || /not accessible/i.test(gh)) msg = "GITHUB_TOKEN can read the site but isn't allowed to save. On GitHub, edit the token and set Contents to \"Read and write\" for the zazzimag repository.";
    else if (err.status === 404) msg = "GITHUB_TOKEN can't see the zazzimag repository. On GitHub, edit the token and add zazzimag under Repository access.";
    if (gh) msg += ` (GitHub said: ${gh})`;
    return fail(502, msg);
  }
}
