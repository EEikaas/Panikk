import { randomUUID } from 'node:crypto';
import type { Room } from './rooms';

import type { BotLevel } from '@podiepanikk/shared';

// Sannsynlighet for at en bot «kan» svaret (ellers gjetter den) – ca. 60–65 % treff totalt.
const ACCURACY = { barn: 0.55, familie: 0.5, voksen: 0.4 } as const;

interface Profile {
  know: number; // sannsynlighet for å kunne svaret
  buzz: [number, number]; // reaksjonstid på knappen (ms)
  answer: [number, number]; // svartid (ms)
}

/** Styrkenivåer for motstanderne i solospill. */
export const BOT_PROFILES: Record<BotLevel, Profile> = {
  lett: { know: 0.3, buzz: [2500, 8000], answer: [3000, 9000] },
  middels: { know: 0.55, buzz: [1200, 6000], answer: [1500, 7000] },
  vanskelig: { know: 0.8, buzz: [600, 3000], answer: [800, 4000] },
};

/**
 * Testspillere (simulatormodus) som spiller via de samme motorreglene som mennesker.
 * De sender handlinger med tilfeldig forsinkelse og ser ingenting klientene ikke kan se –
 * med unntak av treffsikkerhet, som styres ved å «kikke» på fasit med en sannsynlighet.
 */
export class BotDriver {
  private scheduled = new Set<string>();
  private timers = new Set<NodeJS.Timeout>();

  constructor(private room: Room, private onAction: () => void) {}

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private later(key: string, minMs: number, maxMs: number, fn: () => void): void {
    if (this.scheduled.has(key)) return;
    this.scheduled.add(key);
    if (this.scheduled.size > 2000) this.scheduled.clear();
    const scale = this.room.engine.settings.timeScale ?? 1;
    const delay = (minMs + Math.random() * (maxMs - minMs)) * scale;
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, delay);
    this.timers.add(t);
  }

  onChange(): void {
    const e = this.room.engine;
    const bots = e.players.filter((p) => p.isBot && !p.left);
    if (bots.length === 0) return;
    const now = Date.now();
    const stamp = `${e.phase}:${e.phaseStartedAt}`;
    // Solospill bruker valgt styrkenivå; testspillere i vanlige rom følger spørsmålsnivået.
    const profile: Profile = e.settings.solo
      ? BOT_PROFILES[e.settings.botLevel ?? 'middels']
      : { know: ACCURACY[e.settings.difficulty], buzz: [800, 5000], answer: [900, 7000] };
    for (const bot of bots) {
      const snap = e.snapshot({ memberId: bot.id, playerId: bot.id, isHost: false, isScreen: false }, now);
      const q = snap.question;
      if (snap.you.canBuzz && q) {
        this.later(`${bot.id}:buzz:${stamp}`, profile.buzz[0], profile.buzz[1], () => {
          if (e.buzzIn(bot.id, q.id, randomUUID(), Date.now()).ok) this.onAction();
        });
      }
      if (snap.you.canAnswer && q) {
        const [min, max] = e.phase === 'BUZZ_ANSWER' ? [Math.min(profile.answer[0], 1500), 4000] : profile.answer;
        this.later(`${bot.id}:answer:${stamp}`, min, max, () => {
          const correct = e.peekCorrectIndex();
          const smart = Math.random() < profile.know;
          const choice = smart && correct != null ? correct : Math.floor(Math.random() * 4);
          if (e.answer(bot.id, q.id, choice, randomUUID(), Date.now()).ok) this.onAction();
        });
      }
      if (snap.you.canTarget && snap.you.targetOptions.length) {
        this.later(`${bot.id}:target:${stamp}`, 800, 2500, () => {
          const opts = snap.you.targetOptions;
          // Litt «ondskap»: sikt ofte på lederen.
          const leader = [...e.players].filter((p) => opts.includes(p.id)).sort((a, b) => b.score - a.score)[0];
          const target = Math.random() < 0.6 && leader ? leader.id : opts[Math.floor(Math.random() * opts.length)];
          if (e.chooseTarget(bot.id, target, randomUUID(), Date.now()).ok) this.onAction();
        });
      }
    }
  }
}
