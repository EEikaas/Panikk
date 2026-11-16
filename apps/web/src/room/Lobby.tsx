import { useEffect, useState } from 'react';
import { MIN_PLAYERS, type PublicState } from '@podiepanikk/shared';
import { Avatar } from '../components/Avatar';
import { toast } from '../components/Toasts';
import { host, leaveRoom, setView, updatePlayer } from '../net/room';
import { navigate } from '../router';
import { useSettings } from '../settings';
import { CharacterPicker } from './CharacterPicker';
import { QrCode, SettingsSummary, Warnings, shareInvite } from './Shared';

const err = (r: { ok: boolean; error?: string }) => {
  if (!r.ok) toast(r.error ?? 'Noe gikk galt', 'error');
  return r.ok;
};

export function PlayerList({ st, canKick }: { st: PublicState; canKick: boolean }) {
  return (
    <div className="player-grid">
      {st.players.map((p) => (
        <div key={p.id} className={`player-card ${p.ready ? 'ready' : ''} ${!p.connected ? 'off' : ''}`}>
          {canKick && p.id !== st.you.playerId && (
            <button className="kick" aria-label={`Fjern ${p.name}`} onClick={() => host.kick(p.id).then(err)}>
              ✕
            </button>
          )}
          <Avatar characterId={p.characterId} variant={p.variant} size={64} />
          <span>{p.name}</span>
          <span className="tag">
            {p.isBot ? '🤖 testspiller' : !p.connected ? 'frakoblet' : p.ready ? '✅ klar' : 'velger …'} · {p.view === 'full' ? '📱 full' : '🎮 kontroller'}
          </span>
        </div>
      ))}
      {st.players.length === 0 && <p className="muted">Venter på spillere … Skann QR-koden eller skriv inn romkoden!</p>}
    </div>
  );
}

export function HostLobbyControls({ st, allowBots = true }: { st: PublicState; allowBots?: boolean }) {
  const ready = st.players.filter((p) => p.ready && p.connected).length;
  const canStart = ready >= MIN_PLAYERS;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <button className="btn big" disabled={!canStart} onClick={() => host.start().then(err)}>
        🎬 Start showet!
      </button>
      {allowBots && st.players.length < st.settings.maxPlayers && (
        <button className="btn ghost small" onClick={() => host.addBot().then(err)} title="Legger til en datastyrt testspiller">
          🤖 + Testspiller
        </button>
      )}
      <span className="muted small">{canStart ? `${ready} klare` : `Minst ${MIN_PLAYERS} spillere må være klare (${ready} nå)`}</span>
    </div>
  );
}

/** Lobbyen slik spilleren ser den på mobilen. */
export function PlayerLobby({ st }: { st: PublicState }) {
  const me = st.players.find((p) => p.id === st.you.playerId);
  const setSettings = useSettings((s) => s.set);
  const [name, setName] = useState(me?.name ?? '');
  useEffect(() => setName(me?.name ?? ''), [me?.name]);
  if (!me) return null;
  const taken = st.players.filter((p) => p.id !== me.id).map((p) => p.characterId);
  const saveName = () => {
    const n = name.trim();
    if (n && n !== me.name) {
      void updatePlayer({ name: n }).then(err);
      setSettings({ lastName: n });
    }
  };
  return (
    <div className="page page-narrow" style={{ display: 'grid', gap: 14 }}>
      <div className="topbar">
        <button
          className="back btn ghost small"
          onClick={() => {
            leaveRoom();
            navigate('/');
          }}
        >
          ← Forlat
        </button>
        <div style={{ textAlign: 'right' }}>
          <div className="muted small">Romkode</div>
          <div style={{ fontWeight: 900, fontSize: '1.6rem', letterSpacing: '.15em', color: 'var(--gold)' }}>{st.code}</div>
        </div>
      </div>

      {st.settings.displayMode !== 'screen' && !st.settings.solo && (
        <div className="panel" style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          <b>Inviter venner</b>
          <div className="join-box" style={{ width: 200 }}>
            <QrCode code={st.code} size={180} />
          </div>
          <button className="btn cyan small" onClick={() => shareInvite(st.code)}>
            📤 Del invitasjon
          </button>
        </div>
      )}

      <div className="panel">
        <div className="field">
          <label htmlFor="nm">Ditt navn</label>
          <input id="nm" className="input" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && saveName()} autoComplete="nickname" />
        </div>
        <CharacterPicker
          value={me.characterId}
          variant={me.variant}
          taken={taken}
          onChange={(id) => {
            setSettings({ lastCharacter: id });
            void updatePlayer({ characterId: id }).then(err);
          }}
        />
      </div>

      <div className="panel" style={{ display: 'grid', gap: 8 }}>
        <b>Hvordan vil du spille?</b>
        <div className="grid2">
          <button className={`option-card ${me.view === 'controller' ? 'on' : ''}`} onClick={() => setView('controller')}>
            <b>🎮 Mobil som kontroller</b>
            <span>Du ser spørsmålene på TV-en. Mobilen har buzzer og svarknapper.</span>
          </button>
          <button className={`option-card ${me.view === 'full' ? 'on' : ''}`} onClick={() => setView('full')}>
            <b>📱 Hele spillet på mobilen</b>
            <span>Studio, spørsmål og knapper – alt på din skjerm. Perfekt hjemmefra.</span>
          </button>
        </div>
        <span className="muted small">Du kan bytte når som helst under spillet uten å miste noe.</span>
      </div>

      <button className={`btn big block ${me.ready ? 'cyan' : ''}`} onClick={() => updatePlayer({ ready: !me.ready }).then(err)}>
        {me.ready ? '✅ Klar! (trykk for å angre)' : '👍 Jeg er klar!'}
      </button>

      <Warnings st={st} />
      <div className="panel">
        <b>Spillere ({st.players.length}/{st.settings.maxPlayers})</b>
        <div style={{ marginTop: 10 }}>
          <PlayerList st={st} canKick={st.you.isHost} />
        </div>
      </div>
      <SettingsSummary st={st} />
      {st.you.isHost ? <HostLobbyControls st={st} /> : <p className="muted">Venter på at verten starter showet …</p>}
    </div>
  );
}
