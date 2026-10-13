'use strict';
// ============================================================
//  Bauen: Wand, Boden, Rampe aus Holz / Stein / Metall
// ============================================================
const BUILD_COST = 10;
const BUILD_MATS = ['wood', 'stone', 'metal'];
const BUILD_HP = { wood: 150, stone: 300, metal: 450 };
const BUILD_TYPES = {
  wall: { name: 'Wand', key: 'Q' },
  floor: { name: 'Boden', key: 'X' },
  ramp: { name: 'Rampe', key: 'C' },
};

const Builds = {
  occupied: new Map(),
  scene: null,
  ghosts: {},

  init(scene) {
    this.scene = scene;
    this.occupied.clear();
    const gm = new THREE.MeshBasicMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.35, depthWrite: false });
    this.ghostMat = gm;
    const edge = (geo) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, gm));
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#ffffff' })));
      return g;
    };
    this.ghosts.wall = edge(new THREE.BoxGeometry(4, 4, 0.3));
    this.ghosts.floor = edge(new THREE.BoxGeometry(4, 0.2, 4));
    const rg = new THREE.Group();
    const inner = edge(new THREE.BoxGeometry(4, 0.2, Math.hypot(4, 4)));
    inner.rotation.x = -Math.PI / 4;
    rg.add(inner);
    this.ghosts.ramp = rg;
    for (const k in this.ghosts) { this.ghosts[k].visible = false; scene.add(this.ghosts[k]); }
  },

  materialFor(m) {
    if (m === 'wood') return mat('planks');
    if (m === 'stone') return mat('stone', '#d9d4ca');
    return mat('metal', '#c4ccd4');
  },

  // Unter den Füßen eine Rampe?
  rampUnder(pos) {
    Phys.query(pos.x - 0.1, pos.z - 0.1, pos.x + 0.1, pos.z + 0.1, _q);
    for (const c of _q) {
      if (c.ramp && c.piece && c.piece.kind === 'build' && pos.x >= c.minX && pos.x <= c.maxX && pos.z >= c.minZ && pos.z <= c.maxZ) {
        if (Math.abs(rampY(c, pos.x, pos.z) - pos.y) < 0.4) return c;
      }
    }
    return null;
  },

  // Berechnet, wo ein Bauteil landen würde
  placement(type, pos, yaw, pitch) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const alongX = Math.abs(fx) > Math.abs(fz);
    let level = Math.max(0, Math.round(pos.y / T));
    const up = pitch > 0.55 ? 1 : 0;
    const pl = { type };
    if (type === 'wall') {
      const tx = pos.x + fx * 2.2, tz = pos.z + fz * 2.2;
      level += up;
      if (alongX) {
        const X = Math.round(tx / T) * T, zc = Math.floor(tz / T) * T + T / 2;
        Object.assign(pl, { key: `W|z|${X}|${zc}|${level}`, x: X, z: zc, y: level * T, axis: 'z',
          box: [X - 0.15, level * T, zc - 2, X + 0.15, level * T + T, zc + 2] });
      } else {
        const Z = Math.round(tz / T) * T, xc = Math.floor(tx / T) * T + T / 2;
        Object.assign(pl, { key: `W|x|${xc}|${Z}|${level}`, x: xc, z: Z, y: level * T, axis: 'x',
          box: [xc - 2, level * T, Z - 0.15, xc + 2, level * T + T, Z + 0.15] });
      }
    } else if (type === 'floor') {
      level += up;
      const d = up ? 1.0 : 3.5;
      const cx = Math.floor((pos.x + fx * d) / T) * T + T / 2, cz = Math.floor((pos.z + fz * d) / T) * T + T / 2;
      const y = level * T + 0.1;
      Object.assign(pl, { key: `F|${cx}|${cz}|${level}`, x: cx, z: cz, y, box: [cx - 2, y - 0.2, cz - 2, cx + 2, y, cz + 2] });
    } else {
      const axis = alongX ? 0 : 2;
      const dir = alongX ? Math.sign(fx) : Math.sign(fz);
      let cx = Math.floor((pos.x + fx * 3.5) / T) * T + T / 2, cz = Math.floor((pos.z + fz * 3.5) / T) * T + T / 2;
      const ru = this.rampUnder(pos);
      if (ru && ru.ramp.axis === axis && ru.ramp.dir === dir) {
        const rcx = (ru.minX + ru.maxX) / 2, rcz = (ru.minZ + ru.maxZ) / 2;
        cx = rcx + (axis === 0 ? dir * T : 0); cz = rcz + (axis === 2 ? dir * T : 0);
        level = Math.round(ru.maxY / T);
      }
      Object.assign(pl, { key: `R|${cx}|${cz}|${level}`, x: cx, z: cz, y: level * T, axis, dir,
        box: [cx - 2, level * T, cz - 2, cx + 2, level * T + T, cz + 2] });
    }
    return pl;
  },

  canPlace(pl, mats, matName) {
    if (this.occupied.has(pl.key)) return false;
    if (mats && mats[matName] < BUILD_COST) return false;
    if (pl.type !== 'ramp') {
      const [a, b, c, d, e, f] = pl.box;
      for (const ent of Entities) {
        if (!ent.alive) continue;
        const p = ent.pos;
        if (a < p.x + ent.r && d > p.x - ent.r && c < p.z + ent.r && f > p.z - ent.r && b < p.y + ent.h && e > p.y + 0.15) return false;
      }
    }
    return true;
  },

  showGhost(pl, ok) {
    for (const k in this.ghosts) this.ghosts[k].visible = false;
    if (!pl) return;
    const g = this.ghosts[pl.type];
    g.visible = true;
    this.ghostMat.color.set(ok ? '#4fc3f7' : '#ff5252');
    if (pl.type === 'wall') {
      g.position.set(pl.x, pl.y + 2, pl.z);
      g.rotation.y = pl.axis === 'z' ? Math.PI / 2 : 0;
    } else if (pl.type === 'floor') {
      g.position.set(pl.x, pl.y - 0.1, pl.z);
    } else {
      g.position.set(pl.x, pl.y + 2, pl.z);
      if (pl.axis === 2) g.rotation.y = pl.dir > 0 ? 0 : Math.PI;
      else g.rotation.y = pl.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  },

  hideGhost() { for (const k in this.ghosts) this.ghosts[k].visible = false; },

  place(pl, matName, owner) {
    const material = this.materialFor(matName);
    const hp = BUILD_HP[matName];
    let piece;
    if (pl.type === 'wall') {
      const geo = cachedGeo('bwall', () => boxesGeo([[4, 4, 0.3, 0, 2, 0]]));
      const m = new THREE.Mesh(geo, material);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(pl.x, pl.y, pl.z);
      if (pl.axis === 'z') m.rotation.y = Math.PI / 2;
      this.scene.add(m);
      piece = new Piece(m, matName, hp, { kind: 'build', center: new THREE.Vector3(pl.x, pl.y + 2, pl.z) });
      piece.box(...pl.box);
    } else if (pl.type === 'floor') {
      const geo = cachedGeo('bfloor', () => boxesGeo([[4, 0.2, 4, 0, -0.1, 0]]));
      const m = new THREE.Mesh(geo, material);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(pl.x, pl.y, pl.z);
      this.scene.add(m);
      piece = new Piece(m, matName, hp, { kind: 'build', center: new THREE.Vector3(pl.x, pl.y, pl.z) });
      piece.box(...pl.box);
    } else {
      const [a, , c, d, , f] = pl.box;
      piece = slopePiece(this.scene, a, c, d, f, pl.y, T, pl.axis, pl.dir, material, matName, hp, 'build');
    }
    piece.kind = 'build';
    piece.owner = owner || null;
    const key = pl.key;
    this.occupied.set(key, piece);
    piece.onDestroy = () => { if (this.occupied.get(key) === piece) this.occupied.delete(key); };
    Sound.play('build', piece.center);
    return piece;
  },
};
