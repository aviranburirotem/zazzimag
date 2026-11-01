// Health checks behind the alerts (lib/alerts.js).
//   quick: every 30 minutes, from the Instagram scheduler (api/ig-publish.js)
//   daily: once a day (vercel.json → crons → /api/health), also the slower checks
import { getJSON, setJSON, getToken, hasStore } from "./token.js";
import { alert, resolved, AK, CONSOLE } from "./alerts.js";
import { deeplUsage } from "./i18n.js";

const REPO = process.env.GITHUB_REPO || "aviranburirotem/zazzimag";
const VERCEL = "https://vercel.com/dashboard";
const ago = (ms) => { const m = Math.round(ms / 60000); return m < 90 ? `${m} minutes` : `${Math.round(m / 60)} hours`; };

async function vercelStatus(sha) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/commits/${sha}/statuses`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "zazzimag-health" },
  });
  if (!r.ok) return null;
  return ((await r.json()) || []).find((s) => /vercel/i.test(s.context || "")) || null;
}

// the last Publish: did it go live?
async function checkPublish(now) {
  const last = await getJSON("publish_last", null);
  if (!last?.sha) return;
  const st = await vercelStatus(last.sha);
  const key = `deploy:${last.sha.slice(0, 12)}`;
  if (st && (st.state === "failure" || st.state === "error")) {
    await alert({ key, repeatHours: 1e6, title: "Publishing didn't go through",
      text: `The publish from ${ago(now - new Date(last.at))} ago didn't reach the site. Vercel said: "${(st.description || st.state).replace(/\.$/, "")}".\n\nYour changes are still saved. Open Vercel → Deployments to see the reason, then press Publish again in the console. If it says "rate limited", it works again within a day.`,
      link: VERCEL, linkLabel: "Open Vercel" });
  } else if ((!st || st.state === "pending") && now - new Date(last.at) > 25 * 60000 && now - new Date(last.at) < 3 * 864e5) {
    await alert({ key: key + ":slow", repeatHours: 1e6, title: "Publishing seems stuck",
      text: `You pressed Publish ${ago(now - new Date(last.at))} ago and the site still isn't updated (it usually takes 1–2 minutes).\n\nCheck Vercel → Deployments. If nothing is there, press Publish again in the console.`,
      link: VERCEL, linkLabel: "Open Vercel" });
  }
}

// queued Instagram posts whose photos never reached the site (they're needed there for Instagram to fetch)
async function checkPhotoWait(now) {
  const wait = await getJSON(AK.wait, {});
  const queued = new Set((await getJSON("ig_queue", [])).map((it) => it.id));
  const gone = Object.keys(wait).filter((id) => !queued.has(id));
  if (gone.length) { for (const id of gone) { delete wait[id]; await resolved(`igwait:${id}`); } await setJSON(AK.wait, wait); }
  for (const [id, since] of Object.entries(wait)) {
    if (now - since > 40 * 60000) await alert({ key: `igwait:${id}`, title: "A scheduled post is waiting for its photos",
      text: `An Instagram post was due ${ago(now - since)} ago, but its photos still aren't on the site, so it can't be posted.\n\nOpen the console → Publish and press Publish now. The post goes out within 15 minutes after that.`,
      link: CONSOLE, linkLabel: "Open the console" });
  }
}

// the Instagram scheduler (GitHub, every 15 minutes) is still knocking
async function checkScheduler(now) {
  const beat = await getJSON(AK.beat, 0);
  if (!beat) return;
  if (now - beat > 3 * 3600e3) await alert({ key: "scheduler", title: "Scheduled Instagram posts have stopped",
    text: `The scheduler that posts your queue hasn't run for ${ago(now - beat)}. Posts won't go out until it runs again.\n\nOn GitHub, open the zazzimag repository → Actions → "Instagram queue". If it says the workflow is disabled, click "Enable workflow".`,
    link: `https://github.com/${REPO}/actions`, linkLabel: "Open GitHub Actions" });
  else await resolved("scheduler");
}

async function checkInstagram() {
  const token = await getToken();
  let error = token ? "" : "Instagram isn't connected.";
  if (token) {
    try {
      const r = await fetch(`https://graph.instagram.com/v26.0/me?fields=user_id&access_token=${encodeURIComponent(token)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error || !d.user_id) error = d.error?.message || `Instagram error ${r.status}`;
    } catch { return; } // network hiccup: try again tomorrow
  }
  if (error) await alert({ key: "igtoken", title: "Instagram is disconnected",
    text: `The site can't reach your Instagram account: "${error}". The feed on the site and scheduled posts stop working until it's reconnected.\n\nOpen the console → Instagram and connect it again.`,
    link: CONSOLE, linkLabel: "Open the console" });
  else await resolved("igtoken");
}

async function checkTranslation() {
  const key = await getJSON("deepl_key", "");
  if (!key) return;
  try {
    const u = await deeplUsage(key);
    const pct = u.character_limit ? u.character_count / u.character_limit : 0;
    const month = new Date().toISOString().slice(0, 7);
    if (pct >= 0.9) await alert({ key: `deepl:${month}`, repeatHours: 1e6, title: "DeepL's free translations are almost used up",
      text: `${Math.round(pct * 100)}% of this month's free DeepL characters are used. When they run out, German, Spanish and French switch to Google (if connected) until next month.`,
      link: CONSOLE, linkLabel: "Open the console" });
  } catch (err) {
    await alert({ key: "deeplkey", title: "DeepL isn't working", text: `Translating with DeepL failed: "${err.message}".\n\nOpen the console → Languages and check the DeepL key.`, link: CONSOLE });
  }
}

export async function healthCheck({ daily = false, force = false } = {}) {
  if (!hasStore()) return { ok: false, error: "No storage." };
  const now = Date.now();
  if (!daily && !force) {
    const last = await getJSON(AK.checked, 0);
    if (now - last < 30 * 60000) return { ok: true, skipped: true };
  }
  await setJSON(AK.checked, now);
  const jobs = [checkPublish(now), checkPhotoWait(now)];
  if (daily) jobs.push(checkScheduler(now), checkInstagram(), checkTranslation());
  const res = await Promise.allSettled(jobs);
  return { ok: true, errors: res.filter((r) => r.status === "rejected").map((r) => r.reason?.message) };
}
