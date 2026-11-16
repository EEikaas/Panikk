import { ADULT_CATEGORY, isAdultGame, LENGTH_CONFIG, type CategoryId, type Difficulty, type GameSettings, type Question, Rng } from '@podiepanikk/shared';

/** Grovt anslag på hvor mange spørsmål et spill kan bruke. */
export function estimateNeeded(settings: GameSettings): number {
  const cfg = LENGTH_CONFIG[settings.length];
  return (cfg.maxRounds - 2) * cfg.questionsPerRound + cfg.bombsPerRound * 8 + cfg.finalMaxQuestions + 10;
}

const DIFF_TIERS: Record<Difficulty, Difficulty[][]> = {
  barn: [['barn'], ['familie']],
  familie: [['barn', 'familie'], ['voksen']],
  voksen: [['voksen', 'familie'], ['barn']],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-zæøå0-9]/g, '');

/**
 * Bygger et stokket spørsmålsutvalg for ett spill. Prioritet:
 * valgte kategorier + riktig nivå → andre kategorier → nabonivå.
 * Svaralternativene stokkes per spill, og riktig indeks flyttes tilsvarende.
 */
export function buildQuestionPool(
  all: Question[],
  settings: GameSettings,
  seed: number,
): { pool: Question[]; warnings: string[] } {
  const rng = new Rng(seed ^ 0x51ed);
  const warnings: string[] = [];
  const needed = estimateNeeded(settings);
  const langs = settings.useExternal ? ['nb', 'en'] : ['nb'];
  const cats: CategoryId[] = settings.categories.filter((c) => c !== 'blandet');
  const anyCat = cats.length === 0;

  // 18+-spørsmål slipper bare inn når verten eksplisitt har valgt kategorien på voksennivå.
  const adultAllowed = isAdultGame(settings);
  const seenId = new Set<string>();
  const seenText = new Set<string>();
  const unique = all.filter((q) => {
    if (q.category === ADULT_CATEGORY && !adultAllowed) return false;
    const t = norm(q.text);
    if (seenId.has(q.id) || seenText.has(t)) return false;
    seenId.add(q.id);
    seenText.add(t);
    return langs.includes(q.language);
  });

  const [primaryDiffs, fallbackDiffs] = DIFF_TIERS[settings.difficulty];
  const tier1 = unique.filter((q) => primaryDiffs.includes(q.difficulty) && (anyCat || cats.includes(q.category)));
  const tier2 = anyCat ? [] : unique.filter((q) => primaryDiffs.includes(q.difficulty) && !cats.includes(q.category));
  const tier3 = unique.filter((q) => fallbackDiffs.includes(q.difficulty));

  let pool = rng.shuffle(tier1);
  if (pool.length < needed && tier2.length > 0) {
    warnings.push('For få spørsmål i valgte kategorier – fyller på med andre kategorier.');
    pool = pool.concat(rng.shuffle(tier2));
  }
  if (pool.length < needed && tier3.length > 0) {
    warnings.push('For få spørsmål på valgt nivå – låner noen fra nabonivået.');
    pool = pool.concat(rng.shuffle(tier3));
  }
  if (pool.length < needed) warnings.push('Spørsmålsbanken er liten – noen runder kan bli kortere.');

  const shuffled = pool.map((q) => {
    const order = rng.shuffle([0, 1, 2, 3]);
    const options = order.map((i) => q.options[i]) as Question['options'];
    const correctIndex = order.indexOf(q.correctIndex) as Question['correctIndex'];
    return { ...q, options, correctIndex };
  });
  return { pool: shuffled, warnings };
}
