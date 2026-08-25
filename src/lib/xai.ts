import { XAI_API_BASE, XAI_CHAT_MODELS, requireXaiKey } from "@/lib/env";

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

export async function xaiTtsMp3(text: string, speed: number): Promise<Buffer> {
  const key = requireXaiKey();
  const clipped = text.slice(0, 15000);
  const response = await fetch(`${XAI_API_BASE}/tts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: clipped,
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
