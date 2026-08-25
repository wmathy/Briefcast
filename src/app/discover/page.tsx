import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SearchShows } from "@/components/SearchShows";

export default async function DiscoverPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Discover</h1>
        <p className="mt-2 text-muted">
          Search the iTunes catalog and follow your own shows. Briefcast does not ship a hardcoded show list.
        </p>
      </div>
      <SearchShows />
    </div>
  );
}
