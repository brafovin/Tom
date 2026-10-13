'use strict';
// ============================================================
//  Gegner (Bots): suchen Kisten, kämpfen, bauen, laufen vor dem Sturm weg
// ============================================================
const BOT_NAMES = ['Max', 'Leon', 'Finn', 'Paul', 'Jonas', 'Ben', 'Luca', 'Noah', 'Emil', 'Mia', 'Lena', 'Emma',
  'Hannah', 'Sophie', 'Lea', 'Elias', 'Felix', 'Anton', 'Ida', 'Clara', 'Theo', 'Lina', 'Henry', 'Marie', 'Jakob', 'Frieda'];
const DIFFICULTY = {
  leicht: { name: 'Leicht', err: 0.09, react: 0.9, dmg: 0.4, build: 0.15, bots: 14 },
  normal: { name: 'Normal', err: 0.058, react: 0.55, dmg: 0.65, build: 0.35, bots: 18 },
  schwer: { name: 'Schwer', err: 0.034, react: 0.3, dmg: 0.95, build: 0.6, bots: 24 },
};
const PREF_DIST = { pistol: 16, smg: 11, ar: 24, shotgun: 5, sniper: 55, rocket: 24 };

function botModel() {
  const g = new THREE.Group();
  const shirt = pick(['#e74c3c', '#3498db', '#9b59b6', '#1abc9c', '#f39c12', '#2ecc71', '#e67e22', '#34495e', '#ff6fa8']),
        pants = pick(['#2c3e50', '#34495e', '#5d4037', '#1b2631', '#4a235a']),
        skin = pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
        hair = pick(['#2b1b0e', '#6b3e1e', '#d8b25a', '#111111', '#a33a1c']);
  const limb = (w, h, d, c, x, y) => {
    const grp = new THREE.Group();
    grp.add(vcMesh([[w, h, d, 0, -h / 2, 0, c]], 'limb' + w + h + c));
    grp.position.set(x, y, 0);
    g.add(grp);
    return grp;
  };
  const legL = limb(0.24, 0.85, 0.26, pants, -0.15, 0.85);
  const legR = limb(0.24, 0.85, 0.26, pants, 0.15, 0.85);
  const armL = limb(0.18, 0.65, 0.2, shirt, -0.41, 1.52);
  const armR = limb(0.18, 0.65, 0.2, shirt, 0.41, 1.52);
  g.add(vcMesh([[0.62, 0.72, 0.34, 0, 1.21, 0, shirt], [0.5, 0.55, 0.22, 0, 1.25, 0.27, '#5b4a3a'],
    [0.38, 0.38, 0.38, 0, 1.76, 0, skin], [0.4, 0.12, 0.4, 0, 1.97, 0.01, hair], [0.4, 0.2, 0.08, 0, 1.86, 0.17, hair],
    [0.06, 0.06, 0.02, -0.09, 1.79, -0.195, '#111111'], [0.06, 0.06, 0.02, 0.09, 1.79, -0.195, '#111111'],
    [0.64, 0.08, 0.36, 0, 0.88, 0, '#222222']]));
  return { g, legL, legR, armL, armR };
}

class Bot {
  constructor(scene, name, x, z) {
    this.scene = scene;
    this.isBot = true;
    this.name = name;
    this.pos = new THREE.Vector3(x, groundHeight(x, z, 0.4, 50), z);
    this.vel = new THREE.Vector3();
    this.r = 0.38; this.h = 1.85;
    this.yaw = Math.random() * 6.28;
    this.hp = 100; this.shield = 0;
    this.alive = true;
    this.onGround = true;
    this.weapon = Math.random() < 0.4 ? makeWeapon('pistol', 0) : null;
    this.mats = { wood: 120, stone: 0, metal: 0 };
    this.target = null; this.seeTarget = false; this.memoryT = 0; this.lastSeen = new THREE.Vector3();
    this.goal = null; this.goalT = 0;
    this.thinkT = Math.random() * 0.5; this.fireT = 1; this.reactT = 0; this.reloadT = 0;
    this.strafe = 1; this.strafeT = 0; this.walkT = 0;
    this.stuckT = 0; this.stuckN = 0; this.lastPos = this.pos.clone();
    this.buildCD = 0; this.calmT = 10; this.meleeT = 0;
    const m = botModel();
    Object.assign(this, { model: m.g, legL: m.legL, legR: m.legR, armL: m.armL, armR: m.armR });
    this.held = null;
    this.scene.add(this.model);
    this.refreshWeapon();
  }

  get dmgMul() { return Game.diff.dmg; }

  refreshWeapon() {
    if (this.held) this.model.remove(this.held);
    this.held = null;
    if (this.weapon) {
      this.held = weaponModel(this.weapon.key, this.weapon.rarity);
      this.held.scale.setScalar(1.3);
      this.held.position.set(0.2, 1.3, -0.45);
      this.model.add(this.held);
    }
  }

  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.65, this.pos.z); }

  takeDamage(dmg, from, head) {
    if (!this.alive) return false;
    let rest = dmg;
    if (this.shield > 0 && from !== 'zone') { const s = Math.min(this.shield, rest); this.shield -= s; rest -= s; }
    this.hp -= rest;
    this.calmT = 0;
    if (from && from !== 'zone' && from.alive) {
      if (!this.target || !this.seeTarget) { this.target = from; this.memoryT = 3; this.lastSeen.copy(from.pos); this.reactT = Game.diff.react * 0.6; }
      // in Deckung bauen
      if (this.buildCD <= 0 && this.mats.wood >= BUILD_COST && Math.random() < Game.diff.build) this.buildCover(from);
    }
    if (this.hp <= 0) { this.die(from); return true; }
    return false;
  }

  buildCover(from) {
    this.buildCD = 2.5;
    const yaw = Math.atan2(-(from.pos.x - this.pos.x), -(from.pos.z - this.pos.z));
    const pl = Builds.placement('wall', this.pos, yaw, 0);
    if (Builds.canPlace(pl, this.mats, 'wood')) { Builds.place(pl, 'wood', this); this.mats.wood -= BUILD_COST; }
    if (Math.random() < 0.4 && this.mats.wood >= BUILD_COST) {
      const pr = Builds.placement('ramp', this.pos, yaw, 0);
      if (Builds.canPlace(pr, this.mats, 'wood')) { Builds.place(pr, 'wood', this); this.mats.wood -= BUILD_COST; }
    }
  }

  die(from) {
    this.alive = false;
    this.hp = 0;
    Effects.debris(this.pos.clone().setY(this.pos.y + 1), '#5ecbff', 20);
    this.scene.remove(this.model);
    // Beute fallen lassen
    const p = this.pos.clone();
    if (this.weapon) {
      this.weapon.mag = WEAPONS[this.weapon.key].mag;
      GroundItems.spawn(this.weapon, p.clone().add(new THREE.Vector3(0.6, 0, 0)));
      const a = WEAPONS[this.weapon.key].ammo;
      GroundItems.spawn({ kind: 'ammo', ammo: a, count: AMMO[a].pack }, p.clone().add(new THREE.Vector3(-0.6, 0, 0.4)));
    }
    GroundItems.spawn({ kind: 'mats', mat: 'wood', count: Math.max(20, this.mats.wood) }, p.clone().add(new THREE.Vector3(0, 0, -0.7)));
    if (Math.random() < 0.6) GroundItems.spawn(makeHeal(weightedPick(HEAL_TABLE)), p.clone().add(new THREE.Vector3(0.3, 0, 0.8)));
    Game.onDeath(this, from);
  }

  pickGoal() {
    const zc = Zone.safe();
    // Waffe/bessere Waffe suchen
    if (!this.weapon || (this.weapon.rarity < 2 && Math.random() < 0.5)) {
      let best = null, bd = 90 * 90;
      for (const ch of Chests.list) {
        if (ch.opened || ch.pos.y > 1) continue;
        if (Zone.outside(ch.pos, 4)) continue;
        const d = ch.pos.distanceToSquared(this.pos);
        if (d < bd) { bd = d; best = ch.pos; }
      }
      for (const gi of GroundItems.list) {
        if (gi.item.kind !== 'weapon' || gi.pos.y > 1) continue;
        if (this.weapon && gi.item.rarity <= this.weapon.rarity) continue;
        const d = gi.pos.distanceToSquared(this.pos) * 0.8;
        if (d < bd) { bd = d; best = gi.pos; }
      }
      if (best) { this.goal = best.clone(); this.goalT = 25; return; }
    }
    // sonst irgendwo in der sicheren Zone herumlaufen (nicht ins Wasser)
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * Math.max(5, Math.min(zc.r, 160) * 0.7);
      this.goal = new THREE.Vector3(zc.x + Math.cos(a) * r, 0, zc.z + Math.sin(a) * r);
      this.goal.x = clamp(this.goal.x, -MAP_HALF + 5, MAP_HALF - 5);
      this.goal.z = clamp(this.goal.z, -MAP_HALF + 5, MAP_HALF - 5);
      if (!isWater(this.goal.x, this.goal.z)) break;
    }
    this.goalT = 20;
  }

  think() {
    const eye = this.eye();
    const range = this.weapon ? (this.weapon.key === 'sniper' ? 160 : 85) : 35;
    let best = null, bd = range * range;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    for (const e of Entities) {
      if (e === this || !e.alive) continue;
      if (e.isPlayer && e.gliding && e.pos.y > 25) continue;
      const d2 = e.pos.distanceToSquared(this.pos);
      if (d2 > bd) continue;
      const to = e.pos.clone().sub(this.pos).setY(0).normalize();
      if (d2 > 25 * 25 && to.dot(fwd) < -0.2) continue;
      // Schleichende Spieler sind schwerer zu entdecken
      if (e.crouching && e.slideT <= 0) {
        if (d2 > (range * 0.45) ** 2) continue;
        if (d2 > 36 && to.dot(fwd) < 0.35) continue;
      }
      const te = new THREE.Vector3(e.pos.x, e.pos.y + e.h * 0.78, e.pos.z);
      if (!lineOfSight(eye, te)) continue;
      // Spieler werden etwas bevorzugt, damit es spannend bleibt
      const score = e.isPlayer ? d2 * 0.7 : d2;
      if (score < bd) { bd = score; best = e; }
    }
    if (best) {
      if (this.target !== best || !this.seeTarget) this.reactT = Game.diff.react * (0.7 + Math.random() * 0.6);
      this.target = best; this.seeTarget = true; this.memoryT = 4; this.lastSeen.copy(best.pos);
    } else {
      this.seeTarget = false;
      if (this.memoryT <= 0 || (this.target && !this.target.alive)) this.target = null;
    }
    // aufheben, was direkt vor den Füßen liegt
    for (let i = GroundItems.list.length - 1; i >= 0; i--) {
      const gi = GroundItems.list[i];
      if (gi.pos.distanceToSquared(this.pos) > 2.5 * 2.5) continue;
      const it = gi.item;
      if (it.kind === 'weapon' && (!this.weapon || it.rarity > this.weapon.rarity || (this.weapon.key === 'pistol' && it.key !== 'pistol'))) {
        if (this.weapon) GroundItems.spawn(this.weapon, this.pos.clone().add(new THREE.Vector3(0.8, 0, 0)));
        this.weapon = it; GroundItems.remove(gi); this.refreshWeapon(); this.goal = null;
      } else if (it.kind === 'heal' && this.hp < 100) {
        this.hp = Math.min(100, this.hp + 30); if (HEALS[it.key].shield) this.shield = Math.min(100, this.shield + HEALS[it.key].shield);
        GroundItems.remove(gi);
      }
    }
    // Kisten öffnen
    for (const ch of Chests.list) {
      if (ch.opened || ch.pos.distanceToSquared(this.pos) > 2.6 * 2.6) continue;
      const loot = Chests.open(ch, this);
      for (const it of loot) {
        if (it.kind === 'weapon' && (!this.weapon || it.rarity >= this.weapon.rarity)) {
          if (this.weapon) GroundItems.spawn(this.weapon, ch.pos.clone().add(new THREE.Vector3(1, 0, 0)));
          this.weapon = it; this.refreshWeapon();
        } else if (it.kind === 'heal') {
          if (HEALS[it.key].shield) this.shield = Math.min(100, this.shield + HEALS[it.key].shield);
          else this.hp = Math.min(100, this.hp + HEALS[it.key].hp);
        } else if (it.kind === 'mats') this.mats.wood += it.count;
        else if (it.kind === 'weapon') GroundItems.spawn(it, ch.pos.clone().add(new THREE.Vector3(-1, 0, 0.5)));
      }
      this.goal = null;
    }
  }

  update(dt) {
    if (!this.alive) return;
    this.thinkT -= dt; this.fireT -= dt; this.reactT -= dt; this.memoryT -= dt;
    this.buildCD -= dt; this.calmT += dt; this.goalT -= dt; this.strafeT -= dt; this.meleeT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.22 + Math.random() * 0.15; this.think(); }
    if (this.calmT > 5 && this.hp < 100) this.hp = Math.min(100, this.hp + dt * 4);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0 && this.weapon) this.weapon.mag = WEAPONS[this.weapon.key].mag; }

    let mvx = 0, mvz = 0, speed = 5.0, faceYaw = null;
    const outside = Zone.outside(this.pos, 3);
    if (this.target && (this.seeTarget || this.memoryT > 0)) {
      const tp = this.seeTarget ? this.target.pos : this.lastSeen;
      const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      faceYaw = Math.atan2(-dx, -dz);
      if (this.weapon) {
        const pref = PREF_DIST[this.weapon.key];
        let fwd = 0;
        if (dist > pref + 6) fwd = 1; else if (dist < pref - 4) fwd = -0.7;
        if (!this.seeTarget) fwd = 1;
        if (this.strafeT <= 0) { this.strafeT = 0.8 + Math.random() * 1.6; this.strafe = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.2) this.strafe = 0; }
        mvx = dx / dist * fwd + (-dz / dist) * this.strafe * 0.8;
        mvz = dz / dist * fwd + (dx / dist) * this.strafe * 0.8;
        this.tryShoot(dist);
      } else {
        // ohne Waffe: weglaufen oder zuschlagen, wenn ganz nah
        if (dist < 2.4 && this.seeTarget) {
          if (this.meleeT <= 0) { this.meleeT = 0.6; this.target.takeDamage(20 * Game.diff.dmg, this, false); Sound.play('pickaxe', this.pos); }
        } else { mvx = -dx / dist; mvz = -dz / dist; speed = 6; faceYaw = null; }
      }
      if (outside) { const zc = Zone.safe(); const zx = zc.x - this.pos.x, zz = zc.z - this.pos.z, zl = Math.hypot(zx, zz) || 1; mvx = zx / zl; mvz = zz / zl; }
    } else {
      if (outside) {
        const zc = Zone.safe();
        this.goal = new THREE.Vector3(zc.x + mrnd(-zc.r, zc.r) * 0.3, 0, zc.z + mrnd(-zc.r, zc.r) * 0.3);
        this.goalT = 10;
        speed = 6.5;
      }
      if (!this.goal || this.goalT <= 0) this.pickGoal();
      const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) { this.goal = null; }
      else { mvx = dx / dist; mvz = dz / dist; }
    }
    const ml = Math.hypot(mvx, mvz);
    if (ml > 0.01) { mvx /= ml; mvz /= ml; }
    if (this.swimming) speed = 3.2;
    // Hindernis: springen oder kaputt machen
    if (ml > 0.01) {
      this.stuckT += dt;
      if (this.stuckT > 0.8) {
        this.stuckT = 0;
        const moved = this.pos.distanceTo(this.lastPos);
        this.lastPos.copy(this.pos);
        if (moved < 0.8) {
          this.stuckN++;
          if (this.onGround) this.vel.y = 7.5;
          if (this.stuckN >= 2) {
            const eye = this.eye();
            const dir = new THREE.Vector3(mvx, 0, mvz);
            const h = raycastWorld(eye.clone().setY(this.pos.y + 1), dir, 2.0);
            if (h && h.collider && h.collider.piece && h.collider.piece.kind !== 'tree' && h.collider.piece.kind !== 'rock') {
              damagePiece(h.collider.piece, 60, h.point); Sound.play('pickaxe', h.point);
              Effects.sparks(h.point, MAT_INFO[h.collider.piece.mat].color, 4);
            } else if (this.stuckN >= 3) {
              this.goal = null; this.goalT = 0; this.strafe = -this.strafe;
              const a = Math.random() * 6.28;
              this.vel.x = Math.cos(a) * 5; this.vel.z = Math.sin(a) * 5;
            }
          }
          if (this.stuckN > 6) { this.stuckN = 0; this.goal = null; }
        } else this.stuckN = 0;
      }
    }
    this.vel.x = lerp(this.vel.x, mvx * speed, Math.min(1, dt * 8));
    this.vel.z = lerp(this.vel.z, mvz * speed, Math.min(1, dt * 8));
    moveBody(this, dt);
    // Blickrichtung
    if (faceYaw === null && ml > 0.01) faceYaw = Math.atan2(-mvx, -mvz);
    if (faceYaw !== null) {
      let d = faceYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += clamp(d, -dt * 7, dt * 7);
      this.aimErr = Math.abs(d);
    }
    // Animation
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.walkT += dt * sp * 1.8;
    const sw = Math.sin(this.walkT) * Math.min(1, sp / 4) * 0.7;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    if (this.weapon) { this.armR.rotation.x = -1.4; this.armL.rotation.x = -1.2; this.armL.rotation.z = -0.5; }
    else { this.armL.rotation.x = -sw; this.armR.rotation.x = sw; this.armL.rotation.z = 0; }
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
  }

  tryShoot(dist) {
    const w = WEAPONS[this.weapon.key];
    if (this.reloadT > 0 || this.fireT > 0 || this.reactT > 0 || this.swimming) return;
    if ((this.aimErr || 0) > 0.25) return;
    if (dist > w.range * 0.9) return;
    const eye = this.eye();
    let aim;
    if (this.seeTarget) {
      const t = this.target;
      aim = new THREE.Vector3(t.pos.x, t.pos.y + (Math.random() < 0.15 ? t.h - 0.15 : t.h * 0.6), t.pos.z);
      // etwas vorhalten
      aim.addScaledVector(t.vel, dist / 200);
    } else {
      // Ziel hinter einer gebauten Wand? Dann auf die Wand schießen
      const dir0 = this.lastSeen.clone().setY(this.lastSeen.y + 1.1).sub(eye).normalize();
      const h = raycastWorld(eye, dir0, Math.min(dist, 45));
      if (!h || !h.collider || !h.collider.piece || h.collider.piece.kind !== 'build') return;
      aim = h.point;
    }
    if (this.weapon.mag <= 0) { this.reloadT = w.reload * 1.2; Sound.play('reload', this.pos); return; }
    const dir = aim.sub(eye).normalize();
    const err = Game.diff.err * (Math.hypot(this.vel.x, this.vel.z) > 2 ? 1.3 : 1) * (this.target && this.target.isPlayer && this.target.buildMode ? 1.1 : 1);
    dir.x += (Math.random() + Math.random() - 1) * err;
    dir.y += (Math.random() + Math.random() - 1) * err * 0.7;
    dir.z += (Math.random() + Math.random() - 1) * err;
    dir.normalize();
    const muzzle = this.held ? this.held.localToWorld(new THREE.Vector3(0, 0, -0.6)) : eye;
    Combat.fire(this, this.weapon, eye, dir, 0.7, muzzle);
    this.weapon.mag--;
    this.fireT = (1 / w.rate) * (w.auto ? 1.7 : 1.35) + Math.random() * 0.25;
  }
}
