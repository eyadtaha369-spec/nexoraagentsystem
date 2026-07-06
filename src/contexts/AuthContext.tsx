import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { authService } from "@/services/authService";
import { onUnauthorized } from "@/services/apiClient";
import { session } from "@/services/session";
import type { User } from "@/types/domain";
import { toast } from "sonner";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // TEMP DEBUG
    toast.info("DEBUG: refresh() called, checking session...");
    const u = await authService.me();
    // TEMP DEBUG
    toast.info(`DEBUG: refresh() result: ${u ? "user found (" + u.email + ")" : "NULL"}`);
    setUser(u);
  }, []);

  useEffect(() => {
    (async () => {
      try { await refresh(); } finally { setLoading(false); }
    })();
    const off401 = onUnauthorized(() => {
      // TEMP DEBUG
      toast.error("DEBUG: onUnauthorized FIRED — this is clearing your session!");
      session.clear();
      setUser(null);
    });
    const offSess = session.subscribe((s) => {
      if (!s) {
        // TEMP DEBUG
        toast.error("DEBUG: session.subscribe saw NULL — clearing user state");
        setUser(null);
      }
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("nexora.session")) {
        // TEMP DEBUG
        toast.info("DEBUG: storage event triggered refresh()");
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      off401();
      offSess();
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    const { user } = await authService.login(email, password, remember);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}

