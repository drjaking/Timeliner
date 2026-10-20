import { DeadlineItem, PlacementBlock, TermBlock } from '../types/timeline';

export const SEEDED_PLACEMENTS: PlacementBlock[] = [
  {
    id: 'clin-placement-1',
    name: 'Placement 1',
    startDate: '2026-10-28',
    endDate: '2027-04-09',
    notes: '2026 Cohort · Immovable Clinical Placement (28 Oct 2026 – 9 Apr 2027)',
  },
  {
    id: 'clin-placement-2',
    name: 'Placement 2',
    startDate: '2027-04-12',
    endDate: '2027-10-01',
    notes: '2026 Cohort · Immovable Clinical Placement (w/c 12 Apr 2027 – 1 Oct 2027)',
  },
  {
    id: 'clin-placement-3',
    name: 'Placement 3',
    startDate: '2027-10-04',
    endDate: '2028-03-31',
    notes: '2026 Cohort · Immovable Clinical Placement (w/c 4 Oct 2027 – 31 Mar 2028)',
  },
  {
    id: 'clin-placement-4',
    name: 'Placement 4',
    startDate: '2028-04-03',
    endDate: '2028-09-29',
    notes: '2026 Cohort · Immovable Clinical Placement (w/c 3 Apr 2028 – 29 Sep 2028)',
  },
  {
    id: 'clin-placement-5',
    name: 'Placement 5',
    startDate: '2028-10-02',
    endDate: '2029-03-23',
    notes: '2026 Cohort · Immovable Clinical Placement (w/c 2 Oct 2028 – 23 Mar 2029)',
  },
  {
    id: 'clin-placement-6',
    name: 'Placement 6',
    startDate: '2029-03-26',
    endDate: '2029-09-17',
    notes: '2026 Cohort · Immovable Clinical Placement (w/c 26 Mar 2029 – 17 Sep 2029)',
  },
];

export const SEEDED_CLINICAL_DEADLINES: DeadlineItem[] = [
  // Placement 1 Submissions
  {
    id: 'clin-p1-contract',
    title: 'Placement 1: Contract Submitted',
    domain: 'clinical',
    dueDate: '2026-11-13',
    prepDurationDays: 7,
    notes: 'Placement 1 contract deadline · 13 Nov 2026',
  },
  {
    id: 'clin-p1-mpr-epr',
    title: 'Placement 1: MPR-EPR Form & Clinical Portfolio',
    domain: 'clinical',
    dueDate: '2027-04-16',
    prepDurationDays: 14,
    notes: 'Placement 1 portfolio deadline · 16 Apr 2027',
  },

  // Placement 2 Submissions
  {
    id: 'clin-p2-contract',
    title: 'Placement 2: Contract Submitted',
    domain: 'clinical',
    dueDate: '2027-04-30',
    prepDurationDays: 7,
    notes: 'Not required for 12-month placements · 30 Apr 2027',
  },
  {
    id: 'clin-p2-mpr-epr',
    title: 'Placement 2: MPR-EPR Form & Clinical Portfolio',
    domain: 'clinical',
    dueDate: '2027-10-08',
    prepDurationDays: 14,
    notes: 'Placement 2 portfolio deadline · 8 Oct 2027',
  },

  // Placement 3 Submissions
  {
    id: 'clin-p3-contract',
    title: 'Placement 3: Contract Submitted',
    domain: 'clinical',
    dueDate: '2027-10-22',
    prepDurationDays: 7,
    notes: 'Placement 3 contract deadline · 22 Oct 2027',
  },
  {
    id: 'clin-p3-mpr-epr',
    title: 'Placement 3: MPR-EPR Form & Clinical Portfolio',
    domain: 'clinical',
    dueDate: '2028-04-07',
    prepDurationDays: 14,
    notes: 'Placement 3 portfolio deadline · 7 Apr 2028',
  },

  // Placement 4 Submissions
  {
    id: 'clin-p4-contract',
    title: 'Placement 4: Contract Submitted',
    domain: 'clinical',
    dueDate: '2028-04-21',
    prepDurationDays: 7,
    notes: 'Placement 4 contract deadline · 21 Apr 2028',
  },
  {
    id: 'clin-p4-mpr-epr',
    title: 'Placement 4: MPR-EPR Form & Clinical Portfolio',
    domain: 'clinical',
    dueDate: '2028-10-06',
    prepDurationDays: 14,
    notes: 'Placement 4 portfolio deadline · 6 Oct 2028',
  },

  // Placement 5 Submissions
  {
    id: 'clin-p5-contract',
    title: 'Placement 5: Contract Submitted',
    domain: 'clinical',
    dueDate: '2028-11-20',
    prepDurationDays: 7,
    notes: 'Placement 5 contract deadline · 20 Nov 2028',
  },
  {
    id: 'clin-p5-mpr-epr',
    title: 'Placement 5: MPR-EPR Form & Clinical Portfolio',
    domain: 'clinical',
    dueDate: '2029-03-30',
    prepDurationDays: 14,
    notes: 'Placement 5 portfolio deadline · 30 Mar 2029',
  },

  // Placement 6 Submissions
  {
    id: 'clin-p6-contract',
    title: 'Placement 6: Contract Submitted',
    domain: 'clinical',
    dueDate: '2029-04-13',
    prepDurationDays: 7,
    notes: 'Placement 6 contract deadline · 13 Apr 2029',
  },
  {
    id: 'clin-p6-mpr-epr',
    title: 'Placement 6: MPR-EPR Form & Clinical Portfolio',
    domain: 'clinical',
    dueDate: '2029-09-14',
    prepDurationDays: 14,
    notes: 'Placement 6 portfolio deadline · 14 Sep 2029',
  },
];

export const SEEDED_RESEARCH_DEADLINES: DeadlineItem[] = [
  // Research Committee Meetings (Year 1: 2026/27)
  {
    id: 'res-comm-2026-11',
    title: 'Research Committee Meeting (Autumn)',
    domain: 'research',
    dueDate: '2026-11-13',
    prepDurationDays: 7,
    notes: 'Committee Date: Friday 13 Nov 2026',
  },
  {
    id: 'res-comm-2027-05',
    title: 'Research Committee Meeting (Spring)',
    domain: 'research',
    dueDate: '2027-05-07',
    prepDurationDays: 7,
    notes: 'Committee Date: Friday 7 May 2027',
  },

  // Intake 2026 -> Year 1 (2026/27)
  {
    id: 'res-y1-orientation',
    title: 'Project Orientation Session',
    domain: 'research',
    dueDate: '2027-02-04',
    prepDurationDays: 7,
    notes: 'Intake 2026 (Y1) · Thu 4 Feb 2027',
  },
  {
    id: 'res-y1-soi',
    title: 'Statement of Intent',
    domain: 'research',
    dueDate: '2027-05-06',
    prepDurationDays: 28,
    notes: 'Intake 2026 (Y1) · Thu 6 May 2027',
  },
  {
    id: 'res-y1-proposal',
    title: 'Research Proposal',
    domain: 'research',
    dueDate: '2027-07-09',
    prepDurationDays: 42,
    notes: 'Intake 2026 (Y1) · Fri 9 Jul 2027',
  },

  // Intake 2025 -> Projected to Year 2 (2027/28, +52 weeks preserving Friday)
  {
    id: 'res-y2-funding',
    title: 'Research Funding',
    domain: 'research',
    dueDate: '2027-12-03',
    prepDurationDays: 28,
    notes: 'Y2 (Intake 2025 template: Fri 4 Dec 2026)',
  },
  {
    id: 'res-y2-review-t2',
    title: 'Progress Review & Research Log (Y2T2)',
    domain: 'research',
    dueDate: '2028-02-11',
    prepDurationDays: 14,
    notes: 'Y2T2 (Intake 2025 template: Fri 12 Feb 2027)',
  },
  {
    id: 'res-y2-review-t3',
    title: 'Second Six-Monthly Progress Review & Research Log (Y2T3)',
    domain: 'research',
    dueDate: '2028-06-30',
    prepDurationDays: 14,
    notes: 'Y2T3 (Intake 2025 template: Fri 2 Jul 2027)',
  },
  {
    id: 'res-y2-lit-searches',
    title: 'Literature Review Searches',
    domain: 'research',
    dueDate: '2028-09-08',
    prepDurationDays: 28,
    notes: 'Y2→Y3 (Intake 2025 template: Fri 10 Sep 2027)',
  },

  // Intake 2024 -> Projected to Year 3 (2028/29, +104 weeks preserving Friday)
  {
    id: 'res-y3-lit-review',
    title: 'Literature Review',
    domain: 'research',
    dueDate: '2028-11-17',
    prepDurationDays: 42,
    notes: 'Y3 (Intake 2024 template: Fri 20 Nov 2026)',
  },
  {
    id: 'res-y3-review-t2',
    title: 'Third Six-Monthly Progress Review (Y3T2)',
    domain: 'research',
    dueDate: '2029-01-26',
    prepDurationDays: 14,
    notes: 'Y3T2 (Intake 2024 template: Fri 29 Jan 2027)',
  },
  {
    id: 'res-y3-title-abstract',
    title: 'Title and Abstract',
    domain: 'research',
    dueDate: '2029-03-02',
    prepDurationDays: 14,
    notes: 'Y3 (Intake 2024 template: Fri 5 Mar 2027)',
  },
  {
    id: 'res-y3-thesis-vol1',
    title: 'Thesis Volume 1 Submission',
    domain: 'research',
    dueDate: '2029-06-08',
    prepDurationDays: 60,
    notes: 'Y3 (Intake 2024 template: Fri 11 Jun 2027)',
  },
  {
    id: 'res-y3-vivas',
    title: 'Vivas (July–September Window)',
    domain: 'research',
    dueDate: '2029-08-31',
    prepDurationDays: 61,
    notes: 'Y3 Viva Window: Jul–Sep (Intake 2024: Jul–Sep 2027)',
  },
];

export const SEEDED_ACADEMIC_DEADLINES: DeadlineItem[] = [
  // 2026 Intake -> Year 1 (2026/27)
  {
    id: 'acad-y1-cr1',
    title: 'Clinical Report 1',
    domain: 'academic',
    dueDate: '2027-01-29',
    prepDurationDays: 28,
    notes: '2026 Intake (Y1) · Fri 29 Jan 2027',
  },
  {
    id: 'acad-y1-cr2',
    title: 'Clinical Report 2',
    domain: 'academic',
    dueDate: '2027-04-16',
    prepDurationDays: 28,
    notes: '2026 Intake (Y1) · 10:00am, Fri 16 Apr 2027',
  },
  {
    id: 'acad-y1-exam1',
    title: 'Exam Paper 1',
    domain: 'academic',
    dueDate: '2027-05-17',
    prepDurationDays: 28,
    notes: '2026 Intake (Y1) · Mon 17 May 2027',
  },
  {
    id: 'acad-y1-exam2',
    title: 'Exam Paper 2',
    domain: 'academic',
    dueDate: '2027-05-18',
    prepDurationDays: 28,
    notes: '2026 Intake (Y1) · Tue 18 May 2027',
  },

  // 2025 Intake -> Projected to Year 2 (2027/28, +52 weeks preserving day-of-week)
  {
    id: 'acad-y2-cr3',
    title: 'Clinical Report 3',
    domain: 'academic',
    dueDate: '2027-11-12',
    prepDurationDays: 28,
    notes: 'Y2 (2025 Intake template: Fri 13 Nov 2026)',
  },
  {
    id: 'acad-y2-exam3',
    title: 'Exam Paper 3',
    domain: 'academic',
    dueDate: '2028-05-17',
    prepDurationDays: 28,
    notes: 'Y2 (2025 Intake template: Wed 19 May 2027)',
  },

  // 2024 Intake -> Projected to Year 3 (2028/29, +104 weeks preserving day-of-week)
  {
    id: 'acad-y3-cr4',
    title: 'Clinical Report 4',
    domain: 'academic',
    dueDate: '2028-10-06',
    prepDurationDays: 28,
    notes: 'Y3 (2024 Intake template: Fri 9 Oct 2026)',
  },
];

export const SEEDED_ALL_DEADLINES: DeadlineItem[] = [
  ...SEEDED_ACADEMIC_DEADLINES,
  ...SEEDED_CLINICAL_DEADLINES,
  ...SEEDED_RESEARCH_DEADLINES,
];

export const SEEDED_TERMS: TermBlock[] = [
  // =========================================================================
  // ACADEMIC YEAR 2026/27 (YEAR 1) — Official UCL Term Dates & Closures
  // =========================================================================
  {
    id: 'ucl-y1-t1',
    name: 'Year 1 - Term 1 (Autumn)',
    startDate: '2026-09-28',
    endDate: '2026-12-18',
  },
  {
    id: 'ucl-y1-t1-rw',
    name: 'Y1 Term 1 Reading Week',
    startDate: '2026-11-09',
    endDate: '2026-11-13',
  },
  {
    id: 'ucl-y1-xmas',
    name: 'Christmas Closure (2026/27)',
    startDate: '2026-12-24',
    endDate: '2027-01-04',
  },
  {
    id: 'ucl-y1-t2',
    name: 'Year 1 - Term 2 (Spring)',
    startDate: '2027-01-11',
    endDate: '2027-03-25',
  },
  {
    id: 'ucl-y1-t2-rw',
    name: 'Y1 Term 2 Reading Week',
    startDate: '2027-02-15',
    endDate: '2027-02-19',
  },
  {
    id: 'ucl-y1-easter',
    name: 'Easter Closure (2027)',
    startDate: '2027-03-25',
    endDate: '2027-04-01',
  },
  {
    id: 'ucl-y1-t3',
    name: 'Year 1 - Term 3 (Summer)',
    startDate: '2027-04-26',
    endDate: '2027-06-11',
  },
  {
    id: 'ucl-y1-summer',
    name: 'Y1 Summer Vacation',
    startDate: '2027-06-14',
    endDate: '2027-09-24',
  },

  // =========================================================================
  // ACADEMIC YEAR 2027/28 (YEAR 2) — Official UCL Term Dates & Reading Weeks
  // =========================================================================
  {
    id: 'ucl-y2-t1',
    name: 'Year 2 - Term 1 (Autumn)',
    startDate: '2027-09-27',
    endDate: '2027-12-17',
  },
  {
    id: 'ucl-y2-t1-rw',
    name: 'Y2 Term 1 Reading Week',
    startDate: '2027-11-08',
    endDate: '2027-11-12',
  },
  {
    id: 'ucl-y2-xmas',
    name: 'Winter Break (2027/28)',
    startDate: '2027-12-20',
    endDate: '2028-01-07',
  },
  {
    id: 'ucl-y2-t2',
    name: 'Year 2 - Term 2 (Spring)',
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
    name: 'Spring Break (2028)',
    startDate: '2028-03-27',
    endDate: '2028-04-21',
  },
  {
    id: 'ucl-y2-t3',
    name: 'Year 2 - Term 3 (Summer)',
    startDate: '2028-04-24',
    endDate: '2028-06-09',
  },
  {
    id: 'ucl-y2-summer',
    name: 'Y2 Summer Vacation',
    startDate: '2028-06-12',
    endDate: '2028-09-22',
  },

  // =========================================================================
  // ACADEMIC YEAR 2028/29 (YEAR 3) — Official UCL Term Dates & Reading Weeks
  // =========================================================================
  {
    id: 'ucl-y3-t1',
    name: 'Year 3 - Term 1 (Autumn)',
    startDate: '2028-09-25',
    endDate: '2028-12-15',
  },
  {
    id: 'ucl-y3-t1-rw',
    name: 'Y3 Term 1 Reading Week',
    startDate: '2028-11-06',
    endDate: '2028-11-10',
  },
  {
    id: 'ucl-y3-xmas',
    name: 'Winter Break (2028/29)',
    startDate: '2028-12-18',
    endDate: '2029-01-05',
  },
  {
    id: 'ucl-y3-t2',
    name: 'Year 3 - Term 2 (Spring)',
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
    name: 'Spring Break (2029)',
    startDate: '2029-03-26',
    endDate: '2029-04-20',
  },
  {
    id: 'ucl-y3-t3',
    name: 'Year 3 - Term 3 (Summer)',
    startDate: '2029-04-23',
    endDate: '2029-06-08',
  },
  {
    id: 'ucl-y3-summer',
    name: 'Y3 Summer / Viva Voce Window',
    startDate: '2029-06-11',
    endDate: '2029-09-30',
  },
];
