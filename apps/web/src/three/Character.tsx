import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getCharacter, variantColor, type CharacterDef } from '@podiepanikk/shared';
import { GEO, mat } from './common';

export type Emotion = 'idle' | 'happy' | 'sad' | 'surprised' | 'nervous' | 'victory' | 'throw' | 'clap' | 'hit';

interface Props {
  characterId: string;
  variant?: number;
  emotion?: Emotion;
  pied?: boolean;
  sooty?: boolean;
  reduced?: boolean;
  seed?: number;
}

const damp = (a: number, b: number, k: number, dt: number) => THREE.MathUtils.damp(a, b, k, dt);

/** Prosedyregenerert, stilisert 3D-karakter med uttrykksfulle animasjoner. */
export function Character({ characterId, variant = 0, emotion = 'idle', pied = false, sooty = false, reduced = false, seed = 0 }: Props) {
  const def = getCharacter(characterId);
  const dims = useMemo(() => bodyDims(def), [def]);
  const outfit = variantColor(def.outfit, variant);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const smile = useRef<THREE.Mesh>(null);
  const oMouth = useRef<THREE.Mesh>(null);
  const hair = useRef<THREE.Group>(null);
  const emotionSince = useRef({ e: emotion, t: 0 });

  const speed = { bouncy: 1.3, wobbly: 1, stiff: 0.7, groovy: 1.1, sleepy: 0.55, hyper: 1.9 }[def.anim];

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + seed * 1.37;
    if (emotionSince.current.e !== emotion) emotionSince.current = { e: emotion, t: state.clock.elapsedTime };
    const since = state.clock.elapsedTime - emotionSince.current.t;
    const k = 8;
    const amp = reduced ? 0.25 : 1;
    let bodyY = Math.sin(t * 2 * speed) * 0.02 * amp;
    let bodyRotZ = 0;
    let bodyRotY = 0;
    let headX = Math.sin(t * 0.7) * 0.05;
    let headZ = 0;
    let headY = Math.sin(t * 0.5 + 1) * 0.15 * amp;
    let aL = 0.18;
    let aR = -0.18;
    let aLx = 0;
    let aRx = 0;
    let brow = 0;
    let browTilt = 0;
    let mouthOpen = false;
    let smileFlip = Math.PI; // ∪
    let shiver = 0;

    switch (def.anim) {
      case 'groovy':
        bodyRotZ = Math.sin(t * 3) * 0.08 * amp;
        headZ = Math.sin(t * 3 + 0.5) * 0.1 * amp;
        break;
      case 'wobbly':
        bodyRotZ = Math.sin(t * 1.6) * 0.06 * amp;
        break;
      case 'hyper':
        bodyY = Math.abs(Math.sin(t * 5)) * 0.04 * amp;
        break;
      case 'bouncy':
        bodyY = Math.abs(Math.sin(t * 2.6)) * 0.05 * amp;
        break;
      case 'stiff':
        headY = Math.round(Math.sin(t * 0.6) * 2) * 0.12;
        break;
      case 'sleepy':
        headX = 0.12 + Math.sin(t * 0.4) * 0.06;
        break;
    }

    switch (emotion) {
      case 'happy':
        bodyY = Math.abs(Math.sin(t * 9)) * 0.16 * amp;
        aL = 2.5 + Math.sin(t * 14) * 0.25;
        aR = -2.5 - Math.sin(t * 14) * 0.25;
        brow = 0.04;
        headX = -0.12;
        break;
      case 'victory':
        bodyY = Math.abs(Math.sin(t * 6)) * 0.3 * amp;
        bodyRotY = reduced ? 0 : Math.sin(t * 1.5) * 0.6;
        aL = 2.7 + Math.sin(t * 10) * 0.3;
        aR = -2.7 - Math.sin(t * 10 + 1) * 0.3;
        brow = 0.05;
        headX = -0.2;
        mouthOpen = Math.sin(t * 4) > 0.3;
        break;
      case 'sad':
        bodyY = -0.06;
        headX = 0.38;
        aL = 0.05;
        aR = -0.05;
        brow = -0.01;
        browTilt = 0.35;
        smileFlip = 0;
        break;
      case 'surprised':
        bodyY = since < 0.3 ? 0.12 : 0.02;
        headX = -0.22;
        aL = 1.25;
        aR = -1.25;
        brow = 0.07;
        mouthOpen = true;
        break;
      case 'nervous':
        shiver = 0.025 * amp;
        aL = 0.5;
        aR = -0.5;
        aLx = -0.6;
        aRx = -0.6;
        browTilt = 0.3;
        brow = 0.03;
        mouthOpen = Math.sin(t * 7) > 0.6;
        smileFlip = 0;
        break;
      case 'throw': {
        const p = Math.min(1, since / 0.6);
        // Sving bakover over hodet, så kast fremover.
        aRx = p < 0.5 ? 2.6 * (p / 0.5) : 2.6 - 3.6 * ((p - 0.5) / 0.5);
        aR = -0.3;
        brow = 0.03;
        break;
      }
      case 'clap':
        aLx = -1.3;
        aRx = -1.3;
        aL = 0.5 + Math.abs(Math.sin(t * 12)) * 0.4;
        aR = -0.5 - Math.abs(Math.sin(t * 12)) * 0.4;
        break;
      case 'hit':
        headY = since < 1 ? Math.sin(since * 25) * 0.4 * (1 - since) : 0;
        aL = 1;
        aR = -1;
        mouthOpen = true;
        browTilt = 0.4;
        smileFlip = 0;
        break;
    }

    if (body.current) {
      body.current.position.y = damp(body.current.position.y, bodyY, k * 1.5, dt);
      body.current.rotation.z = damp(body.current.rotation.z, bodyRotZ, k, dt);
      body.current.rotation.y = damp(body.current.rotation.y, bodyRotY, 4, dt);
      body.current.position.x = shiver ? (Math.random() - 0.5) * shiver : 0;
    }
    if (head.current) {
      head.current.rotation.x = damp(head.current.rotation.x, headX, k, dt);
      head.current.rotation.y = damp(head.current.rotation.y, headY, k, dt);
      head.current.rotation.z = damp(head.current.rotation.z, headZ, k, dt);
    }
    // Positiv verdi = armen løftes utover/opp (fortegnet speiles for venstre side).
    if (armL.current) {
      armL.current.rotation.z = damp(armL.current.rotation.z, -aL, k, dt);
      armL.current.rotation.x = damp(armL.current.rotation.x, aLx, k, dt);
    }
    if (armR.current) {
      armR.current.rotation.z = damp(armR.current.rotation.z, -aR, k, dt);
      armR.current.rotation.x = damp(armR.current.rotation.x, aRx, emotion === 'throw' ? 18 : k, dt);
    }
    if (eyes.current) {
      const blink = (t * 0.37 + seed) % 4 < 0.08 ? 0.1 : 1;
      const wide = emotion === 'surprised' || emotion === 'hit' ? 1.3 : 1;
      eyes.current.scale.set(wide, blink * wide, wide);
    }
    if (browL.current && browR.current) {
      browL.current.position.y = damp(browL.current.position.y, 0.19 + brow, k, dt);
      browR.current.position.y = browL.current.position.y;
      browL.current.rotation.z = damp(browL.current.rotation.z, -browTilt, k, dt);
      browR.current.rotation.z = -browL.current.rotation.z;
    }
    if (smile.current && oMouth.current) {
      smile.current.visible = !mouthOpen;
      oMouth.current.visible = mouthOpen;
      smile.current.rotation.z = smileFlip;
      smile.current.position.y = smileFlip === 0 ? -0.2 : -0.12;
    }
    if (hair.current) hair.current.scale.y = damp(hair.current.scale.y, sooty ? 1.5 : 1, 6, dt);
  });

  const skin = sooty ? '#4b4b4b' : def.skin;
  const R = def.body === 'box' ? 0.36 : 0.4;

  return (
    <group ref={root}>
      {/* bein */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.capsule} material={mat(def.body === 'box' ? '#475569' : '#2b2b3a')} position={[s * 0.17, 0.28, 0]} scale={[0.11, 0.22, 0.11]} />
      ))}
      <group ref={body}>
        <Torso def={def} outfit={outfit} dims={dims} />
        {/* armer */}
        {[
          [-1, armL],
          [1, armR],
        ].map(([s, ref]) => (
          <group key={s as number} ref={ref as React.RefObject<THREE.Group>} position={[(s as number) * (dims.halfW + 0.04), dims.top - 0.14, 0]}>
            <mesh geometry={GEO.capsule} material={mat(outfit)} position={[0, -0.24, 0]} scale={[0.09, 0.26, 0.09]} />
            <mesh geometry={GEO.sphereLo} material={mat(def.body === 'box' ? def.accent : skin)} position={[0, -0.5, 0]} scale={0.11} />
          </group>
        ))}
        {def.extras.includes('bowtie') && (
          <group position={[0, dims.top - 0.04, dims.frontZ + 0.02]}>
            <mesh geometry={GEO.cone} material={mat(def.accent)} position={[-0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.07, 0.12, 0.05]} />
            <mesh geometry={GEO.cone} material={mat(def.accent)} position={[0.08, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.07, 0.12, 0.05]} />
          </group>
        )}
        {def.extras.includes('scarf') && <mesh geometry={GEO.torus} material={mat(def.accent)} position={[0, dims.top - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[dims.halfW * 0.75, dims.halfW * 0.75, 2.2]} />}
        {/* hode */}
        <group ref={head} position={[0, dims.top + R * 0.85, 0]}>
          {def.body === 'box' ? (
            <mesh geometry={GEO.box} material={mat(skin, { metal: 0.4, rough: 0.35 })} scale={[R * 1.9, R * 1.7, R * 1.6]} />
          ) : (
            <mesh geometry={GEO.sphere} material={mat(skin)} scale={R} />
          )}
          {def.extras.includes('trollears') &&
            [-1, 1].map((s) => <mesh key={s} geometry={GEO.cone} material={mat(skin)} position={[s * R * 1.05, 0.05, 0]} rotation={[0, 0, -s * 1.2]} scale={[0.1, 0.32, 0.06]} />)}
          {/* øyne */}
          <group ref={eyes} position={[0, 0.06, 0]}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.15, 0, R * 0.86]}>
                <mesh geometry={GEO.sphereLo} material={mat('#ffffff', { rough: 0.2 })} scale={0.1 * def.eyeScale} />
                <mesh geometry={GEO.sphereLo} material={mat('#111111', { rough: 0.1 })} position={[0, -0.005, 0.07 * def.eyeScale]} scale={0.05 * def.eyeScale} />
              </group>
            ))}
          </group>
          <mesh ref={browL} geometry={GEO.box} material={mat(def.hair === '#f8fafc' ? '#334155' : def.hair)} position={[-0.15, 0.19, R * 0.9]} scale={[0.14, 0.03, 0.03]} />
          <mesh ref={browR} geometry={GEO.box} material={mat(def.hair === '#f8fafc' ? '#334155' : def.hair)} position={[0.15, 0.19, R * 0.9]} scale={[0.14, 0.03, 0.03]} />
          {/* munn */}
          {def.extras.includes('beak') ? (
            <mesh geometry={GEO.cone} material={mat(def.accent)} position={[0, -0.1, R * 0.95]} rotation={[Math.PI / 2, 0, 0]} scale={[0.09, 0.2, 0.07]} />
          ) : (
            <>
              <mesh ref={smile} geometry={GEO.torusArc} material={mat('#3a1206')} position={[0, -0.12, R * 0.9]} rotation={[0, 0, Math.PI]} scale={[0.11, 0.11, 0.11]} />
              <mesh ref={oMouth} geometry={GEO.sphereLo} material={mat('#3a1206')} position={[0, -0.15, R * 0.9]} scale={[0.07, 0.09, 0.04]} visible={false} />
            </>
          )}
          {def.extras.includes('bignose') && <mesh geometry={GEO.sphereLo} material={mat(skin)} position={[0, -0.02, R * 1.0]} scale={[0.1, 0.09, 0.1]} />}
          {def.extras.includes('glasses') &&
            [-1, 1].map((s) => <mesh key={s} geometry={GEO.torus} material={mat('#1f2937')} position={[s * 0.15, 0.06, R * 0.95]} scale={[0.12, 0.12, 0.5]} />)}
          {def.extras.includes('monocle') && <mesh geometry={GEO.torus} material={mat(def.accent, { metal: 0.8, rough: 0.2 })} position={[0.15, 0.06, R * 0.96]} scale={[0.13, 0.13, 0.5]} />}
          {def.extras.includes('sunglasses') && <mesh geometry={GEO.box} material={mat('#0a0a0a', { rough: 0.1, metal: 0.5 })} position={[0, 0.07, R * 0.93]} scale={[0.5, 0.12, 0.05]} />}
          {def.extras.includes('mustache') && <mesh geometry={GEO.capsule} material={mat('#6b7280')} position={[0, -0.06, R * 0.95]} rotation={[0, 0, Math.PI / 2]} scale={[0.04, 0.16, 0.04]} />}
          {def.extras.includes('beard') && <mesh geometry={GEO.sphere} material={mat(def.hair)} position={[0, -0.24, R * 0.45]} scale={[0.3, 0.26, 0.24]} />}
          {def.extras.includes('freckles') &&
            [-1, 1].map((s) => <mesh key={s} geometry={GEO.sphereLo} material={mat('#c2410c')} position={[s * 0.2, -0.06, R * 0.92]} scale={0.018} />)}
          {def.extras.includes('antenna') && (
            <group position={[0, R * 0.85, 0]}>
              <mesh geometry={GEO.cyl} material={mat('#64748b')} position={[0, 0.12, 0]} scale={[0.015, 0.25, 0.015]} />
              <mesh geometry={GEO.sphereLo} material={mat(def.accent, { emissive: def.accent, ei: 1.5 })} position={[0, 0.27, 0]} scale={0.05} />
            </group>
          )}
          <group ref={hair}>
            <Hair def={def} R={R} />
          </group>
          <Hat def={def} R={R} />
          {pied && <PieFace R={R} />}
        </group>
      </group>
    </group>
  );
}

function bodyDims(def: CharacterDef) {
  const W = def.width;
  const H = def.height;
  const base = 0.46;
  switch (def.body) {
    case 'box':
      return { halfW: 0.4 * W, top: base + 0.82 * H, frontZ: 0.28 };
    case 'pear':
      return { halfW: 0.42 * W, top: base + 0.9 * H, frontZ: 0.4 };
    case 'tall':
      return { halfW: 0.28 * W, top: base + 1.15 * H, frontZ: 0.28 };
    case 'round':
      return { halfW: 0.48 * W, top: base + 0.88 * H, frontZ: 0.45 };
    default:
      return { halfW: 0.36 * W, top: base + 0.95 * H, frontZ: 0.36 };
  }
}

function Torso({ def, outfit, dims }: { def: CharacterDef; outfit: string; dims: ReturnType<typeof bodyDims> }) {
  const W = def.width;
  const H = def.height;
  const base = 0.46;
  const m = mat(outfit, { rough: 0.45 });
  switch (def.body) {
    case 'box':
      return (
        <group>
          <mesh geometry={GEO.box} material={mat(outfit, { metal: 0.5, rough: 0.35 })} position={[0, base + 0.41 * H, 0]} scale={[0.8 * W, 0.82 * H, 0.55]} />
          <mesh geometry={GEO.box} material={mat(def.accent, { emissive: def.accent, ei: 0.8 })} position={[0, base + 0.5 * H, 0.28]} scale={[0.3, 0.12, 0.02]} />
        </group>
      );
    case 'pear':
      return <mesh geometry={GEO.sphere} material={m} position={[0, base + 0.42 * H, 0]} scale={[0.5 * W, 0.52 * H, 0.42]} />;
    case 'tall':
      return <mesh geometry={GEO.capsule} material={m} position={[0, base + 0.57 * H, 0]} scale={[0.28 * W, 0.6 * H, 0.26]} />;
    case 'round':
      return (
        <group>
          <mesh geometry={GEO.sphere} material={m} position={[0, base + 0.44 * H, 0]} scale={[0.52 * W, 0.48 * H, 0.47]} />
          {def.id === 'pingvin' && <mesh geometry={GEO.sphere} material={mat('#f8fafc')} position={[0, base + 0.4 * H, 0.16]} scale={[0.36 * W, 0.38 * H, 0.33]} />}
        </group>
      );
    default:
      return <mesh geometry={GEO.capsule} material={m} position={[0, base + 0.47 * H, 0]} scale={[0.36 * W, 0.46 * H, 0.32]} />;
  }
}

function Hair({ def, R }: { def: CharacterDef; R: number }) {
  const m = mat(def.hair, { rough: 0.8 });
  switch (def.hairStyle) {
    case 'afro':
      return <mesh geometry={GEO.sphere} material={m} position={[0, R * 0.45, -R * 0.15]} scale={R * 1.15} />;
    case 'curly':
      return (
        <>
          {[-0.5, -0.2, 0.15, 0.45].map((x, i) => (
            <mesh key={i} geometry={GEO.sphereLo} material={m} position={[x * R, R * 0.8, -R * 0.1]} scale={R * 0.32} />
          ))}
        </>
      );
    case 'spiky':
      return (
        <>
          {[-0.5, -0.17, 0.17, 0.5].map((x, i) => (
            <mesh key={i} geometry={GEO.cone} material={m} position={[x * R, R * 0.95, 0]} rotation={[0, 0, -x * 0.8]} scale={[R * 0.22, R * 0.6, R * 0.22]} />
          ))}
        </>
      );
    case 'mohawk':
      return <mesh geometry={GEO.box} material={m} position={[0, R * 1.05, -R * 0.1]} scale={[R * 0.18, R * 0.7, R * 1.4]} />;
    case 'bun':
      return (
        <>
          <mesh geometry={GEO.sphere} material={m} position={[0, R * 0.3, -R * 0.12]} scale={[R * 1.03, R * 0.85, R * 1]} />
          <mesh geometry={GEO.sphereLo} material={m} position={[0, R * 1.05, -R * 0.2]} scale={R * 0.38} />
        </>
      );
    case 'pompadour':
      return <mesh geometry={GEO.sphere} material={m} position={[0, R * 0.85, R * 0.2]} rotation={[0.5, 0, 0]} scale={[R * 0.8, R * 0.42, R * 0.7]} />;
    case 'long':
      return (
        <>
          <mesh geometry={GEO.sphere} material={m} position={[0, R * 0.25, -R * 0.15]} scale={[R * 1.06, R * 0.9, R * 1]} />
          <mesh geometry={GEO.box} material={m} position={[0, -R * 0.45, -R * 0.55]} scale={[R * 1.9, R * 1.4, R * 0.4]} />
        </>
      );
    default:
      return null;
  }
}

function Hat({ def, R }: { def: CharacterDef; R: number }) {
  const acc = mat(def.accent, { rough: 0.4 });
  switch (def.hat) {
    case 'captain':
      return (
        <group position={[0, R * 0.8, 0]}>
          <mesh geometry={GEO.cyl} material={mat('#111827')} scale={[R * 0.95, R * 0.35, R * 0.95]} position={[0, R * 0.15, 0]} />
          <mesh geometry={GEO.cyl} material={mat('#111827')} scale={[R * 1.15, 0.03, R * 1.15]} position={[0, 0, R * 0.15]} />
          <mesh geometry={GEO.sphereLo} material={acc} scale={0.06} position={[0, R * 0.2, R * 0.9]} />
        </group>
      );
    case 'chef':
      return (
        <group position={[0, R * 0.85, 0]}>
          <mesh geometry={GEO.cyl} material={mat('#ffffff')} scale={[R * 0.75, R * 0.6, R * 0.75]} position={[0, R * 0.25, 0]} />
          <mesh geometry={GEO.sphere} material={mat('#ffffff')} scale={[R * 0.95, R * 0.55, R * 0.95]} position={[0, R * 0.75, 0]} />
        </group>
      );
    case 'crown':
      return (
        <group position={[0, R * 0.92, 0]}>
          <mesh geometry={GEO.cyl} material={mat(def.accent, { metal: 0.8, rough: 0.2 })} scale={[R * 0.55, R * 0.25, R * 0.55]} />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return <mesh key={i} geometry={GEO.cone} material={mat(def.accent, { metal: 0.8, rough: 0.2 })} position={[Math.sin(a) * R * 0.5, R * 0.25, Math.cos(a) * R * 0.5]} scale={[0.06, 0.15, 0.06]} />;
          })}
        </group>
      );
    case 'tophat':
      return (
        <group position={[0, R * 0.85, 0]}>
          <mesh geometry={GEO.cyl} material={mat('#111111')} scale={[R * 1.1, 0.03, R * 1.1]} />
          <mesh geometry={GEO.cyl} material={mat('#111111')} scale={[R * 0.6, R * 1.0, R * 0.6]} position={[0, R * 0.5, 0]} />
          <mesh geometry={GEO.cyl} material={acc} scale={[R * 0.62, R * 0.15, R * 0.62]} position={[0, R * 0.12, 0]} />
        </group>
      );
    case 'viking':
      return (
        <group position={[0, R * 0.25, 0]}>
          <mesh geometry={GEO.sphere} material={mat(def.accent, { metal: 0.6, rough: 0.3 })} scale={[R * 1.05, R * 0.85, R * 1.05]} position={[0, R * 0.2, 0]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={GEO.cone} material={mat('#fff8e1')} position={[s * R * 1.0, R * 0.75, 0]} rotation={[0, 0, -s * 0.7]} scale={[0.08, 0.35, 0.08]} />
          ))}
        </group>
      );
    case 'cap':
      return (
        <group position={[0, R * 0.55, 0]}>
          <mesh geometry={GEO.sphere} material={acc} scale={[R * 1.02, R * 0.6, R * 1.02]} position={[0, R * 0.15, 0]} />
          <mesh geometry={GEO.cyl} material={acc} scale={[R * 0.6, 0.025, R * 0.5]} position={[0, R * 0.05, R * 0.9]} />
        </group>
      );
    case 'beanie':
      return (
        <group position={[0, R * 0.45, 0]}>
          <mesh geometry={GEO.sphere} material={acc} scale={[R * 1.03, R * 0.75, R * 1.03]} position={[0, R * 0.12, 0]} />
          <mesh geometry={GEO.sphereLo} material={mat('#ffffff')} scale={R * 0.25} position={[0, R * 0.9, 0]} />
        </group>
      );
    case 'astro':
      return <mesh geometry={GEO.sphere} material={mat('#bfe9ff', { opacity: 0.25, rough: 0.05, metal: 0.1 })} scale={R * 1.35} position={[0, 0, 0.02]} />;
    default:
      return null;
  }
}

function PieFace({ R }: { R: number }) {
  const cream = mat('#fffaf0', { rough: 0.9 });
  return (
    <group position={[0, 0, R * 0.8]}>
      <mesh geometry={GEO.sphereLo} material={cream} position={[0, 0.02, 0.05]} scale={[R * 0.75, R * 0.6, R * 0.25]} />
      <mesh geometry={GEO.sphereLo} material={cream} position={[-0.16, -0.18, 0.02]} scale={[0.1, 0.18, 0.08]} />
      <mesh geometry={GEO.sphereLo} material={cream} position={[0.18, -0.2, 0.02]} scale={[0.08, 0.15, 0.07]} />
      <mesh geometry={GEO.sphereLo} material={mat('#e11d48', { rough: 0.2 })} position={[0.05, 0.16, 0.12]} scale={0.06} />
    </group>
  );
}
