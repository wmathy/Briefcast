export type RefreshResult = {
  created?: number;
  fetched?: number;
  generating?: number;
  generated?: number;
  canGenerate?: boolean;
  reason?: string | null;
  error?: string;
  errors?: string[];
};

export function refreshStatusLabel(data: RefreshResult): string {
  if (data.reason === "missing-xai-key" || data.canGenerate === false) {
    return data.created
      ? `Added ${data.created} · add XAI_API_KEY to write briefs`
      : "New episode found · add XAI_API_KEY";
  }
  if (data.generated && data.generated > 0) {
    return data.created
      ? `Added ${data.created} · wrote ${data.generated} brief${data.generated === 1 ? "" : "s"}`
      : `Wrote ${data.generated} brief${data.generated === 1 ? "" : "s"}`;
  }
  if (data.errors && data.errors.length > 0) {
    return data.errors[0] ?? "Brief failed";
  }
  if (data.created) {
    return `Added ${data.created} episode${data.created === 1 ? "" : "s"}`;
  }
  return "No new episodes";
}
