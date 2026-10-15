import * as THREE from 'three';

export const W = 1080, H = 1920, FPS = 30, DURATION = 35;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));

export const E = {
  linear: t => t,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuart: t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
};

// progress of t inside [a,b] with easing
export const seg = (t, a, b, ease = E.inOutCubic) => ease(inv(a, b, t));

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const C = {
  green: new THREE.Color('#97C93D'),
  greenHex: '#97C93D',
  greenDeep: '#3D5719',
  graphite: '#0B0D0A',
  metal: '#8B928A',
  white: '#F3F5F1',
};

// ---------- procedural canvas textures ----------
function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noiseFill(g, w, h, base, amp, seed, size = 1) {
  const r = rng(seed);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) {
    const n = (r() - 0.5) * amp;
    for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
      const i = ((y + yy) * w + (x + xx)) * 4;
      d[i] = clamp(base[0] + n, 0, 255); d[i + 1] = clamp(base[1] + n, 0, 255); d[i + 2] = clamp(base[2] + n, 0, 255); d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

export const tex = {
  asphalt: () => canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, [46, 47, 48], 26, 11);
    const r = rng(5);
    for (let i = 0; i < 40; i++) { // patches and tire wear
      g.fillStyle = `rgba(${r() < 0.5 ? '20,20,22' : '70,70,72'},${0.05 + r() * 0.08})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 80, 6 + r() * 30, r() * 3, 0, 7); g.fill();
    }
  }, { repeat: [40, 4] }),
  concrete: () => canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, [118, 120, 118], 14, 21, 2);
    const r = rng(9);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${r() < 0.6 ? '80,82,80' : '150,152,150'},${0.04 + r() * 0.06})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 90, 10 + r() * 60, r() * 3, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 2; // slab joints
    g.strokeRect(0, 0, w, h);
  }, { repeat: [12, 12] }),
  grass: () => canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, [38, 46, 30], 22, 31, 2), { repeat: [200, 200] }),
  cardboard: () => canvasTex(256, 256, (g, w, h) => {
    noiseFill(g, w, h, [176, 136, 92], 12, 41, 1);
    g.fillStyle = 'rgba(205,170,120,0.85)'; g.fillRect(w * 0.44, 0, w * 0.12, h); // tape
    g.fillStyle = 'rgba(80,60,40,0.25)'; g.fillRect(0, h * 0.495, w, h * 0.01); // flap seam
    g.fillStyle = 'rgba(40,40,40,0.55)'; g.fillRect(w * 0.08, h * 0.72, w * 0.22, h * 0.14); // label block
    g.fillStyle = 'rgba(240,240,236,0.9)'; g.fillRect(w * 0.08, h * 0.72, w * 0.22, h * 0.035);
  }),
  wood: () => canvasTex(256, 64, (g, w, h) => {
    noiseFill(g, w, h, [150, 118, 80], 18, 51, 1);
    const r = rng(3);
    for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(90,62,36,${0.2 + r() * 0.2})`; g.beginPath(); g.moveTo(0, r() * h); g.bezierCurveTo(w * 0.3, r() * h, w * 0.6, r() * h, w, r() * h); g.stroke(); }
  }),
  panelRibs: (ribs = 24) => canvasTex(1024, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4f6f5'); gr.addColorStop(1, '#dde1df');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i <= ribs; i++) { const x = (i / ribs) * w; g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x - 1, 0, 3, h); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 2, 0, 1, h); }
  }, { repeat: [1, 1] }),
  cladding: () => canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#2a2f2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 32; i++) { const x = (i / 32) * w; const gr = g.createLinearGradient(x, 0, x + w / 32, 0); gr.addColorStop(0, '#3a403c'); gr.addColorStop(0.5, '#262a28'); gr.addColorStop(1, '#1c201e'); g.fillStyle = gr; g.fillRect(x, 0, w / 32, h); }
  }, { repeat: [6, 1] }),
  glow: () => canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { srgb: false }),
  beam: () => canvasTex(64, 256, (g, w, h) => { // vertical light shaft, bright at top
    const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gx; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const gy = g.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gy; g.fillRect(0, 0, w, h);
  }, { srgb: false }),
  streak: () => canvasTex(512, 16, (g, w, h) => { // light trail: bright head on the right
    const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.85, 'rgba(255,255,255,0.7)'); gx.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gx; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const gy = g.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.5, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gy; g.fillRect(0, 0, w, h);
  }, { srgb: false }),
  grid: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
  }, { srgb: false }),
};

// sky dome with vertical gradient + sun glow
export function makeSky(radius = 900) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#0b1220') }, mid: { value: new THREE.Color('#41506a') }, horizon: { value: new THREE.Color('#e3a46a') },
      sunDir: { value: new THREE.Vector3(0, 0.05, -1).normalize() }, sunColor: { value: new THREE.Color('#ffd9a0') }, sunSize: { value: 0.9995 }, sunGlow: { value: 1.0 },
      exposure: { value: 1 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top, mid, horizon, sunColor; uniform vec3 sunDir; uniform float sunSize, sunGlow, exposure; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, -0.2, 1.0);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.15, 0.7, h));
        c = mix(c, horizon * 0.35, smoothstep(0.0, -0.15, h));
        float d = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunColor * (pow(d, 600.0) * 4.0 + pow(d, 40.0) * 0.6 + pow(d, 6.0) * 0.25) * sunGlow;
        gl_FragColor = vec4(c * exposure, 1.0); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
}

// additive billboard glow
export function glowSprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: tex._glow || (tex._glow = tex.glow()), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}

export function beamMesh(color, w, h, opacity = 0.25) {
  const m = new THREE.MeshBasicMaterial({ map: tex._beam || (tex._beam = tex.beam()), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, -h / 2, 0);
  return new THREE.Mesh(geo, m);
}

// SVG string -> canvas texture (icons)
export async function svgTexture(svg, size = 256) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(img, 0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// deslocamento óptico vertical (lens shift): reposiciona o quadro sem inclinar a câmera,
// mantendo as verticais paralelas (composição arquitetônica)
export function lensShift(camera, sy, sx = 0) {
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[9] = sy;
  camera.projectionMatrix.elements[8] = sx;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
