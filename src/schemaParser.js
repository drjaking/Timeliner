/**
 * Schema Parser & Serializer for JSON and CSV Schedule Datasets
 * Zero hallucinated data; validates DeadlineItem and TermBlock records.
 */
(function (global) {
  const DateMath = global.TimelinerDateMath;

  function generateId(prefix) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function normalizeDomain(raw) {
    const cleaned = String(raw || '').trim().toLowerCase();
    if (cleaned === 'academic' || cleaned === 'acad') return 'academic';
    if (cleaned === 'clinical' || cleaned === 'clin' || cleaned === 'placement')
      return 'clinical';
    if (cleaned === 'research' || cleaned === 'res' || cleaned === 'thesis')
      return 'research';
    return null;
  }

  function normalizeWorkloadCurve(raw) {
    const cleaned = String(raw || '').trim().toLowerCase();
    if (cleaned === 'linear' || cleaned === 'lin') return 'linear';
    return 'exponential';
  }

  function splitCsvLine(line) {
    const cells = [];
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

  function inferProgrammeStartYear(isoDates) {
    const validMs = isoDates
      .map(function (d) {
        return DateMath.parseIsoToUtcMs(d);
      })
      .filter(function (ms) {
        return !Number.isNaN(ms);
      });
    if (validMs.length === 0) return undefined;
    const minMs = Math.min.apply(null, validMs);
    const earliest = new Date(minMs);
    const year = earliest.getUTCFullYear();
    const month = earliest.getUTCMonth(); // 0=Jan, 8=Sep
    return month >= 8 ? year : year - 1;
  }

  function parseScheduleDataset(rawInput) {
    const trimmed = String(rawInput || '').trim();
    const errors = [];
    const warnings = [];
    const deadlines = [];
    const terms = [];
    const clinicalPlacements = [];

    if (!trimmed) {
      errors.push('Input is empty. Paste JSON or CSV content or upload a file.');
      return {
        deadlines: deadlines,
        terms: terms,
        clinicalPlacements: clinicalPlacements,
        errors: errors,
        warnings: warnings,
      };
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        let rawDeadlines = [];
        let rawTerms = [];
        let rawPlacements = [];
        let explicitStartYear = undefined;

        if (Array.isArray(parsed)) {
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            if (item && typeof item === 'object') {
              if ('dueDate' in item || 'domain' in item) {
                rawDeadlines.push(item);
              } else if (
                ('startLoadDays' in item || 'endLoadDays' in item) &&
                'startDate' in item &&
                'endDate' in item
              ) {
                rawPlacements.push(item);
              } else if ('startDate' in item && 'endDate' in item) {
                rawTerms.push(item);
              } else {
                warnings.push(
                  'Unrecognized JSON record keys: ' + Object.keys(item).join(', ')
                );
              }
            }
          }
        } else if (parsed && typeof parsed === 'object') {
          if (typeof parsed.programmeStartYear === 'number') {
            explicitStartYear = parsed.programmeStartYear;
          }
          if (Array.isArray(parsed.deadlines)) rawDeadlines = parsed.deadlines;
          if (Array.isArray(parsed.terms)) rawTerms = parsed.terms;
          if (Array.isArray(parsed.clinicalPlacements))
            rawPlacements = parsed.clinicalPlacements;
          if (
            !Array.isArray(parsed.deadlines) &&
            !Array.isArray(parsed.terms) &&
            !Array.isArray(parsed.clinicalPlacements)
          ) {
            errors.push(
              'JSON root object must include "deadlines", "terms", and/or "clinicalPlacements" arrays.'
            );
          }
        }

        rawDeadlines.forEach(function (rec, idx) {
          if (!rec || typeof rec !== 'object') {
            errors.push('Deadline [' + idx + ']: Invalid object.');
            return;
          }
          const title = String(rec.title ?? '').trim();
          const domain = normalizeDomain(rec.domain);
          const dueDate = String(rec.dueDate ?? '').trim();
          const prepDurationDays = Number(
            rec.prepDurationDays ?? rec.prepDays ?? rec.preparationDays ?? 14
          );
          const postDurationDays = Number(
            rec.postDurationDays ?? rec.postDays ?? rec.followUpDays ?? 0
          );
          const workloadCurve = normalizeWorkloadCurve(
            rec.workloadCurve ?? rec.curve ?? rec.gradientCurve
          );
          const notes = rec.notes ? String(rec.notes).trim() : undefined;

          if (!title) {
            errors.push('Deadline [' + idx + ']: Missing "title".');
            return;
          }
          if (!domain) {
            errors.push(
              'Deadline "' +
                title +
                '": Invalid domain "' +
                rec.domain +
                '". Must be "academic", "clinical", or "research".'
            );
            return;
          }
          if (Number.isNaN(DateMath.parseIsoToUtcMs(dueDate))) {
            errors.push(
              'Deadline "' +
                title +
                '": Invalid dueDate "' +
                dueDate +
                '". Expected YYYY-MM-DD.'
            );
            return;
          }
          if (!Number.isFinite(prepDurationDays) || prepDurationDays < 0) {
            errors.push(
              'Deadline "' + title + '": prepDurationDays must be >= 0.'
            );
            return;
          }
          if (!Number.isFinite(postDurationDays) || postDurationDays < 0) {
            errors.push(
              'Deadline "' + title + '": postDurationDays must be >= 0.'
            );
            return;
          }

          deadlines.push({
            id:
              typeof rec.id === 'string' && rec.id.trim()
                ? rec.id.trim()
                : generateId('dl'),
            title: title,
            domain: domain,
            dueDate: dueDate,
            prepDurationDays: Math.round(prepDurationDays),
            postDurationDays: Math.round(postDurationDays),
            workloadCurve: workloadCurve,
            notes: notes,
          });
        });

        rawTerms.forEach(function (rec, idx) {
          if (!rec || typeof rec !== 'object') {
            errors.push('Term [' + idx + ']: Invalid object.');
            return;
          }
          const name = String(rec.name ?? rec.title ?? '').trim();
          const startDate = String(rec.startDate ?? '').trim();
          const endDate = String(rec.endDate ?? '').trim();

          if (!name) {
            errors.push('Term [' + idx + ']: Missing "name".');
            return;
          }
          const startMs = DateMath.parseIsoToUtcMs(startDate);
          const endMs = DateMath.parseIsoToUtcMs(endDate);
          if (Number.isNaN(startMs)) {
            errors.push(
              'Term "' + name + '": Invalid startDate "' + startDate + '".'
            );
            return;
          }
          if (Number.isNaN(endMs)) {
            errors.push('Term "' + name + '": Invalid endDate "' + endDate + '".');
            return;
          }
          if (endMs < startMs) {
            errors.push('Term "' + name + '": endDate precedes startDate.');
            return;
          }

          terms.push({
            id:
              typeof rec.id === 'string' && rec.id.trim()
                ? rec.id.trim()
                : generateId('term'),
            name: name,
            startDate: startDate,
            endDate: endDate,
          });
        });

        rawPlacements.forEach(function (rec, idx) {
          if (!rec || typeof rec !== 'object') {
            errors.push('Placement [' + idx + ']: Invalid object.');
            return;
          }
          const name = String(rec.name ?? rec.title ?? '').trim();
          const startDate = String(rec.startDate ?? '').trim();
          const endDate = String(rec.endDate ?? '').trim();
          const startLoadDays = Number(
            rec.startLoadDays ?? rec.postDurationDays ?? 14
          );
          const endLoadDays = Number(
            rec.endLoadDays ?? rec.prepDurationDays ?? 14
          );
          const workloadCurve = normalizeWorkloadCurve(
            rec.workloadCurve ?? rec.curve ?? rec.gradientCurve
          );
          const notes = rec.notes ? String(rec.notes).trim() : undefined;

          if (!name) {
            errors.push('Placement [' + idx + ']: Missing "name".');
            return;
          }
          const startMs = DateMath.parseIsoToUtcMs(startDate);
          const endMs = DateMath.parseIsoToUtcMs(endDate);
          if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
            errors.push('Placement "' + name + '": Invalid startDate or endDate.');
            return;
          }

          clinicalPlacements.push({
            id:
              typeof rec.id === 'string' && rec.id.trim()
                ? rec.id.trim()
                : generateId('clin-pl'),
            name: name,
            startDate: startDate,
            endDate: endDate,
            startLoadDays:
              Number.isFinite(startLoadDays) && startLoadDays >= 0
                ? Math.round(startLoadDays)
                : 14,
            endLoadDays:
              Number.isFinite(endLoadDays) && endLoadDays >= 0
                ? Math.round(endLoadDays)
                : 14,
            workloadCurve: workloadCurve,
            notes: notes,
          });
        });

        const allDates = deadlines
          .map(function (d) {
            return d.dueDate;
          })
          .concat(
            terms.map(function (t) {
              return t.startDate;
            }),
            clinicalPlacements.map(function (p) {
              return p.startDate;
            })
          );
        const detectedStartYear =
          explicitStartYear !== undefined
            ? explicitStartYear
            : inferProgrammeStartYear(allDates);

        return {
          deadlines: deadlines,
          terms: terms,
          clinicalPlacements: clinicalPlacements,
          detectedStartYear: detectedStartYear,
          errors: errors,
          warnings: warnings,
        };
      } catch (err) {
        errors.push('JSON Syntax Error: ' + (err && err.message ? err.message : String(err)));
        return {
          deadlines: deadlines,
          terms: terms,
          clinicalPlacements: clinicalPlacements,
          errors: errors,
          warnings: warnings,
        };
      }
    }

    // Parse CSV
    const lines = trimmed
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(function (l) {
        return l.length > 0 && !l.startsWith('#');
      });

    if (lines.length < 2) {
      errors.push('CSV input must include a header row and at least one data row.');
      return {
        deadlines: deadlines,
        terms: terms,
        clinicalPlacements: clinicalPlacements,
        errors: errors,
        warnings: warnings,
      };
    }

    const headers = splitCsvLine(lines[0]).map(function (h) {
      return h.toLowerCase().replace(/[\s_-]+/g, '');
    });

    const idxType = headers.findIndex(function (h) {
      return h === 'type' || h === 'recordtype' || h === 'kind';
    });
    const idxId = headers.findIndex(function (h) {
      return h === 'id';
    });
    const idxTitle = headers.findIndex(function (h) {
      return h === 'title' || h === 'name' || h === 'label';
    });
    const idxDomain = headers.findIndex(function (h) {
      return h === 'domain' || h === 'column' || h === 'stream';
    });
    const idxDueDate = headers.findIndex(function (h) {
      return h === 'duedate' || h === 'due' || h === 'deadline';
    });
    const idxPrepDays = headers.findIndex(function (h) {
      return (
        h === 'prepdurationdays' ||
        h === 'prepdays' ||
        h === 'durationdays' ||
        h === 'prep'
      );
    });
    const idxPostDays = headers.findIndex(function (h) {
      return (
        h === 'postdurationdays' ||
        h === 'postdays' ||
        h === 'followupdays' ||
        h === 'post'
      );
    });
    const idxCurve = headers.findIndex(function (h) {
      return h === 'workloadcurve' || h === 'curve' || h === 'gradientcurve';
    });
    const idxNotes = headers.findIndex(function (h) {
      return h === 'notes' || h === 'note' || h === 'description';
    });
    const idxStartDate = headers.findIndex(function (h) {
      return h === 'startdate' || h === 'start';
    });
    const idxEndDate = headers.findIndex(function (h) {
      return h === 'enddate' || h === 'end';
    });

    for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
      const cells = splitCsvLine(lines[rowIdx]);
      const rowLabel = 'CSV Row ' + (rowIdx + 1);
      const rawType = idxType >= 0 ? String(cells[idxType] || '').toLowerCase() : '';
      const hasStartEnd =
        idxStartDate >= 0 &&
        idxEndDate >= 0 &&
        Boolean(cells[idxStartDate]) &&
        Boolean(cells[idxEndDate]);

      const isPlacementRow =
        rawType === 'placement' || rawType === 'clinical_placement';

      const isTermRow =
        !isPlacementRow &&
        (rawType === 'term' ||
          rawType === 'ucl_term' ||
          (rawType !== 'deadline' &&
            hasStartEnd &&
            (idxDueDate < 0 || !cells[idxDueDate])));

      if (isPlacementRow) {
        const name = idxTitle >= 0 ? cells[idxTitle] || '' : '';
        const startDate = idxStartDate >= 0 ? cells[idxStartDate] || '' : '';
        const endDate = idxEndDate >= 0 ? cells[idxEndDate] || '' : '';
        const rawEndLoad =
          idxPrepDays >= 0 && cells[idxPrepDays] !== ''
            ? cells[idxPrepDays]
            : '14';
        const rawStartLoad =
          idxPostDays >= 0 && cells[idxPostDays] !== ''
            ? cells[idxPostDays]
            : '14';
        const workloadCurve = normalizeWorkloadCurve(
          idxCurve >= 0 ? cells[idxCurve] : 'exponential'
        );
        const notes =
          idxNotes >= 0 && cells[idxNotes] ? cells[idxNotes] : undefined;

        if (!name) {
          errors.push(rowLabel + ': Missing placement name.');
          continue;
        }
        const startMs = DateMath.parseIsoToUtcMs(startDate);
        const endMs = DateMath.parseIsoToUtcMs(endDate);
        if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
          errors.push(
            rowLabel + ' ("' + name + '"): Invalid startDate or endDate.'
          );
          continue;
        }
        const startLoadDays = Number(rawStartLoad);
        const endLoadDays = Number(rawEndLoad);

        clinicalPlacements.push({
          id:
            idxId >= 0 && cells[idxId] ? cells[idxId] : generateId('clin-pl'),
          name: name,
          startDate: startDate,
          endDate: endDate,
          startLoadDays:
            Number.isFinite(startLoadDays) && startLoadDays >= 0
              ? Math.round(startLoadDays)
              : 14,
          endLoadDays:
            Number.isFinite(endLoadDays) && endLoadDays >= 0
              ? Math.round(endLoadDays)
              : 14,
          workloadCurve: workloadCurve,
          notes: notes,
        });
      } else if (isTermRow) {
        const name = idxTitle >= 0 ? cells[idxTitle] || '' : '';
        const startDate = idxStartDate >= 0 ? cells[idxStartDate] || '' : '';
        const endDate = idxEndDate >= 0 ? cells[idxEndDate] || '' : '';

        if (!name) {
          errors.push(rowLabel + ': Missing term name.');
          continue;
        }
        const startMs = DateMath.parseIsoToUtcMs(startDate);
        const endMs = DateMath.parseIsoToUtcMs(endDate);
        if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
          errors.push(
            rowLabel +
              ' ("' +
              name +
              '"): Invalid startDate or endDate. Expected YYYY-MM-DD.'
          );
          continue;
        }
        if (endMs < startMs) {
          errors.push(rowLabel + ' ("' + name + '"): endDate precedes startDate.');
          continue;
        }

        terms.push({
          id: idxId >= 0 && cells[idxId] ? cells[idxId] : generateId('term'),
          name: name,
          startDate: startDate,
          endDate: endDate,
        });
      } else {
        const title = idxTitle >= 0 ? cells[idxTitle] || '' : '';
        const rawDomain = idxDomain >= 0 ? cells[idxDomain] || '' : '';
        const dueDate = idxDueDate >= 0 ? cells[idxDueDate] || '' : '';
        const rawPrep = idxPrepDays >= 0 && cells[idxPrepDays] !== '' ? cells[idxPrepDays] : '14';
        const rawPost = idxPostDays >= 0 && cells[idxPostDays] !== '' ? cells[idxPostDays] : '0';
        const workloadCurve = normalizeWorkloadCurve(
          idxCurve >= 0 ? cells[idxCurve] : 'exponential'
        );
        const notes = idxNotes >= 0 && cells[idxNotes] ? cells[idxNotes] : undefined;

        if (!title) {
          errors.push(rowLabel + ': Missing deadline title.');
          continue;
        }
        const domain = normalizeDomain(rawDomain);
        if (!domain) {
          errors.push(
            rowLabel +
              ' ("' +
              title +
              '"): Invalid domain "' +
              rawDomain +
              '". Expected academic, clinical, or research.'
          );
          continue;
        }
        if (Number.isNaN(DateMath.parseIsoToUtcMs(dueDate))) {
          errors.push(
            rowLabel +
              ' ("' +
              title +
              '"): Invalid dueDate "' +
              dueDate +
              '". Expected YYYY-MM-DD.'
          );
          continue;
        }
        const prepDurationDays = Number(rawPrep);
        if (!Number.isFinite(prepDurationDays) || prepDurationDays < 0) {
          errors.push(
            rowLabel +
              ' ("' +
              title +
              '"): Invalid prepDurationDays "' +
              rawPrep +
              '".'
          );
          continue;
        }
        const postDurationDays = Number(rawPost);
        if (!Number.isFinite(postDurationDays) || postDurationDays < 0) {
          errors.push(
            rowLabel +
              ' ("' +
              title +
              '"): Invalid postDurationDays "' +
              rawPost +
              '".'
          );
          continue;
        }

        deadlines.push({
          id: idxId >= 0 && cells[idxId] ? cells[idxId] : generateId('dl'),
          title: title,
          domain: domain,
          dueDate: dueDate,
          prepDurationDays: Math.round(prepDurationDays),
          postDurationDays: Math.round(postDurationDays),
          workloadCurve: workloadCurve,
          notes: notes,
        });
      }
    }

    const allDates = deadlines
      .map(function (d) {
        return d.dueDate;
      })
      .concat(
        terms.map(function (t) {
          return t.startDate;
        }),
        clinicalPlacements.map(function (p) {
          return p.startDate;
        })
      );
    const detectedStartYear = inferProgrammeStartYear(allDates);

    return {
      deadlines: deadlines,
      terms: terms,
      clinicalPlacements: clinicalPlacements,
      detectedStartYear: detectedStartYear,
      errors: errors,
      warnings: warnings,
    };
  }

  function serializeToJson(
    programmeStartYear,
    deadlines,
    terms,
    clinicalPlacements
  ) {
    const out = {
      programmeStartYear: programmeStartYear,
      deadlines: deadlines,
      terms: terms,
    };
    if (Array.isArray(clinicalPlacements) && clinicalPlacements.length > 0) {
      out.clinicalPlacements = clinicalPlacements;
    }
    return JSON.stringify(out, null, 2);
  }

  function escapeCsvCell(val) {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function serializeToCsv(deadlines, terms, clinicalPlacements) {
    const header =
      'type,id,title,domain,dueDate,prepDurationDays,postDurationDays,workloadCurve,startDate,endDate,notes';
    const rows = [header];

    deadlines.forEach(function (d) {
      rows.push(
        [
          'deadline',
          escapeCsvCell(d.id),
          escapeCsvCell(d.title),
          escapeCsvCell(d.domain),
          escapeCsvCell(d.dueDate),
          escapeCsvCell(d.prepDurationDays ?? 0),
          escapeCsvCell(d.postDurationDays ?? 0),
          escapeCsvCell(d.workloadCurve === 'linear' ? 'linear' : 'exponential'),
          '',
          '',
          escapeCsvCell(d.notes || ''),
        ].join(',')
      );
    });

    if (Array.isArray(clinicalPlacements)) {
      clinicalPlacements.forEach(function (p) {
        rows.push(
          [
            'placement',
            escapeCsvCell(p.id),
            escapeCsvCell(p.name),
            'clinical',
            '',
            escapeCsvCell(p.endLoadDays ?? 14),
            escapeCsvCell(p.startLoadDays ?? 14),
            escapeCsvCell(p.workloadCurve === 'linear' ? 'linear' : 'exponential'),
            escapeCsvCell(p.startDate),
            escapeCsvCell(p.endDate),
            escapeCsvCell(p.notes || ''),
          ].join(',')
        );
      });
    }

    terms.forEach(function (t) {
      rows.push(
        [
          'term',
          escapeCsvCell(t.id),
          escapeCsvCell(t.name),
          '',
          '',
          '',
          '',
          '',
          escapeCsvCell(t.startDate),
          escapeCsvCell(t.endDate),
          '',
        ].join(',')
      );
    });

    return rows.join('\n');
  }

  global.TimelinerSchemaParser = {
    generateId: generateId,
    parseScheduleDataset: parseScheduleDataset,
    serializeToJson: serializeToJson,
    serializeToCsv: serializeToCsv,
  };
})(window);
