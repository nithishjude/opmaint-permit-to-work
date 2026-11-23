"use client";

// The ONLY form code for type-specific fields. It renders whatever the
// registry describes, so a new permit type gets a working form for free.

import { useState } from "react";
import { Plus, X } from "lucide-react";
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
          <legend className="mb-1 w-full border-b border-line pb-2 text-[15px] font-semibold text-ink">{group}</legend>
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
      {field.kind === "number" && field.unit ? <span className="font-normal text-ink-muted"> ({field.unit.trim()})</span> : null}
      {field.requiredFor === "submit" && <span className="text-critical"> *</span>}
      {showStageHints && field.requiredFor === "activate" && (
        <span className="ml-2 rounded-sm bg-warning-soft px-1.5 py-0.5 text-[13px] font-medium text-warning">before work starts</span>
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
            className={`input font-mono ${bad ? "!border-critical bg-critical-soft" : ""}`}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
          {f.safeRange && (
            <p className={`help ${bad ? "font-semibold text-critical" : ""}`}>
              {bad ? "Outside safe range " : "Safe range "}
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
              <label key={o.value} className="check-row">
                <input
                  type="checkbox"
                  className="check-box"
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
            {f.mustBeTrue && <span className="text-critical"> *</span>}
          </span>
          <div className="flex gap-2" role="radiogroup" aria-label={f.label}>
            {[true, false].map((b) => (
              <button
                key={String(b)}
                type="button"
                role="radio"
                aria-checked={value === b}
                onClick={() => onChange(b)}
                className={`btn flex-1 ${value === b ? (b ? "border-good bg-good text-white" : "border-ink bg-ink text-white") : "border-line-strong bg-white text-ink hover:border-ink-muted"}`}
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
            <li key={v} className="flex items-center gap-0.5 rounded-full border border-line-strong bg-white py-0.5 pl-3 pr-0.5 text-[15px] font-medium text-ink">
              {v}
              <button type="button" aria-label={`Remove ${v}`} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-ground hover:text-ink" onClick={() => onChange(value.filter((x) => x !== v))}>
                <X aria-hidden className="h-4 w-4" />
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
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-dashed border-line-strong px-3 text-[14px] text-ink-2 transition-colors duration-out ease-ui hover:border-ink hover:text-ink">
              <Plus aria-hidden className="h-3.5 w-3.5" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
