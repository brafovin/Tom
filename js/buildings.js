'use strict';
// ============================================================
//  Gebäude der Stadt + Kirche (alles aus abbaubaren Teilen)
// ============================================================
const T = 4;          // Kachelgröße (Meter)
const WALL_T = 0.3;   // Wanddicke
const glassMat = () => colMat('#9fd3ff', { transparent: true, opacity: 0.35, depthWrite: false });

// Wandteil: along = 'x' (Wand liegt entlang x) oder 'z'
// type: 'wall' | 'window' | 'door' | 'bigwindow' | 'open'
function wallPanel(scene, cx, y0, cz, along, type, style, h = T) {
  const L = T, t = WALL_T;
  let boxes;
  if (type === 'window') {
    boxes = [[L, 1.1, t, 0, 0.55, 0], [L, h - 3.0, t, 0, 3.0 + (h - 3.0) / 2, 0],
             [1.1, 1.9, t, -L / 2 + 0.55, 2.05, 0], [1.1, 1.9, t, L / 2 - 0.55, 2.05, 0]];
  } else if (type === 'bigwindow') {
    boxes = [[L, 0.5, t, 0, 0.25, 0], [L, h - 3.4, t, 0, 3.4 + (h - 3.4) / 2, 0],
             [0.3, 2.9, t, -L / 2 + 0.15, 1.95, 0], [0.3, 2.9, t, L / 2 - 0.15, 1.95, 0]];
  } else if (type === 'door') {
    boxes = [[1.25, 2.7, t, -L / 2 + 0.625, 1.35, 0], [1.25, 2.7, t, L / 2 - 0.625, 1.35, 0],
             [L, h - 2.7, t, 0, 2.7 + (h - 2.7) / 2, 0]];
  } else if (type === 'tallwindow') {
    boxes = [[L, 1.0, t, 0, 0.5, 0], [1.3, h - 1.0, t, -L / 2 + 0.65, 1.0 + (h - 1.0) / 2, 0],
             [1.3, h - 1.0, t, L / 2 - 0.65, 1.0 + (h - 1.0) / 2, 0]];
  } else {
    boxes = [[L, h, t, 0, h / 2, 0]];
  }
  const key = 'wp_' + type + h;
  const geo = cachedGeo(key, () => boxesGeo(boxes));
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, style.wall);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  if (type === 'window' || type === 'bigwindow' || type === 'tallwindow') {
    let gw, gh, gy;
    if (type === 'window') { gw = 1.8; gh = 1.9; gy = 2.05; }
    else if (type === 'bigwindow') { gw = 3.4; gh = 2.9; gy = 1.95; }
    else { gw = 1.4; gh = h - 1.0; gy = 1.0 + gh / 2; }
    const gm = style.glass || glassMat();
    const gl = new THREE.Mesh(cachedGeo('gl' + gw + gh, () => new THREE.PlaneGeometry(gw, gh)), gm);
    gl.position.y = gy;
    g.add(gl);
  }
  if (along === 'z') g.rotation.y = Math.PI / 2;
  g.position.set(cx, y0, cz);
  scene.add(g);
  const piece = new Piece(g, style.mat, style.hp, { kind: 'wall', center: new THREE.Vector3(cx, y0 + h / 2, cz) });
  // Collider (gedreht für 'z')
  for (const b of boxes) {
    const [w, bh, d, bx, by, bz] = b;
    if (along === 'x') piece.boxC(cx + bx, y0 + by, cz + bz, w, bh, d);
    else piece.boxC(cx + bz, y0 + by, cz - bx, d, bh, w);
  }
  return piece;
}

function floorTile(scene, cx, y, cz, material, matName, hp = 200, w = T, d = T) {
  const geo = cachedGeo('fl' + w + 'x' + d, () => boxesGeo([[w, 0.25, d, 0, -0.125, 0]]));
  const m = new THREE.Mesh(geo, material);
  m.position.set(cx, y, cz);
  m.receiveShadow = true;
  scene.add(m);
  const p = new Piece(m, matName, hp, { kind: 'floor', center: new THREE.Vector3(cx, y, cz) });
  p.box(cx - w / 2, y - 0.25, cz - d / 2, cx + w / 2, y, cz + d / 2);
  return p;
}

// Schräge (Treppe innen / Dachfläche). axis 0=x,2=z, dir=+1/-1 (steigt in diese Richtung)
function slopePiece(scene, minX, minZ, maxX, maxZ, y0, rise, axis, dir, material, matName, hp = 200, kind = 'ramp') {
  const run = axis === 0 ? maxX - minX : maxZ - minZ;
  const width = axis === 0 ? maxZ - minZ : maxX - minX;
  const len = Math.hypot(run, rise);
  const geo = cachedGeo('sl' + run + 'x' + width + 'x' + rise, () => boxesGeo([[width, 0.25, len, 0, -0.125, 0]]));
  const m = new THREE.Mesh(geo, material);
  m.rotation.x = -Math.atan2(rise, run);   // lokal: steigt Richtung +z
  m.castShadow = true; m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  if (axis === 2) g.rotation.y = dir > 0 ? 0 : Math.PI;
  else g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  g.position.set((minX + maxX) / 2, y0 + rise / 2, (minZ + maxZ) / 2);
  scene.add(g);
  const p = new Piece(g, matName, hp, { kind, center: g.position.clone() });
  p.ramp(minX, y0, minZ, maxX, y0 + rise, maxZ, axis, dir);
  return p;
}

const BUILDING_STYLES = () => ({
  brick:   { wall: mat('brick'), mat: 'stone', hp: 260 },
  plaster: { wall: mat('plaster', '#f0d9a8'), mat: 'stone', hp: 220 },
  blue:    { wall: mat('plaster', '#a9c6e8'), mat: 'stone', hp: 220 },
  mint:    { wall: mat('plaster', '#bfe3c8'), mat: 'stone', hp: 220 },
  wood:    { wall: mat('planks'), mat: 'wood', hp: 160 },
  metal:   { wall: mat('metal', '#d8dee4'), mat: 'metal', hp: 320 },
  rose:    { wall: mat('plaster', '#f1b9b0'), mat: 'stone', hp: 220 },
});

// Allgemeines Gebäude: x0/z0 = Ecke (min), tw/td = Kacheln, floors = Stockwerke
// opts: style, roof ('flat'|'gable'), door: 'n'|'s'|'e'|'w', shop (große Fenster unten)
function makeBuilding(scene, x0, z0, tw, td, floors, opts) {
  const style = opts.style;
  const floorMat = opts.floorMat || mat('planks', '#d9b48a');
  const doorSide = opts.door || 's';
  const doorIdx = opts.doorIdx !== undefined ? opts.doorIdx : Math.floor((doorSide === 'n' || doorSide === 's' ? tw : td) / 2);
  // Treppe innen: Kachel in einer Ecke
  const stairX = tw - 1, stairZ = 0;
  for (let f = 0; f < floors; f++) {
    const y = f * T;
    // Wände
    for (let i = 0; i < tw; i++) {
      for (const side of ['n', 's']) {
        const z = side === 's' ? z0 + td * T : z0;
        let type = rand() < 0.55 ? 'window' : 'wall';
        if (f === 0 && opts.shop && side === doorSide) type = 'bigwindow';
        if (f === 0 && side === doorSide && i === doorIdx) type = 'door';
        if (f === 0 && side !== doorSide && opts.backDoor && i === 0) type = 'door';
        wallPanel(scene, x0 + i * T + T / 2, y, z, 'x', type, style);
      }
    }
    for (let j = 0; j < td; j++) {
      for (const side of ['w', 'e']) {
        const x = side === 'e' ? x0 + tw * T : x0;
        let type = rand() < 0.5 ? 'window' : 'wall';
        if (f === 0 && side === doorSide && j === doorIdx) type = 'door';
        wallPanel(scene, x, y, z0 + j * T + T / 2, 'z', type, style);
      }
    }
    // Böden (Erdgeschoss dünn, darüber mit Loch für Treppe)
    for (let i = 0; i < tw; i++) for (let j = 0; j < td; j++) {
      const cx = x0 + i * T + T / 2, cz = z0 + j * T + T / 2;
      if (f === 0) {
        // Erdgeschoss-Boden: ein Stück (unten drunter ist eh die Erde)
      } else if (!(i === stairX && j === stairZ)) {
        floorTile(scene, cx, y + 0.12, cz, floorMat, 'wood', 160);
      }
    }
    if (f === 0) {
      const gm = new THREE.Mesh(boxesGeo([[tw * T, 0.12, td * T, x0 + tw * T / 2, 0.06, z0 + td * T / 2]]), floorMat);
      gm.receiveShadow = true;
      scene.add(gm);
      addBox(x0, 0, z0, x0 + tw * T, 0.12, z0 + td * T);
    }
    // Treppe zum nächsten Stock (oder aufs Dach)
    if (f < floors - 1 || opts.roof === 'flat') {
      const sx = x0 + stairX * T, sz = z0 + stairZ * T;
      slopePiece(scene, sx, sz, sx + T, sz + T, y + 0.12, T, 0, -1, mat('planks', '#b98d5e'), 'wood', 160);
    }
    // Möbel
    if (opts.furniture !== false) addFurniture(scene, x0, z0, tw, td, y + 0.12, stairX, stairZ, f);
  }
  const top = floors * T;
  if (opts.roof === 'gable') {
    gableRoof(scene, x0, z0, tw * T, td * T, top, opts.roofMat || mat('roof'), opts.ridgeAxis || (tw >= td ? 'x' : 'z'));
  } else {
    for (let i = 0; i < tw; i++) for (let j = 0; j < td; j++) {
      if (i === stairX && j === stairZ) continue;
      floorTile(scene, x0 + i * T + T / 2, top + 0.12, z0 + j * T + T / 2, mat('sidewalk', '#9d9a94'), 'stone', 200);
    }
    // kleine Brüstung
    const pm = colMat('#7c7a76');
    const par = new THREE.Mesh(boxesGeo([
      [tw * T, 0.6, 0.3, tw * T / 2, 0.3, 0], [tw * T, 0.6, 0.3, tw * T / 2, 0.3, td * T],
      [0.3, 0.6, td * T, 0, 0.3, td * T / 2], [0.3, 0.6, td * T, tw * T, 0.3, td * T / 2]]), pm);
    par.position.set(x0, top + 0.12, z0);
    par.castShadow = true;
    scene.add(par);
    const pp = new Piece(par, 'stone', 150, { kind: 'wall', center: new THREE.Vector3(x0 + tw * T / 2, top + 0.4, z0 + td * T / 2) });
    pp.box(x0 - 0.15, top, z0 - 0.15, x0 + tw * T + 0.15, top + 0.72, z0 + 0.15);
    pp.box(x0 - 0.15, top, z0 + td * T - 0.15, x0 + tw * T + 0.15, top + 0.72, z0 + td * T + 0.15);
    pp.box(x0 - 0.15, top, z0, x0 + 0.15, top + 0.72, z0 + td * T);
    pp.box(x0 + tw * T - 0.15, top, z0, x0 + tw * T + 0.15, top + 0.72, z0 + td * T);
  }
  // Kisten im Gebäude
  const chestCount = opts.chests !== undefined ? opts.chests : 1;
  for (let c = 0; c < chestCount; c++) {
    const f = floors > 1 ? (c === 0 ? floors - 1 : rndi(0, floors - 1)) : 0;
    let ci = rndi(0, tw - 1), cj = rndi(0, td - 1);
    if (ci === stairX && cj === stairZ) ci = 0;
    Chests.spawn(x0 + ci * T + T / 2 + rnd(-0.8, 0.8), f * T + 0.12, z0 + cj * T + T / 2 + rnd(-0.8, 0.8), rndi(0, 3) * Math.PI / 2);
  }
  return { x0, z0, w: tw * T, d: td * T, h: top };
}

function gableRoof(scene, x0, z0, w, d, top, roofMat, ridge) {
  const rise = ridge === 'x' ? d / 2 * 0.75 : w / 2 * 0.75;
  if (ridge === 'x') {
    slopePiece(scene, x0 - 0.4, z0 - 0.4, x0 + w + 0.4, z0 + d / 2, top, rise, 2, 1, roofMat, 'wood', 200, 'roof');
    slopePiece(scene, x0 - 0.4, z0 + d / 2, x0 + w + 0.4, z0 + d + 0.4, top, rise, 2, -1, roofMat, 'wood', 200, 'roof');
    gableEnds(scene, x0, z0, w, d, top, rise, 'x');
  } else {
    slopePiece(scene, x0 - 0.4, z0 - 0.4, x0 + w / 2, z0 + d + 0.4, top, rise, 0, 1, roofMat, 'wood', 200, 'roof');
    slopePiece(scene, x0 + w / 2, z0 - 0.4, x0 + w + 0.4, z0 + d + 0.4, top, rise, 0, -1, roofMat, 'wood', 200, 'roof');
    gableEnds(scene, x0, z0, w, d, top, rise, 'z');
  }
}

// Dreieckige Giebelwände
function gableEnds(scene, x0, z0, w, d, top, rise, ridge) {
  const span = ridge === 'x' ? d : w;
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, 0); shape.lineTo(span / 2, 0); shape.lineTo(0, rise); shape.lineTo(-span / 2, 0);
  const geo = cachedGeo('gab' + span + 'x' + rise, () => new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }));
  const m1 = colMat('#e9e2d4');
  for (const end of [0, 1]) {
    const mesh = new THREE.Mesh(geo, m1);
    mesh.castShadow = true;
    if (ridge === 'x') {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(end ? x0 + w - 0.15 : x0 - 0.15, top, z0 + d / 2);
    } else {
      mesh.position.set(x0 + w / 2, top, end ? z0 + d - 0.15 : z0 - 0.15);
    }
    scene.add(mesh);
  }
}

function addFurniture(scene, x0, z0, tw, td, y, sx, sz, f) {
  const n = rndi(1, 3);
  for (let k = 0; k < n; k++) {
    let i = rndi(0, tw - 1), j = rndi(0, td - 1);
    if (i === sx && j === sz) continue;
    const cx = x0 + i * T + T / 2 + rnd(-1, 1), cz = z0 + j * T + T / 2 + rnd(-1, 1);
    const type = rndi(0, 3);
    let list, w, h, d, m = 'wood';
    if (type === 0) { // Tisch
      w = 1.6; h = 0.8; d = 1.0;
      const wm = '#8b5a2b';
      list = [[w, 0.08, d, 0, h - 0.04, 0, wm]];
      for (const [a, b] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) list.push([0.08, h, 0.08, a, h / 2, b, wm]);
    } else if (type === 1) { // Sofa
      w = 2.0; h = 0.9; d = 0.9;
      const sm = pick(['#b04a4a', '#4a6fb0', '#5d8a4a', '#8a6a4a']);
      list = [[w, 0.45, d, 0, 0.225, 0, sm], [w, 0.5, 0.2, 0, 0.65, -0.35, sm], [0.2, 0.3, d, -0.9, 0.6, 0, sm], [0.2, 0.3, d, 0.9, 0.6, 0, sm]];
    } else if (type === 2) { // Regal
      w = 1.4; h = 2.0; d = 0.45;
      const wm = '#6e4524';
      list = [[w, h, 0.05, 0, h / 2, -0.2, wm]];
      for (let k2 = 0; k2 < 4; k2++) list.push([w, 0.05, d, 0, 0.1 + k2 * 0.6, 0, wm]);
      for (let k2 = 0; k2 < 3; k2++) list.push([rnd(0.2, 0.6), 0.35, 0.3, rnd(-0.4, 0.4), 0.3 + k2 * 0.6, 0, pick(['#c0392b', '#2980b9', '#27ae60', '#f39c12'])]);
    } else { // Kühlschrank
      w = 0.8; h = 1.9; d = 0.7; m = 'metal';
      list = [[w, h, d, 0, h / 2, 0, '#e8ecef'], [0.05, 0.5, 0.05, 0.3, 1.2, 0.37, '#888888'], [w, 0.02, 0.02, 0, 1.3, 0.36, '#bbbbbb']];
    }
    const g = new THREE.Group();
    g.add(vcMesh(list));
    g.position.set(cx, y, cz);
    const rot = rndi(0, 3);
    g.rotation.y = rot * Math.PI / 2;
    scene.add(g);
    const p = new Piece(g, m, 80, { kind: 'prop', center: new THREE.Vector3(cx, y + h / 2, cz) });
    const rw = rot % 2 ? d : w, rd = rot % 2 ? w : d;
    p.boxC(cx, y + h / 2, cz, rw, h, rd);
  }
}

// ---------------- Kirche ----------------
function makeChurch(scene, cx, cz) {
  const stone = { wall: mat('stone', '#fff8ea'), mat: 'stone', hp: 400,
    glass: colMat('#7e57c2', { transparent: true, opacity: 0.6, emissive: '#2a1650' }) };
  const stoneRed = { wall: mat('stone', '#fff8ea'), mat: 'stone', hp: 400,
    glass: colMat('#d84343', { transparent: true, opacity: 0.6, emissive: '#4a1010' }) };
  const stoneBlue = { wall: mat('stone', '#fff8ea'), mat: 'stone', hp: 400,
    glass: colMat('#3f7fd8', { transparent: true, opacity: 0.6, emissive: '#10204a' }) };
  // Kirchenschiff: 3 x 5 Kacheln, 8 m hoch, Turm vorne (Süden, +z)
  const nw = 3, nd = 5;
  const x0 = cx - nw * T / 2, z0 = cz - (nd * T + 8) / 2;
  const glassStyles = [stone, stoneRed, stoneBlue];
  for (let band = 0; band < 2; band++) {
    const y = band * T;
    for (let j = 0; j < nd; j++) {
      for (const side of ['w', 'e']) {
        const x = side === 'e' ? x0 + nw * T : x0;
        const st = glassStyles[j % 3];
        wallPanel(scene, x, y, z0 + j * T + T / 2, 'z', band === 1 ? 'tallwindow' : 'wall', st);
      }
    }
    for (let i = 0; i < nw; i++) {
      // Rückwand (Norden) mit Fenster oben
      wallPanel(scene, x0 + i * T + T / 2, y, z0, 'x', band === 1 && i === 1 ? 'tallwindow' : 'wall', stoneRed);
      // Vorne: Öffnung zum Turm in der Mitte
      if (!(i === 1 && band === 0)) wallPanel(scene, x0 + i * T + T / 2, y, z0 + nd * T, 'x', 'wall', stone);
    }
  }
  // Boden
  for (let i = 0; i < nw; i++) for (let j = 0; j < nd; j++)
    floorTile(scene, x0 + i * T + T / 2, 0.12, z0 + j * T + T / 2, mat('stone', '#b9b2a4'), 'stone', 300);
  // Dach
  gableRoof(scene, x0, z0, nw * T, nd * T, 2 * T, mat('roof', '#7d8a99'), 'z');
  // Turm 2x2 Kacheln, 5 Ebenen
  const tx0 = cx - T, tz0 = z0 + nd * T;
  const levels = 5;
  for (let l = 0; l < levels; l++) {
    const y = l * T;
    for (let i = 0; i < 2; i++) {
      // Vorderseite
      let type = l === 0 && i === 0 ? 'door' : (l === levels - 1 ? 'tallwindow' : (l % 2 ? 'window' : 'wall'));
      if (l === 0 && i === 1) type = 'door';
      wallPanel(scene, tx0 + i * T + T / 2, y, tz0 + 2 * T, 'x', type, stone);
      // Rückseite (zum Schiff) – unten offen, ab 8 m Wand
      if (l >= 2) wallPanel(scene, tx0 + i * T + T / 2, y, tz0, 'x', l === levels - 1 ? 'tallwindow' : 'wall', stone);
    }
    for (let j = 0; j < 2; j++) {
      const type = l === levels - 1 ? 'tallwindow' : (l === 2 ? 'window' : 'wall');
      wallPanel(scene, tx0, y, tz0 + j * T + T / 2, 'z', type, stone);
      wallPanel(scene, tx0 + 2 * T, y, tz0 + j * T + T / 2, 'z', type, stone);
    }
    // Turmböden mit Treppen (abwechselnde Ecke)
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      if (l > 0 && i === (l % 2 === 0 ? 0 : 1) && j === 0) continue; // Loch über der Treppe darunter
      floorTile(scene, tx0 + i * T + T / 2, y + 0.12, tz0 + j * T + T / 2, mat('stone', '#b9b2a4'), 'stone', 300);
    }
    if (l < levels - 1) {
      const si = l % 2 === 0 ? 1 : 0;
      slopePiece(scene, tx0 + si * T, tz0, tx0 + si * T + T, tz0 + T, y + 0.12, T, 0, si === 1 ? -1 : 1, mat('planks', '#9a7048'), 'wood', 200);
    }
  }
  // Turmdach-Plattform + Spitze
  const ty = levels * T;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
    floorTile(scene, tx0 + i * T + T / 2, ty + 0.12, tz0 + j * T + T / 2, mat('stone', '#9d978c'), 'stone', 300);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(6.2, 12, 4), mat('roof', '#5d6b7a'));
  spire.rotation.y = Math.PI / 4;
  spire.position.set(cx, ty + 6.2, tz0 + T);
  spire.castShadow = true;
  scene.add(spire);
  const sp = new Piece(spire, 'metal', 600, { kind: 'roof', center: spire.position.clone() });
  sp.boxC(cx, ty + 3, tz0 + T, 5, 6, 5);
  sp.boxC(cx, ty + 8, tz0 + T, 2.4, 4, 2.4);
  // Kreuz
  const gold = colMat('#f2c14e', { emissive: '#5a4000' });
  const cross = new THREE.Group();
  cross.add(boxMesh(0.25, 2.4, 0.25, gold, 0, 1.2, 0));
  cross.add(boxMesh(1.4, 0.25, 0.25, gold, 0, 1.6, 0));
  cross.position.set(cx, ty + 12.1, tz0 + T);
  scene.add(cross);
  // Glocke
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 1.2, 12), gold);
  bell.position.set(cx, (levels - 1) * T + 2.6, tz0 + T);
  scene.add(bell);
  // Kirchenbänke
  const pewMat = '#6e4524';
  for (let r = 0; r < 6; r++) {
    for (const s of [-1, 1]) {
      const px = cx + s * 3.2, pz = z0 + 7 + r * 2.0;
      const g = new THREE.Group();
      g.add(vcMesh([[3.6, 0.12, 0.6, 0, 0.5, 0, pewMat], [3.6, 0.7, 0.1, 0, 0.85, 0.3, pewMat],
        [0.1, 0.5, 0.6, -1.75, 0.25, 0, pewMat], [0.1, 0.5, 0.6, 1.75, 0.25, 0, pewMat]], 'pew'));
      g.position.set(px, 0.12, pz);
      scene.add(g);
      const p = new Piece(g, 'wood', 60, { kind: 'prop', center: new THREE.Vector3(px, 0.6, pz) });
      p.boxC(px, 0.62, pz, 3.6, 1.0, 0.7);
    }
  }
  // Altar
  const altar = new THREE.Group();
  altar.add(boxMesh(3, 1.1, 1.2, mat('stone', '#f4efe6'), 0, 0.55, 0));
  altar.add(boxMesh(3.2, 0.1, 1.4, colMat('#a83232'), 0, 1.12, 0));
  altar.add(boxMesh(0.12, 0.7, 0.12, gold, -1, 1.5, 0));
  altar.add(boxMesh(0.12, 0.7, 0.12, gold, 1, 1.5, 0));
  altar.position.set(cx, 0.12, z0 + 3);
  scene.add(altar);
  const ap = new Piece(altar, 'stone', 250, { kind: 'prop', center: new THREE.Vector3(cx, 0.7, z0 + 3) });
  ap.boxC(cx, 0.7, z0 + 3, 3.2, 1.2, 1.4);
  // Kisten in der Kirche
  Chests.spawn(cx + 3.5, 0.12, z0 + 2.2, 0);
  Chests.spawn(cx - 3.5, 0.12, z0 + 2.2, 0);
  Chests.spawn(cx + 2, (levels - 1) * T + 0.12, tz0 + 6, Math.PI);
  return { x0, z0, w: nw * T, d: nd * T + 8 };
}
