// Local offline cache. Mirrors the Google Apps Script backend (leads, agents,
// notifications, activity, settings) in IndexedDB so the app is fully usable
// without internet, plus a queue of writes made while offline.
import { openDB, type IDBPDatabase } from "idb";
import type { Lead, User, AppNotification, ActivityEvent, SystemSettings } from "@/types/domain";

const DB_NAME = "nexora-offline";
const DB_VERSION = 1;

export interface QueueItem {
  qid?: number;
  action: string;
  payload: unknown;
  createdAt: string;
  // For optimistic creates, so we can reconcile the temp id with the real one later.
  tempId?: string;
}

interface Meta {
  key: string;
  value: unknown;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("leads")) db.createObjectStore("leads", { keyPath: "id" });
        if (!db.objectStoreNames.contains("agents")) db.createObjectStore("agents", { keyPath: "id" });
        if (!db.objectStoreNames.contains("notifications")) db.createObjectStore("notifications", { keyPath: "id" });
        if (!db.objectStoreNames.contains("activity")) db.createObjectStore("activity", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
        if (!db.objectStoreNames.contains("queue")) {
          db.createObjectStore("queue", { keyPath: "qid", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Generic store helpers ----------
async function getAll<T>(store: string): Promise<T[]> {
  const db = await getDb();
  return db.getAll(store);
}
async function putAll(store: string, items: unknown[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(store, "readwrite");
  await tx.store.clear();
  for (const item of items) await tx.store.put(item);
  await tx.done;
}
async function put(store: string, item: unknown): Promise<void> {
  const db = await getDb();
  await db.put(store, item);
}
async function del(store: string, key: string): Promise<void> {
  const db = await getDb();
  await db.delete(store, key);
}

// ---------- Leads ----------
export const leadsCache = {
  all: () => getAll<Lead>("leads"),
  replaceAll: (leads: Lead[]) => putAll("leads", leads),
  put: (lead: Lead) => put("leads", lead),
  delete: (id: string) => del("leads", id),
};

// ---------- Agents (Users) ----------
export const agentsCache = {
  all: () => getAll<User>("agents"),
  replaceAll: (agents: User[]) => putAll("agents", agents),
  put: (agent: User) => put("agents", agent),
  delete: (id: string) => del("agents", id),
};

// ---------- Notifications ----------
export const notificationsCache = {
  all: () => getAll<AppNotification>("notifications"),
  replaceAll: (items: AppNotification[]) => putAll("notifications", items),
  put: (item: AppNotification) => put("notifications", item),
};

// ---------- Activity ----------
export const activityCache = {
  all: () => getAll<ActivityEvent>("activity"),
  replaceAll: (items: ActivityEvent[]) => putAll("activity", items),
  put: (item: ActivityEvent) => put("activity", item),
};

// ---------- Meta (settings, current user, last-sync timestamps) ----------
export const metaCache = {
  async get<T>(key: string): Promise<T | undefined> {
    const db = await getDb();
    const row = (await db.get("meta", key)) as Meta | undefined;
    return row?.value as T | undefined;
  },
  async set(key: string, value: unknown): Promise<void> {
    const db = await getDb();
    await db.put("meta", { key, value });
  },
};

export const settingsCache = {
  get: () => metaCache.get<SystemSettings>("settings"),
  set: (s: SystemSettings) => metaCache.set("settings", s),
};

// ---------- Sync queue ----------
export const syncQueue = {
  async push(item: Omit<QueueItem, "qid">): Promise<void> {
    const db = await getDb();
    await db.add("queue", item);
  },
  async all(): Promise<QueueItem[]> {
    const db = await getDb();
    return db.getAll("queue");
  },
  async remove(qid: number): Promise<void> {
    const db = await getDb();
    await db.delete("queue", qid);
  },
  async count(): Promise<number> {
    const db = await getDb();
    return db.count("queue");
  },
};
