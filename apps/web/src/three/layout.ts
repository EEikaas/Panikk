import type { PublicState } from '@podiepanikk/shared';
import type { Emotion } from './Character';

export interface Slot {
  x: number;
  y: number; // scenenivå (andre rad er hevet)
  z: number;
  rotY: number;
}

/** Dynamisk sceneoppsett: én rad (2–4), halvsirkel (5–8), to nivåer (9–12). */
export function podiumSlots(n: number): Slot[] {
  const slots: Slot[] = [];
  if (n <= 4) {
    const gap = 2.4;
    for (let i = 0; i < n; i++) slots.push({ x: (i - (n - 1) / 2) * gap, y: 0, z: 0, rotY: 0 });
    return slots;
  }
  const arc = (count: number, radius: number, span: number, y: number, zShift: number) => {
    for (let i = 0; i < count; i++) {
      const a = count === 1 ? 0 : -span / 2 + (span * i) / (count - 1);
      slots.push({ x: Math.sin(a) * radius, y, z: radius - Math.cos(a) * radius + zShift, rotY: -a * 0.85 });
    }
  };
  // Halvsirkel der kantene kommer frem mot publikum/kamera (midten lengst bak).
  if (n <= 8) {
    arc(n, 6, Math.min(1.7, 0.3 * n), 0, -1);
    return slots;
  }
  const front = Math.ceil(n / 2);
  arc(front, 6.5, Math.min(1.8, 0.29 * front), 0, 0.2);
  arc(n - front, 7.5, Math.min(1.6, 0.27 * (n - front)), 1.0, -2.2); // bakre rad: hevet og lenger bak
  return slots;
}

export function overviewDistance(n: number): number {
  return n <= 4 ? 9.5 : n <= 8 ? 12.5 : 14.5;
}

/** Avleder karakterens følelse fra serverens tilstand. */
export function emotionFor(st: PublicState, pid: string, local: { hitUntil?: number; throwUntil?: number }, now: number): Emotion {
  const p = st.players.find((x) => x.id === pid);
  if (!p) return 'idle';
  if (local.hitUntil && now < local.hitUntil) return 'hit';
  if (local.throwUntil && now < local.throwUntil) return 'throw';
  if (st.phase === 'CEREMONY' || st.phase === 'GAME_OVER') {
    if (st.winnerId === pid) return 'victory';
    const rank = st.ranking.indexOf(pid);
    return rank >= 0 && rank < 3 ? 'clap' : 'sad';
  }
  if (st.bomb && !st.bomb.exploded && st.bomb.holderId === pid && (st.phase === 'QUESTION' || st.phase === 'TARGETING')) return 'nervous';
  if (st.phase === 'BUZZ_ANSWER' && st.buzz?.activePlayerId === pid) return 'surprised';
  if (st.phase === 'REVEAL' && st.reveal) {
    const r = st.reveal.results.find((x) => x.playerId === pid);
    if (r) return r.correct ? 'happy' : 'sad';
  }
  if (st.phase === 'ACTION_RESULT') {
    const a = st.actions.find((x) => x.toId === pid);
    if (a?.kind === 'steal') return 'surprised';
    if (st.actions.some((x) => x.fromId === pid && x.kind === 'steal')) return 'happy';
  }
  if (st.phase === 'SCOREBOARD') {
    const rank = st.ranking.indexOf(pid);
    return rank === 0 ? 'happy' : rank === st.ranking.length - 1 ? 'sad' : 'idle';
  }
  if (st.phase === 'TARGETING' && st.targeting?.eligible.includes(pid)) return 'happy';
  return 'idle';
}
