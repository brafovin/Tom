'use strict';
// ============================================================
//  Effekte: Splitter, Funken, Leuchtspuren, Explosionen, Schadenszahlen
// ============================================================
const Effects = {
  scene: null,
  parts: [],
  tracers: [],
  booms: [],
  numbers: [],
  beams: [],
  partGeo: null,

  init(scene) {
    this.scene = scene;
    this.partGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.boomGeo = new THREE.SphereGeometry(1, 16, 12);
    this.layer = document.getElementById('dmgLayer');
  },

  particle(pos, color, vel, life, size = 1, gravity = 14) {
    if (this.parts.length > 350) { const old = this.parts.shift(); this.scene.remove(old.mesh); }
    const m = new THREE.Mesh(this.partGeo, colMat(color));
    m.position.copy(pos);
    m.scale.setScalar(size);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    this.scene.add(m);
    this.parts.push({ mesh: m, vel, life, max: life, gravity });
  },

  debris(pos, color, n = 12) {
    for (let i = 0; i < n; i++) {
      const p = pos.clone().add(new THREE.Vector3(mrnd(-1.2, 1.2), mrnd(-1, 1.5), mrnd(-1.2, 1.2)));
      this.particle(p, shade(color, mrnd(0.7, 1.2)),
        new THREE.Vector3(mrnd(-5, 5), mrnd(2, 8), mrnd(-5, 5)), mrnd(0.6, 1.2), mrnd(1, 2.5));
    }
  },

  sparks(pos, color, n = 5, normal) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(mrnd(-3, 3), mrnd(0, 4), mrnd(-3, 3));
      if (normal) v.addScaledVector(normal, 4);
      this.particle(pos.clone(), color, v, mrnd(0.2, 0.45), 0.5);
    }
  },

  tracer(from, to, color = '#ffe9a0') {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, m);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  },

  explosion(pos, radius = 4) {
    const m = new THREE.Mesh(this.boomGeo, new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 }));
    m.position.copy(pos);
    this.scene.add(m);
    this.booms.push({ mesh: m, life: 0.45, max: 0.45, radius });
    for (let i = 0; i < 25; i++) {
      this.particle(pos.clone(), pick(['#ff6a00', '#ffd000', '#555555', '#333333']),
        new THREE.Vector3(mrnd(-10, 10), mrnd(2, 12), mrnd(-10, 10)), mrnd(0.5, 1.2), mrnd(1, 3));
    }
  },

  // Lichtstrahl, der ausgeschiedene Spieler wegbeamt
  beam(pos) {
    const m = new THREE.Mesh(cachedGeo('beamfx', () => new THREE.CylinderGeometry(0.9, 0.9, 40, 16, 1, true)),
      new THREE.MeshBasicMaterial({ color: '#6fd0ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    m.position.copy(pos).setY(pos.y + 20);
    this.scene.add(m);
    this.beams.push({ mesh: m, life: 1.1, max: 1.1 });
    for (let i = 0; i < 24; i++) {
      this.particle(pos.clone().add(new THREE.Vector3(mrnd(-0.6, 0.6), mrnd(0, 1.8), mrnd(-0.6, 0.6))), pick(['#6fd0ff', '#ffffff', '#a8e6ff']),
        new THREE.Vector3(mrnd(-0.5, 0.5), mrnd(6, 14), mrnd(-0.5, 0.5)), mrnd(0.8, 1.4), 0.6, -2);
    }
  },

  dmgNumber(pos, amount, color = '#ffffff', big = false) {
    const el = document.createElement('div');
    el.className = 'dmgnum' + (big ? ' big' : '');
    el.textContent = Math.round(amount);
    el.style.color = color;
    this.layer.appendChild(el);
    this.numbers.push({ el, pos: pos.clone().add(new THREE.Vector3(mrnd(-0.3, 0.3), 0.3, mrnd(-0.3, 0.3))), life: 0.9 });
  },

  update(dt, camera) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vel.multiplyScalar(0.5); p.vel.y = Math.abs(p.vel.y) * 0.3; }
      p.mesh.rotation.x += dt * 5;
      const s = Math.max(0.01, p.life / p.max);
      p.mesh.scale.setScalar(p.mesh.scale.x * (0.97 + 0.03 * s));
      if (p.life <= 0) { this.scene.remove(p.mesh); this.parts.splice(i, 1); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.07);
      if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i];
      b.life -= dt;
      const k = 1 - b.life / b.max;
      b.mesh.scale.setScalar(0.5 + k * b.radius);
      b.mesh.material.opacity = 0.9 * (1 - k);
      if (b.life <= 0) { this.scene.remove(b.mesh); b.mesh.material.dispose(); this.booms.splice(i, 1); }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      const k = b.life / b.max;
      b.mesh.material.opacity = 0.6 * k;
      b.mesh.scale.set(0.4 + k * 0.6, 1, 0.4 + k * 0.6);
      if (b.life <= 0) { this.scene.remove(b.mesh); b.mesh.material.dispose(); this.beams.splice(i, 1); }
    }
    const w = window.innerWidth, h = window.innerHeight;
    const v = new THREE.Vector3();
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      n.pos.y += dt * 1.2;
      v.copy(n.pos).project(camera);
      if (v.z > 1 || n.life <= 0) {
        if (n.life <= 0) { n.el.remove(); this.numbers.splice(i, 1); }
        else n.el.style.display = 'none';
        continue;
      }
      n.el.style.display = '';
      n.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      n.el.style.opacity = Math.min(1, n.life * 2);
    }
  },

  clear() {
    for (const p of this.parts) this.scene.remove(p.mesh);
    for (const t of this.tracers) this.scene.remove(t.line);
    for (const b of this.booms) this.scene.remove(b.mesh);
    for (const n of this.numbers) n.el.remove();
    for (const b of this.beams) this.scene.remove(b.mesh);
    this.parts = []; this.tracers = []; this.booms = []; this.numbers = []; this.beams = [];
  },
};
