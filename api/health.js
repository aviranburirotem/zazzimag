// Daily check (vercel.json → crons): everything in lib/health.js, including the slower checks
// (Instagram connection, the scheduler still running, DeepL's free characters).
import { healthCheck } from "../lib/health.js";

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  try { res.json(await healthCheck({ daily: true })); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
}
