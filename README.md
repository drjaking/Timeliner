# UCL Longitudinal Programme Curriculum & Deadline Sequencer (`Timeliner`)

A formal, utilitarian, light-themed web application for longitudinal academic course planning across a three-year doctoral/clinical programme (**01 September 2026 – 30 September 2029**, 1,126 days / 161 weeks).

The application visualizes and sequences deadlines across three distinct programme domains—**Academic**, **Clinical**, and **Research**—alongside official **UCL Term Dates** and **Immovable Clinical Placements**, with a sticky left weekly load heat-strip and a right-hand **3-Year Compressed Macro Workload Heatmap Panel**.

---

## Quick Start

### Option A: Shared LAN Web Server + SQLite Database (Recommended for Multi-User LAN)
Runs with **zero external npm dependencies** (~25 MB RAM, 0% idle CPU) using Node.js's built-in `node:http` and `node:sqlite` (WAL mode) plus real-time Server-Sent Events (SSE) synchronization across all connected LAN browsers:

1. Double-click **`start-server.bat`** (or run `npm start` / `node --no-warnings --experimental-sqlite server.cjs`).
2. The console prints both the local URL (`http://localhost:3000`) and your desktop's **LAN URL** (e.g., `http://192.168.1.132:3000`).
3. Share the LAN URL with colleagues on the local network. Every drag-and-drop reschedule, preparation window resize, addition, deletion, or bulk import is immediately committed to `data/timeliner.db` and broadcast live to all open browsers.

### Option B: Standalone Direct Browser Execution (Offline Fallback)
If opened directly from disk (`file:///.../index.html`) without the server running, the application automatically falls back to `localStorage` caching:
- **`server.cjs`** — Lightweight zero-dependency Node.js HTTP + SSE + SQLite (`data/timeliner.db`) server.
- **`index.html`** — Entry point loading `styles.css`, `src/dateMath.js`, `src/schemaParser.js`, `src/seedData.js`, and `src/app.js`.
- **`styles.css`** — Complete utilitarian light-theme stylesheet (`#F8FAFC` canvas, `#1E293B` typography, `#E2E8F0` gridlines).
- **`src/seedData.js`** — Shared UCL 3-year seeded dataset (33 deadlines, 24 UCL term blocks, 6 immovable clinical placements) used by both the SQLite database initializer and browser fallback.
- **`src/dateMath.js`** — UTC midnight date-to-Y-coordinate math, month/year boundary generators, weekly concurrent preparation load calculator, and intra-column overlapping lane layout engine.
- **`src/schemaParser.js`** — JSON and CSV bulk import parser, validator, and exporter.
- **`src/app.js`** — Full interactive application controller, real-time SSE + REST SQLite synchronization, pointer-event vertical drag-and-drop rescheduling, preparation window top-edge resizing, modal CRUD, and right-hand 3-year macro heatmap scrubber.

See [`HANDOVER.md`](./HANDOVER.md) for full architectural and dataset details.
