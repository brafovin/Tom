'use strict';
// ============================================================
//  Kampf: Schüsse, Treffer, Raketen, Explosionen
// ============================================================
const Entities = [];   // Spieler + Bots

const _eb = { t: 0, nx: 0, ny: 0, nz: 0 };
function rayEntities(o, d, maxDist, ignore) {
  let best = maxDist, hit = null, head = false;
  for (const e of Entities) {
    if (!e.alive || e === ignore || e.inBus) continue;
    const p = e.pos;
    // grobe Vorprüfung
    const dx = p.x - o.x, dz = p.z - o.z;
    const along = dx * d.x + dz * d.z;
    if (along < -2 || along > best + 2) continue;
    const bodyTop = p.y + e.h - 0.4;
    if (rayBox(o, d, { minX: p.x - 0.42, minY: p.y, minZ: p.z - 0.42, maxX: p.x + 0.42, maxY: bodyTop, maxZ: p.z + 0.42 }, _eb) && _eb.t < best) {
      best = _eb.t; hit = e; head = false;
    }
    if (rayBox(o, d, { minX: p.x - 0.26, minY: bodyTop, minZ: p.z - 0.26, maxX: p.x + 0.26, maxY: p.y + e.h + 0.05, maxZ: p.z + 0.26 }, _eb) && _eb.t < best) {
      best = _eb.t; hit = e; head = true;
    }
  }
  return hit ? { ent: hit, t: best, head } : null;
}

const Combat = {
  rockets: [],
  scene: null,

  init(scene) { this.scene = scene; this.rockets = []; },

  // Ein Schuss (oder Schrotladung). Liefert Trefferinfo für Trefferanzeige
  fire(shooter, item, origin, dir, spreadMul = 1, muzzle) {
    const w = WEAPONS[item.key];
    const rar = RARITIES[item.rarity];
    Sound.play(w.sound, origin);
    if (w.projectile) {
      this.spawnRocket(shooter, origin.clone().addScaledVector(dir, 0.8), dir.clone(), w.dmg * rar.dmg, w.radius);
      return { hits: 0 };
    }
    const pellets = w.pellets || 1;
    const res = { hits: 0, head: false, kill: false, dmg: 0 };
    for (let i = 0; i < pellets; i++) {
      const s = w.spread * spreadMul;
      const d = dir.clone();
      if (s > 0) {
        d.x += (Math.random() - 0.5) * 2 * s; d.y += (Math.random() - 0.5) * 2 * s; d.z += (Math.random() - 0.5) * 2 * s;
        d.normalize();
      }
      const dmg = w.dmg * rar.dmg * (shooter.dmgMul || 1);
      const r = this.hitscan(shooter, origin, d, w.range, dmg, w.head, muzzle);
      if (r.ent) { res.hits++; res.dmg += r.dmg; if (r.head) res.head = true; if (r.kill) res.kill = true; }
    }
    return res;
  },

  hitscan(shooter, origin, d, range, dmg, headMul, muzzle) {
    const wh = raycastWorld(origin, d, range);
    const maxT = wh ? wh.t : range;
    const eh = rayEntities(origin, d, maxT, shooter);
    const from = muzzle || origin;
    const out = { ent: null };
    if (eh) {
      const p = origin.clone().addScaledVector(d, eh.t);
      const total = dmg * (eh.head ? headMul : 1);
      const killed = eh.ent.takeDamage(total, shooter, eh.head);
      Effects.sparks(p, eh.ent.shield > 0 ? '#5ecbff' : '#ff4d4d', 4);
      Effects.tracer(from, p);
      if (shooter.isPlayer) Effects.dmgNumber(p, total, eh.head ? '#ffd43b' : (eh.ent.shield > 0 ? '#7fd3ff' : '#ffffff'), eh.head);
      out.ent = eh.ent; out.head = eh.head; out.kill = killed; out.dmg = total;
    } else if (wh) {
      Effects.tracer(from, wh.point);
      if (wh.collider && wh.collider.piece) {
        const piece = wh.collider.piece;
        Effects.sparks(wh.point, MAT_INFO[piece.mat].color, 3, wh.normal);
        damagePiece(piece, dmg, wh.point);
        if (shooter.isPlayer) UI.pieceHit(piece);
      } else {
        Effects.sparks(wh.point, '#c8b88a', 3, wh.normal);
      }
    } else {
      Effects.tracer(from, origin.clone().addScaledVector(d, range));
    }
    return out;
  },

  spawnRocket(shooter, pos, dir, dmg, radius) {
    const g = new THREE.Group();
    g.add(boxMesh(0.14, 0.14, 0.6, colMat('#3d5a3a'), 0, 0, 0));
    g.add(boxMesh(0.16, 0.16, 0.12, colMat('#ff5a1f', { emissive: '#ff3300' }), 0, 0, 0.32));
    g.position.copy(pos);
    g.lookAt(pos.clone().add(dir));
    g.rotateY(Math.PI);
    this.scene.add(g);
    this.rockets.push({ shooter, mesh: g, pos: g.position, dir, speed: 45, dmg, radius, life: 6, trailT: 0 });
  },

  explode(pos, radius, dmg, shooter) {
    Effects.explosion(pos, radius);
    Sound.play('explosion', pos);
    for (const e of Entities) {
      if (!e.alive || e === shooter || e.inBus) continue;   // eigene Raketen tun dir nichts
      const c = e.pos.clone(); c.y += 1;
      const dist = c.distanceTo(pos);
      if (dist < radius) {
        const f = 1 - dist / radius * 0.6;
        const killed = e.takeDamage(dmg * f, shooter, false);
        if (shooter && shooter.isPlayer && e !== shooter) {
          Effects.dmgNumber(c, dmg * f, '#ffffff');
          UI.hitMarker(false, killed);
        }
      }
    }
    // Gebäude in der Nähe zerstören
    Phys.query(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, _q);
    const hit = new Set();
    for (const c of _q) {
      if (!c.piece || hit.has(c.piece)) continue;
      const cx = clamp(pos.x, c.minX, c.maxX), cy = clamp(pos.y, c.minY, c.maxY), cz = clamp(pos.z, c.minZ, c.maxZ);
      const dd = Math.hypot(cx - pos.x, cy - pos.y, cz - pos.z);
      if (dd < radius * 0.8) hit.add(c.piece);
    }
    for (const p of hit) damagePiece(p, 400, pos);
  },

  update(dt) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      const step = r.speed * dt;
      const wh = raycastWorld(r.pos, r.dir, step);
      const eh = rayEntities(r.pos, r.dir, wh ? wh.t : step, r.shooter);
      if (wh || eh || r.life <= 0) {
        const p = eh ? r.pos.clone().addScaledVector(r.dir, eh.t) : (wh ? wh.point.clone().addScaledVector(r.dir, -0.3) : r.pos.clone());
        this.explode(p, r.radius, r.dmg, r.shooter);
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
        continue;
      }
      r.pos.addScaledVector(r.dir, step);
      r.trailT -= dt;
      if (r.trailT <= 0) {
        r.trailT = 0.03;
        Effects.particle(r.pos.clone().addScaledVector(r.dir, -0.4), pick(['#bbbbbb', '#999999', '#ffaa33']),
          new THREE.Vector3(mrnd(-0.5, 0.5), mrnd(0, 1), mrnd(-0.5, 0.5)), 0.6, 1.4, -1);
      }
    }
  },

  clear() {
    for (const r of this.rockets) this.scene.remove(r.mesh);
    this.rockets = [];
  },
};
