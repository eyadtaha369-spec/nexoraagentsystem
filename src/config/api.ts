// Centralized API config. All Google Apps Script endpoints live here.
// When ready to connect: set VITE_APPS_SCRIPT_URL in .env and the API client will use it.

export const API_CONFIG = {
  appsScriptUrl: (import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined) ?? "",
  spreadsheetId: (import.meta.env.VITE_SPREADSHEET_ID as string | undefined) ?? "",
  environment: (import.meta.env.MODE as string) ?? "development",
  timeoutMs: 15000,
  retries: 2,
  pollIntervalMs: 60_000,
};

// Logical endpoint names. Apps Script uses a single URL with `action` param.
export const ENDPOINTS = {
  auth: { login: "login", logout: "logout", me: "me" },
  leads: {
    list: "leads.list", get: "leads.get", create: "leads.create",
    update: "leads.update", delete: "leads.delete", addNote: "leads.addNote",
    search: "leads.search", filter: "leads.filter",
  },
  agents: {
    list: "agents.list", create: "agents.create", update: "agents.update",
    disable: "agents.disable", enable: "agents.enable", delete: "agents.delete",
    resetPassword: "agents.resetPassword",
  },
  dashboard: { stats: "dashboard.stats", activity: "dashboard.activity" },
  distribution: { manual: "distribution.manual", roundRobin: "distribution.roundRobin" },
  activity: { list: "activity.list" },
  settings: { get: "settings.get", update: "settings.update", testConnection: "settings.testConnection" },
  notifications: { list: "notifications.list", markRead: "notifications.markRead" },
  imports: { status: "imports.status" },
  exports: { csv: "exports.csv", excel: "exports.excel" },
} as const;
