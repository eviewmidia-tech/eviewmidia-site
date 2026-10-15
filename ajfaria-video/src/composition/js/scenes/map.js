import * as THREE from 'three';
import { seg, E, lerp, rng, glowSprite, tex, lensShift, inv, clamp } from '../util.js';

// CENA — mapa 3D estilizado do estado de São Paulo (malha municipal IBGE via geodata-br).
// Unidades em km: x = leste, z = sul. As conexões são conceituais: partem de Pedreira e se
// dissolvem antes de chegar a qualquer ponto — não indicam rotas nem regiões de atendimento.
export function createMap(renderer, geo) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060807');
  scene.fog = new THREE.Fog('#060807', 500, 1700);
  const DEPTH = 9;

  const shape = new THREE.Shape(geo.state.map(([x, z]) => new THREE.Vector2(x, -z)));
  const extr = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2, curveSegments: 1 });
  extr.rotateX(-Math.PI / 2);
  const topMat = new THREE.MeshStandardMaterial({ color: '#2a3328', roughness: 0.7, metalness: 0.1 });
  const sideMat = new THREE.MeshStandardMaterial({ color: '#0e110f', roughness: 0.6, metalness: 0.3 });
  const state = new THREE.Mesh(extr, [topMat, sideMat]); scene.add(state);

  const edgePts = geo.state.map(([x, z]) => new THREE.Vector3(x, DEPTH + 1.25, z));
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...edgePts, edgePts[0]]), new THREE.LineBasicMaterial({ color: new THREE.Color(0.75, 1.1, 0.4), transparent: true, opacity: 0.9 }));
  scene.add(edge);
  const bPos = [];
  for (const line of geo.borders) for (let i = 0; i < line.length - 1; i++) bPos.push(line[i][0], DEPTH + 1.3, line[i][1], line[i + 1][0], DEPTH + 1.3, line[i + 1][1]);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  const borders = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: '#b3c3a8', transparent: true, opacity: 0.3, depthWrite: false })); scene.add(borders);

  // Pedreira
  const [px, pz] = geo.pedreiraCenter;
  const pShape = new THREE.Shape(geo.pedreira.map(([x, z]) => new THREE.Vector2(x, -z)));
  const pGeo = new THREE.ShapeGeometry(pShape); pGeo.rotateX(-Math.PI / 2); pGeo.translate(0, DEPTH + 1.45, 0);
  const pFill = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.15, 0.35), transparent: true, opacity: 0, depthWrite: false })); scene.add(pFill);
  const pLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(geo.pedreira.map(([x, z]) => new THREE.Vector3(x, DEPTH + 1.5, z))), new THREE.LineBasicMaterial({ color: '#e4ffb8', transparent: true, opacity: 0 })); scene.add(pLine);
  const P = new THREE.Vector3(px, DEPTH + 1.5, pz);

  // marcador institucional
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 1.2, 0.45) }));
  stem.geometry.translate(0, 0.5, 0); stem.position.copy(P); scene.add(stem);
  const dot = glowSprite(new THREE.Color('#c8ff7a'), 14, 0); dot.position.copy(P); scene.add(dot);
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.stroke(); return new THREE.CanvasTexture(c); })();
  const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, color: '#a8e05a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.position.copy(P).setY(DEPTH + 1.6); scene.add(m); return m; });

  // conexões conceituais (arcos com cabeça luminosa, dissolvendo antes do destino)
  const R = rng(316);
  const arcs = [];
  const dirs = [150, 163, 176, 189, 202, 215, 228, 241, 254, 140];
  for (let i = 0; i < dirs.length; i++) {
    const a = THREE.MathUtils.degToRad(dirs[i]) + (R() - 0.5) * 0.12, len = 70 + R() * 150;
    const end = new THREE.Vector3(px + Math.cos(a) * len, DEPTH + 1.5, pz - Math.sin(a) * len);
    const mid = P.clone().lerp(end, 0.5); mid.y += len * 0.28;
    const curve = new THREE.QuadraticBezierCurve3(P.clone(), mid, end);
    const g = new THREE.TubeGeometry(curve, 90, 0.3, 5, false);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.15, 0.45), transparent: true, opacity: 0.9, depthWrite: false })); scene.add(m);
    const head = glowSprite(new THREE.Color('#dfffb0'), 7, 0); scene.add(head);
    arcs.push({ curve, m, head, total: g.index.count, delay: (i % 5) * 0.11 + Math.floor(i / 5) * 0.32 });
  }

  // grade de base
  const gt = tex.grid(); gt.repeat.set(60, 60);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ map: gt, color: '#24301f', transparent: true, opacity: 0.55, depthWrite: false }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = -0.5; scene.add(grid);

  scene.add(new THREE.HemisphereLight('#c9d6c0', '#050605', 1.2));
  const key = new THREE.DirectionalLight('#ffffff', 1.8); key.position.set(-300, 500, 400); scene.add(key);
  const rim = new THREE.DirectionalLight('#a6e05a', 1.2); rim.position.set(400, 120, -500); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(40, 1080 / 1920, 1, 5000);
  const v = new THREE.Vector3();
  const anchors = {};
  const project = (name, p) => { v.copy(p).project(camera); anchors[name] = { x: (v.x * 0.5 + 0.5) * 1080, y: (-v.y * 0.5 + 0.5) * 1920, vis: v.z < 1 }; };

  function update(t, shot) {
    const k = shot.local;
    renderer.toneMappingExposure = 1.3;
    // voo: visão oblíqua do estado (de sudoeste) -> aproximação de Pedreira
    const fly = seg(k, 0, 1.05, E.inOutCubic), drift = seg(k, 0.9, shot.dur, E.inOutSine);
    const camA = new THREE.Vector3(160, 1050, 760), lookA = new THREE.Vector3(-30, 0, -60);
    const camB = new THREE.Vector3(px + 62, 100, pz + 118), lookB = new THREE.Vector3(px - 6, DEPTH, pz - 8);
    const camC = new THREE.Vector3(px + 46, 78, pz + 92);
    camera.position.lerpVectors(camA, camB, fly).lerp(camC, drift * 0.9);
    const look = lookA.clone().lerp(lookB, E.inOutQuart(inv(0, 1.05, k)));
    camera.lookAt(look);
    lensShift(camera, 0.1);

    const hp = E.outQuart(inv(0.85, 1.25, k));
    pFill.material.opacity = 0.55 * hp; pLine.material.opacity = hp;
    stem.scale.set(1, 1 + 18 * E.outExpo(inv(0.9, 1.3, k)), 1); stem.visible = k > 0.9;
    dot.material.opacity = hp; dot.position.copy(P).setY(P.y + stem.scale.y);
    rings.forEach((r, i) => { const ph = ((k - 0.95) * 0.8 + i / 3) % 1; const on = k > 0.95 ? 1 : 0; r.scale.setScalar(4 + ph * 46); r.material.opacity = on * (1 - ph) * 0.7; });
    arcs.forEach(a => {
      const st = 1.55 + a.delay, u = (k - st) / 1.1;
      const head = clamp(u), tail = clamp(u - 0.45);
      const fade = 1 - E.inCubic(clamp((u - 0.9) / 0.5));
      a.m.geometry.setDrawRange(Math.floor(a.total * tail / 3) * 3, Math.max(0, Math.floor(a.total * (head - tail) / 3) * 3));
      a.m.material.opacity = 0.85 * fade;
      a.curve.getPoint(head, a.head.position); a.head.material.opacity = u > 0 && u < 1 ? 0.9 * fade : 0;
    });
    borders.material.opacity = 0.3 + 0.1 * hp;
    camera.updateMatrixWorld(); dot.updateMatrixWorld();
    project('pin', dot.position);
    project('state', new THREE.Vector3(-60, DEPTH, -20));
    return { anchors };
  }
  return { scene, camera, update };
}
