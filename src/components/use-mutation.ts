"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

/** POST/PATCH to the API, then re-render the server page with fresh data. */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, body: unknown, method = "POST"): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method, body });
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error, setError };
}
