// 16 originale, prosedyregenererte karakterer. Alt bygges av enkle 3D-primitiver i klienten.

export type BodyShape = 'bean' | 'box' | 'pear' | 'tall' | 'round';
export type HairStyle = 'none' | 'spiky' | 'afro' | 'bun' | 'mohawk' | 'pompadour' | 'long' | 'curly';
export type HatStyle = 'none' | 'captain' | 'chef' | 'crown' | 'tophat' | 'viking' | 'cap' | 'astro' | 'beanie';
export type Extra =
  | 'glasses'
  | 'sunglasses'
  | 'mustache'
  | 'beard'
  | 'bowtie'
  | 'antenna'
  | 'bignose'
  | 'trollears'
  | 'beak'
  | 'freckles'
  | 'monocle'
  | 'scarf';
export type AnimStyle = 'bouncy' | 'wobbly' | 'stiff' | 'groovy' | 'sleepy' | 'hyper';

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  body: BodyShape;
  height: number; // 0.8–1.25
  width: number; // 0.8–1.3
  skin: string;
  outfit: string;
  accent: string;
  hair: string;
  hairStyle: HairStyle;
  hat: HatStyle;
  extras: Extra[];
  anim: AnimStyle;
  eyeScale: number;
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'krutt', name: 'Kaptein Krutt', tagline: 'Har seilt alle sju hav – og gått seg vill på seks.', body: 'pear', height: 1.05, width: 1.2, skin: '#f2c19b', outfit: '#1e3a8a', accent: '#facc15', hair: '#3f2a1d', hairStyle: 'curly', hat: 'captain', extras: ['beard'], anim: 'wobbly', eyeScale: 1 },
  { id: 'turbo', name: 'Turbo-Tante', tagline: 'Strikker raskere enn du rekker å tenke.', body: 'round', height: 0.85, width: 1.1, skin: '#f5d0b5', outfit: '#db2777', accent: '#fde68a', hair: '#d1d5db', hairStyle: 'bun', hat: 'none', extras: ['glasses'], anim: 'hyper', eyeScale: 1.1 },
  { id: 'pling', name: 'Professor Pling', tagline: 'Vet alt om alt. Nesten.', body: 'tall', height: 1.2, width: 0.85, skin: '#e8b48f', outfit: '#f8fafc', accent: '#0ea5e9', hair: '#9ca3af', hairStyle: 'none', hat: 'none', extras: ['glasses', 'mustache', 'bowtie'], anim: 'stiff', eyeScale: 1.25 },
  { id: 'disco', name: 'Disco-Dag', tagline: 'Lever livet på 120 BPM.', body: 'bean', height: 1.1, width: 1, skin: '#8d5a3b', outfit: '#a855f7', accent: '#f0abfc', hair: '#111827', hairStyle: 'afro', hat: 'none', extras: ['sunglasses'], anim: 'groovy', eyeScale: 1 },
  { id: 'lyn', name: 'Lyn-Lise', tagline: 'Var ferdig før du leste dette.', body: 'bean', height: 0.95, width: 0.9, skin: '#fcd9bd', outfit: '#ef4444', accent: '#fef08a', hair: '#f97316', hairStyle: 'spiky', hat: 'none', extras: ['freckles'], anim: 'hyper', eyeScale: 1.05 },
  { id: 'robo', name: 'Robo-Rolf', tagline: 'BIP BOP. SVAR: ALLTID C.', body: 'box', height: 1.05, width: 1.1, skin: '#94a3b8', outfit: '#475569', accent: '#22d3ee', hair: '#334155', hairStyle: 'none', hat: 'none', extras: ['antenna'], anim: 'stiff', eyeScale: 1.2 },
  { id: 'bjarne', name: 'Bonde Bjarne', tagline: 'Kan telle kuer i søvne.', body: 'pear', height: 1, width: 1.25, skin: '#eab08a', outfit: '#2563eb', accent: '#dc2626', hair: '#a16207', hairStyle: 'curly', hat: 'cap', extras: ['bignose'], anim: 'sleepy', eyeScale: 0.95 },
  { id: 'kari', name: 'Kokken Kari', tagline: 'Hemmeligheten er mer smør.', body: 'round', height: 0.95, width: 1.15, skin: '#f1c6a6', outfit: '#ffffff', accent: '#ef4444', hair: '#78350f', hairStyle: 'none', hat: 'chef', extras: ['scarf'], anim: 'bouncy', eyeScale: 1 },
  { id: 'vera', name: 'Viking-Vera', tagline: 'Plyndrer poengtavla med et smil.', body: 'bean', height: 1.1, width: 1.15, skin: '#f6d2b8', outfit: '#7c2d12', accent: '#d6d3d1', hair: '#fbbf24', hairStyle: 'long', hat: 'viking', extras: [], anim: 'bouncy', eyeScale: 1 },
  { id: 'astro', name: 'Astro-Arne', tagline: 'Har vært på månen. I drømme.', body: 'bean', height: 1, width: 1.05, skin: '#d9a07a', outfit: '#f97316', accent: '#e5e7eb', hair: '#1f2937', hairStyle: 'spiky', hat: 'astro', extras: [], anim: 'wobbly', eyeScale: 1.1 },
  { id: 'rita', name: 'Rocke-Rita', tagline: 'Spiller luftgitar på alle svar.', body: 'tall', height: 1.15, width: 0.9, skin: '#f3c9a8', outfit: '#111827', accent: '#ec4899', hair: '#ec4899', hairStyle: 'mohawk', hat: 'none', extras: ['sunglasses'], anim: 'groovy', eyeScale: 1 },
  { id: 'tufs', name: 'Trollungen Tufs', tagline: 'Liten, grønn og veldig sikker i sin sak.', body: 'round', height: 0.8, width: 1.05, skin: '#84cc16', outfit: '#78716c', accent: '#a3e635', hair: '#3f6212', hairStyle: 'spiky', hat: 'none', extras: ['bignose', 'trollears'], anim: 'hyper', eyeScale: 1.3 },
  { id: 'gubben', name: 'Gamle Grå', tagline: 'Husker da quiz het «spørrelek».', body: 'tall', height: 1.15, width: 0.95, skin: '#e9c4a5', outfit: '#3f3f46', accent: '#b91c1c', hair: '#e5e7eb', hairStyle: 'none', hat: 'tophat', extras: ['beard', 'monocle'], anim: 'sleepy', eyeScale: 0.9 },
  { id: 'sjur', name: 'Sjarmør-Sjur', tagline: 'Blunker til kameraet. Alltid.', body: 'bean', height: 1.1, width: 1, skin: '#c58c66', outfit: '#0f766e', accent: '#fbbf24', hair: '#1c1917', hairStyle: 'pompadour', hat: 'none', extras: ['bowtie'], anim: 'groovy', eyeScale: 1 },
  { id: 'pirka', name: 'Prinsesse Pirka', tagline: 'Krever rødt teppe til podiet.', body: 'pear', height: 0.95, width: 1, skin: '#fde2cf', outfit: '#f472b6', accent: '#fde047', hair: '#7c2d12', hairStyle: 'long', hat: 'crown', extras: ['freckles'], anim: 'bouncy', eyeScale: 1.15 },
  { id: 'pingvin', name: 'Pingvin-Per', tagline: 'Kom i feil kostyme. Ble værende.', body: 'round', height: 0.9, width: 1.1, skin: '#f8fafc', outfit: '#0f172a', accent: '#f59e0b', hair: '#0f172a', hairStyle: 'none', hat: 'beanie', extras: ['beak'], anim: 'wobbly', eyeScale: 1.1 },
];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/** Gir en fargevariant når flere spillere har valgt samme karakter. */
export function variantColor(hex: string, variant: number): string {
  if (variant <= 0) return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  // roter fargetone ved å bytte kanaler og justere lysstyrke
  for (let i = 0; i < variant; i++) {
    const t = r;
    r = g;
    g = b;
    b = t;
  }
  const shift = variant % 2 === 0 ? 20 : -20;
  const clamp = (v: number) => Math.max(0, Math.min(255, v + shift));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
