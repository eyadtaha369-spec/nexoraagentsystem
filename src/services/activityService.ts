import { storage } from "./storage";
import { mockDelay } from "./apiClient";
import type { ActivityEvent } from "@/types/domain";

const KEY = "nexora.activity";
const load = (): ActivityEvent[] => storage.get(KEY, []);
const save = (a: ActivityEvent[]) => storage.set(KEY, a);

export const activityService = {
  log(type: ActivityEvent["type"], message: string, meta?: { leadId?: string; userId?: string }) {
    const evt: ActivityEvent = {
      id: crypto.randomUUID(),
      type, message,
      leadId: meta?.leadId, userId: meta?.userId,
      createdAt: new Date().toISOString(),
    };
    const items = load();
    items.unshift(evt);
    save(items.slice(0, 500));
    return evt;
  },
  async list(limit = 100): Promise<ActivityEvent[]> {
    return mockDelay(load().slice(0, limit));
  },
};
