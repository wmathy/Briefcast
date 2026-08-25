# Briefcast

Friends follow their own podcasts and get a written episode brief plus a spoken recap.

Search iTunes, follow the shows you already listen to, then open a source-grounded brief and play a Grok Voice recap in the app. There is no hardcoded show list, no email, and no checkout.

See [PRODUCT.md](./PRODUCT.md) for MVP vs later (email notifications).

## Run locally

```bash
npm install
cp .env.example .env
# Optional: paste an xAI key so Generate can write briefs and speak them
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up with any email + password (8+ characters). We never send mail.

Without `XAI_API_KEY`, the UI still works. The library includes two real public NPR episodes with prewritten, notes-only briefs. **Generate brief + voice** tells you to add the key.

Local `npm run dev` uses SQLite (`file:./prisma/dev.db`) unless you point `DATABASE_URL` at Postgres.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `XAI_API_KEY` | For generate | xAI chat completions write the brief; xAI TTS (`eve`, speed 1.2) speaks it. [console.x.ai](https://console.x.ai/) |
| `AUTH_SECRET` | Recommended | Signs the login cookie. A long random string is fine. |
| `DATABASE_URL` | Local: optional. **Vercel: required** | Local default is `file:./prisma/dev.db` (SQLite via Prisma). On Vercel set a hosted **Postgres** URL (Neon or any Postgres). SQLite under `/tmp` is not shared across serverless instances, so Follow would 404 on `/shows/[id]`. |

TTS is **Grok Voice / xAI only**. Briefcast does not use edge-tts or any other synthesizer.

```bash
curl -X POST https://api.x.ai/v1/tts \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Briefcast.","voice_id":"eve","language":"en","speed":1.2}' \
  --output recap.mp3
```

Chat briefs use `https://api.x.ai/v1/chat/completions` when the key is present. Transcripts or official show notes are fetched server-side first.

## Deploy on Vercel

This is a standard Next.js App Router app (`vercel.json` + `next build`). The build runs `prisma generate`, `prisma db push`, and the sample-brief seed.

1. Import [github.com/wmathy/Briefcast](https://github.com/wmathy/Briefcast) in Vercel.
2. Set `AUTH_SECRET` and, for live generation, `XAI_API_KEY`.
3. Create a hosted Postgres database (Neon via the [Vercel Marketplace](https://vercel.com/marketplace) or [neon.tech](https://neon.tech) is fine).
4. Set `DATABASE_URL` on **Production and Preview**, available at **Build and Runtime**. Use the **pooled** connection string and include `sslmode=require` if the host asks for SSL.
5. Redeploy after saving the env vars. The build fails on purpose if `DATABASE_URL` is missing or still a SQLite `file:` URL.

Do not paste real credentials into the repo. `.env.example` only shows the local SQLite default and a dummy Postgres shape.

```bash
npx vercel
```

## Scripts

```bash
npm run dev      # generate Prisma client, push schema, seed, then Next.js
npm run build    # same prepare step, then production build
npm test         # brief/source unit tests
npm run lint
```

## Stack

Next.js App Router, TypeScript, Tailwind, Prisma (SQLite locally, Postgres on Vercel), iTunes Search API, RSS, xAI chat + TTS.
