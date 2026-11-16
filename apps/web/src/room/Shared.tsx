import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { CATEGORIES, DIFFICULTIES, DISPLAY_MODES, LENGTHS, ROUND_INFO, isAdultGame, type PublicState } from '@podiepanikk/shared';
import { Avatar } from '../components/Avatar';
import { Scoreboard } from '../components/GameBits';
import { toast } from '../components/Toasts';
import { create } from 'zustand';
import { api } from '../net/api';
import { host } from '../net/room';

/*
 * Invitasjonsadressen. Åpnes storskjermen som «localhost», ville QR-koden pekt på mobilen selv.
 * Da henter vi PC-ens nettverksadresse fra serveren i stedet (f.eks. http://192.168.1.20:3001).
 */
const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const useInviteBase = create<{ base: string }>(() => ({ base: location.origin }));
let lanLookupStarted = false;
function ensureLanBase(): void {
  if (lanLookupStarted || !isLocalHost()) return;
  lanLookupStarted = true;
  api<{ lanUrls?: string[] }>('/api/meta').then(
    (m) => m.lanUrls?.[0] && useInviteBase.setState({ base: m.lanUrls[0] }),
    () => undefined,
  );
}

export const inviteUrl = (code: string) => `${useInviteBase.getState().base}/r/${code}`;

/** Gir invitasjonslenken og oppdaterer komponenten når nettverksadressen er funnet. */
export function useInviteUrl(code: string): string {
  const base = useInviteBase((s) => s.base);
  useEffect(ensureLanBase, []);
  return `${base}/r/${code}`;
}

export function QrCode({ code, size = 260 }: { code: string; size?: number }) {
  const [src, setSrc] = useState('');
  const url = useInviteUrl(code);
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: '#14062b', light: '#ffffff' } }).then(setSrc, () => setSrc(''));
  }, [url, size]);
  return <div className="qr">{src ? <img src={src} alt={`QR-kode for å bli med i rom ${code}`} /> : <div style={{ height: size }} />}</div>;
}

export async function shareInvite(code: string) {
  const url = inviteUrl(code);
  try {
    if (navigator.share) await navigator.share({ title: 'PODIEPANIKK!', text: `Bli med i gameshowet! Romkode ${code}`, url });
    else {
      await navigator.clipboard.writeText(url);
      toast('Lenken er kopiert!', 'success');
    }
  } catch {
    /* avbrutt */
  }
}

export function SettingsSummary({ st }: { st: PublicState }) {
  const s = st.settings;
  const cats = s.categories.length ? s.categories.map((c) => CATEGORIES.find((x) => x.id === c)?.name).join(', ') : 'Alle kategorier';
  return (
    <div className="settings-summary">
      {isAdultGame(s) && <span style={{ background: 'var(--red)', color: '#fff' }}>🔞 Kun for voksne (18+)</span>}
      <span>{DISPLAY_MODES.find((d) => d.id === s.displayMode)?.name}</span>
      <span>{DIFFICULTIES.find((d) => d.id === s.difficulty)?.name}</span>
      <span>{LENGTHS.find((d) => d.id === s.length)?.name} spill</span>
      <span>Maks {s.maxPlayers} spillere</span>
      <span>{cats}</span>
      {s.useExternal && <span>+ engelske spørsmål (Open Trivia DB)</span>}
    </div>
  );
}

export function RoundIntro({ st }: { st: PublicState }) {
  if (!st.round) return null;
  const info = ROUND_INFO[st.round.type];
  return (
    <div className="round-intro">
      <div className="num">
        Runde {st.round.index + 1} av {st.round.total}
        {st.round.type === 'final' ? ' · FINALE' : ''}
      </div>
      <h1>{info.name}</h1>
      <p>{info.description}</p>
    </div>
  );
}

export function ActionSummary({ st }: { st: PublicState }) {
  const name = (id: string | null) => st.players.find((p) => p.id === id)?.name ?? '?';
  if (!st.actions.length) return <div className="m-status">Ingen ble rammet denne gangen.</div>;
  return (
    <div style={{ display: 'grid', gap: 6, textAlign: 'center', fontWeight: 900, fontSize: '1.2rem' }}>
      {st.actions.map((a, i) => (
        <div key={i}>
          {a.kind === 'steal' && `🦝 ${name(a.fromId)} stjal ${a.amount} poeng fra ${name(a.toId)}!`}
          {a.kind === 'pie' && `🥧 ${name(a.fromId)} traff ${name(a.toId)}${a.amount ? ` (−${a.amount})` : ''}!`}
          {a.kind === 'bombPass' && `💣 Bomben går til ${name(a.toId)}!`}
          {a.kind === 'explode' && `💥 KABOOM! ${name(a.toId)} mister ${a.amount} poeng!`}
        </div>
      ))}
    </div>
  );
}

export function CeremonyPanel({ st, showActions }: { st: PublicState; showActions: boolean }) {
  const ranked = st.ranking.map((id) => st.players.find((p) => p.id === id)!).filter(Boolean);
  const [w, s2, s3] = ranked;
  const stat = (id: string) => st.stats?.find((s) => s.playerId === id);
  return (
    <div className="ceremony">
      <h1 style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', color: 'var(--gold)' }}>🏆 {w?.name} vinner! 🏆</h1>
      <div className="podium3">
        {[s2, w, s3].map((p, i) =>
          p ? (
            <div key={p.id} className={`p p${[2, 1, 3][i]}`}>
              <Avatar characterId={p.characterId} variant={p.variant} size={[64, 88, 56][i]} />
              <span>{p.name}</span>
              <div className="block">{[2, 1, 3][i]}</div>
            </div>
          ) : null,
        )}
      </div>
      <div className="panel" style={{ textAlign: 'left', overflowX: 'auto' }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Spiller</th>
              <th>Poeng</th>
              <th>Riktige</th>
              <th>Svarprosent</th>
              <th>Snittid</th>
              <th>Lengste rekke</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => {
              const s = stat(p.id);
              return (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td>{p.name}</td>
                  <td>{p.score}</td>
                  <td>{s?.correct ?? 0}</td>
                  <td>{s && s.answered ? `${Math.round((s.correct / s.answered) * 100)} %` : '–'}</td>
                  <td>{s?.avgMs != null ? `${(s.avgMs / 1000).toFixed(1)} s` : '–'}</td>
                  <td>{s?.bestStreak ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showActions && st.you.isHost && (st.phase === 'GAME_OVER' || st.phase === 'CEREMONY') && (
        <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn big" onClick={() => host.rematch().then((r) => !r.ok && toast(r.error ?? 'Feil', 'error'))}>
            🔁 Omkamp!
          </button>
        </div>
      )}
      {showActions && !st.you.isHost && <p className="muted">Verten kan starte en omkamp.</p>}
    </div>
  );
}

export function ScoreOverlay({ st }: { st: PublicState }) {
  return (
    <div style={{ display: 'grid', gap: 12, justifyItems: 'center', width: '100%' }}>
      <h2 style={{ fontSize: 'clamp(1.6rem, 5vw, 3rem)' }}>Stillingen etter runde {(st.round?.index ?? 0) + 1}</h2>
      <Scoreboard state={st} />
    </div>
  );
}

export function HostButtons({ st, compact = false }: { st: PublicState; compact?: boolean }) {
  if (!st.you.isHost || st.phase === 'LOBBY') return null;
  const canSkip = ['INTRO', 'ROUND_INTRO', 'REVEAL', 'ACTION_RESULT', 'SCOREBOARD', 'CEREMONY'].includes(st.phase) && !st.paused;
  const err = (r: { ok: boolean; error?: string }) => !r.ok && toast(r.error ?? 'Feil', 'error');
  return (
    <>
      {st.phase !== 'GAME_OVER' && (
        <button className="btn ghost small" onClick={() => host.pause(!(st.paused || st.pausePending)).then(err)} aria-label="Pause">
          {st.paused ? '▶ Fortsett' : st.pausePending ? '⏸ Pauser snart …' : compact ? '⏸' : '⏸ Pause'}
        </button>
      )}
      {canSkip && (
        <button className="btn ghost small" onClick={() => host.advance().then(err)}>
          ⏭{compact ? '' : ' Videre'}
        </button>
      )}
    </>
  );
}

export function Warnings({ st }: { st: PublicState }) {
  if (!st.warnings.length) return null;
  return (
    <div className="panel" style={{ borderColor: 'var(--gold)', padding: 10 }}>
      {st.warnings.map((w) => (
        <div key={w} className="small">
          ⚠️ {w}
        </div>
      ))}
    </div>
  );
}
