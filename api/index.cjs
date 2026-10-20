/**
 * Vercel Serverless API Handler for Timeliner (/api/*)
 *
 * Implements the exact same REST & SSE contract as server.cjs:
 *   - GET    /api/state
 *   - PUT    /api/state
 *   - POST   /api/deadlines
 *   - DELETE /api/deadlines/:id
 *   - POST   /api/terms
 *   - DELETE /api/terms/:id
 *   - POST   /api/placements
 *   - PUT    /api/settings
 *   - POST   /api/reset
 *   - GET    /api/events
 *
 * Cloud Persistence Strategy (100% Free):
 *   1. Reads and writes `data/state.json` on the dedicated `timeliner-state` branch
 *      in `drjaking/Timeliner` via the GitHub API when `GITHUB_TOKEN` is set in
 *      Vercel Environment Variables. Writing to `timeliner-state` avoids triggering
 *      Vercel production rebuilds on `main`.
 *   2. Caches active state in `/tmp/timeliner-vercel-state.json` and automatically
 *      retries on HTTP 409 SHA conflicts across concurrent serverless instances.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const SeedData = require('../src/seedData.js');

const BUNDLED_STATE_PATH = path.join(__dirname, '..', 'data', 'state.json');
const TMP_STATE_PATH = path.join(os.tmpdir(), 'timeliner-vercel-state.json');

const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const GITHUB_REPO = (process.env.GITHUB_REPO || 'drjaking/Timeliner').trim();
const GITHUB_BRANCH = (process.env.GITHUB_BRANCH || 'timeliner-state').trim();
const GITHUB_FILE_PATH = 'data/state.json';

let memoryState = null;
let githubFileSha = null;

function getIsoTimeStr() {
  return new Date().toTimeString().slice(0, 8);
}

function getStorageMode() {
  return GITHUB_TOKEN ? 'github-cloud' : 'vercel-ephemeral';
}

function buildDefaultSeedState() {
  return {
    programmeStartYear: 2026,
    revision: 1,
    lastSavedAt: getIsoTimeStr(),
    storageMode: getStorageMode(),
    deadlines: (SeedData.INITIAL_DEADLINES || []).map(function (d) {
      return {
        id: d.id,
        title: d.title,
        domain: d.domain,
        dueDate: d.dueDate,
        prepDurationDays: Number(d.prepDurationDays ?? 14),
        postDurationDays: Number(d.postDurationDays ?? 0),
        workloadCurve: d.workloadCurve === 'linear' ? 'linear' : 'exponential',
        notes: d.notes || undefined,
      };
    }),
    terms: (SeedData.INITIAL_UCL_TERMS || []).slice(),
    clinicalPlacements: (SeedData.INITIAL_CLINICAL_PLACEMENTS || []).map(function (p) {
      return {
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        startLoadDays: Number(p.startLoadDays ?? 14),
        endLoadDays: Number(p.endLoadDays ?? 14),
        workloadCurve: p.workloadCurve === 'linear' ? 'linear' : 'exponential',
        notes: p.notes || '',
      };
    }),
  };
}

function loadLocalBundledOrTmpState() {
  try {
    if (fs.existsSync(TMP_STATE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(TMP_STATE_PATH, 'utf8'));
      parsed.storageMode = getStorageMode();
      return parsed;
    }
  } catch (_e) {}

  try {
    if (fs.existsSync(BUNDLED_STATE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(BUNDLED_STATE_PATH, 'utf8'));
      parsed.storageMode = getStorageMode();
      return parsed;
    }
  } catch (_e) {}

  return buildDefaultSeedState();
}

function saveTmpState(stateObj) {
  stateObj.storageMode = getStorageMode();
  memoryState = stateObj;
  try {
    fs.writeFileSync(TMP_STATE_PATH, JSON.stringify(stateObj, null, 2), 'utf8');
  } catch (_e) {}
}

async function fetchStateFromGitHub() {
  if (!GITHUB_TOKEN) return null;

  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${encodeURIComponent(GITHUB_BRANCH)}&_t=${Date.now()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'If-None-Match': `"${Date.now()}-${Math.random()}"`,
        'User-Agent': 'Timeliner-Vercel-Serverless',
      },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload && payload.content) {
      githubFileSha = payload.sha || githubFileSha;
      const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      parsed.storageMode = getStorageMode();
      saveTmpState(parsed);
      return parsed;
    }
  } catch (_e) {}
  return null;
}

async function persistStateToGitHub(stateObj, commitLabel) {
  saveTmpState(stateObj);
  if (!GITHUB_TOKEN) return;

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
    'User-Agent': 'Timeliner-Vercel-Serverless',
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!githubFileSha || attempt > 0) {
        const getRes = await fetch(
          `${apiUrl}?ref=${encodeURIComponent(GITHUB_BRANCH)}&_t=${Date.now()}`,
          {
            headers: {
              ...headers,
              'If-None-Match': `"${Date.now()}-${Math.random()}"`,
            },
          }
        );
        if (getRes.ok) {
          const existing = await getRes.json();
          githubFileSha = existing.sha;
        }
      }

      const contentBase64 = Buffer.from(
        JSON.stringify(stateObj, null, 2),
        'utf8'
      ).toString('base64');

      const putBody = {
        message: `[skip ci] Update schedule state (${commitLabel || 'rev ' + stateObj.revision})`,
        content: contentBase64,
        branch: GITHUB_BRANCH,
      };
      if (githubFileSha) {
        putBody.sha = githubFileSha;
      }

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(putBody),
      });

      if (putRes.ok) {
        const result = await putRes.json();
        if (result && result.content && result.content.sha) {
          githubFileSha = result.content.sha;
        }
        return;
      }

      if (putRes.status === 409 || putRes.status === 422) {
        githubFileSha = null;
        continue;
      }
      return;
    } catch (_e) {
      githubFileSha = null;
    }
  }
}

async function getCurrentState() {
  const ghState = await fetchStateFromGitHub();
  if (ghState) return ghState;
  if (!memoryState) {
    memoryState = loadLocalBundledOrTmpState();
  }
  memoryState.storageMode = getStorageMode();
  return memoryState;
}

function bumpStateMetadata(stateObj) {
  const nextRev = (Number(stateObj.revision) || 1) + 1;
  const savedAt = getIsoTimeStr();
  stateObj.revision = nextRev;
  stateObj.lastSavedAt = savedAt;
  stateObj.storageMode = getStorageMode();
  return { revision: nextRev, lastSavedAt: savedAt, storageMode: stateObj.storageMode };
}

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    if (typeof req.body === 'string' && req.body.trim()) {
      try {
        resolve(JSON.parse(req.body));
        return;
      } catch (e) {
        reject(e);
        return;
      }
    }
    const chunks = [];
    req.on('data', function (chunk) {
      chunks.push(chunk);
    });
    req.on('end', function () {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
  });
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. SSE Endpoint (/api/events)
  if (req.method === 'GET' && pathname === '/api/events') {
    const stateObj = await getCurrentState();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'close',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(
      `retry: 3000\ndata: ${JSON.stringify({
        type: 'connected',
        connectedClients: 1,
        revision: stateObj.revision,
        lastSavedAt: stateObj.lastSavedAt,
        storageMode: stateObj.storageMode,
      })}\n\n`
    );
    res.end();
    return;
  }

  // 2. GET /api/state
  if (req.method === 'GET' && pathname === '/api/state') {
    const stateObj = await getCurrentState();
    sendJson(res, 200, stateObj);
    return;
  }

  // 3. PUT /api/state
  if (req.method === 'PUT' && pathname === '/api/state') {
    const body = await readJsonBody(req);
    const stateObj = await getCurrentState();

    if (typeof body.programmeStartYear === 'number') {
      stateObj.programmeStartYear = Math.round(body.programmeStartYear);
    }
    if (Array.isArray(body.deadlines)) {
      stateObj.deadlines = body.deadlines.map(function (d) {
        return {
          id: String(d.id),
          title: String(d.title || 'Untitled'),
          domain: String(d.domain || 'academic'),
          dueDate: String(d.dueDate || '2026-09-01'),
          prepDurationDays: Math.max(0, Math.round(Number(d.prepDurationDays ?? 14))),
          postDurationDays: Math.max(0, Math.round(Number(d.postDurationDays ?? 0))),
          workloadCurve: d.workloadCurve === 'linear' ? 'linear' : 'exponential',
          notes: d.notes ? String(d.notes) : undefined,
        };
      });
    }
    if (Array.isArray(body.terms)) {
      stateObj.terms = body.terms.map(function (t) {
        return {
          id: String(t.id),
          name: String(t.name || 'Term'),
          startDate: String(t.startDate),
          endDate: String(t.endDate),
        };
      });
    }
    if (Array.isArray(body.clinicalPlacements)) {
      stateObj.clinicalPlacements = body.clinicalPlacements.map(function (p) {
        return {
          id: String(p.id),
          name: String(p.name || 'Placement'),
          startDate: String(p.startDate),
          endDate: String(p.endDate),
          startLoadDays: Math.max(0, Math.round(Number(p.startLoadDays ?? 14))),
          endLoadDays: Math.max(0, Math.round(Number(p.endLoadDays ?? 14))),
          workloadCurve: p.workloadCurve === 'linear' ? 'linear' : 'exponential',
          notes: p.notes ? String(p.notes) : '',
        };
      });
    }

    bumpStateMetadata(stateObj);
    await persistStateToGitHub(stateObj, 'full-state-sync');
    sendJson(res, 200, stateObj);
    return;
  }

  // 4. POST /api/deadlines
  if (req.method === 'POST' && pathname === '/api/deadlines') {
    const d = await readJsonBody(req);
    if (!d || !d.id) {
      sendJson(res, 400, { error: 'Invalid deadline payload' });
      return;
    }
    const stateObj = await getCurrentState();
    const record = {
      id: String(d.id),
      title: String(d.title || 'Untitled'),
      domain: String(d.domain || 'academic'),
      dueDate: String(d.dueDate || '2026-09-01'),
      prepDurationDays: Math.max(0, Math.round(Number(d.prepDurationDays ?? 14))),
      postDurationDays: Math.max(0, Math.round(Number(d.postDurationDays ?? 0))),
      workloadCurve: d.workloadCurve === 'linear' ? 'linear' : 'exponential',
      notes: d.notes ? String(d.notes) : undefined,
    };
    const idx = stateObj.deadlines.findIndex(function (item) {
      return item.id === record.id;
    });
    if (idx >= 0) {
      stateObj.deadlines[idx] = record;
    } else {
      stateObj.deadlines.push(record);
    }
    const meta = bumpStateMetadata(stateObj);
    await persistStateToGitHub(stateObj, `upsert-deadline ${record.title}`);
    sendJson(res, 200, { ok: true, ...meta });
    return;
  }

  // 5. DELETE /api/deadlines/:id
  if (req.method === 'DELETE' && pathname.startsWith('/api/deadlines/')) {
    const id = decodeURIComponent(pathname.slice('/api/deadlines/'.length));
    const stateObj = await getCurrentState();
    stateObj.deadlines = stateObj.deadlines.filter(function (d) {
      return d.id !== id;
    });
    const meta = bumpStateMetadata(stateObj);
    await persistStateToGitHub(stateObj, `delete-deadline ${id}`);
    sendJson(res, 200, { ok: true, ...meta });
    return;
  }

  // 6. POST /api/terms
  if (req.method === 'POST' && pathname === '/api/terms') {
    const t = await readJsonBody(req);
    if (!t || !t.id) {
      sendJson(res, 400, { error: 'Invalid term payload' });
      return;
    }
    const stateObj = await getCurrentState();
    const record = {
      id: String(t.id),
      name: String(t.name || 'Term'),
      startDate: String(t.startDate),
      endDate: String(t.endDate),
    };
    const idx = stateObj.terms.findIndex(function (item) {
      return item.id === record.id;
    });
    if (idx >= 0) {
      stateObj.terms[idx] = record;
    } else {
      stateObj.terms.push(record);
    }
    const meta = bumpStateMetadata(stateObj);
    await persistStateToGitHub(stateObj, `upsert-term ${record.name}`);
    sendJson(res, 200, { ok: true, ...meta });
    return;
  }

  // 7. DELETE /api/terms/:id
  if (req.method === 'DELETE' && pathname.startsWith('/api/terms/')) {
    const id = decodeURIComponent(pathname.slice('/api/terms/'.length));
    const stateObj = await getCurrentState();
    stateObj.terms = stateObj.terms.filter(function (t) {
      return t.id !== id;
    });
    const meta = bumpStateMetadata(stateObj);
    await persistStateToGitHub(stateObj, `delete-term ${id}`);
    sendJson(res, 200, { ok: true, ...meta });
    return;
  }

  // 8. POST /api/placements
  if (req.method === 'POST' && pathname === '/api/placements') {
    const p = await readJsonBody(req);
    if (!p || !p.id) {
      sendJson(res, 400, { error: 'Invalid placement payload' });
      return;
    }
    const stateObj = await getCurrentState();
    const record = {
      id: String(p.id),
      name: String(p.name || 'Placement'),
      startDate: String(p.startDate),
      endDate: String(p.endDate),
      startLoadDays: Math.max(0, Math.round(Number(p.startLoadDays ?? 14))),
      endLoadDays: Math.max(0, Math.round(Number(p.endLoadDays ?? 14))),
      workloadCurve: p.workloadCurve === 'linear' ? 'linear' : 'exponential',
      notes: p.notes ? String(p.notes) : '',
    };
    const idx = stateObj.clinicalPlacements.findIndex(function (item) {
      return item.id === record.id;
    });
    if (idx >= 0) {
      stateObj.clinicalPlacements[idx] = record;
    } else {
      stateObj.clinicalPlacements.push(record);
    }
    const meta = bumpStateMetadata(stateObj);
    await persistStateToGitHub(stateObj, `upsert-placement ${record.name}`);
    sendJson(res, 200, { ok: true, ...meta });
    return;
  }

  // 9. PUT /api/settings
  if (req.method === 'PUT' && pathname === '/api/settings') {
    const body = await readJsonBody(req);
    const stateObj = await getCurrentState();
    if (typeof body.programmeStartYear === 'number') {
      stateObj.programmeStartYear = Math.round(body.programmeStartYear);
    }
    const meta = bumpStateMetadata(stateObj);
    await persistStateToGitHub(stateObj, 'update-settings');
    sendJson(res, 200, { ok: true, ...meta });
    return;
  }

  // 10. POST /api/reset
  if (req.method === 'POST' && pathname === '/api/reset') {
    const resetState = buildDefaultSeedState();
    bumpStateMetadata(resetState);
    await persistStateToGitHub(resetState, 'reset-default');
    sendJson(res, 200, resetState);
    return;
  }

  sendJson(res, 404, { error: 'Unknown API endpoint: ' + pathname });
};
