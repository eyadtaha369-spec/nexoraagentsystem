import { storage } from "./storage";
import { mockDelay } from "./apiClient";
import type { SystemSettings } from "@/types/domain";

const KEY = "nexora.settings";
const DEFAULTS: SystemSettings = {
  companyName: "Nexora",
  companyEmail: "hello@nexora.com",
  appsScriptUrl: "",
  spreadsheetId: "",
  distributionMode: "manual",
  notificationsEnabled: true,
};

export const settingsService = {
  async get(): Promise<SystemSettings> {
    return mockDelay(storage.get(KEY, DEFAULTS));
  },
  async update(patch: Partial<SystemSettings>): Promise<SystemSettings> {
    const next = { ...storage.get(KEY, DEFAULTS), ...patch };
    storage.set(KEY, next);
    return mockDelay(next);
  },
  async testConnection(url: string): Promise<{ ok: boolean; latencyMs: number }> {
    if (!url) throw new Error("Provide an Apps Script URL first.");
    const start = performance.now();
    await mockDelay(null, 700);
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  },
};
