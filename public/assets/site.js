// Zazzi site script: live Instagram feed, post viewer, article filters, contact form.
(() => {
  const HANDLE = "zazzimag";
  const IG_URL = `https://www.instagram.com/${HANDLE}/`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const firstLine = (s) => (s || "").split("\n")[0];
  const tagsOf = (s) => ((s || "").match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 3).join(" ");
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
      <div class="ph"><img src="${esc(p.image)}" alt="${esc(firstLine(p.caption).slice(0, 120) || "Instagram post by @" + HANDLE)}" loading="lazy"><span class="badge">IG</span>${p.type === "VIDEO" ? '<span class="play" aria-hidden="true">${IC.play}</span>' : ""}</div>
      <p class="cap">${esc(firstLine(p.caption))}</p><span class="label">${esc(tagsOf(p.caption))}</span></button>`;
  }

  function render() {
    slots.forEach((slot, i) => {
      if (posts[i]) slot.outerHTML = igTile(posts[i], i);
      else if (i === posts.length) slot.outerHTML = `<a class="tile ig follow-tile" href="${IG_URL}" target="_blank" rel="noopener"><div class="ph"><div>${IC.instagram}<b>Follow<br>@${HANDLE}</b></div></div></a>`;
      else slot.remove();
    });
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

  // ---- animated logo: plays for 5 seconds, then stops (WCAG 2.2.2). Hover or focus replays it. ----
  const logos = [...document.querySelectorAll("video.logo-vid")];
  const stopLogos = () => logos.forEach((v) => { v.pause(); });
  logos.forEach((v) => {
    const link = v.closest("a");
    const play = () => { if (!document.documentElement.classList.contains("a11y-still")) v.play().catch(() => {}); };
    link?.addEventListener("mouseenter", play); link?.addEventListener("focus", play);
    link?.addEventListener("mouseleave", () => v.pause()); link?.addEventListener("blur", () => v.pause());
  });
  setTimeout(stopLogos, 5000);

  // ---- accessibility menu (Israeli Standard 5568) ----
  const KEY = "zz-a11y";
  const OPTS = { "a11y-text": "Larger text", "a11y-contrast": "High contrast", "a11y-links": "Highlight links", "a11y-font": "Readable font", "a11y-still": "Stop animations" };
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
  const apply = () => {
    for (const k of Object.keys(OPTS)) document.documentElement.classList.toggle(k, Boolean(prefs[k]));
    if (prefs["a11y-still"]) stopLogos();
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
