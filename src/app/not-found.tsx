import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Not found</h1>
      <Link href="/library" className="tap pressable inline-flex items-center rounded-md text-accent underline">
        Back to library
      </Link>
    </div>
  );
}
