// Read-only rendering of a permit's type-specific fields, driven by the
// registry. Works for any permit type, including ones added later.

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
    <div className="space-y-5">
      {groupFields(fields).map(([group, fs]) => (
        <div key={group}>
          <h4 className="section-title mb-2">{group}</h4>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {fs.map((f) => {
              const v = data[f.name];
              const bad = isOutsideSafeRange(f, v);
              const missing = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
              return (
                <div key={f.name} className={bad ? "rounded-lg bg-red-50 p-2 ring-2 ring-red-600" : ""}>
                  <dt className="text-sm text-slate-600">
                    {f.label}
                    {f.kind === "number" && f.safeRange && <span className="ml-1 text-xs text-slate-500">(safe {describeRange(f)})</span>}
                  </dt>
                  <dd className={`text-base font-semibold ${bad ? "text-red-800" : missing ? "text-slate-400" : "text-slate-900"}`}>
                    {f.kind === "boolean" && f.mustBeTrue && v === true ? "✓ " : ""}
                    {formatFieldValue(f, v)}
                    {bad && <span className="ml-2 text-sm font-bold">⚠ OUTSIDE SAFE RANGE</span>}
                    {missing && f.requiredFor === "activate" && <span className="ml-2 text-xs font-semibold text-amber-700">needed before work starts</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
