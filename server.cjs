/**
 * Timeliner Lightweight LAN Web Server & SQLite Database Engine
 *
 * Zero-dependency Node.js runtime (uses built-in node:http, node:sqlite, node:fs, node:os).
 * Designed for minimal RAM (~25MB) and 0% idle CPU on a normal desktop PC.
 *
 * Run via:
 *   node --no-warnings --experimental-sqlite server.cjs
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const loadedSeed = require('./src/seedData.js');
const SeedData =
  loadedSeed && loadedSeed.INITIAL_DEADLINES
    ? loadedSeed
    : globalThis.TimelinerSeedData;

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || undefined;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'timeliner.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database in WAL mode for fast concurrent LAN reads/writes
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

function initSchemaAndSeed() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deadlines (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      prepDurationDays INTEGER NOT NULL,
      postDurationDays INTEGER NOT NULL DEFAULT 0,
      workloadCurve TEXT NOT NULL DEFAULT 'exponential',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS terms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clinical_placements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      startLoadDays INTEGER NOT NULL DEFAULT 14,
      endLoadDays INTEGER NOT NULL DEFAULT 14,
      workloadCurve TEXT NOT NULL DEFAULT 'exponential',
      notes TEXT
    );
  `);

  // Ensure existing databases created before postDurationDays / workloadCurve have the columns
  const cols = db.prepare('PRAGMA table_info(deadlines);').all();
  const hasPostCol = cols.some(function (c) {
    return c.name === 'postDurationDays';
  });
  if (!hasPostCol) {
    db.exec(
      'ALTER TABLE deadlines ADD COLUMN postDurationDays INTEGER NOT NULL DEFAULT 0;'
    );
  }
  const hasDlCurveCol = cols.some(function (c) {
    return c.name === 'workloadCurve';
  });
  if (!hasDlCurveCol) {
    db.exec(
      "ALTER TABLE deadlines ADD COLUMN workloadCurve TEXT NOT NULL DEFAULT 'exponential';"
    );
  }

  // Ensure existing databases created before placement startLoadDays / endLoadDays / workloadCurve have those columns
  const plCols = db.prepare('PRAGMA table_info(clinical_placements);').all();
  const hasStartLoadCol = plCols.some(function (c) {
    return c.name === 'startLoadDays';
  });
  if (!hasStartLoadCol) {
    db.exec(
      'ALTER TABLE clinical_placements ADD COLUMN startLoadDays INTEGER NOT NULL DEFAULT 14;'
    );
  }
  const hasEndLoadCol = plCols.some(function (c) {
    return c.name === 'endLoadDays';
  });
  if (!hasEndLoadCol) {
    db.exec(
      'ALTER TABLE clinical_placements ADD COLUMN endLoadDays INTEGER NOT NULL DEFAULT 14;'
    );
  }
  const hasPlCurveCol = plCols.some(function (c) {
    return c.name === 'workloadCurve';
  });
  if (!hasPlCurveCol) {
    db.exec(
      "ALTER TABLE clinical_placements ADD COLUMN workloadCurve TEXT NOT NULL DEFAULT 'exponential';"
    );
  }

  const seededRow = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('is_seeded');

  if (!seededRow) {
    seedDefaultDatabase();
  }
}

function getIsoTimeStr() {
  return new Date().toTimeString().slice(0, 8);
}

function seedDefaultDatabase() {
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    db.exec('DELETE FROM deadlines;');
    db.exec('DELETE FROM terms;');
    db.exec('DELETE FROM clinical_placements;');

    const insertDeadline = db.prepare(`
      INSERT INTO deadlines (id, title, domain, dueDate, prepDurationDays, postDurationDays, workloadCurve, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const d of SeedData.INITIAL_DEADLINES) {
      insertDeadline.run(
        d.id,
        d.title,
        d.domain,
        d.dueDate,
        d.prepDurationDays !== undefined ? Number(d.prepDurationDays) : 14,
        Number(d.postDurationDays) || 0,
        d.workloadCurve === 'linear' ? 'linear' : 'exponential',
        d.notes || null
      );
    }

    const insertTerm = db.prepare(`
      INSERT INTO terms (id, name, startDate, endDate)
      VALUES (?, ?, ?, ?)
    `);
    for (const t of SeedData.INITIAL_UCL_TERMS) {
      insertTerm.run(t.id, t.name, t.startDate, t.endDate);
    }

    const insertPlacement = db.prepare(`
      INSERT INTO clinical_placements (id, name, startDate, endDate, startLoadDays, endLoadDays, workloadCurve, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of SeedData.INITIAL_CLINICAL_PLACEMENTS) {
      insertPlacement.run(
        p.id,
        p.name,
        p.startDate,
        p.endDate,
        p.startLoadDays !== undefined ? Number(p.startLoadDays) : 14,
        p.endLoadDays !== undefined ? Number(p.endLoadDays) : 14,
        p.workloadCurve === 'linear' ? 'linear' : 'exponential',
        p.notes || null
      );
    }

    const upsertSetting = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    upsertSetting.run('is_seeded', 'true');
    upsertSetting.run('programmeStartYear', '2026');
    upsertSetting.run('revision', '1');
    upsertSetting.run('lastSavedAt', getIsoTimeStr());

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function bumpRevision() {
  const currentRev = Number(getSetting('revision', '1')) || 1;
  const nextRev = currentRev + 1;
  const savedAt = getIsoTimeStr();
  setSetting('revision', String(nextRev));
  setSetting('lastSavedAt', savedAt);
  return { revision: nextRev, lastSavedAt: savedAt };
}

function getFullState() {
  const programmeStartYear =
    Number(getSetting('programmeStartYear', '2026')) || 2026;
  const revision = Number(getSetting('revision', '1')) || 1;
  const lastSavedAt = getSetting('lastSavedAt', getIsoTimeStr());

  const deadlines = db
    .prepare(
      'SELECT id, title, domain, dueDate, prepDurationDays, postDurationDays, workloadCurve, notes FROM deadlines'
    )
    .all()
    .map(function (row) {
      const item = {
        id: row.id,
        title: row.title,
        domain: row.domain,
        dueDate: row.dueDate,
        prepDurationDays:
          row.prepDurationDays !== null && row.prepDurationDays !== undefined
            ? Number(row.prepDurationDays)
            : 14,
        postDurationDays: Number(row.postDurationDays) || 0,
        workloadCurve: row.workloadCurve === 'linear' ? 'linear' : 'exponential',
      };
      if (row.notes) item.notes = row.notes;
      return item;
    });

  const terms = db
    .prepare('SELECT id, name, startDate, endDate FROM terms')
    .all()
    .map(function (row) {
      return {
        id: row.id,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
      };
    });

  const clinicalPlacements = db
    .prepare(
      'SELECT id, name, startDate, endDate, startLoadDays, endLoadDays, workloadCurve, notes FROM clinical_placements'
    )
    .all()
    .map(function (row) {
      return {
        id: row.id,
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        startLoadDays:
          row.startLoadDays !== null && row.startLoadDays !== undefined
            ? Number(row.startLoadDays)
            : 14,
        endLoadDays:
          row.endLoadDays !== null && row.endLoadDays !== undefined
            ? Number(row.endLoadDays)
            : 14,
        workloadCurve: row.workloadCurve === 'linear' ? 'linear' : 'exponential',
        notes: row.notes || undefined,
      };
    });

  return {
    programmeStartYear: programmeStartYear,
    revision: revision,
    lastSavedAt: lastSavedAt,
    connectedClients: sseClients.size,
    deadlines: deadlines,
    terms: terms,
    clinicalPlacements: clinicalPlacements,
  };
}

// ============================================================================
// Server-Sent Events (SSE) for Real-Time LAN Synchronization
// ============================================================================

const sseClients = new Set();

function broadcastStateUpdate(originClientId, actionSummary) {
  const payload = JSON.stringify({
    type: 'state-updated',
    originClientId: originClientId || null,
    actionSummary: actionSummary || 'updated',
    state: getFullState(),
  });
  const message = `data: ${payload}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(message);
    } catch (_e) {
      sseClients.delete(res);
    }
  }
}

function broadcastPresenceUpdate() {
  const payload = JSON.stringify({
    type: 'presence',
    connectedClients: sseClients.size,
  });
  const message = `data: ${payload}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(message);
    } catch (_e) {
      sseClients.delete(res);
    }
  }
}

// Heartbeat every 30s to keep LAN connections alive without CPU load
setInterval(function () {
  for (const res of sseClients) {
    try {
      res.write(': heartbeat\n\n');
    } catch (_e) {
      sseClients.delete(res);
    }
  }
}, 30000).unref();

// ============================================================================
// HTTP Helpers & Static File Serving
// ============================================================================

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    let raw = '';
    req.on('data', function (chunk) {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', function () {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  const absPath = path.join(
    ROOT_DIR,
    safePath === '/' || safePath === '\\' ? 'index.html' : safePath
  );

  // Prevent directory traversal outside ROOT_DIR or access to database files
  if (!absPath.startsWith(ROOT_DIR) || absPath.startsWith(DATA_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(absPath, function (err, stats) {
    if (err || !stats.isFile()) {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }
    const ext = path.extname(absPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(absPath).pipe(res);
  });
}

// ============================================================================
// REST API Request Router
// ============================================================================

async function handleApiRequest(req, res, pathname) {
  const clientId = req.headers['x-client-id'] || null;

  // 1. Server-Sent Events Stream
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    sseClients.add(res);
    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        connectedClients: sseClients.size,
      })}\n\n`
    );
    broadcastPresenceUpdate();

    req.on('close', function () {
      sseClients.delete(res);
      broadcastPresenceUpdate();
    });
    return;
  }

  // 2. Get Full Shared State
  if (req.method === 'GET' && pathname === '/api/state') {
    sendJson(res, 200, getFullState());
    return;
  }

  // 3. Put Full / Partial State or Upsert Items
  if (req.method === 'PUT' && pathname === '/api/state') {
    const body = await readJsonBody(req);
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      if (typeof body.programmeStartYear === 'number') {
        setSetting('programmeStartYear', Math.round(body.programmeStartYear));
      }

      if (Array.isArray(body.deadlines)) {
        db.exec('DELETE FROM deadlines;');
        const insDl = db.prepare(`
          INSERT INTO deadlines (id, title, domain, dueDate, prepDurationDays, postDurationDays, workloadCurve, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const d of body.deadlines) {
          if (!d || !d.id || !d.title || !d.domain || !d.dueDate) continue;
          insDl.run(
            String(d.id),
            String(d.title),
            String(d.domain),
            String(d.dueDate),
            Math.max(
              0,
              Math.round(
                d.prepDurationDays !== undefined ? Number(d.prepDurationDays) : 14
              )
            ),
            Math.max(0, Math.round(Number(d.postDurationDays) || 0)),
            d.workloadCurve === 'linear' ? 'linear' : 'exponential',
            d.notes ? String(d.notes) : null
          );
        }
      }

      if (Array.isArray(body.terms)) {
        db.exec('DELETE FROM terms;');
        const insTerm = db.prepare(`
          INSERT INTO terms (id, name, startDate, endDate)
          VALUES (?, ?, ?, ?)
        `);
        for (const t of body.terms) {
          if (!t || !t.id || !t.name || !t.startDate || !t.endDate) continue;
          insTerm.run(
            String(t.id),
            String(t.name),
            String(t.startDate),
            String(t.endDate)
          );
        }
      }

      if (Array.isArray(body.clinicalPlacements)) {
        db.exec('DELETE FROM clinical_placements;');
        const insPl = db.prepare(`
          INSERT INTO clinical_placements (id, name, startDate, endDate, startLoadDays, endLoadDays, workloadCurve, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of body.clinicalPlacements) {
          if (!p || !p.id || !p.name || !p.startDate || !p.endDate) continue;
          insPl.run(
            String(p.id),
            String(p.name),
            String(p.startDate),
            String(p.endDate),
            Math.max(
              0,
              Math.round(
                p.startLoadDays !== undefined ? Number(p.startLoadDays) : 14
              )
            ),
            Math.max(
              0,
              Math.round(
                p.endLoadDays !== undefined ? Number(p.endLoadDays) : 14
              )
            ),
            p.workloadCurve === 'linear' ? 'linear' : 'exponential',
            p.notes ? String(p.notes) : null
          );
        }
      }

      bumpRevision();
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const updatedState = getFullState();
    sendJson(res, 200, updatedState);
    broadcastStateUpdate(clientId, 'state-sync');
    return;
  }

  // 4. Upsert Single Deadline (Create, Edit, Drag Reschedule, or Resize Prep/Post)
  if (req.method === 'POST' && pathname === '/api/deadlines') {
    const d = await readJsonBody(req);
    if (!d || !d.id || !d.title || !d.domain || !d.dueDate) {
      sendJson(res, 400, { error: 'Missing required deadline fields.' });
      return;
    }
    db.prepare(`
      INSERT INTO deadlines (id, title, domain, dueDate, prepDurationDays, postDurationDays, workloadCurve, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        domain = excluded.domain,
        dueDate = excluded.dueDate,
        prepDurationDays = excluded.prepDurationDays,
        postDurationDays = excluded.postDurationDays,
        workloadCurve = excluded.workloadCurve,
        notes = excluded.notes
    `).run(
      String(d.id),
      String(d.title),
      String(d.domain),
      String(d.dueDate),
      Math.max(
        0,
        Math.round(
          d.prepDurationDays !== undefined ? Number(d.prepDurationDays) : 14
        )
      ),
      Math.max(0, Math.round(Number(d.postDurationDays) || 0)),
      d.workloadCurve === 'linear' ? 'linear' : 'exponential',
      d.notes ? String(d.notes) : null
    );
    const meta = bumpRevision();
    sendJson(res, 200, { ok: true, ...meta });
    broadcastStateUpdate(clientId, 'deadline-upserted');
    return;
  }

  // 5. Delete Single Deadline
  if (req.method === 'DELETE' && pathname.startsWith('/api/deadlines/')) {
    const id = decodeURIComponent(pathname.slice('/api/deadlines/'.length));
    db.prepare('DELETE FROM deadlines WHERE id = ?').run(id);
    const meta = bumpRevision();
    sendJson(res, 200, { ok: true, ...meta });
    broadcastStateUpdate(clientId, 'deadline-deleted');
    return;
  }

  // 6. Upsert Single UCL Term Block
  if (req.method === 'POST' && pathname === '/api/terms') {
    const t = await readJsonBody(req);
    if (!t || !t.id || !t.name || !t.startDate || !t.endDate) {
      sendJson(res, 400, { error: 'Missing required term fields.' });
      return;
    }
    db.prepare(`
      INSERT INTO terms (id, name, startDate, endDate)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        startDate = excluded.startDate,
        endDate = excluded.endDate
    `).run(
      String(t.id),
      String(t.name),
      String(t.startDate),
      String(t.endDate)
    );
    const meta = bumpRevision();
    sendJson(res, 200, { ok: true, ...meta });
    broadcastStateUpdate(clientId, 'term-upserted');
    return;
  }

  // 7. Delete Single UCL Term Block
  if (req.method === 'DELETE' && pathname.startsWith('/api/terms/')) {
    const id = decodeURIComponent(pathname.slice('/api/terms/'.length));
    db.prepare('DELETE FROM terms WHERE id = ?').run(id);
    const meta = bumpRevision();
    sendJson(res, 200, { ok: true, ...meta });
    broadcastStateUpdate(clientId, 'term-deleted');
    return;
  }

  // 7b. Upsert Single Clinical Placement (Resize Start/End Workload or Edit)
  if (req.method === 'POST' && pathname === '/api/placements') {
    const p = await readJsonBody(req);
    if (!p || !p.id || !p.name || !p.startDate || !p.endDate) {
      sendJson(res, 400, { error: 'Missing required placement fields.' });
      return;
    }
    db.prepare(`
      INSERT INTO clinical_placements (id, name, startDate, endDate, startLoadDays, endLoadDays, workloadCurve, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        startDate = excluded.startDate,
        endDate = excluded.endDate,
        startLoadDays = excluded.startLoadDays,
        endLoadDays = excluded.endLoadDays,
        workloadCurve = excluded.workloadCurve,
        notes = excluded.notes
    `).run(
      String(p.id),
      String(p.name),
      String(p.startDate),
      String(p.endDate),
      Math.max(
        0,
        Math.round(
          p.startLoadDays !== undefined ? Number(p.startLoadDays) : 14
        )
      ),
      Math.max(
        0,
        Math.round(
          p.endLoadDays !== undefined ? Number(p.endLoadDays) : 14
        )
      ),
      p.workloadCurve === 'linear' ? 'linear' : 'exponential',
      p.notes ? String(p.notes) : null
    );
    const meta = bumpRevision();
    sendJson(res, 200, { ok: true, ...meta });
    broadcastStateUpdate(clientId, 'placement-upserted');
    return;
  }

  // 8. Update Programme Start Year Setting
  if (req.method === 'PUT' && pathname === '/api/settings') {
    const body = await readJsonBody(req);
    if (typeof body.programmeStartYear === 'number') {
      setSetting('programmeStartYear', Math.round(body.programmeStartYear));
    }
    const meta = bumpRevision();
    sendJson(res, 200, { ok: true, ...meta });
    broadcastStateUpdate(clientId, 'settings-updated');
    return;
  }

  // 9. Reset Database to Default Seeded Schedule
  if (req.method === 'POST' && pathname === '/api/reset') {
    seedDefaultDatabase();
    const updatedState = getFullState();
    sendJson(res, 200, updatedState);
    broadcastStateUpdate(clientId, 'reset-default');
    return;
  }

  sendJson(res, 404, { error: 'Unknown API endpoint' });
}

// ============================================================================
// Server Bootstrap & LAN Discovery Banner
// ============================================================================

initSchemaAndSeed();

const server = http.createServer(async function (req, res) {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, pathname);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStaticFile(pathname, res);
      return;
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[Server Error]', err);
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: err && err.message ? err.message : 'Internal Server Error',
      });
    }
  }
});

function getLanIpv4Addresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, address: net.address });
      }
    }
  }
  return addresses;
}

function onServerListening() {
  const lanAddresses = getLanIpv4Addresses();
  console.log('======================================================================');
  console.log(' UCL LONGITUDINAL PROGRAMME SEQUENCER — LAN SERVER & SQLITE DB');
  console.log('======================================================================');
  console.log(` Database File : ${DB_PATH}`);
  console.log(` Local URL     : http://localhost:${PORT}`);
  if (lanAddresses.length > 0) {
    for (const item of lanAddresses) {
      console.log(` LAN URL       : http://${item.address}:${PORT}  (${item.interface})`);
    }
  } else {
    console.log(` LAN Binding   : http://0.0.0.0:${PORT}`);
  }
  console.log('----------------------------------------------------------------------');
  console.log(' Zero-dependency Node.js + SQLite (WAL mode) + Real-Time SSE active.');
  console.log(' Keep this window open while sharing on the LAN. Press Ctrl+C to stop.');
  console.log('======================================================================');
}

if (HOST) {
  server.listen(PORT, HOST, onServerListening);
} else {
  server.listen(PORT, onServerListening);
}
