import { API_CONFIG } from "@/config/api";
import { session } from "./session";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
  }
}

export const mockDelay = <T,>(value: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export type HttpMethod = "GET" | "POST";

export interface RequestOptions {
  action: string;
  method?: HttpMethod;
  data?: unknown;
  signal?: AbortSignal;
}

const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(fn: () => void): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((fn) => fn());
}

/** Network-only call to the Apps Script backend — no offline fallback. Used by the sync engine and by request() below. */
export async function rawRequest<T>({ action, method = "POST", data, signal }: RequestOptions): Promise<T> {
  if (!API_CONFIG.baseUrl) {
    throw new ApiError("NOT_CONFIGURED", `Backend not configured (action=${action})`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);

  const token = session.token();

  try {
    const res = await fetch(API_CONFIG.baseUrl, {
      method,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token, payload: data ?? null }),
      signal: controller.signal,
    });

    if (res.status === 401) {
      notifyUnauthorized();
      throw new ApiError("UNAUTHORIZED", "Session expired", 401);
    }

    if (!res.ok) {
      throw new ApiError("HTTP_ERROR", `Request failed (${res.status})`, res.status);
    }

    const body = (await res.json()) as { ok: boolean; data?: T; error?: string };

    if (!body.ok) {
      if (body.error === "UNAUTHORIZED" || body.error === "Invalid or expired token") {
        notifyUnauthorized();
      }
      throw new ApiError("API_ERROR", body.error ?? "Unknown error");
    }

    return body.data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") throw new ApiError("TIMEOUT", "Request timed out");
    throw new ApiError("NETWORK", (e as Error).message ?? "Network error");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Offline-aware call used by every service. Tries the network first; if that
 * fails (or the browser is already offline), falls back to the local cache /
 * queues the write for later sync. */
export async function request<T>(opts: RequestOptions): Promise<T> {
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;

  if (isOnline) {
    try {
      return await rawRequest<T>(opts);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "UNAUTHORIZED" || e.code === "API_ERROR")) throw e;
      // Network/timeout error even though navigator says online (e.g. flaky wifi) — fall back.
      return fallbackToLocal<T>(opts, e as Error);
    }
  }
  return fallbackToLocal<T>(opts);
}

async function fallbackToLocal<T>(opts: RequestOptions, networkError?: Error): Promise<T> {
  const { hasLocalHandler, runLocalHandler } = await import("./offline/localHandlers");
  if (!hasLocalHandler(opts.action)) {
    throw networkError instanceof ApiError
      ? networkError
      : new ApiError("OFFLINE_UNSUPPORTED", `"${opts.action}" needs an internet connection.`);
  }
  return runLocalHandler<T>(opts.action, opts.data);
}
