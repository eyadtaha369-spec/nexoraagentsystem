import { API_CONFIG } from "@/config/api";

/**
 * Centralized API client. Currently returns mock results via `mockDelay`.
 * When Google Apps Script is ready, replace the body of `request()` with a
 * real fetch to API_CONFIG.appsScriptUrl. The public surface stays identical
 * so no component code changes.
 */

export class ApiError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockDelay<T>(value: T, ms = 350): Promise<T> {
  await wait(ms + Math.random() * 200);
  return value;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestOptions {
  action: string;
  method?: HttpMethod;
  data?: unknown;
  signal?: AbortSignal;
}

// Placeholder for future real transport. Every service goes through this.
export async function request<T>({ action, method = "POST", data, signal }: RequestOptions): Promise<T> {
  if (!API_CONFIG.appsScriptUrl) {
    throw new ApiError("NOT_CONFIGURED", `Backend not configured (action=${action})`);
  }
  const url = API_CONFIG.appsScriptUrl;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload: data ?? null }),
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError("HTTP_ERROR", `Request failed (${res.status})`, res.status);
    const body = (await res.json()) as { ok: boolean; data?: T; error?: string };
    if (!body.ok) throw new ApiError("API_ERROR", body.error ?? "Unknown error");
    return body.data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") throw new ApiError("TIMEOUT", "Request timed out");
    throw new ApiError("NETWORK", (e as Error).message ?? "Network error");
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
