export function stripHtml(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(div|li|h[1-6])>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractGuest(title: string, description: string): string | null {
  const text = `${title}\n${description}`;
  const patterns = [
    /(?:guest|featuring|feat\.?|with guest)\s+([A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){0,3})/i,
    /tells host\s+([A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){0,3})/i,
    /(?:NPR's|correspondent)\s+([A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){1,2})\s+(?:was|is|tells|reports|visits)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].replace(/\s+/g, " ").trim();
      if (name.length > 3 && name.length < 60) return name;
    }
  }
  return null;
}

export function looksLikeTranscriptUrl(url: string): boolean {
  return /\.(json|txt|srt|vtt|html)(\?|$)/i.test(url) || /transcript/i.test(url);
}
