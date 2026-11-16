import { create } from 'zustand';
import type { FxEvent } from '@podiepanikk/shared';

/** Lokale, kortvarige sceneeffekter utløst av serverens hendelser. */
export interface Projectile {
  id: number;
  kind: 'pie' | 'coin' | 'bombFly';
  from: string;
  to: string;
  start: number; // performance.now() ms
  dur: number;
}

interface StageFx {
  hitUntil: Record<string, number>;
  throwUntil: Record<string, number>;
  piedUntil: Record<string, number>;
  sootyUntil: Record<string, number>;
  projectiles: Projectile[];
  explosions: { id: number; playerId: string; start: number }[];
  confettiBurst: number;
  excitement: number;
}

export const useStageFx = create<StageFx>(() => ({
  hitUntil: {},
  throwUntil: {},
  piedUntil: {},
  sootyUntil: {},
  projectiles: [],
  explosions: [],
  confettiBurst: 0,
  excitement: 0,
}));

let seq = 0;
const set = useStageFx.setState;
const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms);

function mark(key: 'hitUntil' | 'throwUntil' | 'piedUntil' | 'sootyUntil', pid: string, ms: number) {
  const until = performance.now() + ms;
  set((s) => ({ [key]: { ...s[key], [pid]: until } }) as Partial<StageFx>);
  // Fjern oppføringen når den utløper, slik at karakteren tegnes på nytt uten effekten.
  later(ms + 50, () =>
    set((s) => {
      const m = { ...s[key] };
      if ((m[pid] ?? 0) <= performance.now()) delete m[pid];
      return { [key]: m } as Partial<StageFx>;
    }),
  );
}

export function resetStageFx(): void {
  set({ hitUntil: {}, throwUntil: {}, piedUntil: {}, sootyUntil: {}, projectiles: [], explosions: [] });
}

export function handleStageFx(events: FxEvent[]): void {
  let delay = 0;
  for (const f of events) {
    switch (f.type) {
      case 'pie': {
        if (!f.playerId || !f.targetId) break;
        const from = f.playerId;
        const to = f.targetId;
        const d = delay;
        delay += 450;
        later(d, () => {
          mark('throwUntil', from, 800);
          const id = ++seq;
          later(300, () => set((s) => ({ projectiles: [...s.projectiles, { id, kind: 'pie', from, to, start: performance.now(), dur: 850 }] })));
          later(1150, () => {
            set((s) => ({ projectiles: s.projectiles.filter((p) => p.id !== id), excitement: 1 }));
            mark('hitUntil', to, 1200);
            mark('piedUntil', to, 7000);
          });
        });
        break;
      }
      case 'steal': {
        if (!f.playerId || !f.targetId || !f.amount) break;
        const ids: number[] = [];
        const now = performance.now();
        const coins = Math.min(8, Math.max(2, Math.round(f.amount / 50)));
        const list: Projectile[] = [];
        for (let i = 0; i < coins; i++) {
          const id = ++seq;
          ids.push(id);
          list.push({ id, kind: 'coin', from: f.targetId, to: f.playerId, start: now + delay + i * 90, dur: 1000 });
        }
        delay += 300;
        set((s) => ({ projectiles: [...s.projectiles, ...list], excitement: 0.8 }));
        mark('hitUntil', f.targetId, 900);
        later(2200 + delay, () => set((s) => ({ projectiles: s.projectiles.filter((p) => !ids.includes(p.id)) })));
        break;
      }
      case 'explode':
        if (!f.playerId) break;
        set((s) => ({ explosions: [...s.explosions, { id: ++seq, playerId: f.playerId!, start: performance.now() }], excitement: 1 }));
        mark('hitUntil', f.playerId, 1500);
        mark('sootyUntil', f.playerId, 9000);
        later(2500, () => set((s) => ({ explosions: s.explosions.slice(1) })));
        break;
      case 'winner':
        later(1700, () => set((s) => ({ confettiBurst: s.confettiBurst + 1, excitement: 1 })));
        break;
      case 'roundStart':
      case 'correct':
        set({ excitement: 0.7 });
        break;
    }
  }
}
