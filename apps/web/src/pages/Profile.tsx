import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { toast } from '../components/Toasts';
import { api, type Me } from '../net/api';
import { Link } from '../router';
import { CharacterPicker } from '../room/CharacterPicker';

interface Stats {
  games: number;
  wins: number;
  totalScore: number;
  bestScore: number;
  correct: number;
  answered: number;
  accuracy: number | null;
  avgMs: number | null;
}
interface History {
  gameId: string;
  endedAt: number;
  difficulty: string;
  length: string;
  playerCount: number;
  rank: number;
  score: number;
  won: boolean;
}

export function AuthForms({ onAuthed }: { onAuthed: (u: Me) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = mode === 'login' ? { username, password } : { username, password, displayName: displayName || username };
      const r = await api<{ user: Me }>(`/api/auth/${mode}`, { method: 'POST', body });
      onAuthed(r.user);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="panel" onSubmit={submit}>
      <div className="tabs">
        <button type="button" className={`chip ${mode === 'login' ? 'on' : ''}`} onClick={() => setMode('login')}>
          Logg inn
        </button>
        <button type="button" className={`chip ${mode === 'register' ? 'on' : ''}`} onClick={() => setMode('register')}>
          Lag profil
        </button>
      </div>
      <div className="field">
        <label htmlFor="u">Brukernavn</label>
        <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="p">Passord</label>
        <input id="p" className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {mode === 'register' && (
        <div className="field">
          <label htmlFor="d">Visningsnavn (kallenavn)</label>
          <input id="d" className="input" maxLength={16} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <span className="muted small">Vi ber ikke om e-post eller ekte navn. Barn bør lage profil sammen med en voksen.</span>
        </div>
      )}
      <button className="btn block" disabled={busy}>
        {mode === 'login' ? 'Logg inn' : 'Opprett profil'}
      </button>
    </form>
  );
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const load = () =>
    api<{ user: Me; stats: Stats; history: History[] }>('/api/profile').then(
      (r) => {
        setMe(r.user);
        setStats(r.stats);
        setHistory(r.history);
      },
      () => setMe(null),
    );
  useEffect(() => {
    void load();
  }, []);

  const patch = async (p: Partial<Me>) => {
    try {
      const r = await api<{ user: Me }>('/api/profile', { method: 'PATCH', body: p });
      setMe(r.user);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="page page-narrow">
      <div className="topbar">
        <Link className="back" to="/">
          ← Tilbake
        </Link>
        <h2 style={{ margin: 0 }}>Spillerprofil</h2>
        <span />
      </div>
      {me === undefined && <div className="spinner" />}
      {me === null && (
        <>
          <p className="muted">Du kan alltid spille som gjest. Med en profil lagres statistikk og resultater – og du kan velge å vises på topplista.</p>
          <AuthForms onAuthed={() => void load()} />
        </>
      )}
      {me && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="panel" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Avatar characterId={me.characterId} size={72} />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0 }}>{me.displayName}</h2>
              <span className="muted">@{me.username}{me.role === 'admin' && ' · administrator'}</span>
            </div>
            <button
              className="btn ghost small"
              onClick={async () => {
                await api('/api/auth/logout', { method: 'POST', body: {} });
                setMe(null);
              }}
            >
              Logg ut
            </button>
          </div>
          {stats && (
            <div className="panel grid2" style={{ textAlign: 'center' }}>
              {[
                ['Spill', stats.games],
                ['Seiere', stats.wins],
                ['Totale poeng', stats.totalScore],
                ['Beste poengsum', stats.bestScore],
                ['Riktige svar', stats.correct],
                ['Svarprosent', stats.accuracy != null ? `${stats.accuracy} %` : '–'],
                ['Snittid per svar', stats.avgMs != null ? `${(stats.avgMs / 1000).toFixed(1)} s` : '–'],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--gold)' }}>{v}</div>
                  <div className="muted small">{k}</div>
                </div>
              ))}
            </div>
          )}
          <div className="panel">
            <h3>Tidligere resultater</h3>
            {history.length === 0 ? (
              <p className="muted">Ingen spill ennå. Logg inn før du blir med i et rom, så lagres resultatet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Dato</th>
                    <th>Plass</th>
                    <th>Poeng</th>
                    <th>Nivå</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.gameId}>
                      <td>{new Date(h.endedAt).toLocaleDateString('nb-NO')}</td>
                      <td>
                        {h.won ? '🏆 ' : ''}
                        {h.rank}/{h.playerCount}
                      </td>
                      <td>{h.score}</td>
                      <td>{h.difficulty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="panel">
            <h3>Innstillinger for profilen</h3>
            <div className="field">
              <label htmlFor="dn">Visningsnavn</label>
              <input id="dn" className="input" maxLength={16} defaultValue={me.displayName} onBlur={(e) => e.target.value.trim() && e.target.value !== me.displayName && patch({ displayName: e.target.value.trim() })} />
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700, marginBottom: 14 }}>
              <input type="checkbox" checked={me.showOnLeaderboard} onChange={(e) => patch({ showOnLeaderboard: e.target.checked })} style={{ width: 22, height: 22 }} />
              Vis visningsnavnet mitt på de offentlige topplistene
            </label>
            <b>Favorittkarakter</b>
            <CharacterPicker value={me.characterId} onChange={(id) => patch({ characterId: id })} />
          </div>
          {me.role !== 'admin' && (
            <div className="panel" style={{ borderColor: 'var(--bad)' }}>
              <h3>Slett profil</h3>
              <p className="muted small">Profilen og innloggingen slettes permanent. Tidligere spillresultater anonymiseres.</p>
              <button
                className="btn ghost"
                onClick={async () => {
                  if (!confirm('Er du sikker? Dette kan ikke angres.')) return;
                  await api('/api/profile', { method: 'DELETE' });
                  toast('Profilen er slettet', 'success');
                  setMe(null);
                }}
              >
                🗑️ Slett profilen min
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
