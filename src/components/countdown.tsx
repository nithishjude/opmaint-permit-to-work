"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";
import { EXPIRING_SOON_MS } from "@/domain/guards";

/**
 * Live countdown to a permit's validUntil. It is display only — expiry itself
 * is enforced on the server. When it hits zero it asks the page to refresh
 * so the server can show the permit as EXPIRED.
 */
export function Countdown({ until, label = "left", size = "sm", refreshOnZero = true, neutral = false }: { until: string | Date; label?: string; size?: "sm" | "lg"; refreshOnZero?: boolean; neutral?: boolean }) {
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

  if (left === null) return <span className={size === "lg" ? "font-mono text-4xl font-semibold" : "font-mono font-semibold"}>…</span>;

  const tone = neutral ? "text-ink-2" : left <= 30 * 60_000 ? "text-critical" : left <= EXPIRING_SOON_MS ? "text-warning" : "text-good";
  const text = left <= 0 ? "Expired" : `${formatDuration(left)} ${label}`;

  return (
    <span className={`font-mono tabular-nums tracking-tight ${tone} ${size === "lg" ? "text-[32px] font-semibold leading-none sm:text-[40px]" : "text-[14px] font-semibold"}`} role="timer" aria-live="off">
      {text}
    </span>
  );
}
