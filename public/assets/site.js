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
    fetch("/api/instagram")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => { posts = data.posts || []; render(); })
      .catch(() => { posts = []; render(); });
  }

  function igTile(p, i) {
    return `<button class="tile ig" type="button" data-ig="${i}" aria-label="Open Instagram post">
      <div class="ph"><img src="${esc(p.image)}" alt="${esc(firstLine(p.caption).slice(0, 120) || "Instagram post by @" + HANDLE)}" loading="lazy">${p.type === "VIDEO" ? `<span class="play" aria-hidden="true">${IC.play}</span>` : ""}</div>
      <p class="cap">${esc(firstLine(p.caption))}</p></button>`;
  }

  function render() {
    slots.forEach((slot, i) => {
      if (posts[i]) slot.outerHTML = igTile(posts[i], i);
      else if (i === posts.length) slot.outerHTML = `<a class="tile ig follow-tile" href="${IG_URL}" target="_blank" rel="noopener"><div class="ph"><div>${IC.instagram}<b>${esc(FOLLOW)}<br>@${HANDLE}</b></div></div></a>`;
      else slot.remove();
    });
    document.querySelectorAll(".tile.ig .cap").forEach((el) => window.zzEggify?.(el));
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
      document.querySelectorAll("[data-cat]").forEach((el) => { el.hidden = !(cat === "All" || el.dataset.cat === cat); if (!el.hidden) n++; });
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

  // ---- accessibility menu (Israeli Standard 5568) ----
  const KEY = "zz-a11y";
  const OPTS = { "a11y-text": "Larger text", "a11y-contrast": "High contrast", "a11y-links": "Highlight links", "a11y-font": "Readable font", "a11y-still": "Stop animations" };
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
  const apply = () => {
    for (const k of Object.keys(OPTS)) document.documentElement.classList.toggle(k, Boolean(prefs[k]));
    if (prefs["a11y-still"]) stopLogos(); else playLogos();
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
  // 0 blinks · 1 and 7 jump · 2 wobbles · 3 mirrors · 4 leans · 5 spins · 6 and 9 flip into each other · 8 tips over into ∞
  // It also changes colour. In prices that digit is a zero when possible, and it blinks by itself. Now and then a random number hops.
  // Screen readers get the plain text; motion stops with "Stop animations" or the device's reduce-motion setting.
  const COLORS = ["#e30613", "#1a3fbf", "#f2a900", "#00a86b", "#ff4fa3", "#7a3cff"];
  const escT = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  // One digit per number gets the trick. In prices, a zero is picked when there is one, so it can blink.
  const digitHtml = (text, blink) => escT(text).replace(/[0-9]+(?:[.,][0-9]+)*/g, (num) => {
    const idx = [...num].map((ch, i) => (/[0-9]/.test(ch) ? i : -1)).filter((i) => i >= 0);
    const zeros = idx.filter((i) => num[i] === "0");
    const pick = blink && zeros.length ? zeros[Math.floor(Math.random() * zeros.length)] : idx[Math.floor(Math.random() * idx.length)];
    const d = num[pick], c = COLORS[Math.floor(Math.random() * COLORS.length)];
    const delay = blink && d === "0" ? ` animation-delay:${(Math.random() * 4).toFixed(2)}s;` : "";
    return `<span class="ng">${num.slice(0, pick)}<span class="d d${d}${blink && d === "0" ? " z0" : ""}" style="--c:${c};${delay}">${d}</span>${num.slice(pick + 1)}</span>`;
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
