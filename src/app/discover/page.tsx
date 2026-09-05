import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SearchShows } from "@/components/SearchShows";

export default async function DiscoverPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl sm:text-4xl">Discover</h1>
      <SearchShows />
    </div>
  );
}
