import * as THREE from 'three';
import { buildTruck } from '../truck.js';
import { seg, E, lerp, rng, glowSprite, tex, lensShift, clamp } from '../util.js';

// Rodovia duplicada no interior paulista, com área industrial ao fundo.
// Modos: 'dusk' (cena 1 – travelling lateral), 'night' (cena 1 – composição escura vista de cima),
//        'golden' (cena 5 – caminhão em deslocamento).
export function createHighway(renderer, env) {
  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2('#b88b6a', 0.0042); scene.fog = fog;
  const R = rng(2024);

  // céu + raios de sol
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0.28, 0.035, -1).normalize() }, sunColor: { value: new THREE.Color('#ffd6a0') }, sunGlow: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, mid, horizon, sunColor, sunDir; uniform float sunGlow; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.22, h)); c = mix(c, top, smoothstep(0.2, 0.85, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 60.0) * 0.55 + pow(s, 8.0) * 0.22) * sunGlow;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMat); scene.add(sky);

  const raysTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'); const r = rng(9);
    g.translate(512, 512);
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, w = 0.01 + r() * 0.05, len = 380 + r() * 130;
      const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      gr.addColorStop(0, `rgba(255,255,255,${0.18 + r() * 0.3})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, len, a - w, a + w); g.closePath(); g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(512, 512, 0, 512, 512, 512); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, 1024, 1024);
    return new THREE.CanvasTexture(c);
  })();
  const rays = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: raysTex, color: '#ffcf98', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  scene.add(rays);
  const sunGlow = glowSprite(new THREE.Color('#ffd9a8'), 260, 0.8); scene.add(sunGlow);

  // chão, pistas e sinalização
  const grassMat = new THREE.MeshLambertMaterial({ map: tex.grass(), color: '#7d8a6a' });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), grassMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
  const asph = tex.asphalt(); asph.repeat.set(160, 2);
  const roadMat = new THREE.MeshLambertMaterial({ map: asph, color: '#9a9a9a' });
  for (const zc of [4.85, -8.85]) { const road = new THREE.Mesh(new THREE.PlaneGeometry(1600, 9.7), roadMat); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, zc); road.receiveShadow = true; scene.add(road); }
  const median = new THREE.Mesh(new THREE.PlaneGeometry(1600, 4), new THREE.MeshLambertMaterial({ color: '#3b4230' })); median.rotation.x = -Math.PI / 2; median.position.set(0, 0.01, -2); scene.add(median);
  const lineMat = new THREE.MeshBasicMaterial({ color: '#d9d9d2' }); lineMat.color.multiplyScalar(0.85);
  const lines = new THREE.Group(); scene.add(lines);
  for (const z of [0.15, 7.05, -4.15, -11.05]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(1600, 0.15), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.015, z); lines.add(l); }
  const dashGeo = new THREE.PlaneGeometry(4, 0.15); dashGeo.rotateX(-Math.PI / 2);
  const dashes = new THREE.InstancedMesh(dashGeo, lineMat, 280); const o = new THREE.Object3D(); let di = 0;
  for (const z of [3.6, -7.6]) for (let i = 0; i < 140; i++) { o.position.set(-700 + i * 12, 0.016, z); o.updateMatrix(); dashes.setMatrixAt(di++, o.matrix); }
  scene.add(dashes);
  // barreira New Jersey no canteiro central
  const njShape = new THREE.Shape(); njShape.moveTo(-0.3, 0); njShape.lineTo(-0.25, 0.25); njShape.lineTo(-0.1, 0.4); njShape.lineTo(-0.08, 0.81); njShape.lineTo(0.08, 0.81); njShape.lineTo(0.1, 0.4); njShape.lineTo(0.25, 0.25); njShape.lineTo(0.3, 0); njShape.closePath();
  const nj = new THREE.Mesh(new THREE.ExtrudeGeometry(njShape, { depth: 1600, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: '#9b9d96' }));
  nj.rotation.y = Math.PI / 2; nj.position.set(-800, 0, -2); nj.castShadow = nj.receiveShadow = true; scene.add(nj);
  // defensa metálica no acostamento
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1600, 0.32, 0.06), new THREE.MeshStandardMaterial({ color: '#a7aca8', metalness: 0.7, roughness: 0.35 }));
  rail.position.set(0, 0.62, 10.6); scene.add(rail);
  const postGeo = new THREE.BoxGeometry(0.12, 0.75, 0.12); const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: '#5d625e' }), 400);
  for (let i = 0; i < 400; i++) { o.position.set(-800 + i * 4, 0.37, 10.68); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); } scene.add(posts);

  // postes de iluminação no canteiro (braço duplo)
  const poleMat = new THREE.MeshLambertMaterial({ color: '#4a4f4c' });
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.25, 0.9) });
  const poleGlows = [];
  for (let i = 0; i < 40; i++) {
    const x = -760 + i * 40;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 12, 8), poleMat); p.position.set(x, 6, -2); scene.add(p);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.2), poleMat); arm.position.set(x, 11.9, -2 + s * 1.6); scene.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.32), lampMat); lamp.position.set(x, 11.8, -2 + s * 3.1); scene.add(lamp);
      const gl = glowSprite(new THREE.Color('#ffc988'), 5, 0.0); gl.position.set(x, 11.6, -2 + s * 3.1); scene.add(gl); poleGlows.push(gl);
    }
  }

  // vegetação (silhuetas) e área industrial ao fundo
  const treeGeo = new THREE.IcosahedronGeometry(1, 1);
  const treeMat = new THREE.MeshLambertMaterial({ color: '#2f3a26' });
  const NT = 700; const trees = new THREE.InstancedMesh(treeGeo, treeMat, NT);
  for (let i = 0; i < NT; i++) {
    const side = i < 420 ? -1 : 1;
    const z = side < 0 ? -26 - Math.pow(R(), 0.8) * 55 : 22 + R() * 60;
    const euc = R() < 0.3;
    const h = euc ? 11 + R() * 8 : 4 + R() * 6, wdt = euc ? 1.6 + R() * 1.2 : 2.5 + R() * 3;
    o.position.set(-700 + R() * 1400, h * 0.62, z); o.scale.set(wdt, h * 0.62, wdt); o.rotation.set(0, R() * 6, 0); o.updateMatrix(); trees.setMatrixAt(i, o.matrix);
  }
  scene.add(trees);
  const indMat = new THREE.MeshLambertMaterial({ color: '#2b2f31' });
  const indMat2 = new THREE.MeshLambertMaterial({ color: '#3a3f40' });
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.05, 0.7) });
  const redMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.1, 0.05) });
  const industry = new THREE.Group(); scene.add(industry);
  const redGlows = [];
  for (let i = 0; i < 46; i++) {
    const x = -650 + i * 30 + R() * 20, z = -95 - R() * 220;
    const L = 40 + R() * 90, Hh = 10 + R() * 14, D = 30 + R() * 50;
    const b = new THREE.Mesh(new THREE.BoxGeometry(L, Hh, D), R() < 0.5 ? indMat : indMat2); b.position.set(x, Hh / 2, z); industry.add(b);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, L, 3, 1), b.material); roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 2; roof.scale.set(1, 1, 0.18); roof.position.set(x, Hh, z); industry.add(roof);
    if (R() < 0.7) { const w = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.8, 0.6), winMat); w.position.set(x, Hh * 0.55, z + D / 2 + 0.05); industry.add(w); }
    if (R() < 0.35) { // silos
      for (let k = 0; k < 3; k++) { const sh = 20 + R() * 18; const si = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, sh, 16), indMat2); si.position.set(x + L / 2 + 8 + k * 11, sh / 2, z + 8); industry.add(si); const cone = new THREE.Mesh(new THREE.ConeGeometry(5.2, 4, 16), indMat2); cone.position.set(si.position.x, sh + 2, si.position.z); industry.add(cone); }
    }
    if (R() < 0.3) { // chaminés com luz de balizamento
      const ch = 45 + R() * 30; const c = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, ch, 12), indMat); c.position.set(x - L / 3, ch / 2, z - 6); industry.add(c);
      const rl = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), redMat); rl.position.set(c.position.x, ch + 0.5, c.position.z); industry.add(rl);
      const rg = glowSprite(new THREE.Color('#ff3a1a'), 10, 0.0); rg.position.copy(rl.position); industry.add(rg); redGlows.push(rg);
    }
  }
  // torres de iluminação do pátio industrial
  for (let i = 0; i < 18; i++) { const x = -600 + i * 70 + R() * 30, z = -110 - R() * 60; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 30, 6), indMat); t.position.set(x, 15, z); industry.add(t); const g = glowSprite(new THREE.Color('#ffe2b8'), 18, 0); g.position.set(x, 30, z); industry.add(g); redGlows.push(g); }

  // luzes
  const hemi = new THREE.HemisphereLight('#c7b9a6', '#2a2620', 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc48a', 2.6); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 300 });

  // caminhão principal + tráfego
  const truck = buildTruck(env); truck.position.set(0, 0, 5.4); scene.add(truck);
  const headL = [];
  for (const s of [-1, 1]) { const sl = new THREE.SpotLight('#fff1dc', 0, 90, 0.42, 0.6, 1.2); sl.position.set(0.3, 1.3, s * 0.9); sl.target.position.set(40, -1, s * 2); truck.add(sl, sl.target); headL.push(sl); }
  const traffic = [];
  for (let i = 0; i < 5; i++) { const tk = buildTruck(env); tk.rotation.y = Math.PI; tk.position.set(-200 + i * 140, 0, -9.6 + (i % 2) * 3.6); scene.add(tk); traffic.push({ obj: tk, x0: -200 + i * 140, v: -(20 + (i % 3) * 3) }); }

  // rastros de luz (linhas de movimento) — composição noturna
  const streakTex = tex.streak();
  const streaks = []; const SR = rng(55);
  for (let i = 0; i < 64; i++) {
    const lane = [1.8, 5.4, -6.0, -9.6][i % 4];
    const len = 25 + SR() * 55;
    const green = SR() < 0.28;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.22 + SR() * 0.25), new THREE.MeshBasicMaterial({ map: streakTex, color: green ? '#a8e05a' : lane > 0 ? '#ffe9cf' : '#ff5a3c', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; if (lane < 0) m.rotation.z = Math.PI;
    m.position.y = 0.6 + SR() * 0.6;
    scene.add(m); streaks.push({ m, lane: lane + (SR() - 0.5) * 1.2, len, x0: -300 + SR() * 600, v: (lane > 0 ? 1 : -1) * (45 + SR() * 35) });
  }
  // partículas suspensas
  const NP = 600, pp = new Float32Array(NP * 3); const PR = rng(7);
  for (let i = 0; i < NP; i++) { pp[i * 3] = (PR() - 0.5) * 120; pp[i * 3 + 1] = PR() * 30; pp[i * 3 + 2] = (PR() - 0.5) * 60; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const particles = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.09, color: '#d8e6c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(particles);

  const camera = new THREE.PerspectiveCamera(45, 1080 / 1920, 0.5, 3000);
  const look = new THREE.Vector3();

  const LOOKS = {
    dusk: { top: '#26314a', mid: '#9a8590', horizon: '#ffb46e', fog: '#c08a64', fogD: 0.0036, sun: 2.4, hemi: 0.5, exposure: 1.0, sunGlow: 1, rays: 0.55, lamps: 0.6, head: 0 },
    horizon: { top: '#26304a', mid: '#a5807e', horizon: '#f6b47a', fog: '#c09070', fogD: 0.0030, sun: 2.6, hemi: 0.7, exposure: 0.95, sunGlow: 0.55, rays: 0.32, lamps: 0.2, head: 0 },
  golden: { top: '#2c3a56', mid: '#a68e90', horizon: '#ffc488', fog: '#c99a70', fogD: 0.0034, sun: 2.8, hemi: 0.85, exposure: 1.02, sunGlow: 1, rays: 0.45, lamps: 0.3, head: 0 },
    night: { top: '#020303', mid: '#06080a', horizon: '#141c18', fog: '#080b0a', fogD: 0.009, sun: 0.0, hemi: 0.12, exposure: 1.0, sunGlow: 0, rays: 0, lamps: 1, head: 260 },
  };

  function update(t, shot) {
    const k = shot.local, mode = shot.mode;
    const L = LOOKS[mode];
    skyMat.uniforms.top.value.set(L.top); skyMat.uniforms.mid.value.set(L.mid); skyMat.uniforms.horizon.value.set(L.horizon); skyMat.uniforms.sunGlow.value = L.sunGlow;
    fog.color.set(L.fog); fog.density = L.fogD;
    sun.intensity = L.sun; hemi.intensity = L.hemi;
    renderer.toneMappingExposure = L.exposure;
    for (const g of poleGlows) g.material.opacity = L.lamps * 0.9;
    for (const g of redGlows) g.material.opacity = mode === 'night' ? 0.25 : 0.6;
    lampMat.color.setRGB(1.5, 1.25, 0.9).multiplyScalar(0.4 + L.lamps * 0.6);
    winMat.color.setRGB(1.3, 1.05, 0.7).multiplyScalar(mode === 'night' ? 0.25 : 0.8);
    for (const h of headL) h.intensity = L.head;
    truck.userData.lights(true);
    sky.visible = true;

    // caminhão a ~80 km/h
    const v = shot.speed ?? 22;
    const tx = (shot.x0 ?? 0) + v * k;
    truck.position.x = tx; truck.userData.drive(tx);
    for (const tr of traffic) { tr.obj.position.x = tr.x0 + tr.v * (t - 0) + tx * 0.0; tr.obj.userData.drive(-tr.obj.position.x); }

    // sol, raios
    const sd = skyMat.uniforms.sunDir.value;
    const camRef = new THREE.Vector3();
    for (const s of streaks) { s.m.material.opacity = 0; }
    particles.material.opacity = 0;

    if (mode === 'dusk' || mode === 'golden' || mode === 'horizon') {
      if (mode === 'dusk') {
        const p = seg(k, 0, shot.dur, E.inOutSine);
        camera.position.set(tx + lerp(12.5, 8.0, p), lerp(0.85, 1.3, p), lerp(9.6, 9.2, p));
        look.set(tx - 6.5, lerp(3.2, 2.9, p), lerp(1.0, 2.0, p));
        camera.fov = 48;
      } else if (mode === 'horizon') {
        // por trás do caminhão, rumo ao horizonte: o caminhão ganha distância (visão de longo prazo)
        const p = seg(k, 0, shot.dur, E.inOutSine);
        const cx = (shot.x0 ?? 0) + v * k * 0.82 - 20;
        camera.position.set(cx, lerp(3.6, 4.4, p), lerp(8.6, 7.4, p));
        look.set(cx + 70, 3.2, 3.2);
        camera.fov = 44;
      } else {
        // panorâmica a partir de um ponto fixo, acompanhando o caminhão da esquerda para a direita
        const cx = (shot.x0 ?? 0) + v * shot.dur * 0.5;
        camera.position.set(cx - 4, 2.6, 38);
        look.set(tx - 7.5, 3.4, 5.4);
        camera.fov = 40;
      }
      camera.up.set(0, 1, 0);
      camera.lookAt(look);
      lensShift(camera, shot.shiftY ?? 0.18);
      if (mode === 'dusk') sd.set(-0.86, 0.075, -0.5).normalize(); else if (mode === 'horizon') sd.set(1, 0.05, -0.12).normalize(); else sd.set(0.3, 0.035, -1).normalize();
      camRef.copy(camera.position).addScaledVector(sd, 1200);
      rays.position.copy(camRef); rays.lookAt(camera.position); rays.material.opacity = L.rays * (0.85 + 0.15 * Math.sin(t * 2.0));
      rays.rotation.z += k * 0.02;
      sunGlow.position.copy(camera.position).addScaledVector(sd, 1100); sunGlow.material.opacity = mode === 'horizon' ? 0.35 : 0.75;
      sun.position.copy(truck.position).addScaledVector(sd, 120).setY(14); sun.target.position.copy(truck.position);
      rays.visible = sunGlow.visible = true;
    } else {
      // composição escura: vista de drone, estrada na vertical do quadro
      rays.visible = sunGlow.visible = false;
      const p = seg(k, 0, shot.dur, E.inOutSine);
      const cx = tx + lerp(-58, -46, p);
      camera.position.set(cx, lerp(23, 18, p), lerp(-1.0, 0.6, p));
      camera.up.set(0, 1, 0);
      camera.lookAt(cx + 60, 0, lerp(-1.5, 0.5, p));
      camera.fov = 52; lensShift(camera, shot.shiftY ?? -0.05);
      for (const s of streaks) {
        const span = 600;
        let x = s.x0 + s.v * t; x = ((x - cx + span / 2) % span + span) % span + cx - span / 2;
        s.m.position.set(x, s.m.position.y, s.lane);
        s.m.material.opacity = 0.55 * seg(k, 0.0, 0.5, E.outCubic);
      }
      particles.position.set(cx, 8, 0); particles.rotation.y = t * 0.03;
      particles.material.opacity = 0.6 * seg(k, 0.1, 0.8);
      sun.position.set(tx, 50, 20); sun.target.position.copy(truck.position);
    }
  }
  return { scene, camera, update };
}
