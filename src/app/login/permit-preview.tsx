// A still preview of a live permit, built from the app's own components, so
// the login screen shows the actual product rather than empty space.
// Static on purpose: no countdown ticking, no motion.

import { CircleCheck, Clock, MapPin, ShieldAlert } from "lucide-react";
import { StatusBadge, TypeBadge } from "@/components/badges";

function Reading({ label, value, safe, pos, band }: { label: string; value: string; safe: string; pos: number; band: [number, number] }) {
  return (
    <div className="rounded-sm border border-line p-3">
      <div className="text-[12px] font-medium text-ink-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[17px] font-semibold text-ink">{value}</div>
      <div className="font-mono text-[11.5px] text-ink-faint">safe {safe}</div>
      <div className="relative mt-2 h-2 rounded-full bg-critical-soft">
        <span className="absolute inset-y-0 rounded-full bg-good/25" style={{ left: `${band[0]}%`, width: `${band[1] - band[0]}%` }} />
        <span className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-white" style={{ left: `${pos}%` }} />
      </div>
    </div>
  );
}

export function PermitPreview() {
  return (
    <div aria-hidden className="w-[360px] select-none 2xl:w-[400px]">
      <div className="rounded-md border-l-[6px] border-l-good bg-white p-5 text-ink shadow-[0_30px_60px_-24px_rgba(22,51,0,.45)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[15px] font-semibold">PTW-2026-0001</span>
          <TypeBadge type="HOT_WORK" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <StatusBadge status="ACTIVE" />
          <span className="font-mono text-[15px] font-semibold text-good">3h 12m left</span>
        </div>
        <p className="mt-3 text-[16px] font-semibold leading-snug">Weld support bracket on pipe rack PR-3</p>
        <div className="mt-2 space-y-1 text-[13px] text-ink-muted">
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> Crude Distillation Unit › PR-3
          </p>
          <p className="flex items-center gap-1.5 font-mono">
            <Clock className="h-3.5 w-3.5" /> 23 Nov, 09:00 → 23 Nov, 17:00
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Reading label="LEL" value="0 %" safe="≤ 0%" pos={3} band={[0, 6]} />
          <Reading label="O₂" value="20.9 %" safe="19.5–23.5%" pos={52} band={[28, 76]} />
        </div>

        <ul className="mt-4 space-y-2 border-t border-line pt-4 text-[13px]">
          {[
            ["Area owner", "Priya Natarajan"],
            ["Safety officer", "Karthik Raman"],
          ].map(([role, name]) => (
            <li key={role} className="flex items-center justify-between gap-2">
              <span className="font-semibold">{role}</span>
              <span className="flex items-center gap-1.5 text-ink-muted">
                {name}
                <CircleCheck className="h-4 w-4 text-good" />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="ml-8 mt-3 flex items-start gap-2.5 rounded-md border border-critical-line bg-critical-soft p-3 text-[13px] text-ink shadow-[0_16px_40px_-20px_rgba(22,51,0,.4)]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
        <span>
          <span className="font-semibold">Simultaneous operations.</span> Hot work overlaps a confined-space entry in Tank Farm.
        </span>
      </div>
    </div>
  );
}
