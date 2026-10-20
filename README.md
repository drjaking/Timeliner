# UCL Longitudinal Programme Curriculum & Deadline Sequencer (`Timeliner`)

A formal, utilitarian, light-themed web application for longitudinal academic course planning across a three-year doctoral/clinical programme (**01 September 2026 – 30 September 2029**, 1,126 days / 161 weeks).

The application visualizes and sequences deadlines across three distinct programme domains—**Academic**, **Clinical**, and **Research**—alongside official **UCL Term Dates** and **Immovable Clinical Placements**, with a sticky left weekly load heat-strip and a right-hand **3-Year Compressed Macro Workload Heatmap Panel**.

---

## Quick Start

### Option A: Zero-Dependency Direct Browser Execution (Active Runtime)
No build step or Node.js installation is required. Open `index.html` directly in any modern browser:
- **`index.html`** — Entry point loading `styles.css`, `src/dateMath.js`, `src/schemaParser.js`, and `src/app.js`.
- **`styles.css`** — Complete utilitarian light-theme stylesheet (`#F8FAFC` canvas, `#1E293B` typography, `#E2E8F0` gridlines).
- **`src/dateMath.js`** — UTC midnight date-to-Y-coordinate math, month/year boundary generators, weekly concurrent preparation load calculator, and intra-column overlapping lane layout engine.
- **`src/schemaParser.js`** — JSON and CSV bulk import parser, validator, and exporter.
- **`src/app.js`** — Full interactive application controller, seeded UCL dataset, pointer-event vertical drag-and-drop rescheduling, preparation window top-edge resizing, modal CRUD, `localStorage` persistence, and right-hand 3-year macro heatmap scrubber.

### Option B: Vite + React + TypeScript Scaffold
If developing on a machine with Node.js / `npm` installed, a parallel React + TypeScript scaffold is also included (`package.json`, `vite.config.ts`, `src/*.tsx`), though **`index.html` + `src/app.js` is the primary up-to-date runtime**. See [`HANDOVER.md`](./HANDOVER.md) for full architectural and dataset details.
