import * as THREE from 'three';

// Mapas de ambiente (reflexos) gerados a partir de "estúdios" simples com softboxes.
function panel(scene, color, intensity, w, h, pos, look) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
  m.position.copy(pos); m.lookAt(look); scene.add(m);
}

export function studioEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#050605');
  const o = new THREE.Vector3();
  panel(s, '#ffffff', 6, 8, 1.2, new THREE.Vector3(0, 6, 0), o);                 // softbox de teto
  panel(s, '#ffffff', 3.2, 0.6, 6, new THREE.Vector3(-6, 1.5, -3), o);            // strip esquerdo
  panel(s, '#d8ffb0', 2.6, 0.6, 6, new THREE.Vector3(6, 1.5, -2), o);             // strip com tom verde
  panel(s, '#ffffff', 1.2, 10, 0.4, new THREE.Vector3(0, 1.2, 7), o);             // faixa frontal baixa
  panel(s, '#8fa0b0', 0.25, 30, 4, new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 10, 0)); // piso
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02).texture; pm.dispose(); return env;
}

export function duskEnv(renderer) {
  const s = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 v; void main(){ float h = v.y; vec3 c = mix(vec3(1.0,0.62,0.32)*1.6, vec3(0.25,0.32,0.45), smoothstep(0.0,0.35,h)); c = mix(c, vec3(0.05,0.07,0.1), smoothstep(0.35,0.9,h)); c = mix(c, vec3(0.06,0.06,0.05), smoothstep(0.0,-0.1,h)); float sun = pow(max(dot(v, normalize(vec3(-0.3,0.08,-1.0))),0.0), 30.0)*6.0; gl_FragColor = vec4(c + vec3(1.0,0.8,0.5)*sun, 1.); }`,
  }));
  s.add(sky);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.03).texture; pm.dispose(); return env;
}

export function nightEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#06080a');
  const o = new THREE.Vector3();
  for (let i = 0; i < 6; i++) panel(s, '#ffd7a8', 4, 0.5, 0.5, new THREE.Vector3(Math.cos(i) * 8, 5, Math.sin(i) * 8), o);
  panel(s, '#9fb0c0', 0.6, 40, 2, new THREE.Vector3(0, 1, -12), o);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02).texture; pm.dispose(); return env;
}
