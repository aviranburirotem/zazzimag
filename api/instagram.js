// GET /api/instagram → latest @zazzimag posts as JSON, minus any posts hidden in the console.
// Cached on Vercel's CDN for 2 minutes (keeps well inside Instagram's 200 requests/hour limit).
import { getToken, getHiddenPosts } from "../lib/token.js";

const API = "https://graph.instagram.com/v26.0";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";

// Shared with the console (it lists the same posts so you can choose which to hide)
export async function fetchPosts(token, limit) {
  const r = await fetch(`${API}/me/media?fields=${FIELDS}&limit=${limit}&access_token=${encodeURIComponent(token)}`);
  const data = await r.json();
  if (!r.ok || data.error) {
    const err = new Error("Instagram did not return posts. The token may have expired.");
    err.detail = data.error || r.status;
    throw err;
  }
  return (data.data || []).map((p) => ({
    id: p.id,
    caption: p.caption || "",
    type: p.media_type, // IMAGE, VIDEO or CAROUSEL_ALBUM
    image: p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url,
    video: p.media_type === "VIDEO" ? p.media_url : null,
    url: p.permalink,
    date: p.timestamp,
  })).filter((p) => p.image);
}

export default async function handler(req, res) {
  const token = await getToken();
  if (!token) {
    res.status(503).json({ error: "Instagram is not connected yet. Add IG_ACCESS_TOKEN in Vercel." });
    return;
  }

  const limit = Math.min(Number(req.query?.limit) || 18, 30);
  try {
    const hidden = new Set(await getHiddenPosts());
    // ask for extra posts so hidden ones don't leave gaps
    const all = await fetchPosts(token, Math.min(limit + hidden.size, 50));
    const posts = all.filter((p) => !hidden.has(p.id)).slice(0, limit);
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=86400");
    res.status(200).json({ username: "zazzimag", posts });
  } catch (err) {
    console.error("Instagram API error:", err.detail || err.message);
    res.status(502).json({ error: err.message || "Could not reach Instagram." });
  }
}
