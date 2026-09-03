import { XAI_API_BASE, XAI_CHAT_MODELS, requireXaiKey } from "@/lib/env";
import { splitBufferForStt } from "@/lib/audio-chunks";
import { XAI_TTS_MAX_CHARS, concatMp3, splitTextForTts } from "@/lib/tts";

export async function xaiChatJson(prompt: string): Promise<string> {
  const key = requireXaiKey();
  let lastError = "xAI chat failed.";

  for (const model of XAI_CHAT_MODELS) {
    const response = await fetch(`${XAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You write faithful podcast briefs from provided source text only. Never invent quotes, guests, or topics. Return JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
      lastError = "xAI chat returned an empty brief.";
      continue;
    }

    const body = await response.text();
    lastError = `xAI chat error ${response.status}: ${body.slice(0, 280)}`;
    if (response.status !== 404) break;
  }

  throw new Error(lastError);
}

async function xaiTtsMp3Chunk(text: string, speed: number): Promise<Buffer> {
  if (text.length > XAI_TTS_MAX_CHARS) {
    throw new Error(
      `xAI TTS chunk is ${text.length} characters; the unary API cap is ${XAI_TTS_MAX_CHARS}.`,
    );
  }

  const key = requireXaiKey();
  const response = await fetch(`${XAI_API_BASE}/tts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: "eve",
      language: "en",
      speed,
      output_format: {
        codec: "mp3",
        sample_rate: 44100,
        bit_rate: 128000,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`xAI TTS error ${response.status}: ${body.slice(0, 280)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export function formatDiarizedTranscript(result: {
  text?: string;
  words?: { text?: string; speaker?: number }[];
}): string {
  const words = result.words ?? [];
  if (words.some((word) => typeof word.speaker === "number")) {
    const lines: string[] = [];
    let current: number | undefined;
    let buffer: string[] = [];
    const flush = () => {
      if (!buffer.length) return;
      const label = current == null ? "Speaker" : `Speaker ${current + 1}`;
      lines.push(`${label}: ${buffer.join(" ")}`);
      buffer = [];
    };
    for (const word of words) {
      if (word.speaker !== current && buffer.length) flush();
      current = word.speaker;
      if (word.text) buffer.push(word.text);
    }
    flush();
    if (lines.length >= 2 || lines.join(" ").trim().length > 80) return lines.join("\n");
  }
  return (result.text ?? "").trim();
}

const MAX_STT_DOWNLOAD_BYTES = 180 * 1024 * 1024;

export type SttResult = {
  text: string;
  duration: number;
  chunks: number;
};

function sttForm(keyterms: string[]): FormData {
  const form = new FormData();
  form.append("format", "true");
  form.append("language", "en");
  form.append("diarize", "true");
  for (const term of keyterms.filter(Boolean).slice(0, 8)) {
    form.append("keyterm", term.slice(0, 50));
  }
  return form;
}

async function postStt(form: FormData): Promise<SttResult | null> {
  const key = requireXaiKey();
  const response = await fetch(`${XAI_API_BASE}/stt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(240_000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    text?: string;
    duration?: number;
    words?: { text?: string; speaker?: number }[];
  };
  const text = formatDiarizedTranscript(data);
  if (text.length <= 80) return null;
  return { text, duration: typeof data.duration === "number" ? data.duration : 0, chunks: 1 };
}

async function fetchAudioForStt(audioUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(audioUrl, {
      headers: {
        Accept: "audio/*,*/*",
        "User-Agent": "Briefcast/0.1 (+https://github.com/wmathy/Briefcast)",
      },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 80 || buffer.byteLength > MAX_STT_DOWNLOAD_BYTES) return null;
    return buffer;
  } catch {
    return null;
  }
}

async function sttChunks(file: Buffer, keyterms: string[]): Promise<SttResult | null> {
  const parts = splitBufferForStt(file);
  if (parts.length === 0) return null;
  const texts: string[] = [];
  let duration = 0;
  for (const [index, part] of parts.entries()) {
    const form = sttForm(keyterms);
    form.append(
      "file",
      new Blob([Uint8Array.from(part)], { type: "audio/mpeg" }),
      `episode-${index + 1}.mp3`,
    );
    const result = await postStt(form);
    if (!result) return null;
    texts.push(result.text);
    duration += result.duration;
  }
  const text = texts.join("\n");
  return text.length > 80 ? { text, duration, chunks: parts.length } : null;
}

export async function xaiSttFromAudioUrl(
  audioUrl: string,
  keyterms: string[] = [],
): Promise<SttResult | null> {
  const file = await fetchAudioForStt(audioUrl);
  if (file) {
    const fromFile = await sttChunks(file, keyterms);
    if (fromFile) return fromFile;
  }

  const viaUrl = sttForm(keyterms);
  viaUrl.append("url", audioUrl);
  return postStt(viaUrl);
}

export async function xaiTtsMp3(text: string, speed: number): Promise<Buffer> {
  const chunks = splitTextForTts(text);
  if (chunks.length === 0) {
    throw new Error("Spoken recap is empty; nothing to synthesize.");
  }

  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    parts.push(await xaiTtsMp3Chunk(chunk, speed));
  }
  return concatMp3(parts);
}
