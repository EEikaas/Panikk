import { questionInputSchema, type QuestionInput } from '@podiepanikk/shared';

/** Enkel RFC 4180-parser: støtter anførselstegn, doble anførselstegn og linjeskift i felt. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = delimiter ?? (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

export interface ImportOutcome {
  valid: QuestionInput[];
  errors: { row: number; message: string }[];
}

function correctToIndex(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(s)) return s.charCodeAt(0) - 65;
  if (['1', '2', '3', '4'].includes(s)) return Number(s) - 1;
  return -1;
}

/** CSV-kolonner: tekst, a, b, c, d, riktig (A–D), kategori, nivå[, kilde] */
export function importQuestionsCsv(text: string): ImportOutcome {
  const rows = parseCsv(text);
  const out: ImportOutcome = { valid: [], errors: [] };
  rows.forEach((r, i) => {
    if (i === 0 && /^(tekst|text|spørsmål|sporsmal|question)$/i.test(r[0]?.trim() ?? '')) return;
    const parsed = questionInputSchema.safeParse({
      text: r[0],
      options: [r[1], r[2], r[3], r[4]],
      correctIndex: correctToIndex(r[5]),
      category: r[6]?.trim().toLowerCase(),
      difficulty: r[7]?.trim().toLowerCase(),
      source: r[8]?.trim() || undefined,
    });
    if (parsed.success) out.valid.push(parsed.data);
    else out.errors.push({ row: i + 1, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
  });
  return out;
}

/** JSON: liste med { text, options[4], correctIndex | correct, category, difficulty, source? } */
export function importQuestionsJson(text: string): ImportOutcome {
  const out: ImportOutcome = { valid: [], errors: [] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    out.errors.push({ row: 0, message: 'Ugyldig JSON' });
    return out;
  }
  const list = Array.isArray(data) ? data : (data as { questions?: unknown[] })?.questions;
  if (!Array.isArray(list)) {
    out.errors.push({ row: 0, message: 'Forventet en liste med spørsmål' });
    return out;
  }
  list.forEach((item, i) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const parsed = questionInputSchema.safeParse({
      ...o,
      correctIndex: o.correctIndex ?? correctToIndex(o.correct),
    });
    if (parsed.success) out.valid.push(parsed.data);
    else out.errors.push({ row: i + 1, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
  });
  return out;
}
