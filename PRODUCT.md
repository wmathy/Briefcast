# Briefcast product

Friends follow **their own** podcasts and get a written episode brief plus a spoken recap. Briefcast is not a curated show catalog.

## MVP (this repo)

- Email + password accounts. No email is sent. No purchases.
- Search the iTunes Search API and follow any show with a public RSS feed.
- Persist users, follows, episodes, briefs, and spoken MP3 audio (SQLite locally; hosted Postgres on Vercel).
- Following a show imports **every episode in that show’s public RSS feed** (not a sample list). The show page lists them all.
- Auto-brief and the Library “waiting” count only include a **recent window**: episodes published on/after the day the user followed the show, plus the **5 most recent** episodes as backfill. Older archive rows stay on the show page and are not queued.
- Follow, Library / show **Check**, Library auto-write, and daily production cron share **one** awaited generate pipeline (`refreshFollowedBriefs`). A request writes a small batch and reports how many remain. Long STT jobs persist chunk progress (`SttJob`) and continue on the next Check / Library load instead of dying when the function returns.
- Homepage / library queue lists **spoken** briefs (written brief + stored recap audio) for shows the signed-in user follows, newest episode first. Seed/demo text-only cards are not the dashboard.
- Per followed show, the user picks a brief length (Short / Medium / Long; default Medium). Different follows can use different lengths. Changing length applies on the next Generate or auto-brief — existing briefs are not rewritten automatically.
- Written brief format (scales with the follow’s length):
  - Header: show, title, guest (if named in source), date, official link, requested length
  - Overview, main segments in source order (host vs guest when clear), and takeaways — more sentences/segments/detail for Medium and Long
- Source policy: a brief is published **only** from a verified **full episode transcript**. Sources, in order: stored or RSS `podcast:transcript`, official transcript pages (including NPR `/transcripts/` and `text.npr.org`), public captions, then **Grok Speech-to-Text of the entire audio file** in resumable ~8 MB chunks (Range requests, retries, persisted partial text). Completeness is checked against episode duration (at least ~100 words/minute of coverage, and STT audio coverage ≥ 85% when duration is known). Show notes are never the summarized body. If no complete transcript can be obtained, **nothing is published** — the episode and Library say “No full transcript yet”, and Check / follow / cron retry. Existing notes-only briefs are purged.
- Spoken recap via **Grok Voice / xAI TTS only** (`POST https://api.x.ai/v1/tts`, `voice_id: eve`, speed `1.0`). Unary TTS is capped at 15,000 characters; recaps are chunked well below that. Publish fails if the spoken recap words or measured MP3 duration are outside the selected Short/Medium/Long band (unless the source itself is too thin). Chunk Xing/Info headers are stripped; a full-file Xing is written only when the whole payload parses. The episode player sits above the written summary.
- If `XAI_API_KEY` is missing, the full UI still runs. Auto-briefs fail with a message to add the key. Seed NPR rows may exist in the database, but the home queue only shows episodes that have a real spoken recap.

## Later

- Email (or other) notifications when a followed show publishes and a brief is ready
- Shared listening queues and family accounts
- Persist fetched/STT transcripts so a later Generate does not re-transcribe
- Object storage for spoken recaps if the database outgrows in-row audio
