import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { CHARACTERS } from '@podiepanikk/shared';
import { prefersReducedMotion } from '../settings';
import { Character, type Emotion } from './Character';
import { GEO, mat } from './common';
import { hasWebGL } from './StudioLite';

/** Roterbar 3D-forhåndsvisning av en karakter i lobbyen. */
export default function CharacterPreview({ characterId, variant, emotion }: { characterId: string; variant: number; emotion: Emotion }) {
  const [ok] = useState(hasWebGL);
  if (!ok) return null;
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.6, 4.2], fov: 38 }}>
      <color attach="background" args={['#2a0b5c']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <pointLight position={[-3, 2, 2]} intensity={20} color="#ff4fa3" />
      <mesh geometry={GEO.cyl} material={mat('#3b1580', { metal: 0.5, rough: 0.3 })} position={[0, -0.08, 0]} scale={[1, 0.16, 1]} />
      <Character characterId={characterId} variant={variant} emotion={emotion} reduced={prefersReducedMotion()} />
      <OrbitControls enablePan={false} enableZoom={false} target={[0, 1.15, 0]} minPolarAngle={0.9} maxPolarAngle={1.75} autoRotate={!prefersReducedMotion()} autoRotateSpeed={1.2} />
    </Canvas>
  );
}

/** Forsidens energiske 3D-scene: dansende figurer og svevende buzzere. */
export function HomeScene() {
  const [ok] = useState(hasWebGL);
  if (!ok) return null;
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 2.2, 9], fov: 45 }}>
      <color attach="background" args={['#12052a']} />
      <fog attach="fog" args={['#12052a', 10, 24]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 6, 6]} intensity={1.4} />
      <pointLight position={[-5, 3, 2]} intensity={60} color="#ff4fa3" />
      <pointLight position={[5, 3, 2]} intensity={60} color="#2fe0ff" />
      <HomeCast />
      <FloatingBuzzers />
    </Canvas>
  );
}

function HomeCast() {
  const g = useRef<THREE.Group>(null);
  const reduced = prefersReducedMotion();
  useFrame(({ clock }) => {
    if (g.current && !reduced) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.2) * 0.25;
  });
  const cast = [CHARACTERS[3], CHARACTERS[1], CHARACTERS[5], CHARACTERS[8], CHARACTERS[11]];
  const emotions: Emotion[] = ['victory', 'happy', 'surprised', 'happy', 'victory'];
  return (
    <group ref={g} position={[0, -2.6, -1]}>
      {cast.map((c, i) => (
        <group key={c.id} position={[(i - 2) * 2.1, 0, -Math.abs(i - 2) * 0.8]} rotation={[0, -(i - 2) * 0.25, 0]}>
          <Character characterId={c.id} emotion={emotions[i]} seed={i * 3} reduced={reduced} />
        </group>
      ))}
    </group>
  );
}

function FloatingBuzzers() {
  const g = useRef<THREE.Group>(null);
  const colors = ['#ff3b4f', '#2f8cff', '#22c55e', '#ffcc00', '#ff3b4f', '#ff4fa3'];
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.children.forEach((b, i) => {
      b.position.y = 1.6 + Math.sin(t * 0.8 + i * 1.3) * 0.5 + (i % 2) * 1.2;
      b.rotation.x = 0.5 + Math.sin(t * 0.6 + i) * 0.3;
      b.rotation.z = Math.cos(t * 0.5 + i) * 0.3;
    });
  });
  return (
    <group ref={g}>
      {colors.map((c, i) => (
        <group key={i} position={[(i - 2.5) * 2.4, 2, -3 - (i % 3)]}>
          <mesh geometry={GEO.cyl} material={mat('#1f1f2e', { metal: 0.6, rough: 0.3 })} scale={[0.5, 0.18, 0.5]} />
          <mesh geometry={GEO.sphere} material={mat(c, { emissive: c, ei: 0.5, rough: 0.2 })} position={[0, 0.12, 0]} scale={[0.42, 0.22, 0.42]} />
        </group>
      ))}
    </group>
  );
}
