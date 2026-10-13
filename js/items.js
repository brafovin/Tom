'use strict';
// ============================================================
//  Gegenstände: Waffen, Heilung, Munition, Kisten, Boden-Loot
// ============================================================

const RARITIES = [
  { name: 'Gewöhnlich', color: '#8a9199', dmg: 1.00, reload: 1.00 },
  { name: 'Ungewöhnlich', color: '#3fae4a', dmg: 1.05, reload: 0.95 },
  { name: 'Selten', color: '#3b7fe0', dmg: 1.10, reload: 0.90 },
  { name: 'Episch', color: '#9b4ddb', dmg: 1.16, reload: 0.85 },
  { name: 'Legendär', color: '#e8a317', dmg: 1.22, reload: 0.80 },
];

const AMMO = {
  light: { name: 'Leichte Munition', color: '#7fb3ff', pack: 30 },
  medium: { name: 'Mittlere Munition', color: '#7be37b', pack: 30 },
  heavy: { name: 'Schwere Munition', color: '#ff7b7b', pack: 6 },
  shells: { name: 'Schrot', color: '#ffd166', pack: 10 },
  rockets: { name: 'Raketen', color: '#ff9f43', pack: 3 },
};

const WEAPONS = {
  pistol:  { name: 'Pistole', ammo: 'light', dmg: 24, rate: 6.5, mag: 16, reload: 1.4, spread: 0.012, bloom: 0.018, auto: false, range: 140, head: 2.0, sound: 'pistol', kick: 0.012 },
  smg:     { name: 'Maschinenpistole', ammo: 'light', dmg: 16, rate: 12, mag: 30, reload: 2.0, spread: 0.028, bloom: 0.01, auto: true, range: 100, head: 1.75, sound: 'smg', kick: 0.006 },
  ar:      { name: 'Sturmgewehr', ammo: 'medium', dmg: 30, rate: 5.5, mag: 30, reload: 2.2, spread: 0.012, bloom: 0.012, auto: true, range: 220, head: 1.5, sound: 'ar', kick: 0.01 },
  shotgun: { name: 'Schrotflinte', ammo: 'shells', dmg: 10, pellets: 10, rate: 0.9, mag: 5, reload: 3.5, spread: 0.075, bloom: 0, auto: false, range: 45, head: 1.5, sound: 'shotgun', kick: 0.05 },
  sniper:  { name: 'Scharfschützengewehr', ammo: 'heavy', dmg: 105, rate: 0.35, mag: 1, reload: 2.5, spread: 0.002, bloom: 0, auto: false, range: 600, head: 2.5, sound: 'sniper', kick: 0.08, scope: true },
  rocket:  { name: 'Raketenwerfer', ammo: 'rockets', dmg: 110, rate: 0.6, mag: 1, reload: 3.0, spread: 0.004, bloom: 0, auto: false, range: 300, head: 1, sound: 'rocket', kick: 0.06, projectile: true, radius: 5 },
};

const HEALS = {
  bandage:    { name: 'Verband', hp: 15, maxHp: 75, time: 2.5, stack: 15, give: 5 },
  medkit:     { name: 'Medikit', hp: 100, maxHp: 100, time: 6, stack: 3, give: 1 },
  shield:     { name: 'Schildtrank', shield: 50, maxShield: 100, time: 4, stack: 3, give: 1 },
  minishield: { name: 'Mini-Schild', shield: 25, maxShield: 50, time: 1.5, stack: 6, give: 3 },
};

function weightedPick(table) {
  let sum = 0;
  for (const k in table) sum += table[k];
  let r = Math.random() * sum;
  for (const k in table) { r -= table[k]; if (r <= 0) return k; }
  return Object.keys(table)[0];
}
function pickRarity(weights) {
  let sum = weights.reduce((a, b) => a + b, 0), r = Math.random() * sum;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return 0;
}

function makeWeapon(key, rarity) {
  return { kind: 'weapon', key, rarity, mag: WEAPONS[key].mag };
}
function makeHeal(key, count) {
  return { kind: 'heal', key, count: count || HEALS[key].give, rarity: key === 'medkit' || key === 'shield' ? 2 : 1 };
}

const WEAPON_TABLE = { pistol: 22, smg: 20, ar: 26, shotgun: 20, sniper: 8, rocket: 4 };
const HEAL_TABLE = { bandage: 35, medkit: 15, shield: 20, minishield: 30 };

function rollChestLoot() {
  const out = [];
  const key = weightedPick(WEAPON_TABLE);
  out.push(makeWeapon(key, pickRarity([28, 32, 22, 12, 6])));
  out.push({ kind: 'ammo', ammo: WEAPONS[key].ammo, count: AMMO[WEAPONS[key].ammo].pack });
  if (Math.random() < 0.65) out.push(makeHeal(weightedPick(HEAL_TABLE)));
  if (Math.random() < 0.5) {
    const a = pick(Object.keys(AMMO).filter(k => k !== 'rockets'));
    out.push({ kind: 'ammo', ammo: a, count: AMMO[a].pack });
  }
  out.push({ kind: 'mats', mat: pick(['wood', 'wood', 'stone', 'metal']), count: 30 });
  return out;
}

function rollFloorLoot() {
  const r = Math.random();
  if (r < 0.55) {
    const key = weightedPick(WEAPON_TABLE);
    return [makeWeapon(key, pickRarity([45, 30, 15, 7, 3])), { kind: 'ammo', ammo: WEAPONS[key].ammo, count: AMMO[WEAPONS[key].ammo].pack }];
  }
  if (r < 0.8) return [makeHeal(weightedPick(HEAL_TABLE))];
  const a = pick(Object.keys(AMMO).filter(k => k !== 'rockets'));
  return [{ kind: 'ammo', ammo: a, count: AMMO[a].pack }];
}

function itemName(item) {
  if (item.kind === 'weapon') return WEAPONS[item.key].name;
  if (item.kind === 'heal') return HEALS[item.key].name;
  if (item.kind === 'ammo') return AMMO[item.ammo].name;
  if (item.kind === 'mats') return MAT_INFO[item.mat].name;
  return '?';
}

// ---------- 3D-Modelle ----------
function weaponModel(key, rarity) {
  const list = [];
  const dark = '#2b2e33', mid = '#4a4f57', wood = '#7a4b25';
  const accent = RARITIES[rarity] ? RARITIES[rarity].color : '#888888';
  const add = (w, h, d, x, y, z, c) => list.push([w, h, d, x, y, z, c]);
  switch (key) {
    case 'pistol':
      add(0.05, 0.07, 0.24, 0, 0, -0.06, dark); add(0.045, 0.12, 0.06, 0, -0.08, 0.02, mid);
      add(0.052, 0.02, 0.12, 0, 0.04, -0.08, accent); break;
    case 'smg':
      add(0.07, 0.09, 0.42, 0, 0, -0.12, dark); add(0.05, 0.14, 0.05, 0, -0.1, 0.02, mid);
      add(0.04, 0.16, 0.05, 0, -0.11, -0.16, mid); add(0.03, 0.03, 0.14, 0, 0.01, -0.39, dark);
      add(0.075, 0.025, 0.2, 0, 0.055, -0.1, accent); break;
    case 'ar':
      add(0.07, 0.1, 0.6, 0, 0, -0.2, dark); add(0.06, 0.08, 0.22, 0, -0.01, 0.19, mid);
      add(0.05, 0.15, 0.05, 0, -0.11, 0.0, mid); add(0.045, 0.16, 0.07, 0, -0.12, -0.18, dark);
      add(0.03, 0.03, 0.22, 0, 0.02, -0.6, dark); add(0.075, 0.03, 0.3, 0, 0.06, -0.2, accent);
      add(0.04, 0.05, 0.12, 0, 0.09, -0.15, mid); break;
    case 'shotgun':
      add(0.07, 0.08, 0.5, 0, 0, -0.2, dark); add(0.06, 0.1, 0.26, 0, -0.02, 0.18, wood);
      add(0.05, 0.05, 0.4, 0, 0.03, -0.58, mid); add(0.07, 0.06, 0.16, 0, -0.04, -0.46, wood);
      add(0.075, 0.02, 0.2, 0, 0.05, -0.1, accent); break;
    case 'sniper':
      add(0.06, 0.09, 0.7, 0, 0, -0.2, dark); add(0.06, 0.1, 0.28, 0, -0.01, 0.26, wood);
      add(0.03, 0.03, 0.5, 0, 0.02, -0.78, dark); add(0.05, 0.05, 0.28, 0, 0.1, -0.2, mid);
      add(0.065, 0.065, 0.04, 0, 0.1, -0.35, dark); add(0.065, 0.065, 0.04, 0, 0.1, -0.05, dark);
      add(0.065, 0.02, 0.3, 0, -0.05, -0.25, accent); break;
    case 'rocket':
      add(0.16, 0.16, 1.0, 0, 0.02, -0.25, '#3d5a3a'); add(0.2, 0.2, 0.1, 0, 0.02, -0.76, dark);
      add(0.05, 0.14, 0.06, 0, -0.12, -0.05, mid); add(0.17, 0.04, 0.4, 0, 0.12, -0.2, accent); break;
  }
  const g = new THREE.Group();
  g.add(vcMesh(list, 'wpn_' + key + '_' + rarity));
  return g;
}

function pickaxeModel() {
  const g = new THREE.Group();
  const handle = boxMesh(0.05, 0.75, 0.05, colMat('#5b3a1d'), 0, 0, 0);
  g.add(handle);
  const head = boxMesh(0.07, 0.09, 0.5, colMat('#6a4bd1'), 0, 0.36, 0);
  g.add(head);
  const tip1 = boxMesh(0.05, 0.06, 0.16, colMat('#d6d9e0'), 0, 0.33, -0.3);
  tip1.rotation.x = -0.4; g.add(tip1);
  const tip2 = boxMesh(0.05, 0.06, 0.16, colMat('#d6d9e0'), 0, 0.33, 0.3);
  tip2.rotation.x = 0.4; g.add(tip2);
  return g;
}

function healModel(key) {
  let list;
  if (key === 'bandage') list = [[0.25, 0.12, 0.25, 0, 0, 0, '#f4efe6'], [0.26, 0.04, 0.08, 0, 0.05, 0, '#e14b4b']];
  else if (key === 'medkit') list = [[0.45, 0.3, 0.2, 0, 0, 0, '#f4f4f4'], [0.2, 0.06, 0.21, 0, 0, 0, '#e14b4b'], [0.06, 0.2, 0.21, 0, 0, 0, '#e14b4b']];
  else {
    const s = key === 'shield' ? 1 : 0.7;
    list = [[0.18 * s, 0.26 * s, 0.18 * s, 0, 0, 0, '#3fa9f5'], [0.07 * s, 0.1 * s, 0.07 * s, 0, 0.17 * s, 0, '#d0d0d0']];
  }
  const g = new THREE.Group();
  g.add(vcMesh(list, 'heal_' + key));
  return g;
}

// ---------- Symbole für das Inventar (SVG) ----------
const ICONS = {
  pickaxe: '<svg viewBox="0 0 64 64"><path d="M30 18 L36 18 L36 60 L30 60Z" fill="#b07a45"/><path d="M8 20 Q33 2 58 20 L54 24 Q33 10 12 24Z" fill="#c9c3ff"/><rect x="27" y="11" width="12" height="12" rx="2" fill="#6a4bd1"/></svg>',
  pistol: '<svg viewBox="0 0 64 64"><path d="M8 22h46v10H30l-4 18H15l4-18H8z" fill="#fff"/></svg>',
  smg: '<svg viewBox="0 0 64 64"><path d="M4 22h50v10H38l-2 6h-8v14h-7V32H4z M54 25h8v4h-8z" fill="#fff"/></svg>',
  ar: '<svg viewBox="0 0 64 64"><path d="M2 26h44v-4h8v4h8v4h-8v4H36l-2 14h-7l1-14h-6l-3 10h-6l1-10H2l3-4z" fill="#fff"/></svg>',
  shotgun: '<svg viewBox="0 0 64 64"><path d="M2 30l14-4h46v5H40v5H22l-6 6H6z" fill="#fff"/></svg>',
  sniper: '<svg viewBox="0 0 64 64"><path d="M2 32l12-4h48v3H34v5H18l-5 6H4z M20 20h18v6H20z" fill="#fff"/></svg>',
  rocket: '<svg viewBox="0 0 64 64"><path d="M4 24h48l8 2v8l-8 2H4z M24 36h6v10h-6z" fill="#fff"/></svg>',
  bandage: '<svg viewBox="0 0 64 64"><rect x="10" y="22" width="44" height="20" rx="4" fill="#f4efe6" transform="rotate(-25 32 32)"/><rect x="26" y="24" width="12" height="16" fill="#e14b4b" transform="rotate(-25 32 32)"/></svg>',
  medkit: '<svg viewBox="0 0 64 64"><rect x="10" y="18" width="44" height="32" rx="5" fill="#f4f4f4"/><rect x="28" y="23" width="8" height="22" fill="#e14b4b"/><rect x="21" y="30" width="22" height="8" fill="#e14b4b"/></svg>',
  shield: '<svg viewBox="0 0 64 64"><rect x="26" y="8" width="12" height="10" fill="#ccc"/><path d="M20 18h24l4 10v24a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V28z" fill="#3fa9f5"/></svg>',
  minishield: '<svg viewBox="0 0 64 64"><rect x="28" y="16" width="8" height="8" fill="#ccc"/><path d="M23 24h18l4 8v18a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3V32z" fill="#7cc8ff"/></svg>',
};
function itemIcon(item) {
  return ICONS[item.key] || '';
}

// ---------- Gegenstände auf dem Boden ----------
const GroundItems = {
  list: [],
  scene: null,
  beamGeo: null,

  init(scene) {
    this.scene = scene;
    this.beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 6, 1, true);
  },

  spawn(item, pos) {
    const g = new THREE.Group();
    let model;
    if (item.kind === 'weapon') { model = weaponModel(item.key, item.rarity); model.scale.setScalar(1.6); }
    else if (item.kind === 'heal') { model = healModel(item.key); model.scale.setScalar(1.5); }
    else if (item.kind === 'ammo') {
      model = new THREE.Group();
      model.add(vcMesh([[0.35, 0.22, 0.25, 0, 0, 0, '#5b6b3a'], [0.36, 0.06, 0.26, 0, 0.06, 0, AMMO[item.ammo].color]], 'ammo_' + item.ammo));
    } else {
      model = new THREE.Group();
      const c = MAT_INFO[item.mat].color;
      model.add(vcMesh([[0.5, 0.18, 0.18, 0, 0, 0, c], [0.5, 0.18, 0.18, 0, 0.18, 0.05, shade(c, 0.8)]], 'mats_' + item.mat));
    }
    model.position.y = 0.5;
    g.add(model);
    if (item.kind === 'weapon' || item.kind === 'heal') {
      const rc = RARITIES[item.rarity || 0].color;
      const beam = new THREE.Mesh(this.beamGeo, colMat(rc, { transparent: true, opacity: 0.35, depthWrite: false }));
      beam.position.y = 1.5;
      g.add(beam);
    }
    g.position.copy(pos);
    g.position.y = groundHeight(pos.x, pos.z, 0.2, pos.y + 1);
    this.scene.add(g);
    const gi = { item, group: g, model, pos: g.position, t: Math.random() * 6, auto: item.kind === 'ammo' || item.kind === 'mats', delay: 0.6 };
    this.list.push(gi);
    return gi;
  },

  remove(gi) {
    const i = this.list.indexOf(gi);
    if (i >= 0) this.list.splice(i, 1);
    this.scene.remove(gi.group);
  },

  update(dt) {
    for (const gi of this.list) {
      gi.t += dt;
      gi.delay -= dt;
      gi.model.rotation.y = gi.t * 1.5;
      gi.model.position.y = 0.5 + Math.sin(gi.t * 2) * 0.08;
    }
  },

  clear() {
    for (const gi of this.list) this.scene.remove(gi.group);
    this.list = [];
  },
};

// ---------- Kisten ----------
const Chests = {
  list: [],
  scene: null,

  init(scene) { this.scene = scene; },

  spawn(x, y, z, rotY = 0) {
    const g = new THREE.Group();
    const wood = '#8a5a2b', gold = '#f2c14e';
    g.add(vcMesh([[1.0, 0.5, 0.6, 0, 0.25, 0, wood], [1.04, 0.08, 0.64, 0, 0.05, 0, gold],
      [0.08, 0.5, 0.64, -0.4, 0.25, 0, gold], [0.08, 0.5, 0.64, 0.4, 0.25, 0, gold]], 'chestBody'));
    const lid = new THREE.Group();
    lid.position.set(0, 0.5, -0.3);
    lid.add(vcMesh([[1.0, 0.22, 0.6, 0, 0.11, 0.3, wood], [1.04, 0.06, 0.64, 0, 0.2, 0.3, gold],
      [0.14, 0.14, 0.05, 0, 0.02, 0.62, gold]], 'chestLid'));
    g.add(lid);
    const glow = new THREE.Mesh(cachedGeo('chestglow', () => new THREE.BoxGeometry(1.3, 1.0, 0.9)),
      colMat('#ffd54a', { transparent: true, opacity: 0.18, depthWrite: false }));
    glow.position.y = 0.45;
    g.add(glow);
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.scene.add(g);
    const ch = { group: g, lid, glow, pos: g.position, opened: false, t: Math.random() * 5 };
    const r = Math.abs(Math.sin(rotY)) > 0.5;
    ch.col = r ? addBoxC(x, y + 0.36, z, 0.6, 0.72, 1.0) : addBoxC(x, y + 0.36, z, 1.0, 0.72, 0.6);
    ch.col.noRay = true;
    this.list.push(ch);
    return ch;
  },

  open(ch, opener) {
    if (ch.opened) return null;
    ch.opened = true;
    ch.lid.rotation.x = -1.9;
    ch.group.remove(ch.glow);
    Sound.play('chest', ch.pos);
    const loot = rollChestLoot();
    if (opener && opener.isBot) return loot;
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ch.group.rotation.y);
    loot.forEach((it, i) => {
      const a = (i - (loot.length - 1) / 2) * 0.7;
      const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      GroundItems.spawn(it, ch.pos.clone().addScaledVector(dir, 1.3 + (i % 2) * 0.4).setY(ch.pos.y + 0.5));
    });
    return null;
  },

  update(dt) {
    for (const ch of this.list) {
      if (ch.opened) continue;
      ch.t += dt;
      ch.glow.material.opacity = 0.12 + Math.sin(ch.t * 3) * 0.06;
    }
  },

  clear() {
    for (const ch of this.list) { this.scene.remove(ch.group); Phys.remove(ch.col); }
    this.list = [];
  },
};
