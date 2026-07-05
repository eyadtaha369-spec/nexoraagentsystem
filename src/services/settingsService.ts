import { ACTIONS } from "@/config/api";
import { request } from "./apiClient";
import type { SystemSettings } from "@/types/domain";

export const settingsService = {
  async get(): Promise<SystemSettings> {
    return request<SystemSettings>({ action: ACTIONS.settingsGet });
  },
  async update(patch: Partial<SystemSettings>): Promise<SystemSettings> {
    return request<SystemSettings>({ action: ACTIONS.settingsUpdate, data: patch });
  },
  async testConnection(url: string): Promise<{ ok: boolean; latencyMs: number }> {
    if (!url) throw new Error("Provide an Apps Script URL first.");
    const start = performance.now();
    const res = await request<{ ok: boolean }>({ action: ACTIONS.settingsTest, data: { url } });
    return { ok: res.ok, latencyMs: Math.round(performance.now() - start) };
  },
};
