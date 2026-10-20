/**
 * Default Seeded Datasets for the UCL Longitudinal Programme Curriculum & Deadline Sequencer
 * Shared between the Node.js + SQLite LAN Server and the Browser Frontend.
 */
(function (root, factory) {
  const data = factory();
  root.TimelinerSeedData = data;
  if (typeof module === 'object' && module.exports) {
    module.exports = data;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
   * Rendered as locked, non-draggable spans in the Clinical column with adjustable
   * post-start workload (startLoadDays) and pre-end workload (endLoadDays).
   */
  const INITIAL_CLINICAL_PLACEMENTS = [
    // Year 1 (2026/27) — 2026 Intake
    {
      id: 'clin-pl-y1-p1',
      name: 'Placement 1 (Y1)',
      startDate: '2026-10-28',
      endDate: '2027-04-09',
      startLoadDays: 14,
      endLoadDays: 14,
      notes: '2026 Intake — Wed 28 Oct 2026 to Fri 09 Apr 2027 (Immovable)',
    },
    {
      id: 'clin-pl-y1-p2',
      name: 'Placement 2 (Y1)',
      startDate: '2027-04-12',
      endDate: '2027-10-01',
      startLoadDays: 14,
      endLoadDays: 14,
      notes: '2026 Intake — Mon 12 Apr 2027 to Fri 01 Oct 2027 (Immovable)',
    },
    // Year 2 (2027/28) — Projected from 2025 Intake (+52 weeks)
    {
      id: 'clin-pl-y2-p3',
      name: 'Placement 3 (Y2)',
      startDate: '2027-10-04',
      endDate: '2028-03-31',
      startLoadDays: 14,
      endLoadDays: 14,
      notes: 'Year 2 (+52w from 2025 Intake: Mon 05 Oct 2026 - Fri 02 Apr 2027) (Immovable)',
    },
    {
      id: 'clin-pl-y2-p4',
      name: 'Placement 4 (Y2)',
      startDate: '2028-04-03',
      endDate: '2028-09-29',
      startLoadDays: 14,
      endLoadDays: 14,
      notes: 'Year 2 (+52w from 2025 Intake: Mon 05 Apr 2027 - Fri 01 Oct 2027) (Immovable)',
    },
    // Year 3 (2028/29) — Projected from 2024 Intake (+104 weeks)
    {
      id: 'clin-pl-y3-p5',
      name: 'Placement 5 (Y3)',
      startDate: '2028-10-02',
      endDate: '2029-03-23',
      startLoadDays: 14,
      endLoadDays: 14,
      notes: 'Year 3 (+104w from 2024 Intake: Mon 05 Oct 2026 - Fri 26 Mar 2027) (Immovable)',
    },
    {
      id: 'clin-pl-y3-p6',
      name: 'Placement 6 (Y3)',
      startDate: '2029-03-26',
      endDate: '2029-09-17',
      startLoadDays: 14,
      endLoadDays: 14,
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

  return {
    INITIAL_ACADEMIC_DEADLINES: INITIAL_ACADEMIC_DEADLINES,
    INITIAL_CLINICAL_PLACEMENTS: INITIAL_CLINICAL_PLACEMENTS,
    INITIAL_CLINICAL_DEADLINES: INITIAL_CLINICAL_DEADLINES,
    INITIAL_RESEARCH_DEADLINES: INITIAL_RESEARCH_DEADLINES,
    INITIAL_DEADLINES: INITIAL_DEADLINES,
    INITIAL_UCL_TERMS: INITIAL_UCL_TERMS,
  };
});
