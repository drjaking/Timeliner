import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Upload,
  RotateCcw,
  Sliders,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
  Grid,
} from 'lucide-react';
import {
  DeadlineItem,
  Domain,
  DOMAIN_CONFIG,
  GradientCurve,
  OverlapLayout,
  SnapIncrement,
  TermBlock,
} from '../types/timeline';
import {
  getProgrammeEndIso,
  getProgrammeStartIso,
  parseIsoToUtcMs,
} from '../utils/dateMath';

interface HeaderControlsProps {
  programmeStartYear: number;
  onChangeStartYear: (year: number) => void;
  pxPerDay: number;
  onChangePxPerDay: (px: number) => void;
  snapDays: SnapIncrement;
  onChangeSnapDays: (snap: SnapIncrement) => void;
  gradientCurve: GradientCurve;
  onChangeGradientCurve: (curve: GradientCurve) => void;
  overlapLayout: OverlapLayout;
  onChangeOverlapLayout: (layout: OverlapLayout) => void;
  onAddDeadline: (item: Omit<DeadlineItem, 'id'>) => void;
  onAddTerm: (term: Omit<TermBlock, 'id'>) => void;
  onOpenImportExport: () => void;
  onResetState: () => void;
  onJumpToYear: (year: 1 | 2 | 3) => void;
  onJumpToNextCollision: () => void;
  totalDeadlines: number;
  totalTerms: number;
  collisionWeeksCount: number;
  triCollisionWeeksCount: number;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  programmeStartYear,
  onChangeStartYear,
  pxPerDay,
  onChangePxPerDay,
  snapDays,
  onChangeSnapDays,
  gradientCurve,
  onChangeGradientCurve,
  overlapLayout,
  onChangeOverlapLayout,
  onAddDeadline,
  onAddTerm,
  onOpenImportExport,
  onResetState,
  onJumpToYear,
  onJumpToNextCollision,
  totalDeadlines,
  totalTerms,
  collisionWeeksCount,
  triCollisionWeeksCount,
}) => {
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [activeAddTab, setActiveAddTab] = useState<'deadline' | 'term'>('deadline');
  const [confirmReset, setConfirmReset] = useState(false);

  // Add Deadline Form State
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<Domain>('academic');
  const [dueDate, setDueDate] = useState(`${programmeStartYear}-11-15`);
  const [prepValue, setPrepValue] = useState<number>(21);
  const [prepUnit, setPrepUnit] = useState<'days' | 'weeks'>('days');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Add Term Form State
  const [termName, setTermName] = useState('');
  const [termStart, setTermStart] = useState(`${programmeStartYear}-09-28`);
  const [termEnd, setTermEnd] = useState(`${programmeStartYear}-12-18`);

  const startIso = getProgrammeStartIso(programmeStartYear);
  const endIso = getProgrammeEndIso(programmeStartYear);

  const handleCreateDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Please provide a deadline title.');
      return;
    }
    if (Number.isNaN(parseIsoToUtcMs(dueDate))) {
      setFormError('Please enter a valid Due Date in YYYY-MM-DD format.');
      return;
    }
    const computedPrepDays =
      prepUnit === 'weeks' ? Math.round(prepValue * 7) : Math.round(prepValue);

    if (!Number.isFinite(computedPrepDays) || computedPrepDays < 1) {
      setFormError('Preparation duration must be at least 1 day.');
      return;
    }

    onAddDeadline({
      title: title.trim(),
      domain,
      dueDate,
      prepDurationDays: computedPrepDays,
      notes: notes.trim() ? notes.trim() : undefined,
    });

    setTitle('');
    setNotes('');
  };

  const handleCreateTerm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!termName.trim()) {
      setFormError('Please provide a term or vacation block name.');
      return;
    }
    const sMs = parseIsoToUtcMs(termStart);
    const eMs = parseIsoToUtcMs(termEnd);
    if (Number.isNaN(sMs) || Number.isNaN(eMs)) {
      setFormError('Start and End dates must be valid YYYY-MM-DD dates.');
      return;
    }
    if (eMs < sMs) {
      setFormError('End date cannot precede Start date.');
      return;
    }

    onAddTerm({
      name: termName.trim(),
      startDate: termStart,
      endDate: termEnd,
    });

    setTermName('');
  };

  return (
    <header className="bg-white border-b border-[#CBD5E1] text-[#1E293B] select-none z-40">
      {/* Primary Top Bar */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding & Longitudinal Window */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-[#1E293B]" />
              <h1 className="text-sm font-bold tracking-tight uppercase text-[#1E293B]">
                Longitudinal Programme Sequencer
              </h1>
              <span className="text-[11px] font-mono px-1.5 py-0.5 bg-[#F1F5F9] border border-[#CBD5E1] text-slate-700">
                3-YEAR VERTICAL MATRIX
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 font-mono">
              Origin: <strong className="text-[#1E293B]">01 Sep {programmeStartYear}</strong> (Y1) →
              Terminus: <strong className="text-[#1E293B]">31 Aug {programmeStartYear + 3}</strong> (Y3) · 1,095d / 156w
            </p>
          </div>

          {/* Year 1 Anchor Selector */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <label htmlFor="start-year-input" className="text-slate-600 font-medium">
              Y1 Sept:
            </label>
            <input
              id="start-year-input"
              type="number"
              min={2015}
              max={2040}
              value={programmeStartYear}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 2000 && val <= 2100) {
                  onChangeStartYear(val);
                }
              }}
              className="w-16 font-mono font-semibold text-[#1E293B] bg-white border border-[#CBD5E1] px-1.5 py-0.5 text-xs focus:outline-none focus:border-slate-800"
              title="Set calendar year for September 1, Year 1"
            />
          </div>

          {/* Quick Year Jump Buttons */}
          <div className="hidden xl:flex items-center border border-[#CBD5E1] bg-[#F8FAFC] divide-x divide-[#CBD5E1] text-xs font-mono">
            <button
              type="button"
              onClick={() => onJumpToYear(1)}
              className="px-2 py-1 hover:bg-slate-200/70 text-[#1E293B] font-medium transition-colors"
              title="Scroll to September 1, Year 1"
            >
              Y1 ({programmeStartYear})
            </button>
            <button
              type="button"
              onClick={() => onJumpToYear(2)}
              className="px-2 py-1 hover:bg-slate-200/70 text-[#1E293B] font-medium transition-colors"
              title="Scroll to September 1, Year 2"
            >
              Y2 ({programmeStartYear + 1})
            </button>
            <button
              type="button"
              onClick={() => onJumpToYear(3)}
              className="px-2 py-1 hover:bg-slate-200/70 text-[#1E293B] font-medium transition-colors"
              title="Scroll to September 1, Year 3"
            >
              Y3 ({programmeStartYear + 2})
            </button>
          </div>
        </div>

        {/* Center: Viewport Scale, Snap, & Visual Encoding Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Scale Slider (pxPerDay) */}
          <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#CBD5E1] px-2.5 py-1">
            <Sliders className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-slate-600 font-medium">Scale:</span>
            <input
              type="range"
              min={2}
              max={10}
              step={0.5}
              value={pxPerDay}
              onChange={(e) => onChangePxPerDay(Number(e.target.value))}
              className="w-20 accent-[#1E293B] cursor-pointer"
              title="Adjust vertical pixels per calendar day (Default: 4px/day)"
            />
            <span className="font-mono font-semibold text-[#1E293B] w-14 text-right">
              {pxPerDay}px/d
            </span>
          </div>

          {/* Drag Snap Toggle */}
          <div className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] p-0.5">
            <span className="px-2 text-slate-600 font-medium">Snap:</span>
            <button
              type="button"
              onClick={() => onChangeSnapDays(1)}
              className={`px-2 py-0.5 font-mono text-xs transition-colors ${
                snapDays === 1
                  ? 'bg-[#1E293B] text-white font-semibold'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              1d
            </button>
            <button
              type="button"
              onClick={() => onChangeSnapDays(7)}
              className={`px-2 py-0.5 font-mono text-xs transition-colors ${
                snapDays === 7
                  ? 'bg-[#1E293B] text-white font-semibold'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              1w (7d)
            </button>
          </div>

          {/* Gradient Curve Toggle */}
          <div
            className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] p-0.5"
            title="Select opacity ramp profile for preparation tails (0.03 at Y_start to 0.75 at Y_due)"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600 ml-1.5 mr-1" />
            <button
              type="button"
              onClick={() => onChangeGradientCurve('linear')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                gradientCurve === 'linear'
                  ? 'bg-[#1E293B] text-white font-medium'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              Linear
            </button>
            <button
              type="button"
              onClick={() => onChangeGradientCurve('exponential')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                gradientCurve === 'exponential'
                  ? 'bg-[#1E293B] text-white font-medium'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              Exp
            </button>
          </div>

          {/* Overlap Sub-Lane Toggle */}
          <div
            className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] p-0.5"
            title="Toggle between side-by-side sub-lanes or full-width optical compounding when same-domain prep tails overlap"
          >
            <Grid className="w-3.5 h-3.5 text-slate-600 ml-1.5 mr-1" />
            <button
              type="button"
              onClick={() => onChangeOverlapLayout('lanes')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                overlapLayout === 'lanes'
                  ? 'bg-[#1E293B] text-white font-medium'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              Sub-Lanes
            </button>
            <button
              type="button"
              onClick={() => onChangeOverlapLayout('compound')}
              className={`px-2 py-0.5 text-xs transition-colors ${
                overlapLayout === 'compound'
                  ? 'bg-[#1E293B] text-white font-medium'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              Full Stack
            </button>
          </div>
        </div>

        {/* Right: Conflict Status & CRUD Actions */}
        <div className="flex items-center gap-2">
          {/* Conflict Summary Badge */}
          {collisionWeeksCount > 0 && (
            <button
              type="button"
              onClick={onJumpToNextCollision}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-amber-50 border border-amber-400 text-amber-900 hover:bg-amber-100 transition-colors"
              title="Click to cycle through multi-domain preparation collision weeks"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>
                {collisionWeeksCount} Overlap Wk{collisionWeeksCount === 1 ? '' : 's'}
                {triCollisionWeeksCount > 0 ? ` (${triCollisionWeeksCount} 3-Way)` : ''}
              </span>
            </button>
          )}

          {/* Add Entry Drawer Button */}
          <button
            type="button"
            onClick={() => setIsAddDrawerOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors ${
              isAddDrawerOpen
                ? 'bg-[#1E293B] text-white border-[#1E293B]'
                : 'bg-white text-[#1E293B] border-[#1E293B] hover:bg-slate-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Entry</span>
            {isAddDrawerOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Bulk Import / Export Modal Trigger */}
          <button
            type="button"
            onClick={onOpenImportExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1E293B] text-white border border-[#1E293B] hover:bg-slate-800 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Import / Export</span>
          </button>

          {/* Clear / Reset State */}
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={totalDeadlines === 0 && totalTerms === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-[#F8FAFC] border border-[#CBD5E1] hover:bg-red-50 hover:text-red-800 hover:border-red-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Clear localStorage and reset canvas to empty state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-red-50 border border-red-300 px-2 py-1 text-xs">
              <span className="text-red-900 font-semibold mr-1">Clear all data?</span>
              <button
                type="button"
                onClick={() => {
                  onResetState();
                  setConfirmReset(false);
                }}
                className="px-2 py-0.5 bg-red-800 text-white font-semibold hover:bg-red-900"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Add Deadline / Add Term Drawer */}
      {isAddDrawerOpen && (
        <div className="bg-[#F8FAFC] border-t border-[#CBD5E1] px-4 py-3">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between border-b border-[#CBD5E1] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAddTab('deadline');
                    setFormError(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold border ${
                    activeAddTab === 'deadline'
                      ? 'bg-[#1E293B] text-white border-[#1E293B]'
                      : 'bg-white text-slate-700 border-[#CBD5E1] hover:bg-slate-100'
                  }`}
                >
                  + Add Course Deadline (Columns 1–3)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAddTab('term');
                    setFormError(null);
                  }}
                  className={`px-3 py-1 text-xs font-semibold border ${
                    activeAddTab === 'term'
                      ? 'bg-[#1E293B] text-white border-[#1E293B]'
                      : 'bg-white text-slate-700 border-[#CBD5E1] hover:bg-slate-100'
                  }`}
                >
                  + Add UCL Term / Vacation Block (Column 4)
                </button>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Valid Programme Window: {startIso} to {endIso}
              </span>
            </div>

            {formError && (
              <div className="mb-3 px-3 py-1.5 bg-red-50 border border-red-300 text-red-900 text-xs font-medium">
                {formError}
              </div>
            )}

            {activeAddTab === 'deadline' ? (
              <form
                onSubmit={handleCreateDeadline}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Deadline Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Clinical Case Report 1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Programme Domain *
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as Domain)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] text-[#1E293B] font-medium focus:outline-none focus:border-[#1E293B]"
                  >
                    {(Object.keys(DOMAIN_CONFIG) as Domain[]).map((key) => (
                      <option key={key} value={key}>
                        {DOMAIN_CONFIG[key].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Due Date (YYYY-MM-DD) *
                  </label>
                  <input
                    type="date"
                    required
                    min={startIso}
                    max={endIso}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Prep Window *
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={prepValue}
                      onChange={(e) => setPrepValue(Number(e.target.value))}
                      className="w-16 px-2 py-1.5 text-xs font-mono bg-white border border-r-0 border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                    />
                    <select
                      value={prepUnit}
                      onChange={(e) => setPrepUnit(e.target.value as 'days' | 'weeks')}
                      className="flex-1 px-2 py-1.5 text-xs bg-[#F1F5F9] border border-[#CBD5E1] text-[#1E293B] font-medium focus:outline-none"
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Module code / weighting"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                  />
                </div>

                <div className="md:col-span-1">
                  <button
                    type="submit"
                    className="w-full px-3 py-1.5 text-xs font-semibold bg-[#1E293B] text-white border border-[#1E293B] hover:bg-slate-800 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleCreateTerm}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    UCL Term / Block Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Year 1 - Term 1, Reading Week, Summer Vacation"
                    value={termName}
                    onChange={(e) => setTermName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Start Date (YYYY-MM-DD) *
                  </label>
                  <input
                    type="date"
                    required
                    min={startIso}
                    max={endIso}
                    value={termStart}
                    onChange={(e) => setTermStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    End Date (YYYY-MM-DD) *
                  </label>
                  <input
                    type="date"
                    required
                    min={startIso}
                    max={endIso}
                    value={termEnd}
                    onChange={(e) => setTermEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                  />
                </div>

                <div className="md:col-span-1">
                  <button
                    type="submit"
                    className="w-full px-3 py-1.5 text-xs font-semibold bg-[#1E293B] text-white border border-[#1E293B] hover:bg-slate-800 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
