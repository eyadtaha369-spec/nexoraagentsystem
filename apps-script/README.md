# Nexora CRM — Google Apps Script backend

This folder contains `Code.gs`, the complete REST API that powers the Nexora
CRM frontend. The frontend never touches a mock or local storage layer —
every service call goes through the `ApiClient` which POSTs to the URL you
configure in `VITE_APPS_SCRIPT_URL`.

## Deploy

1. Create a Google Sheet, copy its spreadsheet ID from the URL.
2. Extensions → Apps Script. Replace the default file with `Code.gs`.
3. In Project Settings → Script properties, add:
   - `SPREADSHEET_ID` — the sheet ID
   - `HMAC_SECRET` — a random 64-char string (used to sign session tokens)
   - `ADMIN_EMAIL` — e.g. `admin@nexora.com`
   - `ADMIN_PASSWORD` — the initial admin password
4. Deploy → New deployment → **Web app**. Execute as: Me. Access: **Anyone**.
5. Copy the `/exec` URL into your project `.env`:

   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
   ```

6. Restart the dev server. Sign in with the admin email/password you set.

## What the script provisions

On first request the script auto-creates these sheets:

| Sheet          | Purpose                                                  |
|----------------|----------------------------------------------------------|
| `Users`        | Admin + agents (hashed passwords, roles, status)         |
| `Leads`        | Lead records                                             |
| `Notes`        | Notes per lead                                           |
| `Timeline`     | Per-lead activity timeline                               |
| `Notifications`| Per-user in-app notifications                            |
| `Activity`     | Global activity log (logins, CRUD, assignments)          |
| `Settings`     | Company settings                                         |

## Security notes

- Session tokens are HMAC-SHA256 signed and time-boxed (1 day, or 30 days
  when "Remember me" is set). Every request re-verifies the signature.
- Passwords are stored as `SHA-256(password + ":" + HMAC_SECRET)`. Rotate the
  HMAC secret only when you can also reset agent passwords.
- Agents can only see / mutate leads where `assignedAgentId === their.id`.
  All admin-only routes call `requireAdmin(token)`.
- The Web App must be deployed with "Execute as: Me" so the sheet is
  accessible; access is intentionally "Anyone" because the browser cannot
  authenticate with Google — the HMAC token is the auth layer.
