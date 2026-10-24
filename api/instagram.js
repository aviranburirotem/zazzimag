// GET /api/instagram → latest @zazzimag posts as JSON.
// Responses are cached on Vercel's CDN for an hour so Instagram is only asked
// occasionally, no matter how many people visit the site.
import { getToken } from "../lib/token.js";

const API = "https://graph.instagram.com/v26.0";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";

export default async function handler(req, res) {
  const token = await getToken();
  if (!token) {
    res.status(503).json({ error: "Instagram is not connected yet. Add IG_ACCESS_TOKEN in Vercel." });
    return;
  }

  const limit = Math.min(Number(req.query?.limit) || 18, 30);
  try {
    const r = await fetch(`${API}/me/media?fields=${FIELDS}&limit=${limit}&access_token=${encodeURIComponent(token)}`);
    const data = await r.json();
    if (!r.ok || data.error) {
      console.error("Instagram API error:", data.error || r.status);
      res.status(502).json({ error: "Instagram did not return posts. The token may have expired." });
      return;
    }

    const posts = (data.data || []).map((p) => ({
      id: p.id,
      caption: p.caption || "",
      type: p.media_type, // IMAGE, VIDEO or CAROUSEL_ALBUM
      image: p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url,
      video: p.media_type === "VIDEO" ? p.media_url : null,
      url: p.permalink,
      date: p.timestamp,
    })).filter((p) => p.image);

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ username: "zazzimag", posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reach Instagram." });
  }
}
