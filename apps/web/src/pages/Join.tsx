import { useState } from 'react';
import { ROOM_CODE_ALPHABET } from '@podiepanikk/shared';
import { Link, navigate } from '../router';

export function JoinPage({ initialCode = '' }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const clean = code.toUpperCase().split('').filter((c) => ROOM_CODE_ALPHABET.includes(c)).join('').slice(0, 5);
  const go = (tv = false) => {
    if (clean.length !== 5) return;
    const keep = new URLSearchParams(location.search).get('ny') === '1';
    navigate(`/rom/${clean}${tv ? '?tv=1' : keep ? '?ny=1' : ''}`);
  };
  return (
    <div className="page page-narrow">
      <div className="topbar">
        <Link className="back" to="/">
          ← Tilbake
        </Link>
      </div>
      <h1>Bli med i et show</h1>
      <p className="muted">Skriv inn romkoden som vises på storskjermen eller hos verten – eller skann QR-koden med kameraet.</p>
      <div className="panel">
        <div className="field">
          <label htmlFor="code">Romkode</label>
          <input
            id="code"
            className="input code-input"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={5}
            value={clean}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="ABCDE"
            autoFocus={!initialCode}
          />
        </div>
        <button className="btn big block" disabled={clean.length !== 5} onClick={() => go()}>
          ➜ Fortsett
        </button>
        <button className="btn ghost block" style={{ marginTop: 10 }} disabled={clean.length !== 5} onClick={() => go(true)}>
          📺 Koble til som ekstra storskjerm
        </button>
      </div>
    </div>
  );
}
