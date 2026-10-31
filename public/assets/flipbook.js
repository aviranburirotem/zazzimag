// Zazzi flipbook: a magazine you turn page by page.
// Computers and tablets: two-page spreads that turn like real pages.
// Phones: one page at a time, turning away to the left.
// Turn with the buttons, by clicking a page, with the arrow keys, or by swiping.
// Zoom in with the magnifier button, by pinching, with a trackpad pinch, or with + and −.
// Used on issue pages, and in a popup when an issue tile is clicked (home and All articles).
(() => {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let WORDS = {}; try { WORDS = JSON.parse(document.getElementById("zz-ui")?.textContent || "{}"); } catch {}
  // Pages get their photo only when the reader is near them (phones would otherwise load every page at once),
  // and phones get a lighter copy (imageM); zooming in swaps to the full photo.
  const face = (p, side, i) => `<div class="face ${side}">${p ? `<img data-i="${i}" alt="${esc(p.alt || `Page ${i + 1}`)}" draggable="false" decoding="async">` : ""}</div>`;

  function mount(root, pages) {
    if (!root || !pages || !pages.length) return { destroy() {} };
    const book = root.querySelector(".fb-book");
    const count = root.querySelector(".fb-count");
    const caption = root.querySelector(".fb-caption");
    const prevBtn = root.querySelector('[data-fb="prev"]');
    const nextBtn = root.querySelector('[data-fb="next"]');
    let mode = "", leaves = [], flipped = 0; // flipped = number of leaves turned

    // ---- zoom: magnifier button, pinch on touch screens, trackpad pinch / ctrl + scroll ----
    const stage = root.querySelector(".fb-stage");
    const zw = document.createElement("div");
    zw.className = "fb-zoomwrap";
    book.replaceWith(zw); zw.append(book);
    const zoomBtn = root.querySelector('[data-fb="zoom"]');
    const MAXZ = 4;
    let z = 1, tx = 0, ty = 0;
    function applyZoom(anim) {
      const W = zw.offsetWidth, H = zw.offsetHeight;
      tx = Math.min(0, Math.max(W - z * W, tx));
      ty = Math.min(0, Math.max(H - z * H, ty));
      if (anim) { zw.classList.add("fb-anim"); setTimeout(() => zw.classList.remove("fb-anim"), 260); }
      zw.style.transform = z > 1 ? `translate(${tx}px,${ty}px) scale(${z})` : "";
      root.classList.toggle("fb-zoomed", z > 1);
      if ((z > 1) !== fullRes) { fullRes = z > 1; if (leaves.length) hydrate(); } // sharp photo while zoomed
      if (zoomBtn) { zoomBtn.setAttribute("aria-pressed", String(z > 1)); zoomBtn.setAttribute("aria-label", z > 1 ? WORDS["ui.zoomOut"] || "Zoom out" : WORDS["ui.zoomIn"] || "Zoom in"); }
    }
    // zoom to nz, keeping the point under (cx, cy) in place
    function setZoom(nz, cx, cy, anim) {
      nz = Math.min(MAXZ, Math.max(1, nz));
      const r = zw.getBoundingClientRect();
      const bx = r.left - tx, by = r.top - ty; // where the wrapper sits before zooming
      if (cx === undefined) { const s = stage.getBoundingClientRect(); cx = s.left + s.width / 2; cy = s.top + s.height / 2; }
      const px = (cx - bx - tx) / z, py = (cy - by - ty) / z;
      z = nz;
      if (z === 1) { tx = 0; ty = 0; } else { tx = cx - bx - z * px; ty = cy - by - z * py; }
      applyZoom(anim);
    }
    const unzoom = (anim = true) => { if (z > 1) setZoom(1, undefined, undefined, anim); };
    zoomBtn?.addEventListener("click", () => (z > 1 ? unzoom() : setZoom(2.2, undefined, undefined, true)));

    const isDouble = () => matchMedia("(min-width: 760px)").matches;
    const light = () => !isDouble() && !matchMedia("(min-resolution: 2.5dppx) and (min-width: 600px)").matches;
    const srcOf = (i, full) => (!full && light() && pages[i].imageM) || pages[i].image;
    let fullRes = false; // true while zoomed in
    // give photos to the pages around the reader; leaves further away are hidden entirely
    function hydrate() {
      const near = mode === "double" ? (i) => i >= flipped - 2 && i <= flipped + 1 : (i) => i >= flipped - 1 && i <= flipped + 2;
      leaves.forEach((leaf, i) => {
        const on = near(i);
        leaf.classList.toggle("far", !on);
        if (!on) return;
        leaf.querySelectorAll("img[data-i]").forEach((img) => {
          const want = srcOf(+img.dataset.i, fullRes && (i === flipped || i === flipped - 1));
          if (img.getAttribute("src") !== want) img.setAttribute("src", want);
        });
      });
    }
    const total = () => leaves.length;
    // last position: on spreads, stop when the final page is showing (no empty spread at the end)
    const max = () => (mode === "double" ? Math.floor(pages.length / 2) : total() - 1);

    // the book takes the shape of the pages (from the first page), so pages fill it edge to edge
    const first = pages.find((p) => p.w && p.h);
    if (first) root.style.setProperty("--pr", (first.w / first.h).toFixed(4));
    // a page with a different shape is shown whole, and the leftover edge takes the photo's own main colour
    book.addEventListener("load", (e) => {
      const img = e.target; if (img.tagName !== "IMG" || img.dataset.tinted) return;
      img.dataset.tinted = "1";
      const r = img.naturalWidth / img.naturalHeight, want = first ? first.w / first.h : r;
      if (Math.abs(r - want) < 0.01) return; // same shape: fills the page, nothing to colour
      try {
        const c = document.createElement("canvas"); c.width = c.height = 12;
        const x = c.getContext("2d"); x.drawImage(img, 0, 0, 12, 12);
        const d = x.getImageData(0, 0, 12, 12).data; let R = 0, G = 0, B = 0;
        for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
        const n = d.length / 4; img.parentElement.style.background = `rgb(${R / n | 0},${G / n | 0},${B / n | 0})`;
      } catch {}
    }, true);

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
      z = 1; tx = 0; ty = 0; applyZoom(false);
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
      hydrate();
      shown.forEach((p) => [p + 1, p + 2, p + 3].forEach((q) => { if (pages[q]) new Image().src = srcOf(q); })); // warm up the next pages
    }

    function go(delta) {
      const target = Math.max(0, Math.min(max(), flipped + delta));
      if (target === flipped) return;
      unzoom(false);
      const moving = delta > 0 ? flipped : flipped - 1;
      flipped = target;
      render(moving);
    }

    const onPrev = () => go(-1), onNext = () => go(1);
    prevBtn.addEventListener("click", onPrev);
    nextBtn.addEventListener("click", onNext);

    // clicks and swipes turn pages; when zoomed in, dragging moves around the page instead
    let x0 = null, moved = false, pan = null, pinch = null;
    const pts = new Map();
    const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    book.addEventListener("click", (e) => {
      if (moved || z > 1) return;
      const r = book.getBoundingClientRect();
      go(e.clientX > r.left + r.width / 2 || (mode === "single" && e.clientX > r.left + r.width * 0.33) ? 1 : -1);
    });
    book.addEventListener("pointerdown", (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const g = two(); pinch = { d: g.d, z }; x0 = null; pan = null; moved = true; return; }
      if (pts.size > 2) return;
      moved = false;
      if (z > 1) { pan = { x: e.clientX, y: e.clientY, tx, ty }; root.classList.add("fb-panning"); try { book.setPointerCapture(e.pointerId); } catch {} }
      else x0 = e.clientX;
    });
    book.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) { const g = two(); setZoom(pinch.z * (g.d / pinch.d), g.x, g.y); return; }
      if (pan) {
        const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        tx = pan.tx + dx; ty = pan.ty + dy; applyZoom(false);
        return;
      }
      if (x0 !== null && Math.abs(e.clientX - x0) > 10) moved = true;
    });
    const endPointer = (e) => {
      pts.delete(e.pointerId);
      if (pinch && pts.size < 2) { pinch = null; if (z < 1.08) unzoom(); }
      if (!pts.size) { pan = null; root.classList.remove("fb-panning"); }
      if (x0 === null) { setTimeout(() => (moved = false), 0); return; }
      const dx = e.clientX - x0; x0 = null;
      if (e.type === "pointerup" && z === 1 && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      setTimeout(() => (moved = false), 0);
    };
    book.addEventListener("pointerup", endPointer);
    book.addEventListener("pointercancel", endPointer);
    // trackpad pinch (and ctrl + scroll) zooms; scrolling while zoomed moves around the page
    zw.addEventListener("wheel", (e) => {
      if (e.ctrlKey) { e.preventDefault(); setZoom(z * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); return; }
      if (z > 1) { e.preventDefault(); tx -= e.deltaX; ty -= e.deltaY; applyZoom(false); }
    }, { passive: false });

    const onKey = (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
      if (e.key === "Escape" && z > 1 && !root.closest(".fb-modal")) unzoom();
      if (e.key === "+" || e.key === "=") { setZoom(z * 1.5, undefined, undefined, true); e.preventDefault(); }
      if (e.key === "-" || e.key === "_") { setZoom(z / 1.5, undefined, undefined, true); e.preventDefault(); }
    };
    document.addEventListener("keydown", onKey);
    let resizeT;
    const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if ((isDouble() ? "double" : "single") !== mode) build(); }, 150); };
    addEventListener("resize", onResize);

    build();
    return { destroy() { document.removeEventListener("keydown", onKey); removeEventListener("resize", onResize); }, zoomed: () => z > 1, unzoom };
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
  const loadData = () => (dataP ||= fetch(`${document.body.dataset.base || ""}/issues/data.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))));
  const t = document.body.dataset;
  const tpl = document.getElementById("fb-icons")?.content;
  let UI = {}; try { UI = JSON.parse(document.getElementById("zz-ui")?.textContent || "{}"); } catch {}
  const W = (k, d) => String(UI[k] || d).replace(/"/g, "&quot;");
  const ico = (c, fallback) => tpl?.querySelector(c)?.innerHTML || fallback;

  const overlay = document.createElement("div");
  overlay.className = "fb-modal";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="fb-modal-inner" role="dialog" aria-modal="true" aria-labelledby="fb-modal-title">
    <div class="fb-modal-top">
      <div><span class="label fb-modal-kind"></span><h2 id="fb-modal-title"></h2></div>
      <button class="fb-close" type="button" aria-label="${W("ui.close", "Close")}">${ico(".x", "×")}</button>
    </div>
    <section class="flipbook in-modal" dir="ltr">
      <div class="fb-stage"><div class="fb-book"></div></div>
      <div class="fb-controls">
        <button class="fb-btn" type="button" data-fb="prev" aria-label="${W("ui.prevPage", "Previous page")}">${ico(".l", "‹")}</button>
        <span class="fb-count label" aria-live="polite"></span>
        <button class="fb-btn" type="button" data-fb="next" aria-label="${W("ui.nextPage", "Next page")}">${ico(".r", "›")}</button>
        <button class="fb-btn fb-zoom-btn" type="button" data-fb="zoom" aria-label="${W("ui.zoomIn", "Zoom in")}" aria-pressed="false"><span class="i-in">${ico(".zi", "+")}</span><span class="i-out">${ico(".zo", "−")}</span></button>
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
    overlay.querySelector("#fb-modal-title").lang = "en"; // issue titles stay as written
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
    if (e.key === "Escape") { if (current?.zoomed()) current.unzoom(); else close(); return; }
    if (e.key === "Tab") { // keep focus inside the popup
      const f = [...overlay.querySelectorAll("button:not(:disabled)")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener("popstate", () => { if (!overlay.hidden) close(true); });
})();
