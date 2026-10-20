import { DeadlineItem, Domain, GradientCurve } from '../types/timeline';

const MS_PER_DAY = 86_400_000;

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Parses an ISO YYYY-MM-DD string into a UTC timestamp at 00:00:00Z.
 * Using UTC prevents UK BST/GMT Daylight Saving transitions from introducing 1-hour drift.
 */
export function parseIsoToUtcMs(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return NaN;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const ms = Date.UTC(year, month, day);
  const verify = new Date(ms);
  if (
    verify.getUTCFullYear() !== year ||
    verify.getUTCMonth() !== month ||
    verify.getUTCDate() !== day
  ) {
    return NaN;
  }
  return ms;
}

/**
 * Formats a UTC millisecond timestamp into YYYY-MM-DD.
 */
export function formatUtcMsToIso(utcMs: number): string {
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the canonical ISO date for September 1, Year 1.
 */
export function getProgrammeStartIso(startYear: number): string {
  return `${startYear}-09-01`;
}

/**
 * Returns the canonical ISO date for September 30 at the end of Year 3
 * (includes September post-Y3 buffer so Placement 6 ending 17 Sep and Vivas are never clipped).
 */
export function getProgrammeEndIso(startYear: number): string {
  return `${startYear + 3}-09-30`;
}

/**
 * Returns the total number of calendar days across the 3-year programme
 * from September 1, Year 1 (day 0) through August 31, Year 3 (inclusive).
 */
export function getTotalProgrammeDays(startYear: number): number {
  const startMs = parseIsoToUtcMs(getProgrammeStartIso(startYear));
  const endMs = parseIsoToUtcMs(getProgrammeEndIso(startYear));
  return Math.round((endMs - startMs) / MS_PER_DAY) + 1;
}

/**
 * Converts an ISO date (YYYY-MM-DD) into a 0-based integer day offset
 * anchored to September 1, Year 1 (Day 0).
 */
export function dateToDayOffset(isoDate: string, startYear: number): number {
  const startMs = parseIsoToUtcMs(getProgrammeStartIso(startYear));
  const targetMs = parseIsoToUtcMs(isoDate);
  if (Number.isNaN(targetMs)) return 0;
  return Math.round((targetMs - startMs) / MS_PER_DAY);
}

/**
 * Converts a 0-based day offset from September 1, Year 1 back into an ISO date string.
 */
export function dayOffsetToDate(dayOffset: number, startYear: number): string {
  const startMs = parseIsoToUtcMs(getProgrammeStartIso(startYear));
  return formatUtcMsToIso(startMs + Math.round(dayOffset) * MS_PER_DAY);
}

/**
 * Converts an ISO date to its vertical Y pixel coordinate on the timeline canvas.
 * Note: An item due on Day D is anchored at the end of Day D: (dayOffset + 1) * pxPerDay,
 * or exact day start: dayOffset * pxPerDay. Here Sep 1 Year 1 = 0px, and each day = pxPerDay.
 */
export function dateToY(isoDate: string, startYear: number, pxPerDay: number): number {
  const offset = dateToDayOffset(isoDate, startYear);
  return offset * pxPerDay;
}

/**
 * Clamps a day offset to valid programme bounds [0, totalDays - 1].
 */
export function clampDayOffset(dayOffset: number, startYear: number): number {
  const maxDay = getTotalProgrammeDays(startYear) - 1;
  return Math.max(0, Math.min(maxDay, Math.round(dayOffset)));
}

/**
 * Formats an ISO date into a concise academic readable string, e.g. "14 Nov 2026 (Y1 · W11)"
 */
export function formatAcademicDate(
  isoDate: string,
  startYear: number,
  includeRelative = true
): string {
  const ms = parseIsoToUtcMs(isoDate);
  if (Number.isNaN(ms)) return isoDate;
  const d = new Date(ms);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTH_NAMES_SHORT[d.getUTCMonth()];
  const year = d.getUTCFullYear();

  if (!includeRelative) {
    return `${day} ${month} ${year}`;
  }

  const offset = dateToDayOffset(isoDate, startYear);
  const progYear = offset < 365 ? 1 : offset < 730 ? 2 : 3;
  const weekNum = Math.floor(offset / 7) + 1;
  return `${day} ${month} ${year} (Y${progYear} · W${weekNum})`;
}

export interface YearBoundary {
  programmeYear: 1 | 2 | 3;
  label: string;
  calendarSpanLabel: string;
  startIso: string;
  endIso: string;
  startDay: number;
  endDay: number;
}

export function generateYearBoundaries(startYear: number): YearBoundary[] {
  return ([1, 2, 3] as const).map((yr) => {
    const calStart = startYear + (yr - 1);
    const calEnd = calStart + 1;
    const startIso = `${calStart}-09-01`;
    const endIso = `${calEnd}-08-31`;
    return {
      programmeYear: yr,
      label: `YEAR ${yr}`,
      calendarSpanLabel: `Sep ${calStart} – Aug ${calEnd}`,
      startIso,
      endIso,
      startDay: dateToDayOffset(startIso, startYear),
      endDay: dateToDayOffset(endIso, startYear) + 1,
    };
  });
}

export interface MonthBoundary {
  index: number; // 0..35
  programmeYear: 1 | 2 | 3;
  calendarYear: number;
  monthIndex: number; // 0..11
  shortName: string;
  fullName: string;
  startIso: string;
  startDay: number;
  endDay: number; // exclusive day offset
}

export function generateMonthBoundaries(startYear: number): MonthBoundary[] {
  const months: MonthBoundary[] = [];
  for (let i = 0; i < 37; i++) {
    const totalMonth = 8 + i; // 8 = September (0-indexed)
    const calYear = startYear + Math.floor(totalMonth / 12);
    const monthIdx = totalMonth % 12;
    const progYear = (Math.min(2, Math.floor(i / 12)) + 1) as 1 | 2 | 3;

    const startMs = Date.UTC(calYear, monthIdx, 1);
    const nextMonthMs = Date.UTC(
      monthIdx === 11 ? calYear + 1 : calYear,
      (monthIdx + 1) % 12,
      1
    );

    const startIso = formatUtcMsToIso(startMs);
    const nextIso = formatUtcMsToIso(nextMonthMs);

    months.push({
      index: i,
      programmeYear: progYear,
      calendarYear: calYear,
      monthIndex: monthIdx,
      shortName: MONTH_NAMES_SHORT[monthIdx],
      fullName: MONTH_NAMES_FULL[monthIdx],
      startIso,
      startDay: dateToDayOffset(startIso, startYear),
      endDay: dateToDayOffset(nextIso, startYear),
    });
  }
  return months;
}

export interface WeekSliceLoad {
  weekNumber: number; // 1..156
  programmeYear: 1 | 2 | 3;
  yearWeekNumber: number; // 1..52 within that Programme Year
  startDay: number;
  endDay: number;
  startIso: string;
  endIso: string;
  academicCount: number;
  clinicalCount: number;
  researchCount: number;
  totalActivePrepItems: number;
  activeDomainsCount: number; // 0, 1, 2, or 3
  activeDomains: Domain[];
  dueTitles: string[];
  activeTitles: { title: string; domain: Domain }[];
}

/**
 * Generates 156 weekly slices across the 3-year canvas and computes concurrent
 * preparation load across Academic, Clinical, and Research domains for each week.
 */
export function computeWeeklyLoadSlices(
  deadlines: DeadlineItem[],
  startYear: number
): WeekSliceLoad[] {
  const totalDays = getTotalProgrammeDays(startYear);
  const totalWeeks = Math.ceil(totalDays / 7);

  // Pre-convert deadlines to [prepStartDay, dueDay] intervals
  const intervals = deadlines.map((d) => {
    const dueDay = dateToDayOffset(d.dueDate, startYear);
    const prepStartDay = dueDay - Math.max(1, d.prepDurationDays);
    return {
      item: d,
      prepStartDay,
      dueDay,
    };
  });

  const slices: WeekSliceLoad[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const startDay = w * 7;
    const endDay = Math.min(totalDays, (w + 1) * 7);
    const startIso = dayOffsetToDate(startDay, startYear);
    const endIso = dayOffsetToDate(endDay - 1, startYear);

    const progYear = (Math.min(2, Math.floor(startDay / 365)) + 1) as 1 | 2 | 3;
    const yearWeekNumber = (w % 52) + 1;

    let academicCount = 0;
    let clinicalCount = 0;
    let researchCount = 0;
    const dueTitles: string[] = [];
    const activeTitles: { title: string; domain: Domain }[] = [];

    for (const { item, prepStartDay, dueDay } of intervals) {
      // Overlaps with [startDay, endDay] if prepStartDay <= endDay - 1 and dueDay >= startDay
      if (prepStartDay <= endDay - 1 && dueDay >= startDay) {
        if (item.domain === 'academic') academicCount++;
        if (item.domain === 'clinical') clinicalCount++;
        if (item.domain === 'research') researchCount++;
        activeTitles.push({ title: item.title, domain: item.domain });
      }
      if (dueDay >= startDay && dueDay < endDay) {
        dueTitles.push(item.title);
      }
    }

    const activeDomains: Domain[] = [];
    if (academicCount > 0) activeDomains.push('academic');
    if (clinicalCount > 0) activeDomains.push('clinical');
    if (researchCount > 0) activeDomains.push('research');

    slices.push({
      weekNumber: w + 1,
      programmeYear: progYear,
      yearWeekNumber,
      startDay,
      endDay,
      startIso,
      endIso,
      academicCount,
      clinicalCount,
      researchCount,
      totalActivePrepItems: academicCount + clinicalCount + researchCount,
      activeDomainsCount: activeDomains.length,
      activeDomains,
      dueTitles,
      activeTitles,
    });
  }

  return slices;
}

/**
 * Generates the CSS linear-gradient string for a deadline's Preparation Tail,
 * starting at near-zero opacity (0.03) at Y_start and ramping up to 0.75 at Y_due.
 */
export function buildPreparationGradient(
  rgb: string,
  curve: GradientCurve
): string {
  if (curve === 'exponential') {
    // Exponential opacity ramp: stays subtle early in prep window, intensifies rapidly near deadline
    return `linear-gradient(to bottom,
      rgba(${rgb}, 0.03) 0%,
      rgba(${rgb}, 0.06) 25%,
      rgba(${rgb}, 0.14) 50%,
      rgba(${rgb}, 0.30) 70%,
      rgba(${rgb}, 0.52) 85%,
      rgba(${rgb}, 0.75) 100%
    )`;
  }
  // Linear ramp from 0.03 at Y_start to 0.75 at Y_due
  return `linear-gradient(to bottom, rgba(${rgb}, 0.03) 0%, rgba(${rgb}, 0.75) 100%)`;
}

/**
 * Assigns horizontal sub-lanes for overlapping items within the same domain column
 * so that deadline anchor cards and preparation tails remain legible when concurrent.
 */
export interface PositionedDeadline {
  item: DeadlineItem;
  dueDay: number;
  prepStartDay: number;
  yDue: number;
  yStart: number;
  heightPx: number;
  laneIndex: number;
  totalLanes: number;
}

export function layoutColumnDeadlines(
  items: DeadlineItem[],
  startYear: number,
  pxPerDay: number,
   splitLanes: boolean
): PositionedDeadline[] {
  const sorted = [...items].sort((a, b) => {
    const diff = dateToDayOffset(a.dueDate, startYear) - dateToDayOffset(b.dueDate, startYear);
    if (diff !== 0) return diff;
    return b.prepDurationDays - a.prepDurationDays;
  });

  const base = sorted.map((item) => {
    const dueDay = dateToDayOffset(item.dueDate, startYear);
    const prepDays = Math.max(1, item.prepDurationDays);
    const prepStartDay = dueDay - prepDays;
    const yDue = dueDay * pxPerDay;
    const yStart = prepStartDay * pxPerDay;
    const heightPx = Math.max(4, yDue - yStart);
    return {
      item,
      dueDay,
      prepStartDay,
      yDue,
      yStart,
      heightPx,
      laneIndex: 0,
      totalLanes: 1,
    };
  });

  if (!splitLanes || base.length <= 1) {
    return base;
  }

  // Group into connected overlap clusters
  const clusters: PositionedDeadline[][] = [];
  let currentCluster: PositionedDeadline[] = [];
  let clusterMaxEndDay = -Infinity;

  for (const entry of base) {
    // Include a small visual buffer (e.g., 4 days of card label height) when checking overlap
    const visualBufferDays = Math.ceil(28 / Math.max(1, pxPerDay));
    if (currentCluster.length === 0 || entry.prepStartDay <= clusterMaxEndDay + visualBufferDays) {
      currentCluster.push(entry);
      clusterMaxEndDay = Math.max(clusterMaxEndDay, entry.dueDay);
    } else {
      clusters.push(currentCluster);
      currentCluster = [entry];
      clusterMaxEndDay = entry.dueDay;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Greedily assign lanes within each overlap cluster
  for (const cluster of clusters) {
    const laneEndDays: number[] = [];
    const visualBufferDays = Math.ceil(28 / Math.max(1, pxPerDay));

    for (const entry of cluster) {
      let assignedLane = -1;
      for (let l = 0; l < laneEndDays.length; l++) {
        if (entry.prepStartDay > laneEndDays[l] + visualBufferDays) {
          assignedLane = l;
          laneEndDays[l] = entry.dueDay;
          break;
        }
      }
      if (assignedLane === -1) {
        assignedLane = laneEndDays.length;
        laneEndDays.push(entry.dueDay);
      }
      entry.laneIndex = assignedLane;
    }

    const totalLanes = Math.max(1, laneEndDays.length);
    for (const entry of cluster) {
      entry.totalLanes = totalLanes;
    }
  }

  return base;
}
