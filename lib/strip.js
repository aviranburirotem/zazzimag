// The words and logo on the moving strip at the top of the home page (console → Top strip).
// Shared by the build and the console preview, so the preview is the site, only smaller:
// every size and distance is set in "desktop pixels" (on a strip 1248 px wide) and drawn as a share
// of the strip's width, so the layout keeps its proportions on any screen.
//
// Elements: a logo (optional), the big headline and the second headline. They sit together as a group
// at one of nine places (pos), the logo above, left of, right of or below the text (layout), and each
// element can also be moved on its own (x / y).

const U = 100 / 1248; // one desktop pixel, in cqw (1% of the strip's width)
export const POSITIONS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];
export const LAYOUTS = ["above", "left", "right", "below"];
const num = (v, d, lo, hi) => { const n = parseFloat(v); return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : d)); };

// settings from Site texts (get(key) → value) → everything the markup needs
export function stripSettings(get) {
  return {
    showHeadline: get("strip.showHeadline") !== "off",
    showSub: get("strip.showSub") !== "off",
    showLogo: get("strip.showLogo") === "on",
    logo: get("strip.logo") || "heart-animated",
    layout: LAYOUTS.includes(get("strip.layout")) ? get("strip.layout") : "above",
    pos: POSITIONS.includes(get("home.headlinePos")) ? get("home.headlinePos") : "bl",
    color: ["white", "pink", "yellow", "black"].includes(get("home.headlineColor")) ? get("home.headlineColor") : "white",
    hs: num(get("home.headlineSize"), 100, 30, 260) / 100,
    is: num(get("home.introSize"), 100, 30, 300) / 100,
    hg: num(get("home.headlineGap"), 4, -60, 160),
    ls: num(get("strip.logoSize"), 150, 40, 420),
    lg: num(get("strip.logoGap"), 16, -80, 200),
    lx: num(get("strip.logoX"), 0, -700, 700), ly: num(get("strip.logoY"), 0, -300, 300),
    hx: num(get("strip.hlX"), 0, -700, 700), hy: num(get("strip.hlY"), 0, -300, 300),
    sx: num(get("strip.subX"), 0, -700, 700), sy: num(get("strip.subY"), 0, -300, 300),
  };
}

// o = stripSettings(…); parts = { headline, sub, logo } as ready HTML (any of them may be empty)
export function stripHtml(o, parts) {
  const vars = `--hs:${o.hs};--is:${o.is};--hg:${o.hg};--ls:${o.ls};--lg:${o.lg};--lx:${o.lx};--ly:${o.ly};--hx:${o.hx};--hy:${o.hy};--sx:${o.sx};--sy:${o.sy}`;
  const logo = o.showLogo && parts.logo ? `<div class="lava-logo" data-el="logo">${parts.logo}</div>` : "";
  const h = o.showHeadline && parts.headline ? `<h1 class="lava-h" data-el="hl">${parts.headline}</h1>` : "";
  const sub = o.showSub && parts.sub ? `<div class="lava-sub" data-el="sub">${parts.sub}</div>` : "";
  if (!logo && !h && !sub) return "";
  return `<div class="lava-in pos-${o.pos} hl-${o.color}" style="${vars}" lang="en" dir="ltr"><div class="lava-group lay-${o.layout}">${logo}${h || sub ? `<div class="lava-text">${h}${sub}</div>` : ""}</div></div>`;
}

// the layout itself (added to the page head on the home page, and to the console)
export const STRIP_CSS = `
.lava-band{container-type:inline-size}
.lava-band .lava-in{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;box-sizing:border-box;width:100%;padding:${(28 * U).toFixed(3)}cqw ${(36 * U).toFixed(3)}cqw}
.lava-group{display:flex;align-items:flex-start;gap:calc(var(--lg) * ${U.toFixed(5)}cqw)}
.lava-group.lay-above{flex-direction:column}.lava-group.lay-below{flex-direction:column-reverse}
.lava-group.lay-left{flex-direction:row;align-items:center}.lava-group.lay-right{flex-direction:row-reverse;align-items:center}
.pos-tc .lava-group.lay-above,.pos-mc .lava-group.lay-above,.pos-bc .lava-group.lay-above,.pos-tc .lava-group.lay-below,.pos-mc .lava-group.lay-below,.pos-bc .lava-group.lay-below{align-items:center}
.pos-tr .lava-group.lay-above,.pos-mr .lava-group.lay-above,.pos-br .lava-group.lay-above,.pos-tr .lava-group.lay-below,.pos-mr .lava-group.lay-below,.pos-br .lava-group.lay-below{align-items:flex-end}
.lava-logo{flex:none;translate:calc(var(--lx) * ${U.toFixed(5)}cqw) calc(var(--ly) * ${U.toFixed(5)}cqw)}
.lava-logo img,.lava-logo video{display:block;height:calc(var(--ls) * ${U.toFixed(5)}cqw);width:auto;max-width:none}
.lava-text{display:flex;flex-direction:column;min-width:0}
.lava-band .lava-in h1{margin:0;font-size:calc(var(--hs) * ${(88 * U).toFixed(4)}cqw);line-height:.92;font-style:normal;translate:calc(var(--hx) * ${U.toFixed(5)}cqw) calc(var(--hy) * ${U.toFixed(5)}cqw)}
.lava-band .lava-sub{translate:calc(var(--sx) * ${U.toFixed(5)}cqw) calc(var(--sy) * ${U.toFixed(5)}cqw)}
.lava-band .lava-sub p{margin:0;font-size:calc(var(--is) * ${(21 * U).toFixed(4)}cqw);line-height:1.3;max-width:none}
.lava-band .lava-h+.lava-sub{margin-top:calc(var(--hg) * ${U.toFixed(5)}cqw)}
.lava-heart{animation:lava-heart 4.2s ease-in-out infinite;transform-origin:50% 60%}
@keyframes lava-heart{0%,100%{transform:translateY(0) rotate(-2deg) scale(1)}50%{transform:translateY(-4%) rotate(2deg) scale(1.04)}}
@media (prefers-reduced-motion:reduce){.lava-heart{animation:none}}
html.a11y-still .lava-heart{animation:none}
@media (max-width:720px){.lava-band .lava-in h1{font-size:max(24px,calc(var(--hs) * ${(88 * U).toFixed(4)}cqw))}.lava-band .lava-sub p{font-size:max(12px,calc(var(--is) * ${(21 * U).toFixed(4)}cqw))}}
`;
