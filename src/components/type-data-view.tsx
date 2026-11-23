// Read-only rendering of a permit's type-specific fields, driven by the
// registry. Works for any permit type, including ones added later.

import { TriangleAlert } from "lucide-react";
import { ReadingMeter } from "./reading-meter";
import { describeRange, isOutsideSafeRange, type FieldDef, type TypeData } from "@/domain/permit-types";
import { formatDateTime } from "@/lib/time";

export function formatFieldValue(f: FieldDef, v: unknown): string {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
  switch (f.kind) {
    case "boolean":
      return v ? "Yes" : "No";
    case "number":
      return `${v}${f.unit ?? ""}`;
    case "select":
      return f.options.find((o) => o.value === v)?.label ?? String(v);
    case "multiselect":
      return (v as string[]).map((x) => f.options.find((o) => o.value === x)?.label ?? x).join(", ");
    case "datetime":
      return formatDateTime(String(v));
    case "stringList":
      return (v as string[]).join(", ");
    default:
      return String(v);
  }
}

export function groupFields(fields: readonly FieldDef[]): [string, FieldDef[]][] {
  const groups = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const g = f.group ?? "Details";
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  return [...groups.entries()];
}

export function TypeDataView({ fields, data }: { fields: readonly FieldDef[]; data: TypeData }) {
  return (
    <div className="space-y-6">
      {groupFields(fields).map(([group, fs]) => (
        <div key={group}>
          <h4 className="mb-2.5 text-[15px] font-semibold text-ink">{group}</h4>
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {fs.map((f) => {
              const v = data[f.name];
              const bad = isOutsideSafeRange(f, v);
              const missing = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
              const wide = f.kind === "textarea" || f.kind === "stringList" || f.kind === "multiselect";
              return (
                <div
                  key={f.name}
                  className={`rounded-sm border p-3 ${wide ? "sm:col-span-2" : ""} ${
                    bad ? "border-critical-line bg-critical-soft" : missing && f.requiredFor === "activate" ? "border-dashed border-warning-line bg-warning-soft/40" : "border-line bg-white"
                  }`}
                >
                  <dt className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink-muted">
                    <span>{f.label}</span>
                    {f.kind === "number" && f.safeRange && <span className="font-mono text-[12px] text-ink-faint">safe {describeRange(f)}</span>}
                  </dt>
                  <dd className={`mt-1 font-semibold ${f.kind === "number" || f.kind === "datetime" ? "font-mono text-[17px]" : "text-[15px] leading-snug"} ${bad ? "text-critical" : missing ? "text-ink-faint" : "text-ink"}`}>
                    {missing && f.requiredFor === "activate" ? (
                      <span className="font-sans text-[14px] font-medium text-warning">Needed before work starts</span>
                    ) : (
                      formatFieldValue(f, v)
                    )}
                  </dd>
                  {f.kind === "number" && f.safeRange && typeof v === "number" && <ReadingMeter field={f} value={v} />}
                  {bad && (
                    <p className="mt-1.5 flex items-center gap-1 text-[13px] font-semibold text-critical">
                      <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> Outside safe range
                    </p>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
