"use client";

import { useEffect, useRef } from "react";

/**
 * On narrow screens the timeline scrolls sideways. Open it with "now" in view
 * (a third of the way in) instead of 8 hours ago. A one-time scroll on mount;
 * nothing moves after that.
 */
export function TimelineScroller({ nowPct, children }: { nowPct: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const track = el.querySelector<HTMLElement>("[data-track]");
    if (!track) return;
    // Track position inside the scroll content; the area labels to its left stay pinned.
    const trackLeft = track.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    const x = trackLeft + (track.offsetWidth * nowPct) / 100;
    el.scrollLeft = Math.max(0, x - (trackLeft + (el.clientWidth - trackLeft) * 0.3));
  }, [nowPct]);
  return (
    <div ref={ref} className="overflow-x-auto lg:overflow-visible">
      {children}
    </div>
  );
}
