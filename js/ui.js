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
    };
    this.buildMapBase(worldInfo);
    this.feed = [];
    this.el.feed.innerHTML = '';
    this.dirty = true;
    this.lastPrompt = undefined;
  },

  buildMapBase(info) {
    const S = 400, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const k = S / (MAP_HALF * 2);
    const X = (x) => (x + MAP_HALF) * k, Z = (z) => (z + MAP_HALF) * k;
    g.fillStyle = '#5f9a45'; g.fillRect(0, 0, S, S);
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
    g.fillStyle = '#d9cbb0'; g.strokeStyle = '#6b5a45'; g.lineWidth = 1;
    for (const b of info.buildings) { g.fillRect(X(b.x0), Z(b.z0), b.w * k, b.d * k); g.strokeRect(X(b.x0), Z(b.z0), b.w * k, b.d * k); }
    const ch = info.church;
    g.fillStyle = '#f2efe6'; g.fillRect(X(ch.x0), Z(ch.z0), ch.w * k, ch.d * k);
    g.fillStyle = '#c9a43a';
    g.fillRect(X(-0.6), Z(ch.z0 + ch.d - 6), 1.2 * k + 1, 6 * k);
    g.fillRect(X(-2.5), Z(ch.z0 + ch.d - 4.5), 5 * k, 1.2 * k + 1);
    g.fillStyle = 'rgba(30,70,30,0.55)';
    for (const p of Pieces) {
      if (p.kind === 'tree') { g.beginPath(); g.arc(X(p.center.x), Z(p.center.z), 1.6, 0, 7); g.fill(); }
    }
    g.fillStyle = 'rgba(120,120,120,0.9)';
    for (const p of Pieces) if (p.kind === 'rock') g.fillRect(X(p.center.x) - 1, Z(p.center.z) - 1, 2.5, 2.5);
    this.mapBase = c;
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
      if (item.kind === 'weapon') inner += `<span class="cnt">${item.mag}</span>`;
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
      this.el.itemName.textContent = WEAPONS[it.key].name;
      this.el.itemName.style.color = RARITIES[it.rarity].color;
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
    // Bauleiste
    this.el.build.classList.toggle('on', !!player.buildMode);
    for (const k of ['wall', 'floor', 'ramp']) {
      const e = document.querySelector(`#buildBar [data-b="${k}"]`);
      if (e) e.classList.toggle('on', player.buildMode === k);
    }
    this.el.glide.hidden = !player.gliding;
  },

  update(dt, player) {
    if (this.dirty) { this.refresh(player); this.dirty = false; }
    this.el.hpFill.style.width = player.hp + '%';
    this.el.hpNum.textContent = Math.ceil(player.hp);
    this.el.shFill.style.width = player.shield + '%';
    this.el.shNum.textContent = Math.ceil(player.shield);
    const zl = Zone.label();
    this.el.zoneText.textContent = zl.text;
    this.el.zoneTime.textContent = zl.time;
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
      e.innerHTML = `<kbd>E</kbd> <span style="color:${rc.color}">${itemName(it)}</span> <small>${rc.name}</small>`;
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
