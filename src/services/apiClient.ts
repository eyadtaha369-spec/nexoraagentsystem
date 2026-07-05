import { API_CONFIG, type ApiAction } from "@/config/api";
import { session } from "./session";

/**
 * Real HTTP client for the Google Apps Script backend.
 *
 * Every service in this app calls `request()`. There is no mock layer.
 * Google Apps Script Web Apps use a single URL and route by `action`
 * inside the POST body. We use `text/plain` content-type to avoid the
 * CORS preflight (Apps Script does not respond to OPTIONS).
 */

export class ApiError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "HTTP_ERROR" | "API_ERROR" | "TIMEOUT" | "NETWORK" | "UNAUTHORIZED",
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onUnauthorized(fn: UnauthorizedListener) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

export interface RequestOptions<TData = unknown> {
  action: ApiAction;
  data?: TData;
  signal?: AbortSignal;
  retries?: number;
}

interface EnvelopeOk<T> { ok: true; data: T }
interface EnvelopeErr { ok: false; error: string; code?: string }
type Envelope<T> = EnvelopeOk<T> | EnvelopeErr;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function doFetch<T>(opts: RequestOptions): Promise<T> {
  if (!API_CONFIG.baseUrl) {
    throw new ApiError(
      "NOT_CONFIGURED",
      "Backend URL is not configured. Set VITE_APPS_SCRIPT_URL in your environment.",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  const onExternalAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onExternalAbort);

  const payload = {
    action: opts.action,
    token: session.token(),
    payload: opts.data ?? null,
    ts: Date.now(),
  };

  try {
    const res = await fetch(API_CONFIG.baseUrl, {
      method: "POST",
      // text/plain avoids the CORS preflight Apps Script cannot answer.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok) {
      throw new ApiError("HTTP_ERROR", `Request failed (${res.status})`, res.status);
    }

    let body: Envelope<T>;
    try {
      body = (await res.json()) as Envelope<T>;
    } catch {
      throw new ApiError("API_ERROR", "Malformed response from server.");
    }

    if (!body.ok) {
      if (body.code === "UNAUTHORIZED" || /unauth|expired|invalid token/i.test(body.error)) {
        unauthorizedListeners.forEach((fn) => fn());
        throw new ApiError("UNAUTHORIZED", body.error || "Session expired.");
      }
      throw new ApiError("API_ERROR", body.error || "Request failed.");
    }
    return body.data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") {
      throw new ApiError("TIMEOUT", "The request timed out.");
    }
    throw new ApiError("NETWORK", (e as Error).message || "Network error.");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function request<T = unknown>(opts: RequestOptions): Promise<T> {
  const maxRetries = opts.retries ?? API_CONFIG.retries;
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= maxRetries) {
    try {
      return await doFetch<T>(opts);
    } catch (e) {
      lastError = e;
      // Only retry transient failures.
      if (
        e instanceof ApiError &&
        (e.code === "NETWORK" || e.code === "TIMEOUT" || (e.code === "HTTP_ERROR" && (e.status ?? 0) >= 500))
      ) {
        attempt++;
        if (attempt > maxRetries) break;
        await sleep(API_CONFIG.retryBackoffMs * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}
