// Lava lamp strip at the top of the home page: glossy coloured blobs that rise, sink, merge and split
// in a dark liquid. The headline sits on top as normal page text (size, place and colour are set in
// the console → Site texts → Home page).
// Drawn on a small canvas and scaled up, so it stays light on phones. Stops when off screen, when the
// tab is hidden, with the pause button, or with "Stop animations" / reduced motion (then a still frame
// is shown).
(() => {
  const box = document.querySelector("[data-lava]");
  if (!box) return;
  const cv = box.querySelector("canvas"), btn = box.querySelector("[data-lava-pause]");
  const ctx = cv.getContext("2d", { alpha: false });
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const COLORS = ["#ff2e88", "#ff7a1a", "#ffd23f", "#8a4dff", "#22c7e8", "#ff3b3b", "#7ee05a", "#ff5bd6"].map(hex);
  const TOP = hex("#1c0830"), BOT = hex("#3d0a24"); // the liquid: deep violet into wine
  const still = () => document.documentElement.classList.contains("a11y-still") || matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, S = 1 / 3, img = null, blobs = [], bg = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function make() {
    const n = Math.max(5, Math.min(11, Math.round(W / 130))), base = Math.max(22, Math.min(H * 0.28, W * 0.075));
    blobs = Array.from({ length: n }, (_, i) => ({
      x: (i + 0.5) / n + rnd(-0.03, 0.03), ax: rnd(0.015, 0.05), wx: rnd(0.08, 0.2), px: rnd(0, 6.3),
      ay: rnd(0.32, 0.5), wy: rnd(0.1, 0.24), py: rnd(0, 6.3),
      r: base * rnd(0.6, 1.2), ar: rnd(0.08, 0.2), wr: rnd(0.2, 0.45), pr: rnd(0, 6.3),
      c: COLORS[i % COLORS.length],
    }));
  }
  function size() {
    const r = box.getBoundingClientRect();
    if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1) return;
    W = r.width; H = r.height; S = W < 600 ? 0.5 : 0.4;
    cv.width = Math.max(40, Math.round(W * S)); cv.height = Math.max(20, Math.round(H * S));
    img = ctx.createImageData(cv.width, cv.height);
    bg = new Float32Array(cv.height * 3);
    for (let y = 0; y < cv.height; y++) { const k = y / (cv.height - 1 || 1); for (let c = 0; c < 3; c++) bg[y * 3 + c] = TOP[c] + (BOT[c] - TOP[c]) * k; }
    make();
  }

  const norm = (v) => { const m = Math.hypot(...v); return v.map((x) => x / m); };
  const L = norm([-0.45, -0.6, 0.66]), HV = norm([L[0], L[1], L[2] + 1]);

  function draw(t) {
    const w = cv.width, h = cv.height, d = img.data;
    const B = blobs.map((b) => ({
      x: (b.x + b.ax * Math.sin(t * b.wx + b.px)) * w,
      y: (0.5 + b.ay * Math.sin(t * b.wy + b.py)) * h,
      r2: (b.r * S * (1 + b.ar * Math.sin(t * b.wr + b.pr))) ** 2,
      c: b.c,
    }));
    const tilt = 0.8 * (blobs[0]?.r || 40) * S;
    let o = 0;
    for (let y = 0; y < h; y++) {
      const lr = bg[y * 3], lg = bg[y * 3 + 1], lb = bg[y * 3 + 2];
      for (let x = 0; x < w; x++, o += 4) {
        let F = 0, gx = 0, gy = 0, cr = 0, cg = 0, cb = 0;
        for (let i = 0; i < B.length; i++) {
          const b = B[i], dx = x - b.x, dy = y - b.y, q = dx * dx + dy * dy + 0.01, f = b.r2 / q;
          F += f; cr += f * b.c[0]; cg += f * b.c[1]; cb += f * b.c[2];
          const g = (2 * f) / q; gx -= g * dx; gy -= g * dy;
        }
        let R = lr, G = lg, Bl = lb;
        // a soft glow in the liquid around each blob
        const glow = Math.min(0.2, F * 0.12), inv = 1 / F;
        R += (cr * inv - R) * glow; G += (cg * inv - G) * glow; Bl += (cb * inv - Bl) * glow;
        const a = F <= 0.94 ? 0 : F >= 1.06 ? 1 : (F - 0.94) / 0.12;
        if (a > 0) {
          let nx = -gx * tilt / F, ny = -gy * tilt / F, nz = 1;
          const m = Math.hypot(nx, ny, nz); nx /= m; ny /= m; nz /= m;
          const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
          const spec = Math.pow(Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]), 36) * 210;
          const lit = 0.6 + 0.55 * diff;
          R += (Math.min(255, cr * inv * lit + spec) - R) * a;
          G += (Math.min(255, cg * inv * lit + spec) - G) * a;
          Bl += (Math.min(255, cb * inv * lit + spec) - Bl) * a;
        }
        d[o] = R; d[o + 1] = G; d[o + 2] = Bl; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let userPaused = false, paused = still(), seen = true, raf = 0, last = 0, t = rnd(0, 100);
  function loop(now) {
    raf = 0;
    if (paused || !seen || document.hidden) return;
    if (now - last > 33) { t += Math.min(0.1, (now - last) / 1000 || 0.033); last = now; draw(t); } // about 30 frames a second
    raf = requestAnimationFrame(loop);
  }
  const run = () => { if (!raf && !paused) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const setPaused = (p) => {
    paused = p;
    if (btn) { btn.setAttribute("aria-pressed", String(p)); btn.setAttribute("aria-label", p ? "Play the animation" : "Pause the animation"); }
    if (!p) run();
  };

  size(); draw(t); box.classList.add("on"); setPaused(paused);
  new ResizeObserver(() => { size(); draw(t); }).observe(box);
  if ("IntersectionObserver" in window) new IntersectionObserver(([en]) => { seen = en.isIntersecting; run(); }).observe(box);
  document.addEventListener("visibilitychange", run);
  btn?.addEventListener("click", () => { userPaused = !paused; setPaused(userPaused || still()); });
  // "Stop animations" in the accessibility menu
  new MutationObserver(() => setPaused(userPaused || still()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
})();
