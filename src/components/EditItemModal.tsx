import React, { useState, useEffect } from 'react';
import { X, Trash2, Save } from 'lucide-react';
import { DeadlineItem, Domain, DOMAIN_CONFIG, TermBlock } from '../types/timeline';
import { parseIsoToUtcMs } from '../utils/dateMath';

interface EditItemModalProps {
  editingDeadline: DeadlineItem | null;
  editingTerm: TermBlock | null;
  onClose: () => void;
  onUpdateDeadline: (updated: DeadlineItem) => void;
  onDeleteDeadline: (id: string) => void;
  onUpdateTerm: (updated: TermBlock) => void;
  onDeleteTerm: (id: string) => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  editingDeadline,
  editingTerm,
  onClose,
  onUpdateDeadline,
  onDeleteDeadline,
  onUpdateTerm,
  onDeleteTerm,
}) => {
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<Domain>('academic');
  const [dueDate, setDueDate] = useState('');
  const [prepDurationDays, setPrepDurationDays] = useState(14);
  const [notes, setNotes] = useState('');

  const [termName, setTermName] = useState('');
  const [termStart, setTermStart] = useState('');
  const [termEnd, setTermEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (editingDeadline) {
      setTitle(editingDeadline.title);
      setDomain(editingDeadline.domain);
      setDueDate(editingDeadline.dueDate);
      setPrepDurationDays(editingDeadline.prepDurationDays);
      setNotes(editingDeadline.notes ?? '');
    } else if (editingTerm) {
      setTermName(editingTerm.name);
      setTermStart(editingTerm.startDate);
      setTermEnd(editingTerm.endDate);
    }
  }, [editingDeadline, editingTerm]);

  if (!editingDeadline && !editingTerm) return null;

  const handleSaveDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeadline) return;
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (Number.isNaN(parseIsoToUtcMs(dueDate))) {
      setError('Valid YYYY-MM-DD due date is required.');
      return;
    }
    if (prepDurationDays < 1) {
      setError('Preparation duration must be at least 1 day.');
      return;
    }
    onUpdateDeadline({
      ...editingDeadline,
      title: title.trim(),
      domain,
      dueDate,
      prepDurationDays: Math.round(prepDurationDays),
      notes: notes.trim() ? notes.trim() : undefined,
    });
    onClose();
  };

  const handleSaveTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTerm) return;
    if (!termName.trim()) {
      setError('Term name is required.');
      return;
    }
    const sMs = parseIsoToUtcMs(termStart);
    const eMs = parseIsoToUtcMs(termEnd);
    if (Number.isNaN(sMs) || Number.isNaN(eMs) || eMs < sMs) {
      setError('Valid start and end dates (endDate >= startDate) are required.');
      return;
    }
    onUpdateTerm({
      ...editingTerm,
      name: termName.trim(),
      startDate: termStart,
      endDate: termEnd,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white border border-[#1E293B] w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#CBD5E1] bg-[#F8FAFC]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E293B]">
            {editingDeadline ? 'Edit Course Deadline' : 'Edit UCL Term Block'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-600 hover:text-[#1E293B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 px-3 py-1.5 bg-red-50 border border-red-300 text-red-900 text-xs">
            {error}
          </div>
        )}

        {editingDeadline && (
          <form onSubmit={handleSaveDeadline} className="p-4 space-y-3 text-xs">
            <div>
              <label className="block font-semibold uppercase text-[11px] text-slate-600 mb-1">
                Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold uppercase text-[11px] text-slate-600 mb-1">
                  Domain
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value as Domain)}
                  className="w-full px-2.5 py-1.5 border border-[#CBD5E1] text-[#1E293B] bg-white focus:outline-none focus:border-[#1E293B]"
                >
                  {(Object.keys(DOMAIN_CONFIG) as Domain[]).map((k) => (
                    <option key={k} value={k}>
                      {DOMAIN_CONFIG[k].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[11px] text-slate-600 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold uppercase text-[11px] text-slate-600 mb-1">
                Preparation Duration (Days) — {(prepDurationDays / 7).toFixed(1)} Weeks
              </label>
              <input
                type="number"
                min={1}
                max={365}
                required
                value={prepDurationDays}
                onChange={(e) => setPrepDurationDays(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 font-mono border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-[11px] text-slate-600 mb-1">
                Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => {
                  onDeleteDeadline(editingDeadline.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-red-800 bg-red-50 border border-red-300 hover:bg-red-100 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 border border-[#CBD5E1] text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1E293B] text-white border border-[#1E293B] hover:bg-slate-800 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {editingTerm && (
          <form onSubmit={handleSaveTerm} className="p-4 space-y-3 text-xs">
            <div>
              <label className="block font-semibold uppercase text-[11px] text-slate-600 mb-1">
                Block Name
              </label>
              <input
                type="text"
                required
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold uppercase text-[11px] text-slate-600 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={termStart}
                  onChange={(e) => setTermStart(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[11px] text-slate-600 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={termEnd}
                  onChange={(e) => setTermEnd(e.target.value)}
                  className="w-full px-2.5 py-1.5 font-mono border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => {
                  onDeleteTerm(editingTerm.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-red-800 bg-red-50 border border-red-300 hover:bg-red-100 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 border border-[#CBD5E1] text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1E293B] text-white border border-[#1E293B] hover:bg-slate-800 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
