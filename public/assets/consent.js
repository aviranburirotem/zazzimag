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

  const css = `.zz-consent{position:fixed;z-index:40;right:16px;bottom:16px;max-width:440px;background:var(--bg,#fff);color:var(--fg,#111);border:1px solid var(--line,#ddd);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:16px;font:14px/1.5 Archivo,system-ui,sans-serif}
.zz-consent p{margin:0 0 12px}
.zz-consent a{color:inherit;text-decoration:underline}
.zz-consent .zz-row{display:flex;gap:10px;flex-wrap:wrap}
.zz-consent button{flex:1;min-width:120px;min-height:44px;border-radius:6px;font:600 14px/1 Archivo,system-ui,sans-serif;cursor:pointer;border:1px solid var(--fg,#111);background:transparent;color:inherit}
.zz-consent button[data-c="yes"]{background:var(--fg,#111);color:var(--bg,#fff)}
.zz-consent button:focus-visible{outline:3px solid #2b6cff;outline-offset:2px}
@media (max-width:600px){.zz-consent{left:76px;right:12px;bottom:12px;max-width:none}}`;

  let box = null;
  function ask(focus) {
    if (box) return;
    if (!document.getElementById("zz-consent-css")) {
      const st = document.createElement("style"); st.id = "zz-consent-css"; st.textContent = css; document.head.append(st);
    }
    box = document.createElement("section");
    box.className = "zz-consent";
    box.setAttribute("aria-label", "Cookie choice");
    box.innerHTML = `<p>We'd like to use Meta's pixel to measure our Instagram ads and show Zazzi to people who might like it. It's off unless you agree. <a href="/privacy/">Privacy policy</a></p>
      <div class="zz-row"><button type="button" data-c="no">Decline</button><button type="button" data-c="yes">Accept</button></div>`;
    box.addEventListener("click", (e) => {
      const c = e.target.closest("[data-c]")?.dataset.c; if (!c) return;
      const was = get();
      set(c);
      box.remove(); box = null;
      if (c === "yes") loadPixel();
      else if (was === "yes" && loaded) location.reload(); // turning it off: reload so the pixel is gone
    });
    document.body.append(box);
    if (focus) box.querySelector("button").focus();
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-consent-open]")) { e.preventDefault(); ask(true); }
  });
  const start = () => { const c = get(); if (c === "yes") loadPixel(); else if (c !== "no") ask(false); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
