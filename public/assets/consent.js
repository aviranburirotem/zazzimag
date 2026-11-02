// Meta Pixel and the cookie choice.
// Where the law asks for consent first (CONSENT_FIRST below, and when the country can't be found),
// the pixel loads only after the visitor chooses Accept. Everywhere else it loads straight away,
// and the "Cookie settings" link in the footer lets the visitor turn it off.
// The pixel ID comes from the console (Site texts → Ads and tracking) and is set on this script tag
// as data-pixel. The choice is saved in this browser ("zz-consent": "yes" / "no").
(() => {
  const me = document.currentScript;
  const PIXEL = (me && me.dataset.pixel || "").replace(/\D/g, "");
  if (!PIXEL) return;
  const KEY = "zz-consent";
  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const set = (v) => { try { localStorage.setItem(KEY, v); } catch {} };

  // countries (and Quebec) where tracking cookies need consent first; listed in the privacy policy too
  const CONSENT_FIRST = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", // EU
    "IS", "LI", "NO", "GB", "CH", "KR", "BR", "TR", "CN"]);
  const NOTICE = new Set(["IL"]); // the pixel is on straight away, with a notice the visitor can close or use to turn it off
  const needsConsent = (g) => !g || !g.country || CONSENT_FIRST.has(g.country) || (g.country === "CA" && g.region === "QC");
  async function geo() {
    try { const c = sessionStorage.getItem("zz-geo"); if (c) { const g = JSON.parse(c); if ("region" in g) return g; } } catch {}
    try {
      const g = await fetch("/api/geo").then((r) => r.json());
      try { sessionStorage.setItem("zz-geo", JSON.stringify(g)); } catch {}
      return g;
    } catch { return null; }
  }
  let strict = true; // until we know the visitor's country
  const NOTE_KEY = "zz-cookie-note";
  const noteSeen = () => { try { return localStorage.getItem(NOTE_KEY) === "1"; } catch { return true; } };
  const he = () => (document.documentElement.lang || "").startsWith("he");

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
.zz-consent .zz-in{max-width:1248px;margin:0 auto;padding-block:14px;padding-inline:80px 16px;display:flex;align-items:center;gap:20px;padding-bottom:max(14px,env(safe-area-inset-bottom,0px))}
.zz-consent p{margin:0;flex:1;color:#3d3d3a}
.zz-consent a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.zz-consent .zz-row{display:flex;gap:10px;flex:none}
.zz-consent button{min-width:112px;min-height:42px;padding:0 18px;border-radius:999px;font:600 13px/1 Archivo,system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;border:1px solid #1c1c1c;background:transparent;color:#1c1c1c;transition:background .15s,color .15s}
.zz-consent button:hover{background:rgba(0,0,0,.06)}
.zz-consent button[data-c="yes"],.zz-consent button[data-c="ok"]{background:#1c1c1c;color:#fff}
.zz-consent button[data-c="yes"]:hover,.zz-consent button[data-c="ok"]:hover{background:#000}
.zz-consent button:focus-visible{outline:3px solid #2b6cff;outline-offset:2px}
html[data-theme="dark"] .zz-consent{background:#2a2a28;color:#f1f0ec;border-top-color:#3a3a37}
html[data-theme="dark"] .zz-consent p{color:#d6d4ce}
html[data-theme="dark"] .zz-consent button{border-color:#f1f0ec;color:#f1f0ec}
html[data-theme="dark"] .zz-consent button:hover{background:rgba(255,255,255,.08)}
html[data-theme="dark"] .zz-consent button[data-c="yes"],html[data-theme="dark"] .zz-consent button[data-c="ok"]{background:#f1f0ec;color:#1c1c1c}
@media (max-width:700px){.zz-consent .zz-in{flex-direction:column;align-items:stretch;gap:12px;padding-inline-start:16px}.zz-consent .zz-row{margin-inline-start:60px}.zz-consent button{flex:1;min-width:0}}
@media (prefers-reduced-motion:reduce){.zz-consent{transition:opacity .2s;transform:none;opacity:0}.zz-consent.in{opacity:1}}
html.a11y-still .zz-consent{transition:none}
.zz-consent.zz-note{left:auto;right:auto;inset-inline-end:12px;bottom:12px;width:max-content;max-width:min(calc(100vw - 100px),440px);border:0;border-radius:999px;background:rgba(240,239,235,.92);box-shadow:0 2px 10px rgba(0,0,0,.08);font-size:11.5px;line-height:1.35;transform:translateY(160%)}
.zz-consent.zz-note.in{transform:none}
.zz-consent.zz-note .zz-in{padding:5px 6px;padding-inline-start:14px;gap:8px;flex-direction:row;align-items:center}
.zz-consent.zz-note p{color:#6b6b66}
.zz-consent.zz-note button{min-width:0;min-height:0;width:22px;height:22px;padding:0;border:0;border-radius:50%;background:transparent;color:#6b6b66;font:400 15px/22px system-ui,sans-serif;flex:none}
.zz-consent.zz-note button:hover{background:rgba(0,0,0,.06)}
@media (max-width:700px){.zz-consent.zz-note .zz-in{flex-direction:row;padding-inline-start:12px}}
@media (prefers-reduced-motion:reduce){.zz-consent.zz-note{transform:none}}`;

  let box = null;
  function ask(focus) {
    if (box) return;
    if (!document.getElementById("zz-consent-css")) {
      const st = document.createElement("style"); st.id = "zz-consent-css"; st.textContent = css; document.head.append(st);
    }
    box = document.createElement("section");
    box.className = focus === "notice" ? "zz-consent zz-note" : "zz-consent";
    box.setAttribute("aria-label", "Cookie choice");
    const on = loaded || get() === "yes";
    box.innerHTML = focus === "notice" // a small, quiet note (turning the pixel off: Cookie settings on the privacy page and in the footer)
      ? (he()
        ? `<div class="zz-in" dir="rtl"><p>האתר משתמש בעוגיות. המשך הגלישה מהווה הסכמה. <a href="/he/privacy/#cookies">מדיניות פרטיות</a></p><button type="button" data-c="ok" aria-label="סגירה">×</button></div>`
        : `<div class="zz-in"><p>This site uses cookies. By continuing, you agree. <a href="/privacy/#cookies">Privacy policy</a></p><button type="button" data-c="ok" aria-label="Close">×</button></div>`)
      : strict
      ? `<div class="zz-in"><p>We'd like to use Meta's pixel to measure our Instagram ads and show Zazzi to people who might like it. It's off unless you agree. <a href="/privacy/#cookies">Privacy policy</a></p>
      <div class="zz-row"><button type="button" data-c="no">Decline</button><button type="button" data-c="yes">Accept</button></div></div>`
      : `<div class="zz-in"><p>We use Meta's pixel to measure our Instagram ads and show Zazzi to people who might like it. It's ${on ? "on" : "off"}; you can change that here at any time. <a href="/privacy/#cookies">Privacy policy</a></p>
      <div class="zz-row"><button type="button" data-c="no">Turn off</button><button type="button" data-c="yes">${on ? "Keep on" : "Turn on"}</button></div></div>`;
    box.addEventListener("click", (e) => {
      let c = e.target.closest("[data-c]")?.dataset.c; if (!c) return;
      try { localStorage.setItem(NOTE_KEY, "1"); } catch {}
      if (c === "ok") c = "yes";
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
    if (focus === "notice") { const b = box; setTimeout(() => { if (box === b) b.querySelector('[data-c="ok"]').click(); }, 12000); } // goes away by itself
    if (focus === true) box.querySelector("button").focus();
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-consent-open]")) { e.preventDefault(); ask(true); }
  });
  const start = async () => {
    const c = get();
    if (c === "yes") { loadPixel(); geo().then((g) => { strict = needsConsent(g); }); return; }
    if (c === "no") { geo().then((g) => { strict = needsConsent(g); }); return; }
    const geoNow = await geo();
    strict = needsConsent(geoNow);
    if (strict) ask(false); // consent first: ask, the pixel waits
    else {                 // no consent needed here: on straight away (Cookie settings turns it off)
      loadPixel();
      if (geoNow && NOTICE.has(geoNow.country) && !noteSeen()) ask("notice"); // Israel: a notice
    }
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
