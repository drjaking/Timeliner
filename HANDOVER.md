# Antigravity Handover & Project Context Summary — `Timeliner`

> **How to use this document in a second Antigravity instance:**
> Clone the repository and either paste this file into your first prompt or instruct Antigravity:
> *"Read `HANDOVER.md` to restore full context of the UCL Longitudinal Programme Curriculum & Deadline Sequencer project, then continue development from here."*

---

## 1. Project Objective & Core Design Constraints

We are building a formal, light-themed web application for longitudinal academic course planning across a three-year programme (**01 September 2026 through 30 September 2029**, 1,126 days / 161 weeks). The application sequences deadlines across three programme domains (**Academic**, **Clinical**, and **Research**) alongside **UCL Term Dates** to identify and mitigate preparation workload collisions.

### Strict Aesthetic & Architectural Rules
1. **Utilitarian Academic Light Theme Only**:
   - Background canvas: `#F8FAFC` (Alabaster / Crisp Off-White), Panels: `#FFFFFF`, Subtle fills: `#F1F5F9`
   - Primary typography: `#1E293B` (High-contrast Slate/Charcoal), Secondary: `#475569`, Muted: `#64748B`
   - Muted gridlines: `#E2E8F0`, Strong borders: `#CBD5E1`
   - Domain color palettes:
     - **Column 01 — Academic**: Deep Navy / Slate Blue (`#1E40AF`, RGB `30, 64, 175`)
     - **Column 02 — Clinical**: Teal / Forest Green (`#0F766E`, RGB `15, 118, 110`)
     - **Column 03 — Research**: Burgundy / Ochre (`#991B1B`, RGB `153, 27, 27`)
     - **Column 04 — UCL Term Dates**: Slate (`#334155`) for terms, Amber (`#B45309` / `#FEF3C7`) for Reading Weeks, Dashed Slate (`#94A3B8`) for Vacations/Closures.
   - No dark mode, no neon accents, no playful animations.
2. **Vertical Timeline Orientation**:
   - Time flows vertically from top to bottom starting at **01 September 2026 (`Y = 0`)** through **30 September 2029** (extended through end of September of Year 3 to accommodate final Viva Voce & Placement 6 completion).
   - All date math uses **UTC midnight (`Date.UTC`)** so UK BST/GMT Daylight Saving transitions never introduce 1-hour rounding drift.
3. **Zero-Dependency Browser Runtime (Primary Active Codebase)**:
   - Because the initial workstation did not have `npm` on the system `PATH`, the application runs directly in the browser from `index.html` using:
     - `index.html`
     - `styles.css`
     - `src/dateMath.js` (`window.TimelinerDateMath`)
     - `src/schemaParser.js` (`window.TimelinerSchemaParser`)
     - `src/app.js` (Main state, seeded datasets, DOM renderer, pointer-event handlers, `localStorage` persistence)
   - *(Note: There are also early TypeScript files under `src/*.tsx` and `src/utils/*.ts` from initial scaffolding, but **`index.html` + `styles.css` + `src/dateMath.js` + `src/schemaParser.js` + `src/app.js`** is the live, authoritative application.)*

---

## 2. Visual & Interactive Features Implemented

1. **Synchronized 4-Column Vertical Grid + Sticky Left Time Axis (`196px`)**:
   - **Sticky Left Axis**: Displays Programme Year bands (`YEAR 1`, `YEAR 2`, `YEAR 3`), Month boundaries (`Sep 2026` – `Sep 2029`), and Weekly tick rows (`W1`–`W52`) with a **Cross-Column Load Heat-Strip** (`A·C·R` domain pips + concurrent active prep count badge).
   - **Column 01 (`Academic`)**, **Column 02 (`Clinical`)**, **Column 03 (`Research`)**, **Column 04 (`UCL Term Dates`)**.
2. **Composite Deadline Visual Encoding**:
   - **Deadline Anchor**: Solid horizontal bar + card anchored at $Y_{\text{due}} = \text{dayOffset}(\text{dueDate}) \times \text{pxPerDay}$.
   - **Preparation Tail**: Vertical rectangular region stretching upward from $Y_{\text{due}}$ to $Y_{\text{start}} = Y_{\text{due}} - \text{prepDurationDays} \times \text{pxPerDay}$, rendered with a CSS `linear-gradient` (top-to-bottom opacity from `0.03` at $Y_{\text{start}}$ to `0.75` at $Y_{\text{due}}$; toggleable between Linear and Exponential curves).
   - **Intra-Column Lane Splitting**: Overlapping preparation windows within the same domain automatically split into side-by-side sub-lanes (toggleable via the `Lanes: Split` control).
3. **Interactive Pointer-Event Manipulation**:
   - **Vertical Drag-and-Drop Rescheduling**: Grab any deadline card or preparation tail (`data-drag-role="shift-due"`) and drag vertically to shift `dueDate`, snapping to **1-day (`1d`)** or **1-week (`1w`)** increments with a floating real-time HUD banner at the bottom of the screen.
   - **Preparation Window Top-Edge Resizing**: Grab the top handle (`data-drag-role="resize-prep"`) of any preparation tail and drag vertically to lengthen or shorten `prepDurationDays` (`1` to `365` days).
4. **Immovable Clinical Placement Background Blocks**:
   - **Placements 1–6** are rendered in the **Clinical** column as locked, non-draggable hatched background blocks (`pointer-events: none; z-index: 2`) and are **excluded** from the preparation workload heat-strip calculations.
   - The **Placement Contracts** (`7d` prep) and **MPR-EPR Form & Clinical Portfolio** submissions (`14d` prep) are rendered on top as standard draggable/resizable Clinical deadlines.
5. **Right-Hand 3-Year Compressed Macro Workload Heatmap Panel (`184px` wide)**:
   - Docked to the right of the main scrollable viewport (`.macro-heatmap-panel`), compressing all **161 weeks** of the 3-year programme into 100% of the vertical screen height without scrolling.
   - Displays Year markers (`Y1`, `Y2`, `Y3`), quarterly month ticks, 3 domain activity micro-columns (`A · C · R`), and horizontal weekly workload intensity bars (`#64748B` for 1 item, `#1E40AF` for 2 items, `#D97706` for 2-domain collision / 3+ items, `#991B1B` for 3-domain collision).
   - Includes a synchronized **Viewport Lens** (`#macro-viewport-lens`) and supports **click-and-drag vertical scrubbing** to jump immediately to any week across the 3-year timeline.
6. **CRUD, Modal Editing, Deletion & Persistence**:
   - **Edit & Delete**: Clicking `✎` on any deadline card (or clicking any UCL Term block) opens the Edit Modal with working **Save Changes**, **Delete**, **Cancel**, **Close**, backdrop-click, and `Esc` key handlers. Each deadline card also has a direct **`×` quick-delete** button.
   - **Local Storage Persistence (`ucl_longitudinal_programme_sequencer_v1`)**:
     - Every edit, addition, deletion, drag reschedule, or prep-window resize auto-saves immediately to `localStorage`.
     - Tracks `deletedSeedIds` so deleted default items are **never** re-inserted on page reload.
     - Includes an explicit **`✓ Saved HH:MM:SS` (`Commit / Save`)** button in the top toolbar and a **`Reset`** button (with confirmation) to restore the default dataset.
   - **Bulk Import / Export Modal**: Supports pasting or uploading `.json` or `.csv` schedules (in `Append / Update` or `Replace All` mode) and exporting/downloading the current sequenced schedule as `.json` or `.csv`.

---

## 3. Complete Seeded Dataset (2026 Intake Cohort Projected Across Years 1–3)

### Cohort Projection Methodology
The user provided 2026/27 programme handbook deadlines by cohort intake (`2026 Intake` = Year 1, `2025 Intake` = Year 2, `2024 Intake` = Year 3). To map a single longitudinal cohort starting in **September 2026** across all three years while preserving exact days of the week (e.g., Friday submission deadlines):
- **2026 Intake items** map directly to **Year 1 (`2026/27`)**.
- **2025 Intake items** are projected forward **+52 weeks (+364 days)** into **Year 2 (`2027/28`)**.
- **2024 Intake items** are projected forward **+104 weeks (+728 days)** into **Year 3 (`2028/29`)**.

### A. Academic Deadlines (7 items — `INITIAL_ACADEMIC_DEADLINES`)
| ID | Title | Due Date | Prep Days | Notes / Origin |
|---|---|---|---|---|
| `acad-y1-cr1-2027-01-29` | Clinical Report 1 | `2027-01-29` | `28` | 2026 Intake (Y1) — Fri 29 Jan 2027 |
| `acad-y1-cr2-2027-04-16` | Clinical Report 2 | `2027-04-16` | `28` | 2026 Intake (Y1) — 10am, Fri 16 Apr 2027 |
| `acad-y1-exam1-2027-05-17` | Exam Paper 1 | `2027-05-17` | `21` | 2026 Intake (Y1) — Mon 17 May 2027 |
| `acad-y1-exam2-2027-05-18` | Exam Paper 2 | `2027-05-18` | `21` | 2026 Intake (Y1) — Tue 18 May 2027 |
| `acad-y2-cr3-2027-11-12` | Clinical Report 3 | `2027-11-12` | `28` | Year 2 (+52w from 2025 Intake: Fri 13 Nov 2026 → Fri 12 Nov 2027) |
| `acad-y2-exam3-2028-05-17` | Exam Paper 3 | `2028-05-17` | `21` | Year 2 (+52w from 2025 Intake: Wed 19 May 2027 → Wed 17 May 2028) |
| `acad-y3-cr4-2028-10-06` | Clinical Report 4 | `2028-10-06` | `28` | Year 3 (+104w from 2024 Intake: Fri 09 Oct 2026 → Fri 06 Oct 2028) |

### B. Immovable Clinical Placement Blocks (6 locked spans — `INITIAL_CLINICAL_PLACEMENTS`)
| ID | Name | Start Date | End Date | Notes |
|---|---|---|---|---|
| `clin-pl-y1-p1` | Placement 1 (Y1) | `2026-10-28` | `2027-04-09` | 2026 Intake — Wed 28 Oct 2026 to Fri 09 Apr 2027 |
| `clin-pl-y1-p2` | Placement 2 (Y1) | `2027-04-12` | `2027-10-01` | 2026 Intake — Mon 12 Apr 2027 to Fri 01 Oct 2027 |
| `clin-pl-y2-p3` | Placement 3 (Y2) | `2027-10-04` | `2028-03-31` | Year 2 (+52w from 2025 Intake: Mon 05 Oct 2026 – Fri 02 Apr 2027) |
| `clin-pl-y2-p4` | Placement 4 (Y2) | `2028-04-03` | `2028-09-29` | Year 2 (+52w from 2025 Intake: Mon 05 Apr 2027 – Fri 01 Oct 2027) |
| `clin-pl-y3-p5` | Placement 5 (Y3) | `2028-10-02` | `2029-03-23` | Year 3 (+104w from 2024 Intake: Mon 05 Oct 2026 – Fri 26 Mar 2027) |
| `clin-pl-y3-p6` | Placement 6 (Y3) | `2029-03-26` | `2029-09-17` | Year 3 (+104w from 2024 Intake: Mon 29 Mar 2027 – Mon 20 Sep 2027) |

### C. Clinical Submission Deadlines (12 items — `INITIAL_CLINICAL_DEADLINES`)
- **Placement Contracts (`7d` prep)**:
  - Placement 1 Contract: `2026-11-13`
  - Placement 2 Contract: `2027-04-30`
  - Placement 3 Contract: `2027-10-22` (+52w from `2026-10-23`)
  - Placement 4 Contract: `2028-04-21` (+52w from `2027-04-23`)
  - Placement 5 Contract: `2028-11-20` (+104w from `2026-11-23`)
  - Placement 6 Contract: `2029-04-13` (+104w from `2027-04-16`)
- **MPR-EPR Form & Clinical Portfolios (`14d` prep)**:
  - Placement 1 MPR-EPR & Clinical Portfolio: `2027-04-16`
  - Placement 2 MPR-EPR & Clinical Portfolio: `2027-10-08`
  - Placement 3 MPR-EPR & Clinical Portfolio: `2028-04-07` (+52w from `2027-04-09`)
  - Placement 4 MPR-EPR & Clinical Portfolio: `2028-10-06` (+52w from `2027-10-08`)
  - Placement 5 MPR-EPR & Clinical Portfolio: `2029-03-30` (+104w from `2027-04-02`)
  - Placement 6 MPR-EPR & Clinical Portfolio: `2029-09-14` (+104w from `2027-09-17`)

### D. Research Deadlines (14 items — `INITIAL_RESEARCH_DEADLINES`)
- **Committee Meetings**: Autumn (`2026-11-13`, `14d`), Spring (`2027-05-07`, `14d`)
- **Year 1 (`2026/27`)**: Project Orientation Session (`2027-02-04`, `7d`), Statement of Intent (`2027-05-06`, `21d`), Research Proposal (`2027-07-09`, `35d`)
- **Year 2 (`2027/28`, +52w)**: Research Funding (`2027-12-03`, `21d`), Progress Review & Research Log Y2T2 (`2028-02-11`, `14d`), Second Six-Monthly Progress Review & Research Log Y2T3 (`2028-06-30`, `14d`), Literature Review Searches (`2028-09-08`, `28d`)
- **Year 3 (`2028/29`, +104w)**: Literature Review (`2028-11-17`, `42d`), Third Six-Monthly Progress Review Y3T2 (`2029-01-26`, `14d`), Title and Abstract (`2029-03-02`, `14d`), Thesis Volume 1 Submission (`2029-06-08`, `60d`), Vivas July–September Window (`2029-08-31`, `60d`)

### E. Official UCL Term Dates (24 blocks — `INITIAL_UCL_TERMS`)
- Sourced from `https://www.ucl.ac.uk/study/current-students/life-ucl/term-dates-and-closures` covering Term 1, Term 1 Reading Week, Winter Closure, Term 2, Term 2 Reading Week, Spring/Easter Vacation, Term 3, and Summer Vacation across **2026/27**, **2027/28**, and **2028/29**.
