// Session token cache. This is the ONLY piece of state we persist client-side —
// everything else lives on the server (Google Apps Script + Sheets).

const KEY = "nexora.session.v1";

export interface SessionRecord {
  token: string;
  userId: string;
  role: "admin" | "agent";
  fullName: string;
  email: string;
  expiresAt: number;
}

const listeners = new Set<(s: SessionRecord | null) => void>();

function read(): SessionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionRecord;
    if (!s?.token || Date.now() > s.expiresAt) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function write(s: SessionRecord | null) {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
  listeners.forEach((fn) => fn(s));
}

export const session = {
  get: read,
  set: (s: SessionRecord) => write(s),
  clear: () => write(null),
  token: () => read()?.token ?? null,
  subscribe(fn: (s: SessionRecord | null) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
