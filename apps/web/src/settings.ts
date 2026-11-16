import { create } from 'zustand';

export type Quality = 'auto' | 'high' | 'low' | 'off';

export interface UserSettings {
  music: boolean;
  sfx: boolean;
  crowd: boolean;
  volume: number; // 0–1
  controllerSound: boolean; // lyd på mobilkontrolleren (TV-en har hovedlyden)
  haptics: boolean;
  quality: Quality;
  reducedMotion: 'system' | 'on' | 'off';
  lastName: string;
  lastCharacter: string;
}

const DEFAULTS: UserSettings = {
  music: true,
  sfx: true,
  crowd: true,
  volume: 0.7,
  controllerSound: false,
  haptics: true,
  quality: 'auto',
  reducedMotion: 'system',
  lastName: '',
  lastCharacter: '',
};

const KEY = 'pp:settings:v1';

function load(): UserSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<UserSettings & { set: (p: Partial<UserSettings>) => void }>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p);
    try {
      const { set: _s, ...rest } = { ...get(), ...p };
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* privat modus */
    }
  },
}));

export function prefersReducedMotion(): boolean {
  const s = useSettings.getState().reducedMotion;
  if (s !== 'system') return s === 'on';
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
export const isSmallScreen = () => typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;

export function vibrate(pattern: number | number[]): void {
  if (!useSettings.getState().haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ikke støttet (f.eks. iOS) */
  }
}
