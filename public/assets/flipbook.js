// Zazzi flipbook: a magazine you turn page by page.
// Computers and tablets: two-page spreads that turn like real pages.
// Phones: one page at a time, turning away to the left.
// Turn with the buttons, by clicking a page, with the arrow keys, or by swiping.
// Used on issue pages, and in a popup when an issue tile is clicked (home and All articles).
(() => {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const face = (p, side, i) => `<div class="face ${side}">${p ? `<img src="${esc(p.image)}" alt="${esc(p.alt || `Page ${i + 1}`)}" ${i > 3 ? 'loading="lazy"' : ""} draggable="false">` : ""}</div>`;

  function mount(root, pages) {
    if (!root || !pages || !pages.length) return { destroy() {} };
    const book = root.querySelector(".fb-book");
    const count = root.querySelector(".fb-count");
    const caption = root.querySelector(".fb-caption");
    const prevBtn = root.querySelector('[data-fb="prev"]');
    const nextBtn = root.querySelector('[data-fb="next"]');
    let mode = "", leaves = [], flipped = 0; // flipped = number of leaves turned

    const isDouble = () => matchMedia("(min-width: 760px)").matches;
    const total = () => leaves.length;
    // last position: on spreads, stop when the final page is showing (no empty spread at the end)
    const max = () => (mode === "double" ? Math.floor(pages.length / 2) : total() - 1);

    function build() {
      // keep the reader on the same page when switching between phone and computer layouts
      const page = mode === "double" ? Math.max(0, flipped * 2 - 1) : flipped;
      mode = isDouble() ? "double" : "single";
      root.classList.toggle("fb-double", mode === "double");
      root.classList.toggle("fb-single", mode === "single");
      if (mode === "double") {
        const n = Math.ceil(pages.length / 2);
        book.innerHTML = Array.from({ length: n }, (_, i) =>
          `<div class="leaf">${face(pages[2 * i], "front", 2 * i)}${face(pages[2 * i + 1], "back", 2 * i + 1)}</div>`).join("");
        flipped = Math.min(Math.ceil(page / 2), Math.floor(pages.length / 2));
      } else {
        book.innerHTML = pages.map((p, i) => `<div class="leaf">${face(p, "front", i)}</div>`).join("");
        flipped = Math.min(page, pages.length - 1);
      }
      leaves = [...book.children];
      root.classList.add("fb-instant");
      render();
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("fb-instant")));
    }

    function render(moving = -1) {
      const n = total();
      leaves.forEach((leaf, i) => {
        const isFlipped = i < flipped;
        leaf.classList.toggle("flipped", isFlipped);
        leaf.style.zIndex = i === moving ? n + 2 : isFlipped ? i + 1 : n - i;
        const visible = mode === "double" ? i === flipped || i === flipped - 1 : i === flipped;
        leaf.setAttribute("aria-hidden", String(!visible));
      });
      book.classList.toggle("at-start", mode === "double" && flipped === 0);
      book.classList.toggle("at-end", mode === "double" && flipped === n);
      prevBtn.disabled = flipped === 0;
      nextBtn.disabled = flipped >= max();
      const shown = mode === "double" ? [flipped * 2 - 1, flipped * 2].filter((p) => p >= 0 && p < pages.length) : [flipped];
      count.textContent = shown.length === 2 ? `${shown[0] + 1}–${shown[1] + 1} / ${pages.length}` : `${shown[0] + 1} / ${pages.length}`;
      caption.textContent = shown.map((p) => pages[p].caption).filter(Boolean).join("  ·  ");
      shown.forEach((p) => [p + 1, p + 2].forEach((q) => { if (pages[q]) new Image().src = pages[q].image; }));
    }

    function go(delta) {
      const target = Math.max(0, Math.min(max(), flipped + delta));
      if (target === flipped) return;
      const moving = delta > 0 ? flipped : flipped - 1;
      flipped = target;
      render(moving);
    }

    const onPrev = () => go(-1), onNext = () => go(1);
    prevBtn.addEventListener("click", onPrev);
    nextBtn.addEventListener("click", onNext);

    let x0 = null, moved = false;
    book.addEventListener("click", (e) => {
      if (moved) return;
      const r = book.getBoundingClientRect();
      go(e.clientX > r.left + r.width / 2 || (mode === "single" && e.clientX > r.left + r.width * 0.33) ? 1 : -1);
    });
    book.addEventListener("pointerdown", (e) => { x0 = e.clientX; moved = false; });
    book.addEventListener("pointermove", (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 10) moved = true; });
    book.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      setTimeout(() => (moved = false), 0);
    });
    book.addEventListener("pointercancel", () => (x0 = null));

    const onKey = (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
    };
    document.addEventListener("keydown", onKey);
    let resizeT;
    const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if ((isDouble() ? "double" : "single") !== mode) build(); }, 150); };
    addEventListener("resize", onResize);

    build();
    return { destroy() { document.removeEventListener("keydown", onKey); removeEventListener("resize", onResize); } };
  }

  // ---- issue page ----
  const pageRoot = document.querySelector("[data-flipbook]");
  if (pageRoot) {
    let pages = [];
    try { pages = JSON.parse(pageRoot.querySelector(".fb-data").textContent); } catch {}
    mount(pageRoot, pages);
  }

  // ---- popup: clicking an issue tile opens the magazine over the page ----
  const tiles = document.querySelectorAll("a[data-issue]");
  if (!tiles.length) return;
  let dataP = null, current = null, lastFocus = null, startUrl = null;
  const loadData = () => (dataP ||= fetch("/issues/data.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))));
  const t = document.body.dataset;
  const tpl = document.getElementById("fb-icons")?.content;
  const ico = (c, fallback) => tpl?.querySelector(c)?.innerHTML || fallback;

  const overlay = document.createElement("div");
  overlay.className = "fb-modal";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="fb-modal-inner" role="dialog" aria-modal="true" aria-labelledby="fb-modal-title">
    <div class="fb-modal-top">
      <div><span class="label fb-modal-kind"></span><h2 id="fb-modal-title"></h2></div>
      <button class="fb-close" type="button" aria-label="Close">${ico(".x", "×")}</button>
    </div>
    <section class="flipbook in-modal" aria-roledescription="flip-through magazine">
      <div class="fb-stage"><div class="fb-book"></div></div>
      <div class="fb-controls">
        <button class="fb-btn" type="button" data-fb="prev" aria-label="Previous page">${ico(".l", "‹")}</button>
        <span class="fb-count label" aria-live="polite"></span>
        <button class="fb-btn" type="button" data-fb="next" aria-label="Next page">${ico(".r", "›")}</button>
      </div>
      <p class="fb-caption"></p>
    </section>
  </div>`;
  document.body.append(overlay);

  function close(fromHistory) {
    if (overlay.hidden) return;
    current?.destroy(); current = null;
    overlay.hidden = true;
    document.documentElement.classList.remove("fb-lock");
    if (!fromHistory && startUrl !== null && history.state?.zzIssue) history.back();
    startUrl = null;
    lastFocus?.focus?.();
  }

  async function open(slug, tile) {
    let data;
    try { data = (await loadData())[slug]; } catch {}
    if (!data || !data.pages?.length) { location.href = tile.href; return; } // fall back to the issue page
    lastFocus = tile;
    overlay.querySelector("#fb-modal-title").textContent = data.title;
    overlay.querySelector(".fb-modal-kind").textContent = `${t.issueLabel || "Issue"} · ${data.pagesLabel || ""}`;
    overlay.querySelector(".fb-modal-inner").setAttribute("aria-label", data.title);
    // fresh controls each time (listeners from the last issue are dropped with them)
    const fb = overlay.querySelector(".flipbook");
    const fresh = fb.cloneNode(true);
    fb.replaceWith(fresh);
    overlay.hidden = false;
    document.documentElement.classList.add("fb-lock");
    current = mount(fresh, data.pages);
    startUrl = location.href;
    try { history.pushState({ zzIssue: slug }, "", tile.getAttribute("href")); } catch {}
    overlay.querySelector(".fb-close").focus();
  }

  tiles.forEach((tile) => tile.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let "open in new tab" work
    e.preventDefault();
    open(tile.dataset.issue, tile);
  }));
  overlay.addEventListener("click", (e) => { if (e.target === overlay || e.target.closest(".fb-close")) close(); });
  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Tab") { // keep focus inside the popup
      const f = [...overlay.querySelectorAll("button:not(:disabled)")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener("popstate", () => { if (!overlay.hidden) close(true); });
})();
