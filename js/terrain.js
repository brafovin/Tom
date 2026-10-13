'use strict';
// ============================================================
//  Gelände & Wasser: Seen, Fluss, Insel
// ============================================================
const WATER_Y = -0.5;          // Höhe der Wasseroberfläche
const SWIM_DEPTH = WATER_Y - 1.0;
const LAKES = [
  { name: 'Großer See', x: -190, z: -175, r: 52 },
  { name: 'Inselsee', x: -180, z: 190, r: 40, island: 12 },
  { name: 'Teich', x: 238, z: -218, r: 24 },
];
const RIVER_W = 16;
const RIVER_CTRL = [[172, -340], [150, -255], [180, -185], [140, -110], [160, -40], [128, 30],
  [164, 100], [138, 170], [180, 240], [160, 340]];
let RIVER = [];
let RIVER_MINX = 0, RIVER_MAXX = 0;

function smooth01(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Catmull-Rom-Kurve durch die Kontrollpunkte abtasten
function buildRiver() {
  RIVER = [];
  const P = RIVER_CTRL;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 10; k++) {
      const t = k / 10, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      RIVER.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  RIVER.push(P[P.length - 1]);
  RIVER_MINX = Math.min(...RIVER.map(p => p[0]));
  RIVER_MAXX = Math.max(...RIVER.map(p => p[0]));
}
buildRiver();

function riverDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    if (Math.abs(z - az) > 40 && Math.abs(z - bz) > 40) continue;
    const vx = bx - ax, vz = bz - az;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
    const dx = x - (ax + vx * t), dz = z - (az + vz * t);
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// x-Position des Flusses bei einer z-Position (für Brücken)
function riverXAt(z) {
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i], b = RIVER[i + 1];
    if ((z >= a[1] && z <= b[1]) || (z <= a[1] && z >= b[1])) {
      const t = (z - a[1]) / ((b[1] - a[1]) || 1);
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return RIVER[0][0];
}

// Höhe des Bodens (0 = normal, negativ = Seegrund/Flussbett)
function terrainH(x, z) {
  let h = 0;
  for (const L of LAKES) {
    const dx = x - L.x, dz = z - L.z, d2 = dx * dx + dz * dz, R = L.r + 4;
    if (d2 > R * R) continue;
    const d = Math.sqrt(d2);
    let lh = -3.5 * (1 - smooth01(L.r - 10, L.r + 3, d));
    if (L.island) lh = Math.max(lh, -3.5 * smooth01(L.island - 4, L.island + 5, d));
    h = Math.min(h, lh);
  }
  if (x > RIVER_MINX - 14 && x < RIVER_MAXX + 14) {
    const d = riverDist(x, z);
    if (d < RIVER_W / 2 + 4) h = Math.min(h, -3 * (1 - smooth01(RIVER_W / 2 - 5, RIVER_W / 2 + 3, d)));
  }
  return h;
}

function isWater(x, z) { return terrainH(x, z) < WATER_Y + 0.05; }
function isDeepWater(x, z) { return terrainH(x, z) < SWIM_DEPTH; }

// ---------- Meshes ----------
let WATER_MAT = null;
function waterMaterial() {
  if (WATER_MAT) return WATER_MAT;
  WATER_MAT = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]),
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float time;
      varying vec3 vW;
      void main() {
        float w1 = sin(vW.x * 0.32 + time * 1.2) * cos(vW.z * 0.27 - time * 0.9);
        float w2 = sin((vW.x + vW.z) * 0.85 - time * 2.1) * 0.5;
        float w3 = sin(vW.x * 1.7 - vW.z * 1.3 + time * 3.0) * 0.25;
        float wave = (w1 + w2 + w3) * 0.4 + 0.5;
        vec3 deep = vec3(0.10, 0.40, 0.66), shallow = vec3(0.30, 0.70, 0.86);
        vec3 col = mix(deep, shallow, wave * 0.55);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        col = mix(col, vec3(0.78, 0.90, 1.0), fres * 0.65);
        col += smoothstep(0.86, 1.0, wave) * 0.28;
        gl_FragColor = vec4(col, 0.84);
        #include <fog_fragment>
      }`,
    transparent: true, fog: true, depthWrite: false,
  });
  return WATER_MAT;
}

function buildTerrain(scene) {
  const S = MAP_HALF * 2 + 20, SEG = Math.round(S / 2.5);
  const geo = new THREE.PlaneGeometry(S, S, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = [], uv = geo.attributes.uv;
  const grass = new THREE.Color('#5a9b3a'), sand = new THREE.Color('#d9c48d'), mud = new THREE.Color('#5d6b4a');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h);
    uv.setXY(i, x * 0.25, z * 0.25);
    const n = 0.9 + 0.1 * Math.sin(x * 0.045 + Math.sin(z * 0.03) * 2) + 0.06 * Math.sin(z * 0.11 + x * 0.07);
    c.copy(grass).multiplyScalar(n);
    c.lerp(sand, smooth01(-0.02, -0.55, h));
    c.lerp(mud, smooth01(-1.0, -2.6, h));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: TEX.detail, vertexColors: true }));
  m.receiveShadow = true;
  scene.add(m);
  // flacher Rand außen herum
  const half = S / 2, far = 700, mt = mat('detail', '#5f9e3c');
  const ring = new THREE.Mesh(boxesGeo([
    [far * 2, 1, far - half, 0, -0.5, -(half + (far - half) / 2)],
    [far * 2, 1, far - half, 0, -0.5, half + (far - half) / 2],
    [far - half, 1, half * 2, -(half + (far - half) / 2), -0.5, 0],
    [far - half, 1, half * 2, half + (far - half) / 2, -0.5, 0]]), mt);
  ring.receiveShadow = true;
  scene.add(ring);

  // Wasserflächen
  const wm = waterMaterial();
  for (const L of LAKES) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(L.r + 3, 72), wm);
    w.rotation.x = -Math.PI / 2;
    w.position.set(L.x, WATER_Y, L.z);
    w.renderOrder = 2;
    scene.add(w);
  }
  const rv = [], idx = [];
  for (let i = 0; i < RIVER.length; i++) {
    const a = RIVER[Math.max(0, i - 1)], b = RIVER[Math.min(RIVER.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const hw = RIVER_W / 2 + 3;
    rv.push(RIVER[i][0] - dz * hw, WATER_Y, RIVER[i][1] + dx * hw, RIVER[i][0] + dz * hw, WATER_Y, RIVER[i][1] - dx * hw);
    if (i < RIVER.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
  rg.setIndex(idx);
  rg.computeVertexNormals();
  const river = new THREE.Mesh(rg, wm);
  river.material.side = THREE.DoubleSide;
  river.renderOrder = 2;
  scene.add(river);
}

// Holzbrücke über den Fluss (entlang x)
function makeBridge(scene, z, width) {
  const cx = riverXAt(z);
  const len = RIVER_W + 18;
  const x0 = cx - len / 2, x1 = cx + len / 2;
  const deckTop = 0.4;
  const list = [[len, 0.3, width, cx, deckTop - 0.15, z, '#8a5a2b']];
  for (let k = -len / 2 + 1; k <= len / 2 - 1; k += 1.2) list.push([0.12, 0.02, width, cx + k, deckTop + 0.01, z, '#6e4524']);
  for (const s of [-1, 1]) {
    list.push([len, 0.12, 0.15, cx, deckTop + 1.0, z + s * (width / 2 - 0.1), '#6e4524']);
    list.push([len, 0.1, 0.12, cx, deckTop + 0.55, z + s * (width / 2 - 0.1), '#6e4524']);
    for (let k = -len / 2; k <= len / 2; k += 3) list.push([0.18, 1.05, 0.18, cx + k, deckTop + 0.52, z + s * (width / 2 - 0.1), '#5b3a1d']);
    for (let k = -len / 2 + 6; k <= len / 2 - 6; k += 8) list.push([0.5, 3.6, 0.5, cx + k, -1.6, z + s * (width / 2 - 1), '#4a3420']);
  }
  const m = vcMesh(list);
  m.receiveShadow = true;
  scene.add(m);
  addBox(x0, 0.1, z - width / 2, x1, deckTop, z + width / 2);   // dünn, damit man drunter durchschwimmen kann
  for (const s of [-1, 1]) {
    const rz = z + s * (width / 2 - 0.1);
    addBox(x0, deckTop, rz - 0.1, x1, deckTop + 1.1, rz + 0.1);
  }
  return { x0, x1, z, width };
}
