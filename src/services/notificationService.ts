import { ACTIONS } from "@/config/api";
import { request } from "./apiClient";
import type { AppNotification } from "@/types/domain";

export const notificationService = {
  async list(): Promise<AppNotification[]> {
    return request<AppNotification[]>({ action: ACTIONS.notificationsList });
  },
  async unreadCount(): Promise<number> {
    try {
      const r = await request<{ count: number }>({ action: ACTIONS.notificationsUnread });
      return r.count;
    } catch {
      return 0;
    }
  },
  async markRead(id: string): Promise<void> {
    await request({ action: ACTIONS.notificationsMarkRead, data: { id } });
  },
  async markAllRead(): Promise<void> {
    await request({ action: ACTIONS.notificationsMarkAllRead });
  },
};
