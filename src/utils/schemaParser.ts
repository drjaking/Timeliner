import { DeadlineItem, Domain, TermBlock } from '../types/timeline';
import { parseIsoToUtcMs } from './dateMath';

export interface ParseResult {
  deadlines: DeadlineItem[];
  terms: TermBlock[];
  detectedStartYear?: number;
  errors: string[];
  warnings: string[];
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeDomain(raw: string): Domain | null {
  const cleaned = raw.trim().toLowerCase();
  if (cleaned === 'academic' || cleaned === 'acad') return 'academic';
  if (cleaned === 'clinical' || cleaned === 'clin' || cleaned === 'placement') return 'clinical';
  if (cleaned === 'research' || cleaned === 'res' || cleaned === 'thesis') return 'research';
  return null;
}

/**
 * Splits a single CSV line respecting double-quoted fields and escaped quotes.
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Infers the academic start year (September 1, Year 1) from a set of ISO dates.
 * If the earliest date is in Sep-Dec of year Y, Year 1 starts in Y.
 * If the earliest date is in Jan-Aug of year Y, Year 1 started in Y - 1.
 */
function inferProgrammeStartYear(isoDates: string[]): number | undefined {
  const validMs = isoDates
    .map((d) => parseIsoToUtcMs(d))
    .filter((ms) => !Number.isNaN(ms));
  if (validMs.length === 0) return undefined;

  const minMs = Math.min(...validMs);
  const earliest = new Date(minMs);
  const year = earliest.getUTCFullYear();
  const month = earliest.getUTCMonth(); // 0 = Jan, 8 = Sep
  return month >= 8 ? year : year - 1;
}

/**
 * Parses either JSON or CSV input into validated DeadlineItem[] and TermBlock[] arrays.
 */
export function parseScheduleDataset(rawInput: string): ParseResult {
  const trimmed = rawInput.trim();
  const errors: string[] = [];
  const warnings: string[] = [];
  const deadlines: DeadlineItem[] = [];
  const terms: TermBlock[] = [];

  if (!trimmed) {
    errors.push('Input is empty. Paste JSON or CSV content or upload a file.');
    return { deadlines, terms, errors, warnings };
  }

  // Determine whether input is JSON or CSV
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      let rawDeadlines: unknown[] = [];
      let rawTerms: unknown[] = [];
      let explicitStartYear: number | undefined;

      if (Array.isArray(parsed)) {
        // Array of mixed or single-type records
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            if ('dueDate' in obj || 'domain' in obj) {
              rawDeadlines.push(obj);
            } else if ('startDate' in obj && 'endDate' in obj) {
              rawTerms.push(obj);
            } else {
              warnings.push(`Unrecognized JSON array object keys: ${Object.keys(obj).join(', ')}`);
            }
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        const root = parsed as Record<string, unknown>;
        if (typeof root.programmeStartYear === 'number') {
          explicitStartYear = root.programmeStartYear;
        }
        if (Array.isArray(root.deadlines)) {
          rawDeadlines = root.deadlines;
        }
        if (Array.isArray(root.terms)) {
          rawTerms = root.terms;
        }
        if (!Array.isArray(root.deadlines) && !Array.isArray(root.terms)) {
          errors.push(
            'JSON object must contain a "deadlines" array and/or a "terms" array.'
          );
        }
      }

      rawDeadlines.forEach((entry, idx) => {
        if (!entry || typeof entry !== 'object') {
          errors.push(`Deadline [${idx}]: Record is not an object.`);
          return;
        }
        const rec = entry as Record<string, unknown>;
        const title = String(rec.title ?? '').trim();
        const domain = normalizeDomain(String(rec.domain ?? ''));
        const dueDate = String(rec.dueDate ?? '').trim();
        const prepDurationDays = Number(
          rec.prepDurationDays ?? rec.prepDays ?? rec.preparationDays ?? 14
        );
        const notes = rec.notes ? String(rec.notes).trim() : undefined;

        if (!title) {
          errors.push(`Deadline [${idx}]: Missing "title".`);
          return;
        }
        if (!domain) {
          errors.push(
            `Deadline "${title}": Invalid domain "${String(rec.domain)}". Must be "academic", "clinical", or "research".`
          );
          return;
        }
        if (Number.isNaN(parseIsoToUtcMs(dueDate))) {
          errors.push(
            `Deadline "${title}": Invalid dueDate "${dueDate}". Expected YYYY-MM-DD.`
          );
          return;
        }
        if (!Number.isFinite(prepDurationDays) || prepDurationDays < 1) {
          errors.push(
            `Deadline "${title}": prepDurationDays must be a positive integer.`
          );
          return;
        }

        deadlines.push({
          id: typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : generateId('dl'),
          title,
          domain,
          dueDate,
          prepDurationDays: Math.round(prepDurationDays),
          notes,
        });
      });

      rawTerms.forEach((entry, idx) => {
        if (!entry || typeof entry !== 'object') {
          errors.push(`Term [${idx}]: Record is not an object.`);
          return;
        }
        const rec = entry as Record<string, unknown>;
        const name = String(rec.name ?? rec.title ?? '').trim();
        const startDate = String(rec.startDate ?? '').trim();
        const endDate = String(rec.endDate ?? '').trim();

        if (!name) {
          errors.push(`Term [${idx}]: Missing "name".`);
          return;
        }
        const startMs = parseIsoToUtcMs(startDate);
        const endMs = parseIsoToUtcMs(endDate);
        if (Number.isNaN(startMs)) {
          errors.push(`Term "${name}": Invalid startDate "${startDate}". Expected YYYY-MM-DD.`);
          return;
        }
        if (Number.isNaN(endMs)) {
          errors.push(`Term "${name}": Invalid endDate "${endDate}". Expected YYYY-MM-DD.`);
          return;
        }
        if (endMs < startMs) {
          errors.push(`Term "${name}": endDate (${endDate}) precedes startDate (${startDate}).`);
          return;
        }

        terms.push({
          id: typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : generateId('term'),
          name,
          startDate,
          endDate,
        });
      });

      const allDates = [
        ...deadlines.map((d) => d.dueDate),
        ...terms.map((t) => t.startDate),
      ];
      const detectedStartYear = explicitStartYear ?? inferProgrammeStartYear(allDates);

      return { deadlines, terms, detectedStartYear, errors, warnings };
    } catch (err) {
      errors.push(
        `JSON Syntax Error: ${err instanceof Error ? err.message : String(err)}`
      );
      return { deadlines, terms, errors, warnings };
    }
  }

  // Otherwise parse as CSV
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) {
    errors.push('CSV input must include a header row and at least one data row.');
    return { deadlines, terms, errors, warnings };
  }

  const headers = splitCsvLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[\s_-]+/g, '')
  );

  const idxType = headers.findIndex((h) => h === 'type' || h === 'recordtype' || h === 'kind');
  const idxId = headers.findIndex((h) => h === 'id');
  const idxTitle = headers.findIndex((h) => h === 'title' || h === 'name' || h === 'label');
  const idxDomain = headers.findIndex((h) => h === 'domain' || h === 'column' || h === 'stream');
  const idxDueDate = headers.findIndex((h) => h === 'duedate' || h === 'due' || h === 'deadline');
  const idxPrepDays = headers.findIndex(
    (h) => h === 'prepdurationdays' || h === 'prepdays' || h === 'durationdays' || h === 'prep'
  );
  const idxNotes = headers.findIndex((h) => h === 'notes' || h === 'note' || h === 'description');
  const idxStartDate = headers.findIndex((h) => h === 'startdate' || h === 'start');
  const idxEndDate = headers.findIndex((h) => h === 'enddate' || h === 'end');

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cells = splitCsvLine(lines[rowIdx]);
    const rowLabel = `CSV Row ${rowIdx + 1}`;

    const rawType = idxType >= 0 ? (cells[idxType] ?? '').toLowerCase() : '';
    const hasStartEnd =
      idxStartDate >= 0 &&
      idxEndDate >= 0 &&
      Boolean(cells[idxStartDate]) &&
      Boolean(cells[idxEndDate]);

    const isTermRow =
      rawType === 'term' ||
      rawType === 'ucl_term' ||
      (rawType !== 'deadline' && hasStartEnd && (idxDueDate < 0 || !cells[idxDueDate]));

    if (isTermRow) {
      const name = idxTitle >= 0 ? cells[idxTitle] ?? '' : '';
      const startDate = idxStartDate >= 0 ? cells[idxStartDate] ?? '' : '';
      const endDate = idxEndDate >= 0 ? cells[idxEndDate] ?? '' : '';

      if (!name) {
        errors.push(`${rowLabel}: Missing term name.`);
        continue;
      }
      const startMs = parseIsoToUtcMs(startDate);
      const endMs = parseIsoToUtcMs(endDate);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        errors.push(
          `${rowLabel} ("${name}"): Invalid startDate "${startDate}" or endDate "${endDate}". Expected YYYY-MM-DD.`
        );
        continue;
      }
      if (endMs < startMs) {
        errors.push(`${rowLabel} ("${name}"): endDate precedes startDate.`);
        continue;
      }

      terms.push({
        id: idxId >= 0 && cells[idxId] ? cells[idxId] : generateId('term'),
        name,
        startDate,
        endDate,
      });
    } else {
      const title = idxTitle >= 0 ? cells[idxTitle] ?? '' : '';
      const rawDomain = idxDomain >= 0 ? cells[idxDomain] ?? '' : '';
      const dueDate = idxDueDate >= 0 ? cells[idxDueDate] ?? '' : '';
      const rawPrep = idxPrepDays >= 0 ? cells[idxPrepDays] ?? '14' : '14';
      const notes = idxNotes >= 0 && cells[idxNotes] ? cells[idxNotes] : undefined;

      if (!title) {
        errors.push(`${rowLabel}: Missing deadline title.`);
        continue;
      }
      const domain = normalizeDomain(rawDomain);
      if (!domain) {
        errors.push(
          `${rowLabel} ("${title}"): Invalid domain "${rawDomain}". Expected academic, clinical, or research.`
        );
        continue;
      }
      if (Number.isNaN(parseIsoToUtcMs(dueDate))) {
        errors.push(
          `${rowLabel} ("${title}"): Invalid dueDate "${dueDate}". Expected YYYY-MM-DD.`
        );
        continue;
      }
      const prepDurationDays = Number(rawPrep);
      if (!Number.isFinite(prepDurationDays) || prepDurationDays < 1) {
        errors.push(
          `${rowLabel} ("${title}"): Invalid prepDurationDays "${rawPrep}". Must be >= 1.`
        );
        continue;
      }

      deadlines.push({
        id: idxId >= 0 && cells[idxId] ? cells[idxId] : generateId('dl'),
        title,
        domain,
        dueDate,
        prepDurationDays: Math.round(prepDurationDays),
        notes,
      });
    }
  }

  const allDates = [
    ...deadlines.map((d) => d.dueDate),
    ...terms.map((t) => t.startDate),
  ];
  const detectedStartYear = inferProgrammeStartYear(allDates);

  return { deadlines, terms, detectedStartYear, errors, warnings };
}

/**
 * Serializes current schedule state to formatted JSON.
 */
export function serializeToJson(
  programmeStartYear: number,
  deadlines: DeadlineItem[],
  terms: TermBlock[]
): string {
  return JSON.stringify(
    {
      programmeStartYear,
      deadlines,
      terms,
    },
    null,
    2
  );
}

function escapeCsvCell(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes current schedule state to a unified CSV string supporting both deadlines and terms.
 */
export function serializeToCsv(
  deadlines: DeadlineItem[],
  terms: TermBlock[]
): string {
  const header = 'type,id,title,domain,dueDate,prepDurationDays,startDate,endDate,notes';
  const rows: string[] = [header];

  for (const d of deadlines) {
    rows.push(
      [
        'deadline',
        escapeCsvCell(d.id),
        escapeCsvCell(d.title),
        escapeCsvCell(d.domain),
        escapeCsvCell(d.dueDate),
        escapeCsvCell(d.prepDurationDays),
        '',
        '',
        escapeCsvCell(d.notes ?? ''),
      ].join(',')
    );
  }

  for (const t of terms) {
    rows.push(
      [
        'term',
        escapeCsvCell(t.id),
        escapeCsvCell(t.name),
        '',
        '',
        '',
        escapeCsvCell(t.startDate),
        escapeCsvCell(t.endDate),
        '',
      ].join(',')
    );
  }

  return rows.join('\n');
}
