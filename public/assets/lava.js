// Lava strip at the top of the home page: soft, matte 3D blobs heaped along the bottom, bubbling up,
// merging and splitting, with small spheres floating in the air, on a violet-to-sky-blue backdrop.
// The blobs are lit by a cyan light from the right, a magenta light from the left and a warm light
// from below, like a studio shot. The headline (if any) sits on top as normal page text.
// Drawn on a small canvas and scaled up, so it stays light on phones. Stops when off screen, when the
// tab is hidden, with the pause button, or with "Stop animations" / reduced motion (then a still frame
// is shown).
(() => {
  const box = document.querySelector("[data-lava]");
  if (!box) return;
  const cv = box.querySelector("canvas"), btn = box.querySelector("[data-lava-pause]");
  const ctx = cv.getContext("2d", { alpha: false });
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  // backdrop: left → right, and a little lighter towards the top
  const BG_L = hex("#b768d8"), BG_R = hex("#7cb6ea"), HAZE = hex("#e9dcff");
  const norm = (v) => { const m = Math.hypot(...v); return v.map((x) => x / m); };
  const LIGHTS = [
    { d: norm([0.85, -0.35, 0.5]), c: hex("#3fd2ff"), k: 0.9 },  // cyan, from the right
    { d: norm([-0.85, -0.25, 0.5]), c: hex("#e24bd2"), k: 0.85 }, // magenta, from the left
    { d: norm([0, -0.85, 0.55]), c: hex("#cfc4ff"), k: 0.22 },   // soft top light
    { d: norm([0.2, 0.9, 0.4]), c: hex("#ffad85"), k: 0.4 },    // warm bounce from below
  ];
  const AMB = hex("#1a0c40"), HV = norm([0.3, -0.6, 1.4]);
  const still = () => document.documentElement.classList.contains("a11y-still") || matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, S = 0.4, img = null, blobs = [], bgx = null, bgy = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function make() {
    const big = Math.max(4, Math.min(10, Math.round(W / 150))), mid = Math.max(3, Math.round(big * 0.7)), dust = Math.max(6, Math.round(W / 80));
    const u = Math.min(H, W * 0.35);
    blobs = [
      // the heap along the bottom: big, slow, bobbing
      ...Array.from({ length: big }, (_, i) => ({ x: (i + 0.5) / big + rnd(-0.04, 0.04), ax: rnd(0.01, 0.04), wx: rnd(0.05, 0.12), px: rnd(0, 6.3),
        y: rnd(1.0, 1.15), ay: rnd(0.04, 0.1), wy: rnd(0.12, 0.25), py: rnd(0, 6.3), r: u * rnd(0.22, 0.38), ar: rnd(0.05, 0.12), wr: rnd(0.15, 0.3), pr: rnd(0, 6.3) })),
      // bubbles that rise out of the heap and sink back into it
      ...Array.from({ length: mid }, () => ({ x: rnd(0.03, 0.97), ax: rnd(0.01, 0.03), wx: rnd(0.05, 0.12), px: rnd(0, 6.3),
        y: rnd(0.62, 0.75), ay: rnd(0.18, 0.32), wy: rnd(0.08, 0.16), py: rnd(0, 6.3), r: u * rnd(0.1, 0.2), ar: rnd(0.04, 0.1), wr: rnd(0.2, 0.4), pr: rnd(0, 6.3) })),
      // small spheres floating in the air
      ...Array.from({ length: dust }, () => ({ x: rnd(0, 1), ax: rnd(0.005, 0.02), wx: rnd(0.08, 0.2), px: rnd(0, 6.3),
        y: rnd(0.1, 0.85), ay: rnd(0.04, 0.12), wy: rnd(0.1, 0.25), py: rnd(0, 6.3), r: u * rnd(0.025, 0.06), ar: 0, wr: 0, pr: 0 })),
    ];
  }
  function size() {
    const r = box.getBoundingClientRect();
    if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1) return;
    W = r.width; H = r.height; S = W < 600 ? 0.6 : 0.42;
    cv.width = Math.max(40, Math.round(W * S)); cv.height = Math.max(20, Math.round(H * S));
    img = ctx.createImageData(cv.width, cv.height);
    bgx = new Float32Array(cv.width * 3); bgy = new Float32Array(cv.height);
    for (let x = 0; x < cv.width; x++) { const k = x / (cv.width - 1 || 1); for (let c = 0; c < 3; c++) bgx[x * 3 + c] = BG_L[c] + (BG_R[c] - BG_L[c]) * k; }
    for (let y = 0; y < cv.height; y++) bgy[y] = 0.32 * (1 - y / (cv.height - 1 || 1)) ** 2; // haze amount
    make();
  }

  function draw(t) {
    const w = cv.width, h = cv.height, d = img.data;
    const B = blobs.map((b) => {
      const r = b.r * S * (1 + b.ar * Math.sin(t * b.wr + b.pr));
      return { x: (b.x + b.ax * Math.sin(t * b.wx + b.px)) * w, y: (b.y + b.ay * Math.sin(t * b.wy + b.py)) * h, r, r2: r * r };
    });
    const n = B.length, K = Math.max(1.2, 0.09 * Math.min(h, w * 0.35)), far = 7 * K;
    let o = 0;
    for (let y = 0; y < h; y++) {
      const hz = bgy[y];
      for (let x = 0; x < w; x++, o += 4) {
        // smooth union of circles: distance to the blob edge (D, negative inside), its direction and
        // the local blob size, blended where blobs meet so they melt into each other
        let sw = 0, gx = 0, gy = 0, rr = 0;
        for (let i = 0; i < n; i++) {
          const b = B[i], dx = x - b.x, dy = y - b.y, dist = Math.sqrt(dx * dx + dy * dy) + 1e-4, di = dist - b.r;
          if (di > far) continue;
          const e = Math.exp(-di / K);
          sw += e; gx += e * dx / dist; gy += e * dy / dist; rr += e * b.r;
        }
        let R = bgx[x * 3], G = bgx[x * 3 + 1], Bl = bgx[x * 3 + 2];
        R += (HAZE[0] - R) * hz; G += (HAZE[1] - G) * hz; Bl += (HAZE[2] - Bl) * hz;
        if (sw > 0) {
          const D = -K * Math.log(sw), a = Math.min(1, Math.max(0, 0.5 - D / 1.1));
          if (a > 0) {
            gx /= sw; gy /= sw; rr /= sw;
            const gm = Math.hypot(gx, gy) || 1, depth = Math.max(0, -D) / Math.max(1, rr);
            // like a sphere: the surface faces sideways at the edge and straight out at the middle
            const side = Math.max(0, 1 - depth) ** 1.15, nx = (gx / gm) * side, ny = (gy / gm) * side, nz = Math.sqrt(Math.max(0, 1 - side * side));
            let cr = AMB[0], cg = AMB[1], cb = AMB[2];
            for (let j = 0; j < LIGHTS.length; j++) {
              const L = LIGHTS[j], dd = Math.max(0, nx * L.d[0] + ny * L.d[1] + nz * L.d[2]) * L.k;
              cr += L.c[0] * dd; cg += L.c[1] * dd; cb += L.c[2] * dd;
            }
            const sp = Math.pow(Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]), 18) * 55; // soft satin sheen
            R += (Math.min(255, cr * 0.74 + sp) - R) * a;
            G += (Math.min(255, cg * 0.74 + sp) - G) * a;
            Bl += (Math.min(255, cb * 0.74 + sp) - Bl) * a;
          }
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
