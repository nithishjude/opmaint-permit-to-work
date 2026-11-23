// 24-hour site timeline: one row per area, a bar per permit, a "now" line and
// red hatched zones where incompatible permits overlap (simultaneous
// operations). Colour = status, always repeated in the legend, the tooltip and
// the bar's accessible name. The list views below are its table equivalent.

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { SiteTimelineData, TimelineBar } from "@/server/permits/queries";
import { STATUS_LABELS, type PermitStatus } from "@/domain/enums";
import { getPermitType } from "@/domain/permit-types";
import { formatDateTime, formatTime } from "@/lib/time";
import { typeIcon } from "./icons";
import { TimelineScroller } from "./timeline-scroller";

const LANE_H = 30;
const LANE_GAP = 6;
const ROW_PAD = 10;
const IST_MS = 330 * 60_000;

const BAR: Record<string, string> = {
  ACTIVE: "bg-good text-white border-good",
  SUSPENDED: "bg-critical text-white border-critical",
  APPROVED: "bg-info-soft text-info border-info-line",
  PENDING_APPROVAL: "bg-warning-soft text-warning border-warning-fill border-dashed",
  CLOSED: "bg-ground-alt text-ink-muted border-line-strong",
  CLOSED_VERIFIED: "bg-ground-alt text-ink-muted border-line-strong",
  EXPIRED: "bg-white text-ink-faint border-line-strong border-dashed",
};

const LEGEND: { status: PermitStatus; label?: string }[] = [
  { status: "ACTIVE" },
  { status: "SUSPENDED" },
  { status: "APPROVED", label: "Approved, not started" },
  { status: "PENDING_APPROVAL" },
  { status: "CLOSED", label: "Closed" },
];

function hourTicks(from: Date, to: Date) {
  // Whole IST hours inside the window.
  const first = Math.ceil((from.getTime() + IST_MS) / 3_600_000) * 3_600_000 - IST_MS;
  const ticks: { t: Date; label: boolean }[] = [];
  for (let t = first; t <= to.getTime(); t += 3_600_000) {
    const istHour = new Date(t + IST_MS).getUTCHours();
    ticks.push({ t: new Date(t), label: istHour % 3 === 0 });
  }
  return ticks;
}

export function SiteTimeline({ data }: { data: SiteTimelineData }) {
  const span = data.to.getTime() - data.from.getTime();
  const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - data.from.getTime()) / span) * 100));
  const ticks = hourTicks(data.from, data.to);
  const nowPct = pct(data.now);
  const conflicts = data.rows.reduce((n, r) => n + r.conflicts.length, 0);
  const conflictAreas = data.rows.filter((r) => r.conflicts.length > 0).map((r) => r.label);

  return (
    <section aria-labelledby="h-timeline" className="card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id="h-timeline" className="panel-title">
            Site timeline
          </h2>
          <p className="text-[14px] text-ink-muted">Every permit by area, from 8 h ago to 16 h ahead</p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-2" aria-label="Legend">
          {LEGEND.map((l) => (
            <li key={l.status} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-3 w-5 rounded-[3px] border ${BAR[l.status]}`} />
              {l.label ?? STATUS_LABELS[l.status]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="simops h-3 w-5 rounded-[3px] border border-critical" />
            Simultaneous operations
          </li>
        </ul>
      </div>

      {conflicts > 0 && (
        <p className="flex items-center gap-2 border-b border-critical-line bg-critical-soft px-5 py-2.5 text-[14px] font-medium text-ink">
          <ShieldAlert aria-hidden className="h-4 w-4 shrink-0 text-critical" />
          Hot work overlaps confined-space entry in {conflictAreas.join(", ")} — check before approving or starting.
        </p>
      )}

      {data.rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-ink-muted">Nothing planned or running in this window.</p>
      ) : (
        <TimelineScroller nowPct={nowPct}>
          <div className="min-w-[820px] pb-5 pt-3 [--lab:116px] sm:[--lab:168px]">
            {/* axis */}
            <div className="grid grid-cols-[var(--lab)_1fr] pr-5">
              <div className="sticky left-0 z-30 bg-white" />
              <div className="relative h-7" data-track>
                {ticks
                  // keep hour labels clear of the "Now" marker
                  .filter((t) => t.label && Math.abs(pct(t.t) - nowPct) > 5)
                  .map((t) => (
                    <span key={t.t.toISOString()} className="absolute top-1 -translate-x-1/2 font-mono text-[12px] text-ink-muted" style={{ left: `${pct(t.t)}%` }}>
                      {formatTime(t.t)}
                    </span>
                  ))}
                <span
                  className="absolute top-0 z-20 -translate-x-1/2 rounded-full bg-action px-2 py-0.5 font-mono text-[12px] font-semibold text-white"
                  style={{ left: `${nowPct}%` }}
                >
                  Now {formatTime(data.now)}
                </span>
              </div>
            </div>

            <div className="relative">
              {/* rows */}
              {data.rows.map((row, ri) => {
                const h = row.lanes * LANE_H + (row.lanes - 1) * LANE_GAP + ROW_PAD * 2;
                return (
                  <div key={row.areaId} className={`grid grid-cols-[var(--lab)_1fr] pr-5 ${ri > 0 ? "border-t border-line" : ""}`}>
                    <div className="sticky left-0 z-30 flex flex-col justify-center border-r border-line bg-white pl-4 pr-3 sm:pl-5 lg:border-r-0" style={{ minHeight: h }}>
                      <span className="text-[13px] font-semibold leading-tight sm:text-[14px]">{row.label}</span>
                      <span className="text-[12px] text-ink-muted">
                        {row.plant} · {row.bars.length} permit{row.bars.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="relative" style={{ height: h }}>
                      {/* hour gridlines */}
                      {ticks
                        .filter((t) => t.label)
                        .map((t) => (
                          <span key={t.t.toISOString()} aria-hidden className="absolute inset-y-0 w-px bg-line" style={{ left: `${pct(t.t)}%` }} />
                        ))}
                      {row.conflicts.map((c, i) => (
                        <span
                          key={i}
                          title={`Simultaneous operations: ${c.between.join(" and ")}, ${formatTime(c.start)}–${formatTime(c.end)}`}
                          className="simops pointer-events-none absolute inset-y-1 z-[16] rounded-[4px] border-x-2 border-critical"
                          style={{ left: `${pct(c.start)}%`, width: `${Math.max(0.6, pct(c.end) - pct(c.start))}%` }}
                        />
                      ))}
                      {row.bars.map((b) => (
                        <Bar key={b.id} bar={b} left={pct(b.start)} width={Math.max(1.2, pct(b.end) - pct(b.start))} top={ROW_PAD + b.lane * (LANE_H + LANE_GAP)} startsBefore={b.start < data.from} endsAfter={b.end > data.to} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* now line across all rows */}
              <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[var(--lab)] right-5">
                <span className="absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-action" style={{ left: `${nowPct}%` }} />
              </div>
            </div>
          </div>
        </TimelineScroller>
      )}
    </section>
  );
}

function Bar({ bar, left, width, top, startsBefore, endsAfter }: { bar: TimelineBar; left: number; width: number; top: number; startsBefore: boolean; endsAfter: boolean }) {
  const Icon = typeIcon(bar.type);
  const def = getPermitType(bar.type);
  const wide = width > 9;
  const label = `${bar.number}, ${def?.label}, ${STATUS_LABELS[bar.status]}, ${formatDateTime(bar.start)} to ${formatDateTime(bar.end)}: ${bar.workDescription}`;
  return (
    <Link
      href={`/permits/${bar.id}`}
      aria-label={label}
      className={`group absolute z-[15] flex items-center gap-1.5 overflow-visible border px-2 text-[12px] font-semibold transition-[box-shadow,filter] duration-out ease-ui hover:z-30 hover:shadow-[0_0_0_2px_#fff,0_0_0_4px_rgba(11,37,69,.55)] focus-visible:z-30 ${BAR[bar.status] ?? BAR.CLOSED} ${
        startsBefore ? "rounded-l-none border-l-0" : "rounded-l-[6px]"
      } ${endsAfter ? "rounded-r-none border-r-0" : "rounded-r-[6px]"}`}
      style={{ left: `${left}%`, width: `${width}%`, top, height: LANE_H }}
    >
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      {wide && <span className="truncate font-mono">{bar.number.replace(/^PTW-\d{4}-/, "")}</span>}
      {/* tooltip (desktop hover / keyboard focus) */}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-40 mb-2 w-[280px] rounded-md border border-line bg-white p-3 text-left text-ink opacity-0 shadow-[0_12px_32px_-12px_rgba(11,37,69,.35)] transition-opacity duration-out group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
      >
        <span className="flex items-center gap-2 font-mono text-[13px] font-semibold">{bar.number}</span>
        <span className="mt-0.5 block text-[13px] font-medium text-ink-muted">
          {def?.label} · {STATUS_LABELS[bar.status]}
        </span>
        <span className="mt-1.5 line-clamp-2 block text-[14px] font-medium leading-snug">{bar.workDescription}</span>
        <span className="mt-1.5 block font-mono text-[12px] text-ink-muted">
          {formatDateTime(bar.start)} → {formatDateTime(bar.end)}
        </span>
      </span>
    </Link>
  );
}
