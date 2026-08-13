// Keeps the local cache fresh and flushes queued offline writes back to the
// Google Apps Script backend once a connection is available.
import { ACTIONS } from "@/config/api";
import { rawRequest } from "../apiClient";
import { session } from "../session";
import { leadsCache, agentsCache, notificationsCache, activityCache, settingsCache, syncQueue, metaCache } from "./db";
import type { Lead, User, AppNotification, ActivityEvent, SystemSettings } from "@/types/domain";

type Listener = (state: SyncState) => void;

export interface SyncState {
  status: "idle" | "syncing" | "error";
  pending: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

let state: SyncState = { status: "idle", pending: 0, lastSyncAt: null, lastError: null };
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(state));
}

export const syncStore = {
  get: () => state,
  subscribe(fn: Listener) {
    listeners.add(fn);
    fn(state);
    return () => listeners.delete(fn);
  },
};

async function refreshPending() {
  state = { ...state, pending: await syncQueue.count() };
  emit();
}

/** Pull a fresh snapshot of everything from the server into the local cache. Call after login and periodically while online. */
export async function pullSnapshot(): Promise<void> {
  if (!session.token()) return;
  const me = session.get();
  if (!me) return;
  try {
    const [leads, notifications, activity] = await Promise.all([
      rawRequest<Lead[]>({ action: ACTIONS.leadsList, data: { sort: "newest" } }),
      rawRequest<AppNotification[]>({ action: ACTIONS.notificationsList }).catch(() => null),
      rawRequest<ActivityEvent[]>({ action: ACTIONS.activityList, data: { limit: 500 } }).catch(() => null),
    ]);
    await leadsCache.replaceAll(leads);
    if (notifications) await notificationsCache.replaceAll(notifications);
    if (activity) await activityCache.replaceAll(activity);

    if (me.role === "admin") {
      const agents = await rawRequest<User[]>({ action: ACTIONS.agentsList }).catch(() => null);
      if (agents) await agentsCache.replaceAll(agents);
    }
    const settings = await rawRequest<SystemSettings>({ action: ACTIONS.settingsGet }).catch(() => null);
    if (settings) await settingsCache.set(settings);

    await metaCache.set("lastSyncAt", new Date().toISOString());
    state = { status: "idle", pending: await syncQueue.count(), lastSyncAt: new Date().toISOString(), lastError: null };
    emit();
  } catch (e) {
    state = { ...state, status: "error", lastError: (e as Error).message };
    emit();
  }
}

/** Push everything queued while offline, in order, then pull a fresh snapshot. */
export async function drainQueue(): Promise<void> {
  if (!navigator.onLine || !session.token()) return;
  const items = await syncQueue.all();
  if (!items.length) {
    await refreshPending();
    return;
  }
  state = { ...state, status: "syncing" };
  emit();
  for (const item of items) {
    try {
      await rawRequest({ action: item.action, data: item.payload });
      if (item.qid !== undefined) await syncQueue.remove(item.qid);
    } catch (e) {
      // Stop on first failure (e.g. lost connection again) — remaining items stay queued, retried next time.
      state = { status: "error", pending: await syncQueue.count(), lastSyncAt: state.lastSyncAt, lastError: (e as Error).message };
      emit();
      return;
    }
  }
  await pullSnapshot();
}

let started = false;
export function startSyncEngine() {
  if (started) return;
  started = true;
  refreshPending();

  window.addEventListener("online", () => {
    drainQueue();
  });

  // Periodic background refresh while online (every 3 minutes) so the cache
  // never drifts far from the server between explicit actions.
  setInterval(() => {
    if (navigator.onLine) drainQueue();
  }, 3 * 60 * 1000);

  if (navigator.onLine) drainQueue();
}
