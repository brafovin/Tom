'use strict';
// ============================================================
//  Der Kampfbus: fliegt mit einem Ballon über die Karte, alle springen ab
// ============================================================
const Bus = {
  active: false,
  mesh: null,
  pos: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  start: new THREE.Vector3(),
  end: new THREE.Vector3(),
  t: 0, len: 1, speed: 34, height: 125,
  passengers: [],

  build(scene) {
    const g = new THREE.Group();
    const blue = '#2f6fd6', white = '#f4f6fb', dark = '#1d2b3a', tire = '#151515', chrome = '#c9d1d9';
    const B = (s, p, c, r) => ({ t: 'box', s, p, c, r });
    const C = (r1, r2, len, p, c, r) => ({ t: 'cyl', s: [r1, r2, len, 14], p, c, r });
    const X = [0, 0, Math.PI / 2];
    const parts = [
      B([3.0, 2.6, 9.0], [0, 0, 0], blue),
      B([3.04, 0.45, 9.04], [0, -0.75, 0], white),
      B([2.9, 0.25, 8.8], [0, 1.42, 0], white),
      B([3.06, 1.0, 6.6], [0, 0.45, 0.5], dark),
      B([2.6, 1.15, 0.06], [0, 0.45, -4.52], dark),
      B([3.1, 0.35, 0.3], [0, -1.15, -4.55], chrome), B([3.1, 0.35, 0.3], [0, -1.15, 4.55], chrome),
      B([0.5, 0.25, 0.06], [-1.05, -0.45, -4.53], '#fff6c8'), B([0.5, 0.25, 0.06], [1.05, -0.45, -4.53], '#fff6c8'),
      B([0.5, 0.25, 0.06], [-1.05, -0.45, 4.53], '#ff3b3b'), B([0.5, 0.25, 0.06], [1.05, -0.45, 4.53], '#ff3b3b'),
      B([1.2, 0.5, 0.08], [0, 1.0, -4.53], '#ffd43b'),
      C(0.55, 0.55, 0.4, [-1.4, -1.3, -2.8], tire, X), C(0.55, 0.55, 0.4, [1.4, -1.3, -2.8], tire, X),
      C(0.55, 0.55, 0.4, [-1.4, -1.3, 2.8], tire, X), C(0.55, 0.55, 0.4, [1.4, -1.3, 2.8], tire, X),
      // Seile zum Ballon
      B([0.08, 6.2, 0.08], [-1.2, 4.6, -3.2], '#6b4a2f', [0.28, 0, 0.12]), B([0.08, 6.2, 0.08], [1.2, 4.6, -3.2], '#6b4a2f', [0.28, 0, -0.12]),
      B([0.08, 6.2, 0.08], [-1.2, 4.6, 3.2], '#6b4a2f', [-0.28, 0, 0.12]), B([0.08, 6.2, 0.08], [1.2, 4.6, 3.2], '#6b4a2f', [-0.28, 0, -0.12]),
      // Propeller hinten
      C(0.25, 0.4, 0.6, [0, 0, 4.8], '#555b61'),
    ];
    g.add(partsMesh(parts, 'busBody'));
    // Ballon mit Streifen
    // klare Streifen: jedes Dreieck bekommt eine Farbe
    const bg = new THREE.SphereGeometry(5.2, 20, 14).toNonIndexed();
    const cols = [], pa = bg.attributes.position, c1 = new THREE.Color('#2f6fd6'), c2 = new THREE.Color('#ffffff');
    for (let i = 0; i < pa.count; i += 3) {
      const cx = pa.getX(i) + pa.getX(i + 1) + pa.getX(i + 2), cz = pa.getZ(i) + pa.getZ(i + 1) + pa.getZ(i + 2);
      const a = Math.atan2(cz, cx);
      const c = Math.floor((a + Math.PI) / (Math.PI * 2) * 10) % 2 ? c1 : c2;
      for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b);
    }
    bg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    bg.scale(1, 1.15, 1);
    const balloon = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ vertexColors: true }));
    balloon.position.y = 12.5;
    g.add(balloon);
    this.balloon = balloon;
    this.prop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 0.08), colMat('#333'));
    this.prop.position.set(0, 0, 5.15);
    g.add(this.prop);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.visible = false;
    scene.add(g);
    this.mesh = g;
  },

  launch(entities) {
    const a = Math.random() * Math.PI * 2;
    this.dir.set(Math.cos(a), 0, Math.sin(a));
    const perp = new THREE.Vector3(-this.dir.z, 0, this.dir.x).multiplyScalar(mrnd(-70, 70));
    const R = MAP_HALF + 60;
    this.start.copy(perp).addScaledVector(this.dir, -R).setY(this.height);
    this.end.copy(perp).addScaledVector(this.dir, R).setY(this.height);
    this.len = this.start.distanceTo(this.end);
    this.t = 0;
    this.pos.copy(this.start);
    this.active = true;
    this.mesh.visible = true;
    this.mesh.rotation.y = Math.atan2(-this.dir.x, -this.dir.z);
    // ab wann ist der Bus über der Karte?
    this.tIn = (R - MAP_HALF + 15) / (2 * R);
    this.tOut = 1 - this.tIn;
    this.passengers = entities.slice();
    for (const e of entities) {
      e.inBus = true;
      e.pos.copy(this.pos);
      e.jumpAt = lerp(this.tIn + 0.02, this.tOut - 0.04, Math.pow(Math.random(), 0.9));
    }
  },

  // Jemand springt ab
  drop(e) {
    if (!e.inBus) return;
    e.inBus = false;
    e.pos.copy(this.pos).add(new THREE.Vector3(mrnd(-1, 1), -3, mrnd(-1, 1)));
    e.vel.copy(this.dir).multiplyScalar(10);
    e.vel.y = 0;
    e.gliding = true;
    e.freefall = true;
    e.onGround = false;
    if (e.onJump) e.onJump();
    this.passengers = this.passengers.filter(p => p !== e);
  },

  update(dt) {
    if (!this.active) return;
    this.t += this.speed * dt / this.len;
    this.pos.lerpVectors(this.start, this.end, Math.min(this.t, 1.2));
    this.mesh.position.copy(this.pos);
    this.mesh.position.y += Math.sin(this.t * 40) * 0.4;
    this.balloon.rotation.y += dt * 0.3;
    this.prop.rotation.z += dt * 25;
    for (const e of this.passengers.slice()) {
      e.pos.copy(this.pos);
      if (!e.alive) continue;
      if (!e.isPlayer && this.t >= e.jumpAt) this.drop(e);
      else if (e.isPlayer && this.t >= this.tOut) { UI.announce('Endstation! Du wurdest rausgeworfen.'); this.drop(e); }
    }
    if (this.t > 1.15) { this.active = false; this.mesh.visible = false; }
  },

  // Noch jemand drin / Bus noch über der Karte?
  get boarding() { return this.active && this.t < this.tOut; },

  // Sekunden, bis der Bus über die Karte hinaus ist
  timeLeft() { return Math.max(0, (this.tOut - this.t) * this.len / this.speed); },
};

// Gleiter (für Bots sichtbar)
function gliderModel(color) {
  const B = (s, p, c, r) => ({ t: 'box', s, p, c, r });
  const g = new THREE.Group();
  g.add(partsMesh([
    B([0.08, 0.08, 1.6], [0, 0, 0], '#333333'),
    B([1.9, 0.04, 0.9], [-0.9, 0.05, 0.1], color, [0, 0.35, -0.12]),
    B([1.9, 0.04, 0.9], [0.9, 0.05, 0.1], color, [0, -0.35, 0.12]),
    B([0.03, 0.9, 0.03], [-0.25, -0.45, 0], '#333333', [0, 0, -0.3]),
    B([0.03, 0.9, 0.03], [0.25, -0.45, 0], '#333333', [0, 0, 0.3]),
  ]));
  return g;
}
