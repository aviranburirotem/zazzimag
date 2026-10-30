// Zazzi site script: live Instagram feed, post viewer, article filters, contact form.
(() => {
  const HANDLE = document.body.dataset.handle || "zazzimag";
  const FOLLOW = document.body.dataset.follow || "Follow";
  const IG_URL = `https://www.instagram.com/${HANDLE}/`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const firstLine = (s) => (s || "").split("\n")[0];
  let posts = [];
  // Lucide icons (lucide.dev, ISC)
  const svg = (inner, extra = "") => `<svg class="ic"${extra} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const IC = {
    instagram: svg('<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    play: svg('<polygon points="5 3 19 12 5 21 5 3"/>'),
    out: svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
  };
  // Respect reduced-motion for the animated logo
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) document.querySelectorAll("video.logo-vid").forEach((v) => { v.removeAttribute("autoplay"); v.pause(); });

  // ---- feed ----
  const slots = [...document.querySelectorAll(".ig-slot")];
  const strip = document.querySelector("[data-ig-strip]");

  if (slots.length || strip) {
    fetch("/api/instagram/", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => { posts = data.posts || []; render(); })
      .catch(() => { posts = []; render(); });
  }

  function igTile(p, i) {
    return `<button class="tile ig" type="button" data-ig="${i}" aria-label="Open Instagram post">
      <div class="ph"><img src="${esc(p.image)}" alt="${esc(firstLine(p.caption).slice(0, 120) || "Instagram post by @" + HANDLE)}" loading="lazy">${p.type === "VIDEO" ? `<span class="play" aria-hidden="true">${IC.play}</span>` : ""}</div>
      <p class="ig-cap"><span class="ig-ic" aria-hidden="true">${IC.instagram}</span><span class="cap">${esc(firstLine(p.caption))}</span></p></button>`;
  }

  // Posts made with a white frame keep it (the logo sits near its edge), but the text under the tile is
  // indented to start where the photo inside the frame starts. The photo is read through /api/ig-img/
  // because browsers only allow reading pixels from our own site.
  function trimFrame(img) {
    const src = img.getAttribute("src");
    if (!src || img.dataset.trim) return;
    img.dataset.trim = "1";
    const cap = img.closest(".tile")?.querySelector(".ig-cap");
    if (!cap) return;
    const pic = new Image();
    pic.onload = () => {
      try {
        const W = pic.naturalWidth, H = pic.naturalHeight, s = 160 / Math.max(W, H);
        const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(W * s)); c.height = Math.max(1, Math.round(H * s));
        const x = c.getContext("2d"); x.drawImage(pic, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const white = (px, py) => { const i = (py * c.width + px) * 4; return d[i] > 238 && d[i + 1] > 238 && d[i + 2] > 238; };
        const rowWhite = (py) => { let n = 0; for (let px = 0; px < c.width; px++) n += white(px, py); return n / c.width > 0.97; };
        const colWhite = (px) => { let n = 0; for (let py = 0; py < c.height; py++) n += white(px, py); return n / c.height > 0.97; };
        let t = 0, b = c.height - 1, l = 0, r = c.width - 1;
        while (t < b && rowWhite(t)) t++;
        while (b > t && rowWhite(b)) b--;
        while (l < r && colWhite(l)) l++;
        while (r > l && colWhite(r)) r--;
        const L = l / c.width, R = (c.width - 1 - r) / c.width, T = t / c.height, B = (c.height - 1 - b) / c.height;
        // only a real frame: white on both sides (left and right, or top and bottom), about evenly
        const framed = (L > 0.02 && R > 0.02 && Math.abs(L - R) < 0.03) || (T > 0.02 && B > 0.02 && Math.abs(T - B) < 0.03);
        if (!framed || (r - l) < c.width * 0.4 || (b - t) < c.height * 0.4) return;
        // where the photo's left and right edges fall in the tile (a 4:5 box the picture covers), as a share of its width
        const ph = img.closest(".ph"), box = ph ? ph.clientHeight / ph.clientWidth : 1.25;
        const k = Math.max(1 / W, box / H), shown = W * k, off = (shown - 1) / 2;
        const left = Math.max(0, (l + 1) / c.width * shown - off), right = Math.max(0, (c.width - r) / c.width * shown - off);
        cap.style.paddingLeft = `${(left * 100).toFixed(2)}%`;
        cap.style.paddingRight = `${(right * 100).toFixed(2)}%`;
      } catch {}
    };
    pic.src = "/api/ig-img/?u=" + encodeURIComponent(src);
  }

  function render() {
    slots.forEach((slot, i) => {
      if (posts[i]) slot.outerHTML = igTile(posts[i], i);
      else if (i === posts.length) slot.outerHTML = `<a class="tile ig follow-tile" href="${IG_URL}" target="_blank" rel="noopener"><div class="ph"><div>${IC.instagram}<b>${esc(FOLLOW)}<br>@${HANDLE}</b></div></div></a>`;
      else slot.remove();
    });
    document.querySelectorAll(".tile.ig .cap").forEach((el) => window.zzEggify?.(el));
    document.querySelectorAll(".tile.ig:not(.follow-tile) .ph img").forEach(trimFrame);
    if (strip) {
      if (!posts.length) { strip.closest("[data-ig-section]")?.remove(); return; }
      strip.innerHTML = posts.slice(0, 6).map((p, i) =>
        `<button class="tile ig" type="button" data-ig="${i}" aria-label="Open Instagram post"><div class="ph"><img src="${esc(p.image)}" alt="" loading="lazy"></div></button>`).join("");
    }
  }

  // ---- post viewer ----
  const modal = document.getElementById("modal");
  let lastFocus = null;
  function openPost(i) {
    const p = posts[i];
    if (!p || !modal) return;
    const media = p.type === "VIDEO" && p.video
      ? `<video src="${esc(p.video)}" poster="${esc(p.image)}" controls playsinline></video>`
      : `<img src="${esc(p.image)}" alt="">`;
    const date = p.date ? new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Instagram post">
      <div class="ph">${media}</div>
      <div class="txt"><div style="display:flex;align-items:center;gap:10px">${IC.instagram}<b>@${HANDLE}</b><button class="x" type="button" aria-label="Close">${IC.x}</button></div>
      <p>${esc(p.caption)}</p><span class="label">${date}</span>
      <a class="btn" style="margin-top:auto" href="${esc(p.url)}" target="_blank" rel="noopener">View on Instagram ${IC.out}</a></div></div>`;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    modal.querySelector(".x").focus();
  }
  const close = () => {
    if (!modal || modal.hidden) return;
    modal.hidden = true; modal.innerHTML = ""; document.body.style.overflow = "";
    lastFocus?.focus?.();
  };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-ig]");
    if (t) { openPost(+t.dataset.ig); return; }
    if (e.target === modal || e.target.closest(".x")) close();

    const chip = e.target.closest("[data-filter]");
    if (chip) {
      const cat = chip.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      let n = 0;
      document.querySelectorAll("[data-cat]").forEach((el) => { el.hidden = !(cat === "All" || el.dataset.cat.split("|").includes(cat)); if (!el.hidden) n++; });
      const live = document.getElementById("filter-status");
      if (live) live.textContent = `Showing ${n} ${n === 1 ? "story" : "stories"}${cat === "All" ? "" : " in " + cat}`;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); closeA11y(); }
    if (e.key === "Tab" && modal && !modal.hidden) { // keep focus inside the open post
      const f = [...modal.querySelectorAll("a[href],button,video[controls]")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // ---- animated logo: loops continuously. Hovering (or keyboard focus) pauses it; moving away resumes.
  // "Stop animations" in the accessibility menu and the device's reduce-motion setting keep it still.
  const logos = [...document.querySelectorAll("video.logo-vid")];
  // Dark theme (lights off): switch to the version of the animation with a dark background (videos can't be transparent).
  // High-contrast mode forces a white page, so it keeps the light version.
  const isDark = () => document.documentElement.dataset.theme === "dark";
  const pickLogo = () => logos.forEach((v) => {
    const want = isDark() && !document.documentElement.classList.contains("a11y-contrast") ? v.dataset.dark : v.dataset.light;
    if (!want || v.currentSrc.endsWith(want) || v.getAttribute("src") === want) return;
    const t = v.currentTime, paused = v.paused;
    v.src = want;
    v.addEventListener("loadedmetadata", () => { try { v.currentTime = t; } catch {} if (!paused && !still()) v.play().catch(() => {}); }, { once: true });
  });
  pickLogo();

  // ---- the light switch (home page): flip to turn the lights off / on. Remembered on this device. ----
  const cord = document.getElementById("light-switch");
  const syncCord = () => {
    if (!cord) return;
    const off = isDark();
    cord.setAttribute("aria-pressed", String(off));
    const tip = off ? "Turn on the light" : "Turn off the light";
    cord.setAttribute("aria-label", tip);
    cord.dataset.tip = tip;
  };
  syncCord();
  cord?.addEventListener("click", () => {
    const root = document.documentElement;
    cord.classList.remove("flick"); void cord.offsetWidth; cord.classList.add("flick");
    root.classList.add("theme-fade");
    if (isDark()) delete root.dataset.theme; else root.dataset.theme = "dark";
    try { localStorage.setItem("zz-theme", isDark() ? "dark" : "light"); } catch {}
    syncCord(); pickLogo();
    setTimeout(() => root.classList.remove("theme-fade"), 500);
  });
  const still = () => document.documentElement.classList.contains("a11y-still") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stopLogos = () => logos.forEach((v) => v.pause());
  const playLogos = () => { if (!still()) logos.forEach((v) => v.play().catch(() => {})); };
  logos.forEach((v) => {
    const link = v.closest("a");
    link?.addEventListener("mouseenter", () => v.pause());
    link?.addEventListener("mouseleave", () => { if (!still()) v.play().catch(() => {}); });
    link?.addEventListener("focus", () => v.pause());
    link?.addEventListener("blur", () => { if (!still()) v.play().catch(() => {}); });
  });

  // ---- home video strip: silent, always looping, part of the page ----
  // Loads only when it scrolls into view, pauses when off screen, and stays still with
  // "Stop animations", the device's reduce-motion setting or Data Saver. The small button pauses it.
  const vid = document.querySelector(".vstrip video");
  const stripBtn = document.querySelector(".vstrip-btn");
  let stripInView = false, stripChoice = null; // null = automatic, "play" / "pause" = the visitor pressed the button
  const saveData = () => Boolean(navigator.connection && navigator.connection.saveData);
  const stripWants = () => stripChoice ? stripChoice === "play" : !still() && !saveData();
  function syncStrip() {
    if (!vid) return;
    if (stripInView && !document.hidden && stripWants()) vid.play().catch(() => {}); else vid.pause();
    if (stripBtn) {
      const paused = !stripWants();
      stripBtn.classList.toggle("is-paused", paused);
      stripBtn.setAttribute("aria-pressed", String(paused));
      stripBtn.setAttribute("aria-label", paused ? "Play video" : "Pause video");
    }
  }
  if (vid) {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { stripInView = es.some((e) => e.isIntersecting); syncStrip(); }, { rootMargin: "200px 0px" }).observe(vid);
    } else stripInView = true;
    document.addEventListener("visibilitychange", syncStrip);
    stripBtn?.addEventListener("click", () => { stripChoice = stripWants() ? "pause" : "play"; syncStrip(); });
    syncStrip();
  }

  // ---- accessibility menu (Israeli Standard 5568) ----
  const KEY = "zz-a11y";
  const OPTS = { "a11y-text": "Larger text", "a11y-contrast": "High contrast", "a11y-links": "Highlight links", "a11y-font": "Readable font", "a11y-still": "Stop animations" };
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
  const apply = () => {
    for (const k of Object.keys(OPTS)) document.documentElement.classList.toggle(k, Boolean(prefs[k]));
    if (prefs["a11y-still"]) stopLogos(); else playLogos();
    stripChoice = null; syncStrip();
    pickLogo();
    document.querySelectorAll("[data-a11y]").forEach((b) => b.setAttribute("aria-pressed", String(Boolean(prefs[b.dataset.a11y]))));
  };
  const panel = document.getElementById("a11y-panel"), toggle = document.getElementById("a11y-toggle");
  function closeA11y() { if (panel && !panel.hidden) { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); toggle.focus(); } }
  if (panel && toggle) {
    panel.querySelector(".a11y-opts").innerHTML = Object.entries(OPTS).map(([k, label]) => `<button type="button" data-a11y="${k}" aria-pressed="false">${label}</button>`).join("") + `<button type="button" data-a11y-reset>Reset</button>`;
    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open; toggle.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector("button").focus();
    });
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a11y]");
      if (b) prefs[b.dataset.a11y] = !prefs[b.dataset.a11y];
      if (e.target.closest("[data-a11y-reset]")) prefs = {};
      if (e.target.closest("[data-a11y-close]")) return closeA11y();
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
      apply();
    });
  }
  apply();

  // ---- prices: shown in the visitor's currency (₪, ¥, ₩, € or $), rounded ----
  // ---- number easter eggs ----
  // In every number on the site, one digit has a trick that plays when you point at the number:
  // 0 blinks · 1, 6 and 7 jump · 2 and 9 wobble · 3 boings · 4 leans · 5 spins · 8 squishes. Nothing flips into another digit.
  // It also changes colour. In prices that digit is a zero when possible, and it blinks by itself. Now and then a random number hops.
  // Screen readers get the plain text; motion stops with "Stop animations" or the device's reduce-motion setting.
  const COLORS = ["#e30613", "#1a3fbf", "#f2a900", "#00a86b", "#ff4fa3", "#7a3cff"];
  const escT = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  // One digit per number gets the trick, except a pair of zeros ("00"), which act together as a pair of eyes.
  // In prices a zero is picked when there is one (a "00" pair first), so it can blink.
  const digitHtml = (text, blink) => escT(text).replace(/[0-9]+(?:[.,][0-9]+)*/g, (num) => {
    const idx = [...num].map((ch, i) => (/[0-9]/.test(ch) ? i : -1)).filter((i) => i >= 0);
    const zeros = idx.filter((i) => num[i] === "0");
    const pairs = zeros.filter((i) => num[i + 1] === "0");
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    let pick = blink ? (pairs.length ? rnd(pairs) : zeros.length ? rnd(zeros) : rnd(idx)) : rnd(idx);
    const active = new Set([pick]);
    if (num[pick] === "0") {
      if (num[pick + 1] === "0") active.add(pick + 1);
      else if (num[pick - 1] === "0") active.add(pick - 1);
    }
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    const delay = (Math.random() * 4).toFixed(2);
    const out = [...num].map((ch, i) => {
      if (!active.has(i)) return ch;
      const z = blink && ch === "0" ? ` z0" style="--c:${c}; animation-delay:${delay}s;"` : `" style="--c:${c};"`;
      return `<span class="d d${ch}${z}>${ch}</span>`;
    }).join("");
    return `<span class="ng">${out}</span>`;
  });
  // prices: plain text for screen readers + decorated copy
  function eggify(el) {
    const text = el.textContent;
    el.innerHTML = `<span class="sr">${escT(text)}</span><span aria-hidden="true">${digitHtml(text, true)}</span>`;
  }
  // everything else: wrap digits in text nodes
  const SKIP = "script,style,textarea,input,select,option,svg,code,pre,.sr,[data-ils],.a11y,[aria-hidden='true'],title";
  function eggifyTree(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/[0-9]/.test(n.nodeValue) && !n.parentElement.closest(SKIP) && !n.parentElement.classList.contains("d") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const wrap = document.createElement("span");
      wrap.className = "num";
      wrap.innerHTML = `<span class="sr">${escT(node.nodeValue)}</span><span aria-hidden="true">${digitHtml(node.nodeValue, false)}</span>`;
      node.replaceWith(wrap);
    });
  }
  window.zzEggify = eggifyTree;
  eggifyTree(document.querySelector(".site-header"));
  eggifyTree(document.getElementById("main"));
  eggifyTree(document.querySelector(".site-footer"));

  // now and then, a random number on screen does a little hop
  setInterval(() => {
    if (still() || document.hidden) return;
    const visible = [...document.querySelectorAll(".d")].filter((d) => { const r = d.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight && r.width; });
    const d = visible[Math.floor(Math.random() * visible.length)];
    if (!d) return;
    d.classList.add("pop");
    setTimeout(() => d.classList.remove("pop"), 900);
  }, 9000);

  const prices = document.querySelectorAll("[data-ils]");
  prices.forEach(eggify);
  if (prices.length) {
    const STEP = { ILS: 1, USD: 1, EUR: 1, JPY: 10, KRW: 100 };
    const show = ({ currency, rate }) => {
      if (!currency || !rate) return;
      const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0, currencyDisplay: "narrowSymbol" });
      prices.forEach((el) => {
        const ils = Number(el.dataset.ils);
        if (!ils) return;
        const step = STEP[currency] || 1;
        el.textContent = fmt.format(Math.max(step, Math.round((ils * rate) / step) * step));
        el.dataset.currency = currency;
        eggify(el);
      });
    };
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem("zz-geo") || "null"); } catch {}
    if (cached) show(cached);
    else fetch("/api/geo").then((r) => r.json()).then((g) => { try { sessionStorage.setItem("zz-geo", JSON.stringify(g)); } catch {} show(g); }).catch(() => {});
  }

  // ---- contact + store forms: open the visitor's email app with the message filled in ----
  document.querySelectorAll("form[data-mailto]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const subject = form.dataset.subject || `${f.get("topic") || "Message"} from ${f.get("name") || "website"}`;
      const body = [...f.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
      location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      form.querySelector(".ok")?.removeAttribute("hidden");
    });
  });
})();
