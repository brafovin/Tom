'use strict';
// ============================================================
//  Physik: Kollisionsboxen, Rampen, Strahlen (Schüsse), Bewegung
// ============================================================

const CELL = 8;          // Größe einer Rasterzelle für die schnelle Suche
const STEP_H = 0.55;     // so hoch kann man einfach hochlaufen
const GRAVITY = 22;

const Phys = {
  grid: new Map(),
  stamp: 1,
  key(i, j) { return (i + 1000) * 4000 + (j + 1000); },

  add(c) {
    c.cells = [];
    c.stamp = 0;
    const i0 = Math.floor(c.minX / CELL), i1 = Math.floor(c.maxX / CELL);
    const j0 = Math.floor(c.minZ / CELL), j1 = Math.floor(c.maxZ / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(c);
      c.cells.push(k);
    }
    return c;
  },

  remove(c) {
    for (const k of c.cells) {
      const arr = this.grid.get(k);
      if (!arr) continue;
      const idx = arr.indexOf(c);
      if (idx >= 0) arr.splice(idx, 1);
    }
    c.cells = [];
    c.removed = true;
  },

  query(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const s = ++this.stamp;
    const i0 = Math.floor(minX / CELL), i1 = Math.floor(maxX / CELL);
    const j0 = Math.floor(minZ / CELL), j1 = Math.floor(maxZ / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const arr = this.grid.get(this.key(i, j));
      if (!arr) continue;
      for (const c of arr) if (c.stamp !== s) { c.stamp = s; out.push(c); }
    }
    return out;
  },
};

// Box-Collider anlegen (Minimum/Maximum)
function addBox(minX, minY, minZ, maxX, maxY, maxZ, piece) {
  return Phys.add({ minX, minY, minZ, maxX, maxY, maxZ, ramp: null, piece: piece || null });
}
// Box-Collider aus Mittelpunkt und Größe
function addBoxC(x, y, z, w, h, d, piece) {
  return addBox(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, piece);
}
// Rampe: steigt entlang axis (0 = x, 2 = z) in Richtung dir (+1/-1) von minY bis maxY
function addRamp(minX, minY, minZ, maxX, maxY, maxZ, axis, dir, piece) {
  return Phys.add({ minX, minY, minZ, maxX, maxY, maxZ, ramp: { axis, dir }, piece: piece || null });
}

function rampY(c, x, z) {
  let t = c.ramp.axis === 0 ? (x - c.minX) / (c.maxX - c.minX) : (z - c.minZ) / (c.maxZ - c.minZ);
  t = clamp(t, 0, 1);
  if (c.ramp.dir < 0) t = 1 - t;
  return c.minY + t * (c.maxY - c.minY);
}

const _q = [];
const _q2 = [];

function solidOverlaps(x, y, z, r, h, out) {
  out.length = 0;
  Phys.query(x - r, z - r, x + r, z + r, _q2);
  for (const c of _q2) {
    if (c.ramp || c.noCollide) continue;
    if (c.minX < x + r && c.maxX > x - r && c.minZ < z + r && c.maxZ > z - r &&
        c.minY < y + h && c.maxY > y + 0.05) out.push(c);
  }
  return out;
}

function overlapsBox(c, x, y, z, r, h) {
  return c.minX < x + r && c.maxX > x - r && c.minZ < z + r && c.maxZ > z - r &&
         c.minY < y + h && c.maxY > y + 0.05;
}

// Höchste begehbare Fläche unter (x,z), die nicht höher als maxY ist
function groundHeight(x, z, r, maxY) {
  let best = terrainH(x, z);
  const rr = r * 0.85;
  Phys.query(x - rr, z - rr, x + rr, z + rr, _q);
  for (const c of _q) {
    if (c.noCollide) continue;
    if (c.ramp) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
        const y = rampY(c, x, z);
        if (y <= maxY && y > best) best = y;
      }
    } else if (c.minX < x + rr && c.maxX > x - rr && c.minZ < z + rr && c.maxZ > z - rr) {
      if (c.maxY <= maxY && c.maxY > best) best = c.maxY;
    }
  }
  return best;
}

const _hits = [];
const _hits2 = [];

function moveAxis(b, axis, delta) {
  if (delta === 0) return false;
  const p = b.pos, r = b.r;
  let nx = p.x, nz = p.z;
  if (axis === 0) nx += delta; else nz += delta;
  solidOverlaps(nx, p.y, nz, r, b.h, _hits);
  // Boxen, in denen wir schon stecken, ignorieren (damit man rauslaufen kann)
  let n = 0;
  for (const c of _hits) if (!overlapsBox(c, p.x, p.y, p.z, r, b.h)) _hits[n++] = c;
  _hits.length = n;
  if (!n) { p.x = nx; p.z = nz; return false; }
  let top = -Infinity;
  for (const c of _hits) top = Math.max(top, c.maxY);
  if (b.onGround && top - p.y <= STEP_H && solidOverlaps(nx, top + 0.01, nz, r, b.h, _hits2).length === 0) {
    p.x = nx; p.z = nz; p.y = top;
    return false;
  }
  for (const c of _hits) {
    if (axis === 0) {
      if (delta > 0) nx = Math.min(nx, c.minX - r - 0.001); else nx = Math.max(nx, c.maxX + r + 0.001);
    } else {
      if (delta > 0) nz = Math.min(nz, c.minZ - r - 0.001); else nz = Math.max(nz, c.maxZ + r + 0.001);
    }
  }
  if (axis === 0) p.x = delta > 0 ? Math.max(p.x, nx) : Math.min(p.x, nx);
  else p.z = delta > 0 ? Math.max(p.z, nz) : Math.min(p.z, nz);
  return true;
}

// Bewegt einen Körper {pos, vel, r, h, onGround} mit Kollision
function moveBody(b, dt, gravity = GRAVITY, maxFall = 60) {
  const p = b.pos;
  b.blocked = false;
  // horizontal in kleinen Schritten (verhindert Durchtunneln)
  const dx = b.vel.x * dt, dz = b.vel.z * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.3));
  for (let i = 0; i < steps; i++) {
    if (moveAxis(b, 0, dx / steps)) b.blocked = true;
    if (moveAxis(b, 2, dz / steps)) b.blocked = true;
  }
  // Schwimmen: im tiefen Wasser treibt man oben
  const th = terrainH(p.x, p.z);
  const floatY = WATER_Y - 1.25;
  const wasSwimming = b.swimming;
  b.swimming = th < SWIM_DEPTH && p.y < floatY + 0.4;
  if (b.swimming) {
    if (!wasSwimming && b.vel.y < -3) {
      Effects.sparks(new THREE.Vector3(p.x, WATER_Y + 0.1, p.z), '#cdeeff', 14, new THREE.Vector3(0, 1, 0));
      Sound.play('splash', p);
    }
    b.vel.y = (floatY - p.y) * 4;
    p.y = Math.max(th, p.y + b.vel.y * dt);
    b.onGround = false;
    p.x = clamp(p.x, -MAP_HALF + 1, MAP_HALF - 1);
    p.z = clamp(p.z, -MAP_HALF + 1, MAP_HALF - 1);
    return;
  }
  // vertikal
  b.vel.y = Math.max(b.vel.y - gravity * dt, -maxFall);
  let ny = p.y + b.vel.y * dt;
  if (b.vel.y <= 0) {
    const g = groundHeight(p.x, p.z, b.r, p.y + 0.6);
    if (ny <= g) {
      ny = g; b.vel.y = 0; b.onGround = true;
    } else if (b.onGround && p.y - g < 0.6) {
      ny = g; b.vel.y = 0; b.onGround = true;   // an Rampen/Treppen "kleben"
    } else {
      b.onGround = false;
    }
  } else {
    solidOverlaps(p.x, ny, p.z, b.r, b.h, _hits);
    for (const c of _hits) {
      if (c.minY >= p.y + b.h - 0.3) { ny = Math.min(ny, c.minY - b.h); b.vel.y = 0; }
    }
    b.onGround = false;
  }
  p.y = ny;
  // Kartenrand
  p.x = clamp(p.x, -MAP_HALF + 1, MAP_HALF - 1);
  p.z = clamp(p.z, -MAP_HALF + 1, MAP_HALF - 1);
}

// --- Strahlen ---
function rayBox(o, d, c, out) {
  let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 0;
  const mins = [c.minX, c.minY, c.minZ], maxs = [c.maxX, c.maxY, c.maxZ];
  const os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(ds[a]) < 1e-9) {
      if (os[a] < mins[a] || os[a] > maxs[a]) return false;
    } else {
      let t1 = (mins[a] - os[a]) / ds[a], t2 = (maxs[a] - os[a]) / ds[a];
      let s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    }
  }
  if (tmax < 0) return false;
  out.t = tmin < 0 ? 0 : tmin;
  out.nx = axis === 0 ? sign : 0; out.ny = axis === 1 ? sign : 0; out.nz = axis === 2 ? sign : 0;
  return true;
}

function rayRamp(o, d, c, out) {
  const len = c.ramp.axis === 0 ? c.maxX - c.minX : c.maxZ - c.minZ;
  const k = (c.maxY - c.minY) / len;
  const sDir = c.ramp.axis === 0 ? d.x : d.z;
  const sOrg = c.ramp.axis === 0 ? (c.ramp.dir > 0 ? o.x - c.minX : c.maxX - o.x)
                                 : (c.ramp.dir > 0 ? o.z - c.minZ : c.maxZ - o.z);
  const sd = c.ramp.dir > 0 ? sDir : -sDir;
  const f0 = o.y - c.minY - k * sOrg;
  const den = d.y - k * sd;
  if (Math.abs(den) < 1e-6) return false;
  const t = -f0 / den;
  if (t < 0) return false;
  const x = o.x + d.x * t, z = o.z + d.z * t;
  if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) return false;
  out.t = t;
  const nn = Math.hypot(k, 1);
  const sgn = f0 > 0 ? 1 : -1;
  out.ny = sgn / nn;
  const nh = -k * (c.ramp.dir > 0 ? 1 : -1) * sgn / nn;
  out.nx = c.ramp.axis === 0 ? nh : 0;
  out.nz = c.ramp.axis === 2 ? nh : 0;
  return true;
}

const _rb = { t: 0, nx: 0, ny: 0, nz: 0 };

// Strahl gegen die Welt. Liefert {t, point, normal, collider} oder null
function raycastWorld(o, d, maxDist, ignorePiece) {
  let best = maxDist, hit = null;
  let nx = 0, ny = 0, nz = 0;
  if (d.y < -1e-6) {
    let tg = -o.y / d.y;
    if (tg >= 0 && tg < best) {
      if (isWater(o.x + d.x * tg, o.z + d.z * tg)) {
        tg = (WATER_Y - o.y) / d.y;     // Treffer auf der Wasseroberfläche
        if (tg >= 0 && tg < best) { best = tg; hit = 'water'; nx = 0; ny = 1; nz = 0; }
      } else { best = tg; hit = 'ground'; nx = 0; ny = 1; nz = 0; }
    }
  }
  let cx = Math.floor(o.x / CELL), cz = Math.floor(o.z / CELL);
  const stepX = d.x > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
  const tdx = Math.abs(d.x) > 1e-9 ? Math.abs(CELL / d.x) : Infinity;
  const tdz = Math.abs(d.z) > 1e-9 ? Math.abs(CELL / d.z) : Infinity;
  let tmx = Math.abs(d.x) > 1e-9 ? (d.x > 0 ? (cx + 1) * CELL - o.x : o.x - cx * CELL) / Math.abs(d.x) : Infinity;
  let tmz = Math.abs(d.z) > 1e-9 ? (d.z > 0 ? (cz + 1) * CELL - o.z : o.z - cz * CELL) / Math.abs(d.z) : Infinity;
  const s = ++Phys.stamp;
  let t = 0, guard = 0;
  while (t <= best && guard++ < 200) {
    const arr = Phys.grid.get(Phys.key(cx, cz));
    if (arr) {
      for (const c of arr) {
        if (c.stamp === s) continue;
        c.stamp = s;
        if (c.noRay || (ignorePiece && c.piece === ignorePiece)) continue;
        const ok = c.ramp ? rayRamp(o, d, c, _rb) : rayBox(o, d, c, _rb);
        if (ok && _rb.t < best) { best = _rb.t; hit = c; nx = _rb.nx; ny = _rb.ny; nz = _rb.nz; }
      }
    }
    if (tmx < tmz) { t = tmx; tmx += tdx; cx += stepX; } else { t = tmz; tmz += tdz; cz += stepZ; }
  }
  if (!hit) return null;
  return {
    t: best,
    point: new THREE.Vector3(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best),
    normal: new THREE.Vector3(nx, ny, nz),
    collider: hit === 'ground' || hit === 'water' ? null : hit,
    water: hit === 'water',
  };
}

// Sichtlinie frei?
function lineOfSight(a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  d.divideScalar(len);
  const h = raycastWorld(a, d, len);
  return !h;
}

// ============================================================
//  Zerstörbare Objekte (Wände, Bäume, Steine, Mülltonnen ...)
// ============================================================
const MAT_INFO = {
  wood: { name: 'Holz', color: '#c58a4a' },
  stone: { name: 'Stein', color: '#a9a9a9' },
  metal: { name: 'Metall', color: '#8fb3d9' },
};

class Piece {
  constructor(obj, material, hp, opts = {}) {
    this.obj = obj;               // THREE.Object3D (oder null bei Instanzen)
    this.mat = material;          // 'wood' | 'stone' | 'metal'
    this.hp = this.maxHp = hp;
    this.colliders = [];
    this.alive = true;
    this.kind = opts.kind || 'prop';
    this.yieldMul = opts.yieldMul || 1;
    this.center = opts.center || (obj ? obj.position.clone() : new THREE.Vector3());
    this.inst = opts.inst || null; // {meshes, index, matrix}
    this.onDestroy = opts.onDestroy || null;
    this.shake = 0;
    this.owner = opts.owner || null;
    Pieces.add(this);
  }
  box(minX, minY, minZ, maxX, maxY, maxZ) {
    this.colliders.push(addBox(minX, minY, minZ, maxX, maxY, maxZ, this));
    return this;
  }
  boxC(x, y, z, w, h, d) {
    this.colliders.push(addBoxC(x, y, z, w, h, d, this));
    return this;
  }
  ramp(minX, minY, minZ, maxX, maxY, maxZ, axis, dir) {
    this.colliders.push(addRamp(minX, minY, minZ, maxX, maxY, maxZ, axis, dir, this));
    return this;
  }
}

const Pieces = new Set();
const shakingPieces = new Set();

function damagePiece(piece, dmg, hitPoint) {
  if (!piece || !piece.alive) return false;
  piece.hp -= dmg;
  piece.shake = 0.15;
  shakingPieces.add(piece);
  if (piece.hp <= 0) { destroyPiece(piece, hitPoint); return true; }
  return false;
}

const _m4 = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

function destroyPiece(piece, hitPoint) {
  if (!piece.alive) return;
  piece.alive = false;
  for (const c of piece.colliders) Phys.remove(c);
  piece.colliders.length = 0;
  if (piece.inst) {
    for (const m of piece.inst.meshes) { m.setMatrixAt(piece.inst.index, _zero); m.instanceMatrix.needsUpdate = true; }
  } else if (piece.obj && piece.obj.parent) {
    piece.obj.parent.remove(piece.obj);
  }
  Pieces.delete(piece);
  shakingPieces.delete(piece);
  const col = MAT_INFO[piece.mat] ? MAT_INFO[piece.mat].color : '#999';
  Effects.debris(piece.center, col, piece.kind === 'build' || piece.kind === 'wall' ? 18 : 12);
  Sound.play('break', piece.center);
  if (piece.onDestroy) piece.onDestroy(piece);
}

function updatePieceShake(dt) {
  for (const p of shakingPieces) {
    p.shake -= dt;
    const s = p.shake > 0 ? Math.sin(p.shake * 90) * 0.06 : 0;
    if (p.inst) {
      _m4.copy(p.inst.matrix);
      if (s) _m4.multiply(new THREE.Matrix4().makeRotationZ(s * 0.5));
      for (const m of p.inst.meshes) { m.setMatrixAt(p.inst.index, _m4); m.instanceMatrix.needsUpdate = true; }
    } else if (p.obj) {
      if (p.basePos === undefined) p.basePos = p.obj.position.clone();
      p.obj.position.set(p.basePos.x + s, p.basePos.y, p.basePos.z + s * 0.6);
    }
    if (p.shake <= 0) {
      if (p.obj && p.basePos) p.obj.position.copy(p.basePos);
      shakingPieces.delete(p);
    }
  }
}
