import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DeadlineItem,
  GradientCurve,
  OverlapLayout,
  ProgrammeState,
  SnapIncrement,
  TermBlock,
} from './types/timeline';
import {
  computeWeeklyLoadSlices,
  generateYearBoundaries,
} from './utils/dateMath';
import { HeaderControls } from './components/HeaderControls';
import { TimelineCanvas } from './components/TimelineCanvas';
import { BulkImportExportModal } from './components/BulkImportExportModal';
import { EditItemModal } from './components/EditItemModal';

import {
  SEEDED_ALL_DEADLINES,
  SEEDED_PLACEMENTS,
  SEEDED_TERMS,
} from './data/seededSchedule';

const STORAGE_KEY = 'timeliner_programme_state_v5';

const DEFAULT_EMPTY_STATE: ProgrammeState = {
  programmeStartYear: 2026, // Anchors September 1, Year 1 -> September 30, Year 3+1
  deadlines: SEEDED_ALL_DEADLINES,
  terms: SEEDED_TERMS,
  placements: SEEDED_PLACEMENTS,
  pxPerDay: 4,
  snapDays: 1,
  gradientCurve: 'linear',
  overlapLayout: 'lanes',
};

function loadInitialState(): ProgrammeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<ProgrammeState>;
    return {
      programmeStartYear:
        typeof parsed.programmeStartYear === 'number'
          ? parsed.programmeStartYear
          : DEFAULT_EMPTY_STATE.programmeStartYear,
      deadlines: Array.isArray(parsed.deadlines)
        ? parsed.deadlines
        : DEFAULT_EMPTY_STATE.deadlines,
      terms: Array.isArray(parsed.terms)
        ? parsed.terms
        : DEFAULT_EMPTY_STATE.terms,
      placements: Array.isArray(parsed.placements)
        ? parsed.placements
        : DEFAULT_EMPTY_STATE.placements,
      pxPerDay:
        typeof parsed.pxPerDay === 'number' && parsed.pxPerDay >= 2 && parsed.pxPerDay <= 12
          ? parsed.pxPerDay
          : DEFAULT_EMPTY_STATE.pxPerDay,
      snapDays: parsed.snapDays === 7 ? 7 : 1,
      gradientCurve:
        parsed.gradientCurve === 'exponential' ? 'exponential' : 'linear',
      overlapLayout:
        parsed.overlapLayout === 'compound' ? 'compound' : 'lanes',
    };
  } catch {
    return DEFAULT_EMPTY_STATE;
  }
}

function makeUuid(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const App: React.FC = () => {
  const [state, setState] = useState<ProgrammeState>(loadInitialState);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<DeadlineItem | null>(null);
  const [editingTerm, setEditingTerm] = useState<TermBlock | null>(null);
  const [collisionCycleIndex, setCollisionCycleIndex] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync state to localStorage automatically
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to persist state to localStorage:', e);
    }
  }, [state]);

  const weeklyLoadSlices = useMemo(
    () => computeWeeklyLoadSlices(state.deadlines, state.programmeStartYear),
    [state.deadlines, state.programmeStartYear]
  );

  const collisionWeeks = useMemo(
    () => weeklyLoadSlices.filter((w) => w.activeDomainsCount >= 2),
    [weeklyLoadSlices]
  );

  const triCollisionWeeksCount = useMemo(
    () => weeklyLoadSlices.filter((w) => w.activeDomainsCount === 3).length,
    [weeklyLoadSlices]
  );

  const handleAddDeadline = (item: Omit<DeadlineItem, 'id'>) => {
    const newItem: DeadlineItem = {
      ...item,
      id: makeUuid('dl'),
    };
    setState((prev) => ({
      ...prev,
      deadlines: [...prev.deadlines, newItem],
    }));
  };

  const handleAddTerm = (term: Omit<TermBlock, 'id'>) => {
    const newTerm: TermBlock = {
      ...term,
      id: makeUuid('term'),
    };
    setState((prev) => ({
      ...prev,
      terms: [...prev.terms, newTerm],
    }));
  };

  const handleUpdateDeadline = (updated: DeadlineItem) => {
    setState((prev) => ({
      ...prev,
      deadlines: prev.deadlines.map((d) => (d.id === updated.id ? updated : d)),
    }));
  };

  const handleDeleteDeadline = (id: string) => {
    setState((prev) => ({
      ...prev,
      deadlines: prev.deadlines.filter((d) => d.id !== id),
    }));
  };

  const handleUpdateTerm = (updated: TermBlock) => {
    setState((prev) => ({
      ...prev,
      terms: prev.terms.map((t) => (t.id === updated.id ? updated : t)),
    }));
  };

  const handleDeleteTerm = (id: string) => {
    setState((prev) => ({
      ...prev,
      terms: prev.terms.filter((t) => t.id !== id),
    }));
  };

  const handleImportDataset = (
    payload: {
      deadlines: DeadlineItem[];
      terms: TermBlock[];
      detectedStartYear?: number;
    },
    mode: 'merge' | 'replace'
  ) => {
    setState((prev) => {
      const shouldAdoptDetectedYear =
        payload.detectedStartYear !== undefined &&
        (mode === 'replace' ||
          (prev.deadlines.length === 0 && prev.terms.length === 0));

      const nextStartYear = shouldAdoptDetectedYear
        ? payload.detectedStartYear!
        : prev.programmeStartYear;

      if (mode === 'replace') {
        return {
          ...prev,
          programmeStartYear: nextStartYear,
          deadlines: payload.deadlines,
          terms: payload.terms,
        };
      }

      // Merge by ID or append
      const existingDlIds = new Set(prev.deadlines.map((d) => d.id));
      const mergedDeadlines = [
        ...prev.deadlines,
        ...payload.deadlines.map((d) =>
          existingDlIds.has(d.id) ? { ...d, id: makeUuid('dl') } : d
        ),
      ];

      const existingTermIds = new Set(prev.terms.map((t) => t.id));
      const mergedTerms = [
        ...prev.terms,
        ...payload.terms.map((t) =>
          existingTermIds.has(t.id) ? { ...t, id: makeUuid('term') } : t
        ),
      ];

      return {
        ...prev,
        programmeStartYear: nextStartYear,
        deadlines: mergedDeadlines,
        terms: mergedTerms,
      };
    });
  };

  const handleResetState = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_EMPTY_STATE);
  };

  const handleJumpToYear = (year: 1 | 2 | 3) => {
    if (!scrollContainerRef.current) return;
    const boundaries = generateYearBoundaries(state.programmeStartYear);
    const target = boundaries.find((b) => b.programmeYear === year);
    if (target) {
      scrollContainerRef.current.scrollTo({
        top: target.startDay * state.pxPerDay,
        behavior: 'smooth',
      });
    }
  };

  const handleJumpToNextCollision = () => {
    if (!scrollContainerRef.current || collisionWeeks.length === 0) return;
    const idx = collisionCycleIndex % collisionWeeks.length;
    const targetWeek = collisionWeeks[idx];
    setCollisionCycleIndex(idx + 1);
    scrollContainerRef.current.scrollTo({
      top: Math.max(0, targetWeek.startDay * state.pxPerDay - 80),
      behavior: 'smooth',
    });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8FAFC] text-[#1E293B] overflow-hidden">
      <HeaderControls
        programmeStartYear={state.programmeStartYear}
        onChangeStartYear={(programmeStartYear) =>
          setState((prev) => ({ ...prev, programmeStartYear }))
        }
        pxPerDay={state.pxPerDay}
        onChangePxPerDay={(pxPerDay) =>
          setState((prev) => ({ ...prev, pxPerDay }))
        }
        snapDays={state.snapDays}
        onChangeSnapDays={(snapDays: SnapIncrement) =>
          setState((prev) => ({ ...prev, snapDays }))
        }
        gradientCurve={state.gradientCurve}
        onChangeGradientCurve={(gradientCurve: GradientCurve) =>
          setState((prev) => ({ ...prev, gradientCurve }))
        }
        overlapLayout={state.overlapLayout}
        onChangeOverlapLayout={(overlapLayout: OverlapLayout) =>
          setState((prev) => ({ ...prev, overlapLayout }))
        }
        onAddDeadline={handleAddDeadline}
        onAddTerm={handleAddTerm}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onResetState={handleResetState}
        onJumpToYear={handleJumpToYear}
        onJumpToNextCollision={handleJumpToNextCollision}
        totalDeadlines={state.deadlines.length}
        totalTerms={state.terms.length}
        collisionWeeksCount={collisionWeeks.length}
        triCollisionWeeksCount={triCollisionWeeksCount}
      />

      <TimelineCanvas
        scrollContainerRef={scrollContainerRef}
        programmeStartYear={state.programmeStartYear}
        deadlines={state.deadlines}
        terms={state.terms}
        placements={state.placements}
        pxPerDay={state.pxPerDay}
        snapDays={state.snapDays}
        gradientCurve={state.gradientCurve}
        overlapLayout={state.overlapLayout}
        weeklyLoadSlices={weeklyLoadSlices}
        onUpdateDeadline={handleUpdateDeadline}
        onSelectDeadlineForEdit={(item) => setEditingDeadline(item)}
        onSelectTermForEdit={(term) => setEditingTerm(term)}
        onOpenImportExport={() => setIsImportExportOpen(true)}
      />

      {/* Utilitarian Footer Status Bar */}
      <footer className="bg-white border-t border-[#CBD5E1] px-4 py-1.5 text-[11px] font-mono text-slate-600 flex flex-wrap items-center justify-between gap-2 z-30 select-none">
        <div className="flex items-center gap-4">
          <span>
            CANVAS HEIGHT: <strong className="text-[#1E293B]">{Math.round(1095 * state.pxPerDay)}px</strong> ({state.pxPerDay}px/day)
          </span>
          <span>
            ITEMS: <strong className="text-[#1E40AF]">Acad ({state.deadlines.filter((d) => d.domain === 'academic').length})</strong> ·{' '}
            <strong className="text-[#0F766E]">Clin ({state.deadlines.filter((d) => d.domain === 'clinical').length})</strong> ·{' '}
            <strong className="text-[#991B1B]">Res ({state.deadlines.filter((d) => d.domain === 'research').length})</strong> ·{' '}
            <strong className="text-[#1E293B]">UCL Terms ({state.terms.length})</strong>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            INTERACTION: Drag card/tail vertically to shift Due Date · Drag top dashed handle to resize Prep Duration · Double-click to edit
          </span>
          <span className="text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.2">
            LOCALSTORAGE SYNC ACTIVE
          </span>
        </div>
      </footer>

      <BulkImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        programmeStartYear={state.programmeStartYear}
        deadlines={state.deadlines}
        terms={state.terms}
        onImportDataset={handleImportDataset}
      />

      <EditItemModal
        editingDeadline={editingDeadline}
        editingTerm={editingTerm}
        onClose={() => {
          setEditingDeadline(null);
          setEditingTerm(null);
        }}
        onUpdateDeadline={handleUpdateDeadline}
        onDeleteDeadline={handleDeleteDeadline}
        onUpdateTerm={handleUpdateTerm}
        onDeleteTerm={handleDeleteTerm}
      />
    </div>
  );
};

export default App;
