'use strict';
// ============================================================
//  Der Spieler: Bewegung, Inventar, Schießen, Abbauen, Bauen
// ============================================================
const MAX_MATS = 999;
const Input = { keys: {}, mouseL: false, mouseR: false, dx: 0, dy: 0, wheel: 0, pressed: {} };

class Player {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.isPlayer = true;
    this.name = 'Du';
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.r = 0.35; this.h = 1.8; this.eye = 1.62;
    this.yaw = 0; this.pitch = 0;
    this.hp = 100; this.shield = 0;
    this.alive = true;
    this.onGround = false;
    this.gliding = true;
    this.kills = 0;
    this.mats = { wood: 0, stone: 0, metal: 0 };
    this.ammo = { light: 0, medium: 0, heavy: 0, shells: 0, rockets: 0 };
    this.slots = [null, null, null, null, null, null];
    this.sel = 0;            // 0 = Spitzhacke, 1-6 = Slots
    this.buildMode = null;   // 'wall' | 'floor' | 'ramp'
    this.buildMat = 0;
    this.fireT = 0; this.reloadT = 0; this.reloading = false;
    this.swingT = 0; this.buildT = 0;
    this.using = null;       // laufende Heilung
    this.bloom = 0; this.recoil = 0;
    this.aim = 0;
    this.bobT = 0;
    this.lastDamageT = 99;
    this.buildPl = null;
    // Schleichen, Rutschen, Klettern, Schwimmen
    this.crouching = false;
    this.slideT = 0; this.slideSpeed = 0; this.slideDir = new THREE.Vector3();
    this.climbing = false; this.stamina = 1; this.mantleT = 0;
    this.swimming = false;
    this.inBus = false; this.freefall = false;
    this.eyeNow = this.eye;
    this.roll = 0;

    // Ansicht in der Hand
    this.viewRoot = new THREE.Group();
    camera.add(this.viewRoot);
    this.pickaxe = pickaxeModel();
    this.pickaxe.scale.setScalar(0.45);
    this.viewRoot.add(this.pickaxe);
    this.heldModel = null;
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25),
      new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.9, depthWrite: false }));
    this.flash.visible = false;
    camera.add(this.flash);
    this.flashT = 0;
    this.refreshHeld();
  }

  get item() { return this.sel > 0 ? this.slots[this.sel - 1] : null; }

  spawn(x, z) {
    this.pos.set(x, 140, z);
    this.vel.set(0, 0, 0);
    this.gliding = true;
    this.yaw = Math.atan2(x, z); // Blick Richtung Mitte
  }

  refreshHeld() {
    if (this.heldModel) { this.viewRoot.remove(this.heldModel); this.heldModel = null; }
    const it = this.item;
    this.pickaxe.visible = !it && !this.buildMode;
    if (it && !this.buildMode) {
      this.heldModel = it.kind === 'weapon' ? weaponModel(it.key, it.rarity) : healModel(it.key);
      this.heldModel.scale.setScalar(0.85);
      this.viewRoot.add(this.heldModel);
    }
    this.reloading = false;
    this.using = null;
    Builds.hideGhost();
    UI.dirty = true;
  }

  select(i) {
    if (i === this.sel && !this.buildMode) return;
    this.sel = i;
    this.buildMode = null;
    this.fireT = Math.max(this.fireT, 0.15);
    this.refreshHeld();
  }

  setBuild(type) {
    this.buildMode = this.buildMode === type ? null : type;
    this.using = null;
    this.refreshHeld();
  }

  // ---------- Schaden ----------
  takeDamage(dmg, from, head) {
    if (!this.alive) return false;
    if (this.inBus || (this.gliding && this.pos.y > 20)) return false;
    let rest = dmg;
    if (this.shield > 0 && from !== 'zone') {
      const s = Math.min(this.shield, rest);
      this.shield -= s; rest -= s;
    }
    this.hp -= rest;
    this.lastDamageT = 0;
    UI.damageFlash(from);
    Sound.play('hurt');
    if (this.using) { this.using = null; UI.dirty = true; }
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      Game.onDeath(this, from);
      return true;
    }
    UI.dirty = true;
    return false;
  }

  // ---------- Inventar ----------
  addItem(it) {
    if (it.kind === 'ammo') { this.ammo[it.ammo] = Math.min(999, this.ammo[it.ammo] + it.count); UI.toast('+' + it.count + ' ' + AMMO[it.ammo].name); return true; }
    if (it.kind === 'mats') { this.mats[it.mat] = Math.min(MAX_MATS, this.mats[it.mat] + it.count); UI.toast('+' + it.count + ' ' + MAT_INFO[it.mat].name); return true; }
    if (it.kind === 'heal') {
      for (const s of this.slots) {
        if (s && s.kind === 'heal' && s.key === it.key && s.count < HEALS[it.key].stack) {
          const add = Math.min(it.count, HEALS[it.key].stack - s.count);
          s.count += add; it.count -= add;
          if (it.count <= 0) { UI.dirty = true; return true; }
        }
      }
    }
    const free = this.slots.indexOf(null);
    if (free >= 0) {
      this.slots[free] = it;
      if (this.sel === 0 && it.kind === 'weapon' && !this.buildMode && !this.slots.some((s, i) => s && i !== free && s.kind === 'weapon')) this.select(free + 1);
      UI.dirty = true;
      return true;
    }
    return false;
  }

  dropItem(slotIdx, pos) {
    const it = this.slots[slotIdx];
    if (!it) return;
    this.slots[slotIdx] = null;
    GroundItems.spawn(it, pos || this.pos.clone().add(this.forward().multiplyScalar(1.2)));
    if (slotIdx + 1 === this.sel) this.refreshHeld();
    UI.dirty = true;
  }

  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  lookDir() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }
  eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z); }

  // Was liegt vor mir zum Aufheben/Öffnen?
  findInteract() {
    const eye = this.eyePos(), look = this.lookDir();
    let best = null, bestScore = Infinity;
    const consider = (pos, obj, type) => {
      const to = pos.clone().sub(eye);
      const dist = to.length();
      if (dist > 3.6) return;
      to.normalize();
      const dot = to.dot(look);
      if (dot < 0.55 && dist > 1.6) return;
      const score = dist * (2 - dot);
      if (score < bestScore) { bestScore = score; best = { type, obj }; }
    };
    for (const ch of Chests.list) if (!ch.opened) consider(ch.pos.clone().setY(ch.pos.y + 0.4), ch, 'chest');
    for (const gi of GroundItems.list) if (!gi.auto) consider(gi.pos.clone().setY(gi.pos.y + 0.5), gi, 'item');
    return best;
  }

  interact(target) {
    if (!target) return;
    if (target.type === 'chest') { Chests.open(target.obj, this); return; }
    const gi = target.obj;
    const it = gi.item;
    if (this.addItem(it)) {
      GroundItems.remove(gi);
      Sound.play('pickup');
    } else {
      // Inventar voll: mit aktuellem Slot tauschen
      const idx = this.sel > 0 ? this.sel - 1 : 0;
      const old = this.slots[idx];
      this.slots[idx] = it;
      GroundItems.remove(gi);
      if (old) GroundItems.spawn(old, gi.pos.clone());
      Sound.play('pickup');
      if (this.sel === 0) this.sel = idx + 1;
      this.refreshHeld();
    }
  }

  // ---------- Update ----------
  update(dt) {
    if (!this.alive) return;
    this.lastDamageT += dt;
    // Umsehen
    const sens = 0.0022 * (Game.settings.sens || 1) * (this.aim > 0.5 && this.item && WEAPONS[this.item.key] && WEAPONS[this.item.key].scope ? 0.35 : (this.aim > 0.5 ? 0.7 : 1));
    this.yaw -= Input.dx * sens;
    this.pitch = clamp(this.pitch - Input.dy * sens, -1.5, 1.5);
    Input.dx = 0; Input.dy = 0;

    // Im Bus: Kamera schaut von außen auf den Bus, Leertaste = abspringen
    if (this.inBus) {
      this.viewRoot.visible = false;
      const L = this.lookDir();
      this.camera.position.copy(Bus.pos).addScaledVector(L, -24).add(new THREE.Vector3(0, 6, 0));
      this.camera.lookAt(Bus.pos.x, Bus.pos.y + 3, Bus.pos.z);
      Sound.listener.copy(this.camera.position);
      if (Input.pressed.Space) { Bus.drop(this); Sound.play('swing'); }
      return;
    }

    // Tasten (einmalig gedrückt)
    const P = Input.pressed;
    for (let i = 1; i <= 7; i++) if (P['Digit' + i]) this.select(i - 1);
    if (Input.wheel) {
      const n = ((this.sel + Math.sign(Input.wheel)) % 7 + 7) % 7;
      this.select(n);
      Input.wheel = 0;
    }
    if (P.KeyQ) this.setBuild('wall');
    if (P.KeyX) this.setBuild('floor');
    if (P.KeyV) this.setBuild('ramp');
    if (P.KeyT) { this.buildMat = (this.buildMat + 1) % 3; UI.dirty = true; }
    if (P.KeyR) this.startReload();
    if (P.KeyG && this.sel > 0) this.dropItem(this.sel - 1);
    const target = this.gliding ? null : this.findInteract();
    UI.setPrompt(target);
    if (P.KeyE) this.interact(target);

    // Bewegung
    let mx = 0, mz = 0;
    if (Input.keys.KeyW) mz -= 1;
    if (Input.keys.KeyS) mz += 1;
    if (Input.keys.KeyA) mx -= 1;
    if (Input.keys.KeyD) mx += 1;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = mx * cy + mz * sy, wz = -mx * sy + mz * cy;
    const sprint = (Input.keys.ShiftLeft || Input.keys.ShiftRight) && mz < 0 && !this.using && !this.crouching;
    const crouchKey = Input.keys.KeyC;

    // Rutschen: beim Sprinten C drücken
    if (P.KeyC && sprint && this.onGround && this.slideT <= 0 && Math.hypot(this.vel.x, this.vel.z) > 6.5) {
      this.slideT = 1.0; this.slideSpeed = 12.5;
      this.slideDir.set(this.vel.x, 0, this.vel.z).normalize();
      Sound.play('slide');
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      this.slideSpeed = Math.max(0, this.slideSpeed - 9 * dt);
      // ein bisschen lenken
      if (mx || mz) this.slideDir.lerp(new THREE.Vector3(wx, 0, wz), Math.min(1, dt * 1.5)).normalize();
      if (this.slideSpeed < 3.5 || !this.onGround && this.vel.y > 0.5) this.slideT = 0;
      if (this.onGround && Math.random() < 0.5) Effects.particle(this.pos.clone().add(new THREE.Vector3(mrnd(-0.3, 0.3), 0.1, mrnd(-0.3, 0.3))), '#bfb49a', new THREE.Vector3(mrnd(-1, 1), mrnd(0.5, 2), mrnd(-1, 1)), 0.4, 0.6);
    }
    const sliding = this.slideT > 0;

    // Schleichen (C halten). Aufstehen nur, wenn über dem Kopf Platz ist
    const wantCrouch = (crouchKey || sliding) && !this.gliding && !this.swimming;
    if (wantCrouch) this.crouching = true;
    else if (this.crouching && solidOverlaps(this.pos.x, this.pos.y + 0.1, this.pos.z, this.r * 0.9, 1.75, _hits).length === 0) this.crouching = false;
    this.h = this.crouching ? 1.2 : 1.8;

    let speed = this.gliding ? (this.freefall ? 18 : 14) : (sprint ? 8.2 : 5.6);
    if (this.crouching) speed = 2.8;
    if (this.swimming) speed = sprint ? 4.8 : 3.6;
    if (this.using) speed *= 0.5;
    if (this.aim > 0.5) speed *= 0.7;
    const accel = this.onGround || this.gliding || this.swimming ? 14 : 4;
    if (sliding && this.onGround) {
      this.vel.x = this.slideDir.x * this.slideSpeed;
      this.vel.z = this.slideDir.z * this.slideSpeed;
    } else {
      this.vel.x = lerp(this.vel.x, wx * speed, Math.min(1, accel * dt));
      this.vel.z = lerp(this.vel.z, wz * speed, Math.min(1, accel * dt));
    }

    // Klettern: Leertaste halten und gegen eine Wand laufen
    const fwd = this.forward();
    const wallAhead = (y0, y1) => {
      solidOverlaps(this.pos.x + fwd.x * 0.55, this.pos.y + y0, this.pos.z + fwd.z * 0.55, 0.22, y1 - y0, _hits);
      return _hits.some(c => !(c.piece && c.piece.kind === 'tree'));
    };
    const wasClimbing = this.climbing;
    this.climbing = false;
    if (!this.gliding && !this.swimming && Input.keys.Space && mz < 0 && this.stamina > 0 && !this.crouching) {
      if (wallAhead(0.5, 1.5)) {
        this.climbing = true;
        this.stamina = Math.max(0, this.stamina - dt / 3.2);
        this.vel.x = fwd.x * 1.2; this.vel.z = fwd.z * 1.2;
        this.vel.y = 4.2 + GRAVITY * dt;
        if (Math.random() < 0.15) Sound.play('swing', this.pos);
      } else if (wasClimbing && wallAhead(-0.2, 0.5)) {
        // oben angekommen: hochziehen
        this.mantleT = 0.35;
      }
    }
    if (this.mantleT > 0) {
      this.mantleT -= dt;
      this.vel.y = Math.max(this.vel.y, 4.5 + GRAVITY * dt);
      this.vel.x = fwd.x * 3; this.vel.z = fwd.z * 3;
    }
    if (this.onGround) this.stamina = Math.min(1, this.stamina + dt * 0.6);

    if (this.gliding) {
      // erst freier Fall, dann öffnet sich der Gleiter (automatisch oder mit Leertaste)
      const above = this.pos.y - groundHeight(this.pos.x, this.pos.z, this.r, this.pos.y);
      if (this.freefall && (above < 45 || (Input.pressed.Space && above > 12))) {
        this.freefall = false; Sound.play('glider'); UI.dirty = true;
      }
      this.vel.y = this.freefall ? -30 : -11;
      moveBody(this, dt, 0);
      if (this.onGround || this.swimming) { this.gliding = false; this.freefall = false; UI.dirty = true; UI.toast('Gelandet! Such dir Waffen in Kisten.'); }
    } else {
      if (Input.pressed.Space && this.onGround && !this.climbing) {
        this.vel.y = this.crouching && !sliding ? 6.2 : 7.6;
        this.onGround = false;
        if (sliding) { this.slideT = 0; this.vel.x *= 1.1; this.vel.z *= 1.1; }   // Rutsch-Sprung behält den Schwung
      }
      moveBody(this, dt);
    }
    if (this.swimming !== this.wasSwim) { this.wasSwim = this.swimming; UI.dirty = true; if (this.swimming) { this.buildMode = null; this.refreshHeld(); } }
    if (this.onGround && (mx || mz) && !sliding) this.bobT += dt * (sprint ? 13 : this.crouching ? 6 : 9);
    if (this.swimming && (mx || mz)) this.bobT += dt * 5;

    // Auto-Aufheben von Munition/Material
    for (let i = GroundItems.list.length - 1; i >= 0; i--) {
      const gi = GroundItems.list[i];
      if (!gi.auto || gi.delay > 0) continue;
      if (gi.pos.distanceToSquared(this.pos) < 5.0) { this.addItem(gi.item); GroundItems.remove(gi); Sound.play('pickup'); }
    }

    // Zielen
    const wantAim = Input.mouseR && !this.buildMode && this.item && this.item.kind === 'weapon';
    this.aim = lerp(this.aim, wantAim ? 1 : 0, Math.min(1, dt * 12));

    this.fireT -= dt; this.swingT -= dt; this.buildT -= dt;
    this.bloom = Math.max(0, this.bloom - dt * 0.12);
    this.recoil = Math.max(0, this.recoil - dt * 0.5);

    // Nachladen
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }

    // Aktionen (nicht während des Gleitens/Schwimmens/Kletterns)
    if (this.gliding || this.swimming || this.climbing) { if (this.using) this.using = null; }
    else if (this.buildMode) this.updateBuild(dt);
    else if (this.sel === 0) { if (Input.mouseL && this.swingT <= 0) this.swing(); }
    else {
      const it = this.item;
      if (it && it.kind === 'weapon') this.updateWeapon(it);
      else if (it && it.kind === 'heal') this.updateHeal(it, dt);
    }

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const cam = this.camera;
    const targetEye = this.slideT > 0 ? 0.85 : this.crouching ? 1.08 : this.eye;
    this.eyeNow = lerp(this.eyeNow, targetEye, Math.min(1, dt * 12));
    const bob = this.onGround ? Math.sin(this.bobT) * 0.04 : this.swimming ? Math.sin(this.bobT + Date.now() / 400) * 0.06 : 0;
    cam.position.set(this.pos.x, this.pos.y + this.eyeNow + bob, this.pos.z);
    this.roll = lerp(this.roll, this.slideT > 0 ? 0.07 : 0, Math.min(1, dt * 8));
    cam.rotation.set(this.pitch + this.recoil, this.yaw, this.roll, 'YXZ');
    const it = this.item;
    const scope = it && it.kind === 'weapon' && WEAPONS[it.key].scope;
    const targetFov = lerp(Game.settings.fov || 75, scope ? 22 : 55, this.aim);
    if (Math.abs(cam.fov - targetFov) > 0.05) { cam.fov = targetFov; cam.updateProjectionMatrix(); }
    UI.setScope(scope && this.aim > 0.8);
    // Ansichtsmodell
    const bx = Math.sin(this.bobT * 0.5) * 0.012, by = Math.abs(Math.cos(this.bobT * 0.5)) * 0.012;
    const hip = new THREE.Vector3(0.28, -0.26, -0.52), ads = new THREE.Vector3(0, -0.13, -0.42);
    const p = hip.lerp(ads, this.aim);
    this.viewRoot.position.set(p.x + bx, p.y - by - this.recoil * 0.5, p.z + this.recoil * 0.8);
    this.viewRoot.visible = !(scope && this.aim > 0.8);
    // beim Schwimmen/Klettern Waffe runternehmen
    const lower = this.swimming || this.climbing ? 0.35 : 0;
    this.viewRoot.position.y -= lower;
    // Spitzhacke schwingen
    const sw = Math.max(0, this.swingT) / 0.42;
    const k = Math.sin((1 - sw) * Math.PI);
    this.pickaxe.position.set(0.12, -0.12 + k * 0.06, 0.04 - k * 0.12);
    this.pickaxe.rotation.set(-0.35 - k * 1.5, 0.35, 0.55 + k * 0.2);
    if (this.heldModel && this.item && this.item.kind === 'heal') {
      this.heldModel.position.set(-0.05, 0.05 + (this.using ? Math.sin(Date.now() / 120) * 0.03 : 0), 0);
    }
    if (this.reloading && this.heldModel) this.heldModel.rotation.x = -0.5;
    else if (this.heldModel) this.heldModel.rotation.x = 0;
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    Sound.listener.copy(cam.position);
  }

  // ---------- Waffen ----------
  updateWeapon(it) {
    const w = WEAPONS[it.key];
    if (!Input.mouseL) this.triggerHeld = false;
    if (!Input.mouseL || this.fireT > 0 || this.reloading) return;
    if (!w.auto && this.triggerHeld) return;
    this.triggerHeld = true;
    if (it.mag <= 0) {
      if (this.ammo[w.ammo] > 0) this.startReload(); else { Sound.play('empty'); this.fireT = 0.3; UI.toast('Keine Munition!'); }
      return;
    }
    it.mag--;
    this.fireT = 1 / w.rate;
    const eye = this.eyePos();
    const dir = this.lookDir();
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1;
    let spreadMul = (1 + this.bloom * 40) * (this.aim > 0.5 ? 0.45 : 1) * (moving ? 1.5 : 1) * (this.onGround ? 1 : 2);
    if (w.scope && this.aim < 0.8) spreadMul = 12;
    if (it.key === 'shotgun') spreadMul = this.aim > 0.5 ? 0.8 : 1;
    const mz = MUZZLE_Z[it.key] * 0.85;
    const muzzle = this.camera.localToWorld(new THREE.Vector3(this.viewRoot.position.x, this.viewRoot.position.y + 0.03, this.viewRoot.position.z + mz));
    const res = Combat.fire(this, it, eye, dir, spreadMul, muzzle);
    this.bloom = Math.min(0.06, this.bloom + w.bloom);
    this.recoil += w.kick;
    this.flash.position.set(this.viewRoot.position.x, this.viewRoot.position.y + 0.03, this.viewRoot.position.z + mz - 0.03);
    this.flash.rotation.z = Math.random() * 3;
    this.flashT = 0.05;
    if (res.hits) { UI.hitMarker(res.head, res.kill); Sound.play(res.head ? 'headshot' : 'hit'); }
    UI.dirty = true;
    if (it.mag <= 0 && this.ammo[w.ammo] > 0) setTimeout(() => { if (this.item === it && !this.reloading) this.startReload(); }, 200);
  }

  startReload() {
    const it = this.item;
    if (!it || it.kind !== 'weapon' || this.reloading) return;
    const w = WEAPONS[it.key];
    if (it.mag >= w.mag || this.ammo[w.ammo] <= 0) return;
    this.reloading = true;
    this.reloadT = w.reload * RARITIES[it.rarity].reload;
    this.reloadMax = this.reloadT;
    Sound.play('reload');
    UI.dirty = true;
  }

  finishReload() {
    this.reloading = false;
    const it = this.item;
    if (!it || it.kind !== 'weapon') return;
    const w = WEAPONS[it.key];
    const need = w.mag - it.mag;
    const take = Math.min(need, this.ammo[w.ammo]);
    it.mag += take; this.ammo[w.ammo] -= take;
    UI.dirty = true;
  }

  // ---------- Spitzhacke ----------
  swing() {
    this.swingT = 0.42;
    Sound.play('swing');
    const eye = this.eyePos(), dir = this.lookDir();
    const eh = rayEntities(eye, dir, 2.6, this);
    const wh = raycastWorld(eye, dir, 3.2);
    if (eh && (!wh || eh.t < wh.t)) {
      const killed = eh.ent.takeDamage(20, this, false);
      Effects.dmgNumber(eye.clone().addScaledVector(dir, eh.t), 20, '#ffffff');
      UI.hitMarker(false, killed);
      Sound.play('hit');
      return;
    }
    if (wh && wh.collider && wh.collider.piece) {
      const piece = wh.collider.piece;
      Sound.play('pickaxe', wh.point);
      Effects.sparks(wh.point, MAT_INFO[piece.mat].color, 6, wh.normal);
      const base = piece.kind === 'tree' ? 8 : piece.kind === 'rock' ? 7 : piece.kind === 'build' ? 3 : 6;
      const gain = Math.round(base * piece.yieldMul);
      this.mats[piece.mat] = Math.min(MAX_MATS, this.mats[piece.mat] + gain);
      Effects.dmgNumber(wh.point, gain, MAT_INFO[piece.mat].color);
      damagePiece(piece, 50, wh.point);
      UI.pieceHit(piece);
      UI.matGain(piece.mat);
      UI.dirty = true;
    } else if (wh) {
      Sound.play('pickaxe', wh.point);
      Effects.sparks(wh.point, '#9c8a6a', 3, wh.normal);
    }
  }

  // ---------- Heilen ----------
  updateHeal(it, dt) {
    const h = HEALS[it.key];
    if (!this.using) {
      if (!Input.mouseL) return;
      if (h.hp && this.hp >= h.maxHp) { if (!this.warned) UI.toast('Du kannst damit nicht mehr heilen.'); this.warned = true; return; }
      if (h.shield && this.shield >= h.maxShield) { if (!this.warned) UI.toast('Schild ist schon voll genug.'); this.warned = true; return; }
      this.warned = false;
      this.using = { item: it, t: 0, max: h.time };
      Sound.play(h.hp ? 'heal' : 'shield');
    }
    this.using.t += dt;
    if (this.using.t >= this.using.max) {
      if (h.hp) this.hp = Math.min(h.maxHp, this.hp + h.hp);
      if (h.shield) this.shield = Math.min(h.maxShield, this.shield + h.shield);
      it.count--;
      if (it.count <= 0) { this.slots[this.sel - 1] = null; this.refreshHeld(); }
      this.using = null;
      Sound.play(h.hp ? 'heal' : 'shield');
    }
    UI.dirty = true;
  }

  // ---------- Bauen ----------
  updateBuild(dt) {
    const matName = BUILD_MATS[this.buildMat];
    const pl = Builds.placement(this.buildMode, this.pos, this.yaw, this.pitch);
    const ok = Builds.canPlace(pl, this.mats, matName);
    Builds.showGhost(pl, ok);
    if (Input.mouseL && this.buildT <= 0) {
      if (ok) {
        Builds.place(pl, matName, this);
        this.mats[matName] -= BUILD_COST;
        this.buildT = 0.12;
        UI.dirty = true;
      } else if (this.mats[matName] < BUILD_COST && !this.matWarn) {
        UI.toast('Nicht genug ' + MAT_INFO[matName].name + '! Bau Sachen mit der Spitzhacke ab.');
        this.matWarn = true;
        setTimeout(() => (this.matWarn = false), 1500);
      }
    }
  }
}
