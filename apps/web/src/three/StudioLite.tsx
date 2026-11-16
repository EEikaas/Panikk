import type { PublicState } from '@podiepanikk/shared';
import { Avatar } from '../components/Avatar';

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Reservevisning uten WebGL (eller når 3D er slått av i innstillingene). */
export function StudioLite({ state }: { state: PublicState }) {
  const active = state.buzz?.activePlayerId ?? (state.bomb && !state.bomb.exploded ? state.bomb.holderId : null);
  return (
    <div className="lite-stage" aria-hidden>
      {state.players
        .filter((p) => !p.left)
        .map((p) => {
          const res = state.reveal?.results.find((r) => r.playerId === p.id);
          const mood = res ? (res.correct ? 'happy' : 'sad') : state.winnerId === p.id ? 'happy' : active === p.id ? 'wow' : 'happy';
          return (
            <div key={p.id} className={`lite-pod ${active === p.id ? 'active' : ''}`}>
              {state.bomb && state.bomb.holderId === p.id && !state.bomb.exploded && <span>💣</span>}
              <Avatar characterId={p.characterId} variant={p.variant} size={56} mood={mood} />
              <span className="base">
                {p.name} · {state.round?.type === 'final' ? `${p.finalSteps} steg` : p.score}
              </span>
            </div>
          );
        })}
    </div>
  );
}
