import { useEffect, useState } from 'react';
import { ANSWER_COLORS, CATEGORIES, DIFFICULTIES, type CategoryId, type Difficulty } from '@podiepanikk/shared';
import { toast } from '../components/Toasts';
import { api, ApiError, type Me } from '../net/api';
import { Link } from '../router';
import { AuthForms } from './Profile';

interface Q {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  category: CategoryId;
  difficulty: Difficulty;
  language: 'nb' | 'en';
  source?: string;
  active: boolean;
}
const EMPTY: Omit<Q, 'id'> = { text: '', options: ['', '', '', ''], correctIndex: 0, category: 'generelt', difficulty: 'familie', language: 'nb', active: true };

export default function AdminPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    api<{ user: Me | null }>('/api/auth/me').then((r) => setMe(r.user), () => setMe(null));
  }, []);
  return (
    <div className="page">
      <div className="topbar">
        <Link className="back" to="/">
          ← Tilbake
        </Link>
        <h2 style={{ margin: 0 }}>Administrasjon</h2>
        <span />
      </div>
      {me === undefined && <div className="spinner" />}
      {me === null && (
        <div className="page-narrow" style={{ margin: '0 auto' }}>
          <p className="muted">Logg inn med en administratorkonto.</p>
          <AuthForms onAuthed={setMe} />
        </div>
      )}
      {me && me.role !== 'admin' && <div className="panel">Kontoen «{me.username}» har ikke administratortilgang.</div>}
      {me?.role === 'admin' && <QuestionAdmin />}
    </div>
  );
}

function QuestionAdmin() {
  const [list, setList] = useState<Q[]>([]);
  const [builtin, setBuiltin] = useState(0);
  const [filter, setFilter] = useState<{ difficulty?: string; category?: string; search?: string }>({});
  const [editing, setEditing] = useState<(Omit<Q, 'id'> & { id?: string }) | null>(null);
  const [tab, setTab] = useState<'list' | 'import'>('list');

  const load = async () => {
    const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
    try {
      const r = await api<{ questions: Q[]; builtinCount: number }>(`/api/admin/questions?${qs}`);
      setList(r.questions);
      setBuiltin(r.builtinCount);
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.difficulty, filter.category]);

  const save = async () => {
    if (!editing) return;
    const { id, ...body } = editing;
    try {
      await api(id ? `/api/admin/questions/${id}` : '/api/admin/questions', { method: id ? 'PUT' : 'POST', body: { ...body, source: body.source || undefined } });
      toast('Lagret', 'success');
      setEditing(null);
      void load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="tabs">
        <button className={`chip ${tab === 'list' ? 'on' : ''}`} onClick={() => setTab('list')}>
          📋 Egne spørsmål ({list.length})
        </button>
        <button className={`chip ${tab === 'import' ? 'on' : ''}`} onClick={() => setTab('import')}>
          📥 Importer CSV / JSON
        </button>
        <button className="btn small" onClick={() => setEditing({ ...EMPTY, options: ['', '', '', ''] })}>
          ＋ Nytt spørsmål
        </button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Den innebygde banken har {builtin} spørsmål (endres i kildekoden). Egne, aktive spørsmål blandes inn i alle nye spill.
      </p>

      {editing && (
        <div className="panel">
          <h3>{editing.id ? 'Rediger spørsmål' : 'Nytt spørsmål'}</h3>
          <div className="field">
            <label>Spørsmål</label>
            <textarea className="input" style={{ minHeight: 70, fontFamily: 'inherit', fontSize: '1rem' }} maxLength={300} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
          </div>
          <div className="grid2">
            {editing.options.map((o, i) => (
              <div className="field" key={i}>
                <label style={{ color: ANSWER_COLORS[i].hex }}>
                  <input type="radio" name="correct" checked={editing.correctIndex === i} onChange={() => setEditing({ ...editing, correctIndex: i })} /> Svar {'ABCD'[i]} {editing.correctIndex === i && '(riktig)'}
                </label>
                <input
                  className="input"
                  maxLength={120}
                  value={o}
                  onChange={(e) => {
                    const opts = [...editing.options] as Q['options'];
                    opts[i] = e.target.value;
                    setEditing({ ...editing, options: opts });
                  }}
                />
              </div>
            ))}
          </div>
          <div className="grid2">
            <div className="field">
              <label>Kategori</label>
              <select className="input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as CategoryId })}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Vanskelighetsgrad</label>
              <select className="input" value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value as Difficulty })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Språk</label>
              <select className="input" value={editing.language} onChange={(e) => setEditing({ ...editing, language: e.target.value as 'nb' | 'en' })}>
                <option value="nb">Norsk bokmål</option>
                <option value="en">Engelsk</option>
              </select>
            </div>
            <div className="field">
              <label>Kilde (valgfritt)</label>
              <input className="input" maxLength={200} value={editing.source ?? ''} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, marginBottom: 12 }}>
            <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Aktivt (brukes i nye spill)
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={save}>
              💾 Lagre
            </button>
            <button className="btn ghost" onClick={() => setEditing(null)}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      {tab === 'import' && <Importer onDone={load} />}

      {tab === 'list' && (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input className="input" style={{ maxWidth: 260 }} placeholder="Søk …" value={filter.search ?? ''} onChange={(e) => setFilter({ ...filter, search: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} />
            <select className="input" style={{ maxWidth: 180 }} value={filter.difficulty ?? ''} onChange={(e) => setFilter({ ...filter, difficulty: e.target.value || undefined })}>
              <option value="">Alle nivåer</option>
              {DIFFICULTIES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select className="input" style={{ maxWidth: 200 }} value={filter.category ?? ''} onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}>
              <option value="">Alle kategorier</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Spørsmål</th>
                <th>Riktig</th>
                <th>Kategori</th>
                <th>Nivå</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((q) => (
                <tr key={q.id}>
                  <td>{q.text}</td>
                  <td>{q.options[q.correctIndex]}</td>
                  <td>{CATEGORIES.find((c) => c.id === q.category)?.name}</td>
                  <td>{q.difficulty}</td>
                  <td>
                    <button
                      className={`badge ${q.active ? 'on' : ''}`}
                      style={{ border: 0 }}
                      onClick={async () => {
                        const { id, ...rest } = q;
                        await api(`/api/admin/questions/${id}`, { method: 'PUT', body: { ...rest, active: !q.active } }).catch((e) => toast(e.message, 'error'));
                        void load();
                      }}
                    >
                      {q.active ? 'aktiv' : 'inaktiv'}
                    </button>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost small" onClick={() => setEditing({ ...q })}>
                      ✏️
                    </button>{' '}
                    <button
                      className="btn ghost small"
                      onClick={async () => {
                        if (!confirm('Slette spørsmålet permanent?')) return;
                        await api(`/api/admin/questions/${q.id}`, { method: 'DELETE' }).catch((e) => toast(e.message, 'error'));
                        void load();
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Ingen egne spørsmål ennå.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CSV_EXAMPLE = `tekst,a,b,c,d,riktig,kategori,nivå,kilde
"Hva heter Norges høyeste fjell?",Galdhøpiggen,Snøhetta,Glittertind,Gaustatoppen,A,norge,familie,
"Hvor mange bein har en edderkopp?",6,8,10,4,B,dyr,barn,`;

function Importer({ onDone }: { onDone: () => void }) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [data, setData] = useState('');
  const [result, setResult] = useState<{ imported: number; valid: number; errors: { row: number; message: string }[] } | null>(null);
  const run = async (dryRun: boolean) => {
    try {
      const r = await api<typeof result>('/api/admin/questions/import', { method: 'POST', body: { format, data, dryRun } });
      setResult(r);
      if (!dryRun) {
        toast(`Importerte ${r?.imported} spørsmål`, 'success');
        onDone();
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="panel">
      <div className="tabs">
        <button className={`chip ${format === 'csv' ? 'on' : ''}`} onClick={() => setFormat('csv')}>
          CSV
        </button>
        <button className={`chip ${format === 'json' ? 'on' : ''}`} onClick={() => setFormat('json')}>
          JSON
        </button>
        <label className="btn ghost small">
          📂 Velg fil
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 1_500_000) return toast('Filen er for stor (maks 1,5 MB)', 'error');
              setFormat(f.name.endsWith('.json') ? 'json' : 'csv');
              setData(await f.text());
            }}
          />
        </label>
      </div>
      <textarea className="input" value={data} onChange={(e) => setData(e.target.value)} placeholder={format === 'csv' ? CSV_EXAMPLE : '[{"text":"…","options":["a","b","c","d"],"correct":"A","category":"sport","difficulty":"voksen"}]'} />
      <p className="muted small">
        CSV-kolonner: tekst, a, b, c, d, riktig (A–D), kategori, nivå (barn/familie/voksen), kilde. Komma eller semikolon. Kategorier: {CATEGORIES.map((c) => c.id).join(', ')}.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn ghost" disabled={!data} onClick={() => run(true)}>
          🔍 Kontroller
        </button>
        <button className="btn" disabled={!data} onClick={() => run(false)}>
          📥 Importer
        </button>
      </div>
      {result && (
        <div style={{ marginTop: 12 }}>
          <b>
            {result.valid} gyldige{result.imported ? `, ${result.imported} importert` : ''}, {result.errors.length} feil
          </b>
          {result.errors.map((e) => (
            <div key={e.row} className="small" style={{ color: 'var(--bad)' }}>
              Rad {e.row}: {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
