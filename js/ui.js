'use strict';
// ============================================================
//  Anzeige (HUD): Leben, Inventar, Minikarte, Meldungen
// ============================================================
const $ = (id) => document.getElementById(id);

const UI = {
  dirty: true,
  mapBase: null,
  mapT: 0,
  bigMap: false,
  feed: [],

  init(worldInfo) {
    this.el = {
      hpFill: $('hpFill'), hpNum: $('hpNum'), shFill: $('shFill'), shNum: $('shNum'),
      slots: $('slots'), mats: $('mats'), ammo: $('ammo'), itemName: $('itemName'),
      prompt: $('prompt'), toast: $('toast'), announce: $('announce'), hit: $('hitmarker'),
      pieceBar: $('pieceBar'), pieceFill: $('pieceFill'), useBar: $('useBar'), useFill: $('useFill'), useText: $('useText'),
      zoneText: $('zoneText'), zoneTime: $('zoneTime'), alive: $('alive'), kills: $('kills'),
      feed: $('killfeed'), map: $('minimap'), scope: $('scope'), storm: $('stormOverlay'), dmg: $('damageOverlay'),
      build: $('buildBar'), glide: $('glideHint'), cross: $('crosshair'), reload: $('reloadText'),
      statCard: $('statCard'), stamina: $('staminaBar'), staminaFill: $('staminaFill'), moveState: $('moveState'),
    };
    this.buildMapBase(worldInfo);
    this.feed = [];
    this.el.feed.innerHTML = '';
    this.dirty = true;
    this.lastPrompt = undefined;
  },

  buildMapBase(info) {
    this.mapBase = drawMapBase(400, info, false);
    this.info = info;
  },

  drawMap(player) {
    const c = this.el.map, g = c.getContext('2d'), S = c.width;
    const k = S / (MAP_HALF * 2);
    const X = (x) => (x + MAP_HALF) * k, Z = (z) => (z + MAP_HALF) * k;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.mapBase, 0, 0, S, S);
    // Sturm
    g.save();
    g.beginPath();
    g.rect(0, 0, S, S);
    g.arc(X(Zone.cur.x), Z(Zone.cur.z), Math.max(0, Zone.cur.r) * k, 0, Math.PI * 2, true);
    g.fillStyle = 'rgba(138,63,252,0.45)';
    g.fill('evenodd');
    g.restore();
    if (Zone.state !== 'done') {
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(X(Zone.next.x), Z(Zone.next.z), Zone.next.r * k, 0, Math.PI * 2); g.stroke();
      if (Zone.outside(player.pos)) {
        g.setLineDash([6, 5]);
        g.beginPath(); g.moveTo(X(player.pos.x), Z(player.pos.z)); g.lineTo(X(Zone.next.x), Z(Zone.next.z)); g.stroke();
        g.setLineDash([]);
      }
    }
    // Busroute
    if (Bus.boarding) {
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2; g.setLineDash([8, 6]);
      g.beginPath(); g.moveTo(X(Bus.start.x), Z(Bus.start.z)); g.lineTo(X(Bus.end.x), Z(Bus.end.z)); g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#2f6fd6'; g.strokeStyle = '#fff';
      g.beginPath(); g.arc(X(Bus.pos.x), Z(Bus.pos.z), 7, 0, 7); g.fill(); g.stroke();
    }
    // eigene Bauten
    g.fillStyle = '#7fd3ff';
    for (const p of Builds.occupied.values()) g.fillRect(X(p.center.x) - 1, Z(p.center.z) - 1, 2, 2);
    // Spieler-Pfeil
    g.save();
    g.translate(X(player.pos.x), Z(player.pos.z));
    g.rotate(-player.yaw);
    g.fillStyle = '#ffd43b'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  },

  toggleMap() {
    this.bigMap = !this.bigMap;
    this.el.map.classList.toggle('big', this.bigMap);
  },

  slotHTML(item, idx, selected, isPick) {
    const rc = isPick ? '#5a4fcf' : (item ? RARITIES[item.rarity || 0].color : null);
    const style = rc ? `style="--rc:${rc}"` : '';
    let inner = '';
    if (isPick) inner = ICONS.pickaxe;
    else if (item) {
      inner = itemIcon(item);
      if (item.kind === 'weapon') inner += `<span class="cnt">${item.mag}</span><span class="dmg">${weaponDamage(item)}</span>`;
      if (item.kind === 'heal') inner += `<span class="cnt">${item.count}</span>`;
    }
    return `<div class="slot${selected ? ' sel' : ''}${item || isPick ? ' full' : ''}" ${style}><span class="key">${idx}</span>${inner}</div>`;
  },

  refresh(player) {
    // Inventar
    let html = this.slotHTML(null, 1, player.sel === 0 && !player.buildMode, true);
    for (let i = 0; i < 6; i++) html += this.slotHTML(player.slots[i], i + 2, player.sel === i + 1 && !player.buildMode, false);
    this.el.slots.innerHTML = html;
    // Material
    let mh = '';
    BUILD_MATS.forEach((m, i) => {
      mh += `<div class="mat${player.buildMat === i ? ' on' : ''}" data-m="${m}"><i style="background:${MAT_INFO[m].color}"></i><b>${player.mats[m]}</b></div>`;
    });
    this.el.mats.innerHTML = mh;
    // Munition / Name
    const it = player.item;
    if (player.buildMode) {
      this.el.itemName.textContent = BUILD_TYPES[player.buildMode].name + ' bauen';
      this.el.itemName.style.color = '#7fd3ff';
      this.el.ammo.textContent = `${MAT_INFO[BUILD_MATS[player.buildMat]].name} · ${BUILD_COST} pro Teil`;
    } else if (it && it.kind === 'weapon') {
      this.el.itemName.textContent = '';
      this.el.ammo.innerHTML = `<b>${it.mag}</b> / ${player.ammo[WEAPONS[it.key].ammo]}`;
    } else if (it && it.kind === 'heal') {
      this.el.itemName.textContent = HEALS[it.key].name;
      this.el.itemName.style.color = RARITIES[it.rarity].color;
      this.el.ammo.textContent = 'Linksklick: benutzen';
    } else {
      this.el.itemName.textContent = player.sel === 0 ? 'Spitzhacke' : 'Leerer Platz';
      this.el.itemName.style.color = '#ffffff';
      this.el.ammo.textContent = player.sel === 0 ? 'Bäume, Steine & Häuser abbauen' : '';
    }
    // Werte der Waffe
    const sc = this.el.statCard;
    if (it && it.kind === 'weapon' && !player.buildMode) {
      sc.hidden = false;
      sc.style.setProperty('--rc', RARITIES[it.rarity].color);
      sc.innerHTML = statCardHTML(it);
    } else sc.hidden = true;
    // Bauleiste
    this.el.build.classList.toggle('on', !!player.buildMode);
    for (const k of ['wall', 'floor', 'ramp']) {
      const e = document.querySelector(`#buildBar [data-b="${k}"]`);
      if (e) e.classList.toggle('on', player.buildMode === k);
    }
  },

  update(dt, player) {
    if (this.dirty) { this.refresh(player); this.dirty = false; }
    this.el.hpFill.style.width = player.hp + '%';
    this.el.hpNum.textContent = Math.ceil(player.hp);
    this.el.shFill.style.width = player.shield + '%';
    this.el.shNum.textContent = Math.ceil(player.shield);
    const zl = Bus.boarding ? { text: 'Bus über der Karte', time: '0:' + String(Math.ceil(Bus.timeLeft())).padStart(2, '0') } : Zone.label();
    this.el.zoneText.textContent = zl.text;
    this.el.zoneTime.textContent = zl.time;
    // Hinweis für Bus, freien Fall und Gleiter
    const gh = !player.alive ? '' : player.inBus ? 'Im Bus · <kbd>Leertaste</kbd> abspringen'
      : player.gliding ? (player.freefall ? 'Freier Fall · <kbd>Leertaste</kbd> Gleiter öffnen' : 'Gleiter offen · lenken mit <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>') : '';
    if (gh !== this.lastGh) { this.lastGh = gh; this.el.glide.hidden = !gh; this.el.glide.innerHTML = gh; }
    this.el.alive.textContent = Game.aliveCount();
    this.el.kills.textContent = player.kills;
    // Heilbalken
    if (player.using) {
      this.el.useBar.hidden = false;
      this.el.useFill.style.width = (player.using.t / player.using.max * 100) + '%';
      this.el.useText.textContent = HEALS[player.using.item.key].name + ' ' + Math.max(0, player.using.max - player.using.t).toFixed(1) + 's';
    } else if (player.reloading) {
      this.el.useBar.hidden = false;
      this.el.useFill.style.width = ((1 - player.reloadT / player.reloadMax) * 100) + '%';
      this.el.useText.textContent = 'Nachladen…';
    } else this.el.useBar.hidden = true;
    // Bauteil-Lebensbalken
    if (this.pieceT > 0) {
      this.pieceT -= dt;
      const p = this.piece;
      this.el.pieceBar.hidden = !p || !p.alive || this.pieceT <= 0;
      if (p) this.el.pieceFill.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    }
    // Kletter-Kraft und Bewegungsart
    this.el.stamina.hidden = player.stamina >= 0.999 || !player.alive;
    this.el.staminaFill.style.width = (player.stamina * 100) + '%';
    const ms = player.swimming ? 'Schwimmen' : player.climbing || player.mantleT > 0 ? 'Klettern' : player.slideT > 0 ? 'Rutschen' : player.crouching ? 'Schleichen' : '';
    if (ms !== this.lastMs) { this.lastMs = ms; this.el.moveState.hidden = !ms; this.el.moveState.textContent = ms; }
    // Sturm-Overlay
    this.el.storm.style.opacity = Zone.isOutside(player.pos) && player.alive ? 1 : 0;
    // Fadenkreuz-Spreizung
    const it = player.item;
    let spread = 6;
    if (it && it.kind === 'weapon') spread = 6 + (WEAPONS[it.key].spread * 300 + player.bloom * 500) * (player.aim > 0.5 ? 0.5 : 1);
    this.el.cross.style.setProperty('--s', spread.toFixed(1) + 'px');
    // Minikarte
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.1; this.drawMap(player); }
    // Killfeed
    const now = performance.now();
    let changed = false;
    while (this.feed.length && now - this.feed[0].t > 7000) { this.feed.shift(); changed = true; }
    if (changed) this.renderFeed();
  },

  setPrompt(target) {
    const e = this.el.prompt;
    const key = target ? target.obj : null;
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    if (!target) { e.hidden = true; return; }
    e.hidden = false;
    if (target.type === 'chest') e.innerHTML = '<kbd>E</kbd> Kiste öffnen';
    else {
      const it = target.obj.item;
      const rc = RARITIES[it.rarity || 0];
      let extra = '';
      if (it.kind === 'weapon') {
        const st = weaponStats(it);
        // Vergleich mit der gleichen Waffe im Inventar (falls vorhanden)
        const same = Game.player && Game.player.slots.find(x => x && x.kind === 'weapon' && x.key === it.key);
        let cmp = '';
        if (same) {
          const diff = st.dmg - weaponDamage(same);
          if (diff) cmp = ` <span class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲ +' : '▼ '}${diff}</span>`;
        }
        extra = `<div class="pline"><span>Schaden <b>${st.dmgText}</b>${cmp}</span><span>Kopf <b>${st.head}</b></span><span>Magazin <b>${st.mag}</b></span></div>`;
      } else if (it.kind === 'heal') {
        const h = HEALS[it.key];
        extra = `<div class="pline"><span>${h.hp ? '+' + h.hp + ' Leben' : '+' + h.shield + ' Schild'}</span><span>${h.time}s</span></div>`;
      }
      e.innerHTML = `<div class="pcard"><span><kbd>E</kbd> <span style="color:${rc.color}">${itemName(it)}</span> <small>${rc.name}</small></span>${extra}</div>`;
    }
  },

  toast(msg) {
    const e = this.el.toast;
    e.textContent = msg;
    e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
  },

  announce(msg) {
    const e = this.el.announce;
    e.textContent = msg;
    e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
  },

  hitMarker(head, kill) {
    const e = this.el.hit;
    e.className = '';
    void e.offsetWidth;
    e.className = 'show' + (head ? ' head' : '') + (kill ? ' kill' : '');
  },

  pieceHit(piece) {
    this.piece = piece; this.pieceT = 1.5;
    this.el.pieceBar.hidden = false;
  },

  matGain(m) {
    const e = document.querySelector(`#mats [data-m="${m}"]`);
    if (e) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
  },

  damageFlash(from) {
    const e = this.el.dmg;
    e.classList.remove('show'); void e.offsetWidth; e.classList.add('show');
    e.style.setProperty('--c', from === 'zone' ? 'rgba(138,63,252,0.55)' : 'rgba(220,20,20,0.55)');
  },

  setScope(on) { this.el.scope.hidden = !on; },

  killFeed(html) {
    this.feed.push({ html, t: performance.now() });
    if (this.feed.length > 5) this.feed.shift();
    this.renderFeed();
  },

  renderFeed() {
    this.el.feed.innerHTML = this.feed.map(f => `<div>${f.html}</div>`).join('');
  },
};

// ---------- Werte-Karte einer Waffe ----------
const STAT_MAX = { dmg: 130, dps: 220, mag: 30, rate: 12 };
function statCardHTML(it) {
  const st = weaponStats(it), r = RARITIES[it.rarity];
  const row = (label, val, frac) => `<div class="stat"><small>${label}<b>${val}</b></small><div class="meter"><i style="width:${Math.round(clamp(frac, 0.04, 1) * 100)}%"></i></div></div>`;
  return `<div class="sc-head"><b>${WEAPONS[it.key].name}</b><span>${r.name}</span></div>
    <div class="statGrid">
      ${row('Schaden', st.dmgText, st.dmg / STAT_MAX.dmg)}
      ${row('Kopfschuss', st.head, st.head / (STAT_MAX.dmg * 2.5))}
      ${row('Schaden/Sek.', st.dps, st.dps / STAT_MAX.dps)}
      ${row('Magazin', st.mag, st.mag / STAT_MAX.mag)}
    </div>`;
}

// ---------- Kartenbild (Minikarte und Menü) ----------
function drawMapBase(S, info, labels) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const k = S / (MAP_HALF * 2);
  const X = (x) => (x + MAP_HALF) * k, Z = (z) => (z + MAP_HALF) * k;
  g.fillStyle = '#5f9a45'; g.fillRect(0, 0, S, S);
  // Wasser: erst Sandufer, dann Wasser
  const river = () => { g.beginPath(); RIVER.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#d9c48d'; g.lineWidth = (RIVER_W + 6) * k; river(); g.stroke();
  for (const L of LAKES) { g.fillStyle = '#d9c48d'; g.beginPath(); g.arc(X(L.x), Z(L.z), (L.r + 2.5) * k, 0, 7); g.fill(); }
  g.strokeStyle = '#3d8fd1'; g.lineWidth = (RIVER_W + 1) * k; river(); g.stroke();
  for (const L of LAKES) {
    g.fillStyle = '#3d8fd1'; g.beginPath(); g.arc(X(L.x), Z(L.z), (L.r + 0.5) * k, 0, 7); g.fill();
    if (L.island) {
      g.fillStyle = '#d9c48d'; g.beginPath(); g.arc(X(L.x), Z(L.z), (L.island - 0.5) * k, 0, 7); g.fill();
      g.fillStyle = '#5f9a45'; g.beginPath(); g.arc(X(L.x), Z(L.z), (L.island - 2.5) * k, 0, 7); g.fill();
    }
  }
  // Stadt
  g.fillStyle = '#bdb8ad'; g.fillRect(X(-CITY_HALF), Z(-CITY_HALF), CITY_HALF * 2 * k, CITY_HALF * 2 * k);
  g.fillStyle = '#6aa84f';
  for (const b of info.blocks) {
    if (b.x0 < 0 && b.x1 > 0 && b.z0 < 0 && b.z1 > 0) continue;
    g.fillRect(X(b.x0 + 3), Z(b.z0 + 3), (b.x1 - b.x0 - 6) * k, (b.z1 - b.z0 - 6) * k);
  }
  g.fillStyle = '#444a52';
  for (const r of ROADS) {
    g.fillRect(X(-CITY_HALF), Z(r - ROAD_W / 2), CITY_HALF * 2 * k, ROAD_W * k);
    g.fillRect(X(r - ROAD_W / 2), Z(-CITY_HALF), ROAD_W * k, CITY_HALF * 2 * k);
  }
  for (const r of OUTER_ROADS) {
    if (r.axis === 'x') g.fillRect(X(r.a), Z(r.c - ROAD_W / 2), (r.b - r.a) * k, ROAD_W * k);
    else g.fillRect(X(r.c - ROAD_W / 2), Z(r.a), ROAD_W * k, (r.b - r.a) * k);
  }
  g.fillStyle = '#8a5a2b';
  for (const br of BRIDGES) g.fillRect(X(br.x0), Z(br.z - br.width / 2), (br.x1 - br.x0) * k, Math.max(2, br.width * k));
  const isle = LAKES.find(l => l.island);
  g.fillRect(X(isle.x - 1.3), Z(isle.z + isle.r - 16), 2.6 * k + 1, 19 * k);
  g.fillRect(X(isle.x - 1.3), Z(isle.z + 7.5), 2.6 * k + 1, 6.5 * k);
  g.fillStyle = '#d9cbb0'; g.strokeStyle = '#6b5a45'; g.lineWidth = 1;
  for (const b of info.buildings.concat(info.hut ? [info.hut] : [])) { g.fillRect(X(b.x0), Z(b.z0), b.w * k, b.d * k); g.strokeRect(X(b.x0), Z(b.z0), b.w * k, b.d * k); }
  const ch = info.church;
  g.fillStyle = '#f2efe6'; g.fillRect(X(ch.x0), Z(ch.z0), ch.w * k, ch.d * k);
  g.fillStyle = '#c9a43a';
  g.fillRect(X(-0.6), Z(ch.z0 + ch.d - 6), 1.2 * k + 1, 6 * k);
  g.fillRect(X(-2.5), Z(ch.z0 + ch.d - 4.5), 5 * k, 1.2 * k + 1);
  // Bäume und Steine
  g.fillStyle = 'rgba(30,70,30,0.55)';
  for (const p of Pieces) if (p.kind === 'tree') { g.beginPath(); g.arc(X(p.center.x), Z(p.center.z), Math.max(1.2, 2 * k), 0, 7); g.fill(); }
  g.fillStyle = 'rgba(120,120,120,0.9)';
  for (const p of Pieces) if (p.kind === 'rock') g.fillRect(X(p.center.x) - 1, Z(p.center.z) - 1, 2.5, 2.5);
  if (labels) {
    g.fillStyle = '#4aa3ff'; g.strokeStyle = '#0b2a5c'; g.lineWidth = 2;
    g.beginPath(); g.arc(X(isle.x), Z(isle.z), 6, 0, 7); g.fill(); g.stroke();
    g.font = `800 ${Math.round(S / 30)}px Nunito, sans-serif`; g.textAlign = 'center';
    const label = (t, x, z) => { g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.strokeText(t, X(x), Z(z)); g.fillStyle = '#fff'; g.fillText(t, X(x), Z(z)); };
    label('Stadt', 0, -CITY_HALF - 8);
    label('Kirche', 0, 26);
    for (const L of LAKES) label(L.island ? 'Insel' : L.name, L.x, L.island ? L.z - 18 : L.z + 5);
    label('Inselsee', isle.x, isle.z + isle.r + 22);
    label('Fluss', riverXAt(-260) + 26, -260);
  }
  return c;
}

// ---------- Waffentabelle fürs Menü ----------
function buildWeaponTable() {
  const t = document.getElementById('weaponTable');
  if (!t) return;
  let h = '<thead><tr><th>Waffe</th>' + RARITIES.map(r => `<th title="${r.name}"><span class="chip" style="background:${r.color}">${r.name.slice(0, 3)}</span></th>`).join('') + '<th>Magazin</th></tr></thead><tbody>';
  for (const key of Object.keys(WEAPONS)) {
    const w = WEAPONS[key];
    h += `<tr><td><div class="wname">${ICONS[key]}<span>${w.name}<small>${AMMO[w.ammo].name}</small></span></div></td>`;
    RARITIES.forEach((r, i) => { h += `<td><span class="chip" style="background:${r.color}">${weaponStats(makeWeapon(key, i)).dmgText}</span></td>`; });
    h += `<td>${w.mag}</td></tr>`;
  }
  t.innerHTML = h + '</tbody>';
}
