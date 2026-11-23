"use client";

// The ONLY form code for type-specific fields. It renders whatever the
// registry describes, so a new permit type gets a working form for free.

import { useState } from "react";
import { describeRange, isOutsideSafeRange, type FieldDef, type TypeData } from "@/domain/permit-types";
import { fromPlantInput, toPlantInput } from "@/lib/time";
import { groupFields } from "./type-data-view";

interface Props {
  fields: readonly FieldDef[];
  value: TypeData;
  onChange: (next: TypeData) => void;
  errors?: Record<string, string>;
  /** Mark which fields are needed before work starts. */
  showStageHints?: boolean;
}

export function TypeFields({ fields, value, onChange, errors = {}, showStageHints = true }: Props) {
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });
  return (
    <div className="space-y-6">
      {groupFields(fields).map(([group, fs]) => (
        <fieldset key={group} className="space-y-4">
          <legend className="section-title mb-1">{group}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fs.map((f) => (
              <div key={f.name} className={f.kind === "textarea" || f.kind === "stringList" || f.kind === "multiselect" ? "sm:col-span-2" : ""}>
                <FieldInput field={f} value={value[f.name]} onChange={(v) => set(f.name, v)} showStageHints={showStageHints} />
                {errors[f.name] && <p className="field-error">{errors[f.name]}</p>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function Label({ field, showStageHints }: { field: FieldDef; showStageHints: boolean }) {
  return (
    <label htmlFor={`f-${field.name}`} className="label">
      {field.label}
      {field.kind === "number" && field.unit ? <span className="font-normal text-slate-500"> ({field.unit.trim()})</span> : null}
      {field.requiredFor === "submit" && <span className="text-red-700"> *</span>}
      {showStageHints && field.requiredFor === "activate" && (
        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">before work starts</span>
      )}
    </label>
  );
}

export function FieldInput({ field: f, value, onChange, showStageHints = true }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; showStageHints?: boolean }) {
  const id = `f-${f.name}`;
  const help = f.help ? <p className="help">{f.help}</p> : null;

  switch (f.kind) {
    case "text":
      return (
        <>
          <Label field={f} showStageHints={showStageHints} />
          <input id={id} className="input" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          {help}
        </>
      );
    case "textarea":
      return (
        <>
          <Label field={f} showStageHints={showStageHints} />
          <textarea id={id} rows={3} className="input py-2" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          {help}
        </>
      );
    case "number": {
      const bad = isOutsideSafeRange(f, value);
      return (
        <>
          <Label field={f} showStageHints={showStageHints} />
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step={f.step ?? "any"}
            min={f.min}
            max={f.max}
            className={`input ${bad ? "border-red-600 bg-red-50" : ""}`}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
          {f.safeRange && (
            <p className={`help ${bad ? "font-bold text-red-700" : ""}`}>
              {bad ? "⚠ Outside safe range " : "Safe range "}
              {describeRange(f)}
            </p>
          )}
          {help}
        </>
      );
    }
    case "select":
      return (
        <>
          <Label field={f} showStageHints={showStageHints} />
          <select id={id} className="input" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">Select…</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {help}
        </>
      );
    case "multiselect": {
      const arr = (value as string[]) ?? [];
      return (
        <>
          <Label field={f} showStageHints={showStageHints} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {f.options.map((o) => (
              <label key={o.value} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border-2 border-slate-200 bg-white px-3 has-[:checked]:border-slate-900">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-slate-900"
                  checked={arr.includes(o.value)}
                  onChange={(e) => onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))}
                />
                {o.label}
              </label>
            ))}
          </div>
          {help}
        </>
      );
    }
    case "boolean":
      return (
        <>
          <span className="label">
            {f.label}
            {f.mustBeTrue && <span className="text-red-700"> *</span>}
          </span>
          <div className="flex gap-2" role="radiogroup" aria-label={f.label}>
            {[true, false].map((b) => (
              <button
                key={String(b)}
                type="button"
                role="radio"
                aria-checked={value === b}
                onClick={() => onChange(b)}
                className={`btn flex-1 border-2 ${value === b ? (b ? "border-green-700 bg-green-700 text-white" : "border-slate-700 bg-slate-700 text-white") : "border-slate-300 bg-white"}`}
              >
                {b ? "Yes" : "No"}
              </button>
            ))}
          </div>
          {help}
        </>
      );
    case "datetime":
      return (
        <>
          <Label field={f} showStageHints={showStageHints} />
          <div className="flex gap-2">
            <input
              id={id}
              type="datetime-local"
              className="input"
              value={toPlantInput(value as string)}
              onChange={(e) => onChange(fromPlantInput(e.target.value))}
            />
            <button type="button" className="btn-secondary shrink-0 px-3" onClick={() => onChange(new Date().toISOString())}>
              Now
            </button>
          </div>
          {f.maxAgeMinutesAtActivation && <p className="help">Must be within {f.maxAgeMinutesAtActivation} min of starting work (IST).</p>}
          {help}
        </>
      );
    case "stringList":
      return (
        <>
          <Label field={f} showStageHints={showStageHints} />
          <StringList id={id} itemLabel={f.itemLabel ?? "Item"} value={(value as string[]) ?? []} onChange={onChange} />
          {help}
        </>
      );
  }
}

/** Tag-style list editor, also used for hazards and PPE. */
export function StringList({ id, value, onChange, itemLabel = "Item", suggestions = [] }: { id?: string; value: string[]; onChange: (v: string[]) => void; itemLabel?: string; suggestions?: readonly string[] }) {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    const t = v.trim();
    if (t && !value.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft("");
  };
  const unused = suggestions.filter((s) => !value.includes(s));
  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {value.map((v) => (
            <li key={v} className="flex items-center gap-1 rounded-full bg-slate-900 py-1 pl-3 pr-1 text-sm font-semibold text-white">
              {v}
              <button type="button" aria-label={`Remove ${v}`} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-700" onClick={() => onChange(value.filter((x) => x !== v))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          className="input"
          placeholder={`Add ${itemLabel.toLowerCase()}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={() => add(draft)}>
          Add
        </button>
      </div>
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="min-h-[40px] rounded-full border-2 border-dashed border-slate-300 px-3 text-sm text-slate-700 hover:border-slate-600">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
