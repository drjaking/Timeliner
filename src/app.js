/**
 * Longitudinal Academic, Clinical & Research Course Planning Application
 * Pure reactive controller with pointer-event drag-and-drop, prep duration resizing,
 * cross-column weekly load heat-strip, right-hand 3-year compressed macro workload heatmap,
 * and JSON/CSV bulk ingestion.
 */
(function (global) {
  const DateMath = global.TimelinerDateMath;
  const SchemaParser = global.TimelinerSchemaParser;

  const STORAGE_KEY = 'ucl_longitudinal_programme_sequencer_v1';

  /**
   * User-supplied Research Deadlines & Committee Meetings (Cohort starting Sept 2026).
   * - Intake 2026 items map directly to Year 1 (2026/27).
   * - Intake 2025 items are projected +52 weeks (364 days, preserving Friday) into Year 2 (2027/28).
   * - Intake 2024 items are projected +104 weeks (728 days, preserving Friday) into Year 3 (2028/29).
   */
  const INITIAL_RESEARCH_DEADLINES = [
    // Research Committee Meetings (2026/27)
    {
      id: 'res-comm-2026-11-13',
      title: 'Research Committee Meeting (Autumn)',
      domain: 'research',
      dueDate: '2026-11-13',
      prepDurationDays: 14,
      notes: 'Research Committee Meeting Date — Friday 13 November 2026',
    },
    {
      id: 'res-comm-2027-05-07',
      title: 'Research Committee Meeting (Spring)',
      domain: 'research',
      dueDate: '2027-05-07',
      prepDurationDays: 14,
      notes: 'Research Committee Meeting Date — Friday 7 May 2027',
    },

    // Year 1 (2026/27) — Intake 2026
    {
      id: 'res-y1-orientation-2027-02-04',
      title: 'Project Orientation Session',
      domain: 'research',
      dueDate: '2027-02-04',
      prepDurationDays: 7,
      notes: 'Intake 2026 (Y1) — Thursday 4 February 2027',
    },
    {
      id: 'res-y1-soi-2027-05-06',
      title: 'Statement of Intent',
      domain: 'research',
      dueDate: '2027-05-06',
      prepDurationDays: 21,
      notes: 'Intake 2026 (Y1) — Thursday 6 May 2027',
    },
    {
      id: 'res-y1-proposal-2027-07-09',
      title: 'Research Proposal',
      domain: 'research',
      dueDate: '2027-07-09',
      prepDurationDays: 35,
      notes: 'Intake 2026 (Y1) — Friday 9 July 2027',
    },

    // Year 2 (2027/28) — Projected from Intake 2025 (+52 weeks, preserving Friday)
    {
      id: 'res-y2-funding-2027-12-03',
      title: 'Research Funding',
      domain: 'research',
      dueDate: '2027-12-03',
      prepDurationDays: 21,
      notes: 'Year 2 (+52w from Intake 2025: Fri 4 Dec 2026 -> Fri 3 Dec 2027)',
    },
    {
      id: 'res-y2-review1-2028-02-11',
      title: 'Progress Review & Research Log (Y2T2)',
      domain: 'research',
      dueDate: '2028-02-11',
      prepDurationDays: 14,
      notes: 'Year 2 (+52w from Intake 2025: Fri 12 Feb 2027 -> Fri 11 Feb 2028)',
    },
    {
      id: 'res-y2-review2-2028-06-30',
      title: 'Second Six-Monthly Progress Review & Research Log (Y2T3)',
      domain: 'research',
      dueDate: '2028-06-30',
      prepDurationDays: 14,
      notes: 'Year 2 (+52w from Intake 2025: Fri 2 Jul 2027 -> Fri 30 Jun 2028)',
    },
    {
      id: 'res-y2-litsearch-2028-09-08',
      title: 'Literature Review Searches',
      domain: 'research',
      dueDate: '2028-09-08',
      prepDurationDays: 28,
      notes: 'Year 2/3 transition (+52w from Intake 2025: Fri 10 Sep 2027 -> Fri 8 Sep 2028)',
    },

    // Year 3 (2028/29) — Projected from Intake 2024 (+104 weeks, preserving Friday)
    {
      id: 'res-y3-litreview-2028-11-17',
      title: 'Literature Review',
      domain: 'research',
      dueDate: '2028-11-17',
      prepDurationDays: 42,
      notes: 'Year 3 (+104w from Intake 2024: Fri 20 Nov 2026 -> Fri 17 Nov 2028)',
    },
    {
      id: 'res-y3-review3-2029-01-26',
      title: 'Third Six-Monthly Progress Review (Y3T2)',
      domain: 'research',
      dueDate: '2029-01-26',
      prepDurationDays: 14,
      notes: 'Year 3 (+104w from Intake 2024: Fri 29 Jan 2027 -> Fri 26 Jan 2029)',
    },
    {
      id: 'res-y3-titleabstract-2029-03-02',
      title: 'Title and Abstract',
      domain: 'research',
      dueDate: '2029-03-02',
      prepDurationDays: 14,
      notes: 'Year 3 (+104w from Intake 2024: Fri 5 Mar 2027 -> Fri 2 Mar 2029)',
    },
    {
      id: 'res-y3-thesisvol1-2029-06-08',
      title: 'Thesis Volume 1 Submission',
      domain: 'research',
      dueDate: '2029-06-08',
      prepDurationDays: 60,
      notes: 'Year 3 (+104w from Intake 2024: Fri 11 Jun 2027 -> Fri 8 Jun 2029)',
    },
    {
      id: 'res-y3-vivas-2029-08-31',
      title: 'Vivas (July to September Window)',
      domain: 'research',
      dueDate: '2029-08-31',
      prepDurationDays: 60,
      notes: 'Year 3 Viva Voce examination window (1 Jul 2029 – 31 Aug 2029)',
    },
  ];

  /**
   * User-supplied Immovable Clinical Placement Windows (2026 Intake Cohort across Years 1-3).
   * Rendered as locked, non-draggable background spans in the Clinical column.
   * Excluded from preparation workload heat-strip calculations.
   */
  const INITIAL_CLINICAL_PLACEMENTS = [
    // Year 1 (2026/27) — 2026 Intake
    {
      id: 'clin-pl-y1-p1',
      name: 'Placement 1 (Y1)',
      startDate: '2026-10-28',
      endDate: '2027-04-09',
      notes: '2026 Intake — Wed 28 Oct 2026 to Fri 09 Apr 2027 (Immovable)',
    },
    {
      id: 'clin-pl-y1-p2',
      name: 'Placement 2 (Y1)',
      startDate: '2027-04-12',
      endDate: '2027-10-01',
      notes: '2026 Intake — Mon 12 Apr 2027 to Fri 01 Oct 2027 (Immovable)',
    },
    // Year 2 (2027/28) — Projected from 2025 Intake (+52 weeks)
    {
      id: 'clin-pl-y2-p3',
      name: 'Placement 3 (Y2)',
      startDate: '2027-10-04',
      endDate: '2028-03-31',
      notes: 'Year 2 (+52w from 2025 Intake: Mon 05 Oct 2026 - Fri 02 Apr 2027) (Immovable)',
    },
    {
      id: 'clin-pl-y2-p4',
      name: 'Placement 4 (Y2)',
      startDate: '2028-04-03',
      endDate: '2028-09-29',
      notes: 'Year 2 (+52w from 2025 Intake: Mon 05 Apr 2027 - Fri 01 Oct 2027) (Immovable)',
    },
    // Year 3 (2028/29) — Projected from 2024 Intake (+104 weeks)
    {
      id: 'clin-pl-y3-p5',
      name: 'Placement 5 (Y3)',
      startDate: '2028-10-02',
      endDate: '2029-03-23',
      notes: 'Year 3 (+104w from 2024 Intake: Mon 05 Oct 2026 - Fri 26 Mar 2027) (Immovable)',
    },
    {
      id: 'clin-pl-y3-p6',
      name: 'Placement 6 (Y3)',
      startDate: '2029-03-26',
      endDate: '2029-09-17',
      notes: 'Year 3 (+104w from 2024 Intake: Mon 29 Mar 2027 - Mon 20 Sep 2027) (Immovable)',
    },
  ];

  /**
   * User-supplied Clinical Placement Contract & MPR-EPR/Clinical Portfolio Deadlines
   * Projected across Years 1-3 for the 2026 Intake cohort.
   */
  const INITIAL_CLINICAL_DEADLINES = [
    // Year 1 (2026/27) — 2026 Intake
    {
      id: 'clin-dl-y1-p1-contract',
      title: 'Placement 1 Contract',
      domain: 'clinical',
      dueDate: '2026-11-13',
      prepDurationDays: 7,
      notes: '2026 Intake (Y1) — Placement 1 Contract submission (Fri 13 Nov 2026)',
    },
    {
      id: 'clin-dl-y1-p1-portfolio',
      title: 'Placement 1 MPR-EPR & Clinical Portfolio',
      domain: 'clinical',
      dueDate: '2027-04-16',
      prepDurationDays: 14,
      notes: '2026 Intake (Y1) — MPR-EPR form & Clinical Portfolio (Fri 16 Apr 2027)',
    },
    {
      id: 'clin-dl-y1-p2-contract',
      title: 'Placement 2 Contract',
      domain: 'clinical',
      dueDate: '2027-04-30',
      prepDurationDays: 7,
      notes: '2026 Intake (Y1) — Placement 2 Contract submission (Fri 30 Apr 2027)',
    },
    {
      id: 'clin-dl-y1-p2-portfolio',
      title: 'Placement 2 MPR-EPR & Clinical Portfolio',
      domain: 'clinical',
      dueDate: '2027-10-08',
      prepDurationDays: 14,
      notes: '2026 Intake (Y1/Y2 transition) — MPR-EPR form & Clinical Portfolio (Fri 08 Oct 2027)',
    },

    // Year 2 (2027/28) — Projected from 2025 Intake (+52 weeks)
    {
      id: 'clin-dl-y2-p3-contract',
      title: 'Placement 3 Contract',
      domain: 'clinical',
      dueDate: '2027-10-22',
      prepDurationDays: 7,
      notes: 'Year 2 (+52w from 2025 Intake: Fri 23 Oct 2026 -> Fri 22 Oct 2027)',
    },
    {
      id: 'clin-dl-y2-p3-portfolio',
      title: 'Placement 3 MPR-EPR & Clinical Portfolio',
      domain: 'clinical',
      dueDate: '2028-04-07',
      prepDurationDays: 14,
      notes: 'Year 2 (+52w from 2025 Intake: Fri 09 Apr 2027 -> Fri 07 Apr 2028)',
    },
    {
      id: 'clin-dl-y2-p4-contract',
      title: 'Placement 4 Contract',
      domain: 'clinical',
      dueDate: '2028-04-21',
      prepDurationDays: 7,
      notes: 'Year 2 (+52w from 2025 Intake: Fri 23 Apr 2027 -> Fri 21 Apr 2028)',
    },
    {
      id: 'clin-dl-y2-p4-portfolio',
      title: 'Placement 4 MPR-EPR & Clinical Portfolio',
      domain: 'clinical',
      dueDate: '2028-10-06',
      prepDurationDays: 14,
      notes: 'Year 2/3 transition (+52w from 2025 Intake: Fri 08 Oct 2027 -> Fri 06 Oct 2028)',
    },

    // Year 3 (2028/29) — Projected from 2024 Intake (+104 weeks)
    {
      id: 'clin-dl-y3-p5-contract',
      title: 'Placement 5 Contract',
      domain: 'clinical',
      dueDate: '2028-11-20',
      prepDurationDays: 7,
      notes: 'Year 3 (+104w from 2024 Intake: Mon 23 Nov 2026 -> Mon 20 Nov 2028)',
    },
    {
      id: 'clin-dl-y3-p5-portfolio',
      title: 'Placement 5 MPR-EPR & Clinical Portfolio',
      domain: 'clinical',
      dueDate: '2029-03-30',
      prepDurationDays: 14,
      notes: 'Year 3 (+104w from 2024 Intake: Fri 02 Apr 2027 -> Fri 30 Mar 2029)',
    },
    {
      id: 'clin-dl-y3-p6-contract',
      title: 'Placement 6 Contract',
      domain: 'clinical',
      dueDate: '2029-04-13',
      prepDurationDays: 7,
      notes: 'Year 3 (+104w from 2024 Intake: Fri 16 Apr 2027 -> Fri 13 Apr 2029)',
    },
    {
      id: 'clin-dl-y3-p6-portfolio',
      title: 'Placement 6 MPR-EPR & Clinical Portfolio',
      domain: 'clinical',
      dueDate: '2029-09-14',
      prepDurationDays: 14,
      notes: 'Year 3 Final Portfolio (+104w from 2024 Intake: Fri 17 Sep 2027 -> Fri 14 Sep 2029)',
    },
  ];

  /**
   * User-supplied Academic Deadlines (Clinical Reports 1–4 & Exam Papers 1–3)
   * Projected across Years 1–3 for the 2026 Intake cohort (+52w for 2025 Intake, +104w for 2024 Intake).
   */
  const INITIAL_ACADEMIC_DEADLINES = [
    // Year 1 (2026/27) — 2026 Intake
    {
      id: 'acad-y1-cr1-2027-01-29',
      title: 'Clinical Report 1',
      domain: 'academic',
      dueDate: '2027-01-29',
      prepDurationDays: 28,
      notes: '2026 Intake (Y1) — Submission Deadline: Friday 29 January 2027',
    },
    {
      id: 'acad-y1-cr2-2027-04-16',
      title: 'Clinical Report 2',
      domain: 'academic',
      dueDate: '2027-04-16',
      prepDurationDays: 28,
      notes: '2026 Intake (Y1) — Submission Deadline: 10am, Friday 16 April 2027',
    },
    {
      id: 'acad-y1-exam1-2027-05-17',
      title: 'Exam Paper 1',
      domain: 'academic',
      dueDate: '2027-05-17',
      prepDurationDays: 21,
      notes: '2026 Intake (Y1) — Examination: Monday 17 May 2027',
    },
    {
      id: 'acad-y1-exam2-2027-05-18',
      title: 'Exam Paper 2',
      domain: 'academic',
      dueDate: '2027-05-18',
      prepDurationDays: 21,
      notes: '2026 Intake (Y1) — Examination: Tuesday 18 May 2027',
    },

    // Year 2 (2027/28) — Projected from 2025 Intake (+52 weeks)
    {
      id: 'acad-y2-cr3-2027-11-12',
      title: 'Clinical Report 3',
      domain: 'academic',
      dueDate: '2027-11-12',
      prepDurationDays: 28,
      notes: 'Year 2 (+52w from 2025 Intake: Fri 13 Nov 2026 -> Fri 12 Nov 2027)',
    },
    {
      id: 'acad-y2-exam3-2028-05-17',
      title: 'Exam Paper 3',
      domain: 'academic',
      dueDate: '2028-05-17',
      prepDurationDays: 21,
      notes: 'Year 2 (+52w from 2025 Intake: Wed 19 May 2027 -> Wed 17 May 2028)',
    },

    // Year 3 (2028/29) — Projected from 2024 Intake (+104 weeks)
    {
      id: 'acad-y3-cr4-2028-10-06',
      title: 'Clinical Report 4',
      domain: 'academic',
      dueDate: '2028-10-06',
      prepDurationDays: 28,
      notes: 'Year 3 (+104w from 2024 Intake: Fri 09 Oct 2026 -> Fri 06 Oct 2028)',
    },
  ];

  const INITIAL_DEADLINES = INITIAL_ACADEMIC_DEADLINES.concat(
    INITIAL_CLINICAL_DEADLINES,
    INITIAL_RESEARCH_DEADLINES
  );

  /**
   * Official UCL Term Dates, Reading Weeks & College Closures (2026/27, 2027/28, 2028/29)
   * Source: https://www.ucl.ac.uk/study/current-students/life-ucl/term-dates-and-closures
   */
  const INITIAL_UCL_TERMS = [
    // Academic Year 2026–27 (Year 1)
    {
      id: 'ucl-y1-t1',
      name: 'Y1 Term 1 (Autumn)',
      startDate: '2026-09-28',
      endDate: '2026-12-11',
    },
    {
      id: 'ucl-y1-t1-rw',
      name: 'Y1 Term 1 Reading Week',
      startDate: '2026-11-02',
      endDate: '2026-11-06',
    },
    {
      id: 'ucl-y1-xmas',
      name: 'Y1 Winter Closure / Vacation',
      startDate: '2026-12-12',
      endDate: '2027-01-10',
    },
    {
      id: 'ucl-y1-t2',
      name: 'Y1 Term 2 (Spring)',
      startDate: '2027-01-11',
      endDate: '2027-03-24',
    },
    {
      id: 'ucl-y1-t2-rw',
      name: 'Y1 Term 2 Reading Week',
      startDate: '2027-02-15',
      endDate: '2027-02-19',
    },
    {
      id: 'ucl-y1-easter',
      name: 'Y1 Spring Vacation (Easter)',
      startDate: '2027-03-25',
      endDate: '2027-04-25',
    },
    {
      id: 'ucl-y1-t3',
      name: 'Y1 Term 3 (Summer)',
      startDate: '2027-04-26',
      endDate: '2027-06-11',
    },
    {
      id: 'ucl-y1-summer',
      name: 'Y1 Summer Vacation / Research Period',
      startDate: '2027-06-12',
      endDate: '2027-09-26',
    },

    // Academic Year 2027–28 (Year 2)
    {
      id: 'ucl-y2-t1',
      name: 'Y2 Term 1 (Autumn)',
      startDate: '2027-09-27',
      endDate: '2027-12-10',
    },
    {
      id: 'ucl-y2-t1-rw',
      name: 'Y2 Term 1 Reading Week',
      startDate: '2027-11-01',
      endDate: '2027-11-05',
    },
    {
      id: 'ucl-y2-xmas',
      name: 'Y2 Winter Closure / Vacation',
      startDate: '2027-12-11',
      endDate: '2028-01-09',
    },
    {
      id: 'ucl-y2-t2',
      name: 'Y2 Term 2 (Spring)',
      startDate: '2028-01-10',
      endDate: '2028-03-24',
    },
    {
      id: 'ucl-y2-t2-rw',
      name: 'Y2 Term 2 Reading Week',
      startDate: '2028-02-14',
      endDate: '2028-02-18',
    },
    {
      id: 'ucl-y2-easter',
      name: 'Y2 Spring Vacation (Easter)',
      startDate: '2028-03-25',
      endDate: '2028-04-23',
    },
    {
      id: 'ucl-y2-t3',
      name: 'Y2 Term 3 (Summer)',
      startDate: '2028-04-24',
      endDate: '2028-06-09',
    },
    {
      id: 'ucl-y2-summer',
      name: 'Y2 Summer Vacation / Research Period',
      startDate: '2028-06-10',
      endDate: '2028-09-24',
    },

    // Academic Year 2028–29 (Year 3)
    {
      id: 'ucl-y3-t1',
      name: 'Y3 Term 1 (Autumn)',
      startDate: '2028-09-25',
      endDate: '2028-12-08',
    },
    {
      id: 'ucl-y3-t1-rw',
      name: 'Y3 Term 1 Reading Week',
      startDate: '2028-10-30',
      endDate: '2028-11-03',
    },
    {
      id: 'ucl-y3-xmas',
      name: 'Y3 Winter Closure / Vacation',
      startDate: '2028-12-09',
      endDate: '2029-01-07',
    },
    {
      id: 'ucl-y3-t2',
      name: 'Y3 Term 2 (Spring)',
      startDate: '2029-01-08',
      endDate: '2029-03-23',
    },
    {
      id: 'ucl-y3-t2-rw',
      name: 'Y3 Term 2 Reading Week',
      startDate: '2029-02-12',
      endDate: '2029-02-16',
    },
    {
      id: 'ucl-y3-easter',
      name: 'Y3 Spring Vacation (Easter)',
      startDate: '2029-03-24',
      endDate: '2029-04-22',
    },
    {
      id: 'ucl-y3-t3',
      name: 'Y3 Term 3 (Summer)',
      startDate: '2029-04-23',
      endDate: '2029-06-08',
    },
    {
      id: 'ucl-y3-summer',
      name: 'Y3 Summer / Viva Voce Window',
      startDate: '2029-06-09',
      endDate: '2029-08-31',
    },
  ];

  const state = {
    programmeStartYear: 2026,
    pxPerDay: 4.5,
    snapIncrementDays: 1, // 1 = Daily, 7 = Weekly
    gradientCurve: 'linear', // 'linear' | 'exponential'
    splitOverlappingLanes: true,

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
    formDeadlineNotes: '',

    // Add Term Form Inputs
    formTermName: '',
    formTermStartDate: '2026-09-28',
    formTermEndDate: '2026-12-11',

    // Edit Modal State
    editingDeadlineId: null,
    editingTermId: null,

    // Active Pointer Drag Operation
    dragOp: null,

    // Persistence tracking
    deletedSeedIds: [],
    lastSavedAt: null,
  };

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadPersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        savePersistedState();
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (typeof parsed.programmeStartYear === 'number') {
        state.programmeStartYear = parsed.programmeStartYear;
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
    } catch (_e) {
      // Ignore malformed storage
    }
  }

  function savePersistedState() {
    try {
      const now = new Date();
      state.lastSavedAt = now.toTimeString().slice(0, 8);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          programmeStartYear: state.programmeStartYear,
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
    if (slice.totalActivePrepItems === 0) return 'transparent';
    if (slice.activeDomainsCount === 3) return 'rgba(153, 27, 27, 0.25)';
    if (slice.activeDomainsCount === 2) return 'rgba(217, 119, 6, 0.22)';
    if (slice.totalActivePrepItems >= 3) return 'rgba(217, 119, 6, 0.18)';
    if (slice.totalActivePrepItems === 2) return 'rgba(30, 64, 175, 0.14)';
    return 'rgba(100, 116, 139, 0.10)';
  }

  function getHeatBadgeStyle(slice) {
    if (slice.activeDomainsCount === 3) {
      return 'background:#991B1B;color:#FFFFFF;';
    }
    if (slice.activeDomainsCount === 2 || slice.totalActivePrepItems >= 3) {
      return 'background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;';
    }
    return 'background:#E2E8F0;color:#334155;';
  }

  function getMacroHeatmapCellBg(slice) {
    if (slice.totalActivePrepItems === 0) return '#F8FAFC';
    if (slice.activeDomainsCount === 3) return 'rgba(153, 27, 27, 0.28)';
    if (slice.activeDomainsCount === 2) return 'rgba(217, 119, 6, 0.22)';
    if (slice.totalActivePrepItems >= 3) return 'rgba(234, 88, 12, 0.18)';
    if (slice.totalActivePrepItems === 2) return 'rgba(30, 64, 175, 0.13)';
    return 'rgba(100, 116, 139, 0.08)';
  }

  function getMacroHeatmapBarColor(slice) {
    if (slice.totalActivePrepItems === 0) return 'transparent';
    if (slice.activeDomainsCount === 3) return '#991B1B';
    if (slice.activeDomainsCount === 2) return '#D97706';
    if (slice.totalActivePrepItems >= 3) return '#EA580C';
    if (slice.totalActivePrepItems === 2) return '#1E40AF';
    return '#64748B';
  }

  function renderMacroHeatmapPanel(weeklySlices, yearBounds, monthBounds, totalDays) {
    let peakConcurrent = 0;
    let collisionWeeks = 0;
    for (let i = 0; i < weeklySlices.length; i++) {
      const s = weeklySlices[i];
      if (s.totalActivePrepItems > peakConcurrent) {
        peakConcurrent = s.totalActivePrepItems;
      }
      if (s.activeDomainsCount >= 2) {
        collisionWeeks++;
      }
    }
    const maxScale = Math.max(4, peakConcurrent);

    const slicesHtml = weeklySlices
      .map(function (wk) {
        const topPct = (wk.startDay / totalDays) * 100;
        const heightPct = Math.max(0.35, ((wk.endDay - wk.startDay) / totalDays) * 100);
        const rowBg = getMacroHeatmapCellBg(wk);
        const barColor = getMacroHeatmapBarColor(wk);
        const barWidthPct =
          wk.totalActivePrepItems === 0
            ? 0
            : Math.min(100, Math.round((wk.totalActivePrepItems / maxScale) * 100));

        const acadAlpha =
          wk.academicCount > 0 ? Math.min(0.95, 0.35 + wk.academicCount * 0.25) : 0;
        const clinAlpha =
          wk.clinicalCount > 0 ? Math.min(0.95, 0.35 + wk.clinicalCount * 0.25) : 0;
        const resAlpha =
          wk.researchCount > 0 ? Math.min(0.95, 0.35 + wk.researchCount * 0.25) : 0;

        const yearBg = wk.programmeYear % 2 === 1 ? '#F1F5F9' : '#F8FAFC';

        const tooltipParts = [
          `Y${wk.programmeYear} W${wk.yearWeekNumber} (${wk.startIso} to ${wk.endIso})`,
          `Active Prep Load: ${wk.totalActivePrepItems} item(s) [A:${wk.academicCount} C:${wk.clinicalCount} R:${wk.researchCount}]`,
        ];
        if (wk.activeTitles && wk.activeTitles.length > 0) {
          tooltipParts.push(
            wk.activeTitles
              .map(function (t) {
                return '• ' + t.title;
              })
              .join(' | ')
          );
        }

        return `
          <div
            class="macro-week-slice"
            data-start-day="${wk.startDay}"
            style="top:${topPct.toFixed(3)}%;height:${heightPct.toFixed(3)}%;background:${rowBg};"
            title="${escapeHtml(tooltipParts.join(' — '))}"
          >
            <div class="macro-year-gutter" style="background:${yearBg};"></div>
            <div class="macro-domain-tracks">
              <div class="macro-domain-cell" style="background:${
                acadAlpha > 0 ? `rgba(30, 64, 175, ${acadAlpha})` : 'transparent'
              };"></div>
              <div class="macro-domain-cell" style="background:${
                clinAlpha > 0 ? `rgba(15, 118, 110, ${clinAlpha})` : 'transparent'
              };"></div>
              <div class="macro-domain-cell" style="background:${
                resAlpha > 0 ? `rgba(153, 27, 27, ${resAlpha})` : 'transparent'
              };"></div>
            </div>
            <div class="macro-intensity-track">
              ${
                barWidthPct > 0
                  ? `<div class="macro-intensity-bar" style="width:${barWidthPct}%;background:${barColor};"></div>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');

    const yearMarkersHtml = yearBounds
      .map(function (yb) {
        const topPct = (yb.startDay / totalDays) * 100;
        return `
          <div class="macro-year-divider" style="top:${topPct.toFixed(3)}%;"></div>
          <div class="macro-year-tag" style="top:calc(${topPct.toFixed(3)}% + 2px);">Y${yb.programmeYear}</div>
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
      <aside class="macro-heatmap-panel" aria-label="3-Year Compressed Workload Overview">
        <div class="macro-panel-header">
          <div class="macro-panel-title">
            <span>3-Yr Load Map</span>
            <span class="mono-tag">161W</span>
          </div>
          <div class="macro-panel-sub">
            <span>Y · A C R · HEAT</span>
            <span>PEAK:${peakConcurrent} · COL:${collisionWeeks}w</span>
          </div>
        </div>

        <div id="macro-heatmap-canvas" class="macro-heatmap-canvas" title="Click or drag vertically to jump across the 3-year programme">
          ${slicesHtml}
          ${monthTicksHtml}
          ${yearMarkersHtml}
          <div id="macro-viewport-lens" class="macro-viewport-lens" style="top:0%;height:20%;"></div>
        </div>

        <div class="macro-panel-legend">
          <div class="macro-legend-row">
            <span>INTENSITY</span>
            <div class="macro-legend-swatches">
              <span class="macro-swatch" style="background:#F8FAFC;" title="0 active prep"></span>
              <span class="macro-swatch" style="background:#64748B;" title="1 active prep"></span>
              <span class="macro-swatch" style="background:#1E40AF;" title="2 active preps"></span>
              <span class="macro-swatch" style="background:#D97706;" title="2-domain collision / 3+ preps"></span>
              <span class="macro-swatch" style="background:#991B1B;" title="3-domain collision"></span>
            </div>
          </div>
          <div class="macro-legend-row" style="color:var(--text-muted);">
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
    const weeklySlices = DateMath.computeWeeklyLoadSlices(state.deadlines, startYear);

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
        state.splitOverlappingLanes
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
                  <span>&bull;</span>
                  <span>Vertical Coordinate Axis</span>
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

              <div class="control-pill" title="CSS linear-gradient opacity curve for preparation tails">
                <label>Gradient</label>
                <div class="segmented-group">
                  <button type="button" class="seg-btn ${state.gradientCurve === 'linear' ? 'active' : ''}" data-action="set-curve" data-curve="linear">Lin</button>
                  <button type="button" class="seg-btn ${state.gradientCurve === 'exponential' ? 'active' : ''}" data-action="set-curve" data-curve="exponential">Exp</button>
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
                style="background:#F0FDFA;color:#0F766E;border-color:#99F6E4;"
                title="All edits auto-save to browser storage; click to manually commit &amp; verify timestamp"
              >
                &#10003; ${state.lastSavedAt ? 'Saved ' + state.lastSavedAt : 'Commit / Save'}
              </button>

              <button type="button" class="btn btn-danger-outline" data-action="clear-all-state" title="Reset to default dataset">
                Reset
              </button>
            </div>
          </div>

          ${state.isAddDrawerOpen ? renderCrudDrawer(startYear) : ''}
        </header>

        <div class="workspace-body">
          <div id="timeline-viewport" class="timeline-viewport">
            <div class="timeline-minwidth">
              <div class="sticky-column-headers">
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
                    return `
                      <div class="domain-header-cell">
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
                      </div>
                    `;
                  })
                  .join('')}

                <div class="domain-header-cell" style="background:#F8FAFC;">
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
                </div>
              </div>

              <div class="timeline-body-grid" style="height:${totalHeightPx}px;">
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
                      const tooltipLines = [
                        `Year ${wk.programmeYear}, Week ${wk.yearWeekNumber} (${wk.startIso} to ${wk.endIso})`,
                        `Active Prep Windows: ${wk.totalActivePrepItems} (${wk.activeDomainsCount} domain${wk.activeDomainsCount === 1 ? '' : 's'})`,
                      ];
                      if (wk.activeTitles && wk.activeTitles.length > 0) {
                        wk.activeTitles.forEach(function (t) {
                          tooltipLines.push(`• [${t.domain.toUpperCase()}] ${t.title} (due ${t.dueDate})`);
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
                      </div>
                    `;
                  })
                  .join('')}

                <div class="timeline-column term-column" style="height:${totalHeightPx}px;">
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
              Prep Tail (&uarr; resize top edge)
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
                  <option value="academic" ${state.formDeadlineDomain === 'academic' ? 'selected' : ''}>Academic (#1E40AF)</option>
                  <option value="clinical" ${state.formDeadlineDomain === 'clinical' ? 'selected' : ''}>Clinical (#0F766E)</option>
                  <option value="research" ${state.formDeadlineDomain === 'research' ? 'selected' : ''}>Research (#991B1B)</option>
                </select>
              </div>
              <div class="field-group">
                <label>Due Date</label>
                <input type="date" name="dueDate" class="field-input mono-tag" value="${escapeHtml(state.formDeadlineDueDate)}" required />
              </div>
              <div class="field-group">
                <label>Prep Window</label>
                <div class="prep-compound">
                  <input type="number" name="prepValue" class="field-input" min="1" max="365" value="${state.formDeadlinePrepValue}" required />
                  <select name="prepUnit" class="field-input">
                    <option value="days" ${state.formDeadlinePrepUnit === 'days' ? 'selected' : ''}>days</option>
                    <option value="weeks" ${state.formDeadlinePrepUnit === 'weeks' ? 'selected' : ''}>wks</option>
                  </select>
                </div>
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
    const laneWidthPct = 100 / entry.totalLanes;
    const leftPct = entry.laneIndex * laneWidthPct;
    const widthCalc =
      entry.totalLanes > 1
        ? `calc(${laneWidthPct}% - 8px)`
        : 'calc(100% - 14px)';
    const leftCalc =
      entry.totalLanes > 1 ? `calc(${leftPct}% + 4px)` : '7px';

    const prepStartIso = DateMath.dayOffsetToDate(entry.prepStartDay, startYear);
    const gradientCss = DateMath.buildPreparationGradient(
      cfg.rgb,
      state.gradientCurve
    );

    const isDragging =
      state.dragOp && state.dragOp.deadlineId === item.id;

    const weeksExact =
      item.prepDurationDays % 7 === 0
        ? `${item.prepDurationDays / 7}w (${item.prepDurationDays}d)`
        : `${item.prepDurationDays}d`;

    return `
      <div
        class="deadline-composite ${isDragging ? 'is-dragging' : ''}"
        data-deadline-id="${escapeHtml(item.id)}"
        style="top:${entry.yStart}px;left:${leftCalc};width:${widthCalc};"
      >
        <div
          class="prep-tail"
          data-drag-role="shift-due"
          data-deadline-id="${escapeHtml(item.id)}"
          style="
            height:${entry.heightPx}px;
            background:${gradientCss};
            border-left-color:${cfg.hex};
            border-right-color:rgba(${cfg.rgb}, 0.28);
            border-top-color:rgba(${cfg.rgb}, 0.55);
          "
          title="${escapeHtml(item.title)} — Drag vertically to shift due date, or drag top edge to resize preparation window"
        >
          <div
            class="prep-resize-handle"
            data-drag-role="resize-prep"
            data-deadline-id="${escapeHtml(item.id)}"
            title="Drag top edge vertically to lengthen or shorten preparation window (${item.prepDurationDays} days)"
          >
            <span class="prep-resize-grip" style="background:${cfg.hex};"></span>
            ${
              entry.heightPx >= 26
                ? `<span class="prep-start-pill">Prep ${DateMath.formatAcademicDate(
                    prepStartIso,
                    startYear,
                    false
                  )} (${weeksExact})</span>`
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
            <span class="anchor-prep-tag" style="background:${cfg.badgeBg};color:${cfg.badgeText};">
              ${item.prepDurationDays}d prep
            </span>
          </div>
          ${
            item.notes
              ? `<div class="anchor-notes" title="${escapeHtml(item.notes)}">${escapeHtml(
                  item.notes
                )}</div>`
              : ''
          }
        </div>
      </div>
    `;
  }

  function renderClinicalPlacementBlocks(placements, startYear, pxPerDay) {
    if (!Array.isArray(placements) || placements.length === 0) return '';
    return placements
      .map(function (pl) {
        const startDay = DateMath.dateToDayOffset(pl.startDate, startYear);
        const endDay = DateMath.dateToDayOffset(pl.endDate, startYear) + 1;
        const topPx = startDay * pxPerDay;
        const heightPx = Math.max(22, (endDay - startDay) * pxPerDay);
        const durationDays = Math.max(1, endDay - startDay);
        const durationWeeks = Math.round(durationDays / 7);

        return `
          <div
            class="clinical-placement-block"
            style="top:${topPx}px;height:${heightPx}px;"
            title="${escapeHtml(pl.name)}: ${pl.startDate} to ${pl.endDate} (${durationDays} days / ~${durationWeeks} weeks) — Immovable Clinical Placement"
          >
            <div>
              <div class="clinical-placement-header">
                <span class="clinical-placement-title">${escapeHtml(pl.name)}</span>
                <span class="clinical-placement-lock">IMMOVABLE PLACEMENT</span>
              </div>
              <div class="clinical-placement-dates">
                ${DateMath.formatAcademicDate(pl.startDate, startYear, false)} &rarr; ${DateMath.formatAcademicDate(pl.endDate, startYear, false)}
              </div>
            </div>
            ${
              heightPx >= 60
                ? `<div class="clinical-placement-footer">${durationWeeks} wks (${durationDays}d) &bull; Continuous Clinical Placement</div>`
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
        title="${escapeHtml(term.name)} (${term.startDate} to ${term.endDate}) — Click to edit or delete"
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
    const d = state.deadlines.find(function (item) {
      return item.id === state.dragOp.deadlineId;
    });
    if (!d) return '';

    const dueDay = DateMath.dateToDayOffset(d.dueDate, state.programmeStartYear);
    const prepStartDay = dueDay - d.prepDurationDays;
    const prepStartIso = DateMath.dayOffsetToDate(
      prepStartDay,
      state.programmeStartYear
    );

    return `
      <div class="live-drag-hud">
        <span style="color:#94A3B8;text-transform:uppercase;">
          ${state.dragOp.mode === 'shift-due' ? 'Rescheduling Due Date' : 'Resizing Prep Window'}
        </span>
        <strong>${escapeHtml(d.title)}</strong>
        <span>Prep Start: <strong>${prepStartIso}</strong></span>
        <span>Due: <strong>${d.dueDate}</strong></span>
        <span>Window: <strong>${d.prepDurationDays}d</strong></span>
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
                <div class="field-group">
                  <label>Preparation Duration (Days)</label>
                  <input type="number" name="prepDurationDays" class="field-input mono-tag" min="1" max="365" value="${item.prepDurationDays}" required />
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
              <div style="font-size:11px;color:#64748B;">Paste Academic, Clinical, and Research deadlines alongside UCL Term Dates, or export the sequenced schedule.</div>
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
      "notes": "..."
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
                  <pre class="schema-pre">type,title,domain,dueDate,prepDurationDays,startDate,endDate,notes
deadline,"Essay 1",academic,YYYY-MM-DD,21,,,
term,"Year 1 - Term 1",,,,YYYY-MM-DD,YYYY-MM-DD,</pre>
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
        if (state.editingDeadlineId || state.editingTermId) {
          state.editingDeadlineId = null;
          state.editingTermId = null;
          renderApp();
        } else if (state.isBulkModalOpen) {
          state.isBulkModalOpen = false;
          renderApp();
        }
      }
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
      } else if (action === 'set-curve') {
        state.gradientCurve = target.getAttribute('data-curve') || 'linear';
        renderApp();
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
          state.terms
        );
        state.bulkFeedback = null;
        renderApp();
      } else if (action === 'load-current-csv') {
        state.bulkTextValue = SchemaParser.serializeToCsv(
          state.deadlines,
          state.terms
        );
        state.bulkFeedback = null;
        renderApp();
      } else if (action === 'download-json') {
        const json = SchemaParser.serializeToJson(
          state.programmeStartYear,
          state.deadlines,
          state.terms
        );
        downloadFile(
          json,
          `ucl-programme-schedule-${state.programmeStartYear}-${state.programmeStartYear + 3}.json`,
          'application/json'
        );
      } else if (action === 'download-csv') {
        const csv = SchemaParser.serializeToCsv(state.deadlines, state.terms);
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
        }

        savePersistedState();
        state.bulkFeedback = {
          type: 'success',
          lines: [
            `Imported ${result.deadlines.length} deadline(s) and ${result.terms.length} term block(s).`,
          ].concat(result.warnings),
        };
        renderApp();
      } else if (action === 'commit-save-state') {
        savePersistedState();
        renderApp();
      } else if (action === 'clear-all-state') {
        if (
          window.confirm(
            'Reset all modified deadlines and restore the default Academic, Clinical, and Research dataset?'
          )
        ) {
          state.deadlines = INITIAL_DEADLINES.slice();
          state.terms = INITIAL_UCL_TERMS.slice();
          state.clinicalPlacements = INITIAL_CLINICAL_PLACEMENTS.slice();
          state.deletedSeedIds = [];
          localStorage.removeItem(STORAGE_KEY);
          savePersistedState();
          renderApp();
        }
      } else if (action === 'open-edit-deadline') {
        e.stopPropagation();
        state.editingDeadlineId = target.getAttribute('data-deadline-id');
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
        savePersistedState();
        renderApp();
      } else if (action === 'open-edit-term') {
        e.stopPropagation();
        state.editingTermId = target.getAttribute('data-term-id');
        state.editingDeadlineId = null;
        renderApp();
      } else if (action === 'close-edit-modal') {
        e.stopPropagation();
        state.editingDeadlineId = null;
        state.editingTermId = null;
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
        savePersistedState();
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
        savePersistedState();
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
          savePersistedState();
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
        const prepValue = Math.max(1, Number(fd.get('prepValue')) || 14);
        const prepUnit = String(fd.get('prepUnit') || 'days');
        const notes = String(fd.get('notes') || '').trim();

        if (!title || Number.isNaN(DateMath.parseIsoToUtcMs(dueDate))) return;

        const prepDurationDays =
          prepUnit === 'weeks' ? prepValue * 7 : prepValue;

        state.deadlines.push({
          id: SchemaParser.generateId('dl'),
          title: title,
          domain: domain,
          dueDate: dueDate,
          prepDurationDays: prepDurationDays,
          notes: notes || undefined,
        });

        state.formDeadlineTitle = '';
        state.formDeadlineDomain = domain;
        state.formDeadlineDueDate = dueDate;
        state.formDeadlinePrepValue = prepValue;
        state.formDeadlinePrepUnit = prepUnit;
        state.formDeadlineNotes = '';

        savePersistedState();
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

        state.terms.push({
          id: SchemaParser.generateId('term'),
          name: name,
          startDate: startDate,
          endDate: endDate,
        });

        state.formTermName = '';
        state.formTermStartDate = startDate;
        state.formTermEndDate = endDate;

        savePersistedState();
        renderApp();
      } else if (form.id === 'form-edit-deadline') {
        const fd = new FormData(form);
        const title = String(fd.get('title') || '').trim();
        const domain = String(fd.get('domain') || 'academic');
        const dueDate = String(fd.get('dueDate') || '').trim();
        const prepDurationDays = Math.max(
          1,
          Math.round(Number(fd.get('prepDurationDays')) || 14)
        );
        const notes = String(fd.get('notes') || '').trim();

        state.deadlines = state.deadlines.map(function (d) {
          if (d.id !== state.editingDeadlineId) return d;
          return {
            id: d.id,
            title: title || d.title,
            domain: domain,
            dueDate: dueDate || d.dueDate,
            prepDurationDays: prepDurationDays,
            notes: notes || undefined,
          };
        });

        state.editingDeadlineId = null;
        savePersistedState();
        renderApp();
      } else if (form.id === 'form-edit-term') {
        const fd = new FormData(form);
        const name = String(fd.get('name') || '').trim();
        const startDate = String(fd.get('startDate') || '').trim();
        const endDate = String(fd.get('endDate') || '').trim();

        state.terms = state.terms.map(function (t) {
          if (t.id !== state.editingTermId) return t;
          return {
            id: t.id,
            name: name || t.name,
            startDate: startDate || t.startDate,
            endDate: endDate || t.endDate,
          };
        });

        state.editingTermId = null;
        savePersistedState();
        renderApp();
      }
    });

    // Pointer-event vertical drag-and-drop & prep resizing + Macro Heatmap Scrubbing
    root.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;

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

      // Ignore clicks on edit/delete buttons inside deadline cards
      if (e.target.closest('[data-action]')) return;

      const resizeHandle = e.target.closest('[data-drag-role="resize-prep"]');
      const shiftHandle = e.target.closest('[data-drag-role="shift-due"]');

      const handleEl = resizeHandle || shiftHandle;
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
        mode: resizeHandle ? 'resize-prep' : 'shift-due',
        startClientY: e.clientY,
        initialDueDay: DateMath.dateToDayOffset(
          item.dueDate,
          state.programmeStartYear
        ),
        initialPrepDays: item.prepDurationDays,
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
        } else {
          const nextPrep = Math.max(
            1,
            Math.min(365, op.initialPrepDays - snappedDeltaDays)
          );
          if (nextPrep !== d.prepDurationDays) {
            changed = true;
            return Object.assign({}, d, { prepDurationDays: nextPrep });
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
      state.dragOp = null;
      savePersistedState();
      renderApp();
    });
  }

  function init() {
    loadPersistedState();
    renderApp();
    attachEventListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
