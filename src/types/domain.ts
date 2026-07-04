export type Role = "admin" | "agent";

export type LeadStatus =
  | "New" | "Contacted" | "Interested" | "Follow Up"
  | "Won" | "Lost" | "No Answer" | "Wrong Number";

export type LeadPriority = "High" | "Medium" | "Low";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: Role;
  status: "Active" | "Disabled";
  createdAt: string;
}

export interface Note {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  type: "created" | "status_changed" | "note_added" | "followup_scheduled" | "assigned" | "imported";
  leadId?: string;
  userId?: string;
  message: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  mapsLink?: string;
  instagram?: string;
  facebook?: string;
  status: LeadStatus;
  priority: LeadPriority;
  assignedAgentId: string | null;
  dateAdded: string;
  nextFollowUp?: string | null;
  followUpNote?: string;
  source?: string;
  notes: Note[];
  timeline: ActivityEvent[];
}

export interface DashboardStats {
  total: number;
  new: number;
  contacted: number;
  followUp: number;
  won: number;
  lost: number;
  today: number;
  monthly: number;
  activeAgents: number;
  disabledAgents: number;
  conversionRate: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

export interface SystemSettings {
  companyName: string;
  companyEmail: string;
  appsScriptUrl: string;
  spreadsheetId: string;
  distributionMode: "manual" | "round_robin";
  notificationsEnabled: boolean;
}
