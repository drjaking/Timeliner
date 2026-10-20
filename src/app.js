/**
 * Longitudinal Academic, Clinical & Research Course Planning Application
 * Pure reactive controller with pointer-event drag-and-drop, prep duration resizing,
 * cross-column weekly load heat-strip, right-hand 3-year compressed macro workload heatmap,
 * and JSON/CSV bulk ingestion.
 */
(function (global) {
  const DateMath = global.TimelinerDateMath;
  const SchemaParser = global.TimelinerSchemaParser;
  const SeedData = global.TimelinerSeedData;

  const STORAGE_KEY = 'ucl_longitudinal_programme_sequencer_v1';
  const MIGRATED_TO_SERVER_KEY = 'ucl_timeliner_migrated_to_sqlite_v1';
  const CLIENT_ID = SchemaParser.generateId('client');

  const INITIAL_DEADLINES = SeedData.INITIAL_DEADLINES;
  const INITIAL_UCL_TERMS = SeedData.INITIAL_UCL_TERMS;
  const INITIAL_CLINICAL_PLACEMENTS = SeedData.INITIAL_CLINICAL_PLACEMENTS;

  const state = {
    programmeStartYear: 2026,
    pxPerDay: 4.5,
    snapIncrementDays: 1, // 1 = Daily, 7 = Weekly
    gradientCurve: 'exponential', // 'linear' | 'exponential'
    splitOverlappingLanes: true,

    // Resizable column widths in pixels (null = flexible minmax(195px, 1fr))
    columnWidths: {
      academic: null,
      clinical: null,
      research: null,
      terms: null,
    },
    colResizeOp: null,

    deadlines: INITIAL_DEADLINES.slice(),
    terms: INITIAL_UCL_TERMS.slice(),
    clinicalPlacements: INITIAL_CLINICAL_PLACEMENTS.slice(),

    // UI Drawers & Modals
    isAddDrawerOpen: false,
    isBulkModalOpen: false,
    bulkModalMode: 'append', // 'append' | 'replace'
    bulkTextValue: '',
    bulkFeedback: null,

    // Add Deadline Form Inputs
    formDeadlineTitle: '',
    formDeadlineDomain: 'academic',
    formDeadlineDueDate: '2026-11-16',
    formDeadlinePrepValue: 21,
    formDeadlinePrepUnit: 'days', // 'days' | 'weeks'
    formDeadlinePostValue: 0,
    formDeadlinePostUnit: 'days', // 'days' | 'weeks'
    formDeadlineCurve: 'exponential', // 'exponential' | 'linear'
    formDeadlineNotes: '',

    // Add Term Form Inputs
    formTermName: '',
    formTermStartDate: '2026-09-28',
    formTermEndDate: '2026-12-11',

    // Edit Modal State
    editingDeadlineId: null,
    editingTermId: null,
    editingPlacementId: null,

    // Active Pointer Drag Operation
    dragOp: null,

    // Persistence & LAN Server Sync tracking
    deletedSeedIds: [],
    lastSavedAt: null,
    serverConnected: false,
    serverRevision: 1,
    connectedClients: 1,
  };

  function buildGridTemplateColumnsCss() {
    const keys = ['academic', 'clinical', 'research', 'terms'];
    const tracks = keys.map(function (k) {
      const w = state.columnWidths && state.columnWidths[k];
      return typeof w === 'number' && w >= 120
        ? Math.round(w) + 'px'
        : 'minmax(195px, 1fr)';
    });
    return '196px ' + tracks.join(' ');
  }

  function buildTimelineMinWidthCss() {
    const keys = ['academic', 'clinical', 'research', 'terms'];
    let hasCustom = false;
    let totalPx = 196;
    keys.forEach(function (k) {
      const w = state.columnWidths && state.columnWidths[k];
      if (typeof w === 'number' && w >= 120) {
        hasCustom = true;
        totalPx += Math.round(w);
      } else {
        totalPx += 195;
      }
    });
    if (!hasCustom) {
      return 'min-width:980px;width:100%;';
    }
    return `min-width:${totalPx}px;width:${totalPx}px;`;
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadLocalFallbackState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        saveLocalCacheState();
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.programmeStartYear === 'number') {
        state.programmeStartYear = parsed.programmeStartYear;
      }
      if (parsed.columnWidths && typeof parsed.columnWidths === 'object') {
        ['academic', 'clinical', 'research', 'terms'].forEach(function (k) {
          const val = Number(parsed.columnWidths[k]);
          if (Number.isFinite(val) && val >= 120) {
            state.columnWidths[k] = Math.round(val);
          }
        });
      }
      if (Array.isArray(parsed.deletedSeedIds)) {
        state.deletedSeedIds = parsed.deletedSeedIds;
      }
      const deletedSet = new Set(state.deletedSeedIds);

      if (Array.isArray(parsed.deadlines)) {
        state.deadlines = parsed.deadlines.filter(function (d) {
          return d && !deletedSet.has(d.id);
        });
      }
      if (Array.isArray(parsed.terms)) {
        state.terms = parsed.terms.filter(function (t) {
          return t && !deletedSet.has(t.id);
        });
      }
      if (Array.isArray(parsed.clinicalPlacements)) {
        state.clinicalPlacements = parsed.clinicalPlacements;
      }
      if (typeof parsed.lastSavedAt === 'string') {
        state.lastSavedAt = parsed.lastSavedAt;
      }
      return parsed;
    } catch (_e) {
      return null;
    }
  }

  function saveLocalCacheState() {
    try {
      const now = new Date();
      if (!state.lastSavedAt) {
        state.lastSavedAt = now.toTimeString().slice(0, 8);
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          programmeStartYear: state.programmeStartYear,
          columnWidths: state.columnWidths,
          deadlines: state.deadlines,
          terms: state.terms,
          clinicalPlacements: state.clinicalPlacements,
          deletedSeedIds: state.deletedSeedIds,
          lastSavedAt: state.lastSavedAt,
        })
      );
    } catch (_e) {
      // Ignore quota errors
    }
  }

  function applyServerState(serverPayload) {
    if (!serverPayload || typeof serverPayload !== 'object') return;
    if (typeof serverPayload.programmeStartYear === 'number') {
      state.programmeStartYear = serverPayload.programmeStartYear;
    }
    if (Array.isArray(serverPayload.deadlines)) {
      state.deadlines = serverPayload.deadlines;
    }
    if (Array.isArray(serverPayload.terms)) {
      state.terms = serverPayload.terms;
    }
    if (Array.isArray(serverPayload.clinicalPlacements)) {
      state.clinicalPlacements = serverPayload.clinicalPlacements;
    }
    if (typeof serverPayload.revision === 'number') {
      state.serverRevision = serverPayload.revision;
    }
    if (typeof serverPayload.lastSavedAt === 'string') {
      state.lastSavedAt = serverPayload.lastSavedAt;
    }
    if (typeof serverPayload.connectedClients === 'number') {
      state.connectedClients = Math.max(1, serverPayload.connectedClients);
    }
    saveLocalCacheState();
  }

  function isUsingHttpProtocol() {
    return (
      typeof window !== 'undefined' &&
      window.location &&
      (window.location.protocol === 'http:' ||
        window.location.protocol === 'https:')
    );
  }

  let pendingWriteCount = 0;

  async function apiRequest(method, endpoint, bodyObj) {
    if (!isUsingHttpProtocol()) return null;
    const isWrite = method !== 'GET' && method !== 'HEAD';
    if (isWrite) pendingWriteCount++;
    try {
      const opts = {
        method: method,
        cache: 'no-store',
        headers: {
          'X-Client-Id': CLIENT_ID,
          'Cache-Control': 'no-cache',
        },
      };
      if (bodyObj !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(bodyObj);
      }
      const res = await fetch(endpoint, opts);
      if (!res.ok) return null;
      const data = await res.json();
      state.serverConnected = true;
      if (data && typeof data.storageMode === 'string') {
        state.storageMode = data.storageMode;
      }
      if (isWrite) {
        if (data && typeof data.lastSavedAt === 'string') {
          state.lastSavedAt = data.lastSavedAt;
        }
        if (data && typeof data.revision === 'number') {
          state.serverRevision = data.revision;
        }
      }
      return data;
    } catch (_err) {
      state.serverConnected = false;
      return null;
    } finally {
      if (isWrite) pendingWriteCount = Math.max(0, pendingWriteCount - 1);
    }
  }

  function savePersistedState() {
    const now = new Date();
    state.lastSavedAt = now.toTimeString().slice(0, 8);
    saveLocalCacheState();
    if (state.serverConnected) {
      apiRequest('PUT', '/api/state', {
        programmeStartYear: state.programmeStartYear,
        deadlines: state.deadlines,
        terms: state.terms,
        clinicalPlacements: state.clinicalPlacements,
      }).then(function (res) {
        if (res) renderApp();
      });
    }
  }

  function syncSingleDeadlineToServer(deadlineItem) {
    const now = new Date();
    state.lastSavedAt = now.toTimeString().slice(0, 8);
    saveLocalCacheState();
    if (state.serverConnected && deadlineItem) {
      apiRequest('POST', '/api/deadlines', deadlineItem);
    }
  }

  function syncDeleteDeadlineToServer(deadlineId) {
    const now = new Date();
    state.lastSavedAt = now.toTimeString().slice(0, 8);
    saveLocalCacheState();
    if (state.serverConnected && deadlineId) {
      apiRequest(
        'DELETE',
        '/api/deadlines/' + encodeURIComponent(deadlineId)
      );
    }
  }

  function syncSingleTermToServer(termItem) {
    const now = new Date();
    state.lastSavedAt = now.toTimeString().slice(0, 8);
    saveLocalCacheState();
    if (state.serverConnected && termItem) {
      apiRequest('POST', '/api/terms', termItem);
    }
  }

  function syncDeleteTermToServer(termId) {
    const now = new Date();
    state.lastSavedAt = now.toTimeString().slice(0, 8);
    saveLocalCacheState();
    if (state.serverConnected && termId) {
      apiRequest('DELETE', '/api/terms/' + encodeURIComponent(termId));
    }
  }

  function syncSinglePlacementToServer(placementItem) {
    const now = new Date();
    state.lastSavedAt = now.toTimeString().slice(0, 8);
    saveLocalCacheState();
    if (state.serverConnected && placementItem) {
      apiRequest('POST', '/api/placements', placementItem);
    }
  }

  function syncSettingsToServer() {
    const now = new Date();
    state.lastSavedAt = now.toTimeString().slice(0, 8);
    saveLocalCacheState();
    if (state.serverConnected) {
      apiRequest('PUT', '/api/settings', {
        programmeStartYear: state.programmeStartYear,
      });
    }
  }

  async function initPersistenceAndLanSync() {
    const localData = loadLocalFallbackState();

    if (!isUsingHttpProtocol()) {
      return;
    }

    const serverState = await apiRequest('GET', '/api/state');
    if (!serverState) {
      return;
    }

    state.serverConnected = true;

    // If the SQLite server is still at revision 1 (freshly initialized) and this browser
    // has local edits in localStorage that haven't been migrated yet, migrate them up once.
    const alreadyMigrated = localStorage.getItem(MIGRATED_TO_SERVER_KEY);
    if (
      serverState.revision === 1 &&
      !alreadyMigrated &&
      localData &&
      Array.isArray(localData.deadlines) &&
      localData.deadlines.length > 0
    ) {
      localStorage.setItem(MIGRATED_TO_SERVER_KEY, 'true');
      const migrated = await apiRequest('PUT', '/api/state', {
        programmeStartYear: state.programmeStartYear,
        deadlines: state.deadlines,
        terms: state.terms,
        clinicalPlacements: state.clinicalPlacements,
      });
      if (migrated) {
        applyServerState(migrated);
      }
    } else {
      localStorage.setItem(MIGRATED_TO_SERVER_KEY, 'true');
      applyServerState(serverState);
    }

    renderApp();

    // Connect to Server-Sent Events (SSE) for instant multi-user LAN updates
    if (typeof EventSource !== 'undefined') {
      const evtSource = new EventSource('/api/events');

      evtSource.onmessage = function (event) {
        try {
          const msg = JSON.parse(event.data);
          if (!msg || typeof msg !== 'object') return;

          if (msg.type === 'connected' || msg.type === 'presence') {
            state.serverConnected = true;
            if (typeof msg.connectedClients === 'number') {
              state.connectedClients = Math.max(1, msg.connectedClients);
            }
            if (!state.dragOp) renderApp();
          } else if (msg.type === 'state-updated') {
            state.serverConnected = true;
            if (msg.originClientId === CLIENT_ID) {
              if (msg.state && typeof msg.state.lastSavedAt === 'string') {
                state.lastSavedAt = msg.state.lastSavedAt;
              }
              if (msg.state && typeof msg.state.revision === 'number') {
                state.serverRevision = msg.state.revision;
              }
              return;
            }
            if (msg.state && !state.dragOp) {
              applyServerState(msg.state);
              renderApp();
            }
          }
        } catch (_e) {
          // Ignore malformed SSE event
        }
      };

      evtSource.onerror = function () {
        // Serverless SSE streams close and auto-reconnect; verified via polling below
      };
    }

    // Background revision poll (3s) for multi-user sync across instances
    setInterval(async function () {
      if (state.dragOp || document.hidden || pendingWriteCount > 0) return;
      const prevRev = state.serverRevision || 0;
      const latest = await apiRequest('GET', '/api/state?_t=' + Date.now());
      if (!latest || state.dragOp || pendingWriteCount > 0) {
        if (!latest && state.serverConnected) {
          state.serverConnected = false;
          renderApp();
        }
        return;
      }
      const wasOffline = !state.serverConnected;
      state.serverConnected = true;
      if (
        typeof latest.revision === 'number' &&
        latest.revision !== prevRev
      ) {
        applyServerState(latest);
        renderApp();
      } else if (wasOffline) {
        renderApp();
      }
    }, 3000);
  }


  function classifyTermKind(name) {
    const lower = String(name || '').toLowerCase();
    if (lower.includes('reading')) return 'kind-reading';
    if (
      lower.includes('vacation') ||
      lower.includes('closure') ||
      lower.includes('break') ||
      lower.includes('holiday') ||
      lower.includes('easter') ||
      lower.includes('christmas') ||
      lower.includes('winter') ||
      lower.includes('summer')
    ) {
      return 'kind-vacation';
    }
    return 'kind-term';
  }

  function getHeatStripColor(slice) {
    const norm = slice && typeof slice.normalizedLoad === 'number' ? slice.normalizedLoad : 0;
    return DateMath.getRainbowHeatColor(norm, 0.18);
  }

  function getHeatBadgeStyle(slice) {
    const norm = slice && typeof slice.normalizedLoad === 'number' ? slice.normalizedLoad : 0;
    const bg = DateMath.getRainbowHeatColor(norm);
    return `background:${bg};color:#FFFFFF;text-shadow:0 1px 1px rgba(0,0,0,0.35);`;
  }

  function renderMacroHeatmapPanel(weeklySlices, yearBounds, monthBounds, totalDays) {
    let peakScore = 0;
    for (let i = 0; i < weeklySlices.length; i++) {
      const s = weeklySlices[i];
      if ((s.loadScore || 0) > peakScore) {
        peakScore = s.loadScore;
      }
    }

    const slicesHtml = weeklySlices
      .map(function (wk) {
        const topPct = (wk.startDay / totalDays) * 100;
        const heightPct = Math.max(0.35, ((wk.endDay - wk.startDay) / totalDays) * 100);
        const heatColor = DateMath.getRainbowHeatColor(wk.normalizedLoad || 0);
        const pctOfPeak = Math.round((wk.normalizedLoad || 0) * 100);

        const tooltipParts = [
          `Y${wk.programmeYear} W${wk.yearWeekNumber} (${DateMath.formatAcademicDate(
            wk.startIso,
            state.programmeStartYear,
            false
          )} to ${DateMath.formatAcademicDate(
            wk.endIso,
            state.programmeStartYear,
            false
          )})`,
          `Weekly Load: ${(wk.loadScore || 0).toFixed(2)} (${pctOfPeak}% of peak) · ${wk.totalActivePrepItems} active window(s)`,
        ];
        if (wk.activeTitles && wk.activeTitles.length > 0) {
          tooltipParts.push(
            wk.activeTitles
              .map(function (t) {
                const wVal = typeof t.sampledLoad === 'number' ? ` (${t.sampledLoad.toFixed(2)})` : '';
                return '• ' + t.title + wVal;
              })
              .join(' | ')
          );
        }

        return `
          <div
            class="macro-week-slice"
            data-start-day="${wk.startDay}"
            style="top:${topPct.toFixed(4)}%;height:calc(${heightPct.toFixed(4)}% + 0.5px);background:${heatColor};"
            title="${escapeHtml(tooltipParts.join(' — '))}"
          ></div>
        `;
      })
      .join('');

    const yearMarkersHtml = yearBounds
      .map(function (yb) {
        const topPct = (yb.startDay / totalDays) * 100;
        return `
          <div class="macro-year-divider" style="top:${topPct.toFixed(3)}%;"></div>
          <div class="macro-year-tag" style="top:calc(${topPct.toFixed(3)}% + 3px);">Y${yb.programmeYear}</div>
        `;
      })
      .join('');

    const monthTicksHtml = monthBounds
      .filter(function (mb) {
        return mb.monthIndex % 3 === 0 || mb.monthIndex === 8;
      })
      .map(function (mb) {
        const topPct = (mb.startDay / totalDays) * 100;
        return `
          <div class="macro-month-tick" style="top:${topPct.toFixed(3)}%;">
            <span class="macro-month-label">${mb.shortName} '${String(mb.calendarYear).slice(-2)}</span>
          </div>
        `;
      })
      .join('');

    return `
      <aside class="macro-heatmap-panel" aria-label="3-Year Overall Workload Heatbar">
        <div class="macro-panel-header">
          <div class="macro-panel-title">
            <span>Overall Load Map</span>
            <span class="mono-tag">1W</span>
          </div>
          <div class="macro-panel-sub">
            <span>PRE &amp; POST WORKLOAD</span>
            <span>PEAK:${peakScore.toFixed(1)}</span>
          </div>
        </div>

        <div id="macro-heatmap-canvas" class="macro-heatmap-canvas" title="Click or drag vertically to jump across the 3-year programme">
          ${slicesHtml}
          ${monthTicksHtml}
          ${yearMarkersHtml}
          <div id="macro-viewport-lens" class="macro-viewport-lens" style="top:0%;height:20%;"></div>
        </div>

        <div class="macro-panel-legend">
          <div class="macro-legend-scale">
            <span class="macro-scale-end">LOW</span>
            <div class="macro-rainbow-bar" title="Blue = Lowest workload, Red = Highest workload (1-week granularity)"></div>
            <span class="macro-scale-end">HIGH</span>
          </div>
          <div class="macro-legend-row" style="color:var(--text-muted);justify-content:center;">
            <span>CLICK / DRAG TO NAVIGATE</span>
          </div>
        </div>
      </aside>
    `;
  }

  function syncMacroViewportLens() {
    const viewport = document.getElementById('timeline-viewport');
    const lens = document.getElementById('macro-viewport-lens');
    if (!viewport || !lens) return;

    const scrollHeight = Math.max(1, viewport.scrollHeight);
    const clientHeight = viewport.clientHeight;
    const scrollTop = viewport.scrollTop;

    const topPct = Math.max(0, Math.min(96, (scrollTop / scrollHeight) * 100));
    const heightPct = Math.max(3, Math.min(100 - topPct, (clientHeight / scrollHeight) * 100));

    lens.style.top = topPct.toFixed(2) + '%';
    lens.style.height = heightPct.toFixed(2) + '%';
  }

  function scrubViewportFromMacroEvent(clientY) {
    const canvas = document.getElementById('macro-heatmap-canvas');
    const viewport = document.getElementById('timeline-viewport');
    if (!canvas || !viewport) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.height <= 0) return;

    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const targetScrollTop =
      ratio * viewport.scrollHeight - viewport.clientHeight * 0.5;
    viewport.scrollTop = Math.max(0, targetScrollTop);
    syncMacroViewportLens();
  }

  function renderApp() {
    const root = document.getElementById('root');
    if (!root) return;

    const viewportEl = document.getElementById('timeline-viewport');
    const prevScrollTop = viewportEl ? viewportEl.scrollTop : 0;
    const prevScrollLeft = viewportEl ? viewportEl.scrollLeft : 0;

    const startYear = state.programmeStartYear;
    const pxPerDay = state.pxPerDay;
    const totalDays = DateMath.getTotalProgrammeDays(startYear);
    const totalHeightPx = totalDays * pxPerDay;

    const yearBounds = DateMath.generateYearBoundaries(startYear);
    const monthBounds = DateMath.generateMonthBoundaries(startYear);
    const weeklySlices = DateMath.computeWeeklyLoadSlices(
      state.deadlines,
      startYear,
      state.clinicalPlacements
    );

    const academicItems = state.deadlines.filter(function (d) {
      return d.domain === 'academic';
    });
    const clinicalItems = state.deadlines.filter(function (d) {
      return d.domain === 'clinical';
    });
    const researchItems = state.deadlines.filter(function (d) {
      return d.domain === 'research';
    });

    const layoutsByDomain = {
      academic: DateMath.layoutColumnDeadlines(
        academicItems,
        startYear,
        pxPerDay,
        state.splitOverlappingLanes
      ),
      clinical: DateMath.layoutColumnDeadlines(
        clinicalItems,
        startYear,
        pxPerDay,
        state.splitOverlappingLanes,
        state.clinicalPlacements
      ),
      research: DateMath.layoutColumnDeadlines(
        researchItems,
        startYear,
        pxPerDay,
        state.splitOverlappingLanes
      ),
    };

    const sortedTerms = state.terms.slice().sort(function (a, b) {
      return (
        DateMath.dateToDayOffset(a.startDate, startYear) -
        DateMath.dateToDayOffset(b.startDate, startYear)
      );
    });

    const totalCollisionWeeks = weeklySlices.filter(function (w) {
      return w.activeDomainsCount >= 2;
    }).length;
    const tripleCollisionWeeks = weeklySlices.filter(function (w) {
      return w.activeDomainsCount === 3;
    }).length;

    root.innerHTML = `
      <div class="app-shell">
        <header class="top-header">
          <div class="top-bar-row">
            <div class="brand-block">
              <div class="brand-mark">UCL</div>
              <div class="brand-titles">
                <h1>Longitudinal Programme Curriculum &amp; Deadline Sequencer</h1>
                <div class="brand-subtitle">
                  <span class="mono-tag">01 SEP ${startYear} &rarr; 30 SEP ${startYear + 3}</span>
                  <span>&bull;</span>
                  <span>${totalDays.toLocaleString()} Days / ${weeklySlices.length} Weeks</span>
                </div>
              </div>
            </div>

            <div class="toolbar-controls">
              <div class="control-pill" title="Anchor calendar year for September 1, Year 1">
                <label for="ctrl-start-year">Y1 Sep</label>
                <input id="ctrl-start-year" type="number" min="2020" max="2040" value="${startYear}" />
              </div>

              <div class="control-pill" title="Vertical scale in pixels per calendar day">
                <label for="ctrl-px-per-day">Scale</label>
                <input id="ctrl-px-per-day" type="range" min="2" max="10" step="0.5" value="${pxPerDay}" />
                <span class="mono-tag">${pxPerDay.toFixed(1)}px/d</span>
              </div>

              <div class="control-pill" title="Vertical drag-and-drop snap resolution">
                <label>Snap</label>
                <div class="segmented-group">
                  <button type="button" class="seg-btn ${state.snapIncrementDays === 1 ? 'active' : ''}" data-action="set-snap" data-snap="1">1d</button>
                  <button type="button" class="seg-btn ${state.snapIncrementDays === 7 ? 'active' : ''}" data-action="set-snap" data-snap="7">1w</button>
                </div>
              </div>

              <div class="control-pill" title="Sub-column lane splitting for overlapping deadlines within the same domain">
                <label>Lanes</label>
                <div class="segmented-group">
                  <button type="button" class="seg-btn ${state.splitOverlappingLanes ? 'active' : ''}" data-action="toggle-lanes">Split</button>
                </div>
              </div>

              <button type="button" class="btn ${state.isAddDrawerOpen ? 'btn-active-drawer' : ''}" data-action="toggle-add-drawer">
                + Add Entry
              </button>

              <button type="button" class="btn btn-primary" data-action="open-bulk-modal">
                Bulk Import / Export
              </button>

              <button
                type="button"
                class="btn"
                data-action="commit-save-state"
                style="${
                  state.serverConnected
                    ? 'background:#F0FDFA;color:#0F766E;border-color:#99F6E4;'
                    : 'background:#F8FAFC;color:#475569;border-color:#CBD5E1;'
                }"
                title="${
                  state.serverConnected
                    ? `Connected to shared LAN SQLite Database (Rev #${state.serverRevision}, ${state.connectedClients} active LAN browser${state.connectedClients === 1 ? '' : 's'}). Click to force sync.`
                    : 'Offline / Local Browser Storage mode. Start server.cjs to share across LAN.'
                }"
              >
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${
                  state.serverConnected ? '#0F766E' : '#94A3B8'
                };"></span>
                ${
                  state.serverConnected
                    ? `LAN SQLite${state.lastSavedAt ? ' · ' + state.lastSavedAt : ''} (${state.connectedClients} online)`
                    : `Local Cache${state.lastSavedAt ? ' · ' + state.lastSavedAt : ''}`
                }
              </button>

              <button type="button" class="btn btn-danger-outline" data-action="clear-all-state" title="Reset shared database to default dataset">
                Reset
              </button>
            </div>
          </div>

          ${state.isAddDrawerOpen ? renderCrudDrawer(startYear) : ''}
        </header>

        <div class="workspace-body">
          <div id="timeline-viewport" class="timeline-viewport">
            <div class="timeline-minwidth" style="${buildTimelineMinWidthCss()}">
              <div class="sticky-column-headers" style="grid-template-columns:${buildGridTemplateColumnsCss()};">
                <div class="axis-header-cell">
                  <div class="axis-header-top">
                    <span>Time Axis</span>
                    <span>Load</span>
                  </div>
                  <div class="axis-header-sub">
                    <span>YR / MO / WK</span>
                    <span>A&middot;C&middot;R</span>
                  </div>
                </div>

                ${['academic', 'clinical', 'research']
                  .map(function (domKey, idx) {
                    const cfg = DateMath.DOMAIN_CONFIG[domKey];
                    const count = layoutsByDomain[domKey].length;
                    const extraBadge =
                      domKey === 'clinical' && state.clinicalPlacements.length > 0
                        ? `<span class="mono-tag" style="background:#F0FDFA;color:#0F766E;border:1px solid #99F6E4;padding:1px 5px;border-radius:2px;">${state.clinicalPlacements.length} locked placements</span>`
                        : '';
                    const isResizingCol =
                      state.colResizeOp && state.colResizeOp.colKey === domKey;
                    const customWidth = state.columnWidths[domKey];
                    return `
                      <div class="domain-header-cell" data-col-header="${domKey}">
                        <div class="domain-header-top">
                          <div class="domain-title-wrap">
                            <span class="domain-swatch" style="background:${cfg.hex};"></span>
                            <span class="domain-col-number">0${idx + 1}</span>
                            <span class="domain-col-name">${cfg.label}</span>
                          </div>
                          <div style="display:flex;align-items:center;gap:4px;">
                            ${extraBadge}
                            <span class="domain-count-badge" style="background:${cfg.badgeBg};color:${cfg.badgeText};">
                              ${count} ${count === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </div>
                        <div class="domain-header-sub">${cfg.subtitle}</div>
                        <div
                          class="col-resize-handle ${isResizingCol ? 'is-resizing' : ''}"
                          data-col-resize="${domKey}"
                          title="Drag horizontally to resize ${cfg.label} column${customWidth ? ' (' + customWidth + 'px)' : ''} — Double-click to reset column widths"
                        ></div>
                      </div>
                    `;
                  })
                  .join('')}

                <div class="domain-header-cell" data-col-header="terms" style="background:#F8FAFC;">
                  <div class="domain-header-top">
                    <div class="domain-title-wrap">
                      <span class="domain-swatch" style="background:#334155;"></span>
                      <span class="domain-col-number">04</span>
                      <span class="domain-col-name">UCL Term Dates</span>
                    </div>
                    <span class="domain-count-badge" style="background:#E2E8F0;color:#1E293B;">
                      ${sortedTerms.length} ${sortedTerms.length === 1 ? 'block' : 'blocks'}
                    </span>
                  </div>
                  <div class="domain-header-sub">Terms 1–3, Reading Weeks &amp; Vacations</div>
                  <div
                    class="col-resize-handle ${state.colResizeOp && state.colResizeOp.colKey === 'terms' ? 'is-resizing' : ''}"
                    data-col-resize="terms"
                    title="Drag horizontally to resize UCL Term Dates column${state.columnWidths.terms ? ' (' + state.columnWidths.terms + 'px)' : ''} — Double-click to reset column widths"
                  ></div>
                </div>
              </div>

              <div class="timeline-body-grid" style="height:${totalHeightPx}px;grid-template-columns:${buildGridTemplateColumnsCss()};">
                <div class="axis-gutter" style="height:${totalHeightPx}px;">
                  ${yearBounds
                    .map(function (yb, idx) {
                      const topPx = yb.startDay * pxPerDay;
                      const heightPx = (yb.endDay - yb.startDay) * pxPerDay;
                      return `
                        <div class="axis-year-band ${idx % 2 === 0 ? 'even' : 'odd'}" style="top:${topPx}px;height:${heightPx}px;">
                          <span class="axis-year-vertical-text">${yb.label}</span>
                          <span class="axis-year-sub-vertical">${yb.calendarSpanLabel}</span>
                        </div>
                      `;
                    })
                    .join('')}

                  ${monthBounds
                    .map(function (mb) {
                      const topPx = mb.startDay * pxPerDay;
                      const heightPx = Math.max(12, (mb.endDay - mb.startDay) * pxPerDay);
                      const isSept = mb.monthIndex === 8;
                      return `
                        <div class="axis-month-cell ${isSept ? 'september' : ''}" style="top:${topPx}px;height:${heightPx}px;">
                          <span class="axis-month-name">${mb.shortName}</span>
                          <span class="axis-month-year">${mb.calendarYear}</span>
                        </div>
                      `;
                    })
                    .join('')}

                  ${weeklySlices
                    .map(function (wk) {
                      const topPx = wk.startDay * pxPerDay;
                      const heightPx = (wk.endDay - wk.startDay) * pxPerDay;
                      const showLabel = pxPerDay >= 3.5 || wk.yearWeekNumber % 2 === 1;
                      const bgHeat = getHeatStripColor(wk);
                      const pctOfPeak = Math.round((wk.normalizedLoad || 0) * 100);
                      const tooltipLines = [
                        `Year ${wk.programmeYear}, Week ${wk.yearWeekNumber} (${DateMath.formatAcademicDate(
                          wk.startIso,
                          startYear,
                          false
                        )} to ${DateMath.formatAcademicDate(
                          wk.endIso,
                          startYear,
                          false
                        )})`,
                        `Sampled Weekly Load: ${(wk.loadScore || 0).toFixed(2)} (${pctOfPeak}% of peak) · ${wk.totalActivePrepItems} active window(s)`,
                      ];
                      if (wk.activeTitles && wk.activeTitles.length > 0) {
                        wk.activeTitles.forEach(function (t) {
                          const wVal = typeof t.sampledLoad === 'number' ? ` [load: ${t.sampledLoad.toFixed(2)}]` : '';
                          tooltipLines.push(
                            `• [${t.domain.toUpperCase()}] ${t.title}${wVal} (${DateMath.formatAcademicDate(
                              t.dueDate,
                              startYear,
                              false
                            )})`
                          );
                        });
                      }
                      return `
                        <div
                          class="axis-week-row"
                          style="top:${topPx}px;height:${heightPx}px;background:${bgHeat};"
                          title="${escapeHtml(tooltipLines.join('\n'))}"
                        >
                          <span class="axis-week-label">${showLabel ? 'W' + wk.yearWeekNumber : ''}</span>
                          <div class="heat-strip-cell">
                            <span class="domain-pips">
                              ${wk.academicCount > 0 ? '<span class="domain-pip" style="background:#1E40AF;"></span>' : ''}
                              ${wk.clinicalCount > 0 ? '<span class="domain-pip" style="background:#0F766E;"></span>' : ''}
                              ${wk.researchCount > 0 ? '<span class="domain-pip" style="background:#991B1B;"></span>' : ''}
                            </span>
                            ${
                              wk.totalActivePrepItems > 0
                                ? `<span class="heat-tally-badge" style="${getHeatBadgeStyle(wk)}">${wk.totalActivePrepItems}</span>`
                                : ''
                            }
                          </div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>

                <div class="grid-backdrop" style="height:${totalHeightPx}px;">
                  ${weeklySlices
                    .map(function (wk) {
                      return `<div class="grid-week-line" style="top:${wk.startDay * pxPerDay}px;"></div>`;
                    })
                    .join('')}

                  ${monthBounds
                    .map(function (mb) {
                      return `<div class="grid-month-line" style="top:${mb.startDay * pxPerDay}px;"></div>`;
                    })
                    .join('')}

                  ${yearBounds
                    .map(function (yb) {
                      return `
                        <div class="grid-year-line" style="top:${yb.startDay * pxPerDay}px;height:22px;">
                          <span class="grid-year-watermark">${yb.label} &mdash; ${yb.calendarSpanLabel} (01 Sep ${
                            startYear + yb.programmeYear - 1
                          })</span>
                        </div>
                      `;
                    })
                    .join('')}
                </div>

                ${['academic', 'clinical', 'research']
                  .map(function (domKey) {
                    const laidOut = layoutsByDomain[domKey];
                    const cfg = DateMath.DOMAIN_CONFIG[domKey];
                    const placementBlocksHtml =
                      domKey === 'clinical'
                        ? renderClinicalPlacementBlocks(
                            state.clinicalPlacements,
                            startYear,
                            pxPerDay
                          )
                        : '';
                    return `
                      <div class="timeline-column" data-domain-column="${domKey}" style="height:${totalHeightPx}px;">
                        ${placementBlocksHtml}
                        ${
                          laidOut.length === 0 &&
                          (domKey !== 'clinical' || state.clinicalPlacements.length === 0)
                            ? `
                              <div class="empty-column-notice">
                                <div style="font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:3px;">No ${cfg.label} Deadlines</div>
                                <div>Use <strong>+ Add Entry</strong> or <strong>Bulk Import</strong> to populate ${cfg.label.toLowerCase()} milestones.</div>
                              </div>
                            `
                            : ''
                        }
                        ${laidOut
                          .map(function (entry) {
                            return renderDeadlineComposite(entry, cfg, startYear);
                          })
                          .join('')}
                        <div
                          class="col-resize-handle"
                          data-col-resize="${domKey}"
                          title="Drag horizontally to resize ${cfg.label} column — Double-click to reset column widths"
                        ></div>
                      </div>
                    `;
                  })
                  .join('')}

                <div class="timeline-column term-column" data-domain-column="terms" style="height:${totalHeightPx}px;">
                  ${
                    sortedTerms.length === 0
                      ? `
                        <div class="empty-column-notice">
                          <div style="font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:3px;">No UCL Term Dates Loaded</div>
                          <div>Import Term 1, Term 2, Term 3, Reading Weeks, and Vacations via <strong>Bulk Import</strong> or <strong>+ Add Entry</strong>.</div>
                        </div>
                      `
                      : ''
                  }
                  ${sortedTerms
                    .map(function (term) {
                      return renderTermBlock(term, startYear, pxPerDay);
                    })
                    .join('')}
                  <div
                    class="col-resize-handle"
                    data-col-resize="terms"
                    title="Drag horizontally to resize UCL Term Dates column — Double-click to reset column widths"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          ${renderMacroHeatmapPanel(weeklySlices, yearBounds, monthBounds, totalDays)}
        </div>

        ${renderLiveDragHud()}
        ${renderEditModal()}
        ${renderBulkImportModal()}

        <footer class="bottom-footer">
          <div class="footer-metrics">
            <span>CANVAS HEIGHT: <strong>${Math.round(totalHeightPx)}px</strong> (${totalDays}d @ ${pxPerDay}px/d)</span>
            <span>DEADLINES: <strong>${state.deadlines.length}</strong></span>
            <span>CLINICAL PLACEMENTS: <strong>${state.clinicalPlacements.length} (LOCKED)</strong></span>
            <span>TERM BLOCKS: <strong>${state.terms.length}</strong></span>
            <span>MULTI-DOMAIN COLLISION WEEKS: <strong>${totalCollisionWeeks}</strong> (3-DOMAIN: <strong>${tripleCollisionWeeks}</strong>)</span>
          </div>
          <div class="legend-inline">
            <span class="legend-item">
              <span class="legend-box" style="background:linear-gradient(to bottom, rgba(30,64,175,0.05), rgba(30,64,175,0.75));"></span>
              Pre/Post Workload (&uarr; top / &darr; bottom edge)
            </span>
            <span class="legend-item">
              <span class="legend-box" style="background:#1E293B;"></span>
              Due Anchor (&varr; drag to reschedule)
            </span>
          </div>
        </footer>
      </div>
    `;

    const newViewportEl = document.getElementById('timeline-viewport');
    if (newViewportEl) {
      newViewportEl.scrollTop = prevScrollTop;
      newViewportEl.scrollLeft = prevScrollLeft;
      newViewportEl.addEventListener('scroll', syncMacroViewportLens, {
        passive: true,
      });
    }
    syncMacroViewportLens();
  }

  function renderCrudDrawer(startYear) {
    const minIso = DateMath.getProgrammeStartIso(startYear);
    const maxIso = DateMath.getProgrammeEndIso(startYear);
    return `
      <div class="crud-drawer">
        <div class="drawer-grid">
          <form id="form-add-deadline" class="drawer-card">
            <div class="drawer-card-header">
              <span class="drawer-card-title">Add Course Deadline</span>
              <span class="mono-tag">Valid range: ${minIso} to ${maxIso}</span>
            </div>
            <div class="form-row-deadline">
              <div class="field-group">
                <label>Title</label>
                <input type="text" name="title" class="field-input" placeholder="e.g., Clinical Case Report 1" value="${escapeHtml(state.formDeadlineTitle)}" required />
              </div>
              <div class="field-group">
                <label>Domain</label>
                <select name="domain" class="field-input">
                  <option value="academic" ${state.formDeadlineDomain === 'academic' ? 'selected' : ''}>Academic</option>
                  <option value="clinical" ${state.formDeadlineDomain === 'clinical' ? 'selected' : ''}>Clinical</option>
                  <option value="research" ${state.formDeadlineDomain === 'research' ? 'selected' : ''}>Research</option>
                </select>
              </div>
              <div class="field-group">
                <label>Due Date</label>
                <input type="date" name="dueDate" class="field-input mono-tag" value="${escapeHtml(state.formDeadlineDueDate)}" required />
              </div>
              <div class="field-group">
                <label>Pre-Deadline Prep</label>
                <div class="prep-compound">
                  <input type="number" name="prepValue" class="field-input" min="0" max="365" value="${state.formDeadlinePrepValue}" required />
                  <select name="prepUnit" class="field-input">
                    <option value="days" ${state.formDeadlinePrepUnit === 'days' ? 'selected' : ''}>days</option>
                    <option value="weeks" ${state.formDeadlinePrepUnit === 'weeks' ? 'selected' : ''}>wks</option>
                  </select>
                </div>
              </div>
              <div class="field-group">
                <label>Post-Deadline Load</label>
                <div class="prep-compound">
                  <input type="number" name="postValue" class="field-input" min="0" max="365" value="${state.formDeadlinePostValue}" required />
                  <select name="postUnit" class="field-input">
                    <option value="days" ${state.formDeadlinePostUnit === 'days' ? 'selected' : ''}>days</option>
                    <option value="weeks" ${state.formDeadlinePostUnit === 'weeks' ? 'selected' : ''}>wks</option>
                  </select>
                </div>
              </div>
              <div class="field-group">
                <label>Workload Curve</label>
                <select name="workloadCurve" class="field-input">
                  <option value="exponential" ${state.formDeadlineCurve !== 'linear' ? 'selected' : ''}>Exponential</option>
                  <option value="linear" ${state.formDeadlineCurve === 'linear' ? 'selected' : ''}>Linear</option>
                </select>
              </div>
              <div class="field-group">
                <label>Notes (Optional)</label>
                <input type="text" name="notes" class="field-input" placeholder="Weighting / module code" value="${escapeHtml(state.formDeadlineNotes)}" />
              </div>
              <button type="submit" class="btn btn-primary" style="height:28px;">Add Deadline</button>
            </div>
          </form>

          <form id="form-add-term" class="drawer-card">
            <div class="drawer-card-header">
              <span class="drawer-card-title">Add UCL Term / Vacation Block (Col 04)</span>
              <span class="mono-tag">Continuous Span</span>
            </div>
            <div class="form-row-term">
              <div class="field-group">
                <label>Block Name</label>
                <input type="text" name="termName" class="field-input" placeholder="e.g., Year 1 - Term 1" value="${escapeHtml(state.formTermName)}" required />
              </div>
              <div class="field-group">
                <label>Start Date</label>
                <input type="date" name="startDate" class="field-input mono-tag" value="${escapeHtml(state.formTermStartDate)}" required />
              </div>
              <div class="field-group">
                <label>End Date</label>
                <input type="date" name="endDate" class="field-input mono-tag" value="${escapeHtml(state.formTermEndDate)}" required />
              </div>
              <button type="submit" class="btn" style="height:28px;background:#334155;color:#FFF;border-color:#334155;">Add Term</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderDeadlineComposite(entry, cfg, startYear) {
    const item = entry.item;
    const prepDays = Math.max(
      0,
      item.prepDurationDays !== undefined ? Number(item.prepDurationDays) : 14
    );
    const postDays = Math.max(0, Number(item.postDurationDays) || 0);
    const itemCurve = item.workloadCurve === 'linear' ? 'linear' : 'exponential';
    const curveShortLabel = itemCurve === 'linear' ? 'Lin' : 'Exp';
    const nextCurveLabel = itemCurve === 'linear' ? 'Exponential' : 'Linear';

    const laneWidthPct = 100 / entry.totalLanes;
    const leftPct = entry.laneIndex * laneWidthPct;
    const widthCalc =
      entry.totalLanes > 1
        ? `calc(${laneWidthPct}% - 8px)`
        : 'calc(100% - 14px)';
    const leftCalc =
      entry.totalLanes > 1 ? `calc(${leftPct}% + 4px)` : '7px';

    const prepStartIso = DateMath.dayOffsetToDate(entry.prepStartDay, startYear);
    const postEndIso = DateMath.dayOffsetToDate(entry.postEndDay, startYear);
    const prepGradientCss = DateMath.buildPreparationGradient(
      cfg.rgb,
      itemCurve
    );
    const postGradientCss = DateMath.buildPostGradient(
      cfg.rgb,
      itemCurve
    );

    const isDragging =
      state.dragOp && state.dragOp.deadlineId === item.id;

    const prepWeeksExact =
      prepDays > 0 && prepDays % 7 === 0
        ? `${prepDays / 7}w (${prepDays}d)`
        : `${prepDays}d`;

    const postWeeksExact =
      postDays > 0 && postDays % 7 === 0
        ? `${postDays / 7}w (${postDays}d)`
        : `${postDays}d`;

    const loadSummaryParts = [];
    if (prepDays > 0) loadSummaryParts.push(`${prepDays}d pre`);
    if (postDays > 0) loadSummaryParts.push(`${postDays}d post`);
    if (loadSummaryParts.length === 0) loadSummaryParts.push('0d load');

    return `
      <div
        class="deadline-composite ${isDragging ? 'is-dragging' : ''}"
        data-deadline-id="${escapeHtml(item.id)}"
        style="top:${entry.yStart}px;left:${leftCalc};width:${widthCalc};"
      >
        <div
          class="prep-tail ${prepDays === 0 ? 'zero-height' : ''}"
          data-drag-role="shift-due"
          data-deadline-id="${escapeHtml(item.id)}"
          style="
            height:${entry.heightPx}px;
            ${
              prepDays > 0
                ? `
                  background:${prepGradientCss};
                  border-left-color:${cfg.hex};
                  border-right-color:rgba(${cfg.rgb}, 0.28);
                  border-top-color:rgba(${cfg.rgb}, 0.55);
                `
                : ''
            }
          "
          title="${escapeHtml(item.title)} — Drag vertically to shift due date, or drag top edge to resize pre-deadline preparation window"
        >
          <div
            class="prep-resize-handle"
            data-drag-role="resize-prep"
            data-deadline-id="${escapeHtml(item.id)}"
            title="Drag top edge vertically to lengthen or shorten pre-deadline preparation window (${prepDays} days)"
          >
            <span class="prep-resize-grip" style="background:${cfg.hex};"></span>
            ${
              entry.heightPx >= 26
                ? `<span class="prep-start-pill">Prep ${DateMath.formatAcademicDate(
                    prepStartIso,
                    startYear,
                    false
                  )} (${prepWeeksExact})</span>`
                : ''
            }
          </div>
        </div>

        <div class="deadline-anchor-bar" style="background:${cfg.hex};"></div>

        <div
          class="deadline-anchor-card"
          data-drag-role="shift-due"
          data-deadline-id="${escapeHtml(item.id)}"
          style="border-left-color:${cfg.hex};"
        >
          <div class="anchor-card-top">
            <span class="anchor-title">${escapeHtml(item.title)}</span>
            <div class="anchor-card-actions">
              <button
                type="button"
                class="anchor-edit-btn"
                data-action="open-edit-deadline"
                data-deadline-id="${escapeHtml(item.id)}"
                title="Edit deadline details"
              >
                &#9998;
              </button>
              <button
                type="button"
                class="anchor-delete-btn"
                data-action="quick-delete-deadline"
                data-deadline-id="${escapeHtml(item.id)}"
                title="Delete deadline"
              >
                &times;
              </button>
            </div>
          </div>
          <div class="anchor-meta-row">
            <span style="font-weight:700;color:${cfg.hex};">${DateMath.formatAcademicDate(
              item.dueDate,
              startYear,
              true
            )}</span>
            <span style="display:inline-flex;align-items:center;gap:3px;">
              <span class="anchor-prep-tag" style="background:${cfg.badgeBg};color:${cfg.badgeText};">
                ${loadSummaryParts.join(' · ')}
              </span>
              <button
                type="button"
                class="anchor-curve-btn"
                data-action="toggle-deadline-curve"
                data-deadline-id="${escapeHtml(item.id)}"
                title="Workload curve: ${itemCurve === 'linear' ? 'Linear' : 'Exponential'} — Click to switch to ${nextCurveLabel}"
              >
                ${curveShortLabel}
              </button>
            </span>
          </div>
          ${
            item.notes
              ? `<div class="anchor-notes" title="${escapeHtml(item.notes)}">${escapeHtml(
                  item.notes
                )}</div>`
              : ''
          }
          ${
            postDays === 0
              ? `
                <div
                  class="post-resize-handle zero-post"
                  data-drag-role="resize-post"
                  data-deadline-id="${escapeHtml(item.id)}"
                  title="Drag downward to add post-deadline workload window (currently 0 days)"
                >
                  <span class="prep-resize-grip" style="background:${cfg.hex};"></span>
                  <span class="prep-start-pill">+ Post load</span>
                </div>
              `
              : ''
          }
        </div>

        ${
          postDays > 0
            ? `
              <div
                class="post-tail"
                data-drag-role="shift-due"
                data-deadline-id="${escapeHtml(item.id)}"
                style="
                  height:${entry.postHeightPx}px;
                  background:${postGradientCss};
                  border-left-color:${cfg.hex};
                  border-right-color:rgba(${cfg.rgb}, 0.28);
                  border-bottom-color:rgba(${cfg.rgb}, 0.55);
                "
                title="${escapeHtml(item.title)} — Post-deadline workload (${postDays} days until ${postEndIso}). Drag bottom edge to resize."
              >
                <div
                  class="post-resize-handle"
                  data-drag-role="resize-post"
                  data-deadline-id="${escapeHtml(item.id)}"
                  title="Drag bottom edge vertically to lengthen or shorten post-deadline workload window (${postDays} days)"
                >
                  <span class="prep-resize-grip" style="background:${cfg.hex};"></span>
                  ${
                    entry.postHeightPx >= 26
                      ? `<span class="prep-start-pill">Post &rarr; ${DateMath.formatAcademicDate(
                          postEndIso,
                          startYear,
                          false
                        )} (+${postWeeksExact})</span>`
                      : ''
                  }
                </div>
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  function renderClinicalPlacementBlocks(placements, startYear, pxPerDay) {
    if (!Array.isArray(placements) || placements.length === 0) return '';
    const cfg = DateMath.DOMAIN_CONFIG.clinical;

    return placements
      .map(function (pl) {
        const plCurve =
          pl.workloadCurve === 'linear' ? 'linear' : 'exponential';
        const curveShortLabel = plCurve === 'linear' ? 'Lin' : 'Exp';
        const nextCurveLabel = plCurve === 'linear' ? 'Exponential' : 'Linear';
        const startPostGradient = DateMath.buildPostGradient(cfg.rgb, plCurve);
        const endPrepGradient = DateMath.buildPreparationGradient(
          cfg.rgb,
          plCurve
        );

        const startDay = DateMath.dateToDayOffset(pl.startDate, startYear);
        const endDayOffset = DateMath.dateToDayOffset(pl.endDate, startYear);
        const endDay = endDayOffset + 1;
        const topPx = startDay * pxPerDay;
        const heightPx = Math.max(22, (endDay - startDay) * pxPerDay);
        const durationDays = Math.max(1, endDay - startDay);
        const durationWeeks = Math.round(durationDays / 7);

        const startLoadDays = Math.max(
          0,
          pl.startLoadDays !== undefined ? Number(pl.startLoadDays) : 14
        );
        const endLoadDays = Math.max(
          0,
          pl.endLoadDays !== undefined ? Number(pl.endLoadDays) : 14
        );

        const startLoadHeightPx =
          startLoadDays > 0 ? Math.max(4, startLoadDays * pxPerDay) : 0;
        const endLoadHeightPx =
          endLoadDays > 0 ? Math.max(4, endLoadDays * pxPerDay) : 0;

        const startLoadEndIso = DateMath.dayOffsetToDate(
          startDay + startLoadDays,
          startYear
        );
        const endLoadStartIso = DateMath.dayOffsetToDate(
          endDayOffset - endLoadDays,
          startYear
        );

        const startLoadExact =
          startLoadDays > 0 && startLoadDays % 7 === 0
            ? `${startLoadDays / 7}w (${startLoadDays}d)`
            : `${startLoadDays}d`;
        const endLoadExact =
          endLoadDays > 0 && endLoadDays % 7 === 0
            ? `${endLoadDays / 7}w (${endLoadDays}d)`
            : `${endLoadDays}d`;

        const isDragging =
          state.dragOp && state.dragOp.placementId === pl.id;

        return `
          <div
            class="clinical-placement-block ${isDragging ? 'is-dragging' : ''}"
            data-placement-id="${escapeHtml(pl.id)}"
            style="top:${topPx}px;height:${heightPx}px;"
            title="${escapeHtml(pl.name)}: ${DateMath.formatAcademicDate(pl.startDate, startYear, false)} to ${DateMath.formatAcademicDate(pl.endDate, startYear, false)} (${durationDays} days / ~${durationWeeks} weeks) — Post-start load: ${startLoadDays}d, Pre-end load: ${endLoadDays}d (${plCurve})"
          >
            <div
              class="placement-workload-start ${startLoadDays === 0 ? 'zero-load' : ''}"
              style="
                height:${startLoadHeightPx}px;
                ${startLoadDays > 0 ? `background:${startPostGradient};` : ''}
              "
            >
              <div
                class="placement-start-resize-handle"
                data-drag-role="resize-placement-start"
                data-placement-id="${escapeHtml(pl.id)}"
                style="${startLoadDays === 0 ? 'top:44px;bottom:auto;' : ''}"
                title="Drag vertically to resize workload following placement start date (${startLoadDays} days until ${DateMath.formatAcademicDate(startLoadEndIso, startYear, false)})"
              >
                <span class="prep-resize-grip" style="background:${cfg.hex};"></span>
                <span class="prep-start-pill">
                  ${
                    startLoadDays > 0
                      ? `Start Load &rarr; ${DateMath.formatAcademicDate(
                          startLoadEndIso,
                          startYear,
                          false
                        )} (+${startLoadExact})`
                      : '+ Start load'
                  }
                </span>
              </div>
            </div>

            <div
              class="placement-workload-end ${endLoadDays === 0 ? 'zero-load' : ''}"
              style="
                height:${endLoadHeightPx}px;
                ${endLoadDays > 0 ? `background:${endPrepGradient};` : ''}
              "
            >
              <div
                class="placement-end-resize-handle"
                data-drag-role="resize-placement-end"
                data-placement-id="${escapeHtml(pl.id)}"
                style="${endLoadDays === 0 ? 'bottom:24px;top:auto;' : ''}"
                title="Drag vertically to resize workload preceding placement end date (${endLoadDays} days from ${DateMath.formatAcademicDate(endLoadStartIso, startYear, false)})"
              >
                <span class="prep-resize-grip" style="background:${cfg.hex};"></span>
                <span class="prep-start-pill">
                  ${
                    endLoadDays > 0
                      ? `End Prep ${DateMath.formatAcademicDate(
                          endLoadStartIso,
                          startYear,
                          false
                        )} (${endLoadExact})`
                      : '+ End load'
                  }
                </span>
              </div>
            </div>

            <div class="clinical-placement-top-wrap">
              <div class="clinical-placement-header">
                <span class="clinical-placement-title">${escapeHtml(pl.name)}</span>
                <div style="display:flex;align-items:center;gap:4px;">
                  <span class="clinical-placement-lock">IMMOVABLE PLACEMENT</span>
                  <button
                    type="button"
                    class="anchor-edit-btn"
                    data-action="open-edit-placement"
                    data-placement-id="${escapeHtml(pl.id)}"
                    title="Edit placement workload &amp; details"
                  >
                    &#9998;
                  </button>
                </div>
              </div>
              <div class="clinical-placement-meta-row">
                <span class="clinical-placement-dates">
                  ${DateMath.formatAcademicDate(pl.startDate, startYear, false)} &rarr; ${DateMath.formatAcademicDate(pl.endDate, startYear, false)}
                </span>
                <span style="display:inline-flex;align-items:center;gap:3px;pointer-events:auto;">
                  <span class="anchor-prep-tag" style="background:${cfg.badgeBg};color:${cfg.badgeText};font-family:var(--font-mono);font-size:9px;border:1px solid rgba(15,118,110,0.2);">
                    +${startLoadDays}d start &middot; ${endLoadDays}d end
                  </span>
                  <button
                    type="button"
                    class="anchor-curve-btn"
                    data-action="toggle-placement-curve"
                    data-placement-id="${escapeHtml(pl.id)}"
                    title="Workload curve: ${plCurve === 'linear' ? 'Linear' : 'Exponential'} — Click to switch to ${nextCurveLabel}"
                  >
                    ${curveShortLabel}
                  </button>
                </span>
              </div>
            </div>

            ${
              heightPx >= 60
                ? `<div class="clinical-placement-footer">${durationWeeks} wks (${durationDays}d) &bull; End ${DateMath.formatAcademicDate(pl.endDate, startYear, false)}</div>`
                : ''
            }
          </div>
        `;
      })
      .join('');
  }

  function renderTermBlock(term, startYear, pxPerDay) {
    const startDay = DateMath.dateToDayOffset(term.startDate, startYear);
    const endDay = DateMath.dateToDayOffset(term.endDate, startYear) + 1;
    const topPx = startDay * pxPerDay;
    const heightPx = Math.max(18, (endDay - startDay) * pxPerDay);
    const durationDays = Math.max(1, endDay - startDay);
    const kindClass = classifyTermKind(term.name);
    const isReadingWeek = kindClass === 'kind-reading';
    const zIndex = isReadingWeek ? 12 : 6;
    const inlinePos = isReadingWeek ? 'left:16px;right:6px;' : '';

    return `
      <div
        class="term-block ${kindClass}"
        data-action="open-edit-term"
        data-term-id="${escapeHtml(term.id)}"
        style="top:${topPx}px;height:${heightPx}px;z-index:${zIndex};${inlinePos}"
        title="${escapeHtml(term.name)} (${DateMath.formatAcademicDate(term.startDate, startYear, false)} to ${DateMath.formatAcademicDate(term.endDate, startYear, false)}) — Click to edit or delete"
      >
        <div>
          <div class="term-block-header">
            <span class="term-block-name">${escapeHtml(term.name)}</span>
          </div>
          ${
            heightPx >= 34
              ? `<div class="term-block-dates">${DateMath.formatAcademicDate(
                  term.startDate,
                  startYear,
                  false
                )} &rarr; ${DateMath.formatAcademicDate(
                  term.endDate,
                  startYear,
                  false
                )}</div>`
              : ''
          }
        </div>
        ${
          heightPx >= 52
            ? `<div class="term-block-duration">${durationDays}d (${(
                durationDays / 7
              ).toFixed(1)}w)</div>`
            : ''
        }
      </div>
    `;
  }

  function renderLiveDragHud() {
    if (!state.dragOp) return '';

    if (state.dragOp.placementId) {
      const pl = state.clinicalPlacements.find(function (item) {
        return item.id === state.dragOp.placementId;
      });
      if (!pl) return '';
      const startDay = DateMath.dateToDayOffset(
        pl.startDate,
        state.programmeStartYear
      );
      const endDay = DateMath.dateToDayOffset(
        pl.endDate,
        state.programmeStartYear
      );
      const startLoadDays = Math.max(
        0,
        pl.startLoadDays !== undefined ? Number(pl.startLoadDays) : 14
      );
      const endLoadDays = Math.max(
        0,
        pl.endLoadDays !== undefined ? Number(pl.endLoadDays) : 14
      );
      const startLoadEndIso = DateMath.dayOffsetToDate(
        startDay + startLoadDays,
        state.programmeStartYear
      );
      const endLoadStartIso = DateMath.dayOffsetToDate(
        endDay - endLoadDays,
        state.programmeStartYear
      );
      const modeLabel =
        state.dragOp.mode === 'resize-placement-start'
          ? 'Resizing Placement Start Workload'
          : 'Resizing Placement End Workload';

      return `
        <div class="live-drag-hud">
          <span style="color:#99F6E4;text-transform:uppercase;">
            ${modeLabel}
          </span>
          <strong>${escapeHtml(pl.name)}</strong>
          <span>Start Load: <strong>${DateMath.formatAcademicDate(pl.startDate, state.programmeStartYear, false)} &rarr; ${DateMath.formatAcademicDate(startLoadEndIso, state.programmeStartYear, false)} (+${startLoadDays}d)</strong></span>
          <span>End Load: <strong>${DateMath.formatAcademicDate(endLoadStartIso, state.programmeStartYear, false)} &rarr; ${DateMath.formatAcademicDate(pl.endDate, state.programmeStartYear, false)} (${endLoadDays}d)</strong></span>
        </div>
      `;
    }

    const d = state.deadlines.find(function (item) {
      return item.id === state.dragOp.deadlineId;
    });
    if (!d) return '';

    const prepDays = Math.max(
      0,
      d.prepDurationDays !== undefined ? Number(d.prepDurationDays) : 14
    );
    const postDays = Math.max(0, Number(d.postDurationDays) || 0);
    const dueDay = DateMath.dateToDayOffset(d.dueDate, state.programmeStartYear);
    const prepStartDay = dueDay - prepDays;
    const postEndDay = dueDay + postDays;
    const prepStartIso = DateMath.dayOffsetToDate(
      prepStartDay,
      state.programmeStartYear
    );
    const postEndIso = DateMath.dayOffsetToDate(
      postEndDay,
      state.programmeStartYear
    );

    const modeLabel =
      state.dragOp.mode === 'shift-due'
        ? 'Rescheduling Due Date'
        : state.dragOp.mode === 'resize-post'
        ? 'Resizing Post-Deadline Load'
        : 'Resizing Pre-Deadline Prep';

    return `
      <div class="live-drag-hud">
        <span style="color:#94A3B8;text-transform:uppercase;">
          ${modeLabel}
        </span>
        <strong>${escapeHtml(d.title)}</strong>
        <span>Prep: <strong>${DateMath.formatAcademicDate(prepStartIso, state.programmeStartYear, false)} (${prepDays}d)</strong></span>
        <span>Due: <strong>${DateMath.formatAcademicDate(d.dueDate, state.programmeStartYear, false)}</strong></span>
        <span>Post: <strong>${DateMath.formatAcademicDate(postEndIso, state.programmeStartYear, false)} (+${postDays}d)</strong></span>
      </div>
    `;
  }

  function renderEditModal() {
    if (state.editingDeadlineId) {
      const item = state.deadlines.find(function (d) {
        return d.id === state.editingDeadlineId;
      });
      if (!item) {
        state.editingDeadlineId = null;
        return '';
      }
      const prepVal =
        item.prepDurationDays !== undefined ? Number(item.prepDurationDays) : 14;
      const postVal = Number(item.postDurationDays) || 0;
      const itemCurve =
        item.workloadCurve === 'linear' ? 'linear' : 'exponential';
      return `
        <div class="modal-backdrop" data-action="close-edit-modal-backdrop">
          <div class="modal-card modal-sm">
            <div class="modal-header">
              <span class="modal-title">Edit Course Deadline</span>
              <button type="button" class="btn" data-action="close-edit-modal">Close</button>
            </div>
            <form id="form-edit-deadline">
              <div class="modal-body">
                <div class="field-group">
                  <label>Title</label>
                  <input type="text" name="title" class="field-input" value="${escapeHtml(item.title)}" required />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                  <div class="field-group">
                    <label>Domain</label>
                    <select name="domain" class="field-input">
                      <option value="academic" ${item.domain === 'academic' ? 'selected' : ''}>Academic</option>
                      <option value="clinical" ${item.domain === 'clinical' ? 'selected' : ''}>Clinical</option>
                      <option value="research" ${item.domain === 'research' ? 'selected' : ''}>Research</option>
                    </select>
                  </div>
                  <div class="field-group">
                    <label>Due Date (YYYY-MM-DD)</label>
                    <input type="date" name="dueDate" class="field-input mono-tag" value="${escapeHtml(item.dueDate)}" required />
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                  <div class="field-group">
                    <label>Pre-Deadline Prep (Days)</label>
                    <input type="number" name="prepDurationDays" class="field-input mono-tag" min="0" max="365" value="${prepVal}" required />
                  </div>
                  <div class="field-group">
                    <label>Post-Deadline Load (Days)</label>
                    <input type="number" name="postDurationDays" class="field-input mono-tag" min="0" max="365" value="${postVal}" required />
                  </div>
                  <div class="field-group">
                    <label>Workload Curve</label>
                    <select name="workloadCurve" class="field-input">
                      <option value="exponential" ${itemCurve === 'exponential' ? 'selected' : ''}>Exponential</option>
                      <option value="linear" ${itemCurve === 'linear' ? 'selected' : ''}>Linear</option>
                    </select>
                  </div>
                </div>
                <div class="field-group">
                  <label>Notes</label>
                  <input type="text" name="notes" class="field-input" value="${escapeHtml(item.notes || '')}" />
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-danger-outline" data-action="delete-deadline" data-deadline-id="${escapeHtml(item.id)}">
                  Delete Deadline
                </button>
                <div style="display:flex;gap:8px;">
                  <button type="button" class="btn" data-action="close-edit-modal">Cancel</button>
                  <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    if (state.editingPlacementId) {
      const pl = state.clinicalPlacements.find(function (p) {
        return p.id === state.editingPlacementId;
      });
      if (!pl) {
        state.editingPlacementId = null;
        return '';
      }
      const startLoadVal =
        pl.startLoadDays !== undefined ? Number(pl.startLoadDays) : 14;
      const endLoadVal =
        pl.endLoadDays !== undefined ? Number(pl.endLoadDays) : 14;
      const plCurve =
        pl.workloadCurve === 'linear' ? 'linear' : 'exponential';
      return `
        <div class="modal-backdrop" data-action="close-edit-modal-backdrop">
          <div class="modal-card modal-sm">
            <div class="modal-header">
              <span class="modal-title">Edit Clinical Placement Workloads</span>
              <button type="button" class="btn" data-action="close-edit-modal">Close</button>
            </div>
            <form id="form-edit-placement">
              <div class="modal-body">
                <div class="field-group">
                  <label>Placement Name</label>
                  <input type="text" name="name" class="field-input" value="${escapeHtml(pl.name)}" required />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                  <div class="field-group">
                    <label>Start Date</label>
                    <input type="date" name="startDate" class="field-input mono-tag" value="${escapeHtml(pl.startDate)}" required />
                  </div>
                  <div class="field-group">
                    <label>End Date</label>
                    <input type="date" name="endDate" class="field-input mono-tag" value="${escapeHtml(pl.endDate)}" required />
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                  <div class="field-group">
                    <label>Post-Start Workload (Days)</label>
                    <input type="number" name="startLoadDays" class="field-input mono-tag" min="0" max="365" value="${startLoadVal}" required />
                  </div>
                  <div class="field-group">
                    <label>Pre-End Workload (Days)</label>
                    <input type="number" name="endLoadDays" class="field-input mono-tag" min="0" max="365" value="${endLoadVal}" required />
                  </div>
                  <div class="field-group">
                    <label>Workload Curve</label>
                    <select name="workloadCurve" class="field-input">
                      <option value="exponential" ${plCurve === 'exponential' ? 'selected' : ''}>Exponential</option>
                      <option value="linear" ${plCurve === 'linear' ? 'selected' : ''}>Linear</option>
                    </select>
                  </div>
                </div>
                <div class="field-group">
                  <label>Notes</label>
                  <input type="text" name="notes" class="field-input" value="${escapeHtml(pl.notes || '')}" />
                </div>
              </div>
              <div class="modal-footer">
                <span class="mono-tag">Clinical Column</span>
                <div style="display:flex;gap:8px;">
                  <button type="button" class="btn" data-action="close-edit-modal">Cancel</button>
                  <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    if (state.editingTermId) {
      const term = state.terms.find(function (t) {
        return t.id === state.editingTermId;
      });
      if (!term) {
        state.editingTermId = null;
        return '';
      }
      return `
        <div class="modal-backdrop" data-action="close-edit-modal-backdrop">
          <div class="modal-card modal-sm">
            <div class="modal-header">
              <span class="modal-title">Edit UCL Term Block</span>
              <button type="button" class="btn" data-action="close-edit-modal">Close</button>
            </div>
            <form id="form-edit-term">
              <div class="modal-body">
                <div class="field-group">
                  <label>Term / Vacation Name</label>
                  <input type="text" name="name" class="field-input" value="${escapeHtml(term.name)}" required />
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                  <div class="field-group">
                    <label>Start Date</label>
                    <input type="date" name="startDate" class="field-input mono-tag" value="${escapeHtml(term.startDate)}" required />
                  </div>
                  <div class="field-group">
                    <label>End Date</label>
                    <input type="date" name="endDate" class="field-input mono-tag" value="${escapeHtml(term.endDate)}" required />
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-danger-outline" data-action="delete-term" data-term-id="${escapeHtml(term.id)}">
                  Delete Term Block
                </button>
                <div style="display:flex;gap:8px;">
                  <button type="button" class="btn" data-action="close-edit-modal">Cancel</button>
                  <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      `;
    }

    return '';
  }

  function renderBulkImportModal() {
    if (!state.isBulkModalOpen) return '';

    return `
      <div class="modal-backdrop" data-action="close-bulk-modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <div class="modal-title">Bulk Schedule Import &amp; Export (JSON / CSV)</div>
              <div style="font-size:11px;color:#64748B;">Paste Academic, Clinical, and Research deadlines alongside Clinical Placements and UCL Term Dates, or export the sequenced schedule.</div>
            </div>
            <button type="button" class="btn" data-action="close-bulk-modal">Close</button>
          </div>

          <div class="modal-body">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <label class="btn" style="cursor:pointer;">
                  Upload .JSON / .CSV
                  <input id="bulk-file-input" type="file" accept=".json,.csv,.txt" style="display:none;" />
                </label>

                <div class="segmented-group">
                  <button type="button" class="seg-btn ${state.bulkModalMode === 'append' ? 'active' : ''}" data-action="set-bulk-mode" data-mode="append">
                    Append / Update
                  </button>
                  <button type="button" class="seg-btn ${state.bulkModalMode === 'replace' ? 'active' : ''}" data-action="set-bulk-mode" data-mode="replace">
                    Replace All
                  </button>
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:6px;">
                <button type="button" class="btn" data-action="load-current-json">Load Current JSON</button>
                <button type="button" class="btn" data-action="load-current-csv">Load Current CSV</button>
                <button type="button" class="btn" data-action="download-json">Download .JSON</button>
                <button type="button" class="btn" data-action="download-csv">Download .CSV</button>
              </div>
            </div>

            <textarea
              id="bulk-textarea"
              class="code-textarea"
              placeholder="Paste JSON object/array or CSV rows here..."
            >${escapeHtml(state.bulkTextValue)}</textarea>

            ${
              state.bulkFeedback
                ? `
                  <div class="alert-box ${state.bulkFeedback.type === 'error' ? 'alert-error' : 'alert-success'}">
                    ${state.bulkFeedback.lines
                      .map(function (line) {
                        return `<div>${escapeHtml(line)}</div>`;
                      })
                      .join('')}
                  </div>
                `
                : ''
            }

            <div class="schema-spec-box">
              <div style="font-weight:700;text-transform:uppercase;font-size:10px;color:#334155;letter-spacing:0.04em;">
                Supported JSON &amp; CSV Schema Formats
              </div>
              <div class="schema-spec-grid">
                <div>
                  <div style="font-weight:600;color:#475569;margin-bottom:3px;">1. JSON Schema</div>
                  <pre class="schema-pre">{
  "programmeStartYear": ${state.programmeStartYear},
  "deadlines": [
    {
      "title": "...",
      "domain": "academic | clinical | research",
      "dueDate": "YYYY-MM-DD",
      "prepDurationDays": 21,
      "postDurationDays": 7,
      "workloadCurve": "exponential | linear",
      "notes": "..."
    }
  ],
  "clinicalPlacements": [
    {
      "name": "Placement 1 (Y1)",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "startLoadDays": 14,
      "endLoadDays": 14,
      "workloadCurve": "exponential | linear"
    }
  ],
  "terms": [
    {
      "name": "Year 1 - Term 1",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD"
    }
  ]
}</pre>
                </div>
                <div>
                  <div style="font-weight:600;color:#475569;margin-bottom:3px;">2. Unified CSV Header</div>
                  <pre class="schema-pre">type,title,domain,dueDate,prepDurationDays,postDurationDays,workloadCurve,startDate,endDate,notes
deadline,"Essay 1",academic,YYYY-MM-DD,21,7,exponential,,,
placement,"Placement 1",clinical,,14,14,exponential,YYYY-MM-DD,YYYY-MM-DD,
term,"Year 1 - Term 1",,,,,,YYYY-MM-DD,YYYY-MM-DD,</pre>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <span class="mono-tag">All dates validated as ISO-8601 (YYYY-MM-DD)</span>
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn" data-action="close-bulk-modal">Cancel</button>
              <button type="button" class="btn btn-primary" data-action="execute-bulk-import">Parse &amp; Import Dataset</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function attachEventListeners() {
    const root = document.getElementById('root');
    if (!root) return;

    // Close modals on Escape key
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (
          state.editingDeadlineId ||
          state.editingTermId ||
          state.editingPlacementId
        ) {
          state.editingDeadlineId = null;
          state.editingTermId = null;
          state.editingPlacementId = null;
          renderApp();
        } else if (state.isBulkModalOpen) {
          state.isBulkModalOpen = false;
          renderApp();
        }
      }
    });

    // Double-click column resize handle to reset column widths to auto (1fr)
    root.addEventListener('dblclick', function (e) {
      const colResizeHandle = e.target.closest('[data-col-resize]');
      if (!colResizeHandle) return;
      e.preventDefault();
      e.stopPropagation();
      state.columnWidths = {
        academic: null,
        clinical: null,
        research: null,
        terms: null,
      };
      saveLocalCacheState();
      renderApp();
    });

    // Click delegation
    root.addEventListener('click', function (e) {
      // Backdrop clicks: only close if clicking directly on the backdrop element itself
      if (
        e.target &&
        e.target.getAttribute &&
        e.target.getAttribute('data-action') === 'close-edit-modal-backdrop'
      ) {
        state.editingDeadlineId = null;
        state.editingTermId = null;
        state.editingPlacementId = null;
        renderApp();
        return;
      }
      if (
        e.target &&
        e.target.getAttribute &&
        e.target.getAttribute('data-action') === 'close-bulk-modal-backdrop'
      ) {
        state.isBulkModalOpen = false;
        renderApp();
        return;
      }

      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');

      if (action === 'set-snap') {
        state.snapIncrementDays = Number(target.getAttribute('data-snap')) || 1;
        renderApp();
      } else if (action === 'toggle-deadline-curve') {
        e.stopPropagation();
        const dlId = target.getAttribute('data-deadline-id');
        let updatedItem = null;
        state.deadlines = state.deadlines.map(function (d) {
          if (d.id !== dlId) return d;
          const nextCurve =
            d.workloadCurve === 'linear' ? 'exponential' : 'linear';
          updatedItem = Object.assign({}, d, { workloadCurve: nextCurve });
          return updatedItem;
        });
        if (updatedItem) {
          syncSingleDeadlineToServer(updatedItem);
          renderApp();
        }
      } else if (action === 'toggle-placement-curve') {
        e.stopPropagation();
        const plId = target.getAttribute('data-placement-id');
        let updatedPl = null;
        state.clinicalPlacements = state.clinicalPlacements.map(function (p) {
          if (p.id !== plId) return p;
          const nextCurve =
            p.workloadCurve === 'linear' ? 'exponential' : 'linear';
          updatedPl = Object.assign({}, p, { workloadCurve: nextCurve });
          return updatedPl;
        });
        if (updatedPl) {
          syncSinglePlacementToServer(updatedPl);
          renderApp();
        }
      } else if (action === 'toggle-lanes') {
        state.splitOverlappingLanes = !state.splitOverlappingLanes;
        renderApp();
      } else if (action === 'toggle-add-drawer') {
        state.isAddDrawerOpen = !state.isAddDrawerOpen;
        renderApp();
      } else if (action === 'open-bulk-modal') {
        state.isBulkModalOpen = true;
        state.bulkFeedback = null;
        renderApp();
      } else if (action === 'close-bulk-modal') {
        state.isBulkModalOpen = false;
        renderApp();
      } else if (action === 'set-bulk-mode') {
        state.bulkModalMode = target.getAttribute('data-mode') || 'append';
        renderApp();
      } else if (action === 'load-current-json') {
        state.bulkTextValue = SchemaParser.serializeToJson(
          state.programmeStartYear,
          state.deadlines,
          state.terms,
          state.clinicalPlacements
        );
        state.bulkFeedback = null;
        renderApp();
      } else if (action === 'load-current-csv') {
        state.bulkTextValue = SchemaParser.serializeToCsv(
          state.deadlines,
          state.terms,
          state.clinicalPlacements
        );
        state.bulkFeedback = null;
        renderApp();
      } else if (action === 'download-json') {
        const json = SchemaParser.serializeToJson(
          state.programmeStartYear,
          state.deadlines,
          state.terms,
          state.clinicalPlacements
        );
        downloadFile(
          json,
          `ucl-programme-schedule-${state.programmeStartYear}-${state.programmeStartYear + 3}.json`,
          'application/json'
        );
      } else if (action === 'download-csv') {
        const csv = SchemaParser.serializeToCsv(
          state.deadlines,
          state.terms,
          state.clinicalPlacements
        );
        downloadFile(
          csv,
          `ucl-programme-schedule-${state.programmeStartYear}-${state.programmeStartYear + 3}.csv`,
          'text/csv'
        );
      } else if (action === 'execute-bulk-import') {
        const textarea = document.getElementById('bulk-textarea');
        if (textarea) state.bulkTextValue = textarea.value;
        const result = SchemaParser.parseScheduleDataset(state.bulkTextValue);

        if (result.errors.length > 0) {
          state.bulkFeedback = {
            type: 'error',
            lines: result.errors,
          };
          renderApp();
          return;
        }

        if (result.detectedStartYear !== undefined) {
          state.programmeStartYear = result.detectedStartYear;
        }

        if (state.bulkModalMode === 'replace') {
          state.deadlines = result.deadlines;
          state.terms = result.terms;
          if (
            Array.isArray(result.clinicalPlacements) &&
            result.clinicalPlacements.length > 0
          ) {
            state.clinicalPlacements = result.clinicalPlacements;
          }
        } else {
          const dlMap = new Map();
          state.deadlines.forEach(function (d) {
            dlMap.set(d.id, d);
          });
          result.deadlines.forEach(function (d) {
            dlMap.set(d.id, d);
          });
          state.deadlines = Array.from(dlMap.values());

          const termMap = new Map();
          state.terms.forEach(function (t) {
            termMap.set(t.id, t);
          });
          result.terms.forEach(function (t) {
            termMap.set(t.id, t);
          });
          state.terms = Array.from(termMap.values());

          if (
            Array.isArray(result.clinicalPlacements) &&
            result.clinicalPlacements.length > 0
          ) {
            const plMap = new Map();
            state.clinicalPlacements.forEach(function (p) {
              plMap.set(p.id, p);
            });
            result.clinicalPlacements.forEach(function (p) {
              plMap.set(p.id, p);
            });
            state.clinicalPlacements = Array.from(plMap.values());
          }
        }

        savePersistedState();
        state.bulkFeedback = {
          type: 'success',
          lines: [
            `Imported ${result.deadlines.length} deadline(s), ${
              result.clinicalPlacements ? result.clinicalPlacements.length : 0
            } placement(s), and ${result.terms.length} term block(s).`,
          ].concat(result.warnings),
        };
        renderApp();
      } else if (action === 'commit-save-state') {
        savePersistedState();
        renderApp();
      } else if (action === 'clear-all-state') {
        if (
          window.confirm(
            'Reset all modified deadlines and restore the default Academic, Clinical, and Research dataset for all LAN users?'
          )
        ) {
          state.deadlines = INITIAL_DEADLINES.slice();
          state.terms = INITIAL_UCL_TERMS.slice();
          state.clinicalPlacements = INITIAL_CLINICAL_PLACEMENTS.slice();
          state.deletedSeedIds = [];
          localStorage.removeItem(STORAGE_KEY);
          if (state.serverConnected) {
            apiRequest('POST', '/api/reset').then(function (resetState) {
              if (resetState) {
                applyServerState(resetState);
                renderApp();
              }
            });
          } else {
            saveLocalCacheState();
          }
          renderApp();
        }
      } else if (action === 'open-edit-deadline') {
        e.stopPropagation();
        state.editingDeadlineId = target.getAttribute('data-deadline-id');
        state.editingTermId = null;
        state.editingPlacementId = null;
        renderApp();
      } else if (action === 'open-edit-placement') {
        e.stopPropagation();
        state.editingPlacementId = target.getAttribute('data-placement-id');
        state.editingDeadlineId = null;
        state.editingTermId = null;
        renderApp();
      } else if (action === 'quick-delete-deadline') {
        e.stopPropagation();
        const id = target.getAttribute('data-deadline-id');
        if (id && !state.deletedSeedIds.includes(id)) {
          state.deletedSeedIds.push(id);
        }
        state.deadlines = state.deadlines.filter(function (d) {
          return d.id !== id;
        });
        if (state.editingDeadlineId === id) {
          state.editingDeadlineId = null;
        }
        syncDeleteDeadlineToServer(id);
        renderApp();
      } else if (action === 'open-edit-term') {
        e.stopPropagation();
        state.editingTermId = target.getAttribute('data-term-id');
        state.editingDeadlineId = null;
        state.editingPlacementId = null;
        renderApp();
      } else if (action === 'close-edit-modal') {
        e.stopPropagation();
        state.editingDeadlineId = null;
        state.editingTermId = null;
        state.editingPlacementId = null;
        renderApp();
      } else if (action === 'delete-deadline') {
        e.stopPropagation();
        const id =
          target.getAttribute('data-deadline-id') || state.editingDeadlineId;
        if (id && !state.deletedSeedIds.includes(id)) {
          state.deletedSeedIds.push(id);
        }
        state.deadlines = state.deadlines.filter(function (d) {
          return d.id !== id;
        });
        state.editingDeadlineId = null;
        syncDeleteDeadlineToServer(id);
        renderApp();
      } else if (action === 'delete-term') {
        e.stopPropagation();
        const id = target.getAttribute('data-term-id') || state.editingTermId;
        if (id && !state.deletedSeedIds.includes(id)) {
          state.deletedSeedIds.push(id);
        }
        state.terms = state.terms.filter(function (t) {
          return t.id !== id;
        });
        state.editingTermId = null;
        syncDeleteTermToServer(id);
        renderApp();
      }
    });

    // Input & Change delegation
    root.addEventListener('input', function (e) {
      const target = e.target;
      if (target.id === 'ctrl-px-per-day') {
        state.pxPerDay = Number(target.value) || 4;
        renderApp();
      } else if (target.id === 'bulk-textarea') {
        state.bulkTextValue = target.value;
      }
    });

    root.addEventListener('change', function (e) {
      const target = e.target;
      if (target.id === 'ctrl-start-year') {
        const val = Number(target.value);
        if (Number.isFinite(val) && val >= 2000 && val <= 2100) {
          state.programmeStartYear = Math.round(val);
          syncSettingsToServer();
          renderApp();
        }
      } else if (target.id === 'bulk-file-input') {
        const file = target.files && target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          state.bulkTextValue =
            typeof reader.result === 'string' ? reader.result : '';
          state.bulkFeedback = null;
          renderApp();
        };
        reader.readAsText(file);
      }
    });

    // Form submit delegation
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      const form = e.target;

      if (form.id === 'form-add-deadline') {
        const fd = new FormData(form);
        const title = String(fd.get('title') || '').trim();
        const domain = String(fd.get('domain') || 'academic');
        const dueDate = String(fd.get('dueDate') || '').trim();
        const rawPrep = Number(fd.get('prepValue'));
        const prepValue =
          Number.isFinite(rawPrep) && rawPrep >= 0 ? Math.round(rawPrep) : 14;
        const prepUnit = String(fd.get('prepUnit') || 'days');
        const rawPost = Number(fd.get('postValue'));
        const postValue =
          Number.isFinite(rawPost) && rawPost >= 0 ? Math.round(rawPost) : 0;
        const postUnit = String(fd.get('postUnit') || 'days');
        const workloadCurve =
          fd.get('workloadCurve') === 'linear' ? 'linear' : 'exponential';
        const notes = String(fd.get('notes') || '').trim();

        if (!title || Number.isNaN(DateMath.parseIsoToUtcMs(dueDate))) return;

        const prepDurationDays =
          prepUnit === 'weeks' ? prepValue * 7 : prepValue;
        const postDurationDays =
          postUnit === 'weeks' ? postValue * 7 : postValue;

        const newDeadline = {
          id: SchemaParser.generateId('dl'),
          title: title,
          domain: domain,
          dueDate: dueDate,
          prepDurationDays: prepDurationDays,
          postDurationDays: postDurationDays,
          workloadCurve: workloadCurve,
          notes: notes || undefined,
        };
        state.deadlines.push(newDeadline);

        state.formDeadlineTitle = '';
        state.formDeadlineDomain = domain;
        state.formDeadlineDueDate = dueDate;
        state.formDeadlinePrepValue = prepValue;
        state.formDeadlinePrepUnit = prepUnit;
        state.formDeadlinePostValue = postValue;
        state.formDeadlinePostUnit = postUnit;
        state.formDeadlineCurve = workloadCurve;
        state.formDeadlineNotes = '';

        syncSingleDeadlineToServer(newDeadline);
        renderApp();
      } else if (form.id === 'form-add-term') {
        const fd = new FormData(form);
        const name = String(fd.get('termName') || '').trim();
        const startDate = String(fd.get('startDate') || '').trim();
        const endDate = String(fd.get('endDate') || '').trim();

        const startMs = DateMath.parseIsoToUtcMs(startDate);
        const endMs = DateMath.parseIsoToUtcMs(endDate);
        if (!name || Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
          return;
        }

        const newTerm = {
          id: SchemaParser.generateId('term'),
          name: name,
          startDate: startDate,
          endDate: endDate,
        };
        state.terms.push(newTerm);

        state.formTermName = '';
        state.formTermStartDate = startDate;
        state.formTermEndDate = endDate;

        syncSingleTermToServer(newTerm);
        renderApp();
      } else if (form.id === 'form-edit-deadline') {
        const fd = new FormData(form);
        const title = String(fd.get('title') || '').trim();
        const domain = String(fd.get('domain') || 'academic');
        const dueDate = String(fd.get('dueDate') || '').trim();
        const rawPrep = Number(fd.get('prepDurationDays'));
        const prepDurationDays =
          Number.isFinite(rawPrep) && rawPrep >= 0 ? Math.round(rawPrep) : 0;
        const rawPost = Number(fd.get('postDurationDays'));
        const postDurationDays =
          Number.isFinite(rawPost) && rawPost >= 0 ? Math.round(rawPost) : 0;
        const workloadCurve =
          fd.get('workloadCurve') === 'linear' ? 'linear' : 'exponential';
        const notes = String(fd.get('notes') || '').trim();

        let updatedDeadline = null;
        state.deadlines = state.deadlines.map(function (d) {
          if (d.id !== state.editingDeadlineId) return d;
          updatedDeadline = {
            id: d.id,
            title: title || d.title,
            domain: domain,
            dueDate: dueDate || d.dueDate,
            prepDurationDays: prepDurationDays,
            postDurationDays: postDurationDays,
            workloadCurve: workloadCurve,
            notes: notes || undefined,
          };
          return updatedDeadline;
        });

        state.editingDeadlineId = null;
        syncSingleDeadlineToServer(updatedDeadline);
        renderApp();
      } else if (form.id === 'form-edit-placement') {
        const fd = new FormData(form);
        const name = String(fd.get('name') || '').trim();
        const startDate = String(fd.get('startDate') || '').trim();
        const endDate = String(fd.get('endDate') || '').trim();
        const rawStartLoad = Number(fd.get('startLoadDays'));
        const startLoadDays =
          Number.isFinite(rawStartLoad) && rawStartLoad >= 0
            ? Math.round(rawStartLoad)
            : 0;
        const rawEndLoad = Number(fd.get('endLoadDays'));
        const endLoadDays =
          Number.isFinite(rawEndLoad) && rawEndLoad >= 0
            ? Math.round(rawEndLoad)
            : 0;
        const workloadCurve =
          fd.get('workloadCurve') === 'linear' ? 'linear' : 'exponential';
        const notes = String(fd.get('notes') || '').trim();

        let updatedPlacement = null;
        state.clinicalPlacements = state.clinicalPlacements.map(function (p) {
          if (p.id !== state.editingPlacementId) return p;
          updatedPlacement = {
            id: p.id,
            name: name || p.name,
            startDate: startDate || p.startDate,
            endDate: endDate || p.endDate,
            startLoadDays: startLoadDays,
            endLoadDays: endLoadDays,
            workloadCurve: workloadCurve,
            notes: notes || undefined,
          };
          return updatedPlacement;
        });

        state.editingPlacementId = null;
        syncSinglePlacementToServer(updatedPlacement);
        renderApp();
      } else if (form.id === 'form-edit-term') {
        const fd = new FormData(form);
        const name = String(fd.get('name') || '').trim();
        const startDate = String(fd.get('startDate') || '').trim();
        const endDate = String(fd.get('endDate') || '').trim();

        let updatedTerm = null;
        state.terms = state.terms.map(function (t) {
          if (t.id !== state.editingTermId) return t;
          updatedTerm = {
            id: t.id,
            name: name || t.name,
            startDate: startDate || t.startDate,
            endDate: endDate || t.endDate,
          };
          return updatedTerm;
        });

        state.editingTermId = null;
        syncSingleTermToServer(updatedTerm);
        renderApp();
      }
    });

    // Pointer-event vertical drag-and-drop, prep/post/placement workload resizing, column width resizing & Macro Heatmap Scrubbing
    root.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;

      // 0. Check if dragging a column width resize handle
      const colResizeHandle = e.target.closest('[data-col-resize]');
      if (colResizeHandle) {
        const colKey = colResizeHandle.getAttribute('data-col-resize');
        const headerCell =
          document.querySelector('[data-col-header="' + colKey + '"]') ||
          colResizeHandle.closest('.domain-header-cell, .timeline-column');
        if (colKey && headerCell) {
          e.preventDefault();
          e.stopPropagation();

          // Snapshot all 4 columns' current rendered pixel widths so resizing one column
          // moves its right border 1:1 with the cursor without causing other columns to shift/grow.
          ['academic', 'clinical', 'research', 'terms'].forEach(function (k) {
            if (typeof state.columnWidths[k] !== 'number') {
              const el = document.querySelector('[data-col-header="' + k + '"]');
              if (el) {
                state.columnWidths[k] = Math.max(
                  120,
                  Math.round(el.getBoundingClientRect().width)
                );
              }
            }
          });

          const startClientX = e.clientX;
          const initialWidth =
            state.columnWidths[colKey] ||
            Math.round(headerCell.getBoundingClientRect().width);
          state.colResizeOp = { colKey: colKey };
          colResizeHandle.classList.add('is-resizing');

          function onColResizeMove(moveEvent) {
            const deltaX = moveEvent.clientX - startClientX;
            const nextWidth = Math.max(
              120,
              Math.min(1200, Math.round(initialWidth + deltaX))
            );
            state.columnWidths[colKey] = nextWidth;
            const gridCss = buildGridTemplateColumnsCss();
            const minWidthEl = document.querySelector('.timeline-minwidth');
            const headerGrid = document.querySelector('.sticky-column-headers');
            const bodyGrid = document.querySelector('.timeline-body-grid');
            if (minWidthEl) {
              minWidthEl.style.cssText = buildTimelineMinWidthCss();
            }
            if (headerGrid) headerGrid.style.gridTemplateColumns = gridCss;
            if (bodyGrid) bodyGrid.style.gridTemplateColumns = gridCss;
          }

          function onColResizeUp() {
            state.colResizeOp = null;
            colResizeHandle.classList.remove('is-resizing');
            window.removeEventListener('pointermove', onColResizeMove);
            window.removeEventListener('pointerup', onColResizeUp);
            window.removeEventListener('pointercancel', onColResizeUp);
            saveLocalCacheState();
            renderApp();
          }

          window.addEventListener('pointermove', onColResizeMove);
          window.addEventListener('pointerup', onColResizeUp);
          window.addEventListener('pointercancel', onColResizeUp);
          return;
        }
      }

      // 1. Check if clicking or dragging inside the Right-Hand 3-Year Macro Heatmap Canvas
      const macroCanvas = e.target.closest('#macro-heatmap-canvas');
      if (macroCanvas) {
        e.preventDefault();
        scrubViewportFromMacroEvent(e.clientY);

        function onMacroMove(moveEvent) {
          scrubViewportFromMacroEvent(moveEvent.clientY);
        }
        function onMacroUp() {
          window.removeEventListener('pointermove', onMacroMove);
          window.removeEventListener('pointerup', onMacroUp);
          window.removeEventListener('pointercancel', onMacroUp);
        }
        window.addEventListener('pointermove', onMacroMove);
        window.addEventListener('pointerup', onMacroUp);
        window.addEventListener('pointercancel', onMacroUp);
        return;
      }

      // Ignore clicks on edit/delete buttons inside cards
      if (e.target.closest('[data-action]')) return;

      // 2. Check if dragging a Clinical Placement Start or End Workload handle
      const plStartHandle = e.target.closest(
        '[data-drag-role="resize-placement-start"]'
      );
      const plEndHandle = e.target.closest(
        '[data-drag-role="resize-placement-end"]'
      );
      if (plStartHandle || plEndHandle) {
        const plHandleEl = plStartHandle || plEndHandle;
        const placementId = plHandleEl.getAttribute('data-placement-id');
        const plItem = state.clinicalPlacements.find(function (p) {
          return p.id === placementId;
        });
        if (!plItem) return;

        e.preventDefault();
        e.stopPropagation();

        state.dragOp = {
          placementId: plItem.id,
          mode: plStartHandle
            ? 'resize-placement-start'
            : 'resize-placement-end',
          startClientY: e.clientY,
          initialStartLoadDays:
            plItem.startLoadDays !== undefined
              ? Number(plItem.startLoadDays)
              : 14,
          initialEndLoadDays:
            plItem.endLoadDays !== undefined ? Number(plItem.endLoadDays) : 14,
        };

        renderApp();
        return;
      }

      // 3. Check if dragging a Deadline card or Prep/Post workload handle
      const resizePrepHandle = e.target.closest('[data-drag-role="resize-prep"]');
      const resizePostHandle = e.target.closest('[data-drag-role="resize-post"]');
      const shiftHandle = e.target.closest('[data-drag-role="shift-due"]');

      const handleEl = resizePrepHandle || resizePostHandle || shiftHandle;
      if (!handleEl) return;

      const deadlineId = handleEl.getAttribute('data-deadline-id');
      const item = state.deadlines.find(function (d) {
        return d.id === deadlineId;
      });
      if (!item) return;

      e.preventDefault();
      e.stopPropagation();

      state.dragOp = {
        deadlineId: item.id,
        mode: resizePrepHandle
          ? 'resize-prep'
          : resizePostHandle
          ? 'resize-post'
          : 'shift-due',
        startClientY: e.clientY,
        initialDueDay: DateMath.dateToDayOffset(
          item.dueDate,
          state.programmeStartYear
        ),
        initialPrepDays:
          item.prepDurationDays !== undefined ? Number(item.prepDurationDays) : 14,
        initialPostDays: Number(item.postDurationDays) || 0,
      };

      renderApp();
    });

    window.addEventListener('pointermove', function (e) {
      if (!state.dragOp) return;
      const op = state.dragOp;
      const deltaY = e.clientY - op.startClientY;
      const rawDeltaDays = deltaY / state.pxPerDay;
      const snap = state.snapIncrementDays;
      const snappedDeltaDays = Math.round(rawDeltaDays / snap) * snap;

      let changed = false;

      if (op.placementId) {
        state.clinicalPlacements = state.clinicalPlacements.map(function (p) {
          if (p.id !== op.placementId) return p;

          if (op.mode === 'resize-placement-start') {
            const nextStartLoad = Math.max(
              0,
              Math.min(365, op.initialStartLoadDays + snappedDeltaDays)
            );
            const curStartLoad =
              p.startLoadDays !== undefined ? Number(p.startLoadDays) : 14;
            if (nextStartLoad !== curStartLoad) {
              changed = true;
              return Object.assign({}, p, { startLoadDays: nextStartLoad });
            }
            return p;
          } else {
            const nextEndLoad = Math.max(
              0,
              Math.min(365, op.initialEndLoadDays - snappedDeltaDays)
            );
            const curEndLoad =
              p.endLoadDays !== undefined ? Number(p.endLoadDays) : 14;
            if (nextEndLoad !== curEndLoad) {
              changed = true;
              return Object.assign({}, p, { endLoadDays: nextEndLoad });
            }
            return p;
          }
        });

        if (changed) {
          renderApp();
        }
        return;
      }

      state.deadlines = state.deadlines.map(function (d) {
        if (d.id !== op.deadlineId) return d;

        if (op.mode === 'shift-due') {
          const nextDueDay = DateMath.clampDayOffset(
            op.initialDueDay + snappedDeltaDays,
            state.programmeStartYear
          );
          const nextIso = DateMath.dayOffsetToDate(
            nextDueDay,
            state.programmeStartYear
          );
          if (nextIso !== d.dueDate) {
            changed = true;
            return Object.assign({}, d, { dueDate: nextIso });
          }
          return d;
        } else if (op.mode === 'resize-prep') {
          const nextPrep = Math.max(
            0,
            Math.min(365, op.initialPrepDays - snappedDeltaDays)
          );
          if (nextPrep !== d.prepDurationDays) {
            changed = true;
            return Object.assign({}, d, { prepDurationDays: nextPrep });
          }
          return d;
        } else {
          const nextPost = Math.max(
            0,
            Math.min(365, op.initialPostDays + snappedDeltaDays)
          );
          if (nextPost !== (Number(d.postDurationDays) || 0)) {
            changed = true;
            return Object.assign({}, d, { postDurationDays: nextPost });
          }
          return d;
        }
      });

      if (changed) {
        renderApp();
      }
    });

    window.addEventListener('pointerup', function () {
      if (!state.dragOp) return;
      if (state.dragOp.placementId) {
        const draggedPlId = state.dragOp.placementId;
        state.dragOp = null;
        const updatedPlacement = state.clinicalPlacements.find(function (p) {
          return p.id === draggedPlId;
        });
        syncSinglePlacementToServer(updatedPlacement);
        renderApp();
        return;
      }

      const draggedId = state.dragOp.deadlineId;
      state.dragOp = null;
      const updatedItem = state.deadlines.find(function (d) {
        return d.id === draggedId;
      });
      syncSingleDeadlineToServer(updatedItem);
      renderApp();
    });
  }

  function init() {
    initPersistenceAndLanSync();
    renderApp();
    attachEventListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
