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
    modal.hidden = false;
    modal.querySelector(".x").focus();
  }
  const close = () => { if (modal) { modal.hidden = true; modal.innerHTML = ""; } };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-ig]");
    if (t) { openPost(+t.dataset.ig); return; }
    if (e.target === modal || e.target.closest(".x")) close();

    const chip = e.target.closest("[data-filter]");
    if (chip) {
      const cat = chip.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      document.querySelectorAll("[data-cat]").forEach((el) => { el.hidden = !(cat === "All" || el.dataset.cat === cat); });
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

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
