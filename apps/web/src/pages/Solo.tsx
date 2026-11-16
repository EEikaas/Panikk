import { useState } from 'react';
import { BOT_LEVELS, CHARACTERS, DIFFICULTIES, LENGTHS, type BotLevel, type Difficulty, type GameLength } from '@podiepanikk/shared';
import { toast } from '../components/Toasts';
import { createRoom } from '../net/room';
import { Link, navigate } from '../router';
import { CharacterPicker } from '../room/CharacterPicker';
import { useSettings } from '../settings';

/** Enspillermodus: deg mot datastyrte motstandere – showet starter med en gang. */
export function SoloPage() {
  const s = useSettings();
  const [name, setName] = useState(s.lastName);
  const [char, setChar] = useState(s.lastCharacter || CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('familie');
  const [length, setLength] = useState<GameLength>('kort');
  const [level, setLevel] = useState<BotLevel>('middels');
  const [opponents, setOpponents] = useState(3);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!name.trim()) return toast('Skriv inn navnet ditt', 'error');
    setBusy(true);
    s.set({ lastName: name.trim(), lastCharacter: char });
    const r = await createRoom(
      { displayMode: 'mobile', difficulty, length, maxPlayers: opponents + 1, categories: [], useExternal: false, solo: true, botLevel: level },
      'player',
      name.trim(),
      char,
      'full',
      opponents,
    );
    setBusy(false);
    if (!r.ok || !r.data) return toast(r.error ?? 'Kunne ikke starte solospill', 'error');
    navigate(`/rom/${r.data.code}`);
  };

  return (
    <div className="page page-narrow">
      <div className="topbar">
        <Link className="back" to="/">
          ← Tilbake
        </Link>
        <h2 style={{ margin: 0 }}>Spill alene</h2>
        <span />
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Deg mot datastyrte motstandere – alle seks rundene, rett i gang. Solospill teller ikke på topplistene.
      </p>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="field">
          <label htmlFor="sn">Navnet ditt</label>
          <input id="sn" className="input" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kallenavn" autoComplete="nickname" />
        </div>
        <CharacterPicker value={char} onChange={setChar} />
      </section>

      <section className="panel" style={{ marginBottom: 14, display: 'grid', gap: 14 }}>
        <div>
          <h3>Motstandere</h3>
          <div className="stepper">
            <button className="icon-btn" onClick={() => setOpponents((n) => Math.max(1, n - 1))} aria-label="Færre motstandere">
              −
            </button>
            <output>{opponents}</output>
            <button className="icon-btn" onClick={() => setOpponents((n) => Math.min(11, n + 1))} aria-label="Flere motstandere">
              +
            </button>
          </div>
        </div>
        <div>
          <h3>Hvor flinke er de?</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {BOT_LEVELS.map((l) => (
              <button key={l.id} className={`option-card ${level === l.id ? 'on' : ''}`} onClick={() => setLevel(l.id)}>
                <b>{l.id === 'lett' ? '🐢 ' : l.id === 'middels' ? '🦊 ' : '🦅 '}{l.name}</b>
                <span>{l.description}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3>Spørsmålsnivå</h3>
          <div className="chips">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} className={`chip ${difficulty === d.id ? 'on' : ''}`} onClick={() => setDifficulty(d.id)}>
                {d.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3>Lengde</h3>
          <div className="chips">
            {LENGTHS.map((d) => (
              <button key={d.id} className={`chip ${length === d.id ? 'on' : ''}`} onClick={() => setLength(d.id)}>
                {d.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <button className="btn big block" disabled={busy} onClick={start}>
        {busy ? 'Varmer opp studioet …' : '🎬 Start showet!'}
      </button>
    </div>
  );
}
