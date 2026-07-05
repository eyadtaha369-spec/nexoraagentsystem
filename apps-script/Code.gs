/**
 * Nexora CRM — Google Apps Script backend.
 *
 * DEPLOY:
 * 1. Create a new Google Sheet. Copy the spreadsheet ID from the URL.
 * 2. Extensions → Apps Script → paste this file as `Code.gs`.
 * 3. Script Properties (⚙ → Project Settings → Script properties):
 *      SPREADSHEET_ID   = <your sheet id>
 *      HMAC_SECRET      = <any long random string, e.g. 64 hex chars>
 *      ADMIN_EMAIL      = admin@nexora.com
 *      ADMIN_PASSWORD   = <initial admin password>
 * 4. Deploy → New deployment → Type: Web app.
 *      Execute as: Me. Who has access: Anyone.
 * 5. Copy the /exec URL into `.env` as VITE_APPS_SCRIPT_URL.
 * 6. On first request the script auto-creates sheets: Users, Leads, Notes,
 *    Timeline, Notifications, Activity, Settings.
 */

// ---------- Configuration ----------
var PROPS = PropertiesService.getScriptProperties();
var SPREADSHEET_ID = PROPS.getProperty('SPREADSHEET_ID');
var HMAC_SECRET = PROPS.getProperty('HMAC_SECRET') || 'change-me';
var ADMIN_EMAIL = (PROPS.getProperty('ADMIN_EMAIL') || 'admin@nexora.com').toLowerCase();
var ADMIN_PASSWORD = PROPS.getProperty('ADMIN_PASSWORD') || 'ChangeMe123!';

var SHORT_TTL_MS = 24 * 60 * 60 * 1000;      // 1 day
var LONG_TTL_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------- Entry point ----------
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (_) {
    return jsonOut({ ok: false, error: 'Malformed JSON' });
  }
  try {
    var action = body.action;
    var payload = body.payload || {};
    var token = body.token || null;
    var handler = ROUTES[action];
    if (!handler) return jsonOut({ ok: false, error: 'Unknown action: ' + action });
    var data = handler(payload, token);
    return jsonOut({ ok: true, data: data });
  } catch (err) {
    var msg = (err && err.message) || String(err);
    var code = /unauth/i.test(msg) ? 'UNAUTHORIZED' : undefined;
    return jsonOut({ ok: false, error: msg, code: code });
  }
}

function doGet() {
  return jsonOut({ ok: true, data: { service: 'Nexora CRM API', ts: Date.now() } });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Spreadsheet bootstrap ----------
var SHEETS = {
  users:         { name: 'Users',         headers: ['id','fullName','email','phone','avatarUrl','role','status','passwordHash','createdAt'] },
  leads:         { name: 'Leads',         headers: ['id','clientId','clientName','phone','email','company','country','city','mapsLink','instagram','facebook','source','status','priority','assignedAgentId','dateAdded','updatedAt','nextFollowUp','followUpNote'] },
  notes:         { name: 'Notes',         headers: ['id','leadId','author','text','createdAt'] },
  timeline:      { name: 'Timeline',      headers: ['id','leadId','type','message','createdAt'] },
  notifications: { name: 'Notifications', headers: ['id','userId','title','body','type','read','createdAt'] },
  activity:      { name: 'Activity',      headers: ['id','userId','type','message','leadId','createdAt'] },
  settings:      { name: 'Settings',      headers: ['key','value'] },
};

function ss() {
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID script property is not set.');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sheet(key) {
  var meta = SHEETS[key];
  var book = ss();
  var sh = book.getSheetByName(meta.name);
  if (!sh) {
    sh = book.insertSheet(meta.name);
    sh.appendRow(meta.headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll(key) {
  var sh = sheet(key);
  var range = sh.getDataRange();
  var values = range.getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  return out;
}

function appendRow(key, obj) {
  var meta = SHEETS[key];
  var sh = sheet(key);
  var row = meta.headers.map(function (h) { return obj[h] != null ? obj[h] : ''; });
  sh.appendRow(row);
  return obj;
}

function updateRow(key, id, patch) {
  var meta = SHEETS[key];
  var sh = sheet(key);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) {
      var current = {};
      for (var c = 0; c < headers.length; c++) current[headers[c]] = values[i][c];
      var next = Object.assign({}, current, patch);
      var row = headers.map(function (h) { return next[h] != null ? next[h] : ''; });
      sh.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return next;
    }
  }
  throw new Error(meta.name + ' row not found: ' + id);
}

function deleteRow(key, id) {
  var sh = sheet(key);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

// ---------- Utilities ----------
function uuid() { return Utilities.getUuid(); }
function nowIso() { return new Date().toISOString(); }

function sha256(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function hmac(text) {
  var raw = Utilities.computeHmacSha256Signature(text, HMAC_SECRET);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function signToken(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  return body + '.' + hmac(body);
}

function verifyToken(token) {
  if (!token) throw new Error('Unauthorized: missing token.');
  var parts = String(token).split('.');
  if (parts.length !== 2) throw new Error('Unauthorized: malformed token.');
  if (hmac(parts[0]) !== parts[1]) throw new Error('Unauthorized: invalid signature.');
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (payload.exp && Date.now() > payload.exp) throw new Error('Unauthorized: session expired.');
  return payload; // { sub, role, exp }
}

function requireAuth(token) {
  var claims = verifyToken(token);
  if (claims.sub === 'admin') return { id: 'admin', role: 'admin', fullName: 'Nexora Admin', email: ADMIN_EMAIL };
  var user = readAll('users').filter(function (u) { return u.id === claims.sub; })[0];
  if (!user) throw new Error('Unauthorized: user not found.');
  if (user.status === 'Disabled') throw new Error('Account is disabled.');
  return sanitizeUser(user);
}

function requireAdmin(token) {
  var u = requireAuth(token);
  if (u.role !== 'admin') throw new Error('Forbidden: admin only.');
  return u;
}

function sanitizeUser(u) {
  return {
    id: u.id, fullName: u.fullName, email: u.email, phone: u.phone || '',
    avatarUrl: u.avatarUrl || '', role: u.role, status: u.status,
    createdAt: u.createdAt,
  };
}

function logActivity(userId, type, message, leadId) {
  appendRow('activity', {
    id: uuid(), userId: userId || '', type: type, message: message,
    leadId: leadId || '', createdAt: nowIso(),
  });
}

function pushNotification(userId, title, body, type) {
  appendRow('notifications', {
    id: uuid(), userId: userId || '', title: title, body: body,
    type: type || 'info', read: false, createdAt: nowIso(),
  });
}

// ---------- Routes ----------
var ROUTES = {
  // Auth
  'auth.login': function (p) {
    var email = String(p.email || '').trim().toLowerCase();
    var password = String(p.password || '');
    var remember = !!p.rememberMe;
    if (!email || !password) throw new Error('Email and password are required.');

    var ttl = remember ? LONG_TTL_MS : SHORT_TTL_MS;
    var exp = Date.now() + ttl;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      logActivity('admin', 'login', 'Admin signed in.');
      return {
        token: signToken({ sub: 'admin', role: 'admin', exp: exp }),
        expiresAt: exp,
        user: { id: 'admin', fullName: 'Nexora Admin', email: ADMIN_EMAIL, role: 'admin', status: 'Active', createdAt: nowIso() },
      };
    }

    var user = readAll('users').filter(function (u) { return String(u.email).toLowerCase() === email; })[0];
    if (!user) throw new Error('Invalid email or password.');
    if (user.status === 'Disabled') throw new Error('This account is disabled.');
    if (user.passwordHash !== sha256(password + ':' + HMAC_SECRET)) throw new Error('Invalid email or password.');

    logActivity(user.id, 'login', user.fullName + ' signed in.');
    return {
      token: signToken({ sub: user.id, role: user.role, exp: exp }),
      expiresAt: exp,
      user: sanitizeUser(user),
    };
  },

  'auth.logout': function (_p, token) {
    try {
      var u = requireAuth(token);
      logActivity(u.id, 'logout', u.fullName + ' signed out.');
    } catch (_) {}
    return { ok: true };
  },

  'auth.me': function (_p, token) { return requireAuth(token); },

  // Agents
  'agents.list': function (_p, token) {
    requireAdmin(token);
    return readAll('users').map(sanitizeUser);
  },
  'agents.create': function (p, token) {
    requireAdmin(token);
    if (!p.fullName || !p.email || !p.password) throw new Error('Full name, email and password are required.');
    var email = String(p.email).trim().toLowerCase();
    var existing = readAll('users').filter(function (u) { return String(u.email).toLowerCase() === email; })[0];
    if (existing) throw new Error('An agent with that email already exists.');
    var user = {
      id: uuid(), fullName: String(p.fullName).trim(), email: email,
      phone: p.phone || '', avatarUrl: p.avatarUrl || '',
      role: 'agent', status: p.status || 'Active',
      passwordHash: sha256(String(p.password) + ':' + HMAC_SECRET),
      createdAt: nowIso(),
    };
    appendRow('users', user);
    logActivity('admin', 'agent_created', 'Agent created: ' + user.fullName);
    return sanitizeUser(user);
  },
  'agents.update': function (p, token) {
    requireAdmin(token);
    var patch = Object.assign({}, p.patch || {});
    if (patch.password) { patch.passwordHash = sha256(patch.password + ':' + HMAC_SECRET); delete patch.password; }
    var next = updateRow('users', p.id, patch);
    return sanitizeUser(next);
  },
  'agents.setStatus': function (p, token) {
    requireAdmin(token);
    return sanitizeUser(updateRow('users', p.id, { status: p.status }));
  },
  'agents.delete': function (p, token) {
    requireAdmin(token);
    deleteRow('users', p.id);
    logActivity('admin', 'agent_deleted', 'Agent deleted: ' + p.id);
    return { ok: true };
  },
  'agents.resetPassword': function (p, token) {
    requireAdmin(token);
    return sanitizeUser(updateRow('users', p.id, { passwordHash: sha256(p.newPassword + ':' + HMAC_SECRET) }));
  },

  // Leads
  'leads.list': function (p, token) {
    var me = requireAuth(token);
    var leads = readAll('leads');
    if (me.role !== 'admin') leads = leads.filter(function (l) { return l.assignedAgentId === me.id; });
    var f = p && p.filters ? p.filters : {};
    if (f.status && f.status.length) leads = leads.filter(function (l) { return f.status.indexOf(l.status) >= 0; });
    if (f.priority && f.priority.length) leads = leads.filter(function (l) { return f.priority.indexOf(l.priority) >= 0; });
    if (f.agentId !== undefined && me.role === 'admin') leads = leads.filter(function (l) { return l.assignedAgentId === f.agentId; });
    if (f.dateFrom) leads = leads.filter(function (l) { return l.dateAdded >= f.dateFrom; });
    if (f.dateTo)   leads = leads.filter(function (l) { return l.dateAdded <= f.dateTo; });
    if (f.search) {
      var q = String(f.search).toLowerCase();
      leads = leads.filter(function (l) {
        return String(l.clientName).toLowerCase().indexOf(q) >= 0
            || String(l.phone).toLowerCase().indexOf(q) >= 0
            || String(l.email).toLowerCase().indexOf(q) >= 0
            || String(l.clientId).toLowerCase().indexOf(q) >= 0;
      });
    }
    var sort = (p && p.sort) || 'newest';
    var W = { High: 0, Medium: 1, Low: 2 };
    leads.sort(function (a, b) {
      if (sort === 'oldest')   return String(a.dateAdded).localeCompare(String(b.dateAdded));
      if (sort === 'priority') return (W[a.priority]||9) - (W[b.priority]||9);
      if (sort === 'status')   return String(a.status).localeCompare(String(b.status));
      if (sort === 'name')     return String(a.clientName).localeCompare(String(b.clientName));
      return String(b.dateAdded).localeCompare(String(a.dateAdded));
    });
    return leads.map(function (l) { return hydrateLead(l); });
  },

  'leads.get': function (p, token) {
    var me = requireAuth(token);
    var lead = readAll('leads').filter(function (l) { return l.id === p.id; })[0];
    if (!lead) return null;
    if (me.role !== 'admin' && lead.assignedAgentId !== me.id) throw new Error('Forbidden: not your lead.');
    return hydrateLead(lead);
  },

  'leads.create': function (p, token) {
    var me = requireAuth(token);
    var lead = {
      id: uuid(),
      clientId: p.clientId || ('C-' + Date.now()),
      clientName: p.clientName, phone: p.phone || '', email: p.email || '',
      company: p.company || '', country: p.country || '', city: p.city || '',
      mapsLink: p.mapsLink || '', instagram: p.instagram || '', facebook: p.facebook || '',
      source: p.source || '', status: p.status || 'New', priority: p.priority || 'Medium',
      assignedAgentId: p.assignedAgentId || (me.role === 'agent' ? me.id : ''),
      dateAdded: p.dateAdded || nowIso(), updatedAt: nowIso(),
      nextFollowUp: p.nextFollowUp || '', followUpNote: p.followUpNote || '',
    };
    appendRow('leads', lead);
    appendRow('timeline', { id: uuid(), leadId: lead.id, type: 'created', message: 'Lead created for ' + lead.clientName, createdAt: nowIso() });
    logActivity(me.id, 'created', 'New lead: ' + lead.clientName, lead.id);
    if (lead.assignedAgentId && lead.assignedAgentId !== me.id) {
      pushNotification(lead.assignedAgentId, 'New lead assigned', lead.clientName, 'info');
    }
    return hydrateLead(lead);
  },

  'leads.update': function (p, token) {
    var me = requireAuth(token);
    var current = readAll('leads').filter(function (l) { return l.id === p.id; })[0];
    if (!current) throw new Error('Lead not found.');
    if (me.role !== 'admin' && current.assignedAgentId !== me.id) throw new Error('Forbidden.');
    var patch = Object.assign({}, p.patch || {}, { updatedAt: nowIso() });
    var next = updateRow('leads', p.id, patch);
    if (patch.status && patch.status !== current.status) {
      appendRow('timeline', { id: uuid(), leadId: p.id, type: 'status_changed', message: 'Status: ' + current.status + ' → ' + patch.status, createdAt: nowIso() });
      logActivity(me.id, 'status_changed', current.clientName + ': ' + current.status + ' → ' + patch.status, p.id);
    }
    if (patch.assignedAgentId && patch.assignedAgentId !== current.assignedAgentId) {
      appendRow('timeline', { id: uuid(), leadId: p.id, type: 'assigned', message: 'Reassigned', createdAt: nowIso() });
      logActivity(me.id, 'assigned', 'Reassigned: ' + current.clientName, p.id);
      pushNotification(patch.assignedAgentId, 'Lead assigned', current.clientName, 'info');
    }
    return hydrateLead(next);
  },

  'leads.delete': function (p, token) {
    requireAdmin(token);
    deleteRow('leads', p.id);
    logActivity('admin', 'deleted', 'Lead deleted: ' + p.id, p.id);
    return { ok: true };
  },

  'leads.bulkDelete': function (p, token) {
    requireAdmin(token);
    var n = 0;
    (p.ids || []).forEach(function (id) { if (deleteRow('leads', id)) n++; });
    logActivity('admin', 'deleted', 'Bulk deleted ' + n + ' leads.');
    return { deleted: n };
  },

  'leads.addNote': function (p, token) {
    var me = requireAuth(token);
    var lead = readAll('leads').filter(function (l) { return l.id === p.leadId; })[0];
    if (!lead) throw new Error('Lead not found.');
    if (me.role !== 'admin' && lead.assignedAgentId !== me.id) throw new Error('Forbidden.');
    var note = { id: uuid(), leadId: p.leadId, author: p.author || me.fullName, text: p.text, createdAt: nowIso() };
    appendRow('notes', note);
    appendRow('timeline', { id: uuid(), leadId: p.leadId, type: 'note_added', message: note.author + ' added a note', createdAt: note.createdAt });
    return { id: note.id, author: note.author, text: note.text, createdAt: note.createdAt };
  },

  'leads.scheduleFollowUp': function (p, token) {
    var me = requireAuth(token);
    var next = updateRow('leads', p.leadId, { nextFollowUp: p.date, followUpNote: p.note, updatedAt: nowIso() });
    appendRow('timeline', { id: uuid(), leadId: p.leadId, type: 'followup_scheduled', message: 'Follow-up scheduled for ' + p.date, createdAt: nowIso() });
    logActivity(me.id, 'followup_scheduled', 'Follow-up: ' + next.clientName, p.leadId);
    return hydrateLead(next);
  },

  'leads.assign': function (p, token) {
    requireAdmin(token);
    var next = updateRow('leads', p.leadId, { assignedAgentId: p.agentId || '', updatedAt: nowIso() });
    appendRow('timeline', { id: uuid(), leadId: p.leadId, type: 'assigned', message: 'Assigned to ' + (p.agentId || 'unassigned'), createdAt: nowIso() });
    if (p.agentId) pushNotification(p.agentId, 'Lead assigned', next.clientName, 'info');
    return hydrateLead(next);
  },

  'leads.roundRobin': function (p, token) {
    requireAdmin(token);
    var agents = (p.agentIds || []);
    if (!agents.length) return { assigned: 0 };
    var leads = readAll('leads');
    var sh = sheet('leads');
    var values = sh.getDataRange().getValues();
    var headers = values[0];
    var idCol = headers.indexOf('id');
    var agentCol = headers.indexOf('assignedAgentId');
    var updatedCol = headers.indexOf('updatedAt');
    var assigned = 0, i = 0;
    for (var r = 1; r < values.length; r++) {
      if (!values[r][agentCol]) {
        var a = agents[i % agents.length];
        sh.getRange(r + 1, agentCol + 1).setValue(a);
        if (updatedCol >= 0) sh.getRange(r + 1, updatedCol + 1).setValue(nowIso());
        appendRow('timeline', { id: uuid(), leadId: values[r][idCol], type: 'assigned', message: 'Round-robin: ' + a, createdAt: nowIso() });
        i++; assigned++;
      }
    }
    logActivity('admin', 'assigned', 'Round-robin distributed ' + assigned + ' leads.');
    return { assigned: assigned };
  },

  // Dashboard
  'dashboard.admin': function (_p, token) {
    requireAdmin(token);
    return computeStats(readAll('leads'), readAll('users'));
  },
  'dashboard.agent': function (p, token) {
    var me = requireAuth(token);
    var agentId = me.role === 'admin' ? (p.agentId || me.id) : me.id;
    var mine = readAll('leads').filter(function (l) { return l.assignedAgentId === agentId; });
    return computeStats(mine, []);
  },

  // Activity
  'activity.list': function (p, token) {
    var me = requireAuth(token);
    var items = readAll('activity');
    if (me.role !== 'admin') items = items.filter(function (a) { return a.userId === me.id; });
    items.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    return items.slice(0, Math.min(500, (p && p.limit) || 100));
  },

  // Notifications
  'notifications.list': function (_p, token) {
    var me = requireAuth(token);
    return readAll('notifications')
      .filter(function (n) { return n.userId === me.id || n.userId === ''; })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
      .slice(0, 200);
  },
  'notifications.unreadCount': function (_p, token) {
    var me = requireAuth(token);
    var n = readAll('notifications').filter(function (x) {
      return (x.userId === me.id || x.userId === '') && !x.read && x.read !== 'TRUE';
    });
    return { count: n.length };
  },
  'notifications.markRead': function (p, token) {
    requireAuth(token);
    updateRow('notifications', p.id, { read: true });
    return { ok: true };
  },
  'notifications.markAllRead': function (_p, token) {
    var me = requireAuth(token);
    var sh = sheet('notifications');
    var values = sh.getDataRange().getValues();
    var headers = values[0];
    var uid = headers.indexOf('userId');
    var rd = headers.indexOf('read');
    for (var i = 1; i < values.length; i++) {
      if ((values[i][uid] === me.id || values[i][uid] === '') && !values[i][rd]) {
        sh.getRange(i + 1, rd + 1).setValue(true);
      }
    }
    return { ok: true };
  },

  // Settings
  'settings.get': function (_p, token) {
    requireAuth(token);
    return loadSettings();
  },
  'settings.update': function (p, token) {
    requireAdmin(token);
    var current = loadSettings();
    var next = Object.assign({}, current, p);
    var sh = sheet('settings');
    sh.clearContents();
    sh.appendRow(['key', 'value']);
    Object.keys(next).forEach(function (k) { sh.appendRow([k, typeof next[k] === 'object' ? JSON.stringify(next[k]) : String(next[k])]); });
    return next;
  },
  'settings.testConnection': function () { return { ok: true }; },
};

// ---------- Helpers ----------
function hydrateLead(l) {
  var notes = readAll('notes').filter(function (n) { return n.leadId === l.id; })
    .map(function (n) { return { id: n.id, author: n.author, text: n.text, createdAt: n.createdAt }; });
  var timeline = readAll('timeline').filter(function (t) { return t.leadId === l.id; });
  return {
    id: l.id, clientId: l.clientId, clientName: l.clientName,
    phone: l.phone, email: l.email, company: l.company,
    country: l.country, city: l.city,
    mapsLink: l.mapsLink, instagram: l.instagram, facebook: l.facebook,
    status: l.status, priority: l.priority,
    assignedAgentId: l.assignedAgentId || null,
    dateAdded: l.dateAdded, nextFollowUp: l.nextFollowUp || null,
    followUpNote: l.followUpNote, source: l.source,
    notes: notes, timeline: timeline,
  };
}

function computeStats(leads, agents) {
  var todayKey = new Date().toISOString().slice(0, 10);
  var monthKey = new Date().toISOString().slice(0, 7);
  var won = leads.filter(function (l) { return l.status === 'Won'; }).length;
  var conclusive = leads.filter(function (l) { return l.status === 'Won' || l.status === 'Lost'; }).length;
  return {
    total: leads.length,
    new: leads.filter(function (l) { return l.status === 'New'; }).length,
    contacted: leads.filter(function (l) { return l.status === 'Contacted'; }).length,
    followUp: leads.filter(function (l) { return l.status === 'Follow Up'; }).length,
    won: won,
    lost: leads.filter(function (l) { return l.status === 'Lost'; }).length,
    today: leads.filter(function (l) { return String(l.dateAdded).slice(0, 10) === todayKey; }).length,
    monthly: leads.filter(function (l) { return String(l.dateAdded).slice(0, 7) === monthKey; }).length,
    activeAgents: agents.filter(function (a) { return a.status === 'Active'; }).length,
    disabledAgents: agents.filter(function (a) { return a.status === 'Disabled'; }).length,
    conversionRate: conclusive ? Math.round((won / conclusive) * 1000) / 10 : 0,
  };
}

function loadSettings() {
  var rows = sheet('settings').getDataRange().getValues();
  var out = {
    companyName: 'Nexora', companyEmail: 'hello@nexora.com',
    appsScriptUrl: '', spreadsheetId: SPREADSHEET_ID || '',
    distributionMode: 'manual', notificationsEnabled: true,
  };
  for (var i = 1; i < rows.length; i++) {
    var k = rows[i][0], v = rows[i][1];
    if (!k) continue;
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    out[k] = v;
  }
  return out;
}
