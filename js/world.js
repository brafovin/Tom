'use strict';
// ============================================================
//  Die Welt: Boden, Straßen, Stadt, Ampeln, Mülltonnen, Natur
// ============================================================
const MAP_HALF = 180;
const CITY_HALF = 75;
const ROADS = [-68, -22, 22, 68];   // Straßenmitten (x und z)
const ROAD_W = 10;

const TrafficLights = {
  groups: [[], []],  // [A: Verkehr entlang z, B: Verkehr entlang x]
  phase: 0, timer: 0,
  mats: null,
  PHASES: [ // [A, B] Zustand: 'g' grün, 'y' gelb, 'r' rot, 'ry' rot-gelb
    { a: 'g', b: 'r', t: 8 }, { a: 'y', b: 'r', t: 2 }, { a: 'r', b: 'ry', t: 1.2 },
    { a: 'r', b: 'g', t: 8 }, { a: 'r', b: 'y', t: 2 }, { a: 'ry', b: 'r', t: 1.2 },
  ],
  init() {
    this.mats = {
      rOn: colMat('#ff2a2a', { emissive: '#ff0000' }), rOff: colMat('#4a1414'),
      yOn: colMat('#ffcc22', { emissive: '#ffaa00' }), yOff: colMat('#4a3a10'),
      gOn: colMat('#33ff66', { emissive: '#00dd44' }), gOff: colMat('#123a1c'),
    };
    this.groups = [[], []];
    this.phase = 0; this.timer = 0;
  },
  apply() {
    const ph = this.PHASES[this.phase];
    const set = (lamps, st) => {
      lamps.r.material = st === 'r' || st === 'ry' ? this.mats.rOn : this.mats.rOff;
      lamps.y.material = st === 'y' || st === 'ry' ? this.mats.yOn : this.mats.yOff;
      lamps.g.material = st === 'g' ? this.mats.gOn : this.mats.gOff;
    };
    for (const l of this.groups[0]) set(l, ph.a);
    for (const l of this.groups[1]) set(l, ph.b);
  },
  update(dt) {
    this.timer += dt;
    if (this.timer >= this.PHASES[this.phase].t) {
      this.timer = 0;
      this.phase = (this.phase + 1) % this.PHASES.length;
      this.apply();
    }
  },
};

const NatureMeshes = [];

function buildWorld(scene) {
  rand = mulberry32(20241013);
  TrafficLights.init();

  // ---- Boden ----
  const ground = new THREE.Mesh(boxesGeo([[900, 1, 900, 0, -0.5, 0]], 0.25), mat('grass'));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Stadt-Untergrund (Gehwege / Plätze) ----
  const side = new THREE.Mesh(boxesGeo([[CITY_HALF * 2, 0.04, CITY_HALF * 2, 0, 0.0, 0]], 0.5), mat('sidewalk'));
  side.receiveShadow = true;
  scene.add(side);

  // Grünflächen in den Blöcken (außer Mitte = Kirchplatz)
  const blocks = [];
  // Blöcke liegen zwischen zwei Straßen
  const blockRanges = [];
  for (let i = 0; i < ROADS.length - 1; i++) blockRanges.push([ROADS[i] + ROAD_W / 2, ROADS[i + 1] - ROAD_W / 2]);
  const grassBoxes = [];
  for (const bx of blockRanges) for (const bz of blockRanges) {
    blocks.push({ x0: bx[0], x1: bx[1], z0: bz[0], z1: bz[1] });
    if (bx[0] < 0 && bx[1] > 0 && bz[0] < 0 && bz[1] > 0) continue;
    const m = 3;
    grassBoxes.push([bx[1] - bx[0] - 2 * m, 0.06, bz[1] - bz[0] - 2 * m, (bx[0] + bx[1]) / 2, 0.01, (bz[0] + bz[1]) / 2]);
  }
  const grassMesh = new THREE.Mesh(boxesGeo(grassBoxes, 0.25), mat('grass', '#e8ffe0'));
  grassMesh.receiveShadow = true;
  scene.add(grassMesh);

  // ---- Straßen ----
  const roadBoxes = [];
  for (const c of ROADS) roadBoxes.push([CITY_HALF * 2, 0.06, ROAD_W, 0, 0.02, c]);   // entlang x
  const zSegs = [];
  for (let i = 0; i <= ROADS.length; i++) {
    const a = i === 0 ? -CITY_HALF : ROADS[i - 1] + ROAD_W / 2;
    const b = i === ROADS.length ? CITY_HALF : ROADS[i] - ROAD_W / 2;
    if (b > a) zSegs.push([a, b]);
  }
  for (const c of ROADS) for (const [a, b] of zSegs) roadBoxes.push([ROAD_W, 0.06, b - a, c, 0.02, (a + b) / 2]);
  const roads = new THREE.Mesh(boxesGeo(roadBoxes, 0.3), mat('asphalt'));
  roads.receiveShadow = true;
  scene.add(roads);

  // Markierungen: Mittellinie gestrichelt + Zebrastreifen
  const marks = [];
  const inIntersection = v => ROADS.some(c => Math.abs(v - c) < ROAD_W / 2 + 4);
  for (const c of ROADS) {
    for (let v = -CITY_HALF + 2; v < CITY_HALF - 2; v += 5) {
      if (inIntersection(v)) continue;
      marks.push([2.2, 0.02, 0.18, v, 0.06, c]);
      marks.push([0.18, 0.02, 2.2, c, 0.06, v]);
    }
    for (const c2 of ROADS) {
      for (const s of [-1, 1]) {
        for (let k = -4; k <= 4; k += 1.1) {
          marks.push([2.6, 0.02, 0.55, c + k, 0.06, c2 + s * (ROAD_W / 2 + 1.6)]);
          marks.push([0.55, 0.02, 2.6, c2 + s * (ROAD_W / 2 + 1.6), 0.06, c + k]);
        }
      }
    }
  }
  const markMesh = new THREE.Mesh(boxesGeo(marks), colMat('#f4f4f0'));
  scene.add(markMesh);

  // ---- 10 Gebäude ----
  const S = BUILDING_STYLES();
  const B = [];
  B.push(makeBuilding(scene, -53, -51, 4, 3, 3, { style: S.brick, roof: 'flat', door: 's', chests: 2 }));
  B.push(makeBuilding(scene, -15, -52, 3, 3, 2, { style: S.plaster, roof: 'gable', door: 's' }));
  B.push(makeBuilding(scene, 3, -52, 2, 3, 1, { style: S.blue, roof: 'flat', door: 's', shop: true }));
  B.push(makeBuilding(scene, 39, -51, 3, 3, 5, { style: S.metal, roof: 'flat', door: 's', chests: 2 }));
  B.push(makeBuilding(scene, -51, -6, 3, 3, 2, { style: S.wood, roof: 'gable', door: 'e', roofMat: mat('roof', '#8a8a8a') }));
  B.push(makeBuilding(scene, 37, -4, 4, 2, 1, { style: S.mint, roof: 'flat', door: 'w', shop: true }));
  B.push(makeBuilding(scene, -51, 37, 3, 4, 3, { style: S.plaster, roof: 'flat', door: 'n', chests: 2 }));
  B.push(makeBuilding(scene, -15, 35, 3, 2, 2, { style: S.blue, roof: 'gable', door: 'n' }));
  B.push(makeBuilding(scene, 5, 37, 2, 3, 1, { style: S.rose, roof: 'gable', door: 'n' }));
  B.push(makeBuilding(scene, 39, 39, 3, 3, 4, { style: S.brick, roof: 'flat', door: 'n', chests: 2 }));
  // ---- Kirche ----
  const church = makeChurch(scene, 0, 0);

  // ---- Ampeln an den inneren Kreuzungen ----
  for (const ix of [-22, 22]) for (const iz of [-22, 22]) {
    const o = ROAD_W / 2 + 0.8;
    makeTrafficLight(scene, ix + o, iz + o, 0, 0);       // schaut nach +z, Gruppe A
    makeTrafficLight(scene, ix - o, iz - o, Math.PI, 0); // schaut nach -z, Gruppe A
    makeTrafficLight(scene, ix - o, iz + o, -Math.PI / 2, 1); // schaut nach -x, Gruppe B
    makeTrafficLight(scene, ix + o, iz - o, Math.PI / 2, 1);  // schaut nach +x, Gruppe B
  }
  TrafficLights.apply();

  // ---- Straßenlaternen, Mülltonnen, Bänke entlang der Gehwege ----
  for (const c of ROADS) {
    for (let v = -CITY_HALF + 6; v < CITY_HALF - 4; v += 18) {
      if (inIntersection(v)) continue;
      for (const s of [-1, 1]) {
        const off = c + s * (ROAD_W / 2 + 0.7);
        if (Math.abs(off) < CITY_HALF - 1) {
          if (rand() < 0.75) makeLamp(scene, v, off, s > 0 ? 0 : Math.PI);
          if (rand() < 0.6) makeLamp(scene, off, v + 9, s > 0 ? Math.PI / 2 : -Math.PI / 2);
        }
      }
    }
    for (let v = -CITY_HALF + 10; v < CITY_HALF - 6; v += 11) {
      if (inIntersection(v)) continue;
      for (const s of [-1, 1]) {
        const off = c + s * (ROAD_W / 2 + 1.6);
        if (Math.abs(off) > CITY_HALF - 1) continue;
        if (rand() < 0.45) makeTrashCan(scene, v + rnd(-1, 1), off, s > 0 ? Math.PI : 0);
        if (rand() < 0.45) makeTrashCan(scene, off, v + rnd(-1, 1), s > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    }
  }
  // Mülltonnen-Gruppen vor den Häusern
  for (const b of B) {
    const x = b.x0 - 1.2, z = b.z0 + 1.0;
    makeTrashCan(scene, x, z, Math.PI / 2, '#3a3a3a');
    makeTrashCan(scene, x, z + 0.9, Math.PI / 2, '#2f6fd6');
    makeTrashCan(scene, x, z + 1.8, Math.PI / 2, '#f2d21b');
  }
  // Bänke auf dem Kirchplatz
  for (const [x, z, r] of [[-10, 10, 0], [10, 10, 0], [-10, -6, Math.PI / 2], [10, -6, -Math.PI / 2]]) makeBench(scene, x, z, r);

  // ---- Geparkte Autos ----
  const carSpots = [[-40, 22 + 3.2, 0], [5, -22 - 3.2, Math.PI], [30, 68 - 3.2, 0], [-22 - 3.2, -40, Math.PI / 2],
                    [22 + 3.2, 40, -Math.PI / 2], [-60, -22 + 3.2, 0], [68 + 3.2, 5, Math.PI / 2], [50, -22 - 3.2, Math.PI]];
  for (const [x, z, r] of carSpots) makeCar(scene, x, z, r);

  // ---- Natur: Bäume & Steine (instanziert für gute Leistung) ----
  buildNature(scene, blocks, B.concat([church]));

  // ---- Kisten draußen + Boden-Loot ----
  let placed = 0, guard = 0;
  while (placed < 14 && guard++ < 500) {
    const x = rnd(-MAP_HALF + 15, MAP_HALF - 15), z = rnd(-MAP_HALF + 15, MAP_HALF - 15);
    if (Math.abs(x) < CITY_HALF + 4 && Math.abs(z) < CITY_HALF + 4) continue;
    if (spotBlocked(x, z, 1.2)) continue;
    Chests.spawn(x, 0, z, rnd(0, Math.PI * 2));
    placed++;
  }
  // ein paar Kisten auf den Straßen der Stadt
  for (const [x, z] of [[-45, 22 + 7], [45, -22 - 7], [-22 - 7, 45], [22 + 7, -45], [0, 68 - 7]]) {
    if (!spotBlocked(x, z, 0.8)) Chests.spawn(x, 0, z, rndi(0, 3) * Math.PI / 2);
  }
  placed = 0; guard = 0;
  while (placed < 30 && guard++ < 800) {
    const x = rnd(-MAP_HALF + 10, MAP_HALF - 10), z = rnd(-MAP_HALF + 10, MAP_HALF - 10);
    if (spotBlocked(x, z, 0.8)) continue;
    const loot = rollFloorLoot();
    loot.forEach((it, i) => GroundItems.spawn(it, new THREE.Vector3(x + i * 0.9, 0, z)));
    placed++;
  }

  // ---- Wolken ----
  const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#c9d6e3' });
  for (let i = 0; i < 40; i++) {
    const c = new THREE.Group();
    const n = rndi(3, 6);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(cloudGeo, cloudMat);
      m.scale.set(rnd(10, 22), rnd(3, 6), rnd(8, 16));
      m.position.set(rnd(-12, 12), rnd(-1, 2), rnd(-8, 8));
      c.add(m);
    }
    c.position.set(rnd(-400, 400), rnd(110, 150), rnd(-400, 400));
    scene.add(c);
  }
  return { buildings: B, church, blocks };
}

function spotBlocked(x, z, r) {
  Phys.query(x - r, z - r, x + r, z + r, _q);
  for (const c of _q) {
    if (c.minX < x + r && c.maxX > x - r && c.minZ < z + r && c.maxZ > z - r) return true;
  }
  return false;
}

function makeTrafficLight(scene, x, z, rotY, group) {
  const g = new THREE.Group();
  const pole = '#3d4247', box = '#1e2124';
  g.add(vcMesh([[0.18, 5.2, 0.18, 0, 2.6, 0, pole], [0.12, 0.12, 3.2, 0, 5.1, -1.6, pole],   // Mast + Ausleger
    [0.5, 1.3, 0.4, 0, 4.4, -3.0, box], [0.6, 0.06, 0.3, 0, 5.08, -3.0, box],                 // Gehäuse
    [0.3, 0.5, 0.25, 0, 2.4, -0.2, box], [0.26, 0.18, 0.02, 0, 2.5, -0.33, '#c33'],          // Fußgängerampel
    [0.26, 0.18, 0.02, 0, 2.28, -0.33, '#2a4']], 'trafficlight'));
  const lampGeo = cachedGeo('lamp', () => new THREE.SphereGeometry(0.15, 10, 8));
  const lamps = {};
  [['r', 4.82], ['y', 4.4], ['g', 3.98]].forEach(([k, y]) => {
    const l = new THREE.Mesh(lampGeo, colMat('#222'));
    l.position.set(0, y, -2.79);
    g.add(l);
    lamps[k] = l;
    // Rückseite auch leuchten lassen
    const l2 = new THREE.Mesh(lampGeo, colMat('#222'));
    l2.position.set(0, y, -3.21);
    g.add(l2);
    lamps[k + '2'] = l2;
  });
  g.rotation.y = rotY;
  g.position.set(x, 0, z);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  const entry = { r: lamps.r, y: lamps.y, g: lamps.g };
  const entry2 = { r: lamps.r2, y: lamps.y2, g: lamps.g2 };
  TrafficLights.groups[group].push(entry, entry2);
  const p = new Piece(g, 'metal', 150, { kind: 'prop', center: new THREE.Vector3(x, 2.5, z) });
  p.boxC(x, 2.6, z, 0.3, 5.2, 0.3);
}

function makeLamp(scene, x, z, rotY) {
  if (spotBlocked(x, z, 0.4)) return;
  const g = new THREE.Group();
  const m = '#4b5157';
  g.add(vcMesh([[0.14, 6, 0.14, 0, 3, 0, m], [0.1, 0.1, 1.2, 0, 5.95, -0.6, m], [0.4, 0.15, 0.6, 0, 5.85, -1.2, m],
    [0.32, 0.05, 0.5, 0, 5.76, -1.2, '#fff6c8'], [0.3, 0.3, 0.3, 0, 0.15, 0, m]], 'streetlamp'));
  g.rotation.y = rotY;
  g.position.set(x, 0, z);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  const p = new Piece(g, 'metal', 100, { kind: 'prop', center: new THREE.Vector3(x, 3, z) });
  p.boxC(x, 3, z, 0.25, 6, 0.25);
}

const BIN_COLORS = ['#3a3a3a', '#2f6fd6', '#f2d21b', '#7a4a22', '#2e8b3e'];
function makeTrashCan(scene, x, z, rotY, color) {
  if (spotBlocked(x, z, 0.45)) return;
  const col = color || pick(BIN_COLORS);
  const g = new THREE.Group();
  const dark = shade(col, 0.7);
  g.add(vcMesh([[0.62, 0.95, 0.72, 0, 0.55, 0, col], [0.68, 0.08, 0.8, 0, 1.06, 0.02, dark],   // Tonne + Deckel
    [0.66, 0.06, 0.06, 0, 1.0, -0.4, dark],                                                      // Griff
    [0.07, 0.2, 0.2, -0.3, 0.1, -0.3, '#111111'], [0.07, 0.2, 0.2, 0.3, 0.1, -0.3, '#111111'],   // Räder
    [0.5, 0.25, 0.02, 0, 0.75, 0.37, shade(col, 1.25)]], 'bin_' + col));
  g.rotation.y = rotY;
  g.position.set(x, 0, z);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  const p = new Piece(g, 'metal', 50, { kind: 'prop', center: new THREE.Vector3(x, 0.6, z) });
  p.boxC(x, 0.55, z, 0.75, 1.1, 0.75);
}

function makeBench(scene, x, z, rotY) {
  const g = new THREE.Group();
  const w = '#8b5a2b', m = '#333333';
  g.add(vcMesh([[2.0, 0.08, 0.5, 0, 0.45, 0, w], [2.0, 0.4, 0.06, 0, 0.75, -0.25, w],
    [0.08, 0.45, 0.5, -0.9, 0.22, 0, m], [0.08, 0.45, 0.5, 0.9, 0.22, 0, m]], 'bench'));
  g.rotation.y = rotY;
  g.position.set(x, 0, z);
  scene.add(g);
  const p = new Piece(g, 'wood', 60, { kind: 'prop', center: new THREE.Vector3(x, 0.5, z) });
  const r = Math.abs(Math.sin(rotY)) > 0.5;
  p.boxC(x, 0.5, z, r ? 0.6 : 2.0, 1.0, r ? 2.0 : 0.6);
}

function makeCar(scene, x, z, rotY) {
  const col = pick(['#c0392b', '#2471a3', '#f1c40f', '#ecf0f1', '#27ae60', '#8e44ad', '#2c3e50']);
  const g = new THREE.Group();
  const glass = '#20303f', tire = '#151515', head = '#fff7c0', tail = '#ff3030';
  const list = [[1.9, 0.7, 4.2, 0, 0.65, 0, col], [1.7, 0.6, 2.2, 0, 1.3, -0.2, col], [1.72, 0.45, 2.0, 0, 1.32, -0.2, glass],
    [1.5, 0.45, 0.05, 0, 1.3, 0.92, glass], [0.4, 0.15, 0.05, -0.6, 0.75, 2.11, head], [0.4, 0.15, 0.05, 0.6, 0.75, 2.11, head],
    [0.4, 0.15, 0.05, -0.6, 0.75, -2.11, tail], [0.4, 0.15, 0.05, 0.6, 0.75, -2.11, tail], [1.95, 0.2, 0.3, 0, 0.35, 2.05, '#555555'],
    [1.95, 0.2, 0.3, 0, 0.35, -2.05, '#555555']];
  for (const [a2, b2] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) list.push([0.3, 0.76, 0.76, a2, 0.38, b2, tire]);
  g.add(vcMesh(list, 'car_' + col));
  g.rotation.y = rotY;
  g.position.set(x, 0, z);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  const p = new Piece(g, 'metal', 300, { kind: 'prop', center: new THREE.Vector3(x, 1, z), yieldMul: 1.5 });
  const r = Math.abs(Math.sin(rotY)) > 0.5;
  p.boxC(x, 0.85, z, r ? 4.2 : 1.9, 1.7, r ? 1.9 : 4.2);
}

function buildNature(scene, blocks, buildings) {
  const spots = [];
  const tryAdd = (x, z, r) => {
    if (Math.abs(x) > MAP_HALF - 3 || Math.abs(z) > MAP_HALF - 3) return false;
    if (spotBlocked(x, z, r)) return false;
    for (const s of spots) if ((s.x - x) ** 2 + (s.z - z) ** 2 < (s.r + r + 1) ** 2) return false;
    spots.push({ x, z, r });
    return true;
  };
  const trees = [];
  // Wäldchen außerhalb der Stadt
  for (let k = 0; k < 14; k++) {
    let cx, cz;
    do { cx = rnd(-MAP_HALF + 20, MAP_HALF - 20); cz = rnd(-MAP_HALF + 20, MAP_HALF - 20); }
    while (Math.abs(cx) < CITY_HALF + 15 && Math.abs(cz) < CITY_HALF + 15);
    const type = rand() < 0.6 ? 'pine' : 'leafy';
    for (let i = 0; i < 16; i++) {
      const x = cx + rnd(-18, 18), z = cz + rnd(-18, 18);
      if (Math.abs(x) < CITY_HALF + 3 && Math.abs(z) < CITY_HALF + 3) continue;
      if (tryAdd(x, z, 0.8)) trees.push({ x, z, type: rand() < 0.85 ? type : (type === 'pine' ? 'leafy' : 'pine'), s: rnd(0.8, 1.3) });
    }
  }
  // verstreute Bäume
  for (let i = 0; i < 90; i++) {
    const x = rnd(-MAP_HALF, MAP_HALF), z = rnd(-MAP_HALF, MAP_HALF);
    if (Math.abs(x) < CITY_HALF + 3 && Math.abs(z) < CITY_HALF + 3) continue;
    if (tryAdd(x, z, 0.8)) trees.push({ x, z, type: rand() < 0.5 ? 'pine' : 'leafy', s: rnd(0.8, 1.3) });
  }
  // Bäume in der Stadt (auf den Grünflächen)
  for (const b of blocks) {
    if (b.x0 < 0 && b.x1 > 0 && b.z0 < 0 && b.z1 > 0) continue;
    for (let i = 0; i < 8; i++) {
      const x = rnd(b.x0 + 4, b.x1 - 4), z = rnd(b.z0 + 4, b.z1 - 4);
      if (tryAdd(x, z, 2.0)) trees.push({ x, z, type: 'leafy', s: rnd(0.7, 1.0) });
    }
  }
  // Bäume um die Kirche
  for (const [x, z] of [[-13, -12], [13, -12], [-13, 2], [13, 2]]) if (tryAdd(x, z, 1)) trees.push({ x, z, type: 'leafy', s: 0.8 });

  const pines = trees.filter(t => t.type === 'pine'), leafy = trees.filter(t => t.type === 'leafy');
  // Kiefern
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3, 7); trunkGeo.translate(0, 1.5, 0);
  const cone1 = new THREE.ConeGeometry(2.4, 4.2, 8); cone1.translate(0, 4.2, 0);
  const cone2 = new THREE.ConeGeometry(1.7, 3.4, 8); cone2.translate(0, 6.4, 0);
  const pineMats = [mat('bark'), colMat('#2f6b34'), colMat('#3a7d3f')];
  instTrees(scene, pines, [trunkGeo, cone1, cone2], pineMats, 150, 7.5);
  // Laubbäume
  const trunk2 = new THREE.CylinderGeometry(0.28, 0.4, 3.4, 7); trunk2.translate(0, 1.7, 0);
  const crown = new THREE.IcosahedronGeometry(2.6, 1); crown.translate(0, 4.8, 0);
  const crown2 = new THREE.IcosahedronGeometry(1.8, 1); crown2.translate(0.8, 6.0, 0.4);
  instTrees(scene, leafy, [trunk2, crown, crown2], [mat('bark'), mat('leaves'), mat('leaves', '#cfe8b0')], 180, 7.0);

  // Steine
  const rocks = [];
  for (let i = 0; i < 80; i++) {
    const x = rnd(-MAP_HALF, MAP_HALF), z = rnd(-MAP_HALF, MAP_HALF);
    if (Math.abs(x) < CITY_HALF + 3 && Math.abs(z) < CITY_HALF + 3) continue;
    const s = rnd(0.8, 2.2);
    if (tryAdd(x, z, s)) rocks.push({ x, z, s, sy: rnd(0.6, 1.0) });
  }
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMesh = new THREE.InstancedMesh(rockGeo, mat('rock', '#c8c4bc', { flatShading: true }), rocks.length);
  rockMesh.castShadow = true; rockMesh.receiveShadow = true;
  rocks.forEach((r, i) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(r.x, r.s * r.sy * 0.55, r.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 1), rnd(0, 6), 0)),
      new THREE.Vector3(r.s, r.s * r.sy, r.s * 1.1));
    rockMesh.setMatrixAt(i, m);
    const p = new Piece(null, 'stone', 120 + r.s * 80, { kind: 'rock', center: new THREE.Vector3(r.x, r.s * 0.5, r.z),
      inst: { meshes: [rockMesh], index: i, matrix: m.clone() } });
    const h = r.s * r.sy * 1.3;
    p.boxC(r.x, h / 2, r.z, r.s * 1.5, h, r.s * 1.5);
  });
  scene.add(rockMesh);
  NatureMeshes.push(rockMesh);
}

function instTrees(scene, list, geos, mats, hp, height) {
  const meshes = geos.map((g, i) => {
    const m = new THREE.InstancedMesh(g, mats[i], Math.max(1, list.length));
    m.castShadow = true; m.receiveShadow = i === 0;
    m.count = list.length;
    scene.add(m);
    NatureMeshes.push(m);
    return m;
  });
  list.forEach((t, i) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(t.x, 0, t.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd(0, 6.28), 0)), new THREE.Vector3(t.s, t.s, t.s));
    for (const mesh of meshes) mesh.setMatrixAt(i, m);
    const p = new Piece(null, 'wood', hp * t.s, { kind: 'tree', center: new THREE.Vector3(t.x, 2, t.z),
      inst: { meshes, index: i, matrix: m.clone() } });
    p.boxC(t.x, height * t.s / 2, t.z, 0.8 * t.s, height * t.s, 0.8 * t.s);
    // Krone: Schüsse bleiben hängen, aber man kann nicht darauf stehen
    const crownC = addBoxC(t.x, 4.8 * t.s, t.z, 3.6 * t.s, 4 * t.s, 3.6 * t.s, p);
    crownC.noCollide = true;
    p.colliders.push(crownC);
  });
}
