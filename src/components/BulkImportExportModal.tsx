import React, { useState } from 'react';
import { X, Upload, Download, Copy, Check, FileText, AlertCircle } from 'lucide-react';
import { DeadlineItem, TermBlock } from '../types/timeline';
import {
  parseScheduleDataset,
  serializeToCsv,
  serializeToJson,
} from '../utils/schemaParser';

interface BulkImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  programmeStartYear: number;
  deadlines: DeadlineItem[];
  terms: TermBlock[];
  onImportDataset: (
    payload: {
      deadlines: DeadlineItem[];
      terms: TermBlock[];
      detectedStartYear?: number;
    },
    mode: 'merge' | 'replace'
  ) => void;
}

export const BulkImportExportModal: React.FC<BulkImportExportModalProps> = ({
  isOpen,
  onClose,
  programmeStartYear,
  deadlines,
  terms,
  onImportDataset,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'schema'>('import');
  const [rawInput, setRawInput] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [copied, setCopied] = useState(false);
  const [validationMessages, setValidationMessages] = useState<{
    errors: string[];
    warnings: string[];
    summary?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result ?? '');
      setRawInput(content);
      const preview = parseScheduleDataset(content);
      setValidationMessages({
        errors: preview.errors,
        warnings: preview.warnings,
        summary: `Parsed ${preview.deadlines.length} deadline(s) and ${preview.terms.length} term block(s).`,
      });
    };
    reader.readAsText(file);
  };

  const handleValidateAndImport = () => {
    const result = parseScheduleDataset(rawInput);
    if (result.errors.length > 0 && result.deadlines.length === 0 && result.terms.length === 0) {
      setValidationMessages({
        errors: result.errors,
        warnings: result.warnings,
      });
      return;
    }

    onImportDataset(
      {
        deadlines: result.deadlines,
        terms: result.terms,
        detectedStartYear: result.detectedStartYear,
      },
      importMode
    );

    setValidationMessages({
      errors: result.errors,
      warnings: result.warnings,
      summary: `Imported ${result.deadlines.length} deadline(s) and ${result.terms.length} term block(s).`,
    });

    if (result.errors.length === 0) {
      setRawInput('');
      onClose();
    }
  };

  const serializedOutput =
    exportFormat === 'json'
      ? serializeToJson(programmeStartYear, deadlines, terms)
      : serializeToCsv(deadlines, terms);

  const handleCopyExport = async () => {
    await navigator.clipboard.writeText(serializedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExport = () => {
    const ext = exportFormat === 'json' ? 'json' : 'csv';
    const mime = exportFormat === 'json' ? 'application/json' : 'text/csv';
    const blob = new Blob([serializedOutput], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `longitudinal-programme-schedule.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white border border-[#1E293B] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#CBD5E1] bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-[#1E293B]" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#1E293B]">
              Dataset Ingestion &amp; Schedule Export
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-600 hover:text-[#1E293B] hover:bg-slate-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#CBD5E1] bg-[#F1F5F9] px-5 pt-2 gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 border-t border-l border-r ${
              activeTab === 'import'
                ? 'bg-white text-[#1E293B] border-[#CBD5E1] -mb-px'
                : 'bg-transparent text-slate-600 border-transparent hover:text-[#1E293B]'
            }`}
          >
            1. Bulk Import (JSON / CSV)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 border-t border-l border-r ${
              activeTab === 'export'
                ? 'bg-white text-[#1E293B] border-[#CBD5E1] -mb-px'
                : 'bg-transparent text-slate-600 border-transparent hover:text-[#1E293B]'
            }`}
          >
            2. Export Schedule ({deadlines.length} Deadlines, {terms.length} Terms)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={`px-4 py-2 border-t border-l border-r ${
              activeTab === 'schema'
                ? 'bg-white text-[#1E293B] border-[#CBD5E1] -mb-px'
                : 'bg-transparent text-slate-600 border-transparent hover:text-[#1E293B]'
            }`}
          >
            3. Parser Schema Specification
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-[#1E293B]">
          {activeTab === 'import' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] p-3 border border-[#CBD5E1]">
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#1E293B] text-[#1E293B] font-semibold hover:bg-slate-100">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select .JSON or .CSV File</span>
                    <input
                      type="file"
                      accept=".json,.csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-slate-600">
                    or paste JSON / CSV payload directly below.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Ingestion Mode:</span>
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`px-2.5 py-1 font-medium border ${
                      importMode === 'merge'
                        ? 'bg-[#1E293B] text-white border-[#1E293B]'
                        : 'bg-white text-slate-700 border-[#CBD5E1]'
                    }`}
                  >
                    Append / Merge
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-2.5 py-1 font-medium border ${
                      importMode === 'replace'
                        ? 'bg-[#1E293B] text-white border-[#1E293B]'
                        : 'bg-white text-slate-700 border-[#CBD5E1]'
                    }`}
                  >
                    Replace Existing
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-[11px] text-slate-600 mb-1.5">
                  Raw JSON or CSV Dataset Payload
                </label>
                <textarea
                  rows={12}
                  value={rawInput}
                  onChange={(e) => {
                    setRawInput(e.target.value);
                    setValidationMessages(null);
                  }}
                  placeholder={`Paste JSON object/array or CSV rows here...\n\nSupported CSV headers:\n• Deadlines: title,domain,dueDate,prepDurationDays,notes\n• Terms: name,startDate,endDate\n• Unified: type,title,domain,dueDate,prepDurationDays,startDate,endDate,notes`}
                  className="w-full p-3 font-mono text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#1E293B] focus:outline-none focus:border-[#1E293B]"
                />
              </div>

              {validationMessages && (
                <div className="space-y-2">
                  {validationMessages.summary && (
                    <div className="px-3 py-2 bg-slate-100 border border-slate-300 font-mono text-xs text-[#1E293B]">
                      {validationMessages.summary}
                    </div>
                  )}
                  {validationMessages.errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-300 text-red-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4" />
                        <span>Validation Errors ({validationMessages.errors.length})</span>
                      </div>
                      <ul className="list-disc list-inside font-mono text-[11px] space-y-0.5">
                        {validationMessages.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 border border-[#CBD5E1] bg-white text-slate-700 font-medium hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleValidateAndImport}
                  className="px-4 py-1.5 bg-[#1E293B] text-white font-semibold border border-[#1E293B] hover:bg-slate-800"
                >
                  Parse &amp; Load Dataset
                </button>
              </div>
            </>
          )}

          {activeTab === 'export' && (
            <>
              <div className="flex items-center justify-between bg-[#F8FAFC] p-3 border border-[#CBD5E1]">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-600">Export Format:</span>
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`px-3 py-1 font-mono font-semibold border ${
                      exportFormat === 'json'
                        ? 'bg-[#1E293B] text-white border-[#1E293B]'
                        : 'bg-white text-slate-700 border-[#CBD5E1]'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`px-3 py-1 font-mono font-semibold border ${
                      exportFormat === 'csv'
                        ? 'bg-[#1E293B] text-white border-[#1E293B]'
                        : 'bg-white text-slate-700 border-[#CBD5E1]'
                    }`}
                  >
                    CSV
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyExport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#CBD5E1] text-[#1E293B] font-semibold hover:bg-slate-100"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy to Clipboard'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E293B] text-white border border-[#1E293B] font-semibold hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .{exportFormat.toUpperCase()}</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={14}
                readOnly
                value={serializedOutput}
                className="w-full p-3 font-mono text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#1E293B] focus:outline-none"
              />
            </>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed">
                The ingestion parser accepts either <strong>JSON</strong> or <strong>CSV</strong> payloads without requiring pre-populated dummy data. Below are the exact field definitions expected by the parser.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[#CBD5E1] bg-[#F8FAFC] p-3">
                  <h3 className="font-bold uppercase text-[11px] tracking-wider text-[#1E293B] mb-2">
                    Option A: JSON Payload Structure
                  </h3>
                  <pre className="font-mono text-[11px] bg-white p-2.5 border border-[#E2E8F0] overflow-x-auto text-slate-800">
{`{
  "programmeStartYear": <YYYY>,
  "deadlines": [
    {
      "id": "<optional-uuid>",
      "title": "<string>",
      "domain": "academic" | "clinical" | "research",
      "dueDate": "YYYY-MM-DD",
      "prepDurationDays": <integer>,
      "notes": "<optional-string>"
    }
  ],
  "terms": [
    {
      "id": "<optional-uuid>",
      "name": "<string>",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD"
    }
  ]
}`}
                  </pre>
                </div>

                <div className="border border-[#CBD5E1] bg-[#F8FAFC] p-3">
                  <h3 className="font-bold uppercase text-[11px] tracking-wider text-[#1E293B] mb-2">
                    Option B: CSV Header Formats
                  </h3>
                  <div className="space-y-2.5">
                    <div>
                      <div className="font-semibold text-[11px] text-slate-700 mb-1">
                        1. Unified CSV (Deadlines + UCL Terms in one table):
                      </div>
                      <pre className="font-mono text-[11px] bg-white p-2 border border-[#E2E8F0] overflow-x-auto">
{`type,title,domain,dueDate,prepDurationDays,startDate,endDate,notes
deadline,"<title>",academic,YYYY-MM-DD,21,,,<notes>
term,"<term_name>",,,,YYYY-MM-DD,YYYY-MM-DD,`}
                      </pre>
                    </div>
                    <div>
                      <div className="font-semibold text-[11px] text-slate-700 mb-1">
                        2. Standalone Deadlines CSV:
                      </div>
                      <pre className="font-mono text-[11px] bg-white p-2 border border-[#E2E8F0] overflow-x-auto">
{`title,domain,dueDate,prepDurationDays,notes`}
                      </pre>
                    </div>
                    <div>
                      <div className="font-semibold text-[11px] text-slate-700 mb-1">
                        3. Standalone UCL Term Dates CSV:
                      </div>
                      <pre className="font-mono text-[11px] bg-white p-2 border border-[#E2E8F0] overflow-x-auto">
{`name,startDate,endDate`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
