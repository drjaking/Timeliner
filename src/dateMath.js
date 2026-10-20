/**
 * Mathematical Date-to-Y-Coordinate Conversion & Load Calculation Utilities
 * Anchored to September 1, Year 1 -> August 31, Year 3 (1,095 days / 156 weeks).
 * Uses UTC midnight arithmetic to prevent UK BST/GMT Daylight Saving drift.
 */
(function (global) {
  const MS_PER_DAY = 86400000;

  const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const MONTH_NAMES_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const DOMAIN_CONFIG = {
    academic: {
      key: 'academic',
      label: 'Academic',
      subtitle: 'Taught Modules, Essays & Examinations',
      hex: '#1E40AF',
      rgb: '30, 64, 175',
      badgeBg: '#EFF6FF',
      badgeText: '#1E40AF',
    },
    clinical: {
      key: 'clinical',
      label: 'Clinical',
      subtitle: 'Placements, Case Reports & Competencies',
      hex: '#0F766E',
      rgb: '15, 118, 110',
      badgeBg: '#F0FDFA',
      badgeText: '#0F766E',
    },
    research: {
      key: 'research',
      label: 'Research',
      subtitle: 'Ethics, Proposal, Thesis & Viva Voce',
      hex: '#991B1B',
      rgb: '153, 27, 27',
      badgeBg: '#FEF2F2',
      badgeText: '#991B1B',
    },
  };

  function parseIsoToUtcMs(isoDate) {
    if (typeof isoDate !== 'string') return NaN;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
    if (!match) return NaN;
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

  function formatUtcMsToIso(utcMs) {
    const d = new Date(utcMs);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getProgrammeStartIso(startYear) {
    return `${startYear}-09-01`;
  }

  function getProgrammeEndIso(startYear) {
    return `${startYear + 3}-09-30`;
  }

  function getTotalProgrammeDays(startYear) {
    const startMs = parseIsoToUtcMs(getProgrammeStartIso(startYear));
    const endMs = parseIsoToUtcMs(getProgrammeEndIso(startYear));
    return Math.round((endMs - startMs) / MS_PER_DAY) + 1;
  }

  function dateToDayOffset(isoDate, startYear) {
    const startMs = parseIsoToUtcMs(getProgrammeStartIso(startYear));
    const targetMs = parseIsoToUtcMs(isoDate);
    if (Number.isNaN(targetMs)) return 0;
    return Math.round((targetMs - startMs) / MS_PER_DAY);
  }

  function dayOffsetToDate(dayOffset, startYear) {
    const startMs = parseIsoToUtcMs(getProgrammeStartIso(startYear));
    return formatUtcMsToIso(startMs + Math.round(dayOffset) * MS_PER_DAY);
  }

  function dateToY(isoDate, startYear, pxPerDay) {
    return dateToDayOffset(isoDate, startYear) * pxPerDay;
  }

  function clampDayOffset(dayOffset, startYear) {
    const maxDay = getTotalProgrammeDays(startYear) - 1;
    return Math.max(0, Math.min(maxDay, Math.round(dayOffset)));
  }

  function formatAcademicDate(isoDate, startYear, includeRelative) {
    if (includeRelative === undefined) includeRelative = true;
    const ms = parseIsoToUtcMs(isoDate);
    if (Number.isNaN(ms)) return isoDate;
    const d = new Date(ms);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = MONTH_NAMES_SHORT[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    if (!includeRelative) return `${day} ${month} ${year}`;

    const offset = dateToDayOffset(isoDate, startYear);
    const progYear = offset < 365 ? 1 : offset < 730 ? 2 : 3;
    const weekNum = Math.floor(offset / 7) + 1;
    return `${day} ${month} ${year} (Y${progYear}·W${weekNum})`;
  }

  function generateYearBoundaries(startYear) {
    return [1, 2, 3].map(function (yr) {
      const calStart = startYear + (yr - 1);
      const calEnd = calStart + 1;
      const startIso = `${calStart}-09-01`;
      const endIso = yr === 3 ? `${calEnd}-09-30` : `${calEnd}-08-31`;
      return {
        programmeYear: yr,
        label: `YEAR ${yr}`,
        calendarSpanLabel: yr === 3 ? `Sep ${calStart} – Sep ${calEnd}` : `Sep ${calStart} – Aug ${calEnd}`,
        startIso: startIso,
        endIso: endIso,
        startDay: dateToDayOffset(startIso, startYear),
        endDay: dateToDayOffset(endIso, startYear) + 1,
      };
    });
  }

  function generateMonthBoundaries(startYear) {
    const months = [];
    for (let i = 0; i < 37; i++) {
      const totalMonth = 8 + i; // 8 = September
      const calYear = startYear + Math.floor(totalMonth / 12);
      const monthIdx = totalMonth % 12;
      const progYear = Math.min(2, Math.floor(i / 12)) + 1;

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
        startIso: startIso,
        startDay: dateToDayOffset(startIso, startYear),
        endDay: dateToDayOffset(nextIso, startYear),
      });
    }
    return months;
  }

  function computeWeeklyLoadSlices(deadlines, startYear) {
    const totalDays = getTotalProgrammeDays(startYear);
    const totalWeeks = Math.ceil(totalDays / 7);

    const intervals = deadlines.map(function (d) {
      const dueDay = dateToDayOffset(d.dueDate, startYear);
      const prepStartDay = dueDay - Math.max(1, Number(d.prepDurationDays) || 1);
      return {
        item: d,
        prepStartDay: prepStartDay,
        dueDay: dueDay,
      };
    });

    const slices = [];
    for (let w = 0; w < totalWeeks; w++) {
      const startDay = w * 7;
      const endDay = Math.min(totalDays, (w + 1) * 7);
      const startIso = dayOffsetToDate(startDay, startYear);
      const endIso = dayOffsetToDate(endDay - 1, startYear);
      const progYear = Math.min(2, Math.floor(startDay / 365)) + 1;
      const yearWeekNumber = (w % 52) + 1;

      let academicCount = 0;
      let clinicalCount = 0;
      let researchCount = 0;
      const activeTitles = [];

      for (let i = 0; i < intervals.length; i++) {
        const entry = intervals[i];
        if (entry.prepStartDay <= endDay - 1 && entry.dueDay >= startDay) {
          if (entry.item.domain === 'academic') academicCount++;
          if (entry.item.domain === 'clinical') clinicalCount++;
          if (entry.item.domain === 'research') researchCount++;
          activeTitles.push({
            title: entry.item.title,
            domain: entry.item.domain,
            dueDate: entry.item.dueDate,
          });
        }
      }

      let activeDomainsCount = 0;
      if (academicCount > 0) activeDomainsCount++;
      if (clinicalCount > 0) activeDomainsCount++;
      if (researchCount > 0) activeDomainsCount++;

      slices.push({
        weekNumber: w + 1,
        programmeYear: progYear,
        yearWeekNumber: yearWeekNumber,
        startDay: startDay,
        endDay: endDay,
        startIso: startIso,
        endIso: endIso,
        academicCount: academicCount,
        clinicalCount: clinicalCount,
        researchCount: researchCount,
        totalActivePrepItems: academicCount + clinicalCount + researchCount,
        activeDomainsCount: activeDomainsCount,
        activeTitles: activeTitles,
      });
    }
    return slices;
  }

  function buildPreparationGradient(rgb, curve) {
    if (curve === 'exponential') {
      return `linear-gradient(to bottom, rgba(${rgb}, 0.03) 0%, rgba(${rgb}, 0.06) 25%, rgba(${rgb}, 0.14) 50%, rgba(${rgb}, 0.30) 70%, rgba(${rgb}, 0.52) 85%, rgba(${rgb}, 0.75) 100%)`;
    }
    return `linear-gradient(to bottom, rgba(${rgb}, 0.03) 0%, rgba(${rgb}, 0.75) 100%)`;
  }

  function layoutColumnDeadlines(items, startYear, pxPerDay, splitLanes) {
    const sorted = items.slice().sort(function (a, b) {
      const diff =
        dateToDayOffset(a.dueDate, startYear) -
        dateToDayOffset(b.dueDate, startYear);
      if (diff !== 0) return diff;
      return b.prepDurationDays - a.prepDurationDays;
    });

    const base = sorted.map(function (item) {
      const dueDay = dateToDayOffset(item.dueDate, startYear);
      const prepDays = Math.max(1, Number(item.prepDurationDays) || 1);
      const prepStartDay = dueDay - prepDays;
      const yDue = dueDay * pxPerDay;
      const yStart = prepStartDay * pxPerDay;
      const heightPx = Math.max(4, yDue - yStart);
      return {
        item: item,
        dueDay: dueDay,
        prepStartDay: prepStartDay,
        yDue: yDue,
        yStart: yStart,
        heightPx: heightPx,
        laneIndex: 0,
        totalLanes: 1,
      };
    });

    if (!splitLanes || base.length <= 1) return base;

    const clusters = [];
    let currentCluster = [];
    let clusterMaxEndDay = -Infinity;
    const visualBufferDays = Math.ceil(30 / Math.max(1, pxPerDay));

    for (let i = 0; i < base.length; i++) {
      const entry = base[i];
      if (
        currentCluster.length === 0 ||
        entry.prepStartDay <= clusterMaxEndDay + visualBufferDays
      ) {
        currentCluster.push(entry);
        clusterMaxEndDay = Math.max(clusterMaxEndDay, entry.dueDay);
      } else {
        clusters.push(currentCluster);
        currentCluster = [entry];
        clusterMaxEndDay = entry.dueDay;
      }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    for (let c = 0; c < clusters.length; c++) {
      const cluster = clusters[c];
      const laneEndDays = [];
      for (let j = 0; j < cluster.length; j++) {
        const entry = cluster[j];
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
      for (let j = 0; j < cluster.length; j++) {
        cluster[j].totalLanes = totalLanes;
      }
    }

    return base;
  }

  global.TimelinerDateMath = {
    DOMAIN_CONFIG: DOMAIN_CONFIG,
    parseIsoToUtcMs: parseIsoToUtcMs,
    formatUtcMsToIso: formatUtcMsToIso,
    getProgrammeStartIso: getProgrammeStartIso,
    getProgrammeEndIso: getProgrammeEndIso,
    getTotalProgrammeDays: getTotalProgrammeDays,
    dateToDayOffset: dateToDayOffset,
    dayOffsetToDate: dayOffsetToDate,
    dateToY: dateToY,
    clampDayOffset: clampDayOffset,
    formatAcademicDate: formatAcademicDate,
    generateYearBoundaries: generateYearBoundaries,
    generateMonthBoundaries: generateMonthBoundaries,
    computeWeeklyLoadSlices: computeWeeklyLoadSlices,
    buildPreparationGradient: buildPreparationGradient,
    layoutColumnDeadlines: layoutColumnDeadlines,
  };
})(window);
