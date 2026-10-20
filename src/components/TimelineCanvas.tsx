import React, { useMemo, useRef, useState } from 'react';
import {
  DeadlineItem,
  Domain,
  DOMAIN_CONFIG,
  GradientCurve,
  OverlapLayout,
  PlacementBlock,
  SnapIncrement,
  TermBlock,
} from '../types/timeline';
import {
  buildPreparationGradient,
  clampDayOffset,
  dateToDayOffset,
  dayOffsetToDate,
  formatAcademicDate,
  generateMonthBoundaries,
  generateYearBoundaries,
  getTotalProgrammeDays,
  layoutColumnDeadlines,
  PositionedDeadline,
  WeekSliceLoad,
} from '../utils/dateMath';
import { Edit3, GripHorizontal, Upload, PlusCircle } from 'lucide-react';

interface TimelineCanvasProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  programmeStartYear: number;
  deadlines: DeadlineItem[];
  terms: TermBlock[];
  placements: PlacementBlock[];
  pxPerDay: number;
  snapDays: SnapIncrement;
  gradientCurve: GradientCurve;
  overlapLayout: OverlapLayout;
  weeklyLoadSlices: WeekSliceLoad[];
  onUpdateDeadline: (updated: DeadlineItem) => void;
  onSelectDeadlineForEdit: (item: DeadlineItem) => void;
  onSelectTermForEdit: (term: TermBlock) => void;
  onOpenImportExport: () => void;
}

interface ActiveDragState {
  deadlineId: string;
  mode: 'move-due' | 'resize-prep';
  initialClientY: number;
  initialDueDay: number;
  initialPrepDays: number;
  currentDueDay: number;
  currentPrepDays: number;
}

function classifyTermStyle(name: string): {
  bg: string;
  border: string;
  text: string;
  tag: string;
} {
  const lower = name.toLowerCase();
  if (lower.includes('reading')) {
    return {
      bg: 'bg-amber-50/90',
      border: 'border-amber-500',
      text: 'text-amber-950',
      tag: 'READING WEEK',
    };
  }
  if (
    lower.includes('vacation') ||
    lower.includes('holiday') ||
    lower.includes('break') ||
    lower.includes('closure') ||
    lower.includes('christmas') ||
    lower.includes('easter') ||
    lower.includes('summer')
  ) {
    return {
      bg: 'bg-slate-100/90',
      border: 'border-slate-400',
      text: 'text-slate-700',
      tag: 'VACATION / RECESS',
    };
  }
  return {
    bg: 'bg-slate-200/75',
    border: 'border-[#1E293B]',
    text: 'text-[#1E293B]',
    tag: 'UCL TERM',
  };
}

export const TimelineCanvas: React.FC<TimelineCanvasProps> = ({
  scrollContainerRef,
  programmeStartYear,
  deadlines,
  terms,
  pxPerDay,
  snapDays,
  gradientCurve,
  overlapLayout,
  weeklyLoadSlices,
  onUpdateDeadline,
  onSelectDeadlineForEdit,
  onSelectTermForEdit,
  onOpenImportExport,
}) => {
  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const [hoveredWeek, setHoveredWeek] = useState<WeekSliceLoad | null>(null);
  const [hoveredDeadlineId, setHoveredDeadlineId] = useState<string | null>(null);

  const dragRef = useRef<ActiveDragState | null>(null);

  const totalDays = useMemo(
    () => getTotalProgrammeDays(programmeStartYear),
    [programmeStartYear]
  );
  const canvasHeightPx = totalDays * pxPerDay;

  const yearBoundaries = useMemo(
    () => generateYearBoundaries(programmeStartYear),
    [programmeStartYear]
  );
  const monthBoundaries = useMemo(
    () => generateMonthBoundaries(programmeStartYear),
    [programmeStartYear]
  );

  // Apply live drag override if an item is currently being dragged or resized
  const effectiveDeadlines = useMemo(() => {
    if (!dragState) return deadlines;
    return deadlines.map((d) => {
      if (d.id !== dragState.deadlineId) return d;
      return {
        ...d,
        dueDate: dayOffsetToDate(dragState.currentDueDay, programmeStartYear),
        prepDurationDays: dragState.currentPrepDays,
      };
    });
  }, [deadlines, dragState, programmeStartYear]);

  const splitLanes = overlapLayout === 'lanes';

  const positionedByDomain = useMemo(() => {
    const domains: Record<Domain, PositionedDeadline[]> = {
      academic: layoutColumnDeadlines(
        effectiveDeadlines.filter((d) => d.domain === 'academic'),
        programmeStartYear,
        pxPerDay,
        splitLanes
      ),
      clinical: layoutColumnDeadlines(
        effectiveDeadlines.filter((d) => d.domain === 'clinical'),
        programmeStartYear,
        pxPerDay,
        splitLanes
      ),
      research: layoutColumnDeadlines(
        effectiveDeadlines.filter((d) => d.domain === 'research'),
        programmeStartYear,
        pxPerDay,
        splitLanes
      ),
    };
    return domains;
  }, [effectiveDeadlines, programmeStartYear, pxPerDay, splitLanes]);

  const startPointerInteraction = (
    e: React.PointerEvent,
    item: DeadlineItem,
    mode: 'move-due' | 'resize-prep'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const initialDueDay = dateToDayOffset(item.dueDate, programmeStartYear);
    const initialPrepDays = Math.max(1, item.prepDurationDays);

    const nextState: ActiveDragState = {
      deadlineId: item.id,
      mode,
      initialClientY: e.clientY,
      initialDueDay,
      initialPrepDays,
      currentDueDay: initialDueDay,
      currentPrepDays: initialPrepDays,
    };

    dragRef.current = nextState;
    setDragState(nextState);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const active = dragRef.current;
      if (!active) return;

      const deltaPx = moveEvent.clientY - active.initialClientY;
      const rawDeltaDays = deltaPx / pxPerDay;
      const snappedDeltaDays =
        Math.round(rawDeltaDays / snapDays) * snapDays;

      if (active.mode === 'move-due') {
        const nextDueDay = clampDayOffset(
          active.initialDueDay + snappedDeltaDays,
          programmeStartYear
        );
        const updated: ActiveDragState = {
          ...active,
          currentDueDay: nextDueDay,
        };
        dragRef.current = updated;
        setDragState(updated);
      } else {
        // Resizing top edge (Y_start): dragging UP (negative deltaPx) increases prepDurationDays
        const nextPrepDays = Math.max(
          snapDays,
          Math.min(365, active.initialPrepDays - snappedDeltaDays)
        );
        const updated: ActiveDragState = {
          ...active,
          currentPrepDays: nextPrepDays,
        };
        dragRef.current = updated;
        setDragState(updated);
      }
    };

    const handlePointerUp = () => {
      const finalState = dragRef.current;
      dragRef.current = null;
      setDragState(null);

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (
        finalState &&
        (finalState.currentDueDay !== finalState.initialDueDay ||
          finalState.currentPrepDays !== finalState.initialPrepDays)
      ) {
        onUpdateDeadline({
          ...item,
          dueDate: dayOffsetToDate(finalState.currentDueDay, programmeStartYear),
          prepDurationDays: finalState.currentPrepDays,
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const isEmptyState = deadlines.length === 0 && terms.length === 0;

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto overflow-x-auto bg-[#F8FAFC] relative"
    >
      {/* Minimum width container so 4 columns + sticky axis remain legible */}
      <div className="min-w-[1040px] relative">
        {/* Sticky Column Header Row */}
        <div className="sticky top-0 z-30 grid grid-cols-[190px_1fr_1fr_1fr_230px] bg-[#F8FAFC] border-b-2 border-[#1E293B] shadow-sm">
          {/* Axis & Heat-Strip Header */}
          <div className="sticky left-0 z-40 bg-[#F1F5F9] border-r border-[#CBD5E1] px-2.5 py-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E293B]">
                Time Axis
              </div>
              <div className="text-[10px] font-mono text-slate-600">
                Yr · Mo · Wk
              </div>
            </div>
            <div className="text-right border-l border-[#CBD5E1] pl-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#1E293B]">
                Prep Load
              </div>
              <div className="flex items-center justify-end gap-1 text-[9px] font-mono">
                <span className="text-[#1E40AF] font-bold">A</span>
                <span className="text-[#0F766E] font-bold">C</span>
                <span className="text-[#991B1B] font-bold">R</span>
              </div>
            </div>
          </div>

          {/* Column 1–3 Headers (Academic, Clinical, Research) */}
          {(['academic', 'clinical', 'research'] as Domain[]).map((domainKey) => {
            const cfg = DOMAIN_CONFIG[domainKey];
            const count = positionedByDomain[domainKey].length;
            return (
              <div
                key={domainKey}
                className="bg-white border-r border-[#CBD5E1] px-3.5 py-2 flex items-center justify-between"
                style={{ borderTop: `4px solid ${cfg.hex}` }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5"
                      style={{ backgroundColor: cfg.hex }}
                    />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E293B]">
                      {cfg.label}
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {cfg.subtitle}
                  </p>
                </div>
                <span
                  className="text-xs font-mono font-semibold px-2 py-0.5 border"
                  style={{
                    backgroundColor: cfg.badgeBg,
                    color: cfg.badgeText,
                    borderColor: cfg.hex,
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}

          {/* Column 4 Header: UCL Term Dates */}
          <div
            className="bg-[#F8FAFC] px-3.5 py-2 flex items-center justify-between"
            style={{ borderTop: '4px solid #1E293B' }}
          >
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E293B]">
                UCL Term Dates
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Terms 1–3 &amp; Vacation Blocks
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-200 text-[#1E293B] border border-slate-400">
              {terms.length}
            </span>
          </div>
        </div>

        {/* Empty Dataset Callout Banner (Floating cleanly over the top of Year 1 without inventing fake data) */}
        {isEmptyState && (
          <div className="sticky top-16 z-20 mx-auto max-w-2xl mt-8 pointer-events-auto">
            <div className="bg-white border-2 border-[#1E293B] p-5 shadow-md mx-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
                    Clean Longitudinal Canvas Ready · Zero Hallucinated Data
                  </div>
                  <h3 className="text-sm font-bold text-[#1E293B]">
                    Awaiting Academic, Clinical, Research &amp; UCL Term Dataset
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    The 3-year vertical coordinate system is initialized from{' '}
                    <span className="font-mono font-semibold text-[#1E293B]">
                      01 Sep {programmeStartYear} (Year 1)
                    </span>{' '}
                    through{' '}
                    <span className="font-mono font-semibold text-[#1E293B]">
                      31 Aug {programmeStartYear + 3} (Year 3)
                    </span>
                    . Supply your course deadlines and UCL institutional term dates via bulk JSON/CSV import or manual entry.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenImportExport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1E293B] text-white hover:bg-slate-800"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Open Bulk JSON / CSV Importer</span>
                    </button>
                    <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                      <PlusCircle className="w-3.5 h-3.5" /> Use &ldquo;Add Entry&rdquo; in the top bar for single items
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Synchronized 4-Column + Sticky Axis Body */}
        <div
          className="grid grid-cols-[190px_1fr_1fr_1fr_230px] relative"
          style={{ height: `${canvasHeightPx}px` }}
        >
          {/* Full-Width Horizontal Gridlines Layer (Years, Months, Weeks) */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {/* Weekly Gridlines */}
            {pxPerDay >= 2.5 &&
              weeklyLoadSlices.map((wk) => (
                <div
                  key={`wk-line-${wk.weekNumber}`}
                  className="w-full border-t border-[#E2E8F0]"
                  style={{
                    position: 'absolute',
                    top: `${wk.startDay * pxPerDay}px`,
                  }}
                />
              ))}

            {/* Monthly Gridlines */}
            {monthBoundaries.map((mo) => (
              <div
                key={`mo-line-${mo.index}`}
                className="w-full border-t border-[#CBD5E1]"
                style={{
                  position: 'absolute',
                  top: `${mo.startDay * pxPerDay}px`,
                }}
              />
            ))}

            {/* Programme Year Boundaries (Year 1, Year 2, Year 3) */}
            {yearBoundaries.map((yr) => (
              <div
                key={`yr-line-${yr.programmeYear}`}
                className="w-full border-t-2 border-[#1E293B]"
                style={{
                  position: 'absolute',
                  top: `${yr.startDay * pxPerDay}px`,
                }}
              />
            ))}
          </div>

          {/* STICKY LEFT AXIS COLUMN + CROSS-COLUMN PREP LOAD HEAT-STRIP */}
          <div
            className="sticky left-0 z-20 bg-[#F8FAFC] border-r border-[#CBD5E1] relative select-none"
            style={{ height: `${canvasHeightPx}px` }}
          >
            {/* Year Band Labels (Left-most 26px rail) */}
            {yearBoundaries.map((yr) => {
              const topPx = yr.startDay * pxPerDay;
              const heightPx = (yr.endDay - yr.startDay) * pxPerDay;
              return (
                <div
                  key={`axis-yr-${yr.programmeYear}`}
                  className="absolute left-0 w-[26px] border-r border-[#CBD5E1] border-b-2 border-b-[#1E293B] bg-[#E2E8F0]/70 flex flex-col items-center justify-between py-3"
                  style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                >
                  <span
                    className="text-[10px] font-bold tracking-widest text-[#1E293B] font-mono"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {yr.label} ({yr.calendarSpanLabel})
                  </span>
                  <span
                    className="text-[9px] font-mono text-slate-600"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {yr.startIso}
                  </span>
                </div>
              );
            })}

            {/* Month Labels (x: 26px..102px) */}
            {monthBoundaries.map((mo) => {
              const topPx = mo.startDay * pxPerDay;
              const heightPx = (mo.endDay - mo.startDay) * pxPerDay;
              const isSept = mo.monthIndex === 8;
              return (
                <div
                  key={`axis-mo-${mo.index}`}
                  className={`absolute left-[26px] w-[76px] border-r border-[#CBD5E1] border-t ${
                    isSept ? 'border-t-[#1E293B] bg-slate-200/50' : 'border-t-[#CBD5E1] bg-[#F8FAFC]'
                  } px-1.5 py-1 overflow-hidden`}
                  style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-bold text-[#1E293B]">
                      {mo.shortName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      &rsquo;{String(mo.calendarYear).slice(2)}
                    </span>
                  </div>
                  {heightPx >= 36 && (
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                      Y{mo.programmeYear} · 01 {mo.shortName}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Week Ticks + Cross-Column Concurrent Load Heat-Strip (x: 102px..189px) */}
            {weeklyLoadSlices.map((wk) => {
              const topPx = wk.startDay * pxPerDay;
              const heightPx = (wk.endDay - wk.startDay) * pxPerDay;

              // Determine formal heat-strip color based on cross-column overlap
              let heatBg = 'bg-transparent';
              let rightIndicatorBorder = '';
              if (wk.activeDomainsCount === 3) {
                heatBg = 'bg-red-200/85';
                rightIndicatorBorder = 'border-r-4 border-r-[#991B1B]';
              } else if (wk.activeDomainsCount === 2) {
                heatBg = 'bg-amber-200/75';
                rightIndicatorBorder = 'border-r-4 border-r-amber-700';
              } else if (wk.totalActivePrepItems >= 2) {
                heatBg = 'bg-slate-200/80';
              } else if (wk.totalActivePrepItems === 1) {
                heatBg = 'bg-slate-100';
              }

              return (
                <div
                  key={`axis-wk-${wk.weekNumber}`}
                  onMouseEnter={() => setHoveredWeek(wk)}
                  onMouseLeave={() => setHoveredWeek(null)}
                  className={`absolute left-[102px] right-0 border-t border-[#E2E8F0] px-1.5 flex items-center justify-between cursor-default transition-colors ${heatBg} ${rightIndicatorBorder}`}
                  style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                >
                  {/* Week Tick Label */}
                  <span className="text-[9px] font-mono text-slate-600 leading-none">
                    {heightPx >= 13 ? `W${wk.weekNumber}` : ''}
                  </span>

                  {/* Domain Activity Pips (Academic, Clinical, Research) + Load Tally */}
                  {wk.totalActivePrepItems > 0 && heightPx >= 10 && (
                    <div className="flex items-center gap-0.5">
                      <span
                        className="w-2 h-2 inline-block border border-white/60"
                        style={{
                          backgroundColor:
                            wk.academicCount > 0 ? DOMAIN_CONFIG.academic.hex : 'transparent',
                        }}
                      />
                      <span
                        className="w-2 h-2 inline-block border border-white/60"
                        style={{
                          backgroundColor:
                            wk.clinicalCount > 0 ? DOMAIN_CONFIG.clinical.hex : 'transparent',
                        }}
                      />
                      <span
                        className="w-2 h-2 inline-block border border-white/60"
                        style={{
                          backgroundColor:
                            wk.researchCount > 0 ? DOMAIN_CONFIG.research.hex : 'transparent',
                        }}
                      />
                      <span className="text-[9px] font-mono font-bold text-[#1E293B] ml-0.5 w-3 text-right">
                        {wk.totalActivePrepItems}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Floating Tooltip for Hovered Week on the Load Heat-Strip */}
            {hoveredWeek && hoveredWeek.totalActivePrepItems > 0 && (
              <div
                className="fixed left-[198px] top-28 z-50 w-72 bg-white border-2 border-[#1E293B] p-3 shadow-lg pointer-events-none text-xs"
              >
                <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-1.5 mb-2">
                  <span className="font-bold font-mono text-[#1E293B]">
                    Week {hoveredWeek.weekNumber} (Y{hoveredWeek.programmeYear} · W{hoveredWeek.yearWeekNumber})
                  </span>
                  <span className="font-mono text-[10px] text-slate-600">
                    {hoveredWeek.startIso} → {hoveredWeek.endIso}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2 text-[11px] font-mono">
                  <span className="px-1.5 py-0.5 bg-blue-50 text-[#1E40AF] border border-blue-200">
                    Acad: {hoveredWeek.academicCount}
                  </span>
                  <span className="px-1.5 py-0.5 bg-teal-50 text-[#0F766E] border border-teal-200">
                    Clin: {hoveredWeek.clinicalCount}
                  </span>
                  <span className="px-1.5 py-0.5 bg-red-50 text-[#991B1B] border border-red-200">
                    Res: {hoveredWeek.researchCount}
                  </span>
                </div>
                {hoveredWeek.activeDomainsCount >= 2 && (
                  <div className="mb-2 px-2 py-1 bg-amber-50 border border-amber-400 text-amber-950 font-semibold text-[11px]">
                    {hoveredWeek.activeDomainsCount === 3
                      ? '3-Domain Preparation Collision'
                      : 'Multi-Domain Preparation Overlap'}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Active Preparation Windows ({hoveredWeek.activeTitles.length}):
                  </div>
                  {hoveredWeek.activeTitles.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] truncate">
                      <span
                        className="w-2 h-2 shrink-0"
                        style={{ backgroundColor: DOMAIN_CONFIG[entry.domain].hex }}
                      />
                      <span className="truncate text-[#1E293B]">{entry.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* COLUMNS 1–3: ACADEMIC, CLINICAL, RESEARCH */}
          {(['academic', 'clinical', 'research'] as Domain[]).map((domainKey) => {
            const domainMeta = DOMAIN_CONFIG[domainKey];
            const items = positionedByDomain[domainKey];

            return (
              <div
                key={`col-${domainKey}`}
                className="relative border-r border-[#CBD5E1]"
                style={{ height: `${canvasHeightPx}px` }}
              >
                {items.map((pos) => {
                  const {
                    item,
                    dueDay,
                    prepStartDay,
                    yDue,
                    yStart,
                    heightPx,
                    laneIndex,
                    totalLanes,
                  } = pos;

                  const isDraggingThis = dragState?.deadlineId === item.id;
                  const isHovered = hoveredDeadlineId === item.id;

                  // Horizontal lane calculation inside the column
                  const widthPct = 100 / totalLanes;
                  const leftPct = laneIndex * widthPct;

                  const prepStartIso = dayOffsetToDate(prepStartDay, programmeStartYear);
                  const gradientCss = buildPreparationGradient(
                    domainMeta.rgb,
                    gradientCurve
                  );

                  // Clamp top if preparation window extends before Sep 1, Year 1
                  const clampedYStart = Math.max(0, yStart);
                  const clampedHeightPx = Math.max(4, yDue - clampedYStart);

                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredDeadlineId(item.id)}
                      onMouseLeave={() => setHoveredDeadlineId(null)}
                      className={`absolute group transition-shadow ${
                        isDraggingThis
                          ? 'z-40 ring-2 ring-[#1E293B] shadow-xl'
                          : isHovered
                          ? 'z-30 shadow-md'
                          : 'z-10'
                      }`}
                      style={{
                        top: `${clampedYStart}px`,
                        height: `${clampedHeightPx}px`,
                        left: `calc(${leftPct}% + 4px)`,
                        width: `calc(${widthPct}% - 8px)`,
                      }}
                    >
                      {/* Preparation Tail (Vertical Gradient Region from Y_start to Y_due) */}
                      <div
                        onPointerDown={(e) =>
                          startPointerInteraction(e, item, 'move-due')
                        }
                        className="w-full h-full relative cursor-grab active:cursor-grabbing border-x"
                        style={{
                          background: gradientCss,
                          borderColor: `rgba(${domainMeta.rgb}, 0.28)`,
                        }}
                        title={`${item.title}\nDue: ${item.dueDate}\nPrep Start: ${prepStartIso} (${item.prepDurationDays} days)\nDrag body vertically to reschedule due date; drag top edge to resize preparation window.`}
                      >
                        {/* Top Edge Resize Handle (Y_start) */}
                        <div
                          onPointerDown={(e) =>
                            startPointerInteraction(e, item, 'resize-prep')
                          }
                          className="absolute -top-1.5 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center group/resize z-20"
                          title="Drag top edge vertically to lengthen or shorten preparation duration"
                        >
                          <div
                            className="w-full h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
                            style={{
                              borderTop: `2px dashed ${domainMeta.hex}`,
                            }}
                          />
                          <span
                            className="px-1.5 py-0.2 bg-white border text-[9px] font-mono leading-tight shadow-sm flex items-center gap-0.5"
                            style={{
                              borderColor: domainMeta.hex,
                              color: domainMeta.hex,
                            }}
                          >
                            <GripHorizontal className="w-2.5 h-2.5" />
                            <span>
                              {item.prepDurationDays}d (
                              {(item.prepDurationDays / 7).toFixed(1)}w)
                            </span>
                          </span>
                        </div>

                        {/* Subtle internal preparation start marker when tall enough */}
                        {clampedHeightPx >= 44 && (
                          <div className="pt-2.5 px-1.5 text-[10px] font-mono text-slate-700/80 opacity-0 group-hover:opacity-100 transition-opacity truncate pointer-events-none">
                            Prep: {prepStartIso}
                          </div>
                        )}
                      </div>

                      {/* Solid High-Contrast Deadline Anchor Bar & Label Card at Y_due */}
                      <div
                        onPointerDown={(e) =>
                          startPointerInteraction(e, item, 'move-due')
                        }
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onSelectDeadlineForEdit(item);
                        }}
                        className="absolute left-0 right-0 cursor-grab active:cursor-grabbing"
                        style={{
                          bottom: 0,
                          transform: 'translateY(100%)',
                        }}
                      >
                        {/* High-contrast horizontal anchor rule right on Y_due */}
                        <div
                          className="w-full h-[3px]"
                          style={{ backgroundColor: domainMeta.hex }}
                        />

                        {/* Utilitarian Anchor Card */}
                        <div
                          className="bg-white border border-t-0 px-2 py-1 shadow-sm flex items-start justify-between gap-1"
                          style={{
                            borderColor: domainMeta.hex,
                            borderLeftWidth: '4px',
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-[#1E293B] leading-tight truncate">
                              {item.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono text-slate-600 mt-0.5">
                              <span
                                className="font-semibold"
                                style={{ color: domainMeta.hex }}
                              >
                                {formatAcademicDate(
                                  item.dueDate,
                                  programmeStartYear,
                                  true
                                )}
                              </span>
                            </div>
                            {item.notes && (
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                {item.notes}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDeadlineForEdit(item);
                            }}
                            className="p-0.5 text-slate-400 hover:text-[#1E293B] shrink-0"
                            title="Edit or delete deadline"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Real-time Floating Telemetry Tooltip during Drag/Resize */}
                      {isDraggingThis && dragState && (
                        <div
                          className="absolute -right-2 translate-x-full bottom-0 z-50 w-60 bg-[#1E293B] text-white p-2.5 shadow-xl pointer-events-none text-[11px] font-mono"
                        >
                          <div className="font-bold text-white border-b border-slate-600 pb-1 mb-1 truncate">
                            {dragState.mode === 'move-due'
                              ? 'RESCHEDULING DEADLINE'
                              : 'RESIZING PREP WINDOW'}
                          </div>
                          <div className="space-y-0.5">
                            <div>
                              Due:{' '}
                              <span className="text-sky-300 font-semibold">
                                {formatAcademicDate(
                                  item.dueDate,
                                  programmeStartYear,
                                  true
                                )}
                              </span>
                            </div>
                            <div>
                              Prep Start:{' '}
                              <span className="text-emerald-300">
                                {prepStartIso}
                              </span>
                            </div>
                            <div>
                              Duration:{' '}
                              <span className="text-amber-300 font-semibold">
                                {item.prepDurationDays}d (
                                {(item.prepDurationDays / 7).toFixed(1)}w)
                              </span>
                            </div>
                            {dragState.mode === 'move-due' && (
                              <div>
                                Shift:{' '}
                                {dueDay - dragState.initialDueDay >= 0 ? '+' : ''}
                                {dueDay - dragState.initialDueDay}d
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* COLUMN 4: UCL TERM DATES */}
          <div
            className="relative bg-slate-50/60"
            style={{ height: `${canvasHeightPx}px` }}
          >
            {terms.map((term) => {
              const startDay = dateToDayOffset(term.startDate, programmeStartYear);
              const endDay = dateToDayOffset(term.endDate, programmeStartYear) + 1;
              const yStart = Math.max(0, startDay * pxPerDay);
              const yEnd = Math.min(canvasHeightPx, endDay * pxPerDay);
              const heightPx = Math.max(16, yEnd - yStart);
              const durationDays = Math.max(1, endDay - startDay);
              const style = classifyTermStyle(term.name);

              return (
                <div
                  key={term.id}
                  onClick={() => onSelectTermForEdit(term)}
                  className={`absolute left-2 right-2 border-l-4 border-y border-r px-2.5 py-1.5 cursor-pointer hover:brightness-95 transition-all overflow-hidden flex flex-col justify-between ${style.bg} ${style.border} ${style.text}`}
                  style={{
                    top: `${yStart}px`,
                    height: `${heightPx}px`,
                  }}
                  title={`${term.name}\n${term.startDate} to ${term.endDate} (${durationDays} days / ${(durationDays / 7).toFixed(1)} weeks)\nClick to edit`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-mono uppercase tracking-wider opacity-75">
                        {style.tag}
                      </span>
                      <span className="text-[9px] font-mono opacity-75">
                        {(durationDays / 7).toFixed(1)}w
                      </span>
                    </div>
                    <div className="text-xs font-bold leading-snug mt-0.5">
                      {term.name}
                    </div>
                    {heightPx >= 42 && (
                      <div className="text-[10px] font-mono mt-0.5 opacity-85">
                        {term.startDate} → {term.endDate}
                      </div>
                    )}
                  </div>

                  {heightPx >= 75 && (
                    <div className="text-[9px] font-mono opacity-70 border-t border-current/20 pt-1">
                      End: {term.endDate}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
