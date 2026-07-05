// Deprecated: kept for legacy imports. The app no longer stores domain data
// in localStorage — see services/session.ts for the only remaining cache.
export const storage = {
  get<T>(_key: string, fallback: T): T { return fallback; },
  set<_T>(_key: string, _value: _T) { /* noop */ },
  remove(_key: string) { /* noop */ },
};
