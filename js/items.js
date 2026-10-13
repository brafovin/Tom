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

function rollChestLoot(blue) {
  if (blue) return rollBlueLoot();
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

// Blaue Kiste: sehr gute Beute
function rollBlueLoot() {
  const k1 = pick(['ar', 'shotgun', 'sniper']);
  const k2 = pick(['ar', 'shotgun', 'sniper', 'smg', 'rocket'].filter(k => k !== k1));
  const out = [makeWeapon(k1, 4), makeWeapon(k2, Math.random() < 0.5 ? 4 : 3)];
  for (const k of [k1, k2]) out.push({ kind: 'ammo', ammo: WEAPONS[k].ammo, count: AMMO[WEAPONS[k].ammo].pack * 2 });
  out.push(makeHeal('shield', 2), makeHeal('medkit', 1));
  out.push({ kind: 'mats', mat: 'metal', count: 60 }, { kind: 'mats', mat: 'wood', count: 60 });
  return out;
}

// Auf dem Boden liegen nur schlechte Waffen (grau oder grün)
const FLOOR_WEAPONS = { pistol: 35, smg: 25, ar: 20, shotgun: 20 };
function rollFloorLoot() {
  const r = Math.random();
  if (r < 0.6) {
    const key = weightedPick(FLOOR_WEAPONS);
    return [makeWeapon(key, pickRarity([65, 35, 0, 0, 0])), { kind: 'ammo', ammo: WEAPONS[key].ammo, count: AMMO[WEAPONS[key].ammo].pack }];
  }
  if (r < 0.8) return [makeHeal(pick(['bandage', 'minishield']))];
  const a = pick(Object.keys(AMMO).filter(k => k !== 'rockets'));
  return [{ kind: 'ammo', ammo: a, count: AMMO[a].pack }];
}

// Schaden pro Schuss (bei der Schrotflinte alle Kugeln zusammen)
function weaponDamage(item) {
  const w = WEAPONS[item.key];
  return Math.round(w.dmg * RARITIES[item.rarity].dmg * (w.pellets || 1));
}
function weaponStats(item) {
  const w = WEAPONS[item.key], r = RARITIES[item.rarity];
  const per = Math.round(w.dmg * r.dmg);
  return {
    dmg: weaponDamage(item),
    dmgText: w.pellets ? `${w.pellets}×${per}` : String(per),
    head: Math.round(w.dmg * r.dmg * w.head * (w.pellets || 1)),
    dps: Math.round(w.dmg * r.dmg * (w.pellets || 1) * w.rate),
    rate: w.rate,
    mag: w.mag,
    reload: (w.reload * r.reload).toFixed(1),
    range: w.range,
  };
}

function itemName(item) {
  if (item.kind === 'weapon') return WEAPONS[item.key].name;
  if (item.kind === 'heal') return HEALS[item.key].name;
  if (item.kind === 'ammo') return AMMO[item.ammo].name;
  if (item.kind === 'mats') return MAT_INFO[item.mat].name;
  return '?';
}

// ---------- 3D-Modelle ----------
// Mündung (z-Position der Laufspitze) für Mündungsfeuer und Leuchtspur
const MUZZLE_Z = { pistol: -0.18, smg: -0.41, ar: -0.64, shotgun: -0.62, sniper: -0.82, rocket: -0.95 };

function weaponParts(key, acc) {
  const B = (s, p, c, r) => ({ t: 'box', s, p, c, r });
  const C = (r1, r2, len, p, c, r, seg) => ({ t: 'cyl', s: [r1, r2, len, seg || 12], p, c, r });
  const steel = '#2b2e33', black = '#18191c', poly = '#222427', dark = '#111214', wood = '#7a4b25', woodD = '#5e3a1c',
        olive = '#4b5a3a', tan = '#b39b72', lens = '#2a6bd6';
  const X = [0, 0, Math.PI / 2];   // Zylinder entlang x
  switch (key) {
    case 'pistol': return [
      B([0.03, 0.034, 0.19], [0, 0.032, -0.075], steel),
      B([0.031, 0.026, 0.004], [0, 0.03, 0.0], black), B([0.031, 0.026, 0.004], [0, 0.03, 0.008], black),
      B([0.031, 0.026, 0.004], [0, 0.03, 0.016], black),
      B([0.028, 0.022, 0.17], [0, 0.005, -0.07], poly),
      C(0.007, 0.007, 0.012, [0, 0.036, -0.172], dark),
      B([0.028, 0.11, 0.046], [0, -0.052, 0.012], poly, [0.28, 0, 0]),
      B([0.03, 0.012, 0.05], [0, -0.105, 0.028], black, [0.28, 0, 0]),
      B([0.006, 0.006, 0.05], [0, -0.022, -0.045], poly), B([0.006, 0.024, 0.006], [0, -0.012, -0.068], poly),
      B([0.004, 0.018, 0.004], [0, -0.012, -0.035], dark),
      B([0.005, 0.008, 0.006], [0, 0.053, -0.158], dark), B([0.022, 0.008, 0.008], [0, 0.053, 0.012], dark),
      B([0.0305, 0.006, 0.06], [0, 0.044, -0.1], acc),
    ];
    case 'smg': return [
      B([0.045, 0.058, 0.27], [0, 0.012, -0.08], steel),
      B([0.02, 0.01, 0.22], [0, 0.046, -0.08], black),
      C(0.022, 0.022, 0.13, [0, 0.008, -0.28], poly, null, 10),
      C(0.008, 0.008, 0.07, [0, 0.012, -0.375], dark),
      C(0.012, 0.012, 0.02, [0, 0.012, -0.405], dark),
      B([0.03, 0.1, 0.04], [0, -0.065, 0.005], poly, [0.3, 0, 0]),
      B([0.026, 0.15, 0.038], [0, -0.09, -0.135], black, [0.16, 0, 0]),
      C(0.005, 0.005, 0.17, [0.016, 0.0, 0.13], dark), C(0.005, 0.005, 0.17, [-0.016, 0.0, 0.13], dark),
      B([0.044, 0.075, 0.016], [0, -0.008, 0.22], poly),
      C(0.013, 0.013, 0.012, [0, 0.062, 0.02], dark), B([0.006, 0.02, 0.006], [0, 0.06, -0.18], dark),
      B([0.006, 0.006, 0.05], [0, -0.03, -0.035], poly),
      B([0.046, 0.008, 0.12], [0, 0.03, -0.1], acc),
    ];
    case 'ar': return [
      B([0.045, 0.05, 0.24], [0, -0.005, 0.0], steel),
      B([0.042, 0.045, 0.27], [0, 0.04, -0.01], '#34373c'),
      B([0.024, 0.012, 0.28], [0, 0.068, -0.03], black),
      B([0.052, 0.056, 0.28], [0, 0.032, -0.28], poly),
      B([0.02, 0.01, 0.26], [0, 0.064, -0.28], black),
      B([0.012, 0.03, 0.24], [0.028, 0.03, -0.28], black), B([0.012, 0.03, 0.24], [-0.028, 0.03, -0.28], black),
      C(0.009, 0.009, 0.2, [0, 0.035, -0.5], dark),
      C(0.014, 0.014, 0.05, [0, 0.035, -0.615], dark),
      B([0.012, 0.045, 0.012], [0, 0.072, -0.41], black),
      B([0.032, 0.034, 0.075], [0, 0.093, -0.03], black), C(0.016, 0.016, 0.006, [0, 0.096, -0.07], lens),
      C(0.004, 0.004, 0.004, [0, 0.096, -0.074], acc),
      B([0.032, 0.13, 0.064], [0, -0.09, -0.08], '#232427', [0.2, 0, 0]),
      B([0.035, 0.1, 0.045], [0, -0.072, 0.065], poly, [0.32, 0, 0]),
      B([0.006, 0.006, 0.06], [0, -0.035, 0.02], poly),
      C(0.015, 0.015, 0.14, [0, 0.032, 0.18], black),
      B([0.046, 0.085, 0.13], [0, 0.005, 0.29], poly),
      B([0.048, 0.1, 0.02], [0, 0.0, 0.36], dark),
      B([0.054, 0.01, 0.14], [0, 0.012, -0.24], acc),
    ];
    case 'shotgun': return [
      B([0.045, 0.062, 0.2], [0, 0.01, 0.0], steel),
      C(0.012, 0.012, 0.52, [0, 0.036, -0.36], dark),
      C(0.011, 0.011, 0.42, [0, 0.006, -0.31], steel),
      C(0.024, 0.022, 0.16, [0, 0.008, -0.3], wood, null, 10),
      B([0.04, 0.072, 0.29], [0, -0.022, 0.24], wood, [-0.12, 0, 0]),
      B([0.045, 0.11, 0.022], [0, -0.045, 0.385], dark, [-0.12, 0, 0]),
      B([0.038, 0.07, 0.08], [0, -0.03, 0.095], woodD, [0.25, 0, 0]),
      B([0.006, 0.006, 0.055], [0, -0.03, -0.01], steel),
      C(0.004, 0.004, 0.006, [0, 0.051, -0.61], '#e8e8e8'),
      B([0.0455, 0.012, 0.08], [0, 0.025, 0.0], acc),
    ];
    case 'sniper': return [
      B([0.05, 0.065, 0.52], [0, -0.012, 0.03], wood),
      B([0.046, 0.13, 0.2], [0, -0.04, 0.33], wood, [-0.08, 0, 0]),
      B([0.05, 0.13, 0.02], [0, -0.052, 0.435], dark, [-0.08, 0, 0]),
      B([0.04, 0.06, 0.07], [0, -0.065, 0.13], woodD, [0.3, 0, 0]),
      C(0.018, 0.018, 0.22, [0, 0.035, -0.02], steel),
      C(0.0055, 0.0055, 0.055, [0.03, 0.035, 0.07], steel, X), C(0.01, 0.01, 0.014, [0.058, 0.035, 0.07], dark, X),
      C(0.009, 0.011, 0.62, [0, 0.035, -0.44], dark),
      C(0.016, 0.016, 0.05, [0, 0.035, -0.77], black),
      C(0.017, 0.017, 0.3, [0, 0.098, -0.03], black),
      C(0.027, 0.017, 0.07, [0, 0.098, -0.2], black), C(0.022, 0.017, 0.05, [0, 0.098, 0.135], black),
      C(0.024, 0.024, 0.004, [0, 0.098, -0.237], lens),
      C(0.009, 0.009, 0.024, [0, 0.122, -0.03], dark, [0, 0, 0]), C(0.009, 0.009, 0.024, [0.024, 0.098, -0.03], dark, X),
      B([0.012, 0.03, 0.02], [0, 0.068, -0.1], black), B([0.012, 0.03, 0.02], [0, 0.068, 0.05], black),
      B([0.03, 0.035, 0.06], [0, -0.05, -0.02], black),
      C(0.0175, 0.0175, 0.015, [0, 0.098, 0.06], acc),
    ];
    case 'rocket': return [
      C(0.055, 0.055, 1.0, [0, 0.03, -0.25], olive, null, 16),
      C(0.062, 0.062, 0.26, [0, 0.03, -0.15], wood, null, 16),
      C(0.075, 0.056, 0.11, [0, 0.03, 0.29], olive, null, 16),
      C(0.01, 0.07, 0.22, [0, 0.03, -0.86], '#5d6b4a', null, 16),
      C(0.04, 0.04, 0.1, [0, 0.03, -0.73], tan, null, 12),
      B([0.032, 0.1, 0.04], [0, -0.06, -0.05], poly, [0.25, 0, 0]),
      B([0.032, 0.08, 0.04], [0, -0.05, -0.3], poly, [0.1, 0, 0]),
      B([0.02, 0.055, 0.04], [-0.07, 0.08, -0.22], black), B([0.024, 0.024, 0.02], [-0.07, 0.11, -0.22], lens),
      C(0.057, 0.057, 0.03, [0, 0.03, 0.05], acc, null, 16),
    ];
  }
  return [];
}

function weaponModel(key, rarity) {
  const acc = RARITIES[rarity] ? RARITIES[rarity].color : '#888888';
  const g = new THREE.Group();
  g.add(partsMesh(weaponParts(key, acc), 'gun_' + key + '_' + rarity));
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
  pistol: '<svg viewBox="0 0 64 64"><g fill="#fff"><rect x="8" y="18" width="44" height="9" rx="1.5"/><rect x="14" y="27" width="34" height="5"/><path d="M14 31h12l-4 20H10z"/></g><path d="M26 32q3 8 11 0" fill="none" stroke="#fff" stroke-width="2.5"/></svg>',
  smg: '<svg viewBox="0 0 64 64"><g fill="#fff"><rect x="12" y="21" width="34" height="10" rx="1"/><rect x="44" y="23" width="12" height="7" rx="2"/><rect x="55" y="25" width="7" height="3"/><path d="M28 31h6l5 18-6 1z"/><path d="M18 31h6l-2 13h-7z"/><rect x="2" y="23" width="11" height="2.5"/><rect x="2" y="23" width="3" height="11"/></g></svg>',
  ar: '<svg viewBox="0 0 64 64"><g fill="#fff"><path d="M2 25l10-2v11L2 36z"/><rect x="12" y="25" width="7" height="4"/><rect x="19" y="21" width="20" height="10"/><rect x="38" y="22" width="15" height="8" rx="1"/><rect x="53" y="24" width="9" height="3"/><rect x="22" y="16" width="10" height="4" rx="1"/><rect x="49" y="17" width="2" height="5"/><path d="M29 31h6l4 15-6 1z"/><path d="M20 31h5l-2 11h-6z"/></g></svg>',
  shotgun: '<svg viewBox="0 0 64 64"><g fill="#fff"><path d="M2 28l14-4v9L4 37z"/><rect x="16" y="23" width="14" height="10" rx="1"/><rect x="30" y="23" width="32" height="3"/><rect x="30" y="27" width="25" height="3"/><rect x="35" y="25.5" width="13" height="6" rx="2"/><path d="M14 31h5l-2 8h-5z"/></g></svg>',
  sniper: '<svg viewBox="0 0 64 64"><g fill="#fff"><path d="M2 29l20-3v8L4 38z"/><rect x="20" y="26" width="18" height="7" rx="1"/><rect x="38" y="27.5" width="22" height="2.5"/><rect x="59" y="26.5" width="4" height="4"/><rect x="21" y="18" width="19" height="5" rx="2"/><rect x="17" y="16.5" width="4" height="8" rx="1"/><rect x="40" y="16" width="4" height="9" rx="1"/><rect x="25" y="23" width="2" height="3"/><rect x="34" y="23" width="2" height="3"/><rect x="28" y="33" width="6" height="5"/></g></svg>',
  rocket: '<svg viewBox="0 0 64 64"><g fill="#fff"><path d="M2 21l7 3v10l-7 3z"/><rect x="8" y="24" width="44" height="10" rx="2"/><path d="M52 23l4 1 8 5-8 5-4 1z"/><rect x="22" y="34" width="4" height="9"/><rect x="36" y="34" width="4" height="7"/><rect x="30" y="18" width="5" height="6"/></g></svg>',
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
    if (item.kind === 'weapon') { model = weaponModel(item.key, item.rarity); model.scale.setScalar(1.4); }
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
    g.position.y = Math.max(groundHeight(pos.x, pos.z, 0.2, pos.y + 1), isWater(pos.x, pos.z) ? WATER_Y - 0.3 : -99);
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

  spawn(x, y, z, rotY = 0, blue = false) {
    const g = new THREE.Group();
    const wood = blue ? '#1f4fbf' : '#8a5a2b', trim = blue ? '#dfe7f2' : '#f2c14e';
    g.add(vcMesh([[1.0, 0.5, 0.6, 0, 0.25, 0, wood], [1.04, 0.08, 0.64, 0, 0.05, 0, trim],
      [0.08, 0.5, 0.64, -0.4, 0.25, 0, trim], [0.08, 0.5, 0.64, 0.4, 0.25, 0, trim]], blue ? 'chestBodyB' : 'chestBody'));
    const lid = new THREE.Group();
    lid.position.set(0, 0.5, -0.3);
    lid.add(vcMesh([[1.0, 0.22, 0.6, 0, 0.11, 0.3, wood], [1.04, 0.06, 0.64, 0, 0.2, 0.3, trim],
      [0.14, 0.14, 0.05, 0, 0.02, 0.62, trim]], blue ? 'chestLidB' : 'chestLid'));
    g.add(lid);
    const glow = new THREE.Mesh(cachedGeo('chestglow', () => new THREE.BoxGeometry(1.3, 1.0, 0.9)),
      colMat(blue ? '#4aa3ff' : '#ffd54a', { transparent: true, opacity: 0.18, depthWrite: false }));
    glow.position.y = 0.45;
    g.add(glow);
    let beam = null;
    if (blue) {
      // Lichtsäule bis in den Himmel, damit man die blaue Kiste von weitem sieht
      glow.scale.set(1.3, 1.5, 1.4);
      beam = new THREE.Mesh(cachedGeo('bluebeam', () => new THREE.CylinderGeometry(0.45, 0.7, 90, 12, 1, true)),
        new THREE.MeshBasicMaterial({ color: '#59b0ff', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 45;
      g.add(beam);
    }
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.scene.add(g);
    const ch = { group: g, lid, glow, beam, pos: g.position, opened: false, t: Math.random() * 5, blue };
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
    if (ch.beam) ch.group.remove(ch.beam);
    Sound.play('chest', ch.pos);
    if (ch.blue) { Sound.play('win', ch.pos); UI.announce(opener && opener.isBot ? `${opener.name} hat eine blaue Kiste geöffnet!` : 'Blaue Kiste! Super Beute!'); }
    const loot = rollChestLoot(ch.blue);
    if (opener && opener.isBot) return loot;
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ch.group.rotation.y);
    const step = Math.min(0.7, 4.2 / loot.length);
    loot.forEach((it, i) => {
      const a = (i - (loot.length - 1) / 2) * step;
      const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      GroundItems.spawn(it, ch.pos.clone().addScaledVector(dir, 1.3 + (i % 2) * 0.5).setY(ch.pos.y + 0.5));
    });
    return null;
  },

  update(dt) {
    for (const ch of this.list) {
      if (ch.opened) continue;
      ch.t += dt;
      ch.glow.material.opacity = 0.12 + Math.sin(ch.t * 3) * 0.06;
      if (ch.beam) ch.beam.material.opacity = 0.25 + Math.sin(ch.t * 2) * 0.1;
    }
  },

  clear() {
    for (const ch of this.list) { this.scene.remove(ch.group); Phys.remove(ch.col); }
    this.list = [];
  },
};
