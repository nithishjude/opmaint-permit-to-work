import Link from "next/link";
import { requirePageUser } from "@/server/auth";
import { ROLE_LABELS } from "@/domain/enums";
import { LogoutButton } from "@/components/logout-button";
import { MainNav } from "@/components/main-nav";
import { BrandMark } from "@/components/brand-mark";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Opaque, hairline from first paint, same at every scroll depth. */}
      <header className="border-b border-navy-deep bg-navy text-white">
        <a href="#main" className="absolute left-2 top-2 z-20 -translate-y-20 rounded-sm bg-white px-3 py-2 text-ink focus:translate-y-0">
          Skip to content
        </a>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 sm:px-6">
          <Link href="/" className="flex min-h-[56px] items-center gap-2.5 text-[17px] font-semibold tracking-tight">
            <BrandMark />
            Permit to Work
          </Link>
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <MainNav isAdmin={user.role === "ADMIN"} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-[13px] text-white/60">{ROLE_LABELS[user.role]}</div>
            </div>
            <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold sm:hidden">
              {initials}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-[13px] text-ink-muted sm:px-6">
          <span>Permit to Work · CMMS module</span>
          <span>All times in IST (Asia/Kolkata)</span>
        </div>
      </footer>
    </div>
  );
}
