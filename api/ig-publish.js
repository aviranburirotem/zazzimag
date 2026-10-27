// POST/GET /api/ig-publish → posts the next Instagram post if one is due (Israel time).
// Called every 15 minutes by the scheduler (.github/workflows/ig-publish.yml).
// It only ever posts what the console's queue says is due, so calling it more often can't post anything early.
import { run } from "../lib/ig-publish.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const out = await run();
    res.status(out.ok ? 200 : 500).json(out);
  } catch (err) {
    console.error("ig-publish:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
