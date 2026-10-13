'use strict';
// ============================================================
//  Der Sturm (Zone): wird nach und nach kleiner, draußen gibt's Schaden
// ============================================================
const ZONE_PHASES = [
  { wait: 60, shrink: 50, r: 210, dps: 1 },
  { wait: 50, shrink: 40, r: 125, dps: 1 },
  { wait: 40, shrink: 35, r: 70, dps: 2 },
  { wait: 35, shrink: 30, r: 38, dps: 5 },
  { wait: 30, shrink: 25, r: 16, dps: 8 },
  { wait: 20, shrink: 25, r: 0, dps: 12 },
];
const ZONE_START_R = 440;

const Zone = {
  cur: { x: 0, z: 0, r: ZONE_START_R },
  from: { x: 0, z: 0, r: ZONE_START_R },
  next: { x: 0, z: 0, r: 210 },
  phase: 0,
  state: 'wait',
  timer: 0,
  dps: 1,
  tickT: 0,
  mesh: null,

  init(scene) {
    this.cur = { x: 0, z: 0, r: ZONE_START_R };
    this.from = { ...this.cur };
    this.phase = 0; this.state = 'wait'; this.timer = ZONE_PHASES[0].wait; this.dps = 1; this.tickT = 0;
    this.pickNext();
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
    geo.translate(0, 0.5, 0);
    // Sturmwand: nah = kräftig lila mit Schlieren, weit weg = fast unsichtbar
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform float time;
        varying vec3 vW;
        void main() {
          float d = distance(vW.xz, cameraPosition.xz);
          float near = 1.0 - smoothstep(25.0, 150.0, d);
          float stripes = 0.5 + 0.5 * sin(vW.y * 0.35 + atan(vW.z, vW.x) * 40.0 + time * 1.5);
          float a = 0.06 + near * (0.38 + stripes * 0.12);
          gl_FragColor = vec4(mix(vec3(0.42, 0.18, 0.85), vec3(0.62, 0.38, 1.0), stripes), a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, m);
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.updateMesh();
  },

  pickNext() {
    const p = ZONE_PHASES[this.phase];
    const maxOff = Math.max(0, Math.min(this.cur.r, 260) - p.r) * 0.85;
    const a = Math.random() * Math.PI * 2, d = Math.random() * maxOff;
    let x = this.cur.x + Math.cos(a) * d, z = this.cur.z + Math.sin(a) * d;
    // nicht zu weit an den Rand
    const lim = Math.max(0, MAP_HALF - p.r - 10);
    x = clamp(x, -lim, lim); z = clamp(z, -lim, lim);
    if (this.phase === 0) { x = clamp(x, -60, 60); z = clamp(z, -60, 60); }
    this.next = { x, z, r: p.r };
  },

  // Der Kreis, in den man laufen sollte
  safe() { return this.next; },

  outside(pos, margin = 0) {
    const n = this.state === 'done' ? this.cur : this.next;
    return Math.hypot(pos.x - n.x, pos.z - n.z) > Math.max(2, n.r - margin);
  },

  isOutside(pos) { return Math.hypot(pos.x - this.cur.x, pos.z - this.cur.z) > this.cur.r; },

  update(dt) {
    this.timer -= dt;
    if (this.state === 'wait') {
      if (this.timer <= 0) {
        this.state = 'shrink';
        this.from = { ...this.cur };
        this.timer = ZONE_PHASES[this.phase].shrink;
        this.dps = ZONE_PHASES[this.phase].dps;
        UI.announce('Der Sturm zieht sich zusammen!');
        Sound.play('zone');
      }
    } else if (this.state === 'shrink') {
      const p = ZONE_PHASES[this.phase];
      const k = 1 - Math.max(0, this.timer) / p.shrink;
      this.cur.x = lerp(this.from.x, this.next.x, k);
      this.cur.z = lerp(this.from.z, this.next.z, k);
      this.cur.r = lerp(this.from.r, this.next.r, k);
      if (this.timer <= 0) {
        this.phase++;
        if (this.phase >= ZONE_PHASES.length) { this.state = 'done'; this.dps = 15; }
        else {
          this.state = 'wait';
          this.timer = ZONE_PHASES[this.phase].wait;
          this.pickNext();
          UI.announce('Neuer sicherer Bereich auf der Karte!');
        }
      }
    }
    this.updateMesh();
    // Schaden
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = 1;
      for (const e of Entities) {
        if (!e.alive || !this.isOutside(e.pos)) continue;
        if (e.inBus || (e.gliding && e.pos.y > 20)) continue;
        e.takeDamage(this.dps, 'zone', false);
        if (e.isPlayer) Effects.dmgNumber(e.pos.clone().setY(e.pos.y + 1.2).add(e.forward().multiplyScalar(1.5)), this.dps, '#c79bff');
      }
    }
  },

  updateMesh() {
    this.mesh.material.uniforms.time.value += 0.016;
    const r = Math.max(0.5, this.cur.r);
    this.mesh.scale.set(r, 1400, r);
    this.mesh.position.set(this.cur.x, -5, this.cur.z);
  },

  label() {
    const t = Math.max(0, Math.ceil(this.timer));
    const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
    if (this.state === 'wait') return { text: this.phase === 0 ? 'Sturm kommt in' : 'Sturm schrumpft in', time: `${mm}:${ss}` };
    if (this.state === 'shrink') return { text: 'Sturm zieht zu', time: `${mm}:${ss}` };
    return { text: 'Letzter Kreis', time: '--:--' };
  },
};
