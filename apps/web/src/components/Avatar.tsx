import { getCharacter, variantColor } from '@podiepanikk/shared';

/** Flatt 2D-ikon av en karakter (brukes på kontrolleren, i lister og som reserve uten WebGL). */
export function Avatar({ characterId, variant = 0, size = 40, mood = 'happy' }: { characterId: string; variant?: number; size?: number; mood?: 'happy' | 'sad' | 'wow' }) {
  const c = getCharacter(characterId);
  const outfit = variantColor(c.outfit, variant);
  const hair = c.hair;
  const mouth =
    mood === 'sad' ? <path d="M40 70 Q50 62 60 70" stroke="#3a1206" strokeWidth="4" fill="none" strokeLinecap="round" /> :
    mood === 'wow' ? <ellipse cx="50" cy="68" rx="6" ry="8" fill="#3a1206" /> :
    <path d="M38 64 Q50 76 62 64" stroke="#3a1206" strokeWidth="4" fill="none" strokeLinecap="round" />;
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" aria-label={c.name} role="img">
      <circle cx="50" cy="50" r="48" fill={outfit} />
      <circle cx="50" cy="50" r="48" fill="url(#shine)" opacity=".25" />
      <defs>
        <radialGradient id="shine" cx="30%" cy="25%" r="70%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {c.extras.includes('trollears') && (
        <>
          <ellipse cx="22" cy="52" rx="9" ry="13" fill={c.skin} />
          <ellipse cx="78" cy="52" rx="9" ry="13" fill={c.skin} />
        </>
      )}
      {c.body === 'box' ? <rect x="24" y="24" width="52" height="54" rx="10" fill={c.skin} /> : <circle cx="50" cy="54" r="27" fill={c.skin} />}
      {(c.hairStyle === 'afro' || c.hairStyle === 'curly') && <circle cx="50" cy="32" r={c.hairStyle === 'afro' ? 26 : 20} fill={hair} />}
      {c.hairStyle === 'spiky' && <path d="M26 40 L32 18 L40 34 L48 14 L56 34 L64 16 L70 34 L76 22 L74 42 Z" fill={hair} />}
      {c.hairStyle === 'mohawk' && <rect x="44" y="8" width="12" height="30" rx="5" fill={hair} />}
      {c.hairStyle === 'bun' && (
        <>
          <circle cx="50" cy="18" r="10" fill={hair} />
          <path d="M24 46 Q50 18 76 46 Q50 34 24 46" fill={hair} />
        </>
      )}
      {c.hairStyle === 'pompadour' && <path d="M24 42 Q30 14 62 18 Q80 22 76 42 Q60 30 24 42" fill={hair} />}
      {c.hairStyle === 'long' && <path d="M22 70 Q18 30 50 26 Q82 30 78 70 L70 70 Q72 40 50 38 Q28 40 30 70 Z" fill={hair} />}
      {c.hat === 'captain' && <path d="M22 34 L78 34 L70 18 L30 18 Z" fill="#111827" />}
      {c.hat === 'chef' && <path d="M30 34 Q22 10 40 14 Q50 2 60 14 Q78 10 70 34 Z" fill="#fff" />}
      {c.hat === 'crown' && <path d="M30 32 L32 14 L41 24 L50 10 L59 24 L68 14 L70 32 Z" fill={c.accent} />}
      {c.hat === 'tophat' && (
        <>
          <rect x="34" y="4" width="32" height="26" fill="#111" />
          <rect x="26" y="28" width="48" height="6" fill="#111" />
        </>
      )}
      {c.hat === 'viking' && (
        <>
          <path d="M26 38 Q50 6 74 38 Z" fill={c.accent} />
          <path d="M26 34 Q12 26 16 12 Q22 26 30 28 Z" fill="#fff8e1" />
          <path d="M74 34 Q88 26 84 12 Q78 26 70 28 Z" fill="#fff8e1" />
        </>
      )}
      {c.hat === 'cap' && <path d="M24 38 Q50 10 76 38 L90 40 L24 40 Z" fill={c.accent} />}
      {c.hat === 'beanie' && <path d="M24 40 Q50 4 76 40 Z" fill={c.accent} />}
      {c.hat === 'astro' && <circle cx="50" cy="54" r="38" fill="none" stroke="#e5e7eb" strokeWidth="5" opacity=".9" />}
      {c.extras.includes('antenna') && (
        <>
          <line x1="50" y1="24" x2="50" y2="8" stroke="#64748b" strokeWidth="4" />
          <circle cx="50" cy="7" r="5" fill={c.accent} />
        </>
      )}
      <circle cx="40" cy="50" r={6 * c.eyeScale} fill="#fff" />
      <circle cx="60" cy="50" r={6 * c.eyeScale} fill="#fff" />
      <circle cx="41" cy="51" r={3 * c.eyeScale} fill="#111" />
      <circle cx="61" cy="51" r={3 * c.eyeScale} fill="#111" />
      {c.extras.includes('glasses') && (
        <g stroke="#1f2937" strokeWidth="3" fill="none">
          <circle cx="40" cy="50" r="9" />
          <circle cx="60" cy="50" r="9" />
          <line x1="49" y1="50" x2="51" y2="50" />
        </g>
      )}
      {c.extras.includes('sunglasses') && <path d="M28 44 H72 V52 Q66 60 56 54 H44 Q34 60 28 52 Z" fill="#111" />}
      {c.extras.includes('monocle') && <circle cx="60" cy="50" r="9" stroke={c.accent} strokeWidth="3" fill="none" />}
      {c.extras.includes('bignose') && <ellipse cx="50" cy="60" rx="7" ry="6" fill={c.skin} stroke="rgba(0,0,0,.2)" />}
      {c.extras.includes('beak') ? <path d="M42 60 L58 60 L50 70 Z" fill={c.accent} /> : mouth}
      {c.extras.includes('mustache') && <path d="M38 62 Q44 56 50 61 Q56 56 62 62 Q56 66 50 63 Q44 66 38 62" fill="#6b7280" />}
      {c.extras.includes('beard') && <path d="M28 58 Q30 88 50 88 Q70 88 72 58 Q66 74 50 74 Q34 74 28 58" fill={hair} />}
      {c.extras.includes('freckles') && (
        <g fill="#c2410c" opacity=".6">
          <circle cx="34" cy="58" r="1.6" />
          <circle cx="38" cy="61" r="1.6" />
          <circle cx="62" cy="61" r="1.6" />
          <circle cx="66" cy="58" r="1.6" />
        </g>
      )}
      {c.extras.includes('bowtie') && <path d="M40 86 L50 82 L60 86 L60 94 L50 90 L40 94 Z" fill={c.accent} />}
    </svg>
  );
}
