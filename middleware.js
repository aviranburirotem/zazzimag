// Password protection, using the console login (/admin/).
// - /preview/ is always private, before and after launch.
// - Articles, issues, Info and Store are private only while the site is in coming-soon mode.
import { LAUNCHED } from "./lib/site-config.js";

export const config = {
  // every page (for the preview of unpublished changes); the private-page check below only runs for PRIVATE
  matcher: ["/((?!api|admin|_vercel).*)"],
};
const PRIVATE = /^(\/(de|es|fr|he|ja|ko))?\/(preview|articles|about|store|issues)(\/|$)|^\/articles\.json$/; // also the translated copies (/he/…)

const COOKIE = "zz_admin";
const enc = new TextEncoder();

async function validSession(cookieHeader) {
  const secret = process.env.ADMIN_PASSWORD;
  const raw = (cookieHeader || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!secret || !raw) return false;
  const [exp, mac] = raw.slice(COOKIE.length + 1).split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`admin:${exp}`)));
  const expected = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== mac.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  return diff === 0;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  // Preview of unpublished changes (console → Publish → Preview changes): only for the logged-in owner
  const cookies = request.headers.get("cookie") || "";
  if (/(^|;\s*)zz_stage=1(;|$)/.test(cookies) && !url.searchParams.has("zzlive") && (await validSession(cookies))) {
    const dest = new URL("/api/stage", url);
    dest.searchParams.set("p", url.pathname + url.search);
    return new Response(null, { headers: { "x-middleware-rewrite": dest.toString() } });
  }
  if (!PRIVATE.test(url.pathname)) return;
  const isPreview = /^(\/[a-z]{2})?\/preview(\/|$)/.test(url.pathname);
  // /preview/ is always private. Articles, Info and Store are only locked before launch.
  if (!isPreview && (LAUNCHED || process.env.VERCEL_ENV !== "production")) return;
  if (await validSession(request.headers.get("cookie"))) return; // logged in to the console
  const login = new URL("/admin/", url);
  login.searchParams.set("next", url.pathname + url.search);
  return new Response(null, {
    status: 307,
    headers: { Location: login.toString(), "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
