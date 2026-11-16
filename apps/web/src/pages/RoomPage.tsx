import { useEffect, useState } from 'react';
import { CHARACTERS } from '@podiepanikk/shared';
import { useGameAudio } from '../audio/useGameAudio';
import { toast } from '../components/Toasts';
import { getMembership, joinRoom, useRoom } from '../net/room';
import { api } from '../net/api';
import { Link, navigate, useQuery } from '../router';
import { useSettings } from '../settings';
import { CharacterPicker } from '../room/CharacterPicker';
import { PlayerLobby } from '../room/Lobby';
import { ControllerView, FullMobileView } from '../room/PlayerViews';
import { ScreenView } from '../room/ScreenView';

export default function RoomPage({ code }: { code: string }) {
  const query = useQuery();
  const st = useRoom((s) => s.state);
  const status = useRoom((s) => s.status);
  const kicked = useRoom((s) => s.kicked);
  const [needsForm, setNeedsForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowBots, setAllowBots] = useState(true);

  useEffect(() => {
    api<{ allowBots: boolean }>('/api/meta').then((m) => setAllowBots(m.allowBots), () => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const m = getMembership(code);
    if (m) {
      joinRoom(code, { as: m.as }).then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.error ?? 'Kunne ikke koble til');
          setNeedsForm(true);
        }
      });
    } else if (query.get('tv') === '1') {
      joinRoom(code, { as: 'screen' }).then((r) => !cancelled && !r.ok && setError(r.error ?? 'Kunne ikke koble til'));
    } else setNeedsForm(true);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (kicked) {
    return (
      <div className="center-screen">
        <div className="panel" style={{ textAlign: 'center' }}>
          <h2>Du ble fjernet fra rommet</h2>
          <Link className="btn" to="/">
            Til forsiden
          </Link>
        </div>
      </div>
    );
  }

  if (needsForm && (!st || st.code !== code)) return <JoinForm code={code} error={error} onJoined={() => setNeedsForm(false)} />;
  if (!st || st.code !== code) {
    return (
      <div className="center-screen">
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          {error ? (
            <>
              <p>{error}</p>
              <Link className="btn" to="/">
                Til forsiden
              </Link>
            </>
          ) : (
            <p className="muted">Kobler til rom {code} …</p>
          )}
        </div>
      </div>
    );
  }
  return <RoomInner allowBots={allowBots} offline={status !== 'online'} />;
}

function RoomInner({ allowBots, offline }: { allowBots: boolean; offline: boolean }) {
  const st = useRoom((s) => s.state)!;
  const me = st.players.find((p) => p.id === st.you.playerId);
  const role = st.you.isScreen || me?.view === 'full' ? 'main' : 'controller';
  useGameAudio(role);
  // Hindre at skjermen slukker midt i et spill (der det støttes).
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l), () => undefined);
    return () => void lock?.release();
  }, []);

  let view: JSX.Element;
  if (st.you.isScreen) view = <ScreenView st={st} allowBots={allowBots} />;
  else if (!me) {
    view = (
      <div className="center-screen">
        <div className="panel">
          Du er ikke lenger med i dette spillet. <Link to="/">Til forsiden</Link>
        </div>
      </div>
    );
  } else if (st.phase === 'LOBBY') view = <PlayerLobby st={st} />;
  else if (me.view === 'full') view = <FullMobileView st={st} />;
  else view = <ControllerView st={st} />;
  return (
    <>
      {offline && <div className="conn-banner">📡 Kobler til igjen …</div>}
      {view}
    </>
  );
}

function JoinForm({ code, error, onJoined }: { code: string; error: string | null; onJoined: () => void }) {
  const s = useSettings();
  const [name, setName] = useState(s.lastName);
  const [char, setChar] = useState(s.lastCharacter || CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return toast('Skriv inn navnet ditt', 'error');
    setBusy(true);
    s.set({ lastName: name.trim(), lastCharacter: char });
    const r = await joinRoom(code, { as: 'player', name: name.trim(), characterId: char });
    setBusy(false);
    if (!r.ok) return toast(r.error ?? 'Kunne ikke bli med', 'error');
    onJoined();
  };
  return (
    <div className="page page-narrow">
      <div className="topbar">
        <Link className="back" to="/">
          ← Tilbake
        </Link>
        <span className="muted">
          Rom <b style={{ color: 'var(--gold)', letterSpacing: '.15em' }}>{code}</b>
        </span>
      </div>
      <h1>Bli med i showet!</h1>
      {error && <p className="muted">{error}</p>}
      <div className="panel">
        <div className="field">
          <label htmlFor="name">Navnet ditt (vises for de andre)</label>
          <input id="name" className="input" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Quiz-Kari" autoComplete="nickname" />
          <span className="muted small">Bruk gjerne et kallenavn – ikke fullt navn.</span>
        </div>
        <CharacterPicker value={char} onChange={setChar} />
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <button className="btn big block" disabled={busy} onClick={submit}>
          {busy ? 'Kobler til …' : '🎤 Inn på scenen!'}
        </button>
        <button className="btn ghost block" onClick={() => {
            navigate(`/rom/${code}?tv=1`, true);
            location.reload();
          }}
        >
          📺 Bruk denne skjermen som storskjerm i stedet
        </button>
      </div>
    </div>
  );
}
