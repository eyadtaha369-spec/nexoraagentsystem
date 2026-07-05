import { mockDelay, request } from "./apiClient";
import { storage } from "./storage";
import type { User } from "@/types/domain";

const SESSION_KEY = "nexora.session";
const AGENTS_KEY = "nexora.agents";

export interface Session {
  userId: string;
  token: string;
  rememberMe: boolean;
  expiresAt: number;
}

function loadAgents(): (User & { password?: string })[] {
  return storage.get(AGENTS_KEY, []);
}
function saveAgents(a: (User & { password?: string })[]) {
  storage.set(AGENTS_KEY, a);
}

export const authService = {
  async login(email: string, password: string, rememberMe = false): Promise<{ user: User; session: Session }> {
    const result = await request<{ token: string; role: string; name: string; email: string }>({
      action: "login",
      data: { email, password },
    });

    const user: User = {
      id: result.email,
      fullName: result.name,
      email: result.email,
      role: result.role.toLowerCase() === "admin" ? "admin" : "agent",
      status: "Active",
      createdAt: new Date().toISOString(),
    };

    const session: Session = {
      userId: user.id,
      token: result.token,
      rememberMe,
      expiresAt: Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000,
    };
    storage.set(SESSION_KEY, session);
    storage.set("nexora.currentUser", user);
    return { user, session };
  },

  async me(): Promise<User | null> {
    const s = storage.get<Session | null>(SESSION_KEY, null);
    if (!s || Date.now() > s.expiresAt) {
      if (s) storage.remove(SESSION_KEY);
      return null;
    }
    const cachedUser = storage.get<User | null>("nexora.currentUser", null);
    return cachedUser;
  },

  async logout(): Promise<void> {
    storage.remove(SESSION_KEY);
    storage.remove("nexora.currentUser");
    await mockDelay(null, 100);
  },

  async listAgents(): Promise<User[]> {
    return mockDelay(loadAgents().map(({ password: _p, ...u }) => u));
  },

  async createAgent(input: {
    fullName: string; email: string; phone?: string;
    password: string; avatarUrl?: string; status?: "Active" | "Disabled";
  }): Promise<User> {
    await mockDelay(null, 400);
    const agents = loadAgents();
    if (agents.some((a) => a.email.toLowerCase() === input.email.toLowerCase()))
      throw new Error("An agent with that email already exists.");
    const user: User & { password: string } = {
      id: crypto.randomUUID(),
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim(),
      avatarUrl: input.avatarUrl,
      role: "agent",
      status: input.status ?? "Active",
      createdAt: new Date().toISOString(),
      password: input.password,
    };
    agents.push(user);
    saveAgents(agents);
    const { password: _p, ...safe } = user;
    return safe;
  },

  async updateAgent(id: string, patch: Partial<User> & { password?: string }): Promise<User> {
    await mockDelay(null, 300);
    const agents = loadAgents();
    const idx = agents.findIndex((a) => a.id === id);
    if (idx < 0) throw new Error("Agent not found.");
    agents[idx] = { ...agents[idx], ...patch };
    saveAgents(agents);
    const { password: _p, ...safe } = agents[idx];
    return safe;
  },

  async setStatus(id: string, status: "Active" | "Disabled") {
    return this.updateAgent(id, { status });
  },

  async deleteAgent(id: string): Promise<void> {
    await mockDelay(null, 300);
    saveAgents(loadAgents().filter((a) => a.id !== id));
  },

  async resetPassword(id: string, newPassword: string) {
    return this.updateAgent(id, { password: newPassword });
  },
};
