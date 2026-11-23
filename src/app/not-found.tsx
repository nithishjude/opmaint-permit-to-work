import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl">🔍</p>
      <h1 className="text-2xl font-black">Permit not found</h1>
      <p className="text-slate-600">It may not exist, or it&apos;s a draft that belongs to someone else.</p>
      <Link href="/" className="btn-primary">
        Back to dashboard
      </Link>
    </main>
  );
}
