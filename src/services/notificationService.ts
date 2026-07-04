import { storage } from "./storage";
import { mockDelay } from "./apiClient";
import type { AppNotification } from "@/types/domain";

const KEY = "nexora.notifications";
const load = (): AppNotification[] => storage.get(KEY, []);
const save = (n: AppNotification[]) => storage.set(KEY, n);

export const notificationService = {
  async list(): Promise<AppNotification[]> {
    return mockDelay(load());
  },
  async unreadCount(): Promise<number> {
    return load().filter((n) => !n.read).length;
  },
  async markRead(id: string) {
    const list = load();
    const n = list.find((x) => x.id === id);
    if (n) n.read = true;
    save(list);
  },
  async markAllRead() {
    save(load().map((n) => ({ ...n, read: true })));
  },
  push(input: Omit<AppNotification, "id" | "createdAt" | "read">) {
    const n: AppNotification = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false };
    const list = load();
    list.unshift(n);
    save(list.slice(0, 200));
    return n;
  },
};
