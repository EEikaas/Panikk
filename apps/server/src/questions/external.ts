import { z } from 'zod';
import type { CategoryId, Difficulty, Question } from '@podiepanikk/shared';

/*
 * Adapter for Open Trivia Database (https://opentdb.com).
 * Innholdet er lisensiert under CC BY-SA 4.0 – kilde vises ved hvert spørsmål.
 * Spørsmålene er på engelsk og merkes language: 'en'.
 *
 * Sikkerhetsprinsipper:
 *  - Alt valideres med Zod før bruk; ugyldige spørsmål forkastes.
 *  - Feiler kilden, returneres en tom liste. Vi gjetter ALDRI riktig svar.
 *  - Resultater caches for å unngå å belaste API-et.
 */

const otdbItem = z.object({
  type: z.literal('multiple'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string(),
  question: z.string().min(5).max(400),
  correct_answer: z.string().min(1).max(150),
  incorrect_answers: z.array(z.string().min(1).max(150)).length(3),
});
const otdbResponse = z.object({ response_code: z.number(), results: z.array(z.unknown()) });

// Rekkefølgen betyr noe: mest spesifikke mønstre først («Science: Computers» → teknologi).
const CATEGORY_MAP: [RegExp, CategoryId][] = [
  [/computer|gadget/i, 'teknologi'],
  [/geograph/i, 'geografi'],
  [/history|politics/i, 'historie'],
  [/science|nature|mathematics/i, 'vitenskap'],
  [/film|television|cartoon|anime/i, 'filmtv'],
  [/music/i, 'musikk'],
  [/sport/i, 'sport'],
  [/animal/i, 'dyr'],
];

export function mapCategory(name: string): CategoryId {
  return CATEGORY_MAP.find(([re]) => re.test(name))?.[1] ?? 'generelt';
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return '';
  }
}

const DIFF_MAP: Record<Difficulty, string[]> = { barn: ['easy'], familie: ['easy', 'medium'], voksen: ['medium', 'hard'] };
const LEVEL: Record<string, Difficulty> = { easy: 'barn', medium: 'familie', hard: 'voksen' };

/** Validerer og normaliserer ett rått element. Returnerer null hvis noe er galt. */
export function normalizeOtdb(raw: unknown): Question | null {
  const p = otdbItem.safeParse(raw);
  if (!p.success) return null;
  const it = p.data;
  const text = decode(it.question).trim();
  const correct = decode(it.correct_answer).trim();
  const wrong = it.incorrect_answers.map((w) => decode(w).trim());
  const opts = [correct, ...wrong];
  if (!text || opts.some((o) => !o || o.length > 120)) return null;
  if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) return null;
  let h = 0;
  for (const ch of text) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return {
    id: `otdb-${(h >>> 0).toString(36)}`,
    text,
    options: opts as Question['options'],
    correctIndex: 0,
    category: mapCategory(decode(it.category)),
    difficulty: LEVEL[it.difficulty],
    language: 'en',
    source: 'Open Trivia Database (CC BY-SA 4.0)',
  };
}

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export class ExternalQuestionSource {
  private cache = new Map<string, { at: number; items: Question[] }>();
  constructor(
    private fetchFn: FetchLike = fetch as unknown as FetchLike,
    private baseUrl = 'https://opentdb.com/api.php',
    private ttlMs = 30 * 60 * 1000,
  ) {}

  async fetch(difficulty: Difficulty, amount = 50, timeoutMs = 4000): Promise<Question[]> {
    const out: Question[] = [];
    for (const level of DIFF_MAP[difficulty]) {
      const key = `${level}:${amount}`;
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.at < this.ttlMs) {
        out.push(...cached.items);
        continue;
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await this.fetchFn(`${this.baseUrl}?amount=${amount}&type=multiple&difficulty=${level}&encode=url3986`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) continue;
        const body = otdbResponse.safeParse(await res.json());
        if (!body.success || body.data.response_code !== 0) continue;
        const items = body.data.results.map(normalizeOtdb).filter((q): q is Question => q !== null);
        this.cache.set(key, { at: Date.now(), items });
        out.push(...items);
      } catch {
        // Nettverksfeil/tidsavbrudd: hopp over – den innebygde banken brukes i stedet.
      }
    }
    return out;
  }
}
