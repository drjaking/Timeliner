/**
 * Standalone Vercel Serverless API Handler for Timeliner (/api/*)
 * Zero external dependencies. Guaranteed never to throw MODULE_NOT_FOUND.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const SEED_STATE = {
  "programmeStartYear": 2026,
  "revision": 7,
  "lastSavedAt": "14:17:23",
  "connectedClients": 0,
  "deadlines": [
    {
      "id": "acad-y1-cr1-2027-01-29",
      "title": "Clinical Report 1",
      "domain": "academic",
      "dueDate": "2027-01-29",
      "prepDurationDays": 28,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "2026 Intake (Y1) — Submission Deadline: Friday 29 January 2027"
    },
    {
      "id": "acad-y1-cr2-2027-04-16",
      "title": "Clinical Report 2",
      "domain": "academic",
      "dueDate": "2027-04-16",
      "prepDurationDays": 28,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "2026 Intake (Y1) — Submission Deadline: 10am, Friday 16 April 2027"
    },
    {
      "id": "acad-y1-exam1-2027-05-17",
      "title": "Exam Paper 1",
      "domain": "academic",
      "dueDate": "2027-05-17",
      "prepDurationDays": 21,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "2026 Intake (Y1) — Examination: Monday 17 May 2027"
    },
    {
      "id": "acad-y1-exam2-2027-05-18",
      "title": "Exam Paper 2",
      "domain": "academic",
      "dueDate": "2027-05-18",
      "prepDurationDays": 21,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "2026 Intake (Y1) — Examination: Tuesday 18 May 2027"
    },
    {
      "id": "acad-y2-cr3-2027-11-12",
      "title": "Clinical Report 3",
      "domain": "academic",
      "dueDate": "2027-11-12",
      "prepDurationDays": 28,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "Year 2 (+52w from 2025 Intake: Fri 13 Nov 2026 -> Fri 12 Nov 2027)"
    },
    {
      "id": "acad-y2-exam3-2028-05-17",
      "title": "Exam Paper 3",
      "domain": "academic",
      "dueDate": "2028-05-17",
      "prepDurationDays": 21,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "Year 2 (+52w from 2025 Intake: Wed 19 May 2027 -> Wed 17 May 2028)"
    },
    {
      "id": "acad-y3-cr4-2028-10-06",
      "title": "Clinical Report 4",
      "domain": "academic",
      "dueDate": "2028-10-06",
      "prepDurationDays": 28,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "Year 3 (+104w from 2024 Intake: Fri 09 Oct 2026 -> Fri 06 Oct 2028)"
    },
    {
      "id": "res-y1-soi-2027-05-06",
      "title": "Statement of Intent",
      "domain": "research",
      "dueDate": "2027-01-31",
      "prepDurationDays": 19,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "Intake 2026"
    },
    {
      "id": "res-y1-proposal-2027-07-09",
      "title": "Research Proposal",
      "domain": "research",
      "dueDate": "2027-04-16",
      "prepDurationDays": 59,
      "postDurationDays": 0,
      "workloadCurve": "linear"
    },
    {
      "id": "res-y2-litsearch-2028-09-08",
      "title": "Literature Review Searches",
      "domain": "research",
      "dueDate": "2027-08-31",
      "prepDurationDays": 28,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "Year 2/3 transition (+52w from Intake 2025: Fri 10 Sep 2027 -> Fri 8 Sep 2028)"
    },
    {
      "id": "res-y3-litreview-2028-11-17",
      "title": "Literature Review",
      "domain": "research",
      "dueDate": "2028-03-19",
      "prepDurationDays": 139,
      "postDurationDays": 0,
      "workloadCurve": "linear",
      "notes": "Year 3 (+104w from Intake 2024: Fri 20 Nov 2026 -> Fri 17 Nov 2028)"
    },
    {
      "id": "res-y3-titleabstract-2029-03-02",
      "title": "Title and Abstract",
      "domain": "research",
      "dueDate": "2028-12-08",
      "prepDurationDays": 7,
      "postDurationDays": 0,
      "workloadCurve": "exponential",
      "notes": "Year 3 (+104w from Intake 2024: Fri 5 Mar 2027 -> Fri 2 Mar 2029)"
    },
    {
      "id": "res-y3-thesisvol1-2029-06-08",
      "title": "Thesis Submission",
      "domain": "research",
      "dueDate": "2029-04-30",
      "prepDurationDays": 105,
      "postDurationDays": 0,
      "workloadCurve": "linear"
    },
    {
      "id": "res-y3-vivas-2029-08-31",
      "title": "Vivas",
      "domain": "research",
      "dueDate": "2029-07-01",
      "prepDurationDays": 7,
      "postDurationDays": 0,
      "workloadCurve": "exponential"
    },
    {
      "id": "105dbacc-2320-4ad9-a27a-cb8330715bed",
      "title": "Project Booklet",
      "domain": "research",
      "dueDate": "2026-12-11",
      "prepDurationDays": 0,
      "postDurationDays": 11,
      "workloadCurve": "exponential"
    }
  ],
  "terms": [
    {
      "id": "ucl-y1-t1",
      "name": "Y1 Term 1 (Autumn)",
      "startDate": "2026-09-28",
      "endDate": "2026-12-11"
    },
    {
      "id": "ucl-y1-t1-rw",
      "name": "Y1 Term 1 Reading Week",
      "startDate": "2026-11-02",
      "endDate": "2026-11-06"
    },
    {
      "id": "ucl-y1-xmas",
      "name": "Y1 Winter Closure / Vacation",
      "startDate": "2026-12-12",
      "endDate": "2027-01-10"
    },
    {
      "id": "ucl-y1-t2",
      "name": "Y1 Term 2 (Spring)",
      "startDate": "2027-01-11",
      "endDate": "2027-03-24"
    },
    {
      "id": "ucl-y1-t2-rw",
      "name": "Y1 Term 2 Reading Week",
      "startDate": "2027-02-15",
      "endDate": "2027-02-19"
    },
    {
      "id": "ucl-y1-easter",
      "name": "Y1 Spring Vacation (Easter)",
      "startDate": "2027-03-25",
      "endDate": "2027-04-25"
    },
    {
      "id": "ucl-y1-t3",
      "name": "Y1 Term 3 (Summer)",
      "startDate": "2027-04-26",
      "endDate": "2027-06-11"
    },
    {
      "id": "ucl-y1-summer",
      "name": "Y1 Summer Vacation / Research Period",
      "startDate": "2027-06-12",
      "endDate": "2027-09-26"
    },
    {
      "id": "ucl-y2-t1",
      "name": "Y2 Term 1 (Autumn)",
      "startDate": "2027-09-27",
      "endDate": "2027-12-10"
    },
    {
      "id": "ucl-y2-t1-rw",
      "name": "Y2 Term 1 Reading Week",
      "startDate": "2027-11-01",
      "endDate": "2027-11-05"
    },
    {
      "id": "ucl-y2-xmas",
      "name": "Y2 Winter Closure / Vacation",
      "startDate": "2027-12-11",
      "endDate": "2028-01-09"
    },
    {
      "id": "ucl-y2-t2",
      "name": "Y2 Term 2 (Spring)",
      "startDate": "2028-01-10",
      "endDate": "2028-03-24"
    },
    {
      "id": "ucl-y2-t2-rw",
      "name": "Y2 Term 2 Reading Week",
      "startDate": "2028-02-14",
      "endDate": "2028-02-18"
    },
    {
      "id": "ucl-y2-easter",
      "name": "Y2 Spring Vacation (Easter)",
      "startDate": "2028-03-25",
      "endDate": "2028-04-23"
    },
    {
      "id": "ucl-y2-t3",
      "name": "Y2 Term 3 (Summer)",
      "startDate": "2028-04-24",
      "endDate": "2028-06-09"
    },
    {
      "id": "ucl-y2-summer",
      "name": "Y2 Summer Vacation / Research Period",
      "startDate": "2028-06-10",
      "endDate": "2028-09-24"
    },
    {
      "id": "ucl-y3-t1",
      "name": "Y3 Term 1 (Autumn)",
      "startDate": "2028-09-25",
      "endDate": "2028-12-08"
    },
    {
      "id": "ucl-y3-t1-rw",
      "name": "Y3 Term 1 Reading Week",
      "startDate": "2028-10-30",
      "endDate": "2028-11-03"
    },
    {
      "id": "ucl-y3-xmas",
      "name": "Y3 Winter Closure / Vacation",
      "startDate": "2028-12-09",
      "endDate": "2029-01-07"
    },
    {
      "id": "ucl-y3-t2",
      "name": "Y3 Term 2 (Spring)",
      "startDate": "2029-01-08",
      "endDate": "2029-03-23"
    },
    {
      "id": "ucl-y3-t2-rw",
      "name": "Y3 Term 2 Reading Week",
      "startDate": "2029-02-12",
      "endDate": "2029-02-16"
    },
    {
      "id": "ucl-y3-easter",
      "name": "Y3 Spring Vacation (Easter)",
      "startDate": "2029-03-24",
      "endDate": "2029-04-22"
    },
    {
      "id": "ucl-y3-t3",
      "name": "Y3 Term 3 (Summer)",
      "startDate": "2029-04-23",
      "endDate": "2029-06-08"
    },
    {
      "id": "ucl-y3-summer",
      "name": "Y3 Summer / Viva Voce Window",
      "startDate": "2029-06-09",
      "endDate": "2029-08-31"
    }
  ],
  "clinicalPlacements": [
    {
      "id": "clin-pl-y1-p1",
      "name": "Placement 1 (Y1)",
      "startDate": "2026-10-28",
      "endDate": "2027-04-09",
      "startLoadDays": 14,
      "endLoadDays": 14,
      "workloadCurve": "exponential",
      "notes": "2026 Intake — Wed 28 Oct 2026 to Fri 09 Apr 2027 (Immovable)"
    },
    {
      "id": "clin-pl-y1-p2",
      "name": "Placement 2 (Y1)",
      "startDate": "2027-04-12",
      "endDate": "2027-10-01",
      "startLoadDays": 19,
      "endLoadDays": 14,
      "workloadCurve": "linear",
      "notes": "2026 Intake — Mon 12 Apr 2027 to Fri 01 Oct 2027 (Immovable)"
    },
    {
      "id": "clin-pl-y2-p3",
      "name": "Placement 3 (Y2)",
      "startDate": "2027-10-04",
      "endDate": "2028-03-31",
      "startLoadDays": 14,
      "endLoadDays": 14,
      "workloadCurve": "exponential",
      "notes": "Year 2 (+52w from 2025 Intake: Mon 05 Oct 2026 - Fri 02 Apr 2027) (Immovable)"
    },
    {
      "id": "clin-pl-y2-p4",
      "name": "Placement 4 (Y2)",
      "startDate": "2028-04-03",
      "endDate": "2028-09-29",
      "startLoadDays": 14,
      "endLoadDays": 14,
      "workloadCurve": "exponential",
      "notes": "Year 2 (+52w from 2025 Intake: Mon 05 Apr 2027 - Fri 01 Oct 2027) (Immovable)"
    },
    {
      "id": "clin-pl-y3-p5",
      "name": "Placement 5 (Y3)",
      "startDate": "2028-10-02",
      "endDate": "2029-03-23",
      "startLoadDays": 14,
      "endLoadDays": 14,
      "workloadCurve": "exponential",
      "notes": "Year 3 (+104w from 2024 Intake: Mon 05 Oct 2026 - Fri 26 Mar 2027) (Immovable)"
    },
    {
      "id": "clin-pl-y3-p6",
      "name": "Placement 6 (Y3)",
      "startDate": "2029-03-26",
      "endDate": "2029-09-17",
      "startLoadDays": 14,
      "endLoadDays": 14,
      "workloadCurve": "exponential",
      "notes": "Year 3 (+104w from 2024 Intake: Mon 29 Mar 2027 - Mon 20 Sep 2027) (Immovable)"
    }
  ]
};

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
  const clone = JSON.parse(JSON.stringify(SEED_STATE));
  clone.storageMode = getStorageMode();
  return clone;
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
    const refUrl = `https://api.github.com/repos/${GITHUB_REPO}/git/ref/heads/${encodeURIComponent(GITHUB_BRANCH)}?_t=${Date.now()}`;
    const refRes = await fetch(refUrl, { headers, signal: AbortSignal.timeout(4000) });
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

    const contentUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${encodeURIComponent(targetRef)}`;
    const res = await fetch(contentUrl, { headers, signal: AbortSignal.timeout(4000) });
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
          { headers, signal: AbortSignal.timeout(4000) }
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
          { headers, signal: AbortSignal.timeout(4000) }
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
        signal: AbortSignal.timeout(4000),
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

  let pathname = parsedUrl.pathname;
  if (rewrittenSubpath && rewrittenSubpath !== 'index' && rewrittenSubpath !== 'index.js') {
    pathname = '/api/' + rewrittenSubpath.replace(/^\/+/, '');
  } else if (!pathname.startsWith('/api/')) {
    pathname = '/api/' + pathname.replace(/^\/+/, '');
  }

  try {
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

    if (req.method === 'GET' && pathname === '/api/state') {
      const stateObj = await getCurrentState();
      sendJson(res, 200, stateObj);
      return;
    }

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
