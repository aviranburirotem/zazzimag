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
  if (r.status === 404) return null;
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
      const entries = [{ path: `content/articles/${slug}.md`, content }];
      for (const img of body.images || []) {
        const name = String(img.name || "");
        if (!IMG_NAME.test(name) || !/^[a-f0-9]{40}$/.test(img.sha)) return fail(400, `Invalid photo: ${name}`);
        entries.push({ path: `public/images/articles/${slug}/${name}`, sha: img.sha });
      }
      const title = (content.match(/\ntitle:\s*(.+)/) || [])[1] || slug;
      const sha = await commit(entries, `${body.isNew ? "Add" : "Update"} article: ${title.slice(0, 70)}`);
      return res.json({ ok: true, commit: sha });
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
    const msg = err.status === 401 || err.status === 403
      ? "GitHub refused the request. Check that GITHUB_TOKEN is valid and has write access to the repository."
      : "Something went wrong while talking to GitHub. Try again in a moment.";
    return fail(502, msg);
  }
}
