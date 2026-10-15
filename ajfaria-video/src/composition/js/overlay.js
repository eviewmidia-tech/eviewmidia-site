import { E, inv, clamp, lerp, rng } from './util.js';
import { ICON_SVG } from './icons.js';

// Camada tipográfica e gráfica (DOM). Todos os tempos seguem audio/vo_timing.md.
// Área de segurança Reels/Stories: textos críticos entre y=290 e y=1250, x entre 84 e 996.
const X0 = 84, TW = 912;

const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; };
const css = (e, o) => Object.assign(e.style, o);

const meas = document.createElement('canvas').getContext('2d');
function fit(text, weight, target, max = 400, spacing = -0.01) {
  meas.font = `${weight} 100px Montserrat`;
  const w = meas.measureText(text).width + spacing * 100 * (text.length - 1);
  return Math.min(max, (target / w) * 100);
}

// linha com máscara: o conteúdo sobe por trás de uma janela
function maskLine(parent, html, { size, weight = 800, color, top, left = X0, align = 'left', width, cls = 'h', spacing } = {}) {
  const m = el('div', 'mask abs', parent); const i = el('span', 'in ' + cls, m, html);
  css(m, { top: top + 'px', left: left + 'px' }); css(i, { fontSize: size + 'px', fontWeight: weight });
  if (color) i.style.color = color;
  if (spacing != null) i.style.letterSpacing = spacing;
  if (align === 'center') { css(m, { left: '0px', width: '1080px', textAlign: 'center' }); }
  return i;
}
function anim(i, t, tin, tout, { dur = 0.55, outDur = 0.32, from = 112, blur = 10, ease = E.outQuart, dir = 'y' } = {}) {
  const a = ease(inv(tin, tin + dur, t));
  const b = tout != null ? E.inCubic(inv(tout, tout + outDur, t)) : 0;
  const off = (1 - a) * from - b * from;
  const vis = t >= tin && !(tout != null && t > tout + outDur);
  i.parentElement.style.visibility = vis ? 'visible' : 'hidden';
  i.style.transform = dir === 'y' ? `translate3d(0, ${off}%, 0)` : `translate3d(${(1 - a) * -from + b * from}px, 0, 0)`;
  const bl = (1 - a) + b; i.style.filter = bl > 0.02 ? `blur(${(bl * blur).toFixed(2)}px)` : 'none';
  return a * (1 - b);
}
// rótulo espaçado: abre o tracking enquanto entra
function label(parent, text, { size = 30, top, left = X0, align = 'left', color = 'var(--metal)', spacing = 0.32, weight = 600 } = {}) {
  const e = el('div', 'label abs', parent, text);
  css(e, { fontSize: size + 'px', top: top + 'px', color, fontWeight: weight });
  if (align === 'center') css(e, { left: '0px', width: '1080px', textAlign: 'center' }); else e.style.left = left + 'px';
  e.dataset.sp = spacing; return e;
}
function animLabel(e, t, tin, tout, { dur = 0.6, outDur = 0.3 } = {}) {
  const a = E.outCubic(inv(tin, tin + dur, t)), b = tout != null ? inv(tout, tout + outDur, t) : 0;
  const sp = +e.dataset.sp;
  e.style.opacity = (a * (1 - b)).toFixed(3);
  e.style.letterSpacing = (sp + (1 - a) * 0.35).toFixed(3) + 'em';
  e.style.visibility = a * (1 - b) > 0.001 ? 'visible' : 'hidden';
}
function stack(lines, top, gap = 14) { let y = top; for (const i of lines) { i.parentElement.style.top = y + 'px'; y += parseFloat(i.style.fontSize) * 0.98 + gap; } return y; }
const slantClip = (p, slantPct = 8) => `polygon(0% 0%, ${p}% 0%, ${p - slantPct}% 100%, 0% 100%)`;

export function buildOverlay(root, logoSrc) {
  const L = {};
  // ---------- scrims de legibilidade ----------
  L.scrimTop = el('div', 'scrim', root); css(L.scrimTop, { top: '0px', height: '1250px', background: 'linear-gradient(180deg, rgba(5,7,5,0.72) 0%, rgba(5,7,5,0.5) 42%, rgba(5,7,5,0) 100%)' });
  L.scrimCenter = el('div', 'scrim', root); css(L.scrimCenter, { top: '0px', height: '1920px', background: 'radial-gradient(ellipse 85% 34% at 50% 40%, rgba(4,6,4,0.62) 0%, rgba(4,6,4,0.0) 100%)' });

  // ---------- CENA 1: pergunta de abertura ----------
  const s1 = el('div', 'layer', root); L.s1 = s1;
  L.s1bar = el('div', 'abs', s1); css(L.s1bar, { left: '56px', top: '470px', width: '8px', height: '520px', background: 'var(--green)', transformOrigin: 'top', transform: 'skewY(0deg)' });
  L.s1a = maskLine(s1, `<span class="hl"><span class="bg"></span><span class="tx">SUA EMPRESA</span></span>`, { size: 96, top: 440 });
  L.s1aBg = L.s1a.querySelector('.bg'); L.s1aTx = L.s1a.querySelector('.tx');
  L.s1b = maskLine(s1, 'PRECISA DE UMA', { size: fit('PRECISA DE UMA', 800, TW), top: 0 });
  L.s1c = maskLine(s1, 'TRANSPORTADORA', { size: fit('TRANSPORTADORA', 800, TW), top: 0 });
  L.s1d = maskLine(s1, 'DE <span class="g">CONFIANÇA?</span>', { size: fit('DE CONFIANÇA?', 800, TW), top: 0 });
  const s1end = stack([L.s1a, L.s1b, L.s1c, L.s1d], 440, 18);
  L.s1bar.style.top = '440px'; L.s1bar.style.height = (s1end - 440 - 10) + 'px';

  // ---------- CENA 2: indústria / distribuidora ----------
  const s2 = el('div', 'layer', root); L.s2 = s2;
  L.s2rule = el('div', 'rule', s2); css(L.s2rule, { left: X0 + 'px', top: '348px', width: '64px', height: '6px' });
  L.s2eye = label(s2, 'SUA INDÚSTRIA OU DISTRIBUIDORA', { size: 30, top: 334, left: X0 + 84, color: 'var(--white)', spacing: 0.2 });
  L.s2a = maskLine(s2, 'REALIZA ENVIOS', { size: fit('REALIZA ENVIOS', 800, TW), top: 0 });
  L.s2b = maskLine(s2, 'FREQUENTES', { size: fit('FREQUENTES', 800, TW), top: 0, color: 'var(--green)' });
  L.s2c = maskLine(s2, 'DE MERCADORIAS?', { size: fit('DE MERCADORIAS?', 800, TW), top: 0 });
  stack([L.s2a, L.s2b, L.s2c], 400, 16);

  // ---------- CENA 3: marca + 16 anos ----------
  const s3 = el('div', 'layer', root); L.s3 = s3;
  L.logoWrap = el('div', 'abs', s3); css(L.logoWrap, { left: '0px', top: '0px', width: '1080px', height: '1920px' });
  L.logoBox = el('div', 'abs', L.logoWrap); css(L.logoBox, { width: '840px', left: '120px', top: '585px', transformOrigin: '50% 50%' });
  L.logoImg = el('img', '', L.logoBox); L.logoImg.src = logoSrc; css(L.logoImg, { width: '100%', display: 'block', filter: 'drop-shadow(0 6px 30px rgba(0,0,0,0.55))' });
  L.logoGlint = el('div', 'abs', L.logoBox); css(L.logoGlint, { inset: '0', WebkitMaskImage: `url(${logoSrc})`, maskImage: `url(${logoSrc})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', background: 'linear-gradient(104deg, rgba(180,232,110,0) 38%, rgba(196,240,120,0.95) 50%, rgba(180,232,110,0) 62%)', backgroundSize: '300% 100%' });
  L.s3name = label(s3, 'AJ FARIA TRANSPORTADORA', { size: 32, top: 860, align: 'center', color: 'var(--white)', spacing: 0.34 });
  L.s3loc = el('div', 'loc abs', s3, `<span style="width:30px;height:30px;display:inline-block">${ICON_SVG.pin}</span><span>SEDIADA EM PEDREIRA</span><span class="sep">|</span><span>SP</span>`);
  css(L.s3loc, { top: '925px', left: '0px', width: '1080px', justifyContent: 'center', fontSize: '30px', letterSpacing: '0.16em', color: 'var(--metal)' });
  L.s3mais = label(s3, 'MAIS DE', { size: 34, top: 548, align: 'center', color: 'var(--white)', spacing: 0.4 });
  L.s3num = el('div', 'abs h', s3); css(L.s3num, { left: '0px', width: '1080px', textAlign: 'center', top: '590px', fontSize: '330px', lineHeight: '1', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' });
  L.s3rule = el('div', 'rule', s3); css(L.s3rule, { left: '340px', width: '400px', top: '935px', height: '6px' });
  L.s3anos = label(s3, 'ANOS DE EXPERIÊNCIA', { size: 50, top: 968, align: 'center', color: 'var(--white)', spacing: 0.12, weight: 800 });
  L.s3rod = label(s3, 'NO TRANSPORTE RODOVIÁRIO DE CARGAS', { size: 28, top: 1048, align: 'center', color: 'var(--metal)', spacing: 0.24 });

  // ---------- CENA 4: operação / logística / mercadorias / parceria ----------
  const s4 = el('div', 'layer', root); L.s4 = s4;
  L.s4items = [['01', 'SUA', 'OPERAÇÃO'], ['02', 'SUA', 'LOGÍSTICA'], ['03', 'SUAS', 'MERCADORIAS']].map(([n, a, b]) => {
    const g = el('div', 'abs', s4); css(g, { left: X0 + 'px', top: '360px' });
    const num = el('div', 'label', g, `<span style="color:var(--green)">${n}</span> <span style="color:var(--metal)">/ 03</span>`); css(num, { fontSize: '28px', letterSpacing: '0.3em' });
    const small = el('div', 'h', g, a); css(small, { fontSize: '58px', fontWeight: 600, marginTop: '26px', color: 'var(--white)' });
    const big = el('div', 'h', g, b); css(big, { fontSize: Math.min(132, fit(b, 800, TW)) + 'px', marginTop: '4px' });
    const bar = el('div', '', g); css(bar, { height: '10px', width: '180px', marginTop: '22px', background: 'var(--green)', transform: 'skewX(var(--slant))', transformOrigin: 'left' });
    return { g, num, small, big, bar };
  });
  L.s4eye = label(s4, 'COM FOCO EM UMA', { size: 30, top: 340, left: X0, color: 'var(--white)', spacing: 0.3 });
  L.s4a = maskLine(s4, 'PARCERIA', { size: fit('LOGÍSTICA', 800, TW * 0.86), top: 0 });
  L.s4b = maskLine(s4, 'LOGÍSTICA', { size: fit('LOGÍSTICA', 800, TW * 0.86), top: 0 });
  L.s4c = maskLine(s4, 'DE LONGO PRAZO', { size: fit('DE LONGO PRAZO', 800, TW), top: 0, color: 'var(--green)' });
  stack([L.s4a, L.s4b, L.s4c], 395, 14);

  // ---------- CENA 5: mapa + doca ----------
  const s5 = el('div', 'layer', root); L.s5 = s5;
  L.pin = el('div', 'pin', s5, `<div class="card"><span class="eyebrow">SEDE</span><span class="name">PEDREIRA<span class="bar">|</span>SP</span><span class="eyebrow sub" style="color:var(--white);letter-spacing:0.22em">INTERIOR DE SÃO PAULO</span></div>`);
  L.pinCard = L.pin.querySelector('.card'); L.pinSub = L.pin.querySelector('.sub');
  L.s5a = maskLine(s5, 'TRANSPORTE', { size: fit('TRANSPORTE', 800, TW * 0.9), top: 0 });
  L.s5b = maskLine(s5, 'DE CARGAS', { size: fit('TRANSPORTE', 800, TW * 0.9), top: 0 });
  L.s5c = maskLine(s5, 'PARA EMPRESAS', { size: fit('PARA EMPRESAS', 800, TW), top: 0, color: 'var(--green)' });
  stack([L.s5a, L.s5b, L.s5c], 340, 14);

  // ---------- CENA 6: CTA ----------
  const s6 = el('div', 'layer', root); L.s6 = s6;
  L.ctaBg = el('div', 'layer', s6); css(L.ctaBg, { background: 'radial-gradient(ellipse 90% 55% at 50% 28%, #1d2717 0%, #0d110b 48%, #070906 100%)' });
  L.ctaLines = el('div', 'layer', s6);
  const lines = []; for (let i = -9; i <= 9; i++) lines.push(`<line x1="540" y1="1180" x2="${540 + i * 260}" y2="1920" />`);
  L.ctaLines.innerHTML = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" style="position:absolute;inset:0"><defs><linearGradient id="fadeL" x1="0" y1="1180" x2="0" y2="1920" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#97C93D" stop-opacity="0"/><stop offset="1" stop-color="#97C93D" stop-opacity="0.35"/></linearGradient></defs><g stroke="url(#fadeL)" stroke-width="2">${lines.join('')}</g><g id="hz" stroke="#97C93D" stroke-opacity="0.18" stroke-width="2"></g></svg>`;
  L.ctaHz = L.ctaLines.querySelector('#hz');
  L.ctaSweep = el('div', 'layer', s6); css(L.ctaSweep, { background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 60%)', backgroundSize: '300% 100%' });
  L.ctaDust = el('canvas', 'layer', s6); L.ctaDust.width = 1080; L.ctaDust.height = 1920;
  L.cLogoBox = el('div', 'abs', s6); css(L.cLogoBox, { width: '640px', left: '220px', top: '330px' });
  L.cLogo = el('img', '', L.cLogoBox); L.cLogo.src = logoSrc; css(L.cLogo, { width: '100%', display: 'block' });
  L.cGlint = el('div', 'abs', L.cLogoBox); css(L.cGlint, { inset: '0', WebkitMaskImage: `url(${logoSrc})`, maskImage: `url(${logoSrc})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', background: 'linear-gradient(104deg, rgba(180,232,110,0) 38%, rgba(196,240,120,0.95) 50%, rgba(180,232,110,0) 62%)', backgroundSize: '300% 100%' });
  L.cLoc = el('div', 'loc abs', s6, `<span style="width:30px;height:30px;display:inline-block">${ICON_SVG.pin}</span><span>Pedreira</span><span class="sep">|</span><span>SP</span>`);
  css(L.cLoc, { top: '545px', left: '0px', width: '1080px', justifyContent: 'center', fontSize: '34px', letterSpacing: '0.12em' });
  L.cH1 = maskLine(s6, 'SUA EMPRESA PRECISA', { size: fit('SUA EMPRESA PRECISA', 800, 900), top: 650, align: 'center' });
  L.cH2 = maskLine(s6, 'DE <span class="g">TRANSPORTE?</span>', { size: fit('DE TRANSPORTE?', 800, 820), top: 745, align: 'center' });
  L.cSub = el('div', 'abs', s6, 'Conheça a AJ Faria Transportadora.'); css(L.cSub, { top: '885px', left: '0px', width: '1080px', textAlign: 'center', fontSize: '40px', fontWeight: 500, color: '#D9DED6' });
  L.cBtnWrap = el('div', 'abs', s6); css(L.cBtnWrap, { left: '110px', top: '985px', width: '860px', height: '128px' });
  L.cRing = el('div', 'ring', L.cBtnWrap); css(L.cRing, { inset: '0px', borderRadius: '64px' });
  L.cBtn = el('div', 'btn', L.cBtnWrap, `<span class="shine"></span><span style="position:relative">SOLICITE UMA COTAÇÃO</span><span class="arrow" style="position:relative"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 12h12M12 6l6 6-6 6" stroke="#97C93D" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`);
  css(L.cBtn, { left: '0px', top: '0px', width: '860px' });
  L.cShine = L.cBtn.querySelector('.shine'); L.cArrow = L.cBtn.querySelector('.arrow svg');
  L.cTap = el('div', 'abs', L.cBtnWrap); css(L.cTap, { width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.55)', left: '640px', top: '44px' });
  L.cChip = el('div', 'abs', s6, `<span>CLIQUE EM <b style="color:var(--green);font-weight:800">SAIBA MAIS</b></span><svg width="26" height="26" viewBox="0 0 24 24" style="margin-left:14px"><path d="M12 4v14M6 12l6 6 6-6" stroke="#97C93D" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  css(L.cChip, { top: '1160px', left: '0px', width: '1080px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '30px', fontWeight: 600, letterSpacing: '0.2em', color: 'var(--white)' });
  L.cChipArrow = L.cChip.querySelector('svg');

  // poeira do CTA (determinística)
  const R = rng(99); L.dust = Array.from({ length: 70 }, () => ({ x: R() * 1080, y: R() * 1920, r: 0.8 + R() * 2.2, v: 6 + R() * 18, a: 0.15 + R() * 0.35, ph: R() * 6 }));
  return L;
}

export function updateOverlay(L, t, ctx = {}) {
  const vis = (e, on) => { e.style.display = on ? '' : 'none'; };
  // scrims
  const sTop = Math.max(seg2(t, 1.1, 1.4, 3.25, 3.45) * 0.85, seg2(t, 3.3, 3.5, 7.45, 7.7), seg2(t, 17.0, 17.15, 21.2, 21.33) * 0.75, seg2(t, 21.33, 21.6, 24.1, 24.35) * 0.9, seg2(t, 27.33, 27.5, 29.5, 29.7) * 0.85);
  L.scrimTop.style.opacity = sTop.toFixed(3);
  L.scrimCenter.style.opacity = Math.max(seg2(t, 7.7, 8.2, 16.8, 17.0), seg2(t, 0, 0.1, 1.2, 1.5) * 0.7).toFixed(3);

  // ---------- CENA 1 ----------
  vis(L.s1, t < 3.5);
  if (t < 3.5) {
    const out = 3.12;
    L.s1bar.style.transform = `scaleY(${E.outQuart(inv(0.05, 0.9, t)) * (1 - E.inCubic(inv(out, out + 0.3, t)))})`;
    anim(L.s1a, t, 0.06, out, { dur: 0.45 });
    L.s1aBg.style.transform = `skewX(var(--slant)) scaleX(${E.outQuart(inv(0.0, 0.38, t))})`;
    anim(L.s1b, t, 0.6, out + 0.04);
    anim(L.s1c, t, 1.64, out + 0.08);
    anim(L.s1d, t, 2.24, out + 0.12);
  }
  // ---------- CENA 2 ----------
  vis(L.s2, t > 3.3 && t < 7.8);
  if (t > 3.3 && t < 7.8) {
    const out = 7.42;
    L.s2rule.style.transform = `scaleX(${E.outQuart(inv(3.38, 3.8, t)) * (1 - inv(out, out + 0.25, t))})`;
    animLabel(L.s2eye, t, 3.42, out);
    anim(L.s2a, t, 4.74, out + 0.02);
    anim(L.s2b, t, 5.3, out + 0.06);
    anim(L.s2c, t, 6.16, out + 0.1);
  }
  // ---------- CENA 3 ----------
  vis(L.s3, t > 7.6 && t < 17.1);
  if (t > 7.6 && t < 17.1) {
    // revelação do logotipo: máscara inclinada (ângulo do itálico do logo) + varredura de luz verde
    const rv = E.inOutCubic(inv(7.82, 8.62, t));
    L.logoBox.style.clipPath = slantClip(rv * 110);
    L.logoGlint.style.backgroundPosition = `${lerp(110, -10, E.inOutSine(inv(8.4, 9.5, t)))}% 0`;
    L.logoGlint.style.opacity = (seg2(t, 8.4, 8.6, 9.3, 9.5)).toFixed(3);
    // reposiciona o logo para o topo ao entrar no plano dos 16 anos
    const mv = E.inOutQuart(inv(11.95, 12.6, t));
    const sc = lerp(1, 0.6, mv), ty = lerp(0, -305, mv) + lerp(0, -8, inv(7.8, 11.9, t));
    const pushIn = lerp(0.97, 1.0, E.outCubic(inv(7.8, 11.9, t)));
    L.logoBox.style.transform = `translateY(${ty}px) scale(${sc * pushIn})`;
    L.logoBox.style.opacity = (1 - inv(16.75, 17.0, t)).toFixed(3);
    animLabel(L.s3name, t, 9.18, 11.75);
    const lo = E.outCubic(inv(9.95, 10.5, t)) * (1 - inv(11.75, 12.0, t));
    L.s3loc.style.opacity = lo.toFixed(3); L.s3loc.style.transform = `translateY(${(1 - lo) * 14}px)`;
    // +16: contagem precisa (inteiros), pousando em 16 junto com "dezesseis"
    animLabel(L.s3mais, t, 12.5, 16.72);
    const cnt = Math.round(16 * E.outQuart(inv(12.55, 13.6, t)));
    const nIn = E.outCubic(inv(12.5, 12.8, t)) * (1 - inv(16.72, 17.0, t));
    L.s3num.innerHTML = `<span class="g">+</span>${cnt}`;
    L.s3num.style.opacity = nIn.toFixed(3); L.s3num.style.transform = `translateY(${(1 - nIn) * 30}px) scale(${lerp(0.96, 1, E.outCubic(inv(12.5, 13.7, t)))})`;
    vis(L.s3num, t > 12.45);
    L.s3rule.style.transform = `scaleX(${E.outQuart(inv(12.55, 13.6, t)) * (1 - inv(16.72, 17.0, t))})`;
    animLabel(L.s3anos, t, 13.7, 16.72);
    animLabel(L.s3rod, t, 15.05, 16.72);
  }
  // ---------- CENA 4 ----------
  vis(L.s4, t > 16.95 && t < 24.5);
  if (t > 16.95 && t < 24.5) {
    const slots = [[17.0, 18.333], [18.333, 19.667], [19.667, 21.333]];
    L.s4items.forEach((it, i) => {
      const [a, b] = slots[i];
      const on = t >= a && t < b; it.g.style.visibility = on ? 'visible' : 'hidden';
      if (!on) return;
      // entra da esquerda para a direita (mesma direção dos cortes) e sai para a direita
      const e1 = E.outQuint(inv(a + 0.02, a + 0.42, t)), e2 = E.inCubic(inv(b - 0.16, b, t));
      const dx = (1 - e1) * -120 + e2 * 140;
      const bl = (1 - e1) * 14 + e2 * 18;
      it.g.style.transform = `translateX(${dx}px)`; it.g.style.filter = bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : 'none';
      it.g.style.opacity = (Math.min(1, e1 * 1.4) * (1 - e2 * 0.6)).toFixed(3);
      it.bar.style.transform = `skewX(var(--slant)) scaleX(${E.outQuart(inv(a + 0.15, a + 0.6, t))})`;
    });
    animLabel(L.s4eye, t, 21.4, 24.05);
    anim(L.s4a, t, 22.12, 24.05);
    anim(L.s4b, t, 22.7, 24.09);
    anim(L.s4c, t, 23.32, 24.13);
  }
  // ---------- CENA 5 ----------
  vis(L.s5, t > 24.3 && t < 29.8);
  if (t > 24.3 && t < 29.8) {
    const pin = ctx.anchors?.pin;
    const pc = E.outQuart(inv(25.22, 25.62, t)) * (1 - inv(27.15, 27.35, t));
    vis(L.pin, pin && pc > 0.001);
    if (pin) {
      L.pin.style.left = pin.x + 'px'; L.pin.style.top = (pin.y - 26) + 'px';
      L.pinCard.style.clipPath = `inset(${(1 - pc) * 100}% 0 0 0)`;
      L.pin.style.opacity = pc.toFixed(3);
      L.pinSub.style.opacity = E.outCubic(inv(25.98, 26.4, t)).toFixed(3);
      L.pinSub.style.maxHeight = (E.outCubic(inv(25.95, 26.3, t)) * 40).toFixed(1) + 'px';
    }
    anim(L.s5a, t, 27.44, 29.42);
    anim(L.s5b, t, 27.86, 29.46);
    anim(L.s5c, t, 28.5, 29.5);
  }
  // ---------- CENA 6: CTA ----------
  const cOn = t > 29.55;
  vis(L.s6, cOn);
  if (cOn) {
    // fundo institucional entra com máscara diagonal (fecha o filme espelhando a abertura)
    const w = E.inOutQuart(inv(29.55, 29.95, t));
    L.ctaBg.parentElement.style.clipPath = slantClip(w * 120, 20);
    const push = lerp(1.0, 1.035, E.inOutSine(inv(29.7, 35, t)));
    L.ctaLines.style.transform = `scale(${push})`;
    let hz = ''; for (let i = 0; i < 9; i++) { const u = ((t * 0.35 + i / 9) % 1); const y = 1180 + Math.pow(u, 2.2) * 740; hz += `<line x1="0" x2="1080" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke-opacity="${(u * 0.22).toFixed(3)}"/>`; }
    L.ctaHz.innerHTML = hz;
    L.ctaSweep.style.backgroundPosition = `${lerp(120, -20, inv(30.2, 33.5, t))}% 0`;
    const g = L.ctaDust.getContext('2d'); g.clearRect(0, 0, 1080, 1920);
    for (const d of L.dust) { const y = (d.y - t * d.v + 1920 * 4) % 1920; g.fillStyle = `rgba(200,230,170,${(d.a * (0.6 + 0.4 * Math.sin(t * 2 + d.ph))).toFixed(3)})`; g.beginPath(); g.arc(d.x, y, d.r, 0, 7); g.fill(); }

    const lr = E.inOutCubic(inv(29.78, 30.45, t));
    L.cLogoBox.style.clipPath = slantClip(lr * 110);
    L.cLogoBox.style.transform = `scale(${push * 0.995})`;
    L.cGlint.style.backgroundPosition = `${lerp(110, -10, E.inOutSine(inv(30.3, 31.2, t)))}% 0`;
    L.cGlint.style.opacity = seg2(t, 30.3, 30.45, 31.05, 31.2).toFixed(3);
    const lc = E.outCubic(inv(30.1, 30.6, t)); L.cLoc.style.opacity = lc.toFixed(3); L.cLoc.style.transform = `translateY(${(1 - lc) * 12}px)`;
    anim(L.cH1, t, 29.98, null);
    anim(L.cH2, t, 30.2, null);
    const sb = E.outCubic(inv(30.45, 30.95, t)); L.cSub.style.opacity = sb.toFixed(3); L.cSub.style.transform = `translateY(${(1 - sb) * 16}px)`;
    // botão: entra, brilho periódico, seta pulsando, toque sincronizado com "solicite uma cotação"
    const be = E.outQuint(inv(30.7, 31.2, t));
    const tap = Math.sin(Math.PI * clamp((t - 32.85) / 0.28));
    L.cBtnWrap.style.opacity = be.toFixed(3);
    L.cBtnWrap.style.transform = `translateY(${(1 - be) * 40}px) scale(${(lerp(0.92, 1, be) - tap * 0.035).toFixed(4)})`;
    const shineT = [31.35, 32.95, 34.3].map(s => inv(s, s + 0.65, t)).find(u => u > 0 && u < 1) ?? -1;
    L.cShine.style.left = (shineT < 0 ? -200 : lerp(-160, 980, E.inOutSine(shineT))) + 'px';
    L.cArrow.style.transform = `translateX(${(Math.max(0, Math.sin((t - 31.2) * Math.PI * 1.5)) * 5).toFixed(2)}px)`;
    const rp = clamp((t - 32.92) / 0.75);
    L.cRing.style.opacity = (rp > 0 && rp < 1 ? (1 - rp) * 0.8 : 0).toFixed(3);
    L.cRing.style.transform = `scale(${1 + rp * 0.12}, ${1 + rp * 0.45})`;
    const tp = clamp((t - 32.86) / 0.5);
    L.cTap.style.opacity = (tp > 0 && tp < 1 ? (1 - tp) * 0.7 : 0).toFixed(3);
    L.cTap.style.transform = `scale(${1 + tp * 5})`;
    const ch = E.outCubic(inv(30.0, 30.45, t));
    L.cChip.style.opacity = ch.toFixed(3); L.cChip.style.transform = `translateY(${(1 - ch) * 14}px)`;
    L.cChipArrow.style.transform = `translateY(${(Math.abs(Math.sin((t - 30) * Math.PI * 1.3)) * 6).toFixed(2)}px)`;
  }
}

// rampa sobe em [a,b], desce em [c,d]
function seg2(t, a, b, c, d) { return Math.min(inv(a, b, t), 1 - inv(c, d, t)); }
