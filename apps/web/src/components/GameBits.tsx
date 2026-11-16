import { useEffect, useRef, useState } from 'react';
import { ANSWER_COLORS, type Commentary as CommentaryT, type PublicPlayer, type PublicState } from '@podiepanikk/shared';
import { serverNow } from '../net/room';
import { Avatar } from './Avatar';

/** Nedtelling mot serverens frist (justert for klokkeforskjell). */
export function useRemaining(deadline: number | null, startedAt: number): { ms: number; frac: number } {
  const [, force] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 90) {
        last = t;
        force((x) => x + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [deadline]);
  if (!deadline) return { ms: 0, frac: 0 };
  const total = Math.max(1, deadline - startedAt);
  const ms = Math.max(0, deadline - serverNow());
  return { ms, frac: Math.min(1, ms / total) };
}

export function TimerBar({ state, showNumber = true }: { state: PublicState; showNumber?: boolean }) {
  const { ms, frac } = useRemaining(state.deadline, state.phaseStartedAt);
  if (!state.deadline) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="timer" style={{ flex: 1 }} role="timer" aria-label={`${Math.ceil(ms / 1000)} sekunder igjen`}>
        <i style={{ transform: `scaleX(${frac})`, backgroundPosition: `${(1 - frac) * 100}% 0` }} />
      </div>
      {showNumber && <span className="timer-num">{Math.ceil(ms / 1000)}</span>}
    </div>
  );
}

export function CommentaryBubble({ c }: { c: CommentaryT | null }) {
  if (!c) return null;
  return (
    <div key={c.id} className={`commentary ${c.mood}`}>
      <span className="commentary-host">Programlederen</span>
      {c.text}
    </div>
  );
}

const LETTERS = ['A', 'B', 'C', 'D'];

/** Fire fargede svarknapper. mode='pads' gir rene kontrollerknapper uten tekst. */
export function AnswerButtons({
  state,
  onAnswer,
  mode = 'text',
  interactive = true,
}: {
  state: PublicState;
  onAnswer?: (i: number) => Promise<boolean> | void;
  mode?: 'text' | 'pads';
  interactive?: boolean;
}) {
  const q = state.question;
  const reveal = state.reveal;
  const chosen = state.you.choice;
  const lastTap = useRef(0);
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => setPending(null), [q?.id, state.phase]);
  if (!q) return null;
  const can = interactive && state.you.canAnswer && pending == null;
  const pickersFor = (i: number) => (reveal ? reveal.results.filter((r) => r.choice === i).map((r) => state.players.find((p) => p.id === r.playerId)!).filter(Boolean) : []);
  return (
    <div className={`answers ${mode === 'pads' ? 'pads' : ''}`}>
      {q.options.map((opt, i) => {
        const col = ANSWER_COLORS[i];
        const isChosen = chosen === i || pending === i;
        const cls = [
          'answer',
          col.id === 'yellow' ? 'yellow' : '',
          isChosen ? 'chosen' : '',
          reveal && reveal.correctIndex === i ? 'correct' : '',
          reveal && reveal.correctIndex !== i ? 'wrong' : '',
          !reveal && (chosen != null || pending != null) && !isChosen ? 'dim' : '',
        ].join(' ');
        const pickers = pickersFor(i);
        return (
          <button
            key={i}
            className={cls}
            style={{ ['--c' as string]: col.hex, ['--dark' as string]: col.dark }}
            disabled={!can}
            aria-label={`${col.name}: ${opt}`}
            onPointerDown={(e) => {
              // Reagerer på trykk (ikke slipp) for raskest mulig respons; sperre mot dobbelttrykk.
              if (!can || e.button > 0) return;
              const now = performance.now();
              if (now - lastTap.current < 400) return;
              lastTap.current = now;
              setPending(i);
              void onAnswer?.(i)?.then((ok) => !ok && setPending(null));
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && can) {
                setPending(i);
                void onAnswer?.(i)?.then((ok) => !ok && setPending(null));
              }
            }}
          >
            <span className="letter">{LETTERS[i]}</span>
            {mode === 'text' && opt}
            {pickers.length > 0 && (
              <span className="pickers">
                {pickers.slice(0, 6).map((p) => (
                  <Avatar key={p.id} characterId={p.characterId} variant={p.variant} size={22} />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Buzzer({ state, onBuzz }: { state: PublicState; onBuzz: () => void }) {
  const [pressed, setPressed] = useState(false);
  useEffect(() => setPressed(false), [state.phaseStartedAt]);
  const can = state.you.canBuzz && !pressed;
  const active = state.buzz?.activePlayerId;
  const locked = !!state.you.playerId && state.buzz?.lockedOut.includes(state.you.playerId);
  const activeName = state.players.find((p) => p.id === active)?.name;
  return (
    <div className="buzzer-wrap">
      <button
        className={`buzzer ${can ? 'armed' : ''}`}
        disabled={!can}
        onPointerDown={(e) => {
          if (!can || e.button > 0) return;
          setPressed(true);
          onBuzz();
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && can) {
            setPressed(true);
            onBuzz();
          }
        }}
        aria-label="Trykk-knapp"
      >
        TRYKK!
      </button>
      <div className="m-status" aria-live="polite">
        {locked ? 'Du er utestengt fra dette spørsmålet 😬' : active ? (active === state.you.playerId ? 'Du var raskest – svar nå!' : `${activeName} var raskest!`) : can ? 'Trykk når du kan svaret!' : pressed ? 'Venter …' : ''}
      </div>
    </div>
  );
}

export function TargetPicker({ state, onPick, verb }: { state: PublicState; onPick: (id: string) => void; verb: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [state.phaseStartedAt]);
  const opts = state.you.targetOptions.map((id) => state.players.find((p) => p.id === id)!).filter(Boolean);
  const chosen = picked ?? state.you.chosenTarget;
  return (
    <div>
      <div className="m-status">{verb}</div>
      <div className="targets">
        {opts.map((p) => (
          <button
            key={p.id}
            className={`target ${chosen === p.id ? 'on' : ''}`}
            disabled={!!chosen}
            onClick={() => {
              setPicked(p.id);
              onPick(p.id);
            }}
          >
            <Avatar characterId={p.characterId} variant={p.variant} size={54} />
            {p.name}
            <small>{p.score} poeng</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Scoreboard({ state, limit = 12 }: { state: PublicState; limit?: number }) {
  const order = state.ranking.length ? state.ranking : [...state.players].sort((a, b) => b.score - a.score).map((p) => p.id);
  const rows = order.map((id) => state.players.find((p) => p.id === id)!).filter(Boolean).slice(0, limit);
  return (
    <div className="scoreboard">
      {rows.map((p, i) => (
        <div key={p.id} className={`score-row ${i === 0 ? 'first' : ''} ${p.id === state.you.playerId ? 'me' : ''}`} style={{ animationDelay: `${i * 0.06}s` }}>
          <span className="rank">{i + 1}</span>
          <Avatar characterId={p.characterId} variant={p.variant} size={44} mood={i === 0 ? 'happy' : i === rows.length - 1 ? 'sad' : 'happy'} />
          <span className="name">
            {p.name}
            {!p.connected && !p.isBot && <span className="muted small"> (frakoblet)</span>}
          </span>
          <span className="pts">
            <AnimatedNumber value={p.score} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return <>{shown}</>;
}

export function Delta({ v }: { v: number }) {
  if (!v) return null;
  return <span className={`delta ${v > 0 ? 'up' : 'down'}`}>{v > 0 ? `+${v}` : v}</span>;
}

export function FinalTrack({ state }: { state: PublicState }) {
  const f = state.final;
  if (!f) return null;
  const players = [...state.players].filter((p) => !p.left).sort((a, b) => b.finalSteps - a.finalSteps);
  return (
    <div className="final-track" style={{ ['--goal' as string]: f.goal }}>
      {players.map((p) => (
        <div key={p.id} className={`lane ${f.tiebreak?.includes(p.id) ? 'tied' : ''}`}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          <div className="lane-bar">
            <div className="lane-goal" />
            <div className="lane-runner" style={{ left: `${Math.min(100, (p.finalSteps / f.goal) * 100)}%` }}>
              <Avatar characterId={p.characterId} variant={p.variant} size={32} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BombMeter({ state }: { state: PublicState }) {
  const b = state.bomb;
  if (!b) return null;
  const holder = state.players.find((p) => p.id === b.holderId);
  return (
    <div className="bomb-meter">
      <span className={`bomb-icon ${b.intensity > 0.6 ? 'shake' : ''}`} aria-hidden>
        💣
      </span>
      <span>{b.exploded ? 'BOOM!' : holder?.id === state.you.playerId ? 'DU har bomben!' : `${holder?.name ?? '?'} har bomben`}</span>
      <span className="fuse" aria-hidden>
        <i style={{ width: `${(1 - b.intensity) * 100}%` }} />
      </span>
      <span className="muted small">{b.bombsLeft} igjen</span>
    </div>
  );
}

export function RevealSummary({ state, compact = false }: { state: PublicState; compact?: boolean }) {
  const r = state.reveal;
  if (!r) return null;
  const me = r.results.find((x) => x.playerId === state.you.playerId);
  const correctPlayers = r.results.filter((x) => x.correct).map((x) => state.players.find((p) => p.id === x.playerId)!).filter(Boolean);
  return (
    <div style={{ textAlign: 'center' }}>
      {me && (
        <div className={`feedback ${me.correct ? 'good' : 'bad'}`}>
          {me.correct ? 'Riktig!' : me.choice == null ? 'For sent!' : 'Feil!'} <Delta v={me.delta} />
        </div>
      )}
      {!compact && (
        <div className="muted" style={{ fontWeight: 800 }}>
          {correctPlayers.length ? `Riktig: ${correctPlayers.map((p) => p.name).join(', ')}` : 'Ingen svarte riktig'}
        </div>
      )}
    </div>
  );
}

export function PlayerChip({ p }: { p: PublicPlayer }) {
  return (
    <span className="player-chip">
      <Avatar characterId={p.characterId} variant={p.variant} size={26} />
      {p.name}
    </span>
  );
}
