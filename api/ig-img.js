// GET /api/ig-img?u=<Instagram photo address> → the same photo, served from our own site.
// The home page uses it to see where a post's white frame ends (browsers only allow that for
// photos from the same site), so the tile can show the photo edge to edge. Instagram photos only.
export default async function handler(req, res) {
  const u = String(req.query?.u || "");
  let host = "";
  try { host = new URL(u).hostname; } catch {}
  if (!/^https:\/\//.test(u) || !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(host)) return res.status(400).end("Not an Instagram photo.");
  try {
    const r = await fetch(u);
    if (!r.ok) return res.status(r.status).end();
    const type = r.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return res.status(415).end();
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
    res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
}
