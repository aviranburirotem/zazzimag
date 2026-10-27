// Meta Pixel, loaded only after the visitor agrees.
// The pixel ID comes from the console (Site texts → Ads and tracking) and is set on this script tag
// as data-pixel. The choice is saved in this browser ("zz-consent": "yes" / "no"); the
// "Cookie settings" link in the footer opens the choice again.
(() => {
  const me = document.currentScript;
  const PIXEL = (me && me.dataset.pixel || "").replace(/\D/g, "");
  if (!PIXEL) return;
  const KEY = "zz-consent";
  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const set = (v) => { try { localStorage.setItem(KEY, v); } catch {} };

  let loaded = false;
  function loadPixel() {
    if (loaded) return; loaded = true;
    /* Meta's standard base code */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq("init", PIXEL);
    window.fbq("track", "PageView");
  }

  const css = `.zz-consent{position:fixed;z-index:25;left:0;right:0;bottom:0;background:#e8e7e3;color:#1c1c1c;border-top:1px solid #d3d1cb;box-shadow:0 -6px 24px rgba(0,0,0,.08);font:14px/1.5 Archivo,system-ui,sans-serif;transform:translateY(100%);transition:transform .45s cubic-bezier(.2,.8,.2,1)}
.zz-consent.in{transform:none}
.zz-consent .zz-in{max-width:1248px;margin:0 auto;padding:14px 16px 14px 80px;display:flex;align-items:center;gap:20px;padding-bottom:max(14px,env(safe-area-inset-bottom,0px))}
.zz-consent p{margin:0;flex:1;color:#3d3d3a}
.zz-consent a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.zz-consent .zz-row{display:flex;gap:10px;flex:none}
.zz-consent button{min-width:112px;min-height:42px;padding:0 18px;border-radius:999px;font:600 13px/1 Archivo,system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;border:1px solid #1c1c1c;background:transparent;color:#1c1c1c;transition:background .15s,color .15s}
.zz-consent button:hover{background:rgba(0,0,0,.06)}
.zz-consent button[data-c="yes"]{background:#1c1c1c;color:#fff}
.zz-consent button[data-c="yes"]:hover{background:#000}
.zz-consent button:focus-visible{outline:3px solid #2b6cff;outline-offset:2px}
html[data-theme="dark"] .zz-consent{background:#2a2a28;color:#f1f0ec;border-top-color:#3a3a37}
html[data-theme="dark"] .zz-consent p{color:#d6d4ce}
html[data-theme="dark"] .zz-consent button{border-color:#f1f0ec;color:#f1f0ec}
html[data-theme="dark"] .zz-consent button:hover{background:rgba(255,255,255,.08)}
html[data-theme="dark"] .zz-consent button[data-c="yes"]{background:#f1f0ec;color:#1c1c1c}
@media (max-width:700px){.zz-consent .zz-in{flex-direction:column;align-items:stretch;gap:12px;padding-left:16px}.zz-consent .zz-row{margin-left:60px}.zz-consent button{flex:1;min-width:0}}
@media (prefers-reduced-motion:reduce){.zz-consent{transition:opacity .2s;transform:none;opacity:0}.zz-consent.in{opacity:1}}
html.a11y-still .zz-consent{transition:none}`;

  let box = null;
  function ask(focus) {
    if (box) return;
    if (!document.getElementById("zz-consent-css")) {
      const st = document.createElement("style"); st.id = "zz-consent-css"; st.textContent = css; document.head.append(st);
    }
    box = document.createElement("section");
    box.className = "zz-consent";
    box.setAttribute("aria-label", "Cookie choice");
    box.innerHTML = `<div class="zz-in"><p>We'd like to use Meta's pixel to measure our Instagram ads and show Zazzi to people who might like it. It's off unless you agree. <a href="/privacy/#cookies">Privacy policy</a></p>
      <div class="zz-row"><button type="button" data-c="no">Decline</button><button type="button" data-c="yes">Accept</button></div></div>`;
    box.addEventListener("click", (e) => {
      const c = e.target.closest("[data-c]")?.dataset.c; if (!c) return;
      const was = get();
      set(c);
      const el = box; box = null;
      el.classList.remove("in"); // slide down, then remove
      const gone = () => el.remove();
      el.addEventListener("transitionend", gone, { once: true });
      setTimeout(gone, 600);
      if (c === "yes") loadPixel();
      else if (was === "yes" && loaded) location.reload(); // turning it off: reload so the pixel is gone
    });
    document.body.append(box);
    requestAnimationFrame(() => requestAnimationFrame(() => box && box.classList.add("in"))); // slide up
    if (focus) box.querySelector("button").focus();
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-consent-open]")) { e.preventDefault(); ask(true); }
  });
  const start = () => { const c = get(); if (c === "yes") loadPixel(); else if (c !== "no") ask(false); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
