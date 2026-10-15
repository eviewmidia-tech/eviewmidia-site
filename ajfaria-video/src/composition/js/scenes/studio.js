import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { buildTruck } from '../truck.js';
import { seg, E, lerp, rng, glowSprite, beamMesh, tex, lensShift } from '../util.js';

// CENA 03 — estúdio escuro, caminhão com luzes de recorte, reflexos suaves, zoom controlado.
export function createStudio(renderer, env) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#040504', 22, 70);

  const refl = new Reflector(new THREE.PlaneGeometry(300, 300), { textureWidth: 720, textureHeight: 1280, color: 0x555a57, clipBias: 0.003 });
  refl.rotation.x = -Math.PI / 2; scene.add(refl);
  // piso: reflexo (Reflector) sob uma película escura não-iluminada, com poça de luz pintada
  const radial = (stops) => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256); for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512); return new THREE.CanvasTexture(c); };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: '#050605', transparent: true, fog: false,
    alphaMap: radial([[0, '#9a9a9a'], [0.35, '#d0d0d0'], [1, '#ffffff']]) }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-4, 0.004, 0); scene.add(floor);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(160,200,120,0.22)'], [0.5, 'rgba(60,80,50,0.08)'], [1, 'rgba(0,0,0,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-3, 0.006, 0); scene.add(pool);
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.55 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = 0.008; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);

  // fundo: gradiente em espaço de tela com brilho suave atrás da cabine (separação de silhueta)
  scene.background = (() => { const c = document.createElement('canvas'); c.width = 270; c.height = 480; const g = c.getContext('2d');
    g.fillStyle = '#030403'; g.fillRect(0, 0, 270, 480);
    const gr = g.createRadialGradient(175, 300, 4, 175, 300, 230); gr.addColorStop(0, '#2c3a24'); gr.addColorStop(0.35, '#141c11'); gr.addColorStop(1, 'rgba(3,4,3,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 270, 480);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

  const truck = buildTruck(env); scene.add(truck);
  truck.rotation.y = 0; truck.position.set(0, 0, 0);

  const hemi = new THREE.HemisphereLight('#b8c4bc', '#0a0b0a', 0.25); scene.add(hemi);
  const key = new THREE.SpotLight('#fff3e2', 140, 80, 0.32, 0.7, 1.6); key.position.set(16, 12, 14); key.target.position.set(-2, 2.2, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; scene.add(key, key.target);
  const rimG = new THREE.SpotLight('#a8e35a', 700, 80, 0.26, 0.5, 1.5); rimG.position.set(-16, 9, -14); rimG.target.position.set(0, 3.2, 1.5); scene.add(rimG, rimG.target);
  const rimW = new THREE.SpotLight('#dfe8ff', 520, 80, 0.26, 0.5, 1.5); rimW.position.set(6, 9, -16); rimW.target.position.set(-1, 3.0, 1.2); scene.add(rimW, rimW.target);
  const sweep = new THREE.SpotLight('#ffffff', 0, 30, 0.22, 0.8, 1.4); sweep.position.set(4, 10, 6); scene.add(sweep, sweep.target);

  // feixes volumétricos e poeira
  const beams = [];
  for (let i = 0; i < 3; i++) { const b = beamMesh(i === 1 ? '#bfe88a' : '#dfe6e0', 6 + i, 22, 0.05); b.position.set(-6 - i * 6, 19, -10 - i * 2); b.rotation.z = 0.18 - i * 0.12; scene.add(b); beams.push(b); }
  const r = rng(77); const N = 380; const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = -18 + r() * 30; pos[i * 3 + 1] = r() * 9; pos[i * 3 + 2] = -10 + r() * 20; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.03, color: '#cfd8c8', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  const camera = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.1, 300);

  function update(t, shot) {
    const k = shot.cam === 'side' ? shot.local + 4.33 : shot.local; // o plano 'side' continua com a luz já acesa
    const up = seg(k, 0.0, 1.4, E.outCubic);
    rimG.intensity = 700 * up; rimW.intensity = 520 * seg(k, 0.25, 1.6, E.outCubic); key.intensity = 140 * seg(k, 0.5, 2.0, E.inOutSine);
    hemi.intensity = 0.25 * up;
    truck.userData.lights(k > 0.45);
    for (const g of truck.userData.glows) g.material.opacity = 0.9 * seg(k, 0.45, 0.7, E.outCubic);
    // varredura de luz pela lataria
    const s = seg(k, 1.2, 3.6, E.inOutSine);
    sweep.intensity = 900 * Math.sin(Math.PI * s);
    sweep.position.set(lerp(6, -14, s), 8, 7); sweep.target.position.set(lerp(1, -15, s), 2.2, 0);
    for (const b of beams) b.material.opacity = 0.05 * up;
    dust.rotation.y = k * 0.01; dust.position.x = k * 0.12;
    // câmera: dolly-in controlado + leve órbita
    const p = seg(shot.local, 0, shot.dur, E.inOutSine);
    if (shot.cam === 'side') {
      // ângulo mais baixo e frontal, deslizando lateralmente (parallax nos reflexos)
      const ang = lerp(0.3, 0.42, p), dist = lerp(17, 15.2, p);
      const target = new THREE.Vector3(-2.0, 2.3, 0);
      camera.position.set(target.x + Math.cos(ang) * dist, lerp(0.75, 0.95, p), Math.sin(ang) * dist);
      camera.lookAt(target);
      camera.fov = 36; lensShift(camera, shot.shiftY ?? 0.6);
    } else {
      const ang = lerp(0.72, 0.6, p), dist = lerp(26, 21.5, p);
      const target = new THREE.Vector3(-3.2, 2.1, 0);
      camera.position.set(target.x + Math.cos(ang) * dist, 1.35, Math.sin(ang) * dist);
      camera.lookAt(target);
      camera.fov = 38; lensShift(camera, shot.shiftY ?? 0.3);
    }
    renderer.toneMappingExposure = 1.0;
  }
  return { scene, camera, update };
}
