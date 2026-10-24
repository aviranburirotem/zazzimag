// GET /api/geo → the visitor's display currency and today's rate from Israeli shekels.
// Country comes from Vercel's IP geolocation header. Rates are the European Central Bank's
// daily reference rates (via frankfurter.dev), cached for 6 hours.
//   Israel → ₪ · Japan → ¥ · South Korea → ₩ · euro countries → € · everyone else → $

const EURO = new Set(["AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "AD", "MC", "SM", "VA", "ME", "XK"]);
const FALLBACK = { USD: 0.32, EUR: 0.286, JPY: 50.2, KRW: 424 }; // used only if the rate service is down
let cache = { at: 0, rates: null };

function currencyFor(country) {
  if (country === "IL") return "ILS";
  if (country === "JP") return "JPY";
  if (country === "KR") return "KRW";
  if (EURO.has(country)) return "EUR";
  return "USD";
}

async function rates() {
  if (cache.rates && Date.now() - cache.at < 6 * 3600e3) return cache.rates;
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=ILS&symbols=USD,EUR,JPY,KRW");
    const d = await r.json();
    if (d?.rates?.USD) cache = { at: Date.now(), rates: d.rates };
  } catch (err) {
    console.error("Rate lookup failed:", err.message);
  }
  return cache.rates || FALLBACK;
}

export default async function handler(req, res) {
  const country = String(req.headers["x-vercel-ip-country"] || "").toUpperCase();
  const currency = currencyFor(country);
  const rate = currency === "ILS" ? 1 : (await rates())[currency];
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("Vary", "x-vercel-ip-country");
  res.json({ country, currency, rate });
}
