'use strict';
// ============================================================
//  Hauptprogramm: Szene, Spielablauf, Eingaben, Schleife
// ============================================================
const Game = {
  state: 'menu',
  settings: { diff: 'normal', shadows: true, sens: 1, fov: 75 },
  diff: DIFFICULTY.normal,
  bots: [],
  noLock: false,

  init() {
    initTextures();
    const canvas = $('game');
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.camera.rotation.order = 'YXZ';
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.bindMenu();
    this.newWorld();
    // Vorschau im Menü: Kamera kreist über der Stadt
    this.menuT = 0;
    this.last = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  },

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  },

  newWorld() {
    if (this.scene) { Effects.clear(); Combat.clear(); }
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color('#9fd0f2');
    scene.fog = new THREE.Fog('#b4dbf5', 110, 470);
    // Himmel mit Farbverlauf
    const skyGeo = new THREE.SphereGeometry(900, 24, 16);
    const cols = [];
    const pos = skyGeo.attributes.position;
    const top = new THREE.Color('#4f9be0'), hor = new THREE.Color('#cfe9fb');
    for (let i = 0; i < pos.count; i++) {
      const t = clamp(pos.getY(i) / 900, 0, 1);
      const c = hor.clone().lerp(top, Math.pow(t, 0.6));
      cols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    scene.add(this.sky);
    // Licht
    scene.add(new THREE.HemisphereLight('#d6ecff', '#5b7a3a', 0.75));
    const sun = new THREE.DirectionalLight('#fff1d6', 0.9);
    sun.position.set(60, 120, 40);
    sun.castShadow = this.settings.shadows;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 320;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;
    scene.add(this.camera);

    // Welt zurücksetzen
    Phys.grid = new Map();
    Pieces.clear(); shakingPieces.clear();
    Chests.list = []; GroundItems.list = [];
    NatureMeshes.length = 0;
    Entities.length = 0;
    Effects.init(scene);
    Chests.init(scene); GroundItems.init(scene); Builds.init(scene); Combat.init(scene);
    this.info = buildWorld(scene);
    Zone.init(scene);
    this.renderer.shadowMap.enabled = this.settings.shadows;

    // Spieler
    if (this.player) this.camera.remove(this.player.viewRoot, this.player.flash);
    this.player = new Player(this.camera, scene);
    this.player.alive = false;   // erst beim Start
    UI.init(this.info);
    // Menü-Karte
    const mm = $('menuMap');
    if (mm) {
      const g = mm.getContext('2d');
      g.clearRect(0, 0, mm.width, mm.height);
      g.drawImage(drawMapBase(mm.width, this.info, true), 0, 0);
    }
  },

  start() {
    Sound.init();
    this.diff = DIFFICULTY[this.settings.diff];
    if (this.used) this.newWorld();
    this.used = true;
    const p = this.player;
    p.alive = true;
    Entities.push(p);
    const a = Math.random() * Math.PI * 2;
    p.spawn(Math.cos(a) * 150, Math.sin(a) * 150);
    // Bots verteilen
    this.bots = [];
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    let guard = 0;
    while (this.bots.length < this.diff.bots && guard++ < 2000) {
      const x = mrnd(-MAP_HALF + 10, MAP_HALF - 10), z = mrnd(-MAP_HALF + 10, MAP_HALF - 10);
      if (spotBlocked(x, z, 1.2)) continue;
      if (this.bots.some(b => b.pos.distanceTo(new THREE.Vector3(x, 0, z)) < 25)) continue;
      const b = new Bot(this.scene, names[this.bots.length % names.length], x, z);
      this.bots.push(b);
      Entities.push(b);
    }
    this.state = 'playing';
    $('menu').hidden = true; $('endScreen').hidden = true; $('pause').hidden = true;
    $('hud').hidden = false;
    UI.dirty = true;
    UI.announce('Gleite runter und lande irgendwo!');
    this.lock();
  },

  lock() {
    if (this.noLock) return;
    try {
      const r = this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => { this.noLock = true; });
    } catch (e) { this.noLock = true; }
  },

  aliveCount() { return Entities.filter(e => e.alive).length; },

  onDeath(ent, from) {
    const victim = ent.isPlayer ? '<b class="me">Du</b>' : `<b>${ent.name}</b>`;
    if (from === 'zone') this.feedMsg(`${victim} wurde vom Sturm erwischt`);
    else if (from && from.name) {
      const killer = from.isPlayer ? '<b class="me">Du</b>' : `<b>${from.name}</b>`;
      this.feedMsg(`${killer} ${from.isPlayer ? 'hast' : 'hat'} ${victim} eliminiert`);
    } else this.feedMsg(`${victim} ist ausgeschieden`);
    if (from && from.isPlayer && ent !== from) {
      from.kills++;
      UI.announce(`${ent.name} eliminiert!`);
    }
    if (ent.isPlayer) {
      Sound.play('lose');
      const place = this.aliveCount() + 1;
      this.endGame(false, place, from);
    } else if (this.player.alive && this.aliveCount() === 1) {
      Sound.play('win');
      this.endGame(true, 1);
    }
  },

  feedMsg(html) { UI.killFeed(html); },

  endGame(win, place, from) {
    this.state = 'over';
    Builds.hideGhost();
    setTimeout(() => {
      if (document.pointerLockElement) document.exitPointerLock();
      $('endTitle').textContent = win ? 'SIEG!' : 'Ausgeschieden';
      $('endTitle').className = win ? 'win' : 'lose';
      $('endPlace').textContent = '#' + place;
      $('endSub').textContent = win ? 'Du bist der letzte Überlebende!' :
        (from === 'zone' ? 'Der Sturm hat dich erwischt.' : (from && from.name ? `${from.name} hat dich erwischt.` : ''));
      $('endKills').textContent = this.player.kills;
      $('endScreen').hidden = false;
    }, win ? 600 : 1400);
  },

  // ---------- Eingaben ----------
  bindInput() {
    const prevent = new Set(['Space', 'Tab', 'KeyQ', 'KeyE', 'KeyR', 'KeyX', 'KeyC', 'KeyV', 'KeyT', 'KeyG']);
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'playing') return;
      if (prevent.has(e.code)) e.preventDefault();
      if (!e.repeat) Input.pressed[e.code] = true;
      Input.keys[e.code] = true;
      if (e.code === 'KeyM') UI.toggleMap();
    });
    window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
    window.addEventListener('blur', () => { Input.keys = {}; Input.mouseL = Input.mouseR = false; });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state === 'playing' && !this.noLock && document.pointerLockElement !== this.canvas) { this.lock(); return; }
      if (e.button === 0) Input.mouseL = true;
      if (e.button === 2) Input.mouseR = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) Input.mouseL = false;
      if (e.button === 2) Input.mouseR = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing') return;
      if (document.pointerLockElement === this.canvas || this.noLock) {
        Input.dx += clamp(e.movementX || 0, -200, 200);
        Input.dy += clamp(e.movementY || 0, -200, 200);
      }
    });
    let lastWheel = 0;
    window.addEventListener('wheel', (e) => {
      if (this.state !== 'playing' || Math.abs(e.deltaY) < 4) return;
      const now = performance.now();
      if (now - lastWheel < 110) return;   // Touchpads nicht durchrasen lassen
      lastWheel = now;
      Input.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && this.state === 'playing') this.pause();
    });
    document.addEventListener('pointerlockerror', () => {
      this.noLock = true;
      if (this.state === 'paused') this.resume();
    });
  },

  pause() {
    this.state = 'paused';
    Input.keys = {}; Input.mouseL = Input.mouseR = false;
    $('pause').hidden = false;
  },

  resume() {
    $('pause').hidden = true;
    this.state = 'playing';
    this.lock();
  },

  bindMenu() {
    buildWeaponTable();
    document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.tabs [data-tab]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      document.querySelectorAll('.tabPanel').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
    }));
    document.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => {
      this.settings.diff = b.dataset.diff;
      document.querySelectorAll('[data-diff]').forEach(x => x.classList.toggle('on', x === b));
    }));
    $('optShadows').addEventListener('change', (e) => {
      this.settings.shadows = e.target.checked;
      this.renderer.shadowMap.enabled = e.target.checked;
      this.sun.castShadow = e.target.checked;
      this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    });
    $('optSens').addEventListener('input', (e) => { this.settings.sens = parseFloat(e.target.value); });
    $('playBtn').addEventListener('click', () => this.start());
    $('againBtn').addEventListener('click', () => { $('endScreen').hidden = true; $('menu').hidden = false; $('hud').hidden = true; this.state = 'menu'; this.newWorld(); this.used = false; });
    $('pause').addEventListener('click', () => this.resume());
  },

  // ---------- Schleife ----------
  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const p = this.player;
    if (this.state === 'playing' || this.state === 'over') {
      if (this.state === 'playing') p.update(dt);
      for (const b of this.bots) b.update(dt);
      Combat.update(dt);
      Zone.update(dt);
    }
    if (this.state === 'menu') {
      this.menuT += dt * 0.05;
      this.camera.position.set(Math.cos(this.menuT) * 150, 55 + Math.sin(this.menuT * 2) * 10, Math.sin(this.menuT) * 150);
      this.camera.lookAt(Math.cos(this.menuT + 1.2) * 40, 4, Math.sin(this.menuT + 1.2) * 40);
    }
    TrafficLights.update(dt);
    if (WATER_MAT) WATER_MAT.uniforms.time.value += dt;
    Chests.update(dt);
    GroundItems.update(dt);
    updatePieceShake(dt);
    Effects.update(dt, this.camera);
    if (this.state !== 'menu') UI.update(dt, p);
    Input.pressed = {};
    // Sonne folgt der Kamera (für Schatten)
    const c = this.camera.position;
    this.sun.position.set(c.x + 60, 120, c.z + 40);
    this.sun.target.position.set(c.x, 0, c.z);
    this.sky.position.copy(c);
    this.renderer.render(this.scene, this.camera);
  },
};

window.addEventListener('load', () => {
  try { Game.init(); }
  catch (e) {
    console.error(e);
    const m = $('menuError');
    if (m) { m.hidden = false; m.textContent = 'Fehler beim Starten: ' + e.message; }
  }
});
