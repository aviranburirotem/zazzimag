// The site's colours follow the lead article (pinned first, otherwise the newest): its cover's main
// colour becomes the accent (buttons, hearts, links) and tints the moving blob strip on the home page.
// Shared by the build and the console (which works out the colour when a cover is chosen).

export const DEFAULT_COLOR = "e30613"; // Zazzi red, used when there is no colour to go by
export const BLACK = "141414";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const hexToRgb = (hex) => { const h = String(hex).replace(/^#/, ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
export const rgbToHex = (rgb) => rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
export const validHex = (s) => /^#?[0-9a-f]{6}$/i.test(String(s || "").trim());

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = rgb.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// The main colour of a picture: the most present vivid hue (greys, near-black and near-white don't count).
// px = RGBA bytes (e.g. from a small canvas or a resized image). Returns "rrggbb", or "" if the picture has no clear colour.
export function mainColor(px) {
  const BINS = 30, w = new Float64Array(BINS), sum = Array.from({ length: BINS }, () => [0, 0, 0]);
  let total = 0, n = 0, vivid = 0, darkNeutral = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] !== undefined && px[i + 3] < 128) continue;
    const rgb = [px[i], px[i + 1], px[i + 2]], [h, s, l] = rgbToHsl(rgb);
    n++;
    if (l < 0.35 && s < 0.25) darkNeutral++;
    if (l < 0.1 || l > 0.94 || s < 0.18) continue;
    vivid++;
    let k = s * s * (1 - Math.abs(l - 0.5) * 1.2); // favour strong, mid-light colours
    if (h >= 8 && h <= 42 && s < 0.65 && l > 0.25 && l < 0.85) k *= 0.2; // skin, wood and pavement tones count less
    const b = Math.floor(h / (360 / BINS)) % BINS;
    w[b] += k; total += k; sum[b][0] += rgb[0] * k; sum[b][1] += rgb[1] * k; sum[b][2] += rgb[2] * k;
  }
  if (n && darkNeutral / n >= 0.4 && total / n < 0.06) return BLACK; // mostly black clothes and shadows: a black look
  if (!n || vivid / n < 0.015) return ""; // hardly any colour in the picture
  let best = 0, bestW = -1;
  for (let b = 0; b < BINS; b++) { const v = w[(b + BINS - 1) % BINS] * 0.5 + w[b] + w[(b + 1) % BINS] * 0.5; if (v > bestW) { bestW = v; best = b; } }
  const acc = [0, 0, 0]; let kw = 0;
  for (const b of [(best + BINS - 1) % BINS, best, (best + 1) % BINS]) { acc[0] += sum[b][0]; acc[1] += sum[b][1]; acc[2] += sum[b][2]; kw += w[b]; }
  return rgbToHex(acc.map((v) => v / kw));
}

// Everything the site needs from one colour
export function palette(hex) {
  const base = hexToRgb(validHex(hex) ? hex : DEFAULT_COLOR);
  const [h, s0, l0] = rgbToHsl(base);
  // black, grey or white: black tones everywhere (black buttons; glossy black blobs with silver light on a charcoal backdrop)
  if (s0 < 0.12 || l0 < 0.1) return {
    accent: "#141414",
    lava: { bgL: "#5e5e5e", bgR: "#262626", haze: "#8a8a8a", key: "#7a7a7a", side: "#565656", top: "#b4b4b4", warm: "#3c3c3c", amb: "#060606" },
  };
  const s = Math.max(0.55, s0);
  // accent: the colour itself, darkened until white text on it (and it on white) is easy to read (4.5:1)
  let [, , l] = rgbToHsl(base), accent = hslToRgb([h, s, Math.min(l, 0.5)]);
  while (contrast(accent, [255, 255, 255]) < 4.6 && l > 0.05) { l -= 0.02; accent = hslToRgb([h, s, Math.min(l, 0.5)]); }
  const c = (hh, ss, ll) => "#" + rgbToHex(hslToRgb([h + hh, ss, ll]));
  return {
    accent: "#" + rgbToHex(accent),
    lava: { // the blob strip: backdrop, haze, lights from both sides, warm bounce, shadows
      bgL: c(0, 0.62, 0.62), bgR: c(-32, 0.62, 0.7), haze: c(0, 0.8, 0.93),
      key: c(0, 0.95, 0.58), side: c(-42, 0.9, 0.6), top: c(-10, 0.7, 0.88), warm: c(32, 0.95, 0.74), amb: c(0, 0.65, 0.15),
    },
  };
}
