/**
 * Vercel Serverless API Handler for Timeliner (/api/*)
 *
 * Implements the REST & SSE contract:
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
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const SeedData = require('../src/seedData.js');

let BUNDLED_STATE = null;
try {
  BUNDLED_STATE = require('../data/state.json');
} catch (_e) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'state.json'), 'utf8');
    BUNDLED_STATE = JSON.parse(raw);
  } catch (_e2) {}
}

const TMP_STATE_PATH = path.join(os.tmpdir(), 'timeliner-vercel-state.json');

const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
const GITHUB_REPO = (process.env.GITHUB_REPO || 'drjaking/Timeliner').trim();
const GITHUB_BRANCH = (process.env.GITHUB_BRANCH || 'timeliner-state').trim();
const GITHUB_FILE_PATH = 'data/state.json';

let memoryState = null;
let githubFileSha = null;
let lastLoadedCommitSha = null;
let lastSyncDiagnostic = null;

function getIsoTimeStr() {
  return new Date().toTimeString().slice(0, 8);
}

function getStorageMode() {
  return GITHUB_TOKEN ? 'github-cloud' : 'vercel-ephemeral';
}

function buildDefaultSeedState() {
  if (BUNDLED_STATE && Array.isArray(BUNDLED_STATE.deadlines)) {
    const clone = JSON.parse(JSON.stringify(BUNDLED_STATE));
    clone.storageMode = getStorageMode();
    return clone;
  }
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

  return buildDefaultSeedState();
}

function saveTmpState(stateObj) {
  stateObj.storageMode = getStorageMode();
  if (lastSyncDiagnostic) {
    stateObj.syncDiagnostic = lastSyncDiagnostic;
  }
  memoryState = stateObj;
  try {
    fs.writeFileSync(TMP_STATE_PATH, JSON.stringify(stateObj, null, 2), 'utf8');
  } catch (_e) {}
}

/**
 * Fetches state from GitHub with strict cache-busting.
 * Guarantees monotonic revision progression: if remote has an older revision than
 * what this serverless instance already holds, the local higher revision is retained.
 */
async function fetchStateFromGitHub() {
  if (!GITHUB_TOKEN) {
    lastSyncDiagnostic = { status: 'no-token', message: 'GITHUB_TOKEN environment variable not set' };
    return null;
  }

  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Cache-Control': 'no-cache, no-store, max-age=0',
    'User-Agent': 'Timeliner-Vercel-Serverless',
  };

  try {
    // 1. Get exact branch HEAD commit SHA
    const refUrl = `https://api.github.com/repos/${GITHUB_REPO}/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}?_t=${Date.now()}`;
    const refRes = await fetch(refUrl, { headers });
    let targetRef = GITHUB_BRANCH;

    if (refRes.ok) {
      const refData = await refRes.json();
      const commitSha = refData && refData.object && refData.object.sha;
      if (commitSha) {
        if (memoryState && lastLoadedCommitSha === commitSha) {
          memoryState.storageMode = getStorageMode();
          return memoryState;
        }
        targetRef = commitSha;
      }
    } else {
      const errText = await refRes.text().catch(() => '');
      console.error(`[GitHub Ref Error] ${refRes.status}: ${errText}`);
      lastSyncDiagnostic = { status: 'ref-error', code: refRes.status, message: errText };
    }

    // 2. Fetch file content at exact commit SHA (bypasses branch Fastly CDN cache)
    const contentUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${encodeURIComponent(targetRef)}`;
    const res = await fetch(contentUrl, { headers });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[GitHub Contents Error] ${res.status}: ${errText}`);
      lastSyncDiagnostic = { status: 'contents-error', code: res.status, message: errText };
      return null;
    }

    const payload = await res.json();
    if (payload && payload.content) {
      githubFileSha = payload.sha || githubFileSha;
      if (targetRef !== GITHUB_BRANCH) {
        lastLoadedCommitSha = targetRef;
      }
      const decoded = Buffer.from(payload.content, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      parsed.storageMode = getStorageMode();

      // Guard: Never downgrade an already-higher local in-memory revision due to replica lag
      if (memoryState && typeof memoryState.revision === 'number' && typeof parsed.revision === 'number') {
        if (parsed.revision < memoryState.revision) {
          return memoryState;
        }
      }

      lastSyncDiagnostic = { status: 'synced', commitSha: targetRef, revision: parsed.revision };
      saveTmpState(parsed);
      return parsed;
    }
  } catch (err) {
    console.error('[fetchStateFromGitHub Exception]', err);
    lastSyncDiagnostic = { status: 'exception', message: err.message };
  }
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
        const refRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}?_t=${Date.now()}`,
          { headers }
        );
        let refParam = GITHUB_BRANCH;
        if (refRes.ok) {
          const refData = await refRes.json();
          if (refData && refData.object && refData.object.sha) {
            refParam = refData.object.sha;
          }
        }
        const getRes = await fetch(
          `${apiUrl}?ref=${encodeURIComponent(refParam)}`,
          { headers }
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
        if (result && result.commit && result.commit.sha) {
          lastLoadedCommitSha = result.commit.sha;
        }
        lastSyncDiagnostic = { status: 'persisted', revision: stateObj.revision };
        return;
      }

      const errText = await putRes.text().catch(() => '');
      console.error(`[persistStateToGitHub Attempt ${attempt + 1}] Status ${putRes.status}: ${errText}`);
      lastSyncDiagnostic = { status: 'persist-error', code: putRes.status, message: errText };

      if (putRes.status === 409 || putRes.status === 422) {
        githubFileSha = null;
        continue;
      }
      return;
    } catch (err) {
      console.error('[persistStateToGitHub Exception]', err);
      lastSyncDiagnostic = { status: 'persist-exception', message: err.message };
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
  if (lastSyncDiagnostic) {
    memoryState.syncDiagnostic = lastSyncDiagnostic;
  }
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
  const rewrittenSubpath = parsedUrl.searchParams.get('__path');

  // Robust path resolution handling both direct hits and rewrite redirects
  let pathname = parsedUrl.pathname;
  if (rewrittenSubpath && rewrittenSubpath !== 'index' && rewrittenSubpath !== 'index.js') {
    pathname = '/api/' + rewrittenSubpath.replace(/^\/+/, '');
  } else if (!pathname.startsWith('/api/')) {
    pathname = '/api/' + pathname.replace(/^\/+/, '');
  }

  try {
    // 1. SSE Endpoint (/api/events)
    if (req.method === 'GET' && pathname === '/api/events') {
      const stateObj = await getCurrentState();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
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
  } catch (err) {
    console.error(`[Unhandled API Error in ${pathname}]`, err);
    sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
};
