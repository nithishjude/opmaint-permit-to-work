// A gas / atmosphere reading against its safe band: the green band is "safe",
// the marker is the reading. Out-of-band readings turn the marker red (and the
// field around it says so in words).

import type { NumberField } from "@/domain/permit-types";

function domain(f: NumberField, v: number): [number, number] {
  const lo = f.safeRange?.min;
  const hi = f.safeRange?.max;
  if (lo !== undefined && hi !== undefined) {
    const pad = (hi - lo) * 1.25;
    return [Math.max(f.min ?? -Infinity, Math.min(lo - pad, v)), Math.max(hi + pad, v)];
  }
  if (hi !== undefined) return [0, Math.max(hi * 2.5, v * 1.15, 5)];
  if (lo !== undefined) return [0, Math.max(lo * 2, v * 1.15)];
  return [0, Math.max(v * 1.2, 1)];
}

export function ReadingMeter({ field, value }: { field: NumberField; value: number }) {
  const [d0, d1] = domain(field, value);
  const pos = (x: number) => Math.min(100, Math.max(0, ((x - d0) / (d1 - d0)) * 100));
  const lo = field.safeRange?.min ?? d0;
  const hi = field.safeRange?.max ?? d1;
  const bad = (field.safeRange?.min !== undefined && value < field.safeRange.min) || (field.safeRange?.max !== undefined && value > field.safeRange.max);
  return (
    <div className="mt-2" aria-hidden>
      <div className="relative h-2 rounded-full bg-critical-soft">
        <span className="absolute inset-y-0 rounded-full bg-good/25" style={{ left: `${pos(lo)}%`, width: `${Math.max(1.5, pos(hi) - pos(lo))}%` }} />
        <span
          className={`absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${bad ? "bg-critical" : "bg-ink"}`}
          style={{ left: `${pos(value)}%` }}
        />
      </div>
    </div>
  );
}
