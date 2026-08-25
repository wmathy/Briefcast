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

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `XAI_API_KEY` | For generate | xAI chat completions write the brief; xAI TTS (`eve`, speed 1.2) speaks it. [console.x.ai](https://console.x.ai/) |
| `AUTH_SECRET` | Recommended | Signs the login cookie. A long random string is fine. |
| `DATABASE_URL` | Optional | Defaults to `file:./prisma/dev.db` (SQLite via Prisma). |

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

This is a standard Next.js App Router app (`vercel.json` + `next build`).

1. Import [github.com/wmathy/Briefcast](https://github.com/wmathy/Briefcast) in Vercel.
2. Set `AUTH_SECRET` and, for live generation, `XAI_API_KEY`.
3. `DATABASE_URL` can stay unset. The build seeds SQLite; on Vercel the file is copied to `/tmp` so the preview is clickable. Writes there are ephemeral — use hosted Postgres later if you want a durable production database.

**Preview:** a Vercel preview URL will be added here once the GitHub project is linked (or when this PR’s deployment finishes). Until then, run locally or deploy from the Vercel dashboard.

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

Next.js App Router, TypeScript, Tailwind, Prisma + SQLite, iTunes Search API, RSS, xAI chat + TTS.
