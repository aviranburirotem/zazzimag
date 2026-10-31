// Every piece of site wording that can be changed in the console (/admin/ → Site texts).
// The values live in content/site.json; anything missing falls back to the default here.
// type: "text" (one line), "long" (paragraphs; supports **bold**, *italic* and [links](https://…)),
//       "list" (one item per line), "toggle" ("on" / "off"), "range" (a number on a slider),
//       "pos" (one of tl tc tr ml mc mr bl bc br), "choice" (one of options)
// noTranslate: stays as written in every language (brand, legal text, the brand headline). Other text, long and
//   list fields are translated with the site (console → Languages).
export const SCHEMA = [
  { group: "Show / hide parts of the site", fields: [
    { key: "show.ticker", label: "Scrolling words in the header", type: "toggle", default: "on" },
    { key: "show.storeNav", label: "Store button (header and footer)", type: "toggle", default: "on" },
    { key: "show.lightSwitch", label: "Light switch on the home page", type: "toggle", default: "on" },
    { key: "show.lava", label: "Moving blob strip at the top of the home page (the headline sits on it)", type: "toggle", default: "on" },
    { key: "show.igButton", label: "Instagram button under the home headline", type: "toggle", default: "on" },
    { key: "show.videoStrip", label: "Moving video above the footer on the home page (change it in the Video tab)", type: "toggle", default: "on" },
    { key: "show.feed", label: "Instagram posts in the home grid", type: "toggle", default: "on" },
    { key: "show.band", label: "\"Every story, in one place\" banner on the home page", type: "toggle", default: "on" },
    { key: "show.feedStrip", label: "\"From the feed\" strip on article pages", type: "toggle", default: "on" },
    { key: "show.readNext", label: "\"Read next\" on article pages", type: "toggle", default: "on" },
  ]},
  { group: "Brand & contact", fields: [
    { noTranslate: true, key: "brand.name", label: "Magazine name", type: "text", default: "Zazzi Magazine", hint: "Used in page titles and search results" },
    { noTranslate: true, key: "brand.tagline", label: "Tagline", type: "text", default: "Streetwear, trends, self-expression and city vibes.", hint: "Short description used by Google and social previews" },
    { noTranslate: true, key: "brand.email", label: "Contact email", type: "text", default: "hello@zazzimag.com" },
    { noTranslate: true, key: "brand.instagram", label: "Instagram username", type: "text", default: "zazzimag", hint: "Without the @" },
  ]},
  { group: "Header", fields: [
    { key: "header.ticker", label: "Scrolling words in the header", type: "list", default: "Streetwear\nTrends\nSelf-expression\nCity vibes\n#ZazziSpotting\nTokyo\nStreet snaps\nZazzi Magazine", hint: "One per line" },
    { key: "nav.info", label: "Info button", type: "text", default: "Info" },
    { key: "nav.store", label: "Store button", type: "text", default: "Store" },
    { key: "nav.articles", label: "All articles button", type: "text", default: "All articles" },
  ]},
  { group: "Home page", fields: [
    { noTranslate: true, key: "home.headline", label: "Big headline (on the lava strip)", type: "long", allowEmpty: true, default: "Street style,\nstraight from the feed", hint: "Press Enter for a new line. Leave empty for the animation only" },
    { key: "home.headlineSize", label: "Headline size", type: "range", min: 50, max: 180, step: 5, unit: "%", default: "100", hint: "100% is the normal size" },
    { key: "home.headlinePos", label: "Headline place on the strip (both headlines)", type: "pos", default: "bl" },
    { key: "home.headlineColor", label: "Headline colour on the strip (both headlines)", type: "choice", options: [["white", "White"], ["pink", "Pink"], ["yellow", "Yellow"], ["black", "Black (only for light lava)"]], default: "white" },
    { key: "home.intro", label: "Second headline (smaller, under the big headline)", type: "long", allowEmpty: true, default: "Streetwear, trends, self-expression and city vibes. Fresh looks from our Instagram, mixed with longer stories from the street." },
    { key: "home.introSize", label: "Second headline size", type: "range", min: 50, max: 200, step: 5, unit: "%", default: "100", hint: "100% is the normal size" },
    { key: "home.introAlign", label: "Second headline position (only when the moving strip is off; on the strip it follows the big headline)", type: "choice", options: [["left", "Left"], ["center", "Centre"], ["right", "Right"]], default: "left" },
    { key: "home.videoLabel", label: "Footer video description (for screen readers)", type: "text", default: "Street scenes from Harajuku, Tokyo" },
    { key: "home.secStories", label: "Section title: articles", type: "text", default: "Stories" },
    { key: "home.secInstagram", label: "Section title: Instagram posts", type: "text", default: "On Instagram" },
    { key: "home.secIssues", label: "Section title: issues", type: "text", default: "Issues" },
    { key: "home.moreArticles", label: "Button under the articles", type: "text", default: "More articles" },
    { key: "home.followTile", label: "Follow tile text", type: "text", default: "Follow", hint: "Shown on the red tile at the end of the feed, before @username" },
    { key: "home.bandHeading", label: "Bottom banner heading", type: "text", default: "Every story, in one place" },
    { key: "home.bandButton", label: "Bottom banner button", type: "text", default: "See all articles" },
  ]},
  { group: "Articles", fields: [
    { key: "articles.heading", label: "All articles page heading", type: "text", default: "Articles" },
    { key: "articles.count", label: "Count label", type: "text", default: "{n} stories", hint: "{n} is replaced by the number of articles" },
    { key: "articles.allFilter", label: "\"All\" filter button", type: "text", default: "All" },
    { key: "articles.byline", label: "Byline prefix", type: "text", default: "Written by", hint: "Shown before the author's name" },
    { key: "articles.feedHeading", label: "Instagram strip heading", type: "text", default: "From the feed" },
    { key: "articles.readNext", label: "Related articles heading", type: "text", default: "Read next" },
    { key: "articles.allLink", label: "Link to all articles", type: "text", default: "All articles" },
  ]},
  { group: "Issues (flip-through magazines)", fields: [
    { key: "issues.category", label: "Label for issues", type: "text", default: "Issue", hint: "Used as the filter name on the All articles page" },
    { key: "issues.pages", label: "Page count", type: "text", default: "{n} pages", hint: "{n} is replaced by the number of pages" },
    { key: "issues.hint", label: "How-to hint under the magazine", type: "text", default: "Click the pages, use the arrows or swipe to turn. Pinch or use the magnifier to zoom in" },
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
    { key: "store.backLink", label: "Back-to-store link on product pages", type: "text", default: "Back to the store" },
    { key: "store.notifyHeading", label: "Sign-up heading (when products are listed)", type: "text", default: "Hear about new drops first" },
    { key: "store.button", label: "Sign-up button", type: "text", default: "Notify me" },
    { key: "store.sentMessage", label: "Message after sign-up", type: "text", default: "Your email app should open. Send it and you're on the list." },
  ]},
  { group: "Coming-soon page", fields: [
    { noTranslate: true, key: "comingSoon.heading", label: "Heading", type: "text", default: "Coming soon" },
    { noTranslate: true, key: "comingSoon.text", label: "Text", type: "long", default: "Streetwear, trends, self-expression and city vibes. The full magazine is on its way." },
    { noTranslate: true, key: "comingSoon.contactLabel", label: "Contact label", type: "text", default: "Get in touch" },
  ]},
  { group: "Small interface words", note: "Labels, buttons and descriptions for screen readers. All of them are translated with the site.", fields: [
    { key: "ui.minRead", label: "Reading time", type: "text", default: "{n} min read", hint: "{n} is the number of minutes" },
    { key: "ui.skip", label: "Skip link (keyboard users)", type: "text", default: "Skip to content" },
    { key: "ui.homeLink", label: "Logo link (screen readers)", type: "text", default: "Zazzi Magazine home" },
    { key: "ui.language", label: "Language menu", type: "text", default: "Language" },
    { key: "ui.latest", label: "Top section (screen readers)", type: "text", default: "Latest" },
    { key: "ui.previous", label: "Previous button", type: "text", default: "Previous" },
    { key: "ui.next", label: "Next button", type: "text", default: "Next" },
    { key: "ui.pauseCarousel", label: "Pause the carousel", type: "text", default: "Pause the carousel" },
    { key: "ui.playCarousel", label: "Play the carousel", type: "text", default: "Play the carousel" },
    { key: "ui.pauseAnimation", label: "Pause the animation", type: "text", default: "Pause the animation" },
    { key: "ui.playAnimation", label: "Play the animation", type: "text", default: "Play the animation" },
    { key: "ui.pauseVideo", label: "Pause the video", type: "text", default: "Pause video" },
    { key: "ui.playVideo", label: "Play the video", type: "text", default: "Play video" },
    { key: "ui.post", label: "Label on Instagram tiles", type: "text", default: "Post" },
    { key: "ui.openPost", label: "Open an Instagram post (screen readers)", type: "text", default: "Open Instagram post" },
    { key: "ui.instagramPost", label: "Instagram post window (screen readers)", type: "text", default: "Instagram post" },
    { key: "ui.viewOnInstagram", label: "Button in the post window", type: "text", default: "View on Instagram" },
    { key: "ui.close", label: "Close", type: "text", default: "Close" },
    { key: "ui.filterBy", label: "Category filters (screen readers)", type: "text", default: "Filter by category" },
    { key: "ui.showing", label: "Filter result (screen readers)", type: "text", default: "{n} stories shown", hint: "{n} is the number of stories" },
    { key: "ui.prevPage", label: "Magazine: previous page", type: "text", default: "Previous page" },
    { key: "ui.nextPage", label: "Magazine: next page", type: "text", default: "Next page" },
    { key: "ui.zoomIn", label: "Magazine: zoom in", type: "text", default: "Zoom in" },
    { key: "ui.zoomOut", label: "Magazine: zoom out", type: "text", default: "Zoom out" },
    { key: "ui.footerArticles", label: "Footer: articles", type: "text", default: "Articles" },
    { key: "ui.footerInfo", label: "Footer: info", type: "text", default: "Info & contact" },
    { key: "ui.footerStore", label: "Footer: store", type: "text", default: "Store" },
    { key: "ui.footerA11y", label: "Footer: accessibility", type: "text", default: "Accessibility" },
    { key: "ui.footerPrivacy", label: "Footer: privacy", type: "text", default: "Privacy" },
    { key: "ui.cookieSettings", label: "Footer: cookie settings", type: "text", default: "Cookie settings" },
    { key: "ui.a11yOptions", label: "Accessibility button", type: "text", default: "Accessibility options" },
    { key: "ui.a11yTitle", label: "Accessibility menu title", type: "text", default: "Accessibility" },
    { key: "ui.a11yText", label: "Accessibility: larger text", type: "text", default: "Larger text" },
    { key: "ui.a11yContrast", label: "Accessibility: high contrast", type: "text", default: "High contrast" },
    { key: "ui.a11yLinks", label: "Accessibility: highlight links", type: "text", default: "Highlight links" },
    { key: "ui.a11yFont", label: "Accessibility: readable font", type: "text", default: "Readable font" },
    { key: "ui.a11yStill", label: "Accessibility: stop animations", type: "text", default: "Stop animations" },
    { key: "ui.a11yReset", label: "Accessibility: reset", type: "text", default: "Reset" },
    { key: "ui.a11yStatement", label: "Accessibility: link to the statement", type: "text", default: "Accessibility statement" },
    { key: "ui.formName", label: "Contact form: name", type: "text", default: "Name" },
    { key: "ui.formEmail", label: "Contact form: email", type: "text", default: "Email" },
    { key: "ui.formTopic", label: "Contact form: topic", type: "text", default: "Topic" },
    { key: "ui.formMessage", label: "Contact form: message", type: "text", default: "Message" },
    { key: "ui.articlesDescription", label: "All articles page description (search results)", type: "text", default: "All Zazzi stories: street style, trends, guides and interviews." },
    { key: "ui.aboutDescription", label: "Info page description (search results)", type: "text", default: "Who we are and how to reach Zazzi Magazine." },
    { key: "ui.notFound", label: "Page not found: heading", type: "text", default: "Page not found" },
    { key: "ui.notFoundText", label: "Page not found: text", type: "text", default: "This page doesn't exist." },
    { key: "ui.backHome", label: "Page not found: button", type: "text", default: "Back to home" },
    { key: "ui.notTranslated", label: "Note on an article not translated yet", type: "text", default: "This article isn't translated yet." },
  ]},
  { group: "Ads and tracking", fields: [
    { noTranslate: true, key: "meta.pixelId", label: "Meta Pixel ID", type: "text", default: "", hint: "Only the number from Meta Events Manager (Data sources → your pixel). Visitors are asked first, and the pixel runs only if they accept. Leave empty to turn it off." },
  ] },
  { group: "Footer", fields: [
    { noTranslate: true, key: "footer.copyright", label: "Copyright notice", type: "long", default: "© {year} Zazzi Magazine (zazzimag.com). All rights reserved. The text, photographs, graphics, logo and design on this site are protected by copyright and other intellectual property laws. You may not copy, reproduce, republish, distribute or use any of this content for commercial purposes without our prior written permission, except as permitted by law. Third-party content, including photos used under license, remains the property of its respective owners.", hint: "{year} becomes the current year" },
  ]},
];

// Returns a getter: get("home.headline") → saved value, or the default
// The fields translated with the site: words people read, but not brand names, legal text or settings
export const TRANSLATABLE = SCHEMA.flatMap((g) => g.fields).filter((f) => ["text", "long", "list"].includes(f.type) && !f.noTranslate);

export function texts(saved = {}) {
  const defaults = Object.fromEntries(SCHEMA.flatMap((g) => g.fields.map((f) => [f.key, f.default])));
  const canBeEmpty = new Set(SCHEMA.flatMap((g) => g.fields.filter((f) => f.allowEmpty).map((f) => f.key)));
  return (key) => {
    const v = key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), saved);
    if (canBeEmpty.has(key) && typeof v === "string") return v.trim();
    return typeof v === "string" && v.trim() !== "" ? v : defaults[key] ?? "";
  };
}
