"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { api } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Sign out"
      className="flex h-11 w-11 items-center justify-center rounded-sm text-white/70 transition-colors duration-out ease-ui hover:bg-white/10 hover:text-white"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut aria-hidden className="h-5 w-5" />
    </button>
  );
}
