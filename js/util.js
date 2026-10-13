'use strict';
// ============================================================
//  Hilfsfunktionen: Zufall, Texturen, Materialien, Geometrie, Sound
// ============================================================

// --- Zufall (mit Seed, damit die Karte immer gleich aussieht) ---
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(1337);
const rnd = (a, b) => a + (b - a) * rand();
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mrnd = (a, b) => a + (b - a) * Math.random();

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.r = clamp(c.r * f, 0, 1); c.g = clamp(c.g * f, 0, 1); c.b = clamp(c.b * f, 0, 1);
  return '#' + c.getHexString();
}

// --- Texturen (werden im Browser gemalt, keine Bilddateien nötig) ---
const TEX = {};

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function speckle(g, s, colors, count, maxSize) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    const w = 1 + Math.random() * maxSize;
    g.fillRect(Math.random() * s, Math.random() * s, w, w);
  }
}

function initTextures() {
  TEX.grass = canvasTex(256, (g, s) => {
    g.fillStyle = '#5b9a3c'; g.fillRect(0, 0, s, s);
    speckle(g, s, ['#4f8a33', '#68a845', '#579436', '#73b04f', '#4a7f2f'], 3000, 3);
  });
  TEX.dirt = canvasTex(256, (g, s) => {
    g.fillStyle = '#8a6d48'; g.fillRect(0, 0, s, s);
    speckle(g, s, ['#7a5f3d', '#9a7c55', '#6f5535'], 2500, 3);
  });
  TEX.asphalt = canvasTex(256, (g, s) => {
    g.fillStyle = '#3b3e44'; g.fillRect(0, 0, s, s);
    speckle(g, s, ['#34373c', '#44474d', '#2f3236', '#4a4d52'], 4000, 2);
  });
  TEX.sidewalk = canvasTex(256, (g, s) => {
    g.fillStyle = '#b8b4ab'; g.fillRect(0, 0, s, s);
    speckle(g, s, ['#aaa69d', '#c4c0b7', '#b0aca3'], 1500, 2);
    g.strokeStyle = '#8f8b83'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(s, i * 64); g.stroke();
    }
  });
  TEX.brick = canvasTex(256, (g, s) => {
    g.fillStyle = '#d9d2c5'; g.fillRect(0, 0, s, s);
    const rows = 16, bh = s / rows, bw = 32;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw / 2);
      for (let x = -bw; x < s + bw; x += bw) {
        const v = 0.85 + Math.random() * 0.25;
        g.fillStyle = shade('#a5482f', v);
        g.fillRect(x + off + 1, r * bh + 1, bw - 2, bh - 2);
      }
    }
  });
  TEX.plaster = canvasTex(256, (g, s) => {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, s, s);
    speckle(g, s, ['#e6e2da', '#faf8f3', '#ebe7df'], 3000, 3);
  });
  TEX.planks = canvasTex(256, (g, s) => {
    g.fillStyle = '#9c6b3c'; g.fillRect(0, 0, s, s);
    const n = 8, h = s / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade('#a8743f', 0.85 + Math.random() * 0.3);
      g.fillRect(0, i * h + 1, s, h - 2);
      g.strokeStyle = 'rgba(60,35,15,0.25)';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        const y = i * h + 4 + Math.random() * (h - 8);
        g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + 3, s * 0.6, y - 3, s, y); g.stroke();
      }
      g.fillStyle = '#5e3b1c';
      const sx = Math.random() * s;
      g.fillRect(sx, i * h, 2, h);
    }
  });
  TEX.stone = canvasTex(256, (g, s) => {
    g.fillStyle = '#6f6e6a'; g.fillRect(0, 0, s, s);
    const rows = 8, bh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -(r % 2) * 24;
      while (x < s) {
        const w = 36 + Math.random() * 30;
        g.fillStyle = shade('#a19e96', 0.8 + Math.random() * 0.3);
        g.fillRect(x + 2, r * bh + 2, w - 4, bh - 4);
        x += w;
      }
    }
    speckle(g, s, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], 1500, 2);
  });
  TEX.metal = canvasTex(256, (g, s) => {
    const grd = g.createLinearGradient(0, 0, 32, 0);
    grd.addColorStop(0, '#9aa3ab'); grd.addColorStop(0.5, '#c9d0d6'); grd.addColorStop(1, '#8a939b');
    for (let x = 0; x < s; x += 32) {
      g.save(); g.translate(x, 0); g.fillStyle = grd; g.fillRect(0, 0, 32, s); g.restore();
    }
    g.fillStyle = '#5d646b';
    for (let y = 8; y < s; y += 64) for (let x = 4; x < s; x += 16) g.fillRect(x, y, 3, 3);
  });
  TEX.roof = canvasTex(256, (g, s) => {
    g.fillStyle = '#5a2a1d'; g.fillRect(0, 0, s, s);
    const rows = 12, h = s / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 10;
      for (let x = -20; x < s + 20; x += 20) {
        g.fillStyle = shade('#a34a2e', 0.8 + Math.random() * 0.3);
        g.beginPath();
        g.ellipse(x + off + 10, r * h + h * 0.4, 9, h * 0.62, 0, 0, Math.PI);
        g.fill();
      }
    }
  });
  TEX.bark = canvasTex(128, (g, s) => {
    g.fillStyle = '#5b3b22'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#4a2f1a' : '#6b4729';
      g.fillRect(Math.random() * s, 0, 2 + Math.random() * 3, s);
    }
  });
  TEX.rock = canvasTex(128, (g, s) => {
    g.fillStyle = '#8a8a86'; g.fillRect(0, 0, s, s);
    speckle(g, s, ['#7a7a76', '#9b9b97', '#6e6e6a', '#a5a5a0'], 1500, 4);
  });
  TEX.leaves = canvasTex(128, (g, s) => {
    g.fillStyle = '#3f7d2e'; g.fillRect(0, 0, s, s);
    speckle(g, s, ['#356b26', '#4b9238', '#2f5f22', '#5aa344'], 1200, 5);
  });
}

// --- Materialien (zwischengespeichert) ---
const MATS = {};
function mat(tex, color = '#ffffff', extra) {
  const key = tex + '|' + color + (extra ? JSON.stringify(extra) : '');
  if (!MATS[key]) {
    const opts = Object.assign({ color }, extra || {});
    if (tex) opts.map = TEX[tex];
    MATS[key] = new THREE.MeshLambertMaterial(opts);
  }
  return MATS[key];
}
function colMat(color, extra) { return mat(null, color, extra); }

// --- Geometrie: Kisten mit Welt-UVs, mehrere zu einem Mesh verschmelzen ---
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

// list: Array von [breite, höhe, tiefe, x, y, z, farbe?]  (x,y,z = Mittelpunkt)
// Mit Farbe entsteht ein Mesh mit Vertex-Farben (viele Teile = nur ein Zeichenaufruf)
function boxesGeo(list, uvScale = 0.25) {
  const pos = [], nor = [], uv = [], col = [];
  const withColor = list.some(b => b[6]);
  const tmp = new THREE.Color();
  for (const b of list) {
    const [w, h, d, x, y, z] = b;
    if (withColor) tmp.set(b[6] || '#ffffff');
    const half = [w / 2, h / 2, d / 2];
    for (const f of FACES) {
      const hu = Math.abs(f.u[0]) * half[0] + Math.abs(f.u[1]) * half[1] + Math.abs(f.u[2]) * half[2];
      const hv = Math.abs(f.v[0]) * half[0] + Math.abs(f.v[1]) * half[1] + Math.abs(f.v[2]) * half[2];
      const cx = x + f.n[0] * half[0], cy = y + f.n[1] * half[1], cz = z + f.n[2] * half[2];
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c]) => [
        cx + f.u[0] * hu * a + f.v[0] * hv * c,
        cy + f.u[1] * hu * a + f.v[1] * hv * c,
        cz + f.u[2] * hu * a + f.v[2] * hv * c,
      ]);
      // Unterseiten etwas dunkler, Oberseiten etwas heller (wirkt plastischer)
      const sh = f.n[1] > 0 ? 1.08 : f.n[1] < 0 ? 0.7 : 1;
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const p = corners[i];
        pos.push(p[0], p[1], p[2]);
        nor.push(f.n[0], f.n[1], f.n[2]);
        uv.push((p[0] * f.u[0] + p[1] * f.u[1] + p[2] * f.u[2]) * uvScale,
                (p[0] * f.v[0] + p[1] * f.v[1] + p[2] * f.v[2]) * uvScale);
        if (withColor) col.push(Math.min(1, tmp.r * sh), Math.min(1, tmp.g * sh), Math.min(1, tmp.b * sh));
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (withColor) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

// Ein Mesh aus vielen farbigen Kisten
let VC_MAT = null;
function vcMesh(list, cacheKey) {
  if (!VC_MAT) VC_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
  const geo = cacheKey ? cachedGeo(cacheKey, () => boxesGeo(list)) : boxesGeo(list);
  const m = new THREE.Mesh(geo, VC_MAT);
  m.castShadow = true;
  return m;
}

const GEO_CACHE = {};
function cachedGeo(key, make) {
  if (!GEO_CACHE[key]) GEO_CACHE[key] = make();
  return GEO_CACHE[key];
}

function boxMesh(w, h, d, material, x = 0, y = 0, z = 0) {
  const geo = cachedGeo('b' + w + ',' + h + ',' + d, () => boxesGeo([[w, h, d, 0, 0, 0]]));
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

// --- Sound (alles synthetisch über WebAudio) ---
const Sound = {
  ctx: null, master: null, noise: null, listener: new THREE.Vector3(),
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  vol(pos) {
    if (!pos) return 1;
    const d = pos.distanceTo(this.listener);
    if (d > 120) return 0;
    return 1 / (1 + d / 12);
  },
  burst(dur, freq, q, gain, type = 'lowpass', t0 = 0) {
    const c = this.ctx, t = c.currentTime + t0;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  tone(freq, dur, gain, type = 'square', slide = 0, t0 = 0) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  play(name, pos) {
    if (!this.ctx) return;
    const v = this.vol(pos);
    if (v < 0.02) return;
    switch (name) {
      case 'pistol': this.burst(0.18, 2500, 1, 0.9 * v); this.tone(180, 0.08, 0.3 * v, 'square', -120); break;
      case 'smg': this.burst(0.1, 3000, 1, 0.6 * v); break;
      case 'ar': this.burst(0.22, 1800, 1, 0.9 * v); this.tone(120, 0.1, 0.3 * v, 'square', -80); break;
      case 'shotgun': this.burst(0.45, 1200, 0.7, 1.2 * v); this.tone(90, 0.2, 0.5 * v, 'sawtooth', -60); break;
      case 'sniper': this.burst(0.7, 1500, 0.8, 1.3 * v); this.tone(70, 0.4, 0.5 * v, 'sawtooth', -40); break;
      case 'rocket': this.burst(0.6, 600, 0.5, 0.8 * v); break;
      case 'explosion': this.burst(1.2, 400, 0.5, 1.6 * v); this.tone(60, 0.8, 0.8 * v, 'sine', -30); break;
      case 'pickaxe': this.tone(900, 0.06, 0.25 * v, 'triangle', -300); this.burst(0.1, 1500, 2, 0.4 * v, 'bandpass'); break;
      case 'swing': this.burst(0.15, 800, 1, 0.2 * v, 'bandpass'); break;
      case 'hit': this.tone(1400, 0.05, 0.25, 'square', 200); break;
      case 'headshot': this.tone(1800, 0.08, 0.3, 'square', 600); this.tone(2400, 0.08, 0.2, 'square', 0, 0.05); break;
      case 'build': this.burst(0.15, 500, 1, 0.5 * v); this.tone(220, 0.1, 0.25 * v, 'triangle', -100); break;
      case 'break': this.burst(0.5, 900, 0.8, 0.9 * v); break;
      case 'chest': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 0.15 * v, 'triangle', 0, i * 0.07)); break;
      case 'pickup': this.tone(600, 0.08, 0.2, 'triangle', 400); break;
      case 'reload': this.tone(300, 0.05, 0.2, 'square'); this.tone(500, 0.05, 0.2, 'square', 0, 0.15); break;
      case 'hurt': this.tone(220, 0.2, 0.35, 'sawtooth', -120); break;
      case 'heal': this.tone(440, 0.3, 0.15, 'sine', 440); break;
      case 'shield': this.tone(660, 0.3, 0.15, 'sine', 660); break;
      case 'empty': this.tone(1200, 0.03, 0.15, 'square'); break;
      case 'zone': this.tone(110, 1.2, 0.3, 'sawtooth', 50); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, 0.2, 'triangle', 0, i * 0.12)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 0.2, 'triangle', 0, i * 0.15)); break;
    }
  },
};
