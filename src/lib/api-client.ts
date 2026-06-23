// Client-side fetch wrapper used by both the public order view and the admin panel.

export class ApiError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function api<T = unknown>(
  url: string,
  options?: { method?: string; body?: unknown; signal?: AbortSignal }
): Promise<T> {
  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
    credentials: "same-origin",
  });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const errObj = (data || {}) as { error?: string; detail?: string };
    throw new ApiError(
      errObj.error || `Request failed (${res.status})`,
      res.status,
      errObj.detail
    );
  }
  return data as T;
}
