import { svgTexture } from './util.js';

// Ícones minimalistas (traço) em selo circular — indústria, centro de distribuição, comércio, empresa.
const badge = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <circle cx="128" cy="128" r="118" fill="rgba(11,13,10,0.88)" stroke="#97C93D" stroke-width="7"/>
  <g fill="none" stroke="#F3F5F1" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

export const ICON_SVG = {
  factory: badge('<path d="M62 182V112l34 22v-22l34 22v-22l34 22V74h24v108z"/><path d="M62 182h132"/><path d="M90 160h14M122 160h14M154 160h14"/>'),
  warehouse: badge('<path d="M60 186V108l68-38 68 38v78"/><path d="M88 186v-52h80v52"/><path d="M88 152h80M88 170h80"/>'),
  store: badge('<path d="M66 112l12-36h100l12 36"/><path d="M66 112c0 14 21 14 21 0 0 14 21 14 21 0 0 14 20 14 20 0 0 14 21 14 21 0 0 14 20 14 20 0 0 14 21 14 21 0"/><path d="M76 128v58h104v-58"/><path d="M114 186v-34h28v34"/>'),
  building: badge('<path d="M84 190V70h88v120"/><path d="M66 190h124"/><path d="M106 96h14M136 96h14M106 122h14M136 122h14M106 148h14M136 148h14"/><path d="M120 190v-20h16v20"/>'),
  pin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="#97C93D"/></svg>`,
};

export async function loadIcons() {
  const out = {};
  for (const k of ['factory', 'warehouse', 'store', 'building']) out[k] = await svgTexture(ICON_SVG[k], 256);
  return out;
}
