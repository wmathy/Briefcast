import { describe, expect, it } from "vitest";
import {
  DEFAULT_TTS_VOICE,
  FALLBACK_TTS_VOICES,
  formatTtsVoiceName,
  parseTtsVoice,
} from "./tts-voice";

describe("parseTtsVoice", () => {
  it("defaults to eve and keeps known built-in ids", () => {
    expect(DEFAULT_TTS_VOICE).toBe("eve");
    expect(parseTtsVoice(undefined)).toBe("eve");
    expect(parseTtsVoice("Eve")).toBe("eve");
    expect(parseTtsVoice("ara")).toBe("ara");
    expect(parseTtsVoice("not a voice!!!")).toBe("eve");
    expect(parseTtsVoice("helix", ["eve", "ara"])).toBe("eve");
    expect(parseTtsVoice("ara", ["eve", "ara"])).toBe("ara");
  });

  it("includes the documented built-in roster as a fallback", () => {
    const ids = FALLBACK_TTS_VOICES.map((voice) => voice.id);
    expect(ids).toContain("eve");
    expect(ids).toContain("leo");
    expect(ids).toContain("liora");
    expect(formatTtsVoiceName("eve")).toBe("Eve");
  });
});
