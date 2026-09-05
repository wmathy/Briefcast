/**
 * One-shot wipe of briefs / recap audio / STT jobs / follow ledger.
 * Does not delete users, shows, follows, episodes, or follow length/voice.
 *
 *   CONFIRM_WIPE_BRIEFS=WIPE_ALL_BRIEFS DATABASE_URL='postgresql://…' node scripts/wipe-preview-briefs.mjs
 */
import pg from "pg";

if (process.env.CONFIRM_WIPE_BRIEFS !== "WIPE_ALL_BRIEFS") {
  console.error("Refusing to wipe. Set CONFIRM_WIPE_BRIEFS=WIPE_ALL_BRIEFS");
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim() ?? "";
if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.error("Refusing to wipe. DATABASE_URL must be a Postgres URL (Neon).");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

function hostLabel() {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function count(sql) {
  const result = await client.query(sql);
  return Number(result.rows[0].n);
}

await client.connect();
try {
  const before = {
    briefs: await count('SELECT COUNT(*)::int AS n FROM "Brief"'),
    recapAudio: await count('SELECT COUNT(*)::int AS n FROM "RecapAudio"'),
    sttJobs: await count('SELECT COUNT(*)::int AS n FROM "SttJob"'),
    ledgerRows: await count(
      'SELECT COUNT(*)::int AS n FROM "Follow" WHERE "lastBriefedEpisodeId" IS NOT NULL OR "lastBriefedAt" IS NOT NULL',
    ),
    users: await count('SELECT COUNT(*)::int AS n FROM "User"'),
    shows: await count('SELECT COUNT(*)::int AS n FROM "Show"'),
    follows: await count('SELECT COUNT(*)::int AS n FROM "Follow"'),
    episodes: await count('SELECT COUNT(*)::int AS n FROM "Episode"'),
  };

  const deletedAudio = await client.query('DELETE FROM "RecapAudio"');
  const deletedBriefs = await client.query('DELETE FROM "Brief"');
  const deletedStt = await client.query('DELETE FROM "SttJob"');
  const clearedLedger = await client.query(
    'UPDATE "Follow" SET "lastBriefedEpisodeId" = NULL, "lastBriefedAt" = NULL',
  );

  const after = {
    briefs: await count('SELECT COUNT(*)::int AS n FROM "Brief"'),
    recapAudio: await count('SELECT COUNT(*)::int AS n FROM "RecapAudio"'),
    sttJobs: await count('SELECT COUNT(*)::int AS n FROM "SttJob"'),
    ledgerRows: await count(
      'SELECT COUNT(*)::int AS n FROM "Follow" WHERE "lastBriefedEpisodeId" IS NOT NULL OR "lastBriefedAt" IS NOT NULL',
    ),
    users: await count('SELECT COUNT(*)::int AS n FROM "User"'),
    shows: await count('SELECT COUNT(*)::int AS n FROM "Show"'),
    follows: await count('SELECT COUNT(*)::int AS n FROM "Follow"'),
    episodes: await count('SELECT COUNT(*)::int AS n FROM "Episode"'),
  };

  console.log(
    JSON.stringify(
      {
        host: hostLabel(),
        before,
        deleted: {
          briefs: deletedBriefs.rowCount ?? 0,
          recapAudio: deletedAudio.rowCount ?? 0,
          sttJobs: deletedStt.rowCount ?? 0,
          ledgerCleared: clearedLedger.rowCount ?? 0,
        },
        after,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
