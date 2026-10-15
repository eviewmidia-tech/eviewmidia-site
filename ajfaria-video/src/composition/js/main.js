import * as THREE from 'three';
import { W, H, E, inv, lerp, clamp } from './util.js';
import { studioEnv, duskEnv, nightEnv } from './envmaps.js';
import { createStudio } from './scenes/studio.js';
import { createHighway } from './scenes/highway.js';
import { createLogistics } from './scenes/logistics.js';
import { createMap } from './scenes/map.js';
import { loadIcons } from './icons.js';
import { buildOverlay, updateOverlay } from './overlay.js';

const canvas = document.getElementById('gl');
const prev = document.getElementById('prev');
const prevCtx = prev.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const envs = { studio: studioEnv(renderer), dusk: duskEnv(renderer), night: nightEnv(renderer) };
const icons = await loadIcons();
const spGeo = await (await fetch('./assets/sp-map.json')).json();
const S = {
  studio: createStudio(renderer, envs.studio),
  highway: createHighway(renderer, envs.dusk),
  logistics: createLogistics(renderer, envs.night, icons),
  map: createMap(renderer, spGeo),
};

// Timeline ancorada na narração oficial (ver audio/vo_timing.md); cortes na grade de colcheias de 90 BPM.
const B8 = 60 / 90 / 2;
const SHOTS = [
  { a: 0, b: 4 * B8, scene: 'highway', mode: 'dusk', x0: 0 },                  // 0.000–1.333 impacto
  { a: 4 * B8, b: 10 * B8, scene: 'highway', mode: 'night', x0: 0 },          // 1.333–3.333 composição escura
  { a: 10 * B8, b: 23 * B8, scene: 'logistics', mode: 'interior' },           // 3.333–7.667 expedição + 2.5D
  { a: 23 * B8, b: 36 * B8, scene: 'studio', cam: 'hero' },                   // 7.667–12.0 logo + caminhão
  { a: 36 * B8, b: 51 * B8, scene: 'studio', cam: 'side' },                   // 12.0–17.0 +16 anos
  { a: 51 * B8, b: 55 * B8, scene: 'logistics', mode: 'prep' },               // 17.0–18.333 SUA OPERAÇÃO
  { a: 55 * B8, b: 59 * B8, scene: 'logistics', mode: 'loading' },            // 18.333–19.667 SUA LOGÍSTICA
  { a: 59 * B8, b: 64 * B8, scene: 'highway', mode: 'golden', x0: 300 },      // 19.667–21.333 SUAS MERCADORIAS
  { a: 64 * B8, b: 73 * B8, scene: 'highway', mode: 'horizon', x0: -120 },    // 21.333–24.333 parceria de longo prazo
  { a: 73 * B8, b: 82 * B8, scene: 'map' },                                   // 24.333–27.333 Pedreira | SP
  { a: 82 * B8, b: 30.0, scene: 'logistics', mode: 'dock' },                  // 27.333–29.667 (+ sob a máscara do CTA)
  { a: 30.0, b: 35.01, scene: 'cta' },                                        // CTA (camada DOM)
];

// Transições: o plano anterior é copiado para #prev (abaixo) e o novo é revelado em #gl (acima).
const TRANS = [
  { a: 1.18, b: 1.48, at: 4 * B8, type: 'slant', dir: 1 },
  { a: 3.2, b: 3.46, at: 10 * B8, type: 'push' },
  { a: 7.5, b: 7.84, at: 23 * B8, type: 'depth' },
  { a: 24.18, b: 24.5, at: 73 * B8, type: 'band', y: 1010 },
  { a: 27.18, b: 27.48, at: 82 * B8, type: 'slant', dir: -1 },
];
const SLIDES = [51 * B8, 55 * B8, 59 * B8, 64 * B8]; // cortes secos com deslize direcional (match cut)

window.SHUTTER_SAMPLES = (t) => {
  if (t < 1.18) return 5;
  if (t < 1.5) return 4;
  if (t < 3.2) return 2;
  if (t < 3.5) return 5;
  if (t >= 7.5 && t < 7.85) return 3;
  if (SLIDES.some(c => t >= c && t < c + 0.25)) return 4;
  if (t >= 59 * B8 && t < 64 * B8) return 5;
  if (t >= 17 && t < 24.333) return 2;
  if (t >= 24.18 && t < 25.5) return 3;
  if (t >= 27.18 && t < 27.5) return 3;
  return 1;
};

const shotAt = (t) => SHOTS.find(s => t >= s.a && t < s.b) || SHOTS[SHOTS.length - 1];
function renderShot(shot, t) {
  const sc = S[shot.scene];
  if (!sc) { renderer.setClearColor('#0B0D0A'); renderer.clear(); return {}; }
  const info = { ...shot, local: t - shot.a, dur: shot.b - shot.a, t };
  const ctx = sc.update(t, info) || {};
  renderer.render(sc.scene, sc.camera);
  return ctx;
}

const stage = document.getElementById('stage'), ov = document.getElementById('ov');
const fx = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
fx.setAttribute('width', 1080); fx.setAttribute('height', 1920); fx.style.cssText = 'position:absolute;inset:0;pointer-events:none';
fx.innerHTML = '<line id="edge" stroke="#97C93D" stroke-width="12" stroke-linecap="square"/><line id="edge2" stroke="#F3F5F1" stroke-opacity="0.55" stroke-width="3"/>';
stage.insertBefore(fx, ov);
const edge = fx.querySelector('#edge'), edge2 = fx.querySelector('#edge2');
const flash = document.createElement('div'); flash.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 45% at 50% 52%, rgba(214,240,170,0.75), rgba(214,240,170,0) 70%);opacity:0';
stage.insertBefore(flash, ov);
const SL = Math.tan(14 * Math.PI / 180) * 1920; // deslocamento horizontal da borda inclinada (ângulo do itálico do logo)
const setLine = (l, x1, y1, x2, y2, o) => { l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); l.setAttribute('stroke-opacity', o); };

function resetLayers() {
  for (const c of [canvas, prev]) { c.style.clipPath = 'none'; c.style.transform = 'none'; c.style.opacity = '1'; }
  prev.style.visibility = 'hidden'; canvas.style.visibility = 'visible';
  edge.setAttribute('stroke-opacity', 0); edge2.setAttribute('stroke-opacity', 0); flash.style.opacity = 0;
}

for (const w of [500, 600, 800]) await document.fonts.load(`${w} 100px Montserrat`);
await document.fonts.ready;
const overlay = buildOverlay(ov, './assets/ajfaria-logo.svg');

// tc = tempo central do quadro (define o plano); t = instante da sub-amostra (animação e motion blur)
window.renderAt = async (t, tc = t) => {
  resetLayers();
  const tr = TRANS.find(x => tc >= x.a && tc < x.b);
  let ctx;
  if (tr) {
    const p = inv(tr.a, tr.b, t), eo = Math.sin(Math.PI * clamp(p));
    renderShot(shotAt(tr.at - 1e-4), t);
    prevCtx.drawImage(canvas, 0, 0); prev.style.visibility = 'visible';
    ctx = renderShot(shotAt(tr.at + 1e-4), t);
    if (tr.type === 'slant') {
      const e = E.inOutQuart(p);
      const x = tr.dir > 0 ? lerp(-10, 1080 + SL + 10, e) : lerp(1080 + SL + 10, -10, e);
      canvas.style.clipPath = tr.dir > 0 ? `polygon(0px 0px, ${x}px 0px, ${x - SL}px 1920px, 0px 1920px)` : `polygon(${x}px 0px, 1080px 0px, 1080px 1920px, ${x - SL}px 1920px)`;
      setLine(edge, x, -10, x - SL, 1930, eo); setLine(edge2, x, -10, x - SL, 1930, eo * 0.8);
    } else if (tr.type === 'push') {
      const e = E.inOutQuart(p);
      prev.style.transform = `translateY(${-e * 1920}px)`; canvas.style.transform = `translateY(${(1 - e) * 1920}px)`;
      const y = (1 - e) * 1920; setLine(edge, 0, y, 1080, y, eo);
    } else if (tr.type === 'depth') {
      const e = E.inOutCubic(p);
      prev.style.transform = `scale(${1 + e * 0.22})`; prev.style.opacity = (1 - e).toFixed(3);
      canvas.style.opacity = E.inCubic(clamp((p - 0.35) / 0.65)).toFixed(3);
      canvas.style.transform = `scale(${lerp(1.08, 1, E.outCubic(p))})`;
      flash.style.opacity = (eo * 0.45).toFixed(3);
    } else if (tr.type === 'band') {
      const e = E.inOutQuart(p), h = e * 1920 * 1.15;
      const top = Math.max(0, tr.y - h * 0.55), bot = Math.max(0, 1920 - tr.y - h * 0.45);
      canvas.style.clipPath = `inset(${top}px 0px ${bot}px 0px)`;
      setLine(edge, 0, top, 1080, top, eo * 0.9); setLine(edge2, 0, 1920 - bot, 1080, 1920 - bot, eo * 0.9);
    }
  } else {
    const shot = shotAt(tc);
    ctx = renderShot(shot, t);
    const cut = SLIDES.find(c => tc >= c && tc < c + 0.3);
    if (cut != null) { const e = E.outQuart(inv(cut, cut + 0.3, t)); canvas.style.transform = `translateX(${(1 - e) * -70}px) scale(${lerp(1.07, 1.0, e)})`; }
    if (shot.scene === 'cta') canvas.style.visibility = 'hidden';
  }
  updateOverlay(overlay, t, ctx || {});
  const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
};
window.ready = true;
