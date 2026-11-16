import { useEffect, useState } from 'react';
import type { PublicState } from '@podiepanikk/shared';
import { AnswerButtons, BombMeter, CommentaryBubble, FinalTrack, TimerBar } from '../components/GameBits';
import { leaveRoom } from '../net/room';
import { navigate } from '../router';
import { Studio } from '../three/Studio';
import { HostLobbyControls, PlayerList } from './Lobby';
import { ActionSummary, CeremonyPanel, HostButtons, QrCode, RoundIntro, ScoreOverlay, SettingsSummary, Warnings, useInviteUrl } from './Shared';

/** Storskjermen (TV/PC/prosjektor): 3D-studio med alle overlegg. */
export function ScreenView({ st, allowBots }: { st: PublicState; allowBots: boolean }) {
  const [showCeremony, setShowCeremony] = useState(false);
  const invite = useInviteUrl(st.code);
  useEffect(() => {
    if (st.phase === 'CEREMONY') {
      setShowCeremony(false);
      const t = setTimeout(() => setShowCeremony(true), 5000); // la 3D-feiringen få skinne først
      return () => clearTimeout(t);
    }
    setShowCeremony(st.phase === 'GAME_OVER');
  }, [st.phase]);

  const inQuestion = ['QUESTION', 'BUZZ_ANSWER', 'REVEAL', 'TARGETING'].includes(st.phase) && st.question;
  const active = st.players.find((p) => p.id === st.buzz?.activePlayerId);
  const targetingNames = st.targeting ? st.targeting.eligible.map((id) => st.players.find((p) => p.id === id)?.name).join(', ') : '';

  return (
    <div className="room">
      <div className="room-canvas">
        <Studio variant="tv" />
      </div>

      {st.phase === 'LOBBY' && (
        <div className="lobby-tv">
          <div className="panel join-box">
            <h2 style={{ margin: 0 }}>Bli med!</h2>
            <QrCode code={st.code} />
            <div className="muted small">Skann koden, eller gå til</div>
            <b style={{ wordBreak: 'break-all' }}>{invite.replace(/^https?:\/\//, '')}</b>
            <div className="muted small">og skriv inn</div>
            <div className="room-code">{st.code}</div>
          </div>
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <h1 className="logo" style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)' }}>
              PODIEPANIKK!
            </h1>
            <SettingsSummary st={st} />
            <Warnings st={st} />
            <div className="panel">
              <b>
                Spillere ({st.players.length}/{st.settings.maxPlayers})
              </b>
              <div style={{ marginTop: 10 }}>
                <PlayerList st={st} canKick={st.you.isHost} />
              </div>
            </div>
            {st.you.isHost && <HostLobbyControls st={st} allowBots={allowBots} />}
          </div>
        </div>
      )}

      {st.phase !== 'LOBBY' && (
        <div className="tv-top">
          {st.round && (
            <div className="round-badge">
              <small>
                Runde {st.round.index + 1}/{st.round.total}
              </small>
              {st.round.name}
            </div>
          )}
          <div style={{ flex: 1 }} />
        </div>
      )}
      {st.phase !== 'LOBBY' && st.commentary && (
        <div className="tv-commentary">
          <CommentaryBubble c={st.commentary} />
        </div>
      )}

      <div className="tv-host-bar">
        <HostButtons st={st} />
        <button className="btn ghost small" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())} aria-label="Fullskjerm">
          ⛶
        </button>
        <button
          className="btn ghost small"
          onClick={() => {
            if (confirm('Vil du forlate rommet på denne skjermen?')) {
              leaveRoom();
              navigate('/');
            }
          }}
        >
          ✕
        </button>
      </div>

      {st.phase === 'INTRO' && (
        <div className="overlay" style={{ background: 'transparent' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 className="logo">PODIEPANIKK!</h1>
            <p className="tagline" style={{ fontSize: '1.6rem' }}>
              {st.players.length} deltakere · {st.settings.length === 'kort' ? 'kort' : st.settings.length === 'lang' ? 'langt' : 'normalt'} show
            </p>
          </div>
        </div>
      )}
      {st.phase === 'ROUND_INTRO' && (
        <div className="overlay">
          <RoundIntro st={st} />
        </div>
      )}
      {st.phase === 'SCOREBOARD' && (
        <div className="overlay">
          <ScoreOverlay st={st} />
        </div>
      )}
      {(st.phase === 'CEREMONY' || st.phase === 'GAME_OVER') && showCeremony && (
        <div className="overlay">
          <CeremonyPanel st={st} showActions />
        </div>
      )}
      {st.paused && <div className="paused-banner">⏸ PAUSE</div>}

      {st.round?.type === 'final' && st.final && st.phase !== 'ROUND_INTRO' && st.phase !== 'CEREMONY' && st.phase !== 'GAME_OVER' && (
        <div style={{ position: 'absolute', right: 24, top: 90, width: 'min(520px, 40vw)', zIndex: 6 }} className="panel">
          <b>{st.final.tiebreak ? '⚡ SUDDEN DEATH – første riktige vinner!' : `Først til ${st.final.goal} steg vinner!`}</b>
          <div style={{ marginTop: 8 }}>
            <FinalTrack state={st} />
          </div>
        </div>
      )}

      {(inQuestion || st.phase === 'ACTION_RESULT') && (
        <div className="tv-bottom">
          <div className="tv-question">
            {st.round?.type === 'bomb' && (
              <div className="panel" style={{ marginBottom: 10, padding: 10 }}>
                <BombMeter state={st} />
              </div>
            )}
            {st.phase === 'ACTION_RESULT' ? (
              <div className="panel">
                <ActionSummary st={st} />
              </div>
            ) : (
              st.question && (
                <>
                  <div className="q-meta">
                    <span>
                      {st.question.total ? `Spørsmål ${st.question.number} av ${st.question.total}` : `Spørsmål ${st.question.number}`}
                      {st.question.language === 'en' && ' · 🇬🇧 engelsk'}
                    </span>
                    <span>{st.question.source}</span>
                  </div>
                  <div className="q-text">{st.question.text}</div>
                  {st.phase !== 'REVEAL' && st.phase !== 'TARGETING' && (
                    <div style={{ marginBottom: 10 }}>
                      <TimerBar state={st} />
                    </div>
                  )}
                  {st.phase === 'BUZZ_ANSWER' && active && <div className="m-status">🔴 {active.name} trykket først – og må svare!</div>}
                  {st.phase === 'TARGETING' && (
                    <div className="m-status">
                      {st.targeting?.kind === 'steal' ? '🦝' : st.targeting?.kind === 'pie' ? '🥧' : '💣'} {targetingNames} velger offer på mobilen …
                    </div>
                  )}
                  <AnswerButtons state={st} interactive={false} />
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
