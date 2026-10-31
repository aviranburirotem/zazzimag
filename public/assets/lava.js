// Lava strip at the top of the home page: soft 3D blobs heaped along the bottom, bubbling up,
// merging and splitting, with small spheres floating in the air. Colours come from the lead article
// (data-colors, set by the build). The headline (if any) sits on top as normal page text.
// Drawn by the graphics card (WebGL) at the screen's full sharpness; browsers without WebGL get a
// lighter drawing on a smaller canvas. Stops when off screen, when the tab is hidden, with the pause
// button, or with "Stop animations" / reduced motion (then a still frame is shown).
(() => {
  const box = document.querySelector("[data-lava]");
  if (!box) return;
  const cv = box.querySelector("canvas"), btn = box.querySelector("[data-lava-pause]");
  let WORDS = {}; try { WORDS = JSON.parse(document.getElementById("zz-ui")?.textContent || "{}"); } catch {}
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  let C = {}; try { C = JSON.parse(box.dataset.colors || "{}"); } catch {}
  const col = (k, d) => hex(/^#[0-9a-f]{6}$/i.test(C[k] || "") ? C[k] : d);
  // backdrop: left → right, and a little lighter towards the top
  const BG_L = col("bgL", "#b768d8"), BG_R = col("bgR", "#7cb6ea"), HAZE = col("haze", "#e9dcff");
  const norm = (v) => { const m = Math.hypot(...v); return v.map((x) => x / m); };
  const LIGHTS = [
    { d: norm([0.85, -0.35, 0.5]), c: col("key", "#3fd2ff"), k: 0.9 },   // main colour, from the right
    { d: norm([-0.85, -0.25, 0.5]), c: col("side", "#e24bd2"), k: 0.85 }, // a neighbouring colour, from the left
    { d: norm([0, -0.85, 0.55]), c: col("top", "#cfc4ff"), k: 0.22 },    // soft top light
    { d: norm([0.2, 0.9, 0.4]), c: col("warm", "#ffad85"), k: 0.4 },     // bounce from below
  ];
  const AMB = col("amb", "#1a0c40"), HV = norm([0.3, -0.6, 1.4]);
  const still = () => document.documentElement.classList.contains("a11y-still") || matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- the blobs (sizes and places in CSS pixels) ----
  let W = 0, H = 0, blobs = [];
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
    ].slice(0, 48);
  }
  const at = (t) => blobs.map((b) => ({
    x: (b.x + b.ax * Math.sin(t * b.wx + b.px)) * W,
    y: (b.y + b.ay * Math.sin(t * b.wy + b.py)) * H,
    r: b.r * (1 + b.ar * Math.sin(t * b.wr + b.pr)),
  }));
  const softness = () => Math.max(1.2, 0.09 * Math.min(H, W * 0.35)); // how wide the melted joins between blobs are

  // ---- drawing with the graphics card: every screen pixel, so edges stay crisp ----
  function makeGL() {
    const gl = cv.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
    if (!gl) return null;
    const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const fs = `precision highp float;
      uniform vec2 res;uniform float dpr,K;uniform vec3 b[48];uniform int n;
      uniform vec3 bgL,bgR,haze,amb,hv;uniform vec3 lc[4];uniform vec3 ld[4];uniform float lk[4];
      void main(){
        vec2 q=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y)/dpr, R=res/dpr;
        vec3 c=mix(bgL,bgR,q.x/R.x);
        c=mix(c,haze,.32*pow(1.-q.y/R.y,2.));
        float sw=0.,rr=0.;vec2 g=vec2(0.);float far=7.*K;
        for(int i=0;i<48;i++){ if(i>=n) break;
          vec2 d=q-b[i].xy;float dist=length(d)+1e-4,di=dist-b[i].z;
          if(di>far) continue;
          float e=exp(-di/K);sw+=e;g+=e*d/dist;rr+=e*b[i].z;}
        if(sw>0.){
          float D=-K*log(sw), a=clamp(.5-D*dpr,0.,1.);
          if(a>0.){
            g/=sw;rr/=sw;
            float side=pow(max(0.,1.-max(0.,-D)/max(1.,rr)),1.15);
            vec3 nn=vec3(normalize(g+1e-6)*side,sqrt(max(0.,1.-side*side)));
            vec3 s=amb;
            for(int j=0;j<4;j++) s+=lc[j]*max(0.,dot(nn,ld[j]))*lk[j];
            float sp=pow(max(0.,dot(nn,hv)),18.)*(55./255.);
            c=mix(c,min(vec3(1.),s*.74+sp),a);
          }
        }
        gl_FragColor=vec4(c,1.);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (name) => gl.getUniformLocation(pr, name);
    const c3 = (rgb) => rgb.map((x) => x / 255);
    gl.uniform3fv(U("bgL"), c3(BG_L)); gl.uniform3fv(U("bgR"), c3(BG_R)); gl.uniform3fv(U("haze"), c3(HAZE)); gl.uniform3fv(U("amb"), c3(AMB)); gl.uniform3fv(U("hv"), HV);
    gl.uniform3fv(U("lc"), LIGHTS.flatMap((l) => c3(l.c))); gl.uniform3fv(U("ld"), LIGHTS.flatMap((l) => l.d)); gl.uniform1fv(U("lk"), LIGHTS.map((l) => l.k));
    const uRes = U("res"), uDpr = U("dpr"), uK = U("K"), uB = U("b"), uN = U("n");
    const arr = new Float32Array(48 * 3);
    let dpr = 1;
    return {
      size() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
        gl.viewport(0, 0, cv.width, cv.height);
      },
      draw(t) {
        const B = at(t);
        B.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.r; });
        gl.uniform2f(uRes, cv.width, cv.height); gl.uniform1f(uDpr, dpr); gl.uniform1f(uK, softness());
        gl.uniform3fv(uB, arr); gl.uniform1i(uN, B.length);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  // ---- fallback without WebGL: a smaller drawing, scaled up ----
  function makeCPU() {
    const ctx = cv.getContext("2d", { alpha: false });
    let S = 0.5, img = null;
    return {
      size() {
        S = W < 600 ? 0.6 : 0.45;
        cv.width = Math.max(40, Math.round(W * S)); cv.height = Math.max(20, Math.round(H * S));
        img = ctx.createImageData(cv.width, cv.height);
      },
      draw(t) {
        const w = cv.width, h = cv.height, d = img.data, B = at(t).map((p) => ({ x: p.x * S, y: p.y * S, r: p.r * S }));
        const K = softness() * S, far = 7 * K;
        let o = 0;
        for (let y = 0; y < h; y++) {
          const hz = 0.32 * (1 - y / (h - 1 || 1)) ** 2;
          for (let x = 0; x < w; x++, o += 4) {
            let sw = 0, gx = 0, gy = 0, rr = 0;
            for (const b of B) {
              const dx = x - b.x, dy = y - b.y, dist = Math.sqrt(dx * dx + dy * dy) + 1e-4, di = dist - b.r;
              if (di > far) continue;
              const e = Math.exp(-di / K); sw += e; gx += e * dx / dist; gy += e * dy / dist; rr += e * b.r;
            }
            const k = x / (w - 1 || 1);
            let R = BG_L[0] + (BG_R[0] - BG_L[0]) * k, G = BG_L[1] + (BG_R[1] - BG_L[1]) * k, Bl = BG_L[2] + (BG_R[2] - BG_L[2]) * k;
            R += (HAZE[0] - R) * hz; G += (HAZE[1] - G) * hz; Bl += (HAZE[2] - Bl) * hz;
            if (sw > 0) {
              const D = -K * Math.log(sw), a = Math.min(1, Math.max(0, 0.5 - D / 1.1));
              if (a > 0) {
                gx /= sw; gy /= sw; rr /= sw;
                const gm = Math.hypot(gx, gy) || 1, side = Math.max(0, 1 - Math.max(0, -D) / Math.max(1, rr)) ** 1.15;
                const nx = (gx / gm) * side, ny = (gy / gm) * side, nz = Math.sqrt(Math.max(0, 1 - side * side));
                let cr = AMB[0], cg = AMB[1], cb = AMB[2];
                for (const L of LIGHTS) { const dd = Math.max(0, nx * L.d[0] + ny * L.d[1] + nz * L.d[2]) * L.k; cr += L.c[0] * dd; cg += L.c[1] * dd; cb += L.c[2] * dd; }
                const sp = Math.pow(Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]), 18) * 55;
                R += (Math.min(255, cr * 0.74 + sp) - R) * a; G += (Math.min(255, cg * 0.74 + sp) - G) * a; Bl += (Math.min(255, cb * 0.74 + sp) - Bl) * a;
              }
            }
            d[o] = R; d[o + 1] = G; d[o + 2] = Bl; d[o + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
      },
    };
  }

  let R = makeGL(), gpu = !!R;
  if (!R) R = makeCPU();
  function size() {
    const r = box.getBoundingClientRect();
    const dprNow = Math.min(2, window.devicePixelRatio || 1);
    if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1 && dprNow === size.dpr) return;
    W = r.width; H = r.height; size.dpr = dprNow;
    R.size(); make();
  }

  let userPaused = false, paused = still(), seen = true, raf = 0, last = 0, t = rnd(0, 100);
  function loop(now) {
    raf = 0;
    if (paused || !seen || document.hidden) return;
    const minGap = gpu ? 0 : 33; // the graphics card draws every frame; the fallback about 30 a second
    if (now - last > minGap) { t += Math.min(0.1, (now - last) / 1000 || 0.016); last = now; R.draw(t); }
    raf = requestAnimationFrame(loop);
  }
  const run = () => { if (!raf && !paused) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const setPaused = (p) => {
    paused = p;
    if (btn) { btn.setAttribute("aria-pressed", String(p)); btn.setAttribute("aria-label", p ? WORDS["ui.playAnimation"] || "Play the animation" : WORDS["ui.pauseAnimation"] || "Pause the animation"); }
    if (!p) run();
  };
  size(); R.draw(t); box.classList.add("on"); setPaused(paused);
  new ResizeObserver(() => { size(); R.draw(t); }).observe(box);
  if ("IntersectionObserver" in window) new IntersectionObserver(([en]) => { seen = en.isIntersecting; run(); }).observe(box);
  document.addEventListener("visibilitychange", run);
  btn?.addEventListener("click", () => { userPaused = !paused; setPaused(userPaused || still()); });
  // "Stop animations" in the accessibility menu
  new MutationObserver(() => setPaused(userPaused || still()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
})();
