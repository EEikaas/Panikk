import { crowd, sfx, unlockAudio } from '../audio/sound';
import { Link } from '../router';
import { useSettings, type Quality } from '../settings';

export default function SettingsPage() {
  const s = useSettings();
  const toggle = (key: 'music' | 'sfx' | 'crowd' | 'haptics' | 'controllerSound', label: string, hint?: string) => (
    <label style={{ display: 'flex', gap: 12, alignItems: 'center', fontWeight: 800, padding: '8px 0' }}>
      <input type="checkbox" checked={s[key]} onChange={(e) => s.set({ [key]: e.target.checked })} style={{ width: 24, height: 24 }} />
      <span>
        {label}
        {hint && <div className="muted small">{hint}</div>}
      </span>
    </label>
  );
  return (
    <div className="page page-narrow">
      <div className="topbar">
        <Link className="back" to="/">
          ← Tilbake
        </Link>
        <h2 style={{ margin: 0 }}>Innstillinger</h2>
        <span />
      </div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3>🔊 Lyd</h3>
        {toggle('music', 'Musikk')}
        {toggle('sfx', 'Lydeffekter')}
        {toggle('crowd', 'Publikumslyder', 'Applaus, latter og jubel')}
        {toggle('controllerSound', 'Full lyd på mobilkontrolleren', 'Av som standard – TV-en har hovedlyden')}
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="vol">Volum: {Math.round(s.volume * 100)} %</label>
          <input id="vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => s.set({ volume: Number(e.target.value) })} />
        </div>
        <button
          className="btn ghost small"
          onClick={() => {
            unlockAudio();
            setTimeout(() => {
              sfx('correct');
              crowd('applause');
            }, 50);
          }}
        >
          ▶ Test lyd
        </button>
      </div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3>🎨 Grafikk</h3>
        <div className="chips">
          {(
            [
              ['auto', 'Automatisk'],
              ['high', 'Høy'],
              ['low', 'Lav (spar batteri)'],
              ['off', 'Ingen 3D'],
            ] as [Quality, string][]
          ).map(([q, n]) => (
            <button key={q} className={`chip ${s.quality === q ? 'on' : ''}`} onClick={() => s.set({ quality: q })}>
              {n}
            </button>
          ))}
        </div>
        <h3 style={{ marginTop: 16 }}>Redusert bevegelse</h3>
        <div className="chips">
          {(
            [
              ['system', 'Følg systemet'],
              ['on', 'På'],
              ['off', 'Av'],
            ] as const
          ).map(([v, n]) => (
            <button key={v} className={`chip ${s.reducedMotion === v ? 'on' : ''}`} onClick={() => s.set({ reducedMotion: v })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>📳 Kontroller</h3>
        {toggle('haptics', 'Vibrasjon ved trykk', 'Støttes av de fleste Android-telefoner')}
      </div>
      <p className="muted small" style={{ marginTop: 16 }}>
        Innstillingene lagres bare på denne enheten. <Link to="/admin">Administrasjon</Link>
      </p>
    </div>
  );
}
