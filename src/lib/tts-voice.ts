import { XAI_API_BASE, hasXaiKey, requireXaiKey } from "@/lib/env";

export const DEFAULT_TTS_VOICE = "eve";

export type TtsVoice = {
  id: string;
  name: string;
  hint?: string;
};

/** Built-in roster from xAI docs / GET /v1/tts/voices. Used if the live list is unreachable. */
export const FALLBACK_TTS_VOICES: TtsVoice[] = [
  { id: "eve", name: "Eve", hint: "Energetic and upbeat" },
  { id: "ara", name: "Ara", hint: "Warm and friendly" },
  { id: "leo", name: "Leo", hint: "Authoritative and strong" },
  { id: "rex", name: "Rex", hint: "Confident and clear" },
  { id: "sal", name: "Sal", hint: "Smooth and balanced" },
  { id: "carina", name: "Carina" },
  { id: "zagan", name: "Zagan", hint: "Powerful, dramatic" },
  { id: "helix", name: "Helix", hint: "Bold, dynamic" },
  { id: "orion", name: "Orion", hint: "Rich, cinematic" },
  { id: "luna", name: "Luna", hint: "Gentle, patient" },
  { id: "iris", name: "Iris", hint: "Friendly, upbeat" },
  { id: "altair", name: "Altair" },
  { id: "zenith", name: "Zenith", hint: "Sharp, focused" },
  { id: "perseus", name: "Perseus", hint: "Strong, confident" },
  { id: "helios", name: "Helios", hint: "Upbeat, energetic" },
  { id: "lux", name: "Lux", hint: "Grounded, calm" },
  { id: "kepler", name: "Kepler", hint: "Inventive, charismatic" },
  { id: "rigel", name: "Rigel", hint: "Precise, professional" },
  { id: "cosmo", name: "Cosmo", hint: "Bright, curious" },
  { id: "celeste", name: "Celeste", hint: "Compassionate, reassuring" },
  { id: "ursa", name: "Ursa", hint: "Friendly, warm" },
  { id: "sirius", name: "Sirius", hint: "Quick-witted, playful" },
  { id: "lumen", name: "Lumen", hint: "Warm, articulate" },
  { id: "castor", name: "Castor", hint: "Charismatic, easygoing" },
  { id: "naksh", name: "Naksh", hint: "Warm, thoughtful" },
  { id: "atlas", name: "Atlas", hint: "Confident, commanding" },
  { id: "aurora", name: "Aurora", hint: "Serene, steady" },
  { id: "liora", name: "Liora", hint: "Calm, grounded" },
];

const HINT_BY_ID = new Map(FALLBACK_TTS_VOICES.map((voice) => [voice.id, voice.hint]));

export function normalizeTtsVoiceId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function parseTtsVoice(value: unknown, allowed?: readonly string[]): string {
  const id = normalizeTtsVoiceId(value);
  if (!id) return DEFAULT_TTS_VOICE;
  if (allowed && allowed.length > 0) {
    return allowed.includes(id) ? id : DEFAULT_TTS_VOICE;
  }
  if (FALLBACK_TTS_VOICES.some((voice) => voice.id === id)) return id;
  if (/^[a-z][a-z0-9_-]{1,40}$/.test(id)) return id;
  return DEFAULT_TTS_VOICE;
}

export function formatTtsVoiceName(id: string): string {
  const known = FALLBACK_TTS_VOICES.find((voice) => voice.id === id);
  if (known) return known.name;
  if (!id) return "Eve";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function titleCaseVoice(id: string, name?: string): string {
  const cleaned = name?.trim();
  if (cleaned) return cleaned;
  return formatTtsVoiceName(id);
}

let voicesCache: { at: number; voices: TtsVoice[] } | null = null;
const VOICES_CACHE_MS = 60 * 60 * 1000;

export async function fetchXaiTtsVoices(): Promise<TtsVoice[] | null> {
  if (!hasXaiKey()) return null;
  try {
    const response = await fetch(`${XAI_API_BASE}/tts/voices`, {
      headers: { Authorization: `Bearer ${requireXaiKey()}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      voices?: { voice_id?: string; id?: string; name?: string; language?: string | null }[];
    };
    const voices: TtsVoice[] = [];
    for (const row of data.voices ?? []) {
      const id = normalizeTtsVoiceId(row.voice_id ?? row.id);
      if (!id) continue;
      voices.push({
        id,
        name: titleCaseVoice(id, row.name),
        hint: HINT_BY_ID.get(id),
      });
    }
    return voices.length > 0 ? voices : null;
  } catch {
    return null;
  }
}

export async function listTtsVoices(): Promise<TtsVoice[]> {
  if (voicesCache && Date.now() - voicesCache.at < VOICES_CACHE_MS) {
    return voicesCache.voices;
  }
  const live = await fetchXaiTtsVoices();
  const voices = live ?? FALLBACK_TTS_VOICES;
  voicesCache = { at: Date.now(), voices };
  return voices;
}

export function allowedTtsVoiceIds(voices: readonly TtsVoice[]): string[] {
  return voices.map((voice) => voice.id);
}
