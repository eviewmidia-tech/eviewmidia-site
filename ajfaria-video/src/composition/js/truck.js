import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tex, glowSprite } from './util.js';

// Cavalo mecânico cara-chata + carreta baú, genérico e SEM identificação de marca
// (o briefing proíbe caminhões com identificação falsa da AJ Faria).
// Frente voltada para +X, chão em y=0, eixo longitudinal no centro (z=0).

let shared = null;
function materials(envMap) {
  if (shared && shared.env === envMap) return shared;
  const rimTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#9aa0a4'; g.fillRect(0, 0, 256, 256);
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#e9ecee'); gr.addColorStop(0.55, '#b9bec2'); gr.addColorStop(0.62, '#5d6266'); gr.addColorStop(0.7, '#c7cbce'); gr.addColorStop(1, '#8d9296');
    g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
    g.fillStyle = '#1a1c1e';
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.ellipse(128 + Math.cos(a) * 78, 128 + Math.sin(a) * 78, 13, 20, a, 0, 7); g.fill(); }
    g.fillStyle = '#2a2d30'; g.beginPath(); g.arc(128, 128, 34, 0, 7); g.fill();
    g.fillStyle = '#c9cdd0'; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.arc(128 + Math.cos(a) * 46, 128 + Math.sin(a) * 46, 5, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const tape = (() => { // faixa refletiva vermelho/branco (padrão Contran)
    const c = document.createElement('canvas'); c.width = 256; c.height = 8; const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8e8e8' : '#c41f1f'; g.fillRect(i * 32, 0, 32, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(10, 1); return t;
  })();
  shared = {
    env: envMap,
    paint: new THREE.MeshStandardMaterial({ color: '#eef1ef', roughness: 0.26, metalness: 0, envMap, envMapIntensity: 0.9 }),
    panel: new THREE.MeshStandardMaterial({ map: tex.panelRibs(24), roughness: 0.42, metalness: 0.05, envMap, envMapIntensity: 0.55 }),
    panelPlain: new THREE.MeshStandardMaterial({ color: '#e6e9e7', roughness: 0.45, envMap, envMapIntensity: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#16191b', roughness: 0.55, metalness: 0.2 }),
    darker: new THREE.MeshStandardMaterial({ color: '#0b0c0d', roughness: 0.7 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d9dcdf', roughness: 0.14, metalness: 1, envMap, envMapIntensity: 1.1 }),
    alu: new THREE.MeshStandardMaterial({ color: '#b9bec2', roughness: 0.3, metalness: 0.9, envMap, envMapIntensity: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: '#06090b', roughness: 0.04, metalness: 0.3, envMap, envMapIntensity: 1.5, emissive: '#ffffff', emissiveIntensity: 0.07, emissiveMap: (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#000'); gr.addColorStop(0.38, '#222'); gr.addColorStop(0.46, '#9a9a9a'); gr.addColorStop(0.52, '#262626'); gr.addColorStop(0.62, '#555'); gr.addColorStop(0.68, '#111'); gr.addColorStop(1, '#000');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }),
    rubber: new THREE.MeshStandardMaterial({ color: '#111213', roughness: 0.88 }),
    rim: new THREE.MeshStandardMaterial({ map: rimTex, roughness: 0.25, metalness: 0.8, envMap, envMapIntensity: 0.8 }),
    head: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.5) }),
    drl: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.5, 1.6) }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.05, 0.03) }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.55, 0.05) }),
    tape: new THREE.MeshBasicMaterial({ map: tape }),
  };
  return shared;
}

function box(mat, sx, sy, sz, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

function wheel(M, width, parent, x, z) {
  const g = new THREE.Group();
  const r = 0.53;
  const tireProfile = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; tireProfile.push(new THREE.Vector2(r - 0.06 + Math.sin(a) * 0.06, -width / 2 + (i / 12) * width)); }
  const tire = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.3, -width / 2), ...tireProfile, new THREE.Vector2(0.3, width / 2)], 40), M.rubber);
  tire.rotation.x = Math.PI / 2; tire.castShadow = true; g.add(tire);
  const rimGeo = new THREE.CircleGeometry(0.34, 40);
  const outer = new THREE.Mesh(rimGeo, M.rim); outer.position.z = (z > 0 ? 1 : -1) * (width / 2 - 0.035); if (z < 0) outer.rotation.y = Math.PI; g.add(outer);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 20), M.chrome); hub.rotation.x = Math.PI / 2; hub.position.z = (z > 0 ? 1 : -1) * (width / 2); g.add(hub);
  g.position.set(x, r, z); parent.add(g);
  return g;
}

export function buildTruck(envMap, { trailer = true, trailerOnly = false, openRear = false } = {}) {
  const M = materials(envMap);
  const root = new THREE.Group();
  const wheels = [];
  const glows = [];
  const tractor = new THREE.Group(); root.add(tractor);

  if (!trailerOnly) {
    // cabine
    const cab = new THREE.Mesh(new RoundedBoxGeometry(2.25, 2.55, 2.48, 5, 0.14), M.paint);
    cab.position.set(-1.125, 2.525, 0); cab.castShadow = cab.receiveShadow = true; tractor.add(cab);
    // defletor de teto
    const sh = new THREE.Shape();
    sh.moveTo(-0.3, 0); sh.quadraticCurveTo(-0.9, 0.42, -1.45, 0.46); sh.lineTo(-2.18, 0.46); sh.lineTo(-2.2, 0); sh.closePath();
    const defl = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.3, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 16 }), M.paint);
    defl.position.set(0, 3.76, -1.15); defl.castShadow = true; tractor.add(defl);
    // para-brisa + moldura
    box(M.darker, 0.04, 1.16, 2.28, 0.0, 3.06, 0, tractor);
    box(M.glass, 0.05, 1.04, 2.16, 0.012, 3.06, 0, tractor);
    box(M.darker, 0.06, 1.04, 0.05, 0.02, 3.06, 0, tractor); // coluna central
    box(M.dark, 0.2, 0.1, 2.34, 0.08, 3.68, 0, tractor); // pala de sol
    for (const s of [-1, 1]) { // vidros laterais
      box(M.glass, 0.95, 0.86, 0.04, -0.62, 3.06, s * 1.245, tractor);
      box(M.darker, 1.0, 0.92, 0.03, -0.62, 3.06, s * 1.238, tractor);
      // retrovisores
      box(M.dark, 0.06, 0.06, 0.32, 0.12, 3.35, s * 1.36, tractor);
      box(M.dark, 0.14, 0.52, 0.24, 0.24, 3.0, s * 1.55, tractor);
      box(M.glass, 0.02, 0.44, 0.18, 0.32, 3.0, s * 1.55, tractor);
      // degrau / saia lateral
      box(M.dark, 0.5, 0.5, 0.12, -1.95, 1.0, s * 1.2, tractor);
      box(M.alu, 0.46, 0.04, 0.3, -1.95, 0.85, s * 1.25, tractor);
    }
    // grade frontal
    box(M.darker, 0.05, 0.95, 1.7, 0.0, 1.95, 0, tractor);
    for (let i = 0; i < 6; i++) box(i % 2 ? M.dark : M.chrome, 0.04, 0.045, 1.6, 0.03, 1.58 + i * 0.15, 0, tractor);
    // faróis
    for (const s of [-1, 1]) {
      box(M.darker, 0.06, 0.3, 0.52, 0.02, 1.36, s * 0.92, tractor);
      const hl = box(M.head, 0.05, 0.16, 0.2, 0.05, 1.36, s * 0.83, tractor); hl.castShadow = false;
      const hl2 = box(M.head, 0.05, 0.16, 0.16, 0.05, 1.36, s * 1.06, tractor); hl2.castShadow = false;
      const drl = box(M.drl, 0.04, 0.035, 0.5, 0.06, 1.53, s * 0.92, tractor); drl.castShadow = false;
      const gs = glowSprite(new THREE.Color('#fff6e8'), 2.4, 0.9); gs.position.set(0.25, 1.36, s * 0.92); tractor.add(gs); glows.push(gs);
      const am = box(M.amber, 0.04, 0.08, 0.12, 0.02, 3.86, s * 0.95, tractor); am.castShadow = false; // luzes de teto
    }
    // para-choque
    box(M.dark, 0.3, 0.46, 2.5, -0.06, 0.92, 0, tractor);
    box(M.darker, 0.32, 0.08, 2.3, -0.04, 0.68, 0, tractor);
    // chassi
    box(M.darker, 6.6, 0.3, 0.14, -3.6, 1.0, 0.45, tractor);
    box(M.darker, 6.6, 0.3, 0.14, -3.6, 1.0, -0.45, tractor);
    box(M.dark, 2.2, 0.12, 2.0, -5.1, 1.2, 0, tractor); // quinta roda
    // tanque de combustível e escapamento
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.4, 28), M.alu); tank.rotation.z = Math.PI / 2; tank.position.set(-3.05, 0.86, 1.02); tank.castShadow = true; tractor.add(tank);
    const tank2 = tank.clone(); tank2.position.z = -1.02; tractor.add(tank2);
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.7, 16), M.chrome); ex.position.set(-2.45, 2.65, 1.05); tractor.add(ex);
    // para-lamas
    for (const s of [-1, 1]) {
      const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 24, 1, true, Math.PI * 0.5, Math.PI), M.darker);
      fender.rotation.x = Math.PI / 2; fender.position.set(-1.35, 0.6, s * 1.06); tractor.add(fender);
      box(M.darker, 2.0, 0.06, 0.6, -5.4, 1.28, s * 1.0, tractor);
    }
    // rodas do cavalo
    for (const s of [-1, 1]) {
      wheels.push(wheel(M, 0.34, tractor, -1.35, s * 1.04));
      wheels.push(wheel(M, 0.62, tractor, -4.75, s * 0.92));
      wheels.push(wheel(M, 0.62, tractor, -6.1, s * 0.92));
    }
  }

  if (trailer || trailerOnly) {
    const tr = new THREE.Group(); root.add(tr);
    const x0 = -2.65, L = 14.5, x1 = x0 - L, cx = (x0 + x1) / 2;
    if (!openRear) {
      const bodyMats = [M.panelPlain, M.panelPlain, M.panelPlain, M.dark, M.panel, M.panel];
      const body = new THREE.Mesh(new THREE.BoxGeometry(L, 2.9, 2.6), bodyMats);
      body.position.set(cx, 2.78, 0); body.castShadow = body.receiveShadow = true; tr.add(body);
    } else {
      // baú aberto: paredes separadas com interior visível e portas traseiras abertas
      const inner = new THREE.MeshStandardMaterial({ color: '#c9ceca', roughness: 0.7, side: THREE.DoubleSide });
      const floorM = new THREE.MeshStandardMaterial({ color: '#5a4c3c', roughness: 0.8 });
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(L, 2.9, 0.05), [M.panelPlain, M.panelPlain, M.panelPlain, M.panelPlain, s > 0 ? M.panel : inner, s > 0 ? inner : M.panel]); w.position.set(cx, 2.78, s * 1.275); w.castShadow = true; tr.add(w); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 2.6), [M.panelPlain, M.panelPlain, M.panelPlain, inner, M.panelPlain, M.panelPlain]); top.position.set(cx, 4.21, 0); top.castShadow = true; tr.add(top);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, 2.5), floorM); fl.position.set(cx, 1.36, 0); fl.receiveShadow = true; tr.add(fl);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.9, 2.6), M.panelPlain); fr.position.set(x0, 2.78, 0); tr.add(fr);
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.28, 2.75, 0.05), M.panelPlain); d.position.set(x1 + 0.66, 2.78, s * 1.34); d.castShadow = true; tr.add(d); } // portas abertas rebatidas nas laterais
      const il = new THREE.PointLight('#fff4e0', 6, 14, 1.5); il.position.set(x1 + 4, 3.8, 0); tr.add(il);
    }
    for (const y of [1.33, 4.23]) for (const s of [-1, 1]) box(M.alu, L + 0.02, 0.07, 0.05, cx, y, s * 1.31, tr);
    if (!openRear) box(M.alu, L, 0.06, 2.62, cx, 4.22, 0, tr);
    box(M.darker, L - 0.4, 0.28, 2.2, cx, 1.12, 0, tr);
    for (const s of [-1, 1]) {
      const tp = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.6, 0.06), M.tape); tp.position.set(cx, 1.42, s * 1.302); if (s < 0) tp.rotation.y = Math.PI; tr.add(tp);
      box(M.dark, 6.4, 0.18, 0.06, x0 - 6.4, 0.72, s * 1.15, tr); // protetor lateral
      box(M.darker, 0.12, 0.85, 0.12, x0 - 3.1, 0.55, s * 0.95, tr); // pé de apoio
      for (let i = 0; i < 5; i++) { const a = box(M.amber, 0.12, 0.07, 0.03, x0 - 0.8 - i * 3.2, 1.6, s * 1.315, tr); a.castShadow = false; }
      for (const ax of [-10.5, -11.85, -13.2]) wheels.push(wheel(M, 0.62, tr, x0 + ax, s * 0.92));
      box(M.darker, 0.03, 0.55, 0.5, x1 + 0.45, 0.6, s * 0.92, tr); // para-barro
    }
    // traseira: portas, travas, lanternas, faixa
    if (!openRear) box(M.dark, 0.03, 2.75, 0.02, x1 - 0.006, 2.78, 0, tr);
    if (!openRear) for (const z of [-0.95, -0.45, 0.45, 0.95]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.7, 8), M.chrome); rod.position.set(x1 - 0.05, 2.78, z); tr.add(rod); }
    if (!openRear) for (const y of [1.6, 2.4, 3.2, 4.0]) for (const s of [-1, 1]) box(M.chrome, 0.05, 0.08, 0.18, x1 - 0.03, y, s * 1.22, tr);
    box(M.dark, 0.2, 0.22, 2.4, x1 + 0.1, 0.78, 0, tr);
    const rt = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.06), M.tape); rt.position.set(x1 - 0.21, 0.86, 0); rt.rotation.y = -Math.PI / 2; tr.add(rt);
    for (const s of [-1, 1]) for (const k of [0, 1, 2]) { const l = box(M.tail, 0.04, 0.12, 0.14, x1 - 0.02, 0.98, s * (1.05 - k * 0.17), tr); l.castShadow = false; }
    root.userData.tailGlow = [];
    for (const s of [-1, 1]) { const gs = glowSprite(new THREE.Color('#ff2a10'), 1.2, 0.6); gs.position.set(x1 - 0.3, 0.98, s * 0.9); tr.add(gs); root.userData.tailGlow.push(gs); }
    root.userData.rearX = x1;
  }

  root.userData.wheels = wheels;
  root.userData.glows = glows;
  root.userData.drive = (dist) => { for (const w of wheels) w.rotation.z = -dist / 0.53; };
  root.userData.lights = (on) => { M.head.color.setScalar(on ? 1.6 : 0.6); for (const g of glows) g.visible = on; };
  return root;
}

// palete (madeira) com caixas de papelão empilhadas
export function buildPallet(M, { layers = 3, wrap = false, seed = 1 } = {}) {
  const g = new THREE.Group();
  const wood = M.wood, card = M.card;
  for (const z of [-0.45, 0, 0.45]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), wood); b.position.set(0, 0.05, z); g.add(b); }
  for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 1.0), wood); b.position.set(-0.55 + i * 0.1833, 0.115, 0); g.add(b); }
  const boxes = [];
  const bw = 0.38, bh = 0.32, bd = 0.32;
  for (let l = 0; l < layers; l++) for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 3; iz++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), card);
    b.position.set(-0.4 + ix * 0.4, 0.13 + bh / 2 + l * (bh + 0.004), -0.33 + iz * 0.33);
    b.rotation.y = ((ix + iz + l + seed) % 2) * Math.PI;
    b.castShadow = b.receiveShadow = true; g.add(b); boxes.push(b);
  }
  if (wrap) {
    const film = new THREE.Mesh(new THREE.BoxGeometry(1.23, layers * (bh + 0.004) + 0.02, 1.03), M.film);
    film.position.y = 0.13 + (layers * (bh + 0.004)) / 2; g.add(film);
  }
  g.userData.boxes = boxes;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
