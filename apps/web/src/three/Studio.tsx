import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ANSWER_COLORS, ROUND_INFO, getCharacter, variantColor, type PublicPlayer, type PublicState } from '@podiepanikk/shared';
import { useRoom } from '../net/room';
import { prefersReducedMotion, useSettings, isSmallScreen } from '../settings';
import { Character } from './Character';
import { GEO, fitText, font, makeLabelTexture, mat } from './common';
import { emotionFor, overviewDistance, podiumSlots, type Slot } from './layout';
import { handleStageFx, resetStageFx, useStageFx } from './stageFx';
import { StudioLite, hasWebGL } from './StudioLite';

type Variant = 'tv' | 'mobile';
interface Ctx {
  st: PublicState;
  slots: Map<string, Slot>;
  variant: Variant;
  low: boolean;
  reduced: boolean;
}

/** Ytre komponent: velger 3D eller reservevisning og kvalitet. */
export function Studio({ variant }: { variant: Variant }) {
  const quality = useSettings((s) => s.quality);
  const [dpr, setDpr] = useState(() => (quality === 'low' || (quality === 'auto' && isSmallScreen()) ? 1 : Math.min(1.75, window.devicePixelRatio)));
  const [webgl] = useState(hasWebGL);
  const st = useRoom((s) => s.state);
  const fxBatch = useRoom((s) => s.fxBatch);
  useEffect(() => resetStageFx, []);
  useEffect(() => {
    if (fxBatch.events.length) handleStageFx(fxBatch.events);
  }, [fxBatch]);
  if (!st) return null;
  if (!webgl || quality === 'off') return <StudioLite state={st} />;
  const low = quality === 'low' || (quality === 'auto' && (isSmallScreen() || variant === 'mobile'));
  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: !low, powerPreference: 'high-performance', alpha: false }}
      camera={{ position: [0, 4, 13], fov: 45, near: 0.1, far: 120 }}
      frameloop="always"
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))} onIncline={() => setDpr((d) => Math.min(low ? 1.25 : 1.75, d + 0.25))} />
      <color attach="background" args={['#0d0322']} />
      <fog attach="fog" args={['#0d0322', 22, 50]} />
      <Scene st={st} variant={variant} low={low} />
    </Canvas>
  );
}

function Scene({ st, variant, low }: { st: PublicState; variant: Variant; low: boolean }) {
  const reduced = prefersReducedMotion();
  const players = st.players.filter((p) => !p.left);
  const slots = useMemo(() => {
    const s = podiumSlots(players.length);
    return new Map(players.map((p, i) => [p.id, s[i]]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map((p) => p.id).join()]);
  const ctx: Ctx = { st, slots, variant, low, reduced };
  const ceremony = st.phase === 'CEREMONY' || st.phase === 'GAME_OVER';
  return (
    <>
      <Lights ctx={ctx} />
      <StageFloor ctx={ctx} />
      <LedWall ctx={ctx} />
      <BigScreen st={st} />
      <Audience count={low ? 60 : 150} reduced={reduced} />
      {players.map((p) => (
        <PlayerSpot key={p.id} p={p} ctx={ctx} />
      ))}
      {ceremony && <PrizePodium />}
      <Bomb ctx={ctx} />
      <Projectiles ctx={ctx} />
      <Explosions ctx={ctx} />
      <BuzzLight ctx={ctx} />
      <Confetti active={ceremony} count={low ? 120 : 320} />
      <CameraRig ctx={ctx} />
    </>
  );
}

// ───────── posisjoner ─────────

const PRIZE: Record<number, [number, number, number]> = { 0: [0, 1.25, 3.2], 1: [-1.9, 0.85, 3.5], 2: [1.9, 0.55, 3.5] };

function charPos(ctx: Ctx, pid: string): THREE.Vector3 {
  const st = ctx.st;
  if (st.phase === 'CEREMONY' || st.phase === 'GAME_OVER') {
    const rank = st.ranking.indexOf(pid);
    if (rank >= 0 && rank < 3) return new THREE.Vector3(...PRIZE[rank]);
  }
  const s = ctx.slots.get(pid);
  if (!s) return new THREE.Vector3(0, 0, 0);
  const back = 0.55;
  return new THREE.Vector3(s.x - Math.sin(s.rotY) * back, s.y, s.z - Math.cos(s.rotY) * back);
}
const headPos = (ctx: Ctx, pid: string) => charPos(ctx, pid).add(new THREE.Vector3(0, 1.75, 0));

// ───────── lys ─────────

function Lights({ ctx }: { ctx: Ctx }) {
  const spotA = useRef<THREE.SpotLight>(null);
  const spotB = useRef<THREE.SpotLight>(null);
  const tA = useMemo(() => new THREE.Object3D(), []);
  const tB = useMemo(() => new THREE.Object3D(), []);
  const ambient = useRef<THREE.AmbientLight>(null);
  const phase = ctx.st.phase;
  const roundType = ctx.st.round?.type;
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const speed = ctx.reduced ? 0.15 : roundType === 'final' ? 1.4 : 0.6;
    tA.position.set(Math.sin(t * speed) * 5, 0, Math.cos(t * speed * 0.7) * 2);
    tB.position.set(Math.sin(t * speed + 2) * 5, 0, Math.cos(t * speed * 0.8 + 1) * 2);
    if (ambient.current) {
      // Finalen og bomben: dempet, dramatisk lys
      const target = roundType === 'final' || (roundType === 'bomb' && phase === 'QUESTION') ? 0.35 : 0.75;
      ambient.current.intensity = THREE.MathUtils.damp(ambient.current.intensity, target, 2, dt);
    }
  });
  return (
    <>
      <ambientLight ref={ambient} intensity={0.75} color="#b9a6ff" />
      <hemisphereLight args={['#c8b6ff', '#2a0b4d', 0.6]} />
      <directionalLight position={[2, 9, 10]} intensity={1.5} color="#fff3e0" />
      <primitive object={tA} />
      <primitive object={tB} />
      {!ctx.low && (
        <>
          <spotLight ref={spotA} position={[-7, 11, 4]} angle={0.35} penumbra={0.6} intensity={180} distance={30} color="#ff4fa3" target={tA} />
          <spotLight ref={spotB} position={[7, 11, 4]} angle={0.35} penumbra={0.6} intensity={180} distance={30} color="#2fe0ff" target={tB} />
        </>
      )}
      <pointLight position={[0, 3, 5]} intensity={ctx.low ? 25 : 12} distance={18} color="#ffd9a0" />
      <Beams ctx={ctx} />
    </>
  );
}

function Beams({ ctx }: { ctx: Ctx }) {
  const group = useRef<THREE.Group>(null);
  const beamMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );
  const colors = ['#ff4fa3', '#2fe0ff', '#ffcf3f', '#a855f7'];
  const mats = useMemo(() => colors.map((c) => Object.assign(beamMat.clone(), { color: new THREE.Color(c) })), [beamMat]);
  useFrame(({ clock }) => {
    if (!group.current || ctx.reduced) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((b, i) => {
      b.rotation.z = Math.sin(t * 0.7 + i * 1.7) * 0.35;
      b.rotation.x = Math.cos(t * 0.5 + i) * 0.15;
    });
  });
  return (
    <group ref={group}>
      {[-6, -2, 2, 6].map((x, i) => (
        <group key={x} position={[x, 11, -3]}>
          <mesh geometry={GEO.cone} material={mats[i]} position={[0, -5.5, 0]} scale={[1.6, 11, 1.6]} />
        </group>
      ))}
    </group>
  );
}

// ───────── scene, gulv og LED ─────────

function StageFloor({ ctx }: { ctx: Ctx }) {
  const rings = useRef<THREE.Group>(null);
  const ringMats = useMemo(() => ['#ff4fa3', '#2fe0ff', '#ffcf3f'].map((c) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: 1.5 })), []);
  useFrame(({ clock }) => {
    if (!rings.current) return;
    const t = clock.elapsedTime;
    rings.current.children.forEach((r, i) => {
      const m = (r as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.2 + Math.sin(t * 2 + i) * (ctx.reduced ? 0.1 : 0.8);
    });
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -1]} material={mat('#1b0a3d', { rough: 0.25, metal: 0.4 })} scale={[16, 16, 1]}>
        <circleGeometry args={[1, 64]} />
      </mesh>
      <group ref={rings}>
        {[4, 7.5, 11].map((r, i) => (
          <mesh key={r} geometry={GEO.torus} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1]} scale={[r, r, 0.6]} material={ringMats[i]} />
        ))}
      </group>
      {/* trapp ned mot publikum */}
      <mesh geometry={GEO.box} material={mat('#2a0f5c', { rough: 0.6 })} position={[0, -0.5, 8.5]} scale={[30, 1, 6]} />
      {/* bakvegg */}
      <mesh geometry={GEO.box} material={mat('#160532', { rough: 0.9 })} position={[0, 6, -9]} scale={[40, 14, 0.5]} />
      {/* bakre podienivå for 9–12 spillere */}
      {ctx.st.players.length > 8 && <mesh geometry={GEO.box} material={mat('#24104e', { rough: 0.4, metal: 0.3 })} position={[0, 0.5, -3.6]} scale={[16, 1, 3.2]} />}
    </group>
  );
}

function LedWall({ ctx }: { ctx: Ctx }) {
  const cols = 10;
  const rows = 12;
  const panels = [-8.2, 8.2];
  const count = cols * rows * panels.length;
  const ref = useRef<THREE.InstancedMesh>(null);
  const color = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    const m = ref.current!;
    const o = new THREE.Object3D();
    let i = 0;
    for (const px of panels)
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) {
          o.position.set(px + (c - cols / 2) * 0.42, 0.6 + r * 0.42, -8.6 + Math.abs(c - cols / 2) * 0.05);
          o.scale.set(0.36, 0.36, 0.08);
          o.updateMatrix();
          m.setMatrixAt(i++, o.matrix);
        }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  const last = useRef(0);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    if (t - last.current < (ctx.low ? 0.1 : 0.04)) return;
    last.current = t;
    const st = ctx.st;
    const bomb = st.round?.type === 'bomb' && st.phase === 'QUESTION';
    const final = st.round?.type === 'final';
    const reveal = st.phase === 'REVEAL';
    let i = 0;
    for (let p = 0; p < panels.length; p++)
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) {
          const wave = Math.sin(t * 3 - r * 0.5 + c * 0.3 + p);
          if (bomb) {
            const pulse = 0.5 + 0.5 * Math.sin(t * (6 + (st.bomb?.intensity ?? 0) * 18));
            color.setRGB(0.9 * pulse + 0.1, 0.05, 0.05);
          } else if (final) color.setHSL(0.78 + 0.08 * wave, 0.9, 0.35 + 0.2 * Math.max(0, Math.sin(t * 8 + r)));
          else if (reveal) color.setHSL(0.33, 0.85, 0.3 + 0.25 * Math.max(0, wave));
          else color.setHSL((t * 0.05 + c * 0.03 + r * 0.02 + p * 0.5) % 1, 0.85, 0.35 + 0.18 * wave);
          m.setColorAt(i++, color);
        }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[GEO.box, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ───────── storskjerm ─────────

function BigScreen({ st }: { st: PublicState }) {
  const { tex, ctx } = useMemo(() => makeLabelTexture(1024, 576), []);
  const key = `${st.phase}|${st.round?.index}|${st.question?.id}|${st.reveal?.correctIndex}|${st.winnerId}|${st.ranking.join()}|${st.code}|${st.paused}`;
  useEffect(() => {
    const W = 1024;
    const H = 576;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3b0d82');
    g.addColorStop(1, '#13042e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.03 + (i % 3) * 0.015})`;
      ctx.beginPath();
      ctx.moveTo(W / 2, H * 1.1);
      ctx.arc(W / 2, H * 1.1, W, -Math.PI + (i * Math.PI) / 18, -Math.PI + ((i + 0.5) * Math.PI) / 18);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const big = (text: string, y: number, size: number, color = '#ffcf3f') => {
      fitText(ctx, text, W - 80, size);
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#2a0600';
      ctx.strokeText(text, W / 2, y);
      ctx.fillStyle = color;
      ctx.fillText(text, W / 2, y);
    };
    const small = (text: string, y: number, size = 40, color = '#ffffff') => {
      fitText(ctx, text, W - 80, size);
      ctx.fillStyle = color;
      ctx.fillText(text, W / 2, y);
    };
    if (st.paused) big('PAUSE', H / 2, 150);
    else if (st.phase === 'LOBBY') {
      big('PODIEPANIKK!', H / 2 - 50, 130);
      small(`Romkode: ${st.code}`, H / 2 + 80, 64, '#2fe0ff');
    } else if (st.phase === 'INTRO') big('VELKOMMEN!', H / 2, 140);
    else if (st.round && (st.phase === 'ROUND_INTRO' || st.phase === 'SCOREBOARD')) {
      if (st.phase === 'SCOREBOARD') {
        big('STILLINGEN', 110, 90);
        st.ranking.slice(0, 3).forEach((id, i) => {
          const p = st.players.find((x) => x.id === id);
          if (p) small(`${i + 1}. ${p.name} – ${p.score}`, 250 + i * 90, 62, i === 0 ? '#ffcf3f' : '#ffffff');
        });
      } else {
        small(`RUNDE ${st.round.index + 1} AV ${st.round.total}`, 140, 44, '#2fe0ff');
        big(ROUND_INFO[st.round.type].name.toUpperCase(), H / 2, 110);
        small(ROUND_INFO[st.round.type].short, H / 2 + 120, 48);
      }
    } else if (st.question && st.round) {
      small(st.round.name.toUpperCase(), 70, 40, '#2fe0ff');
      big(st.question.total ? `SPØRSMÅL ${st.question.number}/${st.question.total}` : `SPØRSMÅL ${st.question.number}`, H / 2 - 30, 100);
      if (st.reveal) {
        const c = ANSWER_COLORS[st.reveal.correctIndex];
        ctx.fillStyle = c.hex;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2 + 140, 70, 0, Math.PI * 2);
        ctx.fill();
        big('ABCD'[st.reveal.correctIndex], H / 2 + 142, 90, '#ffffff');
      }
    } else if (st.winnerId) {
      const w = st.players.find((p) => p.id === st.winnerId);
      small('VINNEREN ER', 150, 56, '#2fe0ff');
      big((w?.name ?? '').toUpperCase(), H / 2 + 20, 140);
    } else if (st.phase === 'ACTION_RESULT') big(st.actions[0]?.kind === 'explode' ? 'KABOOM!' : st.actions[0]?.kind === 'pie' ? 'SPLAT!' : st.actions[0]?.kind === 'steal' ? 'TYVERI!' : '!!!', H / 2, 160);
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <group position={[0, 4.6, -8.3]}>
      <mesh geometry={GEO.box} material={mat('#0a0a14', { metal: 0.7, rough: 0.3 })} scale={[8.6, 4.9, 0.3]} position={[0, 0, -0.1]} />
      <mesh geometry={GEO.box} material={mat('#ffcf3f', { emissive: '#ffb300', ei: 0.8 })} scale={[8.9, 0.12, 0.35]} position={[0, 2.5, 0]} />
      <mesh geometry={GEO.box} material={mat('#ffcf3f', { emissive: '#ffb300', ei: 0.8 })} scale={[8.9, 0.12, 0.35]} position={[0, -2.5, 0]} />
      <mesh position={[0, 0, 0.06]} scale={[8.2, 4.6, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ───────── publikum ─────────

const Audience = memo(function Audience({ count, reduced }: { count: number; reduced: boolean }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const seats = useMemo(() => {
    const out: { x: number; z: number; y: number; ph: number; s: number }[] = [];
    const perRow = Math.ceil(count / 4);
    for (let r = 0; r < 4; r++)
      for (let i = 0; i < perRow; i++) {
        out.push({ x: (i - perRow / 2) * (22 / perRow) + (r % 2) * 0.25, z: 7.4 + r * 1.1, y: -1 + r * 0.35, ph: Math.random() * 6, s: 0.85 + Math.random() * 0.3 });
      }
    return out.slice(0, count);
  }, [count]);
  useEffect(() => {
    const c = new THREE.Color();
    seats.forEach((_, i) => {
      c.setHSL(0.72 + Math.random() * 0.12, 0.4, 0.1 + Math.random() * 0.08);
      bodies.current!.setColorAt(i, c);
      heads.current!.setColorAt(i, c);
    });
  }, [seats]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }, dt) => {
    const fx = useStageFx.getState();
    if (fx.excitement > 0.01) useStageFx.setState({ excitement: Math.max(0, fx.excitement - dt * 0.35) });
    const ex = reduced ? 0.1 : 0.15 + fx.excitement;
    const t = clock.elapsedTime;
    seats.forEach((s, i) => {
      const jump = Math.max(0, Math.sin(t * (4 + ex * 6) + s.ph)) * 0.25 * ex;
      o.position.set(s.x, s.y + 0.55 + jump, s.z);
      o.scale.set(0.32 * s.s, 0.4 * s.s, 0.28 * s.s);
      o.updateMatrix();
      bodies.current!.setMatrixAt(i, o.matrix);
      o.position.y += 0.62 * s.s;
      o.scale.setScalar(0.22 * s.s);
      o.updateMatrix();
      heads.current!.setMatrixAt(i, o.matrix);
    });
    bodies.current!.instanceMatrix.needsUpdate = true;
    heads.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={bodies} args={[GEO.capsule, undefined, seats.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[GEO.sphereLo, undefined, seats.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </>
  );
});

// ───────── spillere og podier ─────────

function PlayerSpot({ p, ctx }: { p: PublicPlayer; ctx: Ctx }) {
  const st = ctx.st;
  const slot = ctx.slots.get(p.id);
  const fx = {
    hit: useStageFx((s) => s.hitUntil[p.id]),
    thr: useStageFx((s) => s.throwUntil[p.id]),
    pied: useStageFx((s) => s.piedUntil[p.id]),
    soot: useStageFx((s) => s.sootyUntil[p.id]),
  };
  const now = performance.now();
  const emotion = emotionFor(st, p.id, { hitUntil: fx.hit, throwUntil: fx.thr }, now);
  const group = useRef<THREE.Group>(null);
  const target = charPos(ctx, p.id);
  const rot = slot?.rotY ?? 0;
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.x = THREE.MathUtils.damp(g.position.x, target.x, 3, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, target.y, 3, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, target.z, 3, dt);
  });
  if (!slot) return null;
  const color = variantColor(getCharacter(p.characterId).outfit, p.variant);
  return (
    <>
      <Podium slot={slot} p={p} st={st} color={color} />
      <group ref={group} position={target.toArray()} rotation={[0, st.phase === 'CEREMONY' || st.phase === 'GAME_OVER' ? 0 : rot, 0]}>
        <Character
          characterId={p.characterId}
          variant={p.variant}
          emotion={emotion}
          pied={!!fx.pied && now < fx.pied}
          sooty={!!fx.soot && now < fx.soot}
          reduced={ctx.reduced}
          seed={p.id.charCodeAt(0) + p.id.charCodeAt(1)}
        />
      </group>
    </>
  );
}

function Podium({ slot, p, st, color }: { slot: Slot; p: PublicPlayer; st: PublicState; color: string }) {
  const { tex, ctx } = useMemo(() => makeLabelTexture(512, 200), []);
  const light = useRef<THREE.MeshStandardMaterial>(null);
  const final = st.round?.type === 'final' && st.final;
  const label = `${p.name}|${p.score}|${p.connected}|${final ? p.finalSteps : ''}|${p.lastDelta}|${st.phase}`;
  useEffect(() => {
    ctx.clearRect(0, 0, 512, 200);
    ctx.fillStyle = '#0d0322';
    ctx.fillRect(0, 0, 512, 200);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, p.name, 470, 56);
    ctx.fillStyle = p.connected || p.isBot ? '#ffffff' : '#9ca3af';
    ctx.fillText(p.name, 256, 62);
    ctx.font = font(78);
    ctx.fillStyle = '#ffcf3f';
    ctx.fillText(final ? `${p.finalSteps}/${st.final!.goal} steg` : String(p.score), 256, 140);
    if (!p.connected && !p.isBot) {
      ctx.font = font(26);
      ctx.fillStyle = '#ff5d6c';
      ctx.fillText('frakoblet', 256, 186);
    }
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, color]);
  const answered = p.hasAnswered;
  const res = st.reveal?.results.find((r) => r.playerId === p.id);
  const glow = st.phase === 'REVEAL' && res ? (res.correct ? '#3ee07a' : '#ff3b4f') : answered ? '#ffffff' : st.buzz?.activePlayerId === p.id ? '#ffcf3f' : color;
  useFrame(({ clock }) => {
    if (!light.current) return;
    light.current.emissive.set(glow);
    light.current.emissiveIntensity = answered || res ? 2.2 : 0.7 + Math.sin(clock.elapsedTime * 2 + slot.x) * 0.2;
  });
  return (
    <group position={[slot.x, slot.y, slot.z]} rotation={[0, slot.rotY, 0]}>
      <mesh geometry={GEO.cyl} material={mat('#1d0b40', { metal: 0.6, rough: 0.25 })} position={[0, 0.5, 0]} scale={[0.72, 1, 0.55]} />
      <mesh geometry={GEO.box} material={mat(color, { rough: 0.35, metal: 0.2 })} position={[0, 0.5, 0.35]} scale={[1.2, 0.9, 0.3]} />
      <mesh position={[0, 1.02, 0]} scale={[0.74, 0.06, 0.57]} geometry={GEO.cyl}>
        <meshStandardMaterial ref={light} color="#111" emissive={color} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.52, 0.51]} scale={[1.1, 0.43, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PrizePodium() {
  return (
    <group>
      {[
        [0, 1.25, 3.2, '#ffcf3f', '1'],
        [-1.9, 0.85, 3.5, '#cbd5e1', '2'],
        [1.9, 0.55, 3.5, '#d4884a', '3'],
      ].map(([x, h, z, c]) => (
        <mesh key={String(x)} geometry={GEO.box} material={mat(c as string, { metal: 0.5, rough: 0.25, emissive: c as string, ei: 0.15 })} position={[x as number, (h as number) / 2, z as number]} scale={[1.6, h as number, 1.4]} />
      ))}
    </group>
  );
}

// ───────── effekter ─────────

function Bomb({ ctx }: { ctx: Ctx }) {
  const b = ctx.st.bomb;
  const group = useRef<THREE.Group>(null);
  const shell = useRef<THREE.MeshStandardMaterial>(null);
  const spark = useRef<THREE.Mesh>(null);
  const visible = !!b && !b.exploded && ctx.st.round?.type === 'bomb' && ctx.st.phase !== 'ROUND_INTRO' && ctx.st.phase !== 'SCOREBOARD';
  const target = b ? headPos(ctx, b.holderId).add(new THREE.Vector3(0.55, 0.45, 0.35)) : new THREE.Vector3();
  const first = useRef(true);
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g || !b) return;
    if (first.current) {
      g.position.copy(target);
      first.current = false;
    }
    const d = g.position.distanceTo(target);
    g.position.x = THREE.MathUtils.damp(g.position.x, target.x, 4, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, target.z, 4, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, target.y + Math.min(3, d * 0.6), 4, dt);
    const t = clock.elapsedTime;
    const f = 3 + b.intensity * 16;
    if (shell.current) shell.current.emissiveIntensity = Math.sin(t * f) > 0 ? 1.6 + b.intensity : 0.1;
    if (!ctx.reduced) g.rotation.z = Math.sin(t * 9) * 0.08 * (1 + b.intensity * 2);
    if (spark.current) spark.current.scale.setScalar(0.07 + Math.random() * 0.06);
  });
  if (!visible) return null;
  return (
    <group ref={group}>
      <mesh geometry={GEO.sphere} scale={0.32}>
        <meshStandardMaterial ref={shell} color="#16161d" emissive="#ff1f1f" emissiveIntensity={0.2} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh geometry={GEO.cyl} material={mat('#555')} position={[0, 0.34, 0]} scale={[0.08, 0.1, 0.08]} />
      <mesh geometry={GEO.cyl} material={mat('#c8a165')} position={[0.05, 0.47, 0]} rotation={[0, 0, -0.4]} scale={[0.02, 0.2, 0.02]} />
      <mesh ref={spark} geometry={GEO.sphereLo} position={[0.1, 0.58, 0]}>
        <meshBasicMaterial color="#ffd36b" toneMapped={false} />
      </mesh>
      <pointLight position={[0.1, 0.6, 0]} color="#ff9b3d" intensity={6} distance={3} />
    </group>
  );
}

function Projectiles({ ctx }: { ctx: Ctx }) {
  const list = useStageFx((s) => s.projectiles);
  return (
    <>
      {list.map((p) => (
        <Projectile key={p.id} p={p} ctx={ctx} />
      ))}
    </>
  );
}

function Projectile({ p, ctx }: { p: { kind: string; from: string; to: string; start: number; dur: number }; ctx: Ctx }) {
  const ref = useRef<THREE.Group>(null);
  const a = useMemo(() => headPos(ctx, p.from).add(new THREE.Vector3(0, 0.2, 0.3)), [p.from]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => headPos(ctx, p.to).add(new THREE.Vector3(0, -0.05, 0.45)), [p.to]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const k = Math.min(1, Math.max(0, (performance.now() - p.start) / p.dur));
    g.visible = k > 0 && k < 1;
    g.position.lerpVectors(a, b, k);
    g.position.y += Math.sin(k * Math.PI) * (p.kind === 'pie' ? 2.6 : 1.6);
    g.rotation.x = k * (p.kind === 'pie' ? 7 : 14);
    g.rotation.y = k * 4;
  });
  if (p.kind === 'pie') {
    return (
      <group ref={ref} visible={false}>
        <mesh geometry={GEO.cyl} material={mat('#d9a066')} scale={[0.3, 0.1, 0.3]} />
        <mesh geometry={GEO.sphere} material={mat('#fffaf0', { rough: 0.9 })} position={[0, 0.07, 0]} scale={[0.27, 0.1, 0.27]} />
        <mesh geometry={GEO.sphereLo} material={mat('#e11d48')} position={[0, 0.17, 0]} scale={0.05} />
      </group>
    );
  }
  return (
    <group ref={ref} visible={false}>
      <mesh geometry={GEO.cyl} rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.03, 0.14]}>
        <meshStandardMaterial color="#ffcf3f" metalness={0.9} roughness={0.2} emissive="#ffb300" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function Explosions({ ctx }: { ctx: Ctx }) {
  const list = useStageFx((s) => s.explosions);
  return (
    <>
      {list.map((e) => (
        <Explosion key={e.id} pos={headPos(ctx, e.playerId)} start={e.start} />
      ))}
    </>
  );
}

function Explosion({ pos, start }: { pos: THREE.Vector3; start: number }) {
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, toneMapped: false }), []);
  const smokeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2b2b2b', transparent: true }), []);
  useFrame(() => {
    const k = (performance.now() - start) / 1000;
    if (core.current) {
      core.current.scale.setScalar(0.2 + Math.min(1, k * 3) * 1.6);
      coreMat.opacity = Math.max(0, 1 - k * 1.6);
      coreMat.color.setHSL(0.09 - k * 0.05, 1, 0.6 - k * 0.2);
    }
    if (ring.current) {
      ring.current.scale.setScalar(0.5 + k * 2.4);
      smokeMat.opacity = Math.max(0, 0.7 - k * 0.35);
    }
  });
  return (
    <group position={pos}>
      <mesh ref={core} geometry={GEO.sphereLo} material={coreMat} />
      <mesh ref={ring} geometry={GEO.sphereLo} material={smokeMat} />
      <pointLight color="#ff8a00" intensity={40} distance={8} />
    </group>
  );
}

function BuzzLight({ ctx }: { ctx: Ctx }) {
  const id = ctx.st.buzz?.activePlayerId;
  const show = !!id && (ctx.st.phase === 'BUZZ_ANSWER' || ctx.st.phase === 'REVEAL');
  const m = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  if (!show) return null;
  const p = charPos(ctx, id!);
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={GEO.cone} material={m} position={[0, 4.5, 0]} scale={[1.3, 9, 1.3]} />
      <spotLight position={[0, 8, 1]} intensity={120} angle={0.3} penumbra={0.5} distance={14} color="#fff1c1" />
    </group>
  );
}

function Confetti({ active, count }: { active: boolean; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const burst = useStageFx((s) => s.confettiBurst);
  const parts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        r: new THREE.Euler(),
        w: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        alive: false,
      })),
    [count],
  );
  const spawn = (pt: (typeof parts)[number]) => {
    pt.p.set((Math.random() - 0.5) * 12, 8 + Math.random() * 4, (Math.random() - 0.5) * 6 + 2);
    pt.v.set((Math.random() - 0.5) * 1.5, -1 - Math.random() * 1.5, (Math.random() - 0.5) * 1.5);
    pt.alive = true;
  };
  useEffect(() => {
    if (burst > 0) parts.forEach(spawn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst]);
  useEffect(() => {
    const c = new THREE.Color();
    const palette = ['#ff3b4f', '#2f8cff', '#22c55e', '#ffcc00', '#ff4fa3', '#2fe0ff'];
    for (let i = 0; i < count; i++) ref.current!.setColorAt(i, c.set(palette[i % palette.length]));
  }, [count]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }, dt) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    parts.forEach((pt, i) => {
      if (!pt.alive && active && Math.random() < 0.02) spawn(pt);
      if (pt.alive) {
        pt.p.addScaledVector(pt.v, dt);
        pt.p.x += Math.sin(t * 2 + i) * dt * 0.6;
        if (pt.p.y < -0.5) pt.alive = false;
      }
      o.position.copy(pt.alive ? pt.p : new THREE.Vector3(0, -50, 0));
      o.rotation.set(t * pt.w.x, t * pt.w.y, t * pt.w.z);
      o.scale.set(0.12, 0.07, 0.01);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[GEO.box, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

// ───────── kamera ─────────

function CameraRig({ ctx }: { ctx: Ctx }) {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.5, 0));
  const st = ctx.st;
  const n = Math.max(2, st.players.filter((p) => !p.left).length);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const D = overviewDistance(n);
    let pos = new THREE.Vector3(0, 3.8, D);
    let at = new THREE.Vector3(0, 1.4, -0.8);
    const focus = (pid: string | null | undefined, dist = 3.6) => {
      if (!pid) return;
      const h = headPos(ctx, pid);
      const s = ctx.slots.get(pid);
      const r = s?.rotY ?? 0;
      pos = new THREE.Vector3(h.x + Math.sin(r) * dist, h.y + 0.4, h.z + Math.cos(r) * dist);
      at = h.clone().add(new THREE.Vector3(0, -0.15, 0));
    };
    const type = st.round?.type;
    switch (st.phase) {
      case 'LOBBY':
        pos = new THREE.Vector3(Math.sin(t * 0.15) * 4, 4.2, D + 1);
        break;
      case 'INTRO':
        pos = new THREE.Vector3(Math.sin(t * 0.3) * 8, 6 - Math.min(2, t * 0.1), D + 3);
        break;
      case 'ROUND_INTRO':
      case 'SCOREBOARD':
        pos = new THREE.Vector3(0, 4.2, 4);
        at = new THREE.Vector3(0, 4.5, -8.3);
        break;
      case 'BUZZ_ANSWER':
        focus(st.buzz?.activePlayerId, 3.2);
        break;
      case 'QUESTION':
        if (type === 'bomb') focus(st.bomb?.holderId, 5.5);
        else if (type === 'final') pos = new THREE.Vector3(Math.sin(t * 0.2) * 2, 3.2, D - 1.5);
        break;
      case 'REVEAL':
        if (type === 'fastest' && st.buzz?.activePlayerId) focus(st.buzz.activePlayerId, 3.6);
        else if (type === 'bomb') focus(st.bomb?.holderId, 4.5);
        break;
      case 'TARGETING':
        pos = new THREE.Vector3(0, 5, D + 1);
        break;
      case 'ACTION_RESULT': {
        const a = st.actions[0];
        if (a?.kind === 'explode') focus(a.toId, 4.5);
        else if (a?.kind === 'bombPass') focus(a.toId, 5);
        else pos = new THREE.Vector3(0, 5.5, D + 1.5);
        break;
      }
      case 'CEREMONY':
      case 'GAME_OVER':
        pos = new THREE.Vector3(Math.sin(t * 0.25) * 1.5, 3.2, 9.5);
        at = new THREE.Vector3(0, 2.3, 3.2);
        break;
    }
    // TV: når spørsmålspanelet dekker nedre del av skjermen, løft scenen opp i bildet.
    if (ctx.variant === 'tv' && ['QUESTION', 'REVEAL', 'TARGETING', 'ACTION_RESULT'].includes(st.phase) && at.y < 2) {
      const lift = new THREE.Vector3(0, -1.6, 0);
      at.add(lift);
      pos.y += 0.6;
    }
    // Stående mobilformat: trekk kameraet bakover så alle podiene får plass.
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 1.3) {
      const f = Math.min(2.3, 1.3 / aspect);
      pos = at.clone().add(pos.clone().sub(at).multiplyScalar(f));
    }
    if (!ctx.reduced && st.phase !== 'BUZZ_ANSWER') pos.x += Math.sin(t * 0.4) * 0.25;
    const k = ctx.reduced ? 1.2 : 2.2;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pos.x, k, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, pos.y, k, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, pos.z, k, dt);
    look.current.x = THREE.MathUtils.damp(look.current.x, at.x, k * 1.2, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, at.y, k * 1.2, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, at.z, k * 1.2, dt);
    camera.lookAt(look.current);
  });
  return null;
}

export { ANSWER_COLORS };
