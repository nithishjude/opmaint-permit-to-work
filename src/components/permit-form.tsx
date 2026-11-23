"use client";

// Multi-step create/edit form. One component for every permit type: steps 1–3
// are the common core, step 4 is rendered from the registry, step 5 runs the
// exact same `submissionIssues` the server runs, so the user sees the server's
// rules before they hit them (the server still re-checks everything).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PERMIT_TYPES, getPermitType, type TypeData } from "@/domain/permit-types";
import { submissionIssues, type PrecautionItem } from "@/domain/permit-core";
import type { ReferenceData } from "@/server/permits/queries";
import { api, ApiError } from "@/lib/api-client";
import { formatDateTime, fromPlantInput, toPlantInput } from "@/lib/time";
import { StringList, TypeFields } from "./type-fields";
import { TypeBadge, StatusBadge } from "./badges";
import { typeIcon } from "./icons";
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Plus, Save, Send, ShieldAlert, TriangleAlert, X } from "lucide-react";
import type { PermitStatus } from "@/domain/enums";

export interface PermitFormInitial {
  id: string;
  type: string;
  contractor: string;
  crewSize: number | null;
  workDescription: string;
  areaId: string;
  equipmentId: string | null;
  locationDetail: string | null;
  plannedStart: string;
  plannedEnd: string;
  hazards: string[];
  ppe: string[];
  precautions: PrecautionItem[];
  typeData: TypeData;
}

interface Conflict {
  id: string;
  number: string;
  type: string;
  status: PermitStatus;
  plannedStart: string;
  validUntil: string;
  workDescription: string;
}

const STEPS = ["Permit type", "Job & location", "Hazards & precautions", "Type details", "Review & submit"] as const;

function defaultWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 4 * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function PermitForm({ plants, initial }: { plants: ReferenceData; initial?: PermitFormInitial }) {
  const router = useRouter();
  const win = useMemo(defaultWindow, []);
  const [step, setStep] = useState(initial ? 1 : 0);
  const [permitId, setPermitId] = useState<string | null>(initial?.id ?? null);

  const [type, setType] = useState(initial?.type ?? "");
  const [contractor, setContractor] = useState(initial?.contractor ?? "");
  const [crewSize, setCrewSize] = useState<number | null>(initial?.crewSize ?? null);
  const [workDescription, setWorkDescription] = useState(initial?.workDescription ?? "");
  const [plantId, setPlantId] = useState(() => (initial ? plants.find((p) => p.areas.some((a) => a.id === initial.areaId))?.id ?? "" : plants[0]?.id ?? ""));
  const [areaId, setAreaId] = useState(initial?.areaId ?? "");
  const [equipmentId, setEquipmentId] = useState<string | null>(initial?.equipmentId ?? null);
  const [locationDetail, setLocationDetail] = useState(initial?.locationDetail ?? "");
  const [plannedStart, setPlannedStart] = useState(initial?.plannedStart ?? win.start);
  const [plannedEnd, setPlannedEnd] = useState(initial?.plannedEnd ?? win.end);
  const [hazards, setHazards] = useState<string[]>(initial?.hazards ?? []);
  const [ppe, setPpe] = useState<string[]>(initial?.ppe ?? []);
  const [precautions, setPrecautions] = useState<PrecautionItem[]>(initial?.precautions ?? []);
  const [typeData, setTypeData] = useState<TypeData>(initial?.typeData ?? {});
  const [customPrecaution, setCustomPrecaution] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [serverIssues, setServerIssues] = useState<{ field: string; message: string }[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  const def = getPermitType(type);
  const plant = plants.find((p) => p.id === plantId);
  const area = plant?.areas.find((a) => a.id === areaId);

  function chooseType(key: string) {
    const d = getPermitType(key)!;
    setType(key);
    // Pre-fill with the type's standard hazards, PPE and checklist; the requester edits from there.
    setHazards([...d.defaultHazards]);
    setPpe([...d.defaultPpe]);
    setPrecautions(d.precautions.map((p) => ({ id: p.id, label: p.label, checked: false })));
    setTypeData({});
    setStep(1);
  }

  // Live simultaneous-operations check as the location/time are chosen.
  useEffect(() => {
    if (!type || !areaId || !plannedStart || !plannedEnd || new Date(plannedEnd) <= new Date(plannedStart)) {
      setConflicts([]);
      return;
    }
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ type, areaId, start: plannedStart, end: plannedEnd, ...(permitId ? { excludeId: permitId } : {}) });
    fetch(`/api/conflicts?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { conflicts: [] }))
      .then((d) => setConflicts(d.conflicts ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [type, areaId, plannedStart, plannedEnd, permitId]);

  const clientIssues = useMemo(
    () =>
      def
        ? submissionIssues(
            { type, contractor, workDescription, plannedStart: new Date(plannedStart), plannedEnd: new Date(plannedEnd), hazards, ppe, precautions, typeData },
            new Date(),
          )
        : [],
    [def, type, contractor, workDescription, plannedStart, plannedEnd, hazards, ppe, precautions, typeData],
  );
  const issues = clientIssues;
  // Server-reported issues show until the next save; client checks update live.
  // Inline errors appear once the user has reached the review step, not while they're still typing.
  const [reviewed, setReviewed] = useState(Boolean(initial));
  useEffect(() => {
    if (step === 4) setReviewed(true);
  }, [step]);
  const fieldErrors = Object.fromEntries([...(reviewed ? clientIssues : []), ...serverIssues].map((i) => [i.field, i.message]));
  const canSaveDraft = Boolean(type && areaId && plannedStart && plannedEnd);

  function payload() {
    return {
      contractor,
      crewSize,
      workDescription,
      areaId,
      equipmentId,
      locationDetail: locationDetail || null,
      plannedStart,
      plannedEnd,
      hazards,
      ppe,
      precautions,
      typeData,
    };
  }

  async function save(): Promise<string | null> {
    setBusy(true);
    setMessage(null);
    setServerIssues([]);
    try {
      if (permitId) {
        await api(`/api/permits/${permitId}`, { method: "PATCH", body: payload() });
        return permitId;
      }
      const { permit } = await api<{ permit: { id: string; number: string } }>("/api/permits", { body: { type, ...payload() } });
      setPermitId(permit.id);
      window.history.replaceState(null, "", `/permits/${permit.id}/edit`);
      return permit.id;
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not save." });
      if (e instanceof ApiError) setServerIssues(e.fieldIssues);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    const id = await save();
    if (id) setMessage({ kind: "ok", text: `Draft saved at ${formatDateTime(new Date())}.` });
  }

  async function submit() {
    const id = await save();
    if (!id) return;
    setBusy(true);
    try {
      await api(`/api/permits/${id}/transition`, { body: { action: "SUBMIT" } });
      router.push(`/permits/${id}?submitted=1`);
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not submit." });
      if (e instanceof ApiError) setServerIssues(e.fieldIssues);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* progress */}
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Steps">
        {STEPS.map((s, i) => {
          const reachable = i === 0 ? !initial : Boolean(type);
          const done = i < step;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(i)}
                aria-current={step === i ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s}`}
                className="group w-full pb-1 text-left disabled:cursor-not-allowed"
              >
                <span
                  className={`block h-1.5 rounded-full transition-colors duration-out ease-ui ${step === i ? "bg-action" : done ? "bg-ink" : "bg-line-strong"}`}
                />
                <span className={`mt-2 hidden text-[13px] font-medium leading-tight sm:block ${step === i ? "text-ink" : "text-ink-muted"}`}>
                  {i === 3 && def ? `${def.shortLabel} details` : s}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] font-medium text-ink-muted sm:hidden">
        Step {step + 1} of {STEPS.length} · <span className="text-ink">{step === 3 && def ? `${def.shortLabel} details` : STEPS[step]}</span>
      </p>

      {message && (
        <div role="status" className={message.kind === "ok" ? "callout-good" : "callout-critical"}>
          {message.kind === "ok" ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
          <p className="text-[15px] font-semibold">{message.text}</p>
        </div>
      )}

      {conflicts.length > 0 && step > 0 && (
        <div className="callout-critical">
          <ShieldAlert aria-hidden />
          <div>
            <p className="font-semibold">Simultaneous operations conflict</p>
            <p className="text-[15px] text-ink-2">This {def?.label.toLowerCase()} permit overlaps in time and location with:</p>
            <ul className="mt-2 space-y-1.5 text-[15px]">
              {conflicts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <a className="link font-mono" href={`/permits/${c.id}`} target="_blank" rel="noreferrer">
                    {c.number}
                  </a>
                  <TypeBadge type={c.type} />
                  <StatusBadge status={c.status} />
                  <span className="font-mono text-[13px] text-ink-muted">
                    {formatDateTime(c.plannedStart)} – {formatDateTime(c.validUntil)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[15px] text-ink-2">Approvers will see this warning. Re-schedule, or confirm the two jobs are isolated from each other.</p>
          </div>
        </div>
      )}

      <div className="card p-4 sm:p-6">
        {step === 0 && (
          <div>
            <h2 className="text-xl font-semibold tracking-tight">What kind of work needs a permit?</h2>
            <p className="mb-5 mt-1 text-ink-muted">The form adapts to the permit type. The type can&apos;t be changed once the draft is saved.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PERMIT_TYPES.map((t) => {
                const Icon = typeIcon(t.key);
                const selected = type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => chooseType(t.key)}
                    aria-pressed={selected}
                    className={`card-link flex gap-4 p-4 text-left ${selected ? "!border-action ring-2 ring-action/20" : ""}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm ${selected ? "bg-action text-white" : "bg-ground text-ink-2"}`}>
                      <Icon aria-hidden className="h-6 w-6" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[17px] font-semibold leading-snug">{t.label}</span>
                      <span className="mt-0.5 block text-[15px] leading-snug text-ink-muted">{t.description}</span>
                      <span className="mt-2 block text-[13px] text-ink-muted">
                        Valid up to {t.maxDurationHours} h · {t.requiredApprovals.length} sign-offs
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && def && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold tracking-tight">Job & location</h2>
            <div>
              <label className="label" htmlFor="work">
                Work description <span className="text-critical">*</span>
              </label>
              <textarea id="work" rows={3} className="input py-2" value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} placeholder="Exactly what will be done, to what, and how." />
              {fieldErrors.workDescription && <p className="field-error">{fieldErrors.workDescription}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="contractor">
                  Contractor / team performing the work <span className="text-critical">*</span>
                </label>
                <input id="contractor" className="input" value={contractor} onChange={(e) => setContractor(e.target.value)} />
                {fieldErrors.contractor && <p className="field-error">{fieldErrors.contractor}</p>}
              </div>
              <div>
                <label className="label" htmlFor="crew">
                  Crew size
                </label>
                <input id="crew" type="number" inputMode="numeric" min={1} className="input" value={crewSize ?? ""} onChange={(e) => setCrewSize(e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="eyebrow">Location: plant → area → equipment</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="plant">Plant</label>
                  <select
                    id="plant"
                    className="input"
                    value={plantId}
                    onChange={(e) => {
                      setPlantId(e.target.value);
                      setAreaId("");
                      setEquipmentId(null);
                    }}
                  >
                    {plants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="area">
                    Area <span className="text-critical">*</span>
                  </label>
                  <select
                    id="area"
                    className="input"
                    value={areaId}
                    onChange={(e) => {
                      setAreaId(e.target.value);
                      setEquipmentId(null);
                    }}
                  >
                    <option value="">Select area…</option>
                    {plant?.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  {area?.owner && <p className="help">Area owner: {area.owner.name}</p>}
                </div>
                <div>
                  <label className="label" htmlFor="equipment">Equipment</label>
                  <select id="equipment" className="input" value={equipmentId ?? ""} disabled={!area} onChange={(e) => setEquipmentId(e.target.value || null)}>
                    <option value="">— none / general area —</option>
                    {area?.equipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.tag} — {eq.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="locdetail">Exact spot</label>
                <input id="locdetail" className="input" value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} placeholder="e.g. north side of PR-3, bay 4, elevation 6 m" />
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="eyebrow">Validity window (IST)</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="start">Planned start *</label>
                  <input id="start" type="datetime-local" className="input" value={toPlantInput(plannedStart)} onChange={(e) => setPlannedStart(fromPlantInput(e.target.value) ?? "")} />
                </div>
                <div>
                  <label className="label" htmlFor="end">Planned end *</label>
                  <input id="end" type="datetime-local" className="input" value={toPlantInput(plannedEnd)} onChange={(e) => setPlannedEnd(fromPlantInput(e.target.value) ?? "")} />
                  {fieldErrors.plannedEnd && <p className="field-error">{fieldErrors.plannedEnd}</p>}
                </div>
              </div>
              <p className="help">
                {def.label} permits are valid for at most {def.maxDurationHours} h — one shift. Work can&apos;t start before the planned start and the permit expires automatically at the end.
              </p>
            </fieldset>
          </div>
        )}

        {step === 2 && def && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold tracking-tight">Hazards, PPE & precautions</h2>
            <div>
              <span className="label">Hazards identified *</span>
              <StringList value={hazards} onChange={setHazards} itemLabel="Hazard" suggestions={def.defaultHazards} />
              {fieldErrors.hazards && <p className="field-error">{fieldErrors.hazards}</p>}
            </div>
            <div>
              <span className="label">PPE required *</span>
              <StringList value={ppe} onChange={setPpe} itemLabel="PPE item" suggestions={def.defaultPpe} />
              {fieldErrors.ppe && <p className="field-error">{fieldErrors.ppe}</p>}
            </div>
            <div>
              <span className="label">Precautions checklist — confirm each one is in place *</span>
              <ul className="space-y-2">
                {precautions.map((p, i) => (
                  <li key={p.id}>
                    <label className="check-row min-h-[56px]">
                      <input
                        type="checkbox"
                        className="check-box h-7 w-7"
                        checked={p.checked}
                        onChange={(e) => setPrecautions(precautions.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                      />
                      <span className="flex-1 text-[15px] leading-snug">
                        {p.label}
                        {p.custom && <span className="ml-2 text-[13px] text-ink-muted">site-specific</span>}
                      </span>
                      {p.custom && (
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-ground hover:text-ink"
                          onClick={(e) => {
                            e.preventDefault();
                            setPrecautions(precautions.filter((_, j) => j !== i));
                          }}
                          aria-label={`Remove precaution: ${p.label}`}
                        >
                          <X aria-hidden className="h-5 w-5" />
                        </button>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input className="input" placeholder="Add a site-specific precaution…" value={customPrecaution} onChange={(e) => setCustomPrecaution(e.target.value)} />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => {
                    if (!customPrecaution.trim()) return;
                    setPrecautions([...precautions, { id: `custom-${Date.now()}`, label: customPrecaution.trim(), checked: false, custom: true }]);
                    setCustomPrecaution("");
                  }}
                >
                  <Plus aria-hidden />
                  Add precaution
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && def && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">{def.label} details</h2>
            <p className="text-[15px] text-ink-muted">
              Fields marked <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-[13px] font-medium text-warning">before work starts</span> (gas tests, lock numbers) are usually taken on site just before
              the job — you can submit without them, but the permit can&apos;t be activated until they&apos;re recorded and within safe limits.
            </p>
            <TypeFields fields={def.fields} value={typeData} onChange={setTypeData} errors={fieldErrors} />
          </div>
        )}

        {step === 4 && def && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Review & submit</h2>
            <dl className="grid grid-cols-1 gap-4 rounded-sm border border-line p-4 sm:grid-cols-2">
              <div>
                <dt className="eyebrow">Type</dt>
                <dd className="font-semibold">{def.label}</dd>
              </div>
              <div>
                <dt className="eyebrow">Location</dt>
                <dd className="font-semibold">
                  {plant?.name} › {area?.name ?? "—"}
                  {equipmentId ? ` › ${area?.equipment.find((e) => e.id === equipmentId)?.tag}` : ""}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Window (IST)</dt>
                <dd className="font-mono text-[15px] font-semibold">
                  {formatDateTime(plannedStart)} → {formatDateTime(plannedEnd)}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Approvals needed</dt>
                <dd className="font-semibold">{def.requiredApprovals.map((r) => (r === "AREA_OWNER" ? `Area owner${area?.owner ? ` (${area.owner.name})` : ""}` : "Safety officer")).join(" + ")}</dd>
              </div>
            </dl>
            {issues.length > 0 ? (
              <div className="callout-warning">
                <TriangleAlert aria-hidden />
                <div>
                  <p className="font-semibold">
                    {issues.length} thing{issues.length === 1 ? "" : "s"} to fix before you can submit
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-2">
                    {issues.map((i, k) => (
                      <li key={k}>{i.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="callout-good">
                <CircleCheck aria-hidden />
                <p className="font-semibold">Ready to submit for approval.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* sticky action bar — reachable with one thumb on a phone */}
      {step > 0 && (
        <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center gap-2 border-t border-line bg-white px-4 py-3 sm:mx-0 sm:rounded-md sm:border lg:bottom-0">
          <button type="button" className="btn-secondary px-3.5" onClick={() => setStep(step - 1)} disabled={busy || (initial && step === 1)} aria-label="Previous step">
            <ArrowLeft aria-hidden />
            <span className="hidden sm:inline">Back</span>
          </button>
          <button type="button" className="btn-secondary px-3.5" onClick={saveDraft} disabled={busy || !canSaveDraft}>
            <Save aria-hidden />
            <span className="hidden sm:inline">Save draft</span>
            <span className="sm:hidden">Save</span>
          </button>
          <div className="flex-1" />
          {step < 4 ? (
            <button type="button" className="btn-primary" onClick={() => setStep(step + 1)} disabled={busy}>
              Next
              <ArrowRight aria-hidden />
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={submit} disabled={busy || issues.length > 0}>
              <Send aria-hidden />
              {busy ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
