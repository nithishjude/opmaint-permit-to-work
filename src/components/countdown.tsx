"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";
import { EXPIRING_SOON_MS } from "@/domain/guards";

/**
 * Live countdown to a permit's validUntil. It is display only — expiry itself
 * is enforced on the server. When it hits zero it asks the page to refresh
 * so the server can show the permit as EXPIRED.
 */
export function Countdown({ until, label = "left", size = "sm", refreshOnZero = true }: { until: string | Date; label?: string; size?: "sm" | "lg"; refreshOnZero?: boolean }) {
  const target = new Date(until).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = now === null ? null : target - now;

  useEffect(() => {
    if (refreshOnZero && left !== null && left <= 0 && left > -2000) {
      // Give the server a moment, then reload to pick up the EXPIRED state.
      const t = setTimeout(() => window.location.reload(), 1500);
      return () => clearTimeout(t);
    }
  }, [left, refreshOnZero]);

  if (left === null) return <span className={size === "lg" ? "text-3xl font-black" : "font-semibold"}>…</span>;

  const tone = left <= 0 ? "text-red-700" : left <= 30 * 60_000 ? "text-red-700" : left <= EXPIRING_SOON_MS ? "text-amber-700" : "text-green-800";
  const text = left <= 0 ? "Expired" : `${formatDuration(left)} ${label}`;

  return (
    <span className={`tabular-nums ${tone} ${size === "lg" ? "text-3xl font-black sm:text-4xl" : "font-bold"}`} role="timer" aria-live="off">
      {text}
    </span>
  );
}
