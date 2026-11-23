import { Suspense } from "react";
import Link from "next/link";
import { requirePageUser } from "@/server/auth";
import { navCounts } from "@/server/permits/queries";
import { ROLE_LABELS } from "@/domain/enums";
import { LogoutButton } from "@/components/logout-button";
import { SideNav, TabBar } from "@/components/app-nav";
import { BrandMark } from "@/components/brand-mark";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const counts = await navCounts(user);
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="min-h-screen lg:pl-[260px]">
      <a href="#main" className="absolute left-2 top-2 z-50 -translate-y-24 rounded-sm bg-white px-3 py-2 text-ink focus:translate-y-0">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[260px] flex-col bg-navy text-white lg:flex">
        <Link href="/" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5 text-[17px] font-semibold tracking-tight">
          <BrandMark />
          <span>
            Permit to Work
            <span className="block text-[12px] font-medium text-white/50">CMMS · Safety module</span>
          </span>
        </Link>
        <Suspense>
          <SideNav isAdmin={user.role === "ADMIN"} counts={counts} />
        </Suspense>
        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[14px] font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[14px] font-semibold">{user.name}</div>
            <div className="truncate text-[13px] text-white/55">{ROLE_LABELS[user.role]}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Phone / tablet top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-navy-deep bg-navy px-4 text-white lg:hidden">
        <Link href="/" className="flex items-center gap-2 text-[16px] font-semibold">
          <BrandMark className="h-7 w-7" />
          Permit to Work
        </Link>
        <span className="ml-auto text-right text-[13px] leading-tight text-white/70">
          {user.name.split(" ")[0]}
          <span className="block text-white/45">{ROLE_LABELS[user.role]}</span>
        </span>
        <LogoutButton />
      </header>

      <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        {children}
      </main>

      <Suspense>
        <TabBar approvals={counts.approvals} />
      </Suspense>
    </div>
  );
}
