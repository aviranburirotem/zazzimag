// Weekly job (see "crons" in vercel.json) that extends the Instagram token
// for another 60 days and saves it, so the feed never stops working.
import { getToken, saveToken, hasStore } from "../lib/token.js";

export default async function handler(req, res) {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" with cron requests.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!hasStore()) {
    res.status(500).json({ error: "Connect Upstash Redis in Vercel → Storage so the refreshed token can be saved." });
    return;
  }

  const token = await getToken();
  if (!token) {
    res.status(500).json({ error: "No token to refresh. Add IG_ACCESS_TOKEN in Vercel." });
    return;
  }

  const r = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
  );
  const data = await r.json();
  if (!r.ok || !data.access_token) {
    console.error("Token refresh failed:", data.error || r.status);
    res.status(502).json({ error: "Instagram refused the refresh. Generate a new token in the Meta dashboard." });
    return;
  }

  await saveToken(data.access_token);
  const days = Math.round((data.expires_in || 0) / 86400);
  res.status(200).json({ ok: true, validForDays: days });
}
