// Lava lamp inside the home headline: the letters are windows onto a lamp, with glossy coloured
// blobs that rise, sink, merge and split. The real headline stays in the page (for search engines,
// screen readers and copying); the canvas on top draws the same words, word by word, at the
// exact places the browser put them, filled with the lava.
// Stops when off screen, when the tab is hidden, with the pause button, or with "Stop animations" /
// reduced motion (then a still frame is shown).
(() => {
  const box = document.querySelector("[data-lava]");
  if (!box) return;
  const h1 = box.querySelector("h1"), cv = box.querySelector("canvas"), btn = box.querySelector("[data-lava-pause]");
  const ctx = cv.getContext("2d");
  const lava = document.createElement("canvas"), lx = lava.getContext("2d"); // the lamp, drawn small
  const mask = document.createElement("canvas"), mx = mask.getContext("2d"); // the words
  const S = 1 / 3;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  // deeper colours on the white page (so the words keep their contrast), brighter ones in the dark theme
  const COLORS = {
    light: ["#ff1f7a", "#ff5a00", "#7a2cff", "#0090c0", "#e8102a", "#1a9a45", "#d02bc8", "#e07a00"].map(hex),
    dark: ["#ff2e88", "#ff7a1a", "#ffd23f", "#8a4dff", "#22c7e8", "#ff3b3b", "#7ee05a", "#ff5bd6"].map(hex),
  };
  // the liquid around the blobs: dark in the light theme, light in the dark theme, so the words always read
  const LIQUID = { light: [hex("#1a0b2e"), hex("#3a0c2a")], dark: [hex("#fff3e6"), hex("#ffe1ef")] };
  const still = () => document.documentElement.classList.contains("a11y-still") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dark = () => document.documentElement.dataset.theme === "dark";

  let W = 0, H = 0, dpr = 1, img = null, blobs = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function make() {
    const n = W < 500 ? 7 : 12, base = Math.max(18, Math.min(H * 0.3, W * 0.085));
    blobs = Array.from({ length: n }, (_, i) => ({
      x: (i + 0.5) / n + rnd(-0.03, 0.03), ax: rnd(0.015, 0.05), wx: rnd(0.1, 0.22), px: rnd(0, 6.3),
      ay: rnd(0.4, 0.62), wy: rnd(0.14, 0.3), py: rnd(0, 6.3),
      r: base * rnd(0.6, 1.15), ar: rnd(0.08, 0.2), wr: rnd(0.25, 0.5), pr: rnd(0, 6.3),
      c: i % 8,
    }));
  }

  // the words, drawn where the browser placed them
  function drawMask() {
    const st = getComputedStyle(h1), fs = parseFloat(st.fontSize);
    mx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mx.clearRect(0, 0, W, H);
    mx.font = `italic 900 ${fs}px Archivo, system-ui, sans-serif`;
    try { mx.fontStretch = "condensed"; } catch {}
    mx.fillStyle = "#000"; mx.textBaseline = "alphabetic";
    const base = cv.getBoundingClientRect(), range = document.createRange();
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      const text = node.textContent;
      for (const m of text.matchAll(/\S+/g)) {
        range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
        const rects = range.getClientRects(); if (!rects.length) continue;
        const r = rects[0], word = st.textTransform === "uppercase" ? m[0].toUpperCase() : m[0];
        const mt = mx.measureText(word);
        const sx = mt.width ? r.width / mt.width : 1;
        const y = r.bottom - base.top - (mt.fontBoundingBoxDescent ?? fs * 0.2);
        mx.save(); mx.translate(r.left - base.left, y); mx.scale(sx, 1); mx.fillText(word, 0, 0); mx.restore();
      }
    }
  }

  function size() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height;
    cv.width = mask.width = Math.round(W * dpr); cv.height = mask.height = Math.round(H * dpr);
    lava.width = Math.max(40, Math.round(W * S)); lava.height = Math.max(20, Math.round(H * S));
    img = lx.createImageData(lava.width, lava.height);
    make(); drawMask();
  }

  const norm = (v) => { const m = Math.hypot(...v); return v.map((x) => x / m); };
  const L = norm([-0.45, -0.6, 0.66]), HV = norm([L[0], L[1], L[2] + 1]);

  function drawLava(t) {
    const w = lava.width, h = lava.height, d = img.data;
    const th = dark() ? "dark" : "light", [top, bot] = LIQUID[th], pal = COLORS[th];
    const shine = th === "dark" ? 200 : 120, lit0 = th === "dark" ? 0.72 : 0.6, lit1 = th === "dark" ? 0.5 : 0.5;
    const B = blobs.map((b) => ({
      x: (b.x + b.ax * Math.sin(t * b.wx + b.px)) * w,
      y: (0.5 + b.ay * Math.sin(t * b.wy + b.py)) * h,
      r2: (b.r * S * (1 + b.ar * Math.sin(t * b.wr + b.pr))) ** 2,
      c: pal[b.c],
    }));
    const tilt = 0.8 * (blobs[0]?.r || 30) * S;
    let o = 0;
    for (let y = 0; y < h; y++) {
      const k = y / (h - 1 || 1), lr = top[0] + (bot[0] - top[0]) * k, lg = top[1] + (bot[1] - top[1]) * k, lb = top[2] + (bot[2] - top[2]) * k;
      for (let x = 0; x < w; x++, o += 4) {
        let F = 0, gx = 0, gy = 0, cr = 0, cg = 0, cb = 0;
        for (let i = 0; i < B.length; i++) {
          const b = B[i], dx = x - b.x, dy = y - b.y, q = dx * dx + dy * dy + 0.01, f = b.r2 / q;
          F += f; cr += f * b.c[0]; cg += f * b.c[1]; cb += f * b.c[2];
          const g = (2 * f) / q; gx -= g * dx; gy -= g * dy;
        }
        // blob edge: a narrow soft band around the surface
        const a = F <= 0.92 ? 0 : F >= 1.08 ? 1 : (F - 0.92) / 0.16;
        let R = lr, G = lg, Bl = lb;
        if (a > 0) {
          let nx = -gx * tilt / F, ny = -gy * tilt / F, nz = 1;
          const m = Math.hypot(nx, ny, nz); nx /= m; ny /= m; nz /= m;
          const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
          const spec = Math.pow(Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]), 36) * shine;
          const lit = lit0 + lit1 * diff, inv = 1 / F;
          R += (Math.min(255, cr * inv * lit + spec) - R) * a;
          G += (Math.min(255, cg * inv * lit + spec) - G) * a;
          Bl += (Math.min(255, cb * inv * lit + spec) - Bl) * a;
        }
        d[o] = R; d[o + 1] = G; d[o + 2] = Bl; d[o + 3] = 255;
      }
    }
    lx.putImageData(img, 0, 0);
  }

  function frame(t) {
    drawLava(t);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(lava, 0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = "destination-in"; // keep the lava only inside the letters
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  let userPaused = false, paused = still(), seen = true, raf = 0, last = 0, t = rnd(0, 100);
  function loop(now) {
    raf = 0;
    if (paused || !seen || document.hidden) return;
    if (now - last > 33) { t += Math.min(0.1, (now - last) / 1000 || 0.033); last = now; frame(t); } // about 30 frames a second
    raf = requestAnimationFrame(loop);
  }
  const run = () => { if (!raf && !paused) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const setPaused = (p) => {
    paused = p;
    if (btn) { btn.setAttribute("aria-pressed", String(p)); btn.setAttribute("aria-label", p ? "Play the animation" : "Pause the animation"); }
    if (!p) run();
  };

  const start = () => {
    box.classList.add("on"); size(); frame(t); setPaused(paused);
    new ResizeObserver(() => { size(); frame(t); }).observe(box);
    if ("IntersectionObserver" in window) new IntersectionObserver(([en]) => { seen = en.isIntersecting; run(); }).observe(box);
    document.addEventListener("visibilitychange", run);
    btn?.addEventListener("click", () => { userPaused = !paused; setPaused(userPaused || still()); });
    // "Stop animations" in the accessibility menu, and the light switch (theme)
    new MutationObserver(() => { setPaused(userPaused || still()); frame(t); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  };
  // wait for the headline font, so the words are measured in their real shape
  (document.fonts?.load(`italic 900 40px Archivo`) || Promise.resolve()).catch(() => {}).then(() => document.fonts?.ready).then(start, start);
})();
