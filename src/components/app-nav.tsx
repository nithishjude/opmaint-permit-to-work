"use client";

// Navigation: a navy sidebar on desktop, a bottom tab bar on phones (reachable
// with one thumb, gloves on). Same destinations in both.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ClipboardList, Hourglass, LayoutDashboard, OctagonPause, Plus, Settings, Timer, type LucideIcon } from "lucide-react";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  active: (path: string, q: URLSearchParams) => boolean;
}

const MAIN: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, active: (p) => p === "/" },
  { href: "/permits", label: "All permits", icon: ClipboardList, active: (p, q) => p.startsWith("/permits") && p !== "/permits/new" && !q.get("view") && !q.get("status") },
  { href: "/permits/new", label: "Raise a permit", icon: Plus, active: (p) => p === "/permits/new" },
];
const VIEWS: Item[] = [
  { href: "/permits?view=my-approvals", label: "My sign-offs", icon: Hourglass, active: (p, q) => p === "/permits" && q.get("view") === "my-approvals" },
  { href: "/permits?view=expiring", label: "Expiring soon", icon: Timer, active: (p, q) => p === "/permits" && q.get("view") === "expiring" },
  { href: "/permits?status=SUSPENDED", label: "Work stopped", icon: OctagonPause, active: (p, q) => p === "/permits" && q.get("status") === "SUSPENDED" },
];
const ADMIN: Item = { href: "/admin", label: "Admin", icon: Settings, active: (p) => p.startsWith("/admin") };

function SideLink({ item, current }: { item: Item; current: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={`group relative flex min-h-[44px] items-center gap-3 rounded-sm px-3 text-[15px] font-medium transition-colors duration-out ease-ui ${
        current ? "bg-white/10 text-lime" : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span aria-hidden className={`absolute inset-y-2 left-0 w-[3px] rounded-r bg-lime transition-opacity duration-out ${current ? "opacity-100" : "opacity-0"}`} />
      <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}

export function SideNav({ isAdmin, counts }: { isAdmin: boolean; counts: { approvals: number; expiring: number; stopped: number } }) {
  const path = usePathname();
  const q = useSearchParams();
  const badge: Record<string, number> = { "My sign-offs": counts.approvals, "Expiring soon": counts.expiring, "Work stopped": counts.stopped };
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      <div className="space-y-1">
        {MAIN.map((i) => (
          <SideLink key={i.href} item={i} current={i.active(path, q)} />
        ))}
      </div>
      <div>
        <p className="px-3 pb-2 text-[12px] font-medium text-white/40">Needs attention</p>
        <div className="space-y-1">
          {VIEWS.map((i) => (
            <div key={i.href} className="relative">
              <SideLink item={i} current={i.active(path, q)} />
              {badge[i.label] > 0 && (
                <span
                  className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
                    i.label === "Work stopped" ? "bg-critical text-white" : i.label === "Expiring soon" ? "bg-warning-fill text-ink" : "bg-white/15 text-white"
                  }`}
                >
                  {badge[i.label]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {isAdmin && (
        <div>
          <p className="px-3 pb-2 text-[12px] font-medium text-white/40">Setup</p>
          <SideLink item={ADMIN} current={ADMIN.active(path, q)} />
        </div>
      )}
    </nav>
  );
}

export function TabBar({ approvals }: { approvals: number }) {
  const path = usePathname();
  const q = useSearchParams();
  const tabs = [
    { ...MAIN[0], label: "Home" },
    { ...MAIN[1], label: "Permits" },
    MAIN[2],
    { ...VIEWS[0], label: "Sign-offs" },
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const current = t.active(path, q);
          const isNew = t.href === "/permits/new";
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={current ? "page" : undefined}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[12px] font-medium ${current ? "text-action" : "text-ink-muted"}`}
              >
                {isNew ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-action text-lime shadow-sm">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                ) : (
                  <Icon aria-hidden className="h-[22px] w-[22px]" />
                )}
                {isNew ? "New" : t.label}
                {t.label === "Sign-offs" && approvals > 0 && (
                  <span className="absolute right-[calc(50%-22px)] top-2 min-w-[18px] rounded-full bg-action px-1 text-center text-[12px] font-semibold leading-[18px] text-lime">{approvals}</span>
                )}
                {current && !isNew && <span aria-hidden className="absolute inset-x-6 top-0 h-[3px] rounded-b bg-action" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
