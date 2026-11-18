import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { withGraphicsPreset, resolveGraphicsRuntime } from '../../game/graphicsSettings';
import type { GraphicsPreset } from '../../game/graphicsSettings';
import { createHeroState, heroAnimation, stepHero } from './controller';
import type { HeroInput } from './controller';
import { loadHeroAssets, LOD_TRIANGLES, SKINS, RIG_VARIANTS } from './heroAssets';
import type { DemoAnimation, DemoKit, HeroAssets, SkinId, RigVariant } from './heroAssets';
import { TrainingYard } from './TrainingYard';
import './playground.css';

interface DemoOptions { skin: SkinId; lod: 0 | 1 | 2; quality: Exclude<GraphicsPreset, 'custom'>; normals: boolean; shadows: boolean; rig: RigVariant; kit: DemoKit; previewAnimation: 'gameplay' | DemoAnimation; paused: boolean; phase: number }
interface DemoView { ready: boolean; position: number[]; speedMeters: number; grounded: boolean; animation: DemoAnimation; animationSource: 'mixamo' | 'prototype'; rig: RigVariant; kit: DemoKit; phase: number; lod: number; skin: SkinId; triangles: number; weaponTriangles: number; shots: number; flashVisible: boolean; bones: number; time: number; geometries: number; textures: number; missionMounted: false }
interface DemoApi { inspect(): DemoView | null; configure(settings: Partial<DemoOptions>): void; reset(): void; pose(): number[]; bindPose(): number[]; skeleton(): Array<{ name: string; matrix: number[] }>; inspectWeapon(): null | { muzzle: number[]; primary: number[]; support: number[]; handL: number[]; matrix: number[]; parent: string } }
declare global { interface Window { __infantryDemo?: DemoApi } }
interface InputStore { keys: Set<string>; stick: { x: number; z: number }; crouch: boolean; jump: boolean; fire: boolean; reset: boolean; inspect: boolean }
const DEFAULT: DemoOptions = { skin: 'original', lod: 2, quality: 'balanced', normals: true, shadows: true, rig: 'rigify', kit: 'unarmed', previewAnimation: 'gameplay', paused: false, phase: 0 };
const PREVIEW_ANIMATIONS = [
  ['gameplay', 'Игровое управление'], ['idle', 'Idle · ожидание'], ['walk', 'Walk · ходьба'], ['run', 'Run · бег'],
  ['crouch', 'Присед · Mixamo'], ['crouchWalk', 'Шаг в приседе · Mixamo'], ['jump', 'Прыжок · Mixamo'],
  ['kneel', 'На одном колене · Mixamo'], ['fire', 'Выстрел · V‑Pulse'],
] as const;

function World({ assets, options, input, view }: { assets: HeroAssets; options: DemoOptions; input: React.RefObject<InputStore>; view: React.RefObject<DemoView | null> }) {
  const { camera, gl } = useThree(), controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const sunlight = useRef<THREE.DirectionalLight>(null);
  const hero = useRef(createHeroState()), forward = useRef(new THREE.Vector3()), right = useRef(new THREE.Vector3());
  const active = useRef<{ lod: number; name: DemoAnimation; action: THREE.AnimationAction | null }>({ lod: -1, name: 'idle', action: null });
  const previewPhase = useRef(0);
  const shots = useRef(0);
  const flashRemaining = useRef(0);
  const runtime = resolveGraphicsRuntime(withGraphicsPreset(options.quality), devicePixelRatio, false);
  useEffect(() => { gl.setPixelRatio(runtime.dpr); }, [gl, runtime.dpr]);
  useEffect(() => { assets.setSkin(options.skin); }, [assets, options.skin]);
  useEffect(() => { assets.setNormals(options.normals); }, [assets, options.normals]);
  useEffect(() => { previewPhase.current = options.phase; }, [options.phase]);
  useEffect(() => {
    assets.models.forEach(m => m.mixer.stopAllAction());
    active.current = { lod: -1, name: 'idle', action: null };
    flashRemaining.current = 0;
    input.current.fire = false;
  }, [assets, input, options.previewAnimation]);
  useEffect(() => { sunlight.current?.shadow.camera.updateProjectionMatrix(); }, []);
  useEffect(() => {
    view.current = { ready: true, position: [0, 0, 0], speedMeters: 0, grounded: true, animation: 'idle', animationSource: assets.manifest.clips.find(c => c.name === 'idle')?.source ?? 'prototype', lod: options.lod, skin: options.skin,
      rig: assets.variant, kit: assets.kit, phase: previewPhase.current, triangles: LOD_TRIANGLES[options.lod], weaponTriangles: assets.models[options.lod].weapon?.triangles ?? 0,
      bones: assets.models[0].mesh.skeleton.bones.length, time: 0, shots: shots.current, flashVisible: false, geometries: 0, textures: 0, missionMounted: false };
    active.current = { lod: -1, name: 'idle', action: null };
    return () => { view.current = null; assets.models.forEach(m => m.mixer.stopAllAction()); };
  }, [assets, view]);
  useFrame((_, dt) => {
    if (document.visibilityState === 'hidden') return;
    const state = hero.current, source = input.current;
    if (source.reset) {
      Object.assign(state, createHeroState()); source.reset = false; source.jump = false; source.fire = false; source.crouch = false; source.keys.clear();
      active.current.action?.stop(); active.current.action = null; flashRemaining.current = 0;
      assets.root.position.set(0, 0, 0); camera.position.set(0, .7, -1.2); controls.current?.target.set(0, .24, 0);
    }
    if (source.inspect) {
      source.inspect = false;
      camera.position.set(state.x + Math.sin(state.heading) * 1.05, state.y + .5, state.z + Math.cos(state.heading) * 1.05);
      controls.current?.target.set(state.x, .24, state.z); controls.current?.update();
    }
    const oldX = state.x, oldZ = state.z;
    camera.getWorldDirection(forward.current); forward.current.y = 0; forward.current.normalize();
    right.current.setFromMatrixColumn(camera.matrixWorld, 0); right.current.y = 0; right.current.normalize();
    const x = +(source.keys.has('KeyD') || source.keys.has('ArrowRight')) - +(source.keys.has('KeyA') || source.keys.has('ArrowLeft')) + source.stick.x;
    const z = +(source.keys.has('KeyW') || source.keys.has('ArrowUp')) - +(source.keys.has('KeyS') || source.keys.has('ArrowDown')) + source.stick.z;
    const command: HeroInput = { x: right.current.x * x + forward.current.x * z, z: right.current.z * x + forward.current.z * z,
      sprint: source.keys.has('ShiftLeft') || source.keys.has('ShiftRight'), walk: source.keys.has('AltLeft') || source.keys.has('AltRight'), crouch: source.crouch, jump: source.jump };
    const preview = options.previewAnimation !== 'gameplay';
    source.jump = false;
    if (preview) { state.vx = state.vz = state.speed = 0; }
    else stepHero(state, command, dt);
    assets.root.position.set(state.x, state.y, state.z); assets.root.rotation.y = state.heading;
    if (sunlight.current) {
      sunlight.current.position.set(state.x - 3, 6, state.z - 4);
      sunlight.current.target.position.set(state.x, 0, state.z); sunlight.current.target.updateMatrixWorld();
    }
    const model = assets.models[options.lod];
    const locomotion = heroAnimation(state, command);
    const finishingShot = active.current.name === 'fire' && active.current.action?.isRunning();
    const fireRequested = source.fire;
    source.fire = false;
    const selectedAnimation = options.previewAnimation;
    const animation: DemoAnimation = selectedAnimation !== 'gameplay'
      ? (model.actions[selectedAnimation] ? selectedAnimation : 'idle')
      : (model.actions.fire && locomotion === 'idle' && (finishingShot || fireRequested) ? 'fire' : locomotion);
    const authored = assets.manifest.clips.find(c => c.name === animation)!;
    const carriedPhase = active.current.lod !== options.lod && active.current.action ? active.current.action.time / active.current.action.getClip().duration : 0;
    if (active.current.lod !== options.lod) {
      assets.models.forEach((m, i) => { m.scene.visible = i === options.lod; m.mixer.stopAllAction(); });
      active.current = { lod: options.lod, name: animation, action: null };
    }
    if (!active.current.action || active.current.name !== animation || (!preview && animation === 'fire' && !finishingShot)) {
      const previous = active.current.action;
      const action = model.actions[animation]; action.reset().setEffectiveWeight(1).play();
      if (preview) {
        if (previous && previous !== action) previous.stop();
      } else if (previous && previous !== action) {
        previous.fadeOut(.16);
        action.fadeIn(.16);
      }
      action.time = carriedPhase * action.getClip().duration;
      action.setLoop(authored.loop ? THREE.LoopRepeat : THREE.LoopOnce, authored.loop ? Infinity : 1);
      action.clampWhenFinished = !authored.loop;
      active.current = { lod: options.lod, name: animation, action };
    }
    const action = active.current.action!;
    const muzzleTime = authored.muzzleTime ?? .12;
    flashRemaining.current = Math.max(0, flashRemaining.current - dt);
    if (preview) {
      const duration = active.current.action!.getClip().duration;
      if (!options.paused) previewPhase.current = (previewPhase.current + Math.min(.05, dt) / duration) % 1;
      action.time = previewPhase.current * duration;
      action.setEffectiveTimeScale(1);
      model.mixer.update(0);
      flashRemaining.current = animation === 'fire' && action.time >= muzzleTime ? Math.max(0, .075 - (action.time - muzzleTime)) : 0;
    } else {
      const previousTime = action.time;
      action.setEffectiveTimeScale(authored.movementSpeed > 0 ? Math.max(.05, state.speed / authored.movementSpeed) : 1);
      model.mixer.update(Math.min(.05, dt));
      if (animation === 'fire' && previousTime < muzzleTime && action.time >= muzzleTime) {
        shots.current++;
        flashRemaining.current = .075;
      }
    }
    const flashVisible = flashRemaining.current > 0 && animation === 'fire';
    if (model.weapon) {
      const { flash } = model.weapon;
      const intensity = Math.min(1, flashRemaining.current / .075);
      flash.visible = flashVisible;
      flash.scale.set(.008 * intensity, .008 * intensity, .023 * intensity);
      flash.material.opacity = intensity;
    }
    if (controls.current) {
      camera.position.x += state.x - oldX; camera.position.z += state.z - oldZ;
      controls.current.target.set(state.x, .24 + state.y * .4, state.z); controls.current.update();
    }
    if (view.current) Object.assign(view.current, { position: [state.x, state.y, state.z], speedMeters: state.speed * 3.75, grounded: state.grounded,
      animation, animationSource: authored.source ?? 'prototype', lod: options.lod, skin: options.skin, triangles: LOD_TRIANGLES[options.lod], time: model.mixer.time,
      rig: assets.variant, kit: assets.kit, phase: action.time / action.getClip().duration, weaponTriangles: model.weapon?.triangles ?? 0, shots: shots.current, flashVisible,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures });
  });
  const shadows = options.shadows && runtime.shadowEnabled;
  return <>
    <color attach="background" args={['#96a6aa']} /><fog attach="fog" args={['#96a6aa', 12, 40]} />
    <hemisphereLight args={['#e2edff', '#576054', 2.1]} />
    <directionalLight position={[3, 4, 5]} intensity={1.5} color="#d5e7fa" />
    <directionalLight ref={sunlight} position={[-3, 6, -4]} intensity={3} color="#fff1d3" castShadow={shadows}
      shadow-mapSize-width={runtime.shadowMapSize || 1024} shadow-mapSize-height={runtime.shadowMapSize || 1024}
      shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4}
      shadow-camera-near={.1} shadow-camera-far={30} shadow-bias={-.00005} shadow-normalBias={.002} />
    <TrainingYard /><primitive object={assets.root} />
    <OrbitControls ref={controls} target={[0, .24, 0]} enablePan={false} enableDamping dampingFactor={.13} minDistance={.45} maxDistance={3.8} minPolarAngle={.2} maxPolarAngle={1.5} />
  </>;
}

function TouchStick({ input }: { input: React.RefObject<InputStore> }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const reset = () => { input.current.stick = { x: 0, z: 0 }; setOffset({ x: 0, y: 0 }); };
  return <div className="play-stick" aria-label="Джойстик движения" onPointerDown={event => {
    event.currentTarget.setPointerCapture(event.pointerId); const r = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - r.left - r.width / 2, dy = event.clientY - r.top - r.height / 2;
    const scale = Math.max(1, Math.hypot(dx, dy) / 35); input.current.stick = { x: dx / scale / 35, z: -dy / scale / 35 }; setOffset({ x: dx / scale, y: dy / scale });
  }} onPointerMove={event => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const r = event.currentTarget.getBoundingClientRect(), dx = event.clientX - r.left - r.width / 2, dy = event.clientY - r.top - r.height / 2;
    const scale = Math.max(1, Math.hypot(dx, dy) / 35); input.current.stick = { x: dx / scale / 35, z: -dy / scale / 35 }; setOffset({ x: dx / scale, y: dy / scale });
  }} onPointerUp={reset} onPointerCancel={reset} onLostPointerCapture={reset}><span style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} /></div>;
}

export default function InfantryDemo() {
  const [options, setOptions] = useState<DemoOptions>(() => ({ ...DEFAULT, kit: new URLSearchParams(location.search).get('kit') === 'vpulse' ? 'vpulse' : 'unarmed' }));
  const [assets, setAssets] = useState<HeroAssets | null>(null), [error, setError] = useState('');
  const [status, setStatus] = useState<DemoView | null>(null), [menu, setMenu] = useState(() => innerWidth > 800);
  const input = useRef<InputStore>({ keys: new Set(), stick: { x: 0, z: 0 }, crouch: false, jump: false, fire: false, reset: false, inspect: false });
  const view = useRef<DemoView | null>(null);
  const currentAssets = useRef<HeroAssets | null>(null);
  currentAssets.current = assets;
  useEffect(() => {
    let cancelled = false;
    setError('');
    loadHeroAssets(options.rig, options.kit).then(value => { if (cancelled) value.dispose(); else setAssets(value); }).catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [options.rig, options.kit]);
  useEffect(() => () => { assets?.dispose(); }, [assets]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, select, textarea, [contenteditable=true]')) return;
      const keys = input.current.keys;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'AltLeft', 'AltRight'].includes(event.code)) event.preventDefault();
      keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Space') input.current.jump = true;
      if (event.code === 'KeyF') input.current.fire = true;
      if (event.code === 'KeyC') input.current.crouch = !input.current.crouch;
      if (event.code === 'KeyR') input.current.reset = true;
      if (/Digit[1-5]/.test(event.code)) setOptions(s => ({ ...s, skin: SKINS[+event.code.slice(-1) - 1].id }));
      if (event.code === 'KeyQ' || event.code === 'KeyE') setOptions(s => ({ ...s, skin: SKINS[(SKINS.findIndex(p => p.id === s.skin) + (event.code === 'KeyE' ? 1 : 4)) % 5].id }));
    };
    const keyup = (event: KeyboardEvent) => input.current.keys.delete(event.code);
    const clear = () => { input.current.keys.clear(); input.current.stick = { x: 0, z: 0 }; input.current.jump = false; input.current.fire = false; };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setStatus(view.current ? { ...view.current } : null), 150);
    window.__infantryDemo = { inspect: () => view.current, configure: patch => setOptions(s => ({ ...s, ...patch })), reset: () => { input.current.reset = true; },
      inspectWeapon: () => {
        const loaded = currentAssets.current, state = view.current;
        if (!loaded || !state) return null;
        const { weapon, mesh } = loaded.models[state.lod];
        const hand = mesh.skeleton.getBoneByName('hand_L');
        if (!weapon || !hand) return null;
        loaded.root.updateMatrixWorld(true);
        const point = new THREE.Vector3();
        const palm = loaded.manifest.supportGrip?.position ?? [0, 0, 0];
        return { muzzle: weapon.muzzle.getWorldPosition(point).toArray(), primary: weapon.primary.getWorldPosition(point).toArray(),
          support: weapon.support.getWorldPosition(point).toArray(), handL: hand.localToWorld(point.fromArray(palm)).toArray(),
          matrix: weapon.socket.matrixWorld.toArray(), parent: weapon.socket.parent?.name ?? '' };
      },
      bindPose: () => {
        const loaded = currentAssets.current, state = view.current;
        return loaded && state ? Array.from(loaded.models[state.lod].mesh.geometry.getAttribute('position').array) : [];
      },
      skeleton: () => {
        const loaded = currentAssets.current, state = view.current;
        if (!loaded || !state) return [];
        const skeleton = loaded.models[state.lod].mesh.skeleton;
        skeleton.update();
        const matrices = skeleton.boneMatrices;
        return matrices ? skeleton.bones.map((bone, i) => ({ name: bone.name, matrix: Array.from(matrices.slice(i * 16, i * 16 + 16)) })) : [];
      },
      pose: () => {
        const loaded = currentAssets.current, state = view.current;
        if (!loaded || !state) return [];
        const mesh = loaded.models[state.lod].mesh, position = mesh.geometry.getAttribute('position');
        mesh.updateWorldMatrix(true, false); mesh.skeleton.update();
        const point = new THREE.Vector3(), result: number[] = [];
        for (let i = 0; i < position.count; i++) { point.fromBufferAttribute(position, i); mesh.applyBoneTransform(i, point); result.push(point.x, point.y, point.z); }
        return result;
      },
    };
    return () => { clearInterval(timer); delete window.__infantryDemo; };
  }, []);
  const update = <K extends keyof DemoOptions>(key: K, value: DemoOptions[K]) => setOptions(s => ({ ...s, [key]: value }));
  const skin = SKINS.find(s => s.id === options.skin)!;
  const hasFire = assets?.kit === 'vpulse' && !!assets.manifest.clips.find(c => c.name === 'fire');
  return <div className="infantry-playground">
    <div className="play-world">{assets ? <Canvas shadows camera={{ position: [0, .7, -1.2], fov: 43, near: .01, far: 80 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <World assets={assets} options={options} input={input} view={view} />
    </Canvas> : <div className="play-loading"><b>ПОДГОТОВКА ПОЛИГОНА</b><span>{error || 'Загрузка экипировки и движений…'}</span>{error && <button onClick={() => location.reload()}>Повторить</button>}</div>}</div>
    <header className="play-heading"><span>ОБЪЕКТ 316 / ПЕХОТА</span><h1>ПОЛИГОН</h1><p>Свободное движение · примерка экипировки</p></header>
    <button className="play-menu-toggle" onClick={() => setMenu(s => !s)} aria-expanded={menu}>Экипировка {menu ? '−' : '+'}</button>
    <aside className={`play-wardrobe ${menu ? '' : 'closed'}`}>
      <div className="play-panel-title">КОМПЛЕКТ ЭКИПИРОВКИ <span>0{SKINS.findIndex(s => s.id === options.skin) + 1}/05</span></div>
      <div className="play-skins">{SKINS.map((s, i) => <button key={s.id} data-testid={`skin-${s.id}`} className={options.skin === s.id ? 'selected' : ''} onClick={() => update('skin', s.id)}>
        <i style={{ background: s.color, borderBottomColor: s.accent }} /><span>{s.name}</span><small>{i + 1}</small>
      </button>)}</div>
      <p className="play-skin-description">{skin.description}</p>
      <label>ОРУЖИЕ<select data-testid="demo-kit" value={options.kit} onChange={e => {
        const kit = e.target.value as DemoKit;
        setOptions(s => ({ ...s, kit, previewAnimation: kit === 'unarmed' && s.previewAnimation === 'fire' ? 'gameplay' : s.previewAnimation }));
      }}><option value="unarmed">Без оружия</option><option value="vpulse">V‑Pulse</option></select></label>
      {options.kit === 'unarmed' && <label>РИГ ДЛЯ СРАВНЕНИЯ<select data-testid="demo-rig" value={options.rig} onChange={e => update('rig', e.target.value as RigVariant)}>
        {RIG_VARIANTS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select></label>}
      {(error || (assets && (assets.kit !== options.kit || (options.kit === 'unarmed' && assets.variant !== options.rig)))) && <p className="play-rig-note" role="status">{error || 'Загрузка комплекта…'}</p>}
      <label>ПРОСМОТР ДВИЖЕНИЯ<select data-testid="demo-animation" value={options.previewAnimation} onChange={e => update('previewAnimation', e.target.value as DemoOptions['previewAnimation'])}>
        {PREVIEW_ANIMATIONS.filter(([id]) => id !== 'fire' || hasFire).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      {options.previewAnimation !== 'gameplay' && <div className="play-animation-review">
        <span>Источник: {assets?.manifest.clips.find(c => c.name === options.previewAnimation)?.sourceClip ?? '…'}</span>
        {options.previewAnimation === 'jump' && <span>Здесь — поза прыжка. Прыжок с движением — в игре по Пробелу.</span>}
        <label><input data-testid="demo-pause" type="checkbox" checked={options.paused} onChange={e => { setOptions(s => ({ ...s, paused: e.target.checked, phase: view.current?.phase ?? s.phase })); }} /> Пауза</label>
        <label>Фаза цикла · {Math.round((status?.phase ?? 0) * 100)}%<input data-testid="demo-phase" aria-label="Фаза анимации" type="range" min="0" max="0.999" step="0.001" value={options.paused ? options.phase : status?.phase ?? 0} onChange={e => setOptions(s => ({ ...s, paused: true, phase: +e.target.value }))} /></label>
      </div>}
      <label>ДЕТАЛИЗАЦИЯ<select data-testid="demo-lod" value={options.lod} onChange={e => update('lod', +e.target.value as 0 | 1 | 2)}>
        <option value="0">Высокая · 3999 треугольников</option><option value="1">Средняя · 1999 треугольников</option><option value="2">Лёгкая · 999 треугольников</option>
      </select></label>
      <label>ГРАФИКА<select value={options.quality} onChange={e => update('quality', e.target.value as DemoOptions['quality'])}>
        <option value="low">Низкая</option><option value="balanced">Сбалансированная</option><option value="high">Высокая</option><option value="ultra">Ультра</option>
      </select></label>
      <div className="play-checks"><label><input type="checkbox" checked={options.normals} onChange={e => update('normals', e.target.checked)} />Рельеф брони</label><label><input type="checkbox" checked={options.shadows} onChange={e => update('shadows', e.target.checked)} />Тени</label></div>
      <button className="play-reset play-inspect" data-testid="inspect-front" onClick={() => { input.current.inspect = true; }}>Осмотреть спереди <span>↻</span></button>
      {hasFire && options.previewAnimation === 'gameplay' && <button className="play-reset" data-testid="demo-fire" onClick={() => { input.current.fire = true; }}>Пробный выстрел с места <kbd>F</kbd></button>}
      <button className="play-reset" onClick={() => { input.current.reset = true; }}>Вернуться на старт <kbd>R</kbd></button>
      <a href={options.kit === 'vpulse' ? '?lab=infantry&kit=vpulse' : '?lab=infantry'}>Лаборатория массовой анимации ↗</a>
    </aside>
    <div className="play-telemetry"><span className="play-live-dot" /><span>{status?.grounded === false ? 'В ВОЗДУХЕ' : (status?.speedMeters ?? 0) > .1 ? 'ДВИЖЕНИЕ' : 'ГОТОВНОСТЬ'}</span><b>{(status?.speedMeters ?? 0).toFixed(1)} <small>м/с</small></b><span>{((status?.triangles ?? LOD_TRIANGLES[options.lod]) + (status?.weaponTriangles ?? 0)).toLocaleString('ru-RU')} треугольников · {status?.animationSource === 'mixamo' ? 'MIXAMO' : 'ДЕМО-КЛИП'}</span></div>
    <footer className="play-help"><div><kbd>W A S D</kbd> движение <kbd>Shift</kbd> ускорение <kbd>Alt</kbd> шаг <kbd>Пробел</kbd> прыжок <kbd>C</kbd> присесть</div><div>Перетаскивание — камера · колесо — масштаб · <kbd>Q / E</kbd> или <kbd>1–5</kbd> — расцветка</div></footer>
    <div className="play-touch"><TouchStick input={input} /><div className="play-touch-buttons"><button onClick={() => { input.current.crouch = !input.current.crouch; }}>Присесть</button><button onClick={() => { input.current.jump = true; }}>Прыжок</button></div></div>
  </div>;
}
