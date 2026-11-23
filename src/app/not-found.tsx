import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <SearchX aria-hidden className="h-12 w-12 text-ink-faint" />
      <h1 className="text-2xl font-semibold">Permit not found</h1>
      <p className="text-ink-muted">It may not exist, or it&apos;s a draft that belongs to someone else.</p>
      <Link href="/" className="btn-primary">
        Back to dashboard
      </Link>
    </main>
  );
}
