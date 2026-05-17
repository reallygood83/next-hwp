# Deployment and Cost Notes

`next-hwp` can work in three cost profiles. Choose based on how long shared briefing pages must remain available.

## 1. Local only

Cost: 0

Use when:
- You only need to create files for yourself.
- You share the generated single HTML file directly.
- The `localhost` share link does not need to work after the local server stops.

How it works:
- Generated share pages are saved in `.data/shares/`.
- Links look like `http://localhost:3003/s/{id}`.
- The link works only while the local server is running and reachable.

Best default for experiments:
- Use `음성 포함 HTML` download.
- Send the resulting `.html` file directly.

## 2. Cheap public deployment

Expected cost: free tier to low monthly cost, depending on traffic and storage.

Use when:
- You want a public URL for each briefing.
- Pages should stay available after your computer turns off.
- Traffic is small or internal.

Recommended shape:
- App hosting: Vercel, Netlify, Cloudflare Pages, or a small VPS.
- Persistent object storage: Cloudflare R2, Supabase Storage, S3-compatible storage, or Vercel Blob.
- Save generated HTML as an object and return a public URL.

Why object storage:
- Generated HTML can be served as static content.
- Audio is already embedded for short briefings, so one object can represent the whole page.
- Storage cost is easier to control than keeping a database and media server.

## 3. Managed product mode

Expected cost: higher, but suitable for accounts, quotas, and retention policies.

Use when:
- Users need accounts and private document libraries.
- Links need expiration, deletion, access control, or analytics.
- API usage needs billing limits.

Recommended shape:
- Auth: Clerk, Supabase Auth, Auth.js, or existing SSO.
- Metadata DB: Postgres/Supabase.
- Object storage: R2/S3/Vercel Blob.
- Background jobs for long documents and audio generation.

## Cost controls

- Default to downloadable single HTML for short briefings.
- Put size limits on uploaded documents and generated HTML.
- Use expiration for share links.
- Store only generated HTML/audio, not original documents, unless explicitly required.
- Keep Gemini and ElevenLabs calls user-key based during MVP to avoid platform API-cost liability.
- Add per-run warnings when audio is embedded because base64 increases file size.

## Current implementation

The current MVP uses local filesystem storage:

- write: `app/api/share/route.ts`
- read: `app/s/[id]/route.ts`
- storage path: `.data/shares/`

This is good for local demos and zero-cost experiments. Before public deployment, replace `lib/share-store.ts` with an object-storage adapter.
