// Browser-side fetch wrapper for our JSON API. Throws ApiError with the
// server's message so forms can show exactly why the server said no.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
  /** Field-level issues if the server sent them: { field, message }[] */
  get fieldIssues(): { field: string; message: string }[] {
    return Array.isArray(this.details) ? (this.details as { field: string; message: string }[]) : [];
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(e.message ?? `Request failed (${res.status})`, e.code ?? "ERROR", res.status, e.details);
  }
  return data as T;
}
