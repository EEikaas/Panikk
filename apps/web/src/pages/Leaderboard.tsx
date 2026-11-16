import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { api } from '../net/api';
import { Link } from '../router';

type Kind = 'wins' | 'score' | 'accuracy' | 'games';
const TABS: { id: Kind; name: string; unit: string }[] = [
  { id: 'wins', name: '🏆 Flest seiere', unit: 'seiere' },
  { id: 'score', name: '⭐ Høyeste poengsum', unit: 'poeng' },
  { id: 'accuracy', name: '🎯 Beste svarprosent', unit: '%' },
  { id: 'games', name: '🎮 Flest spill', unit: 'spill' },
];

export default function LeaderboardPage() {
  const [kind, setKind] = useState<Kind>('wins');
  const [rows, setRows] = useState<{ displayName: string; characterId: string; value: number; games: number }[] | null>(null);
  useEffect(() => {
    setRows(null);
    api<{ rows: typeof rows }>(`/api/leaderboard?kind=${kind}`).then((r) => setRows(r.rows ?? []), () => setRows([]));
  }, [kind]);
  const tab = TABS.find((t) => t.id === kind)!;
  return (
    <div className="page page-narrow">
      <div className="topbar">
        <Link className="back" to="/">
          ← Tilbake
        </Link>
        <h2 style={{ margin: 0 }}>Toppliste</h2>
        <span />
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`chip ${kind === t.id ? 'on' : ''}`} onClick={() => setKind(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="scoreboard" style={{ width: '100%' }}>
        {rows === null && <div className="spinner" />}
        {rows?.length === 0 && <p className="muted">Ingen på lista ennå. Lag en profil, spill, og slå på «Vis på topplister».</p>}
        {rows?.map((r, i) => (
          <div key={i} className={`score-row ${i === 0 ? 'first' : ''}`}>
            <span className="rank">{i + 1}</span>
            <Avatar characterId={r.characterId} size={44} />
            <span className="name">{r.displayName}</span>
            <span className="pts">
              {r.value}
              <span className="muted small"> {tab.unit}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 16 }}>
        Personvern: Topplistene viser kun visningsnavn for spillere som selv har valgt å være med. Svarprosent krever minst 20 svar.
      </p>
    </div>
  );
}
