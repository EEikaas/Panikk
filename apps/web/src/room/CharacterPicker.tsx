import { lazy, Suspense, useState } from 'react';
import { CHARACTERS, getCharacter } from '@podiepanikk/shared';
import { Avatar } from '../components/Avatar';
import { sfx } from '../audio/sound';
import type { Emotion } from '../three/Character';

const CharacterPreview = lazy(() => import('../three/Previews'));

const DEMO: Emotion[] = ['idle', 'happy', 'surprised', 'victory', 'sad', 'nervous', 'clap'];

/** Bla mellom karakterene, se dem i roterbar 3D og test reaksjonene deres. */
export function CharacterPicker({ value, onChange, taken = [], variant = 0 }: { value: string; onChange: (id: string) => void; taken?: string[]; variant?: number }) {
  const idx = Math.max(0, CHARACTERS.findIndex((c) => c.id === value));
  const def = getCharacter(value);
  const [emotion, setEmotion] = useState<Emotion>('idle');
  const go = (d: number) => {
    sfx('click');
    onChange(CHARACTERS[(idx + d + CHARACTERS.length) % CHARACTERS.length].id);
    setEmotion('happy');
    setTimeout(() => setEmotion('idle'), 1200);
  };
  return (
    <div className="char-picker">
      <div className="char-stage">
        <Suspense fallback={<div className="center-screen"><Avatar characterId={value} size={140} /></div>}>
          <CharacterPreview characterId={value} variant={variant} emotion={emotion} />
        </Suspense>
      </div>
      <div className="char-nav">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Forrige karakter">
          ◀
        </button>
        <div>
          <b>{def.name}</b>
          <div className="muted small">{def.tagline}</div>
        </div>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Neste karakter">
          ▶
        </button>
      </div>
      <button
        className="btn ghost small"
        onClick={() => {
          const e = DEMO[(DEMO.indexOf(emotion) + 1) % DEMO.length];
          setEmotion(e);
        }}
      >
        🎭 Test reaksjon
      </button>
      <div className="char-strip" role="listbox" aria-label="Velg karakter">
        {CHARACTERS.map((c) => (
          <button key={c.id} role="option" aria-selected={c.id === value} className={`${c.id === value ? 'on' : ''} ${taken.includes(c.id) && c.id !== value ? 'taken' : ''}`} onClick={() => onChange(c.id)} title={c.name}>
            <Avatar characterId={c.id} size={46} />
          </button>
        ))}
      </div>
      {taken.includes(value) && <div className="muted small">Noen andre har også valgt {def.name} – du får en egen fargevariant.</div>}
    </div>
  );
}
