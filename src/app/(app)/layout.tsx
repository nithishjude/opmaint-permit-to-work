import Link from "next/link";
import { requirePageUser } from "@/server/auth";
import { ROLE_LABELS } from "@/domain/enums";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const nav = [
    { href: "/", label: "Dashboard" },
    { href: "/permits", label: "All permits" },
    { href: "/permits/new", label: "+ New permit" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 py-2 text-lg font-black tracking-tight">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-slate-900">⚠</span>
            Permit to Work
          </Link>
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="flex min-h-[44px] items-center whitespace-nowrap rounded-md px-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-right">
            <div className="leading-tight">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-amber-300">{ROLE_LABELS[user.role]}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
      <footer className="py-4 text-center text-xs text-slate-500">All times IST (Asia/Kolkata) · Permit to Work module · demo build</footer>
    </div>
  );
}
