import { useEffect, useState } from 'react';
import { ANSWER_COLORS, ROUND_INFO, type PublicState } from '@podiepanikk/shared';
import { Avatar } from '../components/Avatar';
import { AnimatedNumber, AnswerButtons, BombMeter, Buzzer, CommentaryBubble, FinalTrack, RevealSummary, Scoreboard, TargetPicker, TimerBar } from '../components/GameBits';
import { toast } from '../components/Toasts';
import { sendAnswer, sendBuzz, sendTarget, setView } from '../net/room';
import { vibrate } from '../settings';
import { Studio } from '../three/Studio';
import { ActionSummary, CeremonyPanel, HostButtons, RoundIntro } from './Shared';

const LETTERS = ['A', 'B', 'C', 'D'];

async function act(p: Promise<{ ok: boolean; error?: string }>): Promise<boolean> {
  const r = await p;
  if (!r.ok && r.error) toast(r.error, 'error', 2200);
  return r.ok;
}
const answer = (i: number) => {
  vibrate(25);
  return act(sendAnswer(i));
};
const buzz = () => {
  vibrate(60);
  return act(sendBuzz());
};
const target = (id: string) => {
  vibrate(30);
  return act(sendTarget(id));
};

function Header({ st, children }: { st: PublicState; children?: React.ReactNode }) {
  const me = st.players.find((p) => p.id === st.you.playerId);
  if (!me) return null;
  return (
    <div className="m-header">
      <div className="who">
        <Avatar characterId={me.characterId} variant={me.variant} size={36} />
        <b>{me.name}</b>
      </div>
      {children}
      <div className="view-toggle" role="group" aria-label="Visning">
        <button className={me.view === 'controller' ? 'on' : ''} onClick={() => setView('controller')}>
          🎮
        </button>
        <button className={me.view === 'full' ? 'on' : ''} onClick={() => setView('full')}>
          📱
        </button>
      </div>
      <span className="m-score" aria-label="Poeng">
        {st.round?.type === 'final' && st.final ? `${me.finalSteps}/${st.final.goal}` : <AnimatedNumber value={me.score} />}
      </span>
    </div>
  );
}

function verb(kind?: string) {
  return kind === 'steal' ? '🦝 Hvem vil du stjele poeng fra?' : kind === 'pie' ? '🥧 Hvem skal få kaken?' : '💣 Hvem skal få bomben?';
}

/** Felles «hva skal jeg gjøre nå»-logikk for begge mobilvisningene. */
function ActionArea({ st, pads }: { st: PublicState; pads: boolean }) {
  const you = st.you;
  const type = st.round?.type;
  const name = (id?: string | null) => st.players.find((p) => p.id === id)?.name ?? '?';
  const me = st.players.find((p) => p.id === you.playerId);

  switch (st.phase) {
    case 'INTRO':
      return <div className="m-status"><span className="big">🎬</span>Showet starter! {pads && 'Følg med på TV-en.'}</div>;
    case 'ROUND_INTRO':
      return pads ? (
        <div className="m-status">
          <span className="big">{st.round?.index != null ? st.round.index + 1 : ''}</span>
          {st.round && ROUND_INFO[st.round.type].name}
          <div className="muted small" style={{ marginTop: 8 }}>{st.round && ROUND_INFO[st.round.type].description}</div>
        </div>
      ) : (
        <RoundIntro st={st} />
      );
    case 'QUESTION':
    case 'BUZZ_ANSWER': {
      if (type === 'fastest' && st.phase === 'QUESTION') return <Buzzer state={st} onBuzz={buzz} />;
      if (you.canAnswer) return <AnswerButtons state={st} onAnswer={answer} mode={pads ? 'pads' : 'text'} />;
      if (you.choice != null) {
        const c = ANSWER_COLORS[you.choice];
        return (
          <div className="locked">
            Svaret ditt er låst!
            <div className="swatch" style={{ background: c.hex }}>{LETTERS[you.choice]}</div>
            <span className="muted small">Venter på de andre …</span>
            {!pads && <AnswerButtons state={st} interactive={false} />}
          </div>
        );
      }
      if (type === 'bomb') return <div className="m-status"><span className="big">💣</span>{name(st.bomb?.holderId)} har bomben – hold pusten!{!pads && <AnswerButtons state={st} interactive={false} />}</div>;
      if (st.phase === 'BUZZ_ANSWER') return <div className="m-status"><span className="big">🔴</span>{name(st.buzz?.activePlayerId)} svarer …{!pads && <AnswerButtons state={st} interactive={false} />}</div>;
      if (st.final?.tiebreak && !st.final.tiebreak.includes(you.playerId ?? '')) return <div className="m-status">⚡ Sudden death – bare de som står likt svarer nå.</div>;
      return <div className="m-status">Følg med!</div>;
    }
    case 'REVEAL':
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <RevealSummary state={st} compact={pads} />
          {!pads && <AnswerButtons state={st} interactive={false} />}
        </div>
      );
    case 'TARGETING':
      if (you.canTarget) return <TargetPicker state={st} onPick={target} verb={verb(st.targeting?.kind)} />;
      if (you.chosenTarget) return <div className="m-status">Mål valgt: {name(you.chosenTarget)} 😈</div>;
      return <div className="m-status">{st.targeting?.eligible.map(name).join(', ')} velger offer … 😬</div>;
    case 'ACTION_RESULT':
      return <ActionSummary st={st} />;
    case 'SCOREBOARD': {
      const rank = st.ranking.indexOf(you.playerId ?? '') + 1;
      return pads ? (
        <div className="m-status">
          <span className="big">#{rank}</span>
          Du ligger på {rank}. plass med {me?.score} poeng
        </div>
      ) : (
        <Scoreboard state={st} />
      );
    }
    case 'CEREMONY':
    case 'GAME_OVER': {
      const rank = st.ranking.indexOf(you.playerId ?? '') + 1;
      return pads ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="m-status">
            <span className="big">{rank === 1 ? '🏆' : rank <= 3 ? '🥈' : '👏'}</span>
            {rank === 1 ? 'DU VANT!' : `Du ble nummer ${rank}`}
          </div>
          <CeremonyPanel st={st} showActions={st.phase === 'GAME_OVER'} />
        </div>
      ) : (
        <CeremonyPanel st={st} showActions={st.phase === 'GAME_OVER'} />
      );
    }
    default:
      return null;
  }
}

/** Ren kontroller: store knapper, minimal tekst – blikket kan være på TV-en. */
export function ControllerView({ st }: { st: PublicState }) {
  return (
    <div className="controller">
      <Header st={st} />
      <div style={{ padding: '8px 14px 0' }}>{st.deadline && (st.phase === 'QUESTION' || st.phase === 'BUZZ_ANSWER' || st.phase === 'TARGETING') && <TimerBar state={st} showNumber={false} />}</div>
      {st.round?.type === 'bomb' && st.phase !== 'ROUND_INTRO' && (
        <div style={{ padding: '8px 14px' }}>
          <BombMeter state={st} />
        </div>
      )}
      <div className="controller-body">
        <ActionArea st={st} pads />
      </div>
      {st.paused && <div className="paused-banner">⏸ PAUSE</div>}
      {st.you.isHost && (
        <div className="host-bar">
          <HostButtons st={st} compact />
        </div>
      )}
    </div>
  );
}

/** Hele spillet på mobilen: kompakt studio øverst, spørsmål i midten, knapper nederst. */
export function FullMobileView({ st }: { st: PublicState }) {
  const answering = (st.phase === 'QUESTION' || st.phase === 'BUZZ_ANSWER' || st.phase === 'TARGETING') && !!st.question;
  const showcase = st.phase === 'ACTION_RESULT' || st.phase === 'INTRO';
  const [ceremony3d, setCeremony3d] = useState(false);
  useEffect(() => {
    if (st.phase !== 'CEREMONY') return setCeremony3d(false);
    setCeremony3d(true);
    const t = setTimeout(() => setCeremony3d(false), 5000);
    return () => clearTimeout(t);
  }, [st.phase]);
  const stageClass = ceremony3d ? 'full' : answering ? '' : showcase || st.phase === 'REVEAL' ? 'tall' : '';
  return (
    <div className="mobile">
      <Header st={st} />
      <div className={`m-stage ${stageClass}`}>
        <Studio variant="mobile" />
        {st.round && (
          <div className="stage-label round-badge" style={{ fontSize: '.8rem', padding: '4px 10px' }}>
            <small>
              Runde {st.round.index + 1}/{st.round.total}
            </small>
            {st.round.name}
          </div>
        )}
      </div>
      {!ceremony3d && (
        <div className="m-body">
          {st.deadline && answering && <TimerBar state={st} />}
          {st.round?.type === 'bomb' && st.phase !== 'ROUND_INTRO' && st.phase !== 'SCOREBOARD' && <BombMeter state={st} />}
          {st.round?.type === 'final' && st.final && (st.phase === 'QUESTION' || st.phase === 'REVEAL') && (
            <details>
              <summary className="muted small" style={{ fontWeight: 800 }}>
                {st.final.tiebreak ? '⚡ Sudden death!' : `🏁 Finaleløpet – først til ${st.final.goal}`}
              </summary>
              <FinalTrack state={st} />
            </details>
          )}
          {st.question && answering && <div className="m-question">{st.question.text}</div>}
          {st.question && st.phase === 'REVEAL' && <div className="m-question" style={{ fontSize: '1rem', opacity: 0.85 }}>{st.question.text}</div>}
          <ActionArea st={st} pads={false} />
        </div>
      )}
      {st.commentary && st.phase !== 'LOBBY' && !answering && (
        <div className="m-commentary">
          <CommentaryBubble c={st.commentary} />
        </div>
      )}
      {st.paused && <div className="paused-banner">⏸ PAUSE</div>}
      {st.you.isHost && (
        <div className="host-bar" style={{ bottom: 'calc(70px + var(--safe-b))' }}>
          <HostButtons st={st} compact />
        </div>
      )}
    </div>
  );
}
