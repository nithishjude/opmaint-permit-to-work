"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, Plus, Settings } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/permits", label: "Permits", icon: ClipboardList, match: (p: string) => p.startsWith("/permits") && p !== "/permits/new" },
  { href: "/permits/new", label: "New permit", icon: Plus, match: (p: string) => p === "/permits/new" },
];

export function MainNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items = isAdmin ? [...ITEMS, { href: "/admin", label: "Admin", icon: Settings, match: (p: string) => p.startsWith("/admin") }] : ITEMS;
  return (
    <nav aria-label="Main" className="-mb-px flex gap-1 overflow-x-auto">
      {items.map(({ href, label, icon: Icon, match }) => {
        const current = match(path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`group relative flex min-h-[48px] items-center gap-2 whitespace-nowrap px-2.5 text-[15px] sm:px-3 font-medium transition-colors duration-out ease-ui ${
              current ? "text-white" : "text-white/70 hover:text-white"
            }`}
          >
            <Icon aria-hidden className="h-[18px] w-[18px]" />
            {label}
            <span
              aria-hidden
              className={`absolute inset-x-3 bottom-0 h-0.5 origin-left bg-white transition-transform duration-out ease-ui ${
                current ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 group-hover:bg-white/40"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
