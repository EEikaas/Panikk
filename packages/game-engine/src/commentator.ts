import { COMMENTARY, COMMENTARY_ADULT, fillCommentary, type Commentary, type Rng, type Situation } from '@podiepanikk/shared';

/**
 * Velger situasjonsbaserte kommentarer og unngår nylig brukte linjer.
 * I 18+-spill blandes frekkere linjer inn (omtrent annenhver gang).
 */
export class Commentator {
  private recent: string[] = [];
  private seq = 0;
  constructor(private rng: Rng, public adult = false) {}

  pick(situation: Situation, vars: { name?: string; target?: string; n?: number } = {}): Commentary {
    const entry = COMMENTARY[situation];
    const adultLines = this.adult ? COMMENTARY_ADULT[situation] ?? [] : [];
    const useAdult = adultLines.length > 0 && this.rng.next() < 0.55;
    const pool = useAdult ? adultLines : entry.lines;
    const fresh = pool.filter((l) => !this.recent.includes(l));
    const line = this.rng.pick(fresh.length > 0 ? fresh : pool);
    this.recent.push(line);
    if (this.recent.length > 14) this.recent.shift();
    return { id: ++this.seq, text: fillCommentary(line, vars), mood: useAdult ? 'funny' : entry.mood };
  }
}
