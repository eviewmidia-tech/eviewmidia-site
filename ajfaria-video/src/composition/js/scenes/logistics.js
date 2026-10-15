import * as THREE from 'three';
import { buildTruck, buildPallet } from '../truck.js';
import { seg, E, lerp, rng, glowSprite, beamMesh, tex, lensShift, clamp, inv } from '../util.js';

// Centro logístico genérico: parede de docas em z=0 (pátio em z>0, galpão em z<0).
// Piso interno (nível de doca) a 1,2 m; pátio em y=0.
// Planos: 'interior' (cena 2), 'prep' (preparação), 'loading' (carregamento), 'dock' (doca externa).
const DOCK_H = 1.2;
const DOORS = [-10, -5, 0, 5, 10];

export function createLogistics(renderer, env, icons) {
  const scene = new THREE.Scene();
  const fog = new THREE.Fog('#0d1012', 30, 90); scene.fog = fog;
  const R = rng(4242);
  const o = new THREE.Object3D();

  // ---------- materiais ----------
  const concrete = tex.concrete(); concrete.repeat.set(10, 7);
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: concrete, color: '#a3a6a2', roughness: 0.42, metalness: 0.0 }),
    wall: new THREE.MeshLambertMaterial({ color: '#2b302d' }),
    ceil: new THREE.MeshLambertMaterial({ color: '#16191a' }),
    upright: new THREE.MeshLambertMaterial({ color: '#3a4650' }),
    beam: new THREE.MeshLambertMaterial({ color: '#a8642e' }),
    wood: new THREE.MeshLambertMaterial({ map: tex.wood() }),
    card: new THREE.MeshStandardMaterial({ map: tex.cardboard(), roughness: 0.85 }),
    film: new THREE.MeshStandardMaterial({ color: '#dfe8ee', roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.22, depthWrite: false }),
    paintG: new THREE.MeshBasicMaterial({ color: '#7fae34' }),
    paintY: new THREE.MeshBasicMaterial({ color: '#c9a227' }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.65, 1.7) }),
    clad: new THREE.MeshStandardMaterial({ map: tex.cladding(), color: '#8c9590', roughness: 0.55, metalness: 0.35 }),
    seal: new THREE.MeshLambertMaterial({ color: '#0d0e0f' }),
    door: new THREE.MeshStandardMaterial({ color: '#8e9692', roughness: 0.5, metalness: 0.4 }),
    asphalt: new THREE.MeshLambertMaterial({ map: (() => { const t = tex.asphalt(); t.repeat.set(30, 20); return t; })(), color: '#8d8f90' }),
    lineW: new THREE.MeshBasicMaterial({ color: '#b9bcb6' }),
  };
  // carga paletizada (bloco único com textura de caixas, usada nas prateleiras)
  const loadTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = rng(8);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const v = 150 + r() * 40; g.fillStyle = `rgb(${v},${v * 0.78},${v * 0.53})`; g.fillRect(i * 85 + 2, j * 85 + 2, 82, 82); g.fillStyle = 'rgba(220,190,140,0.7)'; g.fillRect(i * 85 + 36, j * 85 + 2, 12, 82); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const loadMat = new THREE.MeshLambertMaterial({ map: loadTex });
  const wrapMat = new THREE.MeshLambertMaterial({ map: loadTex, color: '#e8eef2' });

  // ---------- galpão (interior) ----------
  const inside = new THREE.Group(); inside.position.y = DOCK_H; scene.add(inside);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 46), M.floor); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -23); floor.receiveShadow = true; inside.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(64, 46), M.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 12, -23); inside.add(ceil);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(64, 12), M.wall); back.position.set(0, 6, -46); inside.add(back);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(46, 12), M.wall); w.rotation.y = -s * Math.PI / 2; w.position.set(s * 32, 6, -23); inside.add(w); }

  // marcações de piso: baias de expedição em frente às docas + faixas de circulação
  const stripe = (mat, w, l, x, z, rot = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, 0.005, z); inside.add(m); };
  for (const d of DOORS) { stripe(M.paintG, 0.08, 7, d - 1.7, -4.5); stripe(M.paintG, 0.08, 7, d + 1.7, -4.5); stripe(M.paintG, 3.48, 0.08, d, -8); }
  stripe(M.paintY, 60, 0.12, 0, -9.4); stripe(M.paintY, 60, 0.12, 0, -10.6);

  // estruturas porta-paletes (instanciadas)
  const rackRows = [-4.6, -8.6, -12.6, -16.6, -20.6, 4.6, 8.6, 12.6, 16.6, 20.6];
  const bays = 10, bayW = 2.8, levels = [0.15, 1.85, 3.55, 5.25, 6.95];
  const nU = rackRows.length * (bays + 1) * 2, nB = rackRows.length * bays * 4 * 2, nL = rackRows.length * bays * levels.length * 2;
  const uprights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 8.2, 0.1), M.upright, nU);
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.14, bayW), M.beam, nB);
  const loads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 1.25, 1.15), loadMat, nL);
  const bases = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.14, 1.2), M.wood, nL);
  let iu = 0, ib = 0, il = 0;
  for (const rx of rackRows) {
    for (let b = 0; b <= bays; b++) for (const dx of [-0.55, 0.55]) { o.position.set(rx + dx, 4.1, -16 - b * bayW); o.scale.set(1, 1, 1); o.updateMatrix(); uprights.setMatrixAt(iu++, o.matrix); }
    for (let b = 0; b < bays; b++) {
      for (const lv of levels.slice(1)) for (const dx of [-0.55, 0.55]) { o.position.set(rx + dx, lv - 0.08, -16 - (b + 0.5) * bayW); o.updateMatrix(); beams.setMatrixAt(ib++, o.matrix); }
      for (const lv of levels) for (const k of [-0.65, 0.65]) {
        if (R() < 0.12) continue;
        const h = 0.75 + R() * 0.5;
        o.position.set(rx, lv + 0.07, -16 - (b + 0.5) * bayW + k); o.scale.set(1, 1, 1); o.updateMatrix(); bases.setMatrixAt(il, o.matrix);
        o.position.y = lv + 0.14 + h * 0.5; o.scale.set(1, h / 1.25, 1); o.updateMatrix(); loads.setMatrixAt(il, o.matrix); il++;
      }
    }
  }
  uprights.count = iu; beams.count = ib; loads.count = il; bases.count = il;
  inside.add(uprights, beams, loads, bases);

  // luminárias high-bay + cones volumétricos
  const bayGlows = [], cones = [];
  for (let i = -3; i <= 3; i++) for (let j = 0; j < 4; j++) {
    const x = i * 8, z = -6 - j * 10;
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.4), M.led); l.position.set(x, 11.4, z); inside.add(l);
    const g = glowSprite(new THREE.Color('#eaf2ff'), 4, 0.5); g.position.set(x, 11.3, z); inside.add(g); bayGlows.push(g);
    const cm = beamMesh('#dfe9f2', 7, 11, 0.035); cm.position.set(x, 11.3, z); inside.add(cm); cones.push(cm);
  }
  const hemi = new THREE.HemisphereLight('#c9d4dc', '#3a3632', 0.55); scene.add(hemi);
  const top1 = new THREE.SpotLight('#eef4ff', 600, 40, 0.9, 0.7, 1.4); top1.position.set(0, DOCK_H + 11, -8); top1.target.position.set(0, 0, -6); top1.castShadow = true; top1.shadow.mapSize.set(1024, 1024); top1.shadow.bias = -0.0005; scene.add(top1, top1.target);
  const top2 = new THREE.SpotLight('#eef4ff', 450, 50, 1.0, 0.8, 1.4); top2.position.set(0, DOCK_H + 11, -22); top2.target.position.set(0, 0, -22); scene.add(top2, top2.target);

  // paletes de expedição (filmados) nas baias
  const staged = [];
  for (const d of DOORS) for (let k = 0; k < 3; k++) {
    if (d === 0 && k === 0) continue;
    const p = buildPallet(M, { layers: 3 + (k % 2), wrap: true, seed: k + d });
    p.position.set(d + (k % 2 ? 0.65 : -0.65), 0, -2.6 - Math.floor(k / 1) * 1.6); p.rotation.y = (R() - 0.5) * 0.06; inside.add(p); staged.push(p);
  }

  // palete "herói" para a preparação (caixas caindo em sequência)
  const hero = buildPallet(M, { layers: 3, seed: 3 }); hero.position.set(-2.0, 0, -12.5); inside.add(hero);
  const prepKey = new THREE.SpotLight('#fff1de', 0, 18, 0.5, 0.6, 1.3); prepKey.position.set(-6.5, DOCK_H + 4.2, -8.0); prepKey.target.position.set(-2.0, DOCK_H + 0.6, -12.5); prepKey.castShadow = true; prepKey.shadow.mapSize.set(1024, 1024); scene.add(prepKey, prepKey.target);
  const heroBoxes = hero.userData.boxes.map((b, i) => ({ b, y: b.position.y, x: b.position.x, i }));
  // palete em movimento para o carregamento
  const mover = buildPallet(M, { layers: 3, wrap: true, seed: 7 }); inside.add(mover);
  const jack = new THREE.Group(); // paleteira (garfos + timão), sem operador
  { const fm = new THREE.MeshStandardMaterial({ color: '#2a2e31', roughness: 0.5, metalness: 0.5 });
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.07, 0.16), fm); f.position.set(0.05, 0.05, s * 0.27); jack.add(f); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.7), new THREE.MeshStandardMaterial({ color: '#7fae34', roughness: 0.45 })); body.position.set(-0.68, 0.24, 0); jack.add(body);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), fm); h.position.set(-0.95, 0.75, 0); h.rotation.z = 0.5; jack.add(h); }
  mover.add(jack); jack.position.set(0, 0, 0);

  // ---------- fachada e docas ----------
  const facadeShape = new THREE.Shape(); facadeShape.moveTo(-32, 0); facadeShape.lineTo(32, 0); facadeShape.lineTo(32, 13.5); facadeShape.lineTo(-32, 13.5); facadeShape.closePath();
  for (const d of DOORS) { const h = new THREE.Path(); h.moveTo(d - 1.5, DOCK_H); h.lineTo(d + 1.5, DOCK_H); h.lineTo(d + 1.5, DOCK_H + 3.2); h.lineTo(d - 1.5, DOCK_H + 3.2); h.closePath(); facadeShape.holes.push(h); }
  const facadeGeo = new THREE.ShapeGeometry(facadeShape);
  { const uv = facadeGeo.attributes.uv, p = facadeGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 32) / 64, p.getY(i) / 13.5); }
  const facade = new THREE.Mesh(facadeGeo, M.clad); facade.receiveShadow = true; scene.add(facade);
  const facadeIn = new THREE.Mesh(facadeGeo, M.wall); facadeIn.rotation.y = Math.PI; facadeIn.scale.x = -1; facadeIn.position.z = -0.25; scene.add(facadeIn);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(64, DOCK_H, 0.4), new THREE.MeshLambertMaterial({ color: '#6c6f6b' })); plinth.position.set(0, DOCK_H / 2, 0.15); scene.add(plinth);
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(64, 0.06, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.25, 0.55) })); parapet.position.set(0, 13.2, 0.06); scene.add(parapet);
  const wallLights = [];
  for (const d of DOORS) {
    for (const [sx, sy, w, h] of [[d - 1.75, DOCK_H + 1.7, 0.5, 3.6], [d + 1.75, DOCK_H + 1.7, 0.5, 3.6], [d, DOCK_H + 3.45, 4.0, 0.5]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.45), M.seal); s.position.set(sx, sy, 0.22); scene.add(s); }
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.25), M.seal); b.position.set(d + s * 1.2, 0.9, 0.48); scene.add(b); }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.35, 1.0) })); lamp.position.set(d, DOCK_H + 4.6, 0.3); scene.add(lamp);
    const g = glowSprite(new THREE.Color('#ffdcae'), 3.2, 0.7); g.position.set(d, DOCK_H + 4.5, 0.5); scene.add(g); wallLights.push(g);
    const cone = beamMesh('#ffd9a8', 4.5, 6, 0.05); cone.position.set(d, DOCK_H + 4.5, 1.2); cone.rotation.x = -0.25; scene.add(cone);
    // portas de enrolar: fechadas / meia-altura / abertas
    const openAmt = d === 0 ? 1 : d === 5 ? 0.72 : d === -10 ? 1 : 0;
    const dh = 3.2 * (1 - openAmt);
    if (dh > 0.01) { const rd = new THREE.Mesh(new THREE.BoxGeometry(3.0, dh, 0.06), M.door); rd.position.set(d, DOCK_H + 3.2 - dh / 2, -0.08); scene.add(rd); }
    // marcação de posicionamento no pátio
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 18), M.lineW); l.rotation.x = -Math.PI / 2; l.position.set(d + s * 1.9, 0.012, 10); scene.add(l); }
  }
  const dockSpots = [];
  for (const d of [-5, 0, 5]) { const sl = new THREE.SpotLight('#ffd9b0', 160, 22, 0.75, 0.7, 1.5); sl.position.set(d, DOCK_H + 4.5, 0.6); sl.target.position.set(d, 0, 6); scene.add(sl, sl.target); dockSpots.push(sl); }

  // pátio, céu e entorno
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), M.asphalt); yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0, 150); yard.receiveShadow = true; scene.add(yard);
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 v; void main(){ float h = v.y; vec3 c = mix(vec3(0.62,0.42,0.33), vec3(0.16,0.2,0.3), smoothstep(0.0,0.25,h)); c = mix(c, vec3(0.03,0.045,0.07), smoothstep(0.2,0.8,h)); gl_FragColor = vec4(c,1.); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat); scene.add(sky);
  const treeMat = new THREE.MeshLambertMaterial({ color: '#141a14' });
  const trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), treeMat, 240);
  for (let i = 0; i < 240; i++) { const z = 70 + R() * 60; const ang = (R() - 0.5) * 2.6; const rr = 80 + R() * 70; const h = 5 + R() * 9; o.position.set(Math.sin(ang) * rr, h * 0.6, Math.cos(ang) * rr * 0.9 + 10); o.scale.set(3 + R() * 3, h * 0.6, 3 + R() * 3); o.updateMatrix(); trees.setMatrixAt(i, o.matrix); }
  scene.add(trees);
  const yardPoles = [];
  for (const [x, z] of [[-24, 26], [22, 30], [-6, 42]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 14, 8), new THREE.MeshLambertMaterial({ color: '#3a3f3c' })); p.position.set(x, 7, z); scene.add(p); const g = glowSprite(new THREE.Color('#ffe2bd'), 6, 0.8); g.position.set(x, 14, z); scene.add(g); yardPoles.push(g); }
  const moon = new THREE.DirectionalLight('#a9bde0', 0.5); moon.position.set(30, 30, 60); scene.add(moon);
  const wash = new THREE.SpotLight('#cfd9ea', 0, 90, 0.5, 0.9, 1.0); wash.position.set(14, 3, 40); wash.target.position.set(-2, 6, 0); scene.add(wash, wash.target);

  // caminhões na doca
  const truckA = buildTruck(env, { openRear: true }); truckA.rotation.y = -Math.PI / 2; truckA.position.set(0, 0, 17.55); scene.add(truckA);
  const truckB = buildTruck(env); truckB.rotation.y = -Math.PI / 2; truckB.position.set(-10, 0, 17.55); scene.add(truckB);
  truckA.userData.lights(false); truckB.userData.lights(false);

  // ---------- elementos gráficos 2.5D (origem -> destinos) ----------
  const gfx = new THREE.Group(); inside.add(gfx);
  const origin = new THREE.Vector3(0, 4.6, -11.5);
  const dests = [new THREE.Vector3(-5, 5.3, -0.6), new THREE.Vector3(0, 5.3, -0.6), new THREE.Vector3(5, 5.3, -0.6)];
  const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.15, 0.35), transparent: true, opacity: 0.95, fog: false, depthWrite: false });
  const routes = dests.map((d, i) => {
    const mid = origin.clone().lerp(d, 0.5); mid.y += 2.6;
    const curve = new THREE.QuadraticBezierCurve3(origin, mid, d);
    const geo = new THREE.TubeGeometry(curve, 80, 0.035, 6, false);
    const mesh = new THREE.Mesh(geo, lineMat); mesh.geometry.setDrawRange(0, 0); gfx.add(mesh);
    const pulse = glowSprite(new THREE.Color('#d4ff8a'), 0.9, 0); gfx.add(pulse);
    return { curve, mesh, pulse, total: geo.index.count };
  });
  const node = (texture, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false })); s.scale.set(size, size, 1); gfx.add(s); return s; };
  const originNode = node(icons.factory, 1.5); originNode.position.copy(origin);
  const destNodes = [node(icons.warehouse, 1.6), node(icons.store, 1.6), node(icons.building, 1.6)];
  destNodes.forEach((n, i) => n.position.copy(dests[i]));
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.stroke(); return new THREE.CanvasTexture(c); })();
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: '#a6e05a', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); gfx.add(ring); ring.position.copy(origin);
  // rotas no piso e caixas direcionadas para cada doca
  const floorRoutes = [-5, 0, 5].map((d, i) => {
    const pts = [new THREE.Vector3(0, 0.02, -15), new THREE.Vector3(0, 0.02, -11), new THREE.Vector3(d * 0.5, 0.02, -9.6), new THREE.Vector3(d, 0.02, -8.2), new THREE.Vector3(d, 0.02, -1.2)];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
    const geo = new THREE.TubeGeometry(curve, 120, 0.05, 4, false); geo.scale(1, 0.15, 1);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.95, 0.25), transparent: true, opacity: 0.85, fog: false, depthWrite: false })); mesh.geometry.setDrawRange(0, 0); gfx.add(mesh);
    const boxes = [0, 1, 2].map(k => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.5), M.card); b.castShadow = true; gfx.add(b); const gl = glowSprite(new THREE.Color('#b8f060'), 1.4, 0); gfx.add(gl); return { b, gl, k }; });
    return { curve, mesh, total: geo.index.count, boxes, i };
  });

  const camera = new THREE.PerspectiveCamera(45, 1080 / 1920, 0.1, 1200);
  const tmp = new THREE.Vector3();

  function setMood(mode) {
    const exterior = mode === 'dock';
    fog.color.set(exterior ? '#2a2d36' : '#0e1214'); fog.near = exterior ? 40 : 26; fog.far = exterior ? 260 : 80;
    sky.visible = true;
    hemi.intensity = exterior ? 0.8 : 0.55; moon.intensity = exterior ? 1.3 : 0.5; wash.intensity = exterior ? 900 : 0;
    renderer.toneMappingExposure = exterior ? 1.12 : 1.0;
    gfx.visible = mode === 'interior';
  }

  function update(t, shot) {
    const k = shot.local, mode = shot.mode, D = shot.dur;
    setMood(mode);
    // reset de elementos animados
    heroBoxes.forEach(h => { h.b.position.y = h.y; h.b.visible = true; });
    mover.visible = false; prepKey.intensity = 0;

    if (mode === 'interior') {
      const p = seg(k, 0, D, E.inOutSine);
      camera.position.set(lerp(-0.6, 0.4, p), DOCK_H + lerp(8.6, 6.4, p), lerp(-41, -32, p));
      camera.lookAt(lerp(-0.3, 0.2, p), DOCK_H + 2.0, -3);
      camera.fov = 60; lensShift(camera, shot.shiftY ?? 0.2);
      // rede: nó de origem, linhas desenhadas, pulsos, nós de destino
      const pop = (a) => E.outQuart(inv(a, a + 0.45, k));
      originNode.material.opacity = pop(0.25); originNode.scale.setScalar(1.5 * (0.6 + 0.4 * pop(0.25)));
      const rp = (k * 0.8) % 1; ring.scale.setScalar(1.5 + rp * 2.2); ring.material.opacity = (1 - rp) * 0.7 * pop(0.4);
      routes.forEach((r, i) => {
        const a = 0.55 + i * 0.18;
        const draw = E.inOutCubic(inv(a, a + 0.9, k));
        r.mesh.geometry.setDrawRange(0, Math.floor(r.total * draw / 3) * 3);
        destNodes[i].material.opacity = E.outQuart(inv(a + 0.75, a + 1.15, k)); destNodes[i].scale.setScalar(1.6 * (0.5 + 0.5 * destNodes[i].material.opacity));
        const pt = ((k - a - 0.9) * 0.75 + i * 0.33) % 1;
        if (k > a + 0.9) { r.curve.getPoint(pt, r.pulse.position); r.pulse.material.opacity = 0.9 * Math.sin(Math.PI * pt); } else r.pulse.material.opacity = 0;
      });
      floorRoutes.forEach((fr, i) => {
        const a = 1.0 + i * 0.15;
        fr.mesh.geometry.setDrawRange(0, Math.floor(fr.total * E.inOutCubic(inv(a, a + 1.0, k)) / 3) * 3);
        fr.boxes.forEach(bx => {
          const st = a + 0.8 + bx.k * 0.95 + i * 0.12;
          const u = clamp((k - st) / 2.3);
          bx.b.visible = k > st && u < 1; bx.gl.material.opacity = bx.b.visible ? 0.5 : 0;
          fr.curve.getPointAt(E.inOutSine(u), tmp); bx.b.position.set(tmp.x, 0.26, tmp.z);
          fr.curve.getTangentAt(E.inOutSine(u), tmp); bx.b.rotation.y = Math.atan2(tmp.x, tmp.z);
          bx.gl.position.set(bx.b.position.x, 0.05, bx.b.position.z);
        });
      });
    } else if (mode === 'prep') {
      // caixas assentando em sequência no palete; câmera baixa orbitando da esquerda p/ direita
      const p = seg(k, 0, D, E.inOutSine);
      heroBoxes.forEach(h => {
        const st = 0.04 + h.i * 0.03; const u = E.outQuart(inv(st, st + 0.3, k));
        h.b.position.y = h.y + (1 - u) * 0.9; h.b.visible = k > st - 0.02;
      });
      prepKey.intensity = 220;
      const c = hero.position, ang = lerp(-1.45, -1.05, p), r = lerp(5.4, 4.8, p);
      camera.position.set(c.x + Math.sin(ang) * r, DOCK_H + lerp(2.3, 2.0, p), c.z + Math.cos(ang) * r);
      camera.lookAt(c.x + 0.2, DOCK_H + 0.7, c.z);
      camera.fov = 44; lensShift(camera, shot.shiftY ?? 0.22);
    } else if (mode === 'loading') {
      // palete é conduzido para dentro do baú (esquerda -> direita, afastando-se)
      mover.visible = true;
      const u = E.inOutCubic(inv(0, D * 0.95, k));
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.2, 0, -4.2), new THREE.Vector3(-0.8, 0, -3.0), new THREE.Vector3(0, 0, -1.0), new THREE.Vector3(0, 0, 2.2), new THREE.Vector3(0, 0.14, 5.0)]);
      path.getPointAt(u, tmp); mover.position.copy(tmp);
      path.getTangentAt(u, tmp); mover.rotation.y = Math.atan2(-tmp.z, tmp.x);
      const p = seg(k, 0, D, E.inOutSine);
      camera.position.set(lerp(-4.6, -3.8, p), DOCK_H + lerp(2.1, 2.3, p), lerp(-6.8, -6.0, p));
      camera.lookAt(lerp(-0.6, 0.6, p), DOCK_H + 1.3, lerp(-0.5, 2.0, p));
      camera.fov = 48; lensShift(camera, shot.shiftY ?? 0.05);
    } else if (mode === 'dock') {
      // grua descendo sobre a doca: caminhão encostado, paletes, área de expedição
      const p = seg(k, 0, D, E.inOutCubic);
      camera.position.set(lerp(15, 12.5, p), lerp(9.5, 3.4, p), lerp(29, 25, p));
      camera.lookAt(lerp(-1.5, -0.5, p), lerp(2.6, 3.4, p), lerp(1, 3, p));
      camera.fov = 50; lensShift(camera, shot.shiftY ?? 0.25);
    }
  }
  return { scene, camera, update };
}
