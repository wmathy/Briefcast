# Briefcast product

Friends follow **their own** podcasts and get a written episode brief plus a spoken recap. Briefcast is not a curated show catalog.

## MVP (this repo)

- Email + password accounts. No email is sent. No purchases.
- Search the iTunes Search API and follow any show with a public RSS feed.
- Persist users, follows, episodes, briefs, and spoken MP3 audio (SQLite locally; hosted Postgres on Vercel).
- Following a show imports **every episode in that show’s public RSS feed** (not a sample list). The show page lists them all.
- Follow, Library / show **Check for new episodes**, Library auto-write, and daily production cron share **one** awaited generate pipeline (`refreshFollowedBriefs`). Each followed show’s latest unbriefed episode is queued; a request writes up to a few and reports how many remain instead of silently dropping shows. Preview has no cron, so Library keeps checking until the latest recaps exist or a write fails honestly.
- Homepage / library queue lists **spoken** briefs (written brief + stored recap audio) for shows the signed-in user follows, newest episode first. Seed/demo text-only cards are not the dashboard.
- Per followed show, the user picks a brief length (Short / Medium / Long; default Medium). Different follows can use different lengths. Changing length applies on the next Generate or auto-brief — existing briefs are not rewritten automatically.
- Written brief format (scales with the follow’s length):
  - Header: show, title, guest (if named in source), date, official link, requested length
  - Overview, main segments in source order (host vs guest when clear), and takeaways — more sentences/segments/detail for Medium and Long
- Source policy: every brief is written from the **full episode transcript**, not the RSS description / show notes. Sources, in order: stored or RSS `podcast:transcript`, official transcript pages (including NPR `/transcripts/` and `text.npr.org`), public captions, then **Grok Speech-to-Text** of the episode audio. Show notes are a last-resort fallback only. If that fallback is used, the UI says **notes-only** (not the full episode). Notes-only briefs are not permanent: Generate and the next auto-write retry from a transcript. Do not invent quotes or topics. If the source is too thin for the chosen length, write the best faithful brief and show that the source was limited.
- Spoken recap via **Grok Voice / xAI TTS only** (`POST https://api.x.ai/v1/tts`, `voice_id: eve`, speed `1.0`). Unary TTS is capped at 15,000 characters; recaps are chunked well below that and stitched without Xing duration headers so the player is not clipped to the first chunk. The episode player sits above the written summary.
- If `XAI_API_KEY` is missing, the full UI still runs. Auto-briefs fail with a message to add the key. Seed NPR rows may exist in the database, but the home queue only shows episodes that have a real spoken recap.

## Later

- Email (or other) notifications when a followed show publishes and a brief is ready
- Shared listening queues and family accounts
- Persist fetched/STT transcripts so a later Generate does not re-transcribe
- Object storage for spoken recaps if the database outgrows in-row audio
