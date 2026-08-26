# Briefcast product

Friends follow **their own** podcasts and get a written episode brief plus a spoken recap. Briefcast is not a curated show catalog.

## MVP (this repo)

- Email + password accounts. No email is sent. No purchases.
- Search the iTunes Search API and follow any show with a public RSS feed.
- Persist users, follows, episodes, briefs, and spoken MP3 audio (SQLite locally; hosted Postgres on Vercel).
- Check for new episodes from a show’s RSS feed. Per-episode **Generate brief + voice**.
- Written brief format:
  - Header: show, title, guest (if named in source), date, official link
  - Two-sentence overview
  - Main segments in source order, with host vs guest when the source makes that clear
  - 4–6 takeaways
- Source policy: prefer a real transcript when one is publicly available (RSS `podcast:transcript`, an official episode/transcript page, or public captions such as YouTube). Otherwise use official show notes and show a confidence note. Do not invent quotes or topics.
- Spoken recap via **Grok Voice / xAI TTS only** (`POST https://api.x.ai/v1/tts`, `voice_id: eve`, speed `1.2`). In-app HTML player defaults to `playbackRate` 1.2.
- If `XAI_API_KEY` is missing, the full UI still runs. Two real public episodes ship with prewritten notes-only briefs. Generate fails with a message to add the key.

## Later

- Email (or other) notifications when a followed show publishes and a brief is ready
- Automatic RSS polling on a schedule, not only a manual check
- Shared listening queues and family accounts
- Richer transcript providers when a show does not publish one
- Object storage for spoken recaps if the database outgrows in-row audio
