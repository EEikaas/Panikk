import { useEffect, useRef } from 'react';
import { useRoom } from '../net/room';
import { useSettings, vibrate } from '../settings';
import { crowd, playMusic, setTempoBoost, sfx, type Track } from './sound';

/**
 * Kobler spillstatus og effekthendelser til musikk, lyd og vibrasjon.
 * role 'main' = TV/full mobil (hele lydbildet). 'controller' = kun egne lyder + vibrasjon.
 */
export function useGameAudio(role: 'main' | 'controller'): void {
  const state = useRoom((s) => s.state);
  const fxBatch = useRoom((s) => s.fxBatch);
  const controllerSound = useSettings((s) => s.controllerSound);
  const full = role === 'main' || controllerSound;
  const lastRevealKey = useRef('');

  // Musikk etter fase
  const phase = state?.phase;
  const roundType = state?.round?.type;
  const paused = state?.paused;
  useEffect(() => {
    if (!full) return playMusic('none');
    let track: Track = 'game';
    if (!phase || phase === 'LOBBY') track = 'lobby';
    else if (paused) track = 'lobby';
    else if (phase === 'INTRO') track = 'intro';
    else if (phase === 'CEREMONY' || phase === 'GAME_OVER') track = 'victory';
    else if (roundType === 'final') track = 'final';
    else if (roundType === 'bomb' || phase === 'BUZZ_ANSWER') track = 'tension';
    playMusic(track);
  }, [phase, roundType, paused, full]);
  useEffect(() => () => playMusic('none'), []);

  // Finalen: tempoet øker etter hvert
  const finalNo = state?.final?.questionNo ?? 0;
  useEffect(() => {
    setTempoBoost(roundType === 'final' ? 1 + Math.min(0.35, finalNo * 0.025) : 1);
  }, [roundType, finalNo]);

  // Bombe-tikking som går fortere jo nærmere smellet
  const bombActive = !!state?.bomb && !state.bomb.exploded && (phase === 'QUESTION' || phase === 'TARGETING');
  useEffect(() => {
    if (!bombActive || !full) return;
    let alive = true;
    let timer: number;
    const loop = () => {
      if (!alive) return;
      const intensity = useRoom.getState().state?.bomb?.intensity ?? 0;
      sfx('bombTick');
      timer = window.setTimeout(loop, 650 - intensity * 520);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [bombActive, full]);

  // Hendelser
  useEffect(() => {
    const st = useRoom.getState().state;
    if (!st || fxBatch.events.length === 0) return;
    const me = st.you.playerId;
    let correctN = 0;
    let wrongN = 0;
    for (const f of fxBatch.events) {
      const mine = !!me && f.playerId === me;
      const targeted = !!me && f.targetId === me;
      switch (f.type) {
        case 'join':
          if (full && st.phase === 'LOBBY') sfx('join');
          break;
        case 'roundStart':
          if (full) {
            sfx('jingle');
            setTimeout(() => crowd('applause', 0.8), 500);
          }
          break;
        case 'buzz':
          if (full || mine) sfx('buzz');
          if (mine) vibrate([60, 40, 120]);
          break;
        case 'answerLocked':
          if (mine) {
            sfx('lock');
            vibrate(30);
          }
          break;
        case 'correct':
          correctN++;
          if (mine) vibrate([40, 30, 40]);
          break;
        case 'wrong':
          wrongN++;
          if (mine) vibrate(250);
          break;
        case 'timeout':
          if (mine && !full) sfx('timeout');
          break;
        case 'steal':
          if (full || mine || targeted) sfx('steal');
          if (full) crowd('ooh');
          if (targeted) vibrate([100, 50, 100]);
          break;
        case 'pie':
          if (full || mine || targeted) {
            sfx('whoosh');
            setTimeout(() => sfx('splat'), 900);
          }
          if (full) setTimeout(() => crowd('laugh'), 1000);
          if (targeted) setTimeout(() => vibrate([200, 60, 200]), 900);
          break;
        case 'bombPass':
          if (full) sfx('whooshUp');
          if (targeted) vibrate([80, 40, 80, 40, 80]);
          break;
        case 'explode':
          if (full || mine) sfx('explode');
          if (full) setTimeout(() => crowd('laugh', 1), 600);
          if (mine) vibrate([400, 100, 400]);
          break;
        case 'finalStep':
          if (mine && (f.amount ?? 0) > 0) sfx('step');
          break;
        case 'tiebreak':
          if (full) {
            sfx('drumroll');
            crowd('ooh');
          }
          break;
        case 'winner':
          if (full) {
            sfx('drumroll');
            setTimeout(() => {
              sfx('fanfare');
              crowd('cheer');
            }, 1700);
          }
          if (mine) vibrate([100, 50, 100, 50, 300]);
          break;
      }
    }
    // Én samlet reaksjon per avsløring (ikke 12 lyder samtidig).
    const revealKey = `${st.phaseStartedAt}`;
    if ((correctN || wrongN) && revealKey !== lastRevealKey.current) {
      lastRevealKey.current = revealKey;
      const myResult = st.reveal?.results.find((r) => r.playerId === me);
      if (!full) {
        if (myResult) sfx(myResult.correct ? 'correct' : 'wrong');
      } else {
        if (myResult) sfx(myResult.correct ? 'correct' : 'wrong');
        else sfx(correctN >= wrongN ? 'correct' : 'wrong');
        if (correctN && !wrongN) crowd('applause', 1);
        else if (!correctN && wrongN) crowd(Math.random() < 0.5 ? 'aww' : 'laugh', 0.8);
        else if (correctN) crowd('applause', 0.6);
      }
    }
  }, [fxBatch, full]);
}
