export type RefreshResult = {
  created?: number;
  fetched?: number;
  generating?: number;
  generated?: number;
  remaining?: number;
  skipped?: number;
  canGenerate?: boolean;
  reason?: string | null;
  error?: string;
  errors?: string[];
};

export function refreshStatusLabel(data: RefreshResult): string {
  if (data.reason === "no-full-transcript") {
    return "Full transcript not available yet — no brief";
  }
  if (data.reason === "missing-xai-key" || data.canGenerate === false) {
    return data.created
      ? `Added ${data.created} · add XAI_API_KEY to write briefs`
      : "New episode found · add XAI_API_KEY";
  }
  if (data.errors && data.errors.length > 0 && !data.generated) {
    return data.errors[0] ?? "Brief failed";
  }
  if (data.generated && data.generated > 0) {
    const wrote = `Wrote ${data.generated} brief${data.generated === 1 ? "" : "s"}`;
    if (data.remaining && data.remaining > 0) {
      return `${wrote}. ${data.remaining} more still need a recap.`;
    }
    if (data.created) {
      return `Added ${data.created} · ${wrote.toLowerCase()}`;
    }
    return wrote;
  }
  if (data.errors && data.errors.length > 0) {
    return data.errors[0] ?? "Brief failed";
  }
  if (data.created) {
    return `Added ${data.created} episode${data.created === 1 ? "" : "s"}`;
  }
  return "No new episodes";
}

export function refreshHasMore(data: RefreshResult): boolean {
  return Boolean(
    data.remaining &&
      data.remaining > 0 &&
      (data.generated ?? 0) > 0 &&
      !data.error &&
      data.reason !== "missing-xai-key",
  );
}
