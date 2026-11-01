// Alerts: when something on the site stops working, write it down (console → Alerts) and send an email.
// Emails go through Resend (resend.com, free plan). The key and the address are saved in the console.
// The same problem is emailed once, then again only after `repeatHours` if it's still happening.
import { getJSON, setJSON, hasStore } from "./token.js";

export const AK = { cfg: "alert_cfg", key: "resend_key", sent: "alert_sent", log: "alert_log", checked: "health_checked", beat: "sched_beat", wait: "ig_photo_wait" };
export const CONSOLE = "https://www.zazzimag.com/admin/";
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendEmail({ subject, text, link = CONSOLE, linkLabel = "Open the console" }, { cfg, key } = {}) {
  cfg = cfg || (await getJSON(AK.cfg, {}));
  key = key || (await getJSON(AK.key, ""));
  if (!key || !cfg.to) return { ok: false, error: "Email isn't set up." };
  const html = `<div style="font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px">
    <p style="font:700 12px/1 monospace;letter-spacing:.08em;text-transform:uppercase;color:#e60012;margin:0 0 12px">Zazzi magazine · alert</p>
    <h1 style="font-size:20px;margin:0 0 12px">${esc(subject)}</h1>
    ${String(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}
    <p style="margin:20px 0"><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:600">${esc(linkLabel)}</a></p>
    <p style="font-size:12px;color:#777;margin:0">You get these because alerts are on in the console (Alerts tab). The same problem is emailed again only if it's still happening a day later.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: cfg.from || "Zazzi alerts <onboarding@resend.dev>", to: [cfg.to], subject: `Zazzi: ${subject}`, html, text: `${subject}\n\n${text}\n\n${link}` }),
  }).catch((err) => ({ ok: false, status: 0, json: async () => ({ message: err.message }) }));
  if (r.ok) return { ok: true };
  const d = await r.json().catch(() => ({}));
  return { ok: false, error: d.message || `Resend error ${r.status}` };
}

// key: names the problem (the same key isn't emailed twice within repeatHours)
export async function alert({ key, title, text, link, linkLabel, repeatHours = 24 }) {
  if (!hasStore()) return false;
  try {
    const now = Date.now(), sent = await getJSON(AK.sent, {});
    if (sent[key] && now - sent[key] < repeatHours * 3600e3) return false;
    for (const k of Object.keys(sent)) if (now - sent[k] > 14 * 864e5) delete sent[k];
    sent[key] = now;
    await setJSON(AK.sent, sent);
    const cfg = await getJSON(AK.cfg, {});
    const mail = cfg.on === false ? { ok: false, error: "Emails are off." } : await sendEmail({ subject: title, text, link, linkLabel }, { cfg });
    const log = await getJSON(AK.log, []);
    log.unshift({ at: new Date(now).toISOString(), key, title, text, emailed: mail.ok, mailError: mail.ok ? "" : mail.error });
    await setJSON(AK.log, log.slice(0, 60));
    return true;
  } catch (err) {
    console.error("alert:", err.message);
    return false;
  }
}

// the problem is fixed: forget it, so it's emailed again if it comes back
export async function resolved(key) {
  if (!hasStore()) return;
  try {
    const sent = await getJSON(AK.sent, {});
    if (!(key in sent)) return;
    delete sent[key];
    await setJSON(AK.sent, sent);
  } catch {}
}
