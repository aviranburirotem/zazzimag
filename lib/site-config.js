// Site status, shared by the build and the password check (middleware.js).
// Changed from the console (Publish → Site status); it takes effect when the site is published.
//   "live"          the full site is public
//   "soon"          visitors see the coming-soon page; the full site needs the console password (/preview/)
//   "construction"  visitors see the under-construction page; the full site needs the console password (/preview/)
// The accessibility statement and privacy policy stay public in every status.
export const MODE = "soon";
export const MODES = ["live", "soon", "construction"];
export const LAUNCHED = MODE === "live";
