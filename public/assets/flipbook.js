// Zazzi flipbook: a magazine you turn page by page.
// Computers and tablets: two-page spreads that turn like real pages.
// Phones: one page at a time, turning away to the left.
// Turn with the buttons, by clicking a page, with the arrow keys, or by swiping.
(() => {
  const root = document.querySelector("[data-flipbook]");
  if (!root) return;
  let pages = [];
  try { pages = JSON.parse(root.querySelector(".fb-data").textContent); } catch {}
  if (!pages.length) return;

  const book = root.querySelector(".fb-book");
  const count = root.querySelector(".fb-count");
  const caption = root.querySelector(".fb-caption");
  const prevBtn = root.querySelector('[data-fb="prev"]');
  const nextBtn = root.querySelector('[data-fb="next"]');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const face = (p, side, i) => `<div class="face ${side}">${p ? `<img src="${esc(p.image)}" alt="${esc(p.alt || `Page ${i + 1}`)}" ${i > 3 ? 'loading="lazy"' : ""} draggable="false">` : ""}</div>`;

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
      flipped = Math.min(Math.ceil(page / 2), n);
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
      // turned leaves stack on the left, unturned on the right; the moving page stays on top
      leaf.style.zIndex = i === moving ? n + 2 : isFlipped ? i + 1 : n - i;
      const visible = mode === "double" ? i === flipped || i === flipped - 1 : i === flipped;
      leaf.setAttribute("aria-hidden", String(!visible));
    });
    book.classList.toggle("at-start", mode === "double" && flipped === 0);
    book.classList.toggle("at-end", mode === "double" && flipped === n);
    prevBtn.disabled = flipped === 0;
    nextBtn.disabled = flipped >= max();

    // page numbers and captions of what's open
    let shown;
    if (mode === "double") shown = [flipped * 2 - 1, flipped * 2].filter((p) => p >= 0 && p < pages.length);
    else shown = [flipped];
    count.textContent = shown.length === 2 ? `${shown[0] + 1}–${shown[1] + 1} / ${pages.length}` : `${shown[0] + 1} / ${pages.length}`;
    caption.textContent = shown.map((p) => pages[p].caption).filter(Boolean).join("  ·  ");
    // load the next pages before they're needed
    shown.forEach((p) => [p + 1, p + 2].forEach((q) => { if (pages[q]) new Image().src = pages[q].image; }));
  }

  function go(delta) {
    const target = Math.max(0, Math.min(max(), flipped + delta));
    if (target === flipped) return;
    const moving = delta > 0 ? flipped : flipped - 1;
    flipped = target;
    render(moving);
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  // click the right side to go forward, the left side to go back
  book.addEventListener("click", (e) => {
    if (moved) return;
    const r = book.getBoundingClientRect();
    go(e.clientX > r.left + r.width / 2 || (mode === "single" && e.clientX > r.left + r.width * 0.33) ? 1 : -1);
  });

  // swipe
  let x0 = null, moved = false;
  book.addEventListener("pointerdown", (e) => { x0 = e.clientX; moved = false; });
  book.addEventListener("pointermove", (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 10) moved = true; });
  book.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    setTimeout(() => (moved = false), 0);
  });
  book.addEventListener("pointercancel", () => (x0 = null));

  // arrow keys (unless typing somewhere)
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input,textarea,select,[contenteditable]")) return;
    if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
    if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
  });

  let resizeT;
  addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if ((isDouble() ? "double" : "single") !== mode) build(); }, 150); });

  build();
})();
