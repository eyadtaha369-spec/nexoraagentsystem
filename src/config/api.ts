// Centralized API config. Every service goes through ApiClient which reads this.
// Set VITE_APPS_SCRIPT_URL in .env once your Google Apps Script Web App is deployed.

export const API_CONFIG = {
  baseUrl: "https://script.google.com/macros/s/AKfycbyF_gcNQmKtC3ofTNIUt_KSaJVTVO3Db1XhWofvbAmRHcBf5O6LBUGqkv6MF020OIgoVw/exec",
  spreadsheetId: (import.meta.env.VITE_SPREADSHEET_ID as string | undefined)?.trim() ?? "",
  environment: (import.meta.env.MODE as string) ?? "development",
  timeoutMs: 20_000,
  retries: 2,
  retryBackoffMs: 400,
} as const;

// Every action name the frontend can call. Apps Script routes by `action`.
export const ACTIONS = {
  // Auth
  login: "auth.login",
  logout: "auth.logout",
  me: "auth.me",
  // Agents
  agentsList: "agents.list",
  agentsCreate: "agents.create",
  agentsUpdate: "agents.update",
  agentsDelete: "agents.delete",
  agentsSetStatus: "agents.setStatus",
  agentsResetPassword: "agents.resetPassword",
  // Leads
  leadsList: "leads.list",
  leadsGet: "leads.get",
  leadsCreate: "leads.create",
  leadsUpdate: "leads.update",
  leadsDelete: "leads.delete",
  leadsAddNote: "leads.addNote",
  leadsScheduleFollowUp: "leads.scheduleFollowUp",
  leadsAssign: "leads.assign",
  leadsRoundRobin: "leads.roundRobin",
  leadsBulkDelete: "leads.bulkDelete",
  leadsExport: "leads.export",
  leadsImport: "leads.import",
  // Dashboard
  dashboardAdmin: "dashboard.admin",
  dashboardAgent: "dashboard.agent",
  // Activity
  activityList: "activity.list",
  // Notifications
  notificationsList: "notifications.list",
  notificationsUnread: "notifications.unreadCount",
  notificationsMarkRead: "notifications.markRead",
  notificationsMarkAllRead: "notifications.markAllRead",
  // Settings
  settingsGet: "settings.get",
  settingsUpdate: "settings.update",
  settingsTest: "settings.testConnection",
} as const;

export type ApiAction = (typeof ACTIONS)[keyof typeof ACTIONS];
