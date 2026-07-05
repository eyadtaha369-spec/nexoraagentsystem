import { API_CONFIG } from "@/config/api";
import { session } from "./session";

/**
 * Centralized API client. Every request goes to the single Apps Script
 * Web App URL, routed by an `action` name in the JSON body.
 *
 * IMPORTANT: Content-Type must be "text/plain", NOT "application/json".
 * Google Apps Script Web Apps cannot respond to CORS preflight (OPTIONS)
 * requests. Using application/json forces the browser to send a preflight
 * first, which Apps Script can't answer, causing "Failed to fetch" / CORS
 * errors. text/plain is a "simple request" so no preflight is sent, and
 * Apps Script still parses the JSON fine from e.postData.contents.
 */

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

export async function request<T>({ action, method = "POST", data, signal }: RequestOptions): Promise<T> {
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

    if (!res.ok) {
      throw new ApiError("HTTP_ERROR", `Request failed (${res.status})`, res.status);
    }

    const body = (await res.json()) as { ok: boolean; data?: T; error?: string };

    if (!body.ok) {
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
