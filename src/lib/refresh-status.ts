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
  continuing?: boolean;
  progressed?: boolean;
};

export function refreshStatusLabel(data: RefreshResult): string {
  if (data.reason === "transcript-in-progress") {
    return "Transcribing…";
  }
  if (data.reason === "audio-pending") {
    return "Writing audio…";
  }
  if (data.reason === "no-full-transcript") {
    return "No full transcript yet";
  }
  if (data.reason === "missing-xai-key" || data.canGenerate === false) {
    return data.created
      ? `Added ${data.created} · add XAI_API_KEY`
      : "Add XAI_API_KEY";
  }
  if (data.errors && data.errors.length > 0 && !data.generated) {
    return data.errors[0] ?? "Brief failed";
  }
  if (data.generated && data.generated > 0) {
    const wrote = `Wrote ${data.generated}`;
    if (data.remaining && data.remaining > 0) {
      return `${wrote} · ${data.remaining} left`;
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
  if (data.error || data.reason === "missing-xai-key") return false;
  if (data.reason === "transcript-in-progress" || data.reason === "audio-pending") return true;
  return Boolean(data.remaining && data.remaining > 0);
}

export function refreshShouldContinue(status: number, data: RefreshResult): boolean {
  if (data.continuing) return false;
  if (status === 504 || status === 502) return true;
  if (data.reason === "transcript-in-progress") return true;
  return refreshHasMore(data);
}
