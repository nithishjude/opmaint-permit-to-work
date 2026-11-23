"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { SignaturePad } from "@/components/signature-pad";

export function ApprovalForm({ permitId, slotLabel, checklist }: { permitId: string; slotLabel: string; checklist: string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [checked, setChecked] = useState<boolean[]>(checklist.map(() => false));
  const [comment, setComment] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checked.every(Boolean);

  async function send(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/permits/${permitId}/approval`, {
        body: decision === "APPROVE" ? { decision, comment: comment || null, signature } : { decision, comment },
      });
      router.push(`/permits/${permitId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your decision.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "approve"} onClick={() => setMode("approve")} className={`btn border-2 ${mode === "approve" ? "border-green-700 bg-green-700 text-white" : "border-slate-300 bg-white"}`}>
          Approve
        </button>
        <button type="button" role="tab" aria-selected={mode === "reject"} onClick={() => setMode("reject")} className={`btn border-2 ${mode === "reject" ? "border-red-700 bg-red-700 text-white" : "border-slate-300 bg-white"}`}>
          Reject
        </button>
      </div>

      {mode === "approve" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send("APPROVE");
          }}
        >
          <fieldset className="space-y-2">
            <legend className="label">I have personally checked:</legend>
            {checklist.map((c, i) => (
              <label key={c} className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 has-[:checked]:border-green-700 has-[:checked]:bg-green-50">
                <input type="checkbox" className="h-6 w-6 shrink-0 accent-green-700" checked={checked[i]} onChange={(e) => setChecked(checked.map((x, j) => (j === i ? e.target.checked : x)))} />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <label className="label" htmlFor="approve-comment">Comment / conditions (optional)</label>
            <textarea id="approve-comment" className="input py-2" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Fire watch to stay 60 min after work, not 30." />
          </div>
          <div>
            <span className="label">Signature — {slotLabel}</span>
            <SignaturePad onChange={setSignature} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn-go min-h-[56px] w-full text-lg" disabled={busy || !allChecked || !signature}>
            {busy ? "Signing…" : "Approve & sign"}
          </button>
          {(!allChecked || !signature) && <p className="text-center text-sm text-slate-600">Tick every check and sign to approve.</p>}
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send("REJECT");
          }}
        >
          <div>
            <label className="label" htmlFor="reject-reason">
              Reason for rejection <span className="text-red-700">*</span>
            </label>
            <textarea id="reject-reason" className="input py-2" rows={4} required minLength={5} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What must change before this could be approved? The requester will need to raise a new permit." />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn-stop min-h-[56px] w-full text-lg" disabled={busy || comment.trim().length < 5}>
            {busy ? "Rejecting…" : "Reject permit"}
          </button>
        </form>
      )}
    </div>
  );
}
