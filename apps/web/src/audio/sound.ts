import { useSettings } from '../settings';

/*
 * Originalt lydbilde: alle lydeffekter, publikumslyder og musikk syntetiseres
 * i sanntid med Web Audio API. Ingen lydfiler, ingen lisensproblemer.
 */

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let crowdBus: GainNode;
let noiseBuf: AudioBuffer;

function init(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  crowdBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);
  crowdBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applySettings();
  useSettings.subscribe(applySettings);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
  return ctx;
}

function applySettings() {
  if (!ctx) return;
  const s = useSettings.getState();
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(s.volume, t, 0.05);
  musicBus.gain.setTargetAtTime(s.music ? 0.32 : 0, t, 0.1);
  sfxBus.gain.setTargetAtTime(s.sfx ? 0.9 : 0, t, 0.05);
  crowdBus.gain.setTargetAtTime(s.crowd && s.sfx ? 0.55 : 0, t, 0.05);
}

export function unlockAudio(): void {
  const c = init();
  if (c && c.state === 'suspended') void c.resume();
}

const ready = () => !!ctx && ctx.state === 'running';

// ── byggeklosser ──

function tone(o: { f: number; type?: OscillatorType; t?: number; dur: number; vol?: number; to?: number; bus?: GainNode; attack?: number; detune?: number; filter?: number }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.t ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.detune) osc.detune.value = o.detune;
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const vol = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(o.bus ?? sfxBus);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

function noise(o: { t?: number; dur: number; vol?: number; type?: BiquadFilterType; f?: number; fTo?: number; q?: number; bus?: GainNode; attack?: number }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.t ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = o.type ?? 'bandpass';
  filt.frequency.setValueAtTime(o.f ?? 1000, t0);
  if (o.fTo) filt.frequency.exponentialRampToValueAtTime(o.fTo, t0 + o.dur);
  filt.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t0 + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(filt).connect(g).connect(o.bus ?? sfxBus);
  src.start(t0, Math.random());
  src.stop(t0 + o.dur + 0.05);
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// ── lydeffekter ──

export type Sfx =
  | 'click'
  | 'buzz'
  | 'lock'
  | 'correct'
  | 'wrong'
  | 'timeout'
  | 'tick'
  | 'bombTick'
  | 'explode'
  | 'whoosh'
  | 'splat'
  | 'steal'
  | 'jingle'
  | 'fanfare'
  | 'drumroll'
  | 'whooshUp'
  | 'step'
  | 'join';

export function sfx(name: Sfx): void {
  if (!ready()) return;
  switch (name) {
    case 'click':
      tone({ f: 900, type: 'triangle', dur: 0.06, vol: 0.15 });
      break;
    case 'join':
      tone({ f: midi(72), dur: 0.12, vol: 0.2, type: 'triangle' });
      tone({ f: midi(79), t: 0.08, dur: 0.18, vol: 0.2, type: 'triangle' });
      break;
    case 'buzz':
      // Kraftig, original «BRÆÆP» – to skjeve sagtenner med vibrato.
      tone({ f: 155, type: 'sawtooth', dur: 0.55, vol: 0.35, filter: 1800 });
      tone({ f: 162, type: 'square', dur: 0.55, vol: 0.18, filter: 1400 });
      tone({ f: 310, type: 'sawtooth', dur: 0.4, vol: 0.12, filter: 2400 });
      break;
    case 'lock':
      tone({ f: 660, type: 'square', dur: 0.08, vol: 0.12, filter: 3000 });
      tone({ f: 990, type: 'square', t: 0.06, dur: 0.1, vol: 0.12, filter: 3000 });
      break;
    case 'correct':
      [72, 76, 79, 84].forEach((n, i) => tone({ f: midi(n), type: 'triangle', t: i * 0.08, dur: 0.35, vol: 0.25 }));
      tone({ f: midi(96), type: 'sine', t: 0.32, dur: 0.5, vol: 0.12 });
      break;
    case 'wrong':
      tone({ f: 330, to: 300, type: 'square', dur: 0.32, vol: 0.18, filter: 1200 });
      tone({ f: 262, to: 180, type: 'square', t: 0.3, dur: 0.6, vol: 0.2, filter: 1000 });
      break;
    case 'timeout':
      tone({ f: 440, to: 110, type: 'sawtooth', dur: 0.7, vol: 0.18, filter: 900 });
      break;
    case 'tick':
      tone({ f: 1800, type: 'square', dur: 0.03, vol: 0.08, filter: 5000 });
      break;
    case 'bombTick':
      tone({ f: 1100, type: 'square', dur: 0.04, vol: 0.14, filter: 4000 });
      noise({ dur: 0.04, vol: 0.08, f: 4000, q: 3 });
      break;
    case 'explode':
      noise({ dur: 1.6, vol: 0.9, type: 'lowpass', f: 3000, fTo: 60, attack: 0.005 });
      tone({ f: 90, to: 30, type: 'sine', dur: 1.2, vol: 0.8 });
      noise({ t: 0.05, dur: 0.6, vol: 0.3, f: 2500, q: 0.6 });
      break;
    case 'whoosh':
      noise({ dur: 0.7, vol: 0.35, f: 400, fTo: 3000, q: 2, attack: 0.25 });
      break;
    case 'whooshUp':
      noise({ dur: 0.9, vol: 0.25, f: 300, fTo: 6000, q: 3, attack: 0.6 });
      break;
    case 'splat':
      noise({ dur: 0.35, vol: 0.7, type: 'lowpass', f: 1400, fTo: 200, attack: 0.003 });
      tone({ f: 220, to: 60, type: 'sine', dur: 0.25, vol: 0.4 });
      break;
    case 'steal':
      [0, 1, 2, 3, 4].forEach((i) => tone({ f: midi(84 + (i % 2) * 7), type: 'square', t: i * 0.06, dur: 0.12, vol: 0.1, filter: 6000 }));
      tone({ f: midi(60), to: midi(48), type: 'sawtooth', t: 0.3, dur: 0.4, vol: 0.12, filter: 1500 });
      break;
    case 'jingle':
      [67, 72, 76, 79, 76, 79, 84].forEach((n, i) => tone({ f: midi(n), type: 'triangle', t: i * 0.11, dur: 0.22, vol: 0.22 }));
      [48, 55, 60].forEach((n) => tone({ f: midi(n), type: 'sawtooth', t: 0.66, dur: 0.9, vol: 0.12, filter: 1600 }));
      noise({ t: 0.66, dur: 0.5, vol: 0.2, f: 8000, q: 0.7 });
      break;
    case 'fanfare': {
      const seq: [number, number, number][] = [
        [67, 0, 0.18],
        [67, 0.2, 0.12],
        [67, 0.34, 0.12],
        [72, 0.48, 0.6],
        [76, 1.1, 0.25],
        [79, 1.35, 1.2],
      ];
      for (const [n, t, d] of seq) {
        tone({ f: midi(n), type: 'sawtooth', t, dur: d + 0.1, vol: 0.16, filter: 2600 });
        tone({ f: midi(n - 12), type: 'square', t, dur: d + 0.1, vol: 0.07, filter: 1500 });
      }
      [60, 64, 67, 72].forEach((n) => tone({ f: midi(n), type: 'sawtooth', t: 1.35, dur: 1.4, vol: 0.08, filter: 2200 }));
      break;
    }
    case 'drumroll':
      for (let i = 0; i < 30; i++) noise({ t: i * 0.05, dur: 0.06, vol: 0.12 + i * 0.008, f: 2200, q: 0.8 });
      noise({ t: 1.5, dur: 0.8, vol: 0.4, f: 6000, q: 0.5 });
      break;
    case 'step':
      tone({ f: midi(79), type: 'triangle', dur: 0.12, vol: 0.2 });
      tone({ f: midi(86), type: 'triangle', t: 0.06, dur: 0.15, vol: 0.18 });
      break;
  }
}

// ── publikum ──

export type CrowdSound = 'applause' | 'cheer' | 'laugh' | 'ooh' | 'aww';

export function crowd(kind: CrowdSound, intensity = 1): void {
  if (!ready()) return;
  const bus = crowdBus;
  if (kind === 'applause' || kind === 'cheer') {
    const len = kind === 'cheer' ? 3.2 : 2.2;
    const claps = Math.round(110 * intensity * len);
    for (let i = 0; i < claps; i++) {
      const t = Math.random() * len * (0.6 + Math.random() * 0.4);
      noise({ t, dur: 0.035, vol: 0.05 + Math.random() * 0.06, f: 900 + Math.random() * 2200, q: 1.2, bus, attack: 0.002 });
    }
    if (kind === 'cheer') {
      // «Wooo!» – flere stemmer med formantfilter.
      for (let v = 0; v < 7; v++) {
        const base = 220 + Math.random() * 260;
        tone({ f: base, to: base * 1.5, type: 'sawtooth', t: Math.random() * 0.3, dur: 1.4 + Math.random() * 0.6, vol: 0.035, filter: 1200, bus, attack: 0.2 });
      }
      noise({ dur: 2.5, vol: 0.12, f: 1200, q: 0.6, bus, attack: 0.3 });
    }
  } else if (kind === 'laugh') {
    // «Ha-ha-ha» – pulserende formantstemmer i ulike tonehøyder.
    for (let v = 0; v < 6; v++) {
      const base = 170 + Math.random() * 180;
      const start = Math.random() * 0.4;
      const n = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const t = start + i * (0.15 + Math.random() * 0.04);
        tone({ f: base * (1 - i * 0.03), type: 'sawtooth', t, dur: 0.11, vol: 0.05, filter: 900 + Math.random() * 500, bus, attack: 0.015 });
      }
    }
    noise({ dur: 1.6, vol: 0.04, f: 900, q: 1, bus, attack: 0.2 });
  } else if (kind === 'ooh' || kind === 'aww') {
    for (let v = 0; v < 6; v++) {
      const base = 180 + Math.random() * 160;
      tone({ f: base, to: kind === 'ooh' ? base * 1.25 : base * 0.7, type: 'sawtooth', t: Math.random() * 0.15, dur: 1.2, vol: 0.04, filter: kind === 'ooh' ? 700 : 600, bus, attack: 0.15 });
    }
  }
}

// ── musikk: enkel prosedyrisk sekvenser med originale progresjoner ──

export type Track = 'none' | 'lobby' | 'intro' | 'game' | 'tension' | 'final' | 'victory';

interface TrackDef {
  bpm: number;
  chords: number[][]; // MIDI-noter per takt
  bass: 'pump' | 'walk' | 'pulse';
  arp: number; // noter per slag
  drums: 'light' | 'groove' | 'drive' | 'none';
  lead?: number[];
  wave: OscillatorType;
}

const TRACKS: Record<Exclude<Track, 'none'>, TrackDef> = {
  lobby: { bpm: 104, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]], bass: 'walk', arp: 2, drums: 'light', wave: 'triangle' },
  intro: { bpm: 128, chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], bass: 'pump', arp: 4, drums: 'drive', lead: [72, 76, 79, 84, 79, 76, 77, 79], wave: 'square' },
  game: { bpm: 118, chords: [[62, 65, 69], [60, 64, 67], [58, 62, 65], [60, 64, 67]], bass: 'pump', arp: 2, drums: 'groove', wave: 'triangle' },
  tension: { bpm: 132, chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [52, 56, 59]], bass: 'pulse', arp: 4, drums: 'drive', wave: 'sawtooth' },
  final: { bpm: 144, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], bass: 'pulse', arp: 4, drums: 'drive', lead: [69, 72, 76, 74, 72, 71, 72, 76], wave: 'sawtooth' },
  victory: { bpm: 122, chords: [[60, 64, 67, 72], [65, 69, 72, 77], [67, 71, 74, 79], [65, 69, 72, 77]], bass: 'pump', arp: 4, drums: 'groove', lead: [79, 79, 81, 79, 84, 83, 79, 76], wave: 'square' },
};

let current: Track = 'none';
let schedTimer: number | null = null;
let nextBeatTime = 0;
let beatIndex = 0;
let tempoBoost = 1;

export function setTempoBoost(b: number): void {
  tempoBoost = Math.max(1, Math.min(1.5, b));
}

export function playMusic(track: Track): void {
  if (track === current) return;
  current = track;
  if (schedTimer != null) {
    clearInterval(schedTimer);
    schedTimer = null;
  }
  if (track === 'none' || !init()) return;
  nextBeatTime = ctx!.currentTime + 0.1;
  beatIndex = 0;
  schedTimer = window.setInterval(scheduler, 50);
}

function scheduler(): void {
  if (!ctx || current === 'none' || ctx.state !== 'running') return;
  const def = TRACKS[current];
  const beat = 60 / (def.bpm * tempoBoost);
  while (nextBeatTime < ctx.currentTime + 0.25) {
    scheduleBeat(def, beatIndex, nextBeatTime, beat);
    nextBeatTime += beat;
    beatIndex++;
  }
}

function scheduleBeat(def: TrackDef, i: number, t: number, beat: number): void {
  if (!ctx) return;
  const bar = Math.floor(i / 4) % def.chords.length;
  const chord = def.chords[bar];
  const inBar = i % 4;
  const rel = (dt: number) => t + dt - ctx!.currentTime;
  const bus = musicBus;
  // bass
  const root = chord[0] - 24;
  const bassNote = def.bass === 'walk' ? root + [0, 7, 12, 7][inBar] : root + (def.bass === 'pump' && inBar % 2 ? 12 : 0);
  if (def.bass === 'pulse') {
    tone({ f: midi(root), type: 'sawtooth', t: rel(0), dur: beat * 0.45, vol: 0.18, filter: 500, bus });
    tone({ f: midi(root), type: 'sawtooth', t: rel(beat / 2), dur: beat * 0.45, vol: 0.14, filter: 500, bus });
  } else tone({ f: midi(bassNote), type: 'triangle', t: rel(0), dur: beat * 0.9, vol: 0.28, bus });
  // arpeggio
  for (let k = 0; k < def.arp; k++) {
    const n = chord[(inBar * def.arp + k) % chord.length] + (k % 2 ? 12 : 0);
    tone({ f: midi(n), type: def.wave, t: rel((k * beat) / def.arp), dur: (beat / def.arp) * 0.8, vol: 0.06, filter: 2800, bus });
  }
  // pad på første slag
  if (inBar === 0) chord.forEach((n) => tone({ f: midi(n), type: 'sine', t: rel(0), dur: beat * 3.8, vol: 0.05, bus, attack: 0.2 }));
  // lead
  if (def.lead && Math.floor(i / 16) % 2 === 1) {
    const n = def.lead[i % def.lead.length];
    tone({ f: midi(n), type: 'square', t: rel(0), dur: beat * 0.7, vol: 0.05, filter: 3500, bus });
  }
  // trommer
  if (def.drums !== 'none') {
    if (inBar === 0 || (def.drums !== 'light' && inBar === 2)) tone({ f: 120, to: 45, type: 'sine', t: rel(0), dur: 0.25, vol: 0.5, bus });
    if (inBar === 1 || inBar === 3) noise({ t: rel(0), dur: 0.14, vol: def.drums === 'light' ? 0.08 : 0.16, f: 1800, q: 0.7, bus });
    const hats = def.drums === 'drive' ? 4 : 2;
    for (let h = 0; h < hats; h++) noise({ t: rel((h * beat) / hats), dur: 0.03, vol: 0.04, f: 9000, q: 1, bus });
  }
}
