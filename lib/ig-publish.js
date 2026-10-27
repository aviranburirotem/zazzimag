// Posts the Instagram queue (console → "Scheduled posts").
// The queue, schedule and history live in Redis; the photos are files on the site (/ig-queue/…),
// because Instagram fetches each photo from a public web address.
import { getToken, getJSON, setJSON, lock, unlock } from "./token.js";
import { dueNow, local } from "./ig-schedule.js";

const API = "https://graph.instagram.com/v26.0";
export const SITE = "https://www.zazzimag.com";
export const KEYS = { queue: "ig_queue", schedule: "ig_schedule", history: "ig_posted", logos: "ig_logos" };
export const DEFAULT_SCHEDULE = { on: false, every: 2, time: "18:00", lastAuto: null, logo: { src: "default", on: true, corner: "br", size: 16, opacity: 90 }, frame: { on: true, size: 5 } };

export const imageUrl = (file) => `${SITE}/ig-queue/${file}`;

async function ig(path, params, token, method = "POST") {
  const body = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(method === "GET" ? `${API}${path}?${body}` : `${API}${path}`, method === "GET" ? {} : { method, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error?.error_user_msg || data.error?.message || `Instagram error ${r.status}`);
  return data;
}

// wait until Instagram has finished fetching a photo
async function ready(id, token) {
  for (let i = 0; i < 20; i++) {
    const s = await ig(`/${id}`, { fields: "status_code" }, token, "GET");
    if (s.status_code === "FINISHED" || !s.status_code) return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram couldn't use this photo.");
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  throw new Error("Instagram took too long to take the photo. It will be tried again.");
}

// photos are added to the site with the queue; right after saving, they need about a minute to go live
async function photosLive(item) {
  for (const p of item.images) {
    const r = await fetch(imageUrl(p.file), { method: "HEAD" }).catch(() => null);
    if (!r || !r.ok) return false;
  }
  return true;
}

// people tagged on a photo: [{ username, x, y }] (x, y from 0 to 1, measured on the posted photo)
const tagsOf = (p) => (p.tags || []).length ? { user_tags: JSON.stringify(p.tags.map((t) => ({ username: t.u, x: t.x, y: t.y }))) } : {};
// collaborators: up to 3 accounts invited to share the post (it shows on their profile once they accept)
const collabsOf = (item) => (item.collabs || []).length ? { collaborators: JSON.stringify(item.collabs) } : {};

export async function publish(item, token) {
  const me = await ig("/me", { fields: "user_id,username" }, token, "GET");
  const uid = me.user_id;
  let creation;
  if (item.images.length === 1) {
    creation = (await ig(`/${uid}/media`, { image_url: imageUrl(item.images[0].file), caption: item.caption || "", ...tagsOf(item.images[0]), ...collabsOf(item) }, token)).id;
  } else {
    const children = [];
    for (const p of item.images) {
      const c = (await ig(`/${uid}/media`, { image_url: imageUrl(p.file), is_carousel_item: "true", ...tagsOf(p) }, token)).id;
      await ready(c, token);
      children.push(c);
    }
    creation = (await ig(`/${uid}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: item.caption || "", ...collabsOf(item) }, token)).id;
  }
  await ready(creation, token);
  const media = await ig(`/${uid}/media_publish`, { creation_id: creation }, token);
  let permalink = "";
  try { permalink = (await ig(`/${media.id}`, { fields: "permalink" }, token, "GET")).permalink || ""; } catch {}
  return { mediaId: media.id, permalink };
}

// Run once (every 15 minutes from the scheduler, or "Post now" in the console).
// onlyId: post this item now, whatever the schedule says.
export async function run({ onlyId = null, now = Date.now() } = {}) {
  // cheap check first (2 reads), so a check every minute costs almost nothing when nothing is due
  if (!onlyId) {
    const q0 = await getJSON(KEYS.queue, []);
    if (!q0.length || !dueNow(q0, { ...DEFAULT_SCHEDULE, ...(await getJSON(KEYS.schedule, {})) }, now)) return { ok: true, posted: null };
  }
  if (!(await lock("ig_lock", 170))) return { ok: true, skipped: "Another run is already posting." };
  try {
    const token = await getToken();
    if (!token) return { ok: false, error: "Instagram isn't connected." };
    const queue = await getJSON(KEYS.queue, []);
    const schedule = { ...DEFAULT_SCHEDULE, ...(await getJSON(KEYS.schedule, {})) };
    let pick;
    if (onlyId) {
      const item = queue.find((it) => it.id === onlyId);
      if (!item) return { ok: false, error: "That post isn't in the queue any more." };
      pick = { item, auto: false };
    } else pick = dueNow(queue, schedule, now);
    if (!pick) return { ok: true, posted: null };
    const item = pick.item;
    if (!(await photosLive(item))) return { ok: true, posted: null, waiting: "The photos are still being added to the site. Try again in a minute." };

    const save = async (fn) => { // re-read and write, so console edits made meanwhile aren't lost
      const q = await getJSON(KEYS.queue, []);
      const out = fn(q);
      await setJSON(KEYS.queue, out);
    };
    await save((q) => q.map((it) => (it.id === item.id ? { ...it, status: "posting" } : it)));
    if (pick.auto) await setJSON(KEYS.schedule, { ...schedule, lastAuto: local(now).date }); // one automatic post per slot, even if it fails
    try {
      const res = await publish(item, token);
      await save((q) => q.filter((it) => it.id !== item.id));
      const history = await getJSON(KEYS.history, []);
      history.unshift({ id: item.id, caption: item.caption || "", images: item.images.map((p) => p.file), permalink: res.permalink, postedAt: new Date(now).toISOString() });
      await setJSON(KEYS.history, history.slice(0, 60));
      return { ok: true, posted: { id: item.id, permalink: res.permalink } };
    } catch (err) {
      await save((q) => q.map((it) => (it.id === item.id ? { ...it, status: "error", error: err.message, tries: (it.tries || 0) + 1 } : it)));
      return { ok: false, error: err.message };
    }
  } finally {
    await unlock("ig_lock");
  }
}
