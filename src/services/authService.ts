import { ACTIONS } from "@/config/api";
import { request } from "./apiClient";
import { session, type SessionRecord } from "./session";
import type { User } from "@/types/domain";

interface LoginResponse {
  token: string;
  expiresAt: number;
  user: User;
}

export const authService = {
  async login(email: string, password: string, rememberMe = false): Promise<{ user: User }> {
    const res = await request<LoginResponse>({
      action: ACTIONS.login,
      data: { email: email.trim().toLowerCase(), password, rememberMe },
    });
    const record: SessionRecord = {
      token: res.token,
      userId: res.user.id,
      role: res.user.role,
      fullName: res.user.fullName,
      email: res.user.email,
      expiresAt: res.expiresAt,
    };
    session.set(record);
    return { user: res.user };
  },

  async me(): Promise<User | null> {
    if (!session.token()) return null;
    try {
      return await request<User>({ action: ACTIONS.me });
    } catch {
      session.clear();
      return null;
    }
  },

  async logout(): Promise<void> {
    try { await request({ action: ACTIONS.logout }); } catch { /* ignore */ }
    session.clear();
  },

  // Agents CRUD — admin only. Server enforces role from token.
  async listAgents(): Promise<User[]> {
    return request<User[]>({ action: ACTIONS.agentsList });
  },
  async createAgent(input: {
    fullName: string; email: string; phone?: string;
    password: string; avatarUrl?: string; status?: "Active" | "Disabled";
  }): Promise<User> {
    return request<User>({ action: ACTIONS.agentsCreate, data: input });
  },
  async updateAgent(id: string, patch: Partial<User> & { password?: string }): Promise<User> {
    return request<User>({ action: ACTIONS.agentsUpdate, data: { id, patch } });
  },
  async setStatus(id: string, status: "Active" | "Disabled"): Promise<User> {
    return request<User>({ action: ACTIONS.agentsSetStatus, data: { id, status } });
  },
  async deleteAgent(id: string): Promise<void> {
    await request({ action: ACTIONS.agentsDelete, data: { id } });
  },
  async resetPassword(id: string, newPassword: string): Promise<User> {
    return request<User>({ action: ACTIONS.agentsResetPassword, data: { id, newPassword } });
  },
};
