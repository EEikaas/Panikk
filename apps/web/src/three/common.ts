import * as THREE from 'three';

// Delte geometrier og materialer – holder minnebruk og draw-kall nede.
export const GEO = {
  sphere: new THREE.SphereGeometry(1, 24, 16),
  sphereLo: new THREE.SphereGeometry(1, 12, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cone: new THREE.ConeGeometry(1, 1, 20),
  capsule: new THREE.CapsuleGeometry(1, 1, 6, 14),
  torusArc: new THREE.TorusGeometry(1, 0.2, 8, 20, Math.PI),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 48),
  plane: new THREE.PlaneGeometry(1, 1),
};

const cache = new Map<string, THREE.Material>();

export function mat(color: string, o: { emissive?: string; ei?: number; rough?: number; metal?: number; opacity?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.emissive ?? ''}|${o.ei ?? 0}|${o.rough ?? 0.5}|${o.metal ?? 0}|${o.opacity ?? 1}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.5,
      metalness: o.metal ?? 0.02,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.ei ?? 0,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

/** Tegner tekst på et lerret og returnerer en tekstur (ingen eksterne fonter). */
export function makeLabelTexture(w = 512, h = 192): { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, ctx, canvas };
}

export const FONT = "900 {s}px ui-rounded, 'SF Pro Rounded', Nunito, 'Segoe UI', system-ui, sans-serif";
export const font = (size: number) => FONT.replace('{s}', String(size));

export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number): number {
  let s = size;
  ctx.font = font(s);
  while (ctx.measureText(text).width > maxW && s > 12) {
    s -= 2;
    ctx.font = font(s);
  }
  return s;
}
