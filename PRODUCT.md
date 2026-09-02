# Briefcast product

Friends follow **their own** podcasts and get a written episode brief plus a spoken recap. Briefcast is not a curated show catalog.

## MVP (this repo)

- Email + password accounts. No email is sent. No purchases.
- Search the iTunes Search API and follow any show with a public RSS feed.
- Persist users, follows, episodes, briefs, and spoken MP3 audio (SQLite locally; hosted Postgres on Vercel).
- Check for new episodes from a show’s RSS feed. Per-episode **Generate brief + voice** still works.
- Homepage / library queue lists briefs for shows the signed-in user follows (newest episode first). No sample or demo cards.
- Daily Vercel cron (`/api/cron/poll-episodes`) plus in-app “Check for new episodes” poll followed-show RSS. New episodes (and the latest unbriefed episode after a first follow) reuse the transcript-first Generate path and land in that queue.
- Per followed show, the user picks a brief length (Short / Medium / Long; default Medium). Different follows can use different lengths. Changing length applies on the next Generate or auto-brief — existing briefs are not rewritten automatically.
- Written brief format (scales with the follow’s length):
  - Header: show, title, guest (if named in source), date, official link, requested length
  - Overview, main segments in source order (host vs guest when clear), and takeaways — more sentences/segments/detail for Medium and Long
- Source policy: prefer a real transcript when one is publicly available (RSS `podcast:transcript`, an official episode/transcript page, or public captions such as YouTube). Otherwise use official show notes and show a confidence note. Do not invent quotes or topics. If the source is too thin for the chosen length, write the best faithful brief and show that the source was limited.
- Spoken recap via **Grok Voice / xAI TTS only** (`POST https://api.x.ai/v1/tts`, `voice_id: eve`, speed `1.0` so duration matches 1x). Length targets at 1x (~150 words/minute): Short 3–5 min (~450–750 words), Medium 8–12 min (~1200–1800), Long 20–30 min (~3000–4500). The in-app player can still default to `playbackRate` 1.2. Unary TTS is capped at 15,000 characters; Long recaps are chunked and stitched, never silently truncated.
- If `XAI_API_KEY` is missing, the full UI still runs. Generate and auto-briefs fail with a message to add the key. Two public NPR episodes may still exist in the database for the reader, but they are not shown on the home queue unless the user follows those shows.

## Later

- Email (or other) notifications when a followed show publishes and a brief is ready
- Shared listening queues and family accounts
- Richer transcript providers when a show does not publish one
- Object storage for spoken recaps if the database outgrows in-row audio
