// Article translations. English is the site's language; articles (title, short description and text)
// are also offered in the languages below, translated (DeepL or Google, per language) when an article is saved in the console.
// Menus, buttons, captions and site headlines stay in English.
//
// A translation lives in content/translations/<slug>/<lang>.json:
//   { title, dek, body, src, cache: { <hash>: "translated piece" }, edited, outdated, at }
//   src       fingerprint of the English it was made from
//   cache     translated pieces by fingerprint, so after an edit only changed paragraphs are sent again
//   edited    changed by hand in the console: not replaced automatically when the English changes
//   outdated  the English changed after a hand edit (shown in the console)

// Order in the language menu: English, then by name (so no language stands out)
export const LANGS = [
  { code: "en", name: "English", native: "English", dir: "ltr" },
  // engine: the service that translates it best (the other one steps in if it's missing or out of free characters)
  //   DeepL for the European languages (the most natural French, German and Spanish),
  //   Google for Hebrew, Japanese and Korean (more data behind them, very strong for these)
  { code: "de", name: "German", native: "Deutsch", dir: "ltr", deepl: "DE", google: "de", engine: "deepl" },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr", deepl: "ES", google: "es", engine: "deepl" },
  { code: "fr", name: "French", native: "Français", dir: "ltr", deepl: "FR", google: "fr", engine: "deepl" },
  { code: "he", name: "Hebrew", native: "עברית", dir: "rtl", deepl: "HE", google: "he", engine: "google" },
  { code: "ja", name: "Japanese", native: "日本語", dir: "ltr", deepl: "JA", google: "ja", engine: "google" },
  { code: "ko", name: "Korean", native: "한국어", dir: "ltr", deepl: "KO", google: "ko", engine: "google" },
];
export const TARGETS = LANGS.filter((l) => l.code !== "en");
// The small note on a translated article (in its own language)
export const NOTE = {
  de: ["Automatisch aus dem Englischen übersetzt", "Aus dem Englischen übersetzt", "Original lesen"],
  es: ["Traducido automáticamente del inglés", "Traducido del inglés", "Leer el original"],
  fr: ["Traduit automatiquement de l’anglais", "Traduit de l’anglais", "Lire l’original"],
  he: ["תורגם אוטומטית מאנגלית", "תורגם מאנגלית", "לקריאת המקור"],
  ja: ["英語から自動翻訳されています", "英語から翻訳されています", "原文を読む"],
  ko: ["영어에서 자동 번역됨", "영어에서 번역됨", "원문 보기"],
};
export const langOf = (code) => LANGS.find((l) => l.code === code);

// Countries whose visitors get a language automatically (when their browser doesn't ask for one we have)
export const REGION = {
  IL: "he", JP: "ja", KR: "ko",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  DE: "de", AT: "de", CH: "de", LI: "de",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es",
};

// Short fingerprint of a text (same result in the browser and on the server)
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + s.length.toString(36);
}

// ---- markdown ⇄ the markup DeepL keeps intact ----
// Paragraphs are translated one by one. Photos and Instagram embeds are left alone; line prefixes
// (headings, quotes, lists) are kept outside; bold, italic and links travel as <b>, <i>, <a>.
const escX = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unX = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const PREFIX = /^(\s*(?:#{1,6} |> |[-*+] |\d+\. ))/;
const KEEP_LINE = /^\s*(?:!\[[^\]]*\]\([^)]*\)\s*)+$|^\s*@\[[a-z]+\]\([^)]*\)\s*$/i; // photo lines, embeds

function inlineToX(s, keep) {
  let out = escX(s);
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m) => `<x i="${keep.push(unX(m)) - 1}"/>`); // inline photos stay as they are
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a h="${keep.push(unX(u)) - 1}">${t}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/__([^_]+)__/g, "<b>$1</b>");
  out = out.replace(/\*([^*]+)\*/g, "<i>$1</i>").replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<i>$2</i>");
  return out;
}
function xToInline(s, keep) {
  let out = s.replace(/<x i="(\d+)"\s*\/?>(?:\s*<\/x>)?/g, (_, n) => `\u0000${n}\u0000`)
    .replace(/<a h="(\d+)"\s*>([\s\S]*?)<\/a>/g, (_, n, t) => `[${t}](\u0001${n}\u0001)`)
    .replace(/<b>([\s\S]*?)<\/b>/g, "**$1**").replace(/<i>([\s\S]*?)<\/i>/g, "*$1*")
    .replace(/<[^>]+>/g, "");
  out = unX(out);
  return out.replace(/\u0000(\d+)\u0000/g, (_, n) => keep[n] ?? "").replace(/\u0001(\d+)\u0001/g, (_, n) => keep[n] ?? "");
}

// Split an article into pieces: { kind: "keep" | "text", src (English markdown), x (markup to translate), prefixes, keep }
export function pieces(md) {
  return String(md || "").replace(/\r/g, "").split(/\n{2,}/).map((block) => {
    if (!block.trim() || block.split("\n").every((l) => KEEP_LINE.test(l))) return { kind: "keep", src: block };
    const lines = block.split("\n"), keep = [], prefixes = [];
    const x = lines.map((l) => { const m = l.match(PREFIX); prefixes.push(m ? m[1] : ""); return inlineToX(m ? l.slice(m[1].length) : l, keep); }).join("<br/>");
    return { kind: "text", src: block, x, prefixes, keep, h: hash(block) };
  });
}
export const joinBack = (p, translated) => translated.split(/<br\s*\/?>/).map((l, i) => (p.prefixes[i] || "") + xToInline(l, p.keep).trim()).join("\n");

// The English source of an article, as one fingerprint
export const sourceOf = (title, dek, body) => hash(`${title}\n${dek}\n${body}`);

// ---- the translation services ----
// keys = { deepl: "…:fx", google: "AIza…" }
const deeplHost = (key) => (/:fx$/.test(key) ? "https://api-free.deepl.com" : "https://api.deepl.com");
class OutOfCharacters extends Error {}
async function viaDeepl(key, texts, L) {
  const out = [];
  for (let i = 0; i < texts.length; i += 40) { // up to 50 texts per request
    const r = await fetch(`${deeplHost(key)}/v2/translate`, {
      method: "POST", headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texts.slice(i, i + 40), source_lang: "EN", target_lang: L.deepl, tag_handling: "xml", ignore_tags: ["x"], preserve_formatting: true }),
    });
    if (r.status === 403) throw new Error("DeepL didn't accept the key. Check it in the console (Languages).");
    if (r.status === 456) throw new OutOfCharacters("This month's free DeepL characters are used up.");
    if (!r.ok) throw new Error(`DeepL error ${r.status}`);
    out.push(...(await r.json()).translations.map((t) => t.text));
  }
  return out;
}
async function viaGoogle(key, texts, L) {
  const out = [];
  for (let i = 0; i < texts.length; i += 40) { // up to 128 texts per request
    const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts.slice(i, i + 40), source: "en", target: L.google, format: "html" }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const why = data.error?.errors?.[0]?.reason || "", msg = data.error?.message || `Google error ${r.status}`;
      if (/rateLimit|quota|dailyLimit|userRateLimit/i.test(why) || r.status === 429) throw new OutOfCharacters("Google's translation limit for now is reached.");
      if (r.status === 400 && /API key/i.test(msg) || r.status === 403) throw new Error(`Google didn't accept the key: ${msg}`);
      throw new Error(msg);
    }
    out.push(...data.data.translations.map((t) => t.translatedText));
  }
  return out;
}
const ENGINES = { deepl: viaDeepl, google: viaGoogle };
export const ENGINE_NAMES = { deepl: "DeepL", google: "Google" };
// Translate texts into L with its best service; fall back to the other if that one has no key or no characters left.
async function translateTexts(keys, texts, L) {
  const order = [L.engine, L.engine === "google" ? "deepl" : "google"].filter((e) => keys[e]);
  if (!order.length) throw new Error("No translation service is connected. Add a key in the console (Languages).");
  let last;
  for (const e of order) {
    try { return { texts: await ENGINES[e](keys[e], texts, L), engine: e }; }
    catch (err) { last = err; if (!(err instanceof OutOfCharacters)) throw err; }
  }
  throw last;
}
export async function deeplUsage(key) {
  const r = await fetch(`${deeplHost(key)}/v2/usage`, { headers: { Authorization: `DeepL-Auth-Key ${key}` } });
  if (!r.ok) throw new Error(r.status === 403 ? "DeepL didn't accept the key." : `DeepL error ${r.status}`);
  return r.json(); // { character_count, character_limit }
}
export async function googleCheck(key) { // a tiny translation, to see the key works
  await viaGoogle(key, ["Hello"], langOf("he"));
  return true;
}

// Translate one article into one language, reusing what was already translated.
// prev = the existing translation (or null). force = replace even a hand-edited translation.
export async function translateArticle({ title, dek, body }, lang, prev, keys, { force = false } = {}) {
  const L = langOf(lang);
  if (!L?.engine) throw new Error(`Unknown language: ${lang}`);
  const src = sourceOf(title, dek, body);
  if (prev && prev.src === src && !force) return { ...prev, outdated: false };
  if (prev?.edited && !force) return { ...prev, outdated: true }; // keep hand edits; the console offers to translate again
  const cache = { ...(prev?.cache || {}) };
  const ps = pieces(body);
  const need = [];
  const want = (h, x) => { if (!(h in cache) && !need.some((n) => n.h === h)) need.push({ h, x }); };
  const th = hash("t:" + title), dh = hash("d:" + dek);
  if (title) want(th, escX(title));
  if (dek) want(dh, escX(dek));
  for (const p of ps) if (p.kind === "text") want(p.h, p.x);
  let engine = prev?.engine || "";
  if (need.length) {
    const got = await translateTexts(typeof keys === "string" ? { deepl: keys } : keys, need.map((n) => n.x), L);
    need.forEach((n, i) => { cache[n.h] = got.texts[i]; });
    engine = got.engine;
  }
  const used = new Set([th, dh, ...ps.map((p) => p.h).filter(Boolean)]);
  for (const k of Object.keys(cache)) if (!used.has(k)) delete cache[k]; // forget pieces no longer in the article
  return {
    title: title ? unX(cache[th].replace(/<[^>]+>/g, "")) : "",
    dek: dek ? unX(cache[dh].replace(/<[^>]+>/g, "")) : "",
    body: ps.map((p) => (p.kind === "keep" ? p.src : joinBack(p, cache[p.h]))).join("\n\n"),
    src, cache, edited: false, outdated: false, at: new Date().toISOString().slice(0, 10), engine, chars: need.reduce((n, x) => n + x.x.length, 0),
  };
}
