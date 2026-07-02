// Server-only Google Sheets gateway helpers.
const SHEET_ID = "1omumAlkdPwxPOx7sQ3TfwbuVOThdUp3OZ3oR9GD795Y";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

// Fixed agent tabs — canonical list from the sheet.
export const AGENT_TABS = [
  "Nabil Elgendy",
  "Abdelrahman Ahmed",
  "Ahmed Sakr",
  "Ahmed Sherif",
  "Tahseen",
  "Yahya Ahmed",
  "Agamy",
  "Omar Amr",
] as const;

export type AgentTab = (typeof AGENT_TABS)[number];

function authHeaders() {
  const apiKey = process.env.LOVABLE_API_KEY;
  const conn = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey || !conn) throw new Error("Google Sheets connection not configured");
  return {
    Authorization: `Bearer ${apiKey}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
  };
}

async function gw(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets gateway ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export interface SheetRow {
  clientId: string;
  clientName: string;
  phone: string;
  mapsLink: string;
  instagramLink: string;
  facebookLink: string;
  status: string;
  notes: string;
  dateAdded: string;
  assignedAgent: AgentTab;
  sheetRow: number; // 1-based, includes header
}

export async function readAgentTab(tab: AgentTab): Promise<SheetRow[]> {
  const range = `${tab}!A2:I1000`;
  const encoded = encodeURIComponent(range);
  const data = await gw(`/spreadsheets/${SHEET_ID}/values/${encoded}`);
  const values: string[][] = data.values || [];
  return values
    .map((row, idx) => ({
      clientId: (row[0] || "").trim(),
      clientName: row[1] || "",
      phone: row[2] || "",
      mapsLink: row[3] || "",
      instagramLink: row[4] || "",
      facebookLink: row[5] || "",
      status: row[6] || "New",
      notes: row[7] || "",
      dateAdded: row[8] || "",
      assignedAgent: tab,
      sheetRow: idx + 2, // +2: row 1 is header, values are 0-indexed
    }))
    .filter((r) => r.clientId);
}

export async function readAllTabs(): Promise<SheetRow[]> {
  const all: SheetRow[] = [];
  for (const tab of AGENT_TABS) {
    try {
      const rows = await readAgentTab(tab);
      all.push(...rows);
    } catch (e) {
      console.error(`Failed reading tab ${tab}`, e);
    }
  }
  return all;
}

// Update status + notes for a specific row in a specific tab.
export async function updateLeadRow(tab: AgentTab, sheetRow: number, status: string, notes: string) {
  const range = `${tab}!G${sheetRow}:H${sheetRow}`;
  const encoded = encodeURIComponent(range);
  await gw(`/spreadsheets/${SHEET_ID}/values/${encoded}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values: [[status, notes]] }),
  });
}

// Append a new lead row to a specific tab. Returns the new row number.
export async function appendLeadRow(tab: AgentTab, row: Omit<SheetRow, "sheetRow" | "assignedAgent">): Promise<number> {
  const range = `${tab}!A:I`;
  const encoded = encodeURIComponent(range);
  const values = [[
    row.clientId,
    row.clientName,
    row.phone,
    row.mapsLink,
    row.instagramLink,
    row.facebookLink,
    row.status,
    row.notes,
    row.dateAdded,
  ]];
  const result = await gw(`/spreadsheets/${SHEET_ID}/values/${encoded}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
  // updates.updatedRange like "'Tab Name'!A5:I5"
  const updated: string = result?.updates?.updatedRange || "";
  const match = updated.match(/![A-Z]+(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Blank out a specific row (used when moving a lead to a different agent tab).
export async function clearLeadRow(tab: AgentTab, sheetRow: number) {
  const range = `${tab}!A${sheetRow}:I${sheetRow}`;
  const encoded = encodeURIComponent(range);
  await gw(`/spreadsheets/${SHEET_ID}/values/${encoded}:clear`, { method: "POST", body: "{}" });
}
