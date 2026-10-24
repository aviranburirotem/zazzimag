# Zazzi Magazine — zazzimag.com

Street style site: the live @zazzimag Instagram feed mixed with Zazzi articles.

## Console (easiest)
Go to **/admin/**, log in, and write or edit articles and upload photos there.
Each save is committed to this repo and goes live in about a minute.
Needs `ADMIN_PASSWORD` and `GITHUB_TOKEN` in Vercel (see `.env.example`).

## Coming-soon mode
While `LAUNCHED = false` in `build.mjs`, zazzimag.com shows only the coming-soon page.
The full site is still reachable at **/preview/** (hidden from search engines).

## Writing an article by hand
1. Add your photos to `public/images/articles/<article-name>/`.
2. Create `content/articles/<article-name>.md`:

```
---
title: Your headline
dek: One-sentence summary under the headline
date: 2026-10-30
category: Street Style
cover: /images/articles/<article-name>/cover.jpg
coverAlt: What the cover photo shows
coverCaption: Photo: Your Name
author: Your Name
---
Your text. Leave an empty line between paragraphs.

## A subheading

![What the photo shows](/images/articles/<article-name>/photo-1.jpg "Caption")
![Photos on consecutive lines become a side-by-side row](/images/articles/<article-name>/photo-2.jpg "Caption")

> A pull quote
```

Commit it and Vercel publishes it within a minute. Add `draft: true` to hide an article.

## Instagram feed
- `/api/instagram` returns the latest posts (cached for 1 hour).
- `/api/refresh-token` runs weekly (Vercel cron) and extends the token for 60 days.

Environment variables (Vercel → Settings → Environment Variables): see `.env.example`.

## Local preview
`node build.mjs` builds into `dist/`.
