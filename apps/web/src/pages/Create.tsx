import { useState } from 'react';
import { CATEGORIES, CHARACTERS, DIFFICULTIES, DISPLAY_MODES, LENGTHS, MAX_PLAYERS, MIN_PLAYERS, type CategoryId, type Difficulty, type DisplayMode, type GameLength } from '@podiepanikk/shared';
import { toast } from '../components/Toasts';
import { createRoom } from '../net/room';
import { Link, navigate } from '../router';
import { useSettings } from '../settings';

export function CreatePage() {
  const s = useSettings();
  const [mode, setMode] = useState<DisplayMode>('screen');
  const [difficulty, setDifficulty] = useState<Difficulty>('familie');
  const [length, setLength] = useState<GameLength>('normal');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [cats, setCats] = useState<CategoryId[]>([]);
  const [external, setExternal] = useState(false);
  const [hostAs, setHostAs] = useState<'screen' | 'player'>('screen');
  const [name, setName] = useState(s.lastName);
  const [busy, setBusy] = useState(false);
  const as = mode === 'screen' ? 'screen' : mode === 'mobile' ? 'player' : hostAs;

  const toggleCat = (c: CategoryId) => {
    if (c === 'voksen18' && !cats.includes(c)) {
      const ok = confirm('🔞 Voksen 18+ inneholder spørsmål om alkohol, fest og dating, og en programleder med grov humor.\n\nBekreft at ALLE spillerne er over 18 år.');
      if (!ok) return;
    }
    setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  };
  const chooseDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    if (d !== 'voksen') setCats((x) => x.filter((c) => c !== 'voksen18')); // 18+ bare på voksennivå
  };

  const submit = async () => {
    if (as === 'player' && !name.trim()) return toast('Skriv inn navnet ditt', 'error');
    setBusy(true);
    const character = s.lastCharacter || CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
    if (as === 'player') s.set({ lastName: name.trim() });
    const r = await createRoom(
      { displayMode: mode, difficulty, length, maxPlayers, categories: cats, useExternal: external },
      as,
      as === 'player' ? name.trim() : undefined,
      as === 'player' ? character : undefined,
      as === 'player' ? (mode === 'mobile' ? 'full' : 'full') : undefined,
    );
    setBusy(false);
    if (!r.ok || !r.data) return toast(r.error ?? 'Kunne ikke opprette rom', 'error');
    navigate(`/rom/${r.data.code}`);
  };

  return (
    <div className="page">
      <div className="topbar">
        <Link className="back" to="/">
          ← Tilbake
        </Link>
        <h2 style={{ margin: 0 }}>Nytt show</h2>
        <span />
      </div>

      <section className="panel" style={{ marginBottom: 14 }}>
        <h3>1. Hvordan skal dere spille?</h3>
        <div className="grid2">
          {DISPLAY_MODES.map((d) => (
            <button key={d.id} className={`option-card ${mode === d.id ? 'on' : ''}`} onClick={() => setMode(d.id)}>
              <b>{d.id === 'screen' ? '📺 ' : d.id === 'mobile' ? '📱 ' : '📺+📱 '}{d.name}</b>
              <span>{d.description}</span>
            </button>
          ))}
        </div>
        {mode === 'mixed' && (
          <div style={{ marginTop: 12 }}>
            <b>Denne enheten er …</b>
            <div className="chips" style={{ marginTop: 6 }}>
              <button className={`chip ${hostAs === 'screen' ? 'on' : ''}`} onClick={() => setHostAs('screen')}>
                📺 Storskjermen
              </button>
              <button className={`chip ${hostAs === 'player' ? 'on' : ''}`} onClick={() => setHostAs('player')}>
                🙋 Min egen spillermobil
              </button>
            </div>
          </div>
        )}
        {as === 'player' && (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="hn">Ditt navn</label>
            <input id="hn" className="input" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kallenavn" />
          </div>
        )}
      </section>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <section className="panel">
          <h3>2. Vanskelighetsgrad</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {DIFFICULTIES.map((d) => (
              <button key={d.id} className={`option-card ${difficulty === d.id ? 'on' : ''}`} onClick={() => chooseDifficulty(d.id)}>
                <b>{d.id === 'barn' ? '🧒 ' : d.id === 'familie' ? '👨‍👩‍👧 ' : '🧠 '}{d.name}</b>
                <span>{d.description}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h3>3. Spillengde</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {LENGTHS.map((d) => (
              <button key={d.id} className={`option-card ${length === d.id ? 'on' : ''}`} onClick={() => setLength(d.id)}>
                <b>{d.name}</b>
                <span>{d.description}</span>
              </button>
            ))}
          </div>
          <h3 style={{ marginTop: 16 }}>4. Maks antall spillere</h3>
          <div className="stepper">
            <button className="icon-btn" onClick={() => setMaxPlayers((n) => Math.max(MIN_PLAYERS, n - 1))} aria-label="Færre">
              −
            </button>
            <output>{maxPlayers}</output>
            <button className="icon-btn" onClick={() => setMaxPlayers((n) => Math.min(MAX_PLAYERS, n + 1))} aria-label="Flere">
              +
            </button>
            <span className="muted small">Storskjermer teller ikke.</span>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginBottom: 18 }}>
        <h3>5. Kategorier (valgfritt)</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Ingen valgt = alt blandet. Er det for få spørsmål i valgte kategorier, fylles det på automatisk.
          {difficulty === 'voksen' ? ' 🔞 Voksen 18+ må velges eksplisitt og er aldri med ellers.' : ' Velg nivå «Voksen» for å se 18+-kategorien.'}
        </p>
        <div className="chips">
          {CATEGORIES.filter((c) => c.id !== 'blandet' && (c.id !== 'voksen18' || difficulty === 'voksen')).map((c) => (
            <button key={c.id} className={`chip ${cats.includes(c.id) ? 'on' : ''}`} onClick={() => toggleCat(c.id)}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, fontWeight: 700 }}>
          <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} style={{ width: 22, height: 22 }} />
          Ta med engelske bonusspørsmål fra Open Trivia Database (CC BY-SA 4.0)
        </label>
      </section>

      <button className="btn big block" disabled={busy} onClick={submit}>
        {busy ? 'Bygger studioet …' : '🎬 Opprett rom'}
      </button>
    </div>
  );
}
