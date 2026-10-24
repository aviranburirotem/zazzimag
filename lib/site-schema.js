// Every piece of site wording that can be changed in the console (/admin/ → Site texts).
// The values live in content/site.json; anything missing falls back to the default here.
// type: "text" (one line), "long" (paragraphs; supports **bold**, *italic* and [links](https://…)),
//       "list" (one item per line)
export const SCHEMA = [
  { group: "Brand & contact", fields: [
    { key: "brand.name", label: "Magazine name", type: "text", default: "Zazzi Magazine", hint: "Used in page titles and search results" },
    { key: "brand.tagline", label: "Tagline", type: "text", default: "Streetwear, trends, self-expression and city vibes.", hint: "Short description used by Google and social previews" },
    { key: "brand.email", label: "Contact email", type: "text", default: "hello@zazzimag.com" },
    { key: "brand.instagram", label: "Instagram username", type: "text", default: "zazzimag", hint: "Without the @" },
  ]},
  { group: "Header buttons", fields: [
    { key: "nav.info", label: "Info button", type: "text", default: "Info" },
    { key: "nav.store", label: "Store button", type: "text", default: "Store" },
    { key: "nav.articles", label: "All articles button", type: "text", default: "All articles" },
  ]},
  { group: "Home page", fields: [
    { key: "home.headline", label: "Big headline", type: "long", default: "Street style,\nstraight from the feed", hint: "Press Enter for a new line" },
    { key: "home.intro", label: "Text under the headline", type: "long", default: "Streetwear, trends, self-expression and city vibes. Fresh looks from our Instagram, mixed with longer stories from the street." },
    { key: "home.followTile", label: "Follow tile text", type: "text", default: "Follow", hint: "Shown on the red tile at the end of the feed, before @username" },
    { key: "home.bandHeading", label: "Bottom banner heading", type: "text", default: "Every story, in one place" },
    { key: "home.bandButton", label: "Bottom banner button", type: "text", default: "See all articles" },
  ]},
  { group: "Articles", fields: [
    { key: "articles.heading", label: "All articles page heading", type: "text", default: "Articles" },
    { key: "articles.count", label: "Count label", type: "text", default: "{n} stories", hint: "{n} is replaced by the number of articles" },
    { key: "articles.allFilter", label: "\"All\" filter button", type: "text", default: "All" },
    { key: "articles.byline", label: "Byline prefix", type: "text", default: "Words:", hint: "Shown before the author's name" },
    { key: "articles.feedHeading", label: "Instagram strip heading", type: "text", default: "From the feed" },
    { key: "articles.readNext", label: "Related articles heading", type: "text", default: "Read next" },
    { key: "articles.allLink", label: "Link to all articles", type: "text", default: "All articles" },
  ]},
  { group: "Info page", fields: [
    { key: "about.heading", label: "Heading", type: "text", default: "Who we are" },
    { key: "about.text", label: "About text", type: "long", default: "Zazzi is a street style magazine about streetwear, trends, self-expression and city vibes. We spot great outfits on the street, share them every day on Instagram under [#ZazziSpotting](https://www.instagram.com/zazzimag/), and write longer stories about the people and ideas behind them.\n\nSpotted a look we should cover, want to be photographed, or have an idea for a story? Get in touch." },
    { key: "about.formHeading", label: "Contact form label", type: "text", default: "Contact" },
    { key: "about.topics", label: "Contact topics", type: "list", default: "General\nCollaboration\nPress\nGet photographed", hint: "One per line" },
    { key: "about.sendButton", label: "Send button", type: "text", default: "Send message" },
    { key: "about.sentMessage", label: "Message after sending", type: "text", default: "Your email app should open with the message ready to send." },
  ]},
  { group: "Store page", fields: [
    { key: "store.label", label: "Small label", type: "text", default: "Coming soon" },
    { key: "store.heading", label: "Heading", type: "text", default: "Store" },
    { key: "store.text", label: "Text", type: "long", default: "Our first drop is on the way: printed zines of our best street photos and a small run of Zazzi merch. Leave your email and you'll hear first." },
    { key: "store.items", label: "Product placeholders", type: "list", default: "Tote bag\nLogo tee\nPhoto zine Vol. 1\nCap", hint: "Shown only while no products are added in the Store tab. One per line" },
    { key: "store.itemBadge", label: "Text on product placeholders", type: "text", default: "Soon" },
    { key: "store.buyButton", label: "Buy button (products with a link)", type: "text", default: "Buy now" },
    { key: "store.askButton", label: "Ask button (available products without a link)", type: "text", default: "Ask about it" },
    { key: "store.soonBadge", label: "\"Coming soon\" product label", type: "text", default: "Coming soon" },
    { key: "store.soldOutBadge", label: "\"Sold out\" product label", type: "text", default: "Sold out" },
    { key: "store.notifyHeading", label: "Sign-up heading (when products are listed)", type: "text", default: "Hear about new drops first" },
    { key: "store.button", label: "Sign-up button", type: "text", default: "Notify me" },
    { key: "store.sentMessage", label: "Message after sign-up", type: "text", default: "Your email app should open. Send it and you're on the list." },
  ]},
  { group: "Coming-soon page", fields: [
    { key: "comingSoon.heading", label: "Heading", type: "text", default: "Coming soon" },
    { key: "comingSoon.text", label: "Text", type: "long", default: "Streetwear, trends, self-expression and city vibes. The full magazine is on its way." },
    { key: "comingSoon.contactLabel", label: "Contact label", type: "text", default: "Get in touch" },
  ]},
  { group: "Footer", fields: [
    { key: "footer.copyright", label: "Copyright notice", type: "long", default: "© {year} Zazzi Magazine (zazzimag.com). All rights reserved. The text, photographs, graphics, logo and design on this site are protected by copyright and other intellectual property laws. You may not copy, reproduce, republish, distribute or use any of this content for commercial purposes without our prior written permission, except as permitted by law. Third-party content, including photos used under license, remains the property of its respective owners.", hint: "{year} becomes the current year" },
  ]},
];

// Returns a getter: get("home.headline") → saved value, or the default
export function texts(saved = {}) {
  const defaults = Object.fromEntries(SCHEMA.flatMap((g) => g.fields.map((f) => [f.key, f.default])));
  return (key) => {
    const v = key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), saved);
    return typeof v === "string" && v.trim() !== "" ? v : defaults[key] ?? "";
  };
}
