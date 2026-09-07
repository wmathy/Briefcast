export function PlayPauseGlyph({ playing }: { playing: boolean }) {
  if (playing) {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <rect x="3" y="2" width="3.5" height="12" rx="0.8" fill="currentColor" />
        <rect x="9.5" y="2" width="3.5" height="12" rx="0.8" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 translate-x-px" aria-hidden="true">
      <path d="M4 2.4v11.2L13.2 8 4 2.4Z" fill="currentColor" />
    </svg>
  );
}
