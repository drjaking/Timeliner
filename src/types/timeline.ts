export type Domain = 'academic' | 'clinical' | 'research';

export interface DeadlineItem {
  id: string;
  title: string;
  domain: Domain;
  dueDate: string; // ISO Date string (YYYY-MM-DD)
  prepDurationDays: number; // Integer >= 1
  notes?: string;
}

export interface TermBlock {
  id: string;
  name: string; // e.g., "Year 1 - Term 1", "Reading Week", "Summer Vacation"
  startDate: string; // ISO Date string (YYYY-MM-DD)
  endDate: string; // ISO Date string (YYYY-MM-DD)
}

export interface PlacementBlock {
  id: string;
  name: string; // e.g., "Placement 1"
  startDate: string; // ISO Date string (YYYY-MM-DD)
  endDate: string; // ISO Date string (YYYY-MM-DD)
  notes?: string;
}

export type SnapIncrement = 1 | 7;
export type GradientCurve = 'linear' | 'exponential';
export type OverlapLayout = 'lanes' | 'compound';

export interface ProgrammeState {
  programmeStartYear: number; // Year 1 starts on `${programmeStartYear}-09-01`
  deadlines: DeadlineItem[];
  terms: TermBlock[];
  placements: PlacementBlock[];
  pxPerDay: number;
  snapDays: SnapIncrement;
  gradientCurve: GradientCurve;
  overlapLayout: OverlapLayout;
}

export interface DomainMetadata {
  key: Domain;
  label: string;
  subtitle: string;
  hex: string;
  rgb: string; // "R, G, B" for rgba() gradient construction
  badgeBg: string;
  badgeText: string;
  borderHex: string;
}

export const DOMAIN_CONFIG: Record<Domain, DomainMetadata> = {
  academic: {
    key: 'academic',
    label: 'Academic',
    subtitle: 'Taught Modules, Essays & Examinations',
    hex: '#1E40AF',
    rgb: '30, 64, 175',
    badgeBg: '#EFF6FF',
    badgeText: '#1E40AF',
    borderHex: '#1E3A8A',
  },
  clinical: {
    key: 'clinical',
    label: 'Clinical',
    subtitle: 'Placements, Case Reports & Competencies',
    hex: '#0F766E',
    rgb: '15, 118, 110',
    badgeBg: '#F0FDFA',
    badgeText: '#0F766E',
    borderHex: '#115E59',
  },
  research: {
    key: 'research',
    label: 'Research',
    subtitle: 'Ethics, Proposal, Thesis & Viva Voce',
    hex: '#991B1B',
    rgb: '153, 27, 27',
    badgeBg: '#FEF2F2',
    badgeText: '#991B1B',
    borderHex: '#7F1D1D',
  },
};
