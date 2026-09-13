/* =====================================================================
   FREIGHT — load the train as it lumbers by. How long can you build it?
   Vanilla JS, no build step. Everything lives in this file.
   ===================================================================== */
'use strict';

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
const COMMODITIES = [
  { id: 'coffee',      name: 'Coffee',      emoji: '☕' },
  { id: 'wheat',       name: 'Wheat',       emoji: '🌾' },
  { id: 'onions',      name: 'Onions',      emoji: '🧅' },
  { id: 'wood',        name: 'Wood',        emoji: '🪵' },
  { id: 'mushrooms',   name: 'Mushrooms',   emoji: '🍄' },
  { id: 'watermelons', name: 'Watermelons', emoji: '🍉' },
  { id: 'corn',        name: 'Corn',        emoji: '🌽' },
  { id: 'milk',        name: 'Milk',        emoji: '🥛' },
  { id: 'coal',        name: 'Coal',        emoji: '🪨' },
  { id: 'apples',      name: 'Apples',      emoji: '🍎' },
  { id: 'fish',        name: 'Fish',        emoji: '🐟' },
  { id: 'cheese',      name: 'Cheese',      emoji: '🧀' },
  { id: 'pumpkins',    name: 'Pumpkins',    emoji: '🎃' },
  { id: 'honey',       name: 'Honey',       emoji: '🍯' },
];
const BY_ID = Object.fromEntries(COMMODITIES.map(c => [c.id, c]));

const TOWNS = ['Omaha', 'Cheyenne', 'Denver', 'Ogden', 'Reno', 'Sacramento', 'Chicago', 'St. Louis',
  'Kansas City', 'Topeka', 'Santa Fe', 'El Paso', 'Duluth', 'Fargo', 'Billings', 'Spokane', 'Portland',
  'Boise', 'Tucson', 'Pittsburgh', 'Buffalo', 'Albany', 'Nashville', 'Memphis', 'Atlanta', 'Savannah',
  'Charleston', 'Raleigh', 'Richmond', 'Baltimore', 'Abilene', 'Laramie', 'Dodge City', 'Tulsa'];

const RULE_PHRASES = [
  (a, b) => `${a} can't ride next to ${b}`,
  (a, b) => `Keep ${a} away from ${b}`,
  (a, b) => `${a} and ${b} don't couple`,
  (a, b) => `No ${a} beside ${b}, dispatcher's orders`,
  (a, b) => `${a} refuses to sit next to ${b}`,
];

const CAR_COLORS = ['#d9534f', '#e8a33d', '#3a86ff', '#2a9d8f', '#8e5cff', '#c95d9a', '#6b8e23', '#b5651d', '#4f7cac'];

/* Tuning ------------------------------------------------------------ */
const CFG = {
  carW: 104, gap: 14, locoW: 150,
  baseSpeed: 34,        // px/s at the start — a slow lumbering pull-out
  accelTime: 0.62,      // extra px/s per second survived
  accelCars: 2.3,       // extra px/s per car loaded
  hearts: 3,
  startPool: 8,         // commodities in play at the start
  ruleAt: [2, 6, 11, 17, 24, 32, 41, 51, 62],  // cars loaded when a new rule drops
  presetStart: 4,       // pre-loaded cars begin after this many cars
  presetChance: (loaded) => Math.min(0.38, 0.10 + loaded * 0.007),
  weeklyEvery: 5,
};
CFG.pitch = CFG.carW + CFG.gap;

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */
const $ = (sel) => document.querySelector(sel);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const mph = (v) => Math.round(v * 0.28);

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function prevWeekKey(key) {
  const [y, w] = key.split('-W').map(Number);
  // Jan 4 is always in week 1
  const d = new Date(y, 0, 4);
  d.setDate(d.getDate() + (w - 1) * 7 - 7);
  return isoWeek(d);
}
function weekLabel(key) {
  const [y, w] = key.split('-W').map(Number);
  const d = new Date(y, 0, 4);
  d.setDate(d.getDate() + (w - 1) * 7);
  const s = weekStart(d);
  return 'Week of ' + s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function routeName() {
  const a = pick(TOWNS);
  let b = pick(TOWNS);
  while (b === a) b = pick(TOWNS);
  return `${a} → ${b}`;
}

/* ------------------------------------------------------------------ */
/* Storage — the route ledger                                          */
/* ------------------------------------------------------------------ */
const STORE_KEY = 'freight.ledger.v1';
const DB = {
  data: { v: 1, muted: false, runs: [], sinceDispatch: 0 },
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* private mode etc. */ }
  },
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
  addRun(run) {
    this.data.runs.push(run);
    this.data.sinceDispatch = (this.data.sinceDispatch || 0) + 1;
    this.save();
  },
  best() {
    return this.data.runs.reduce((m, r) => (r.cars > (m ? m.cars : -1) ? r : m), null);
  },
  weekStats(key) {
    const runs = this.data.runs.filter(r => r.week === key);
    const s = { key, games: runs.length, cars: 0, moved: 0, seconds: 0, longest: 0, topSpeed: 0, manifest: {} };
    for (const r of runs) {
      s.cars += r.cars; s.moved += r.moved; s.seconds += r.seconds;
      s.longest = Math.max(s.longest, r.cars); s.topSpeed = Math.max(s.topSpeed, r.topSpeed);
      for (const [k, v] of Object.entries(r.manifest || {})) s.manifest[k] = (s.manifest[k] || 0) + v;
    }
    return s;
  },
  weeks() {
    const keys = [...new Set(this.data.runs.map(r => r.week))];
    keys.sort().reverse();
    return keys;
  },
  clear() { this.data.runs = []; this.data.sinceDispatch = 0; this.save(); },
};

/* ------------------------------------------------------------------ */
/* Sound — tiny WebAudio blips, no assets                              */
/* ------------------------------------------------------------------ */
const Sound = {
  ctx: null,
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  },
  tone(freq, dur, type = 'square', vol = 0.12, slide = 0) {
    if (DB.data.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  thunk() { this.tone(160, 0.12, 'triangle', 0.25, -90); this.tone(90, 0.18, 'sine', 0.3, -50); },
  buzz() { this.tone(110, 0.28, 'sawtooth', 0.15, -40); },
  ding() { this.tone(880, 0.25, 'sine', 0.15); setTimeout(() => this.tone(1320, 0.35, 'sine', 0.12), 90); },
  whistle() { this.tone(660, 0.5, 'square', 0.08, 120); setTimeout(() => this.tone(880, 0.6, 'square', 0.07, 60), 120); },
  clack() { this.tone(200, 0.04, 'square', 0.04, -100); },
  crash() { this.tone(80, 0.8, 'sawtooth', 0.25, -60); this.tone(50, 1.0, 'square', 0.2, -30); },
  pickup() { this.tone(520, 0.08, 'sine', 0.08, 200); },
};

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}
function openModal(id) { $('#' + id).classList.add('active'); }
function closeModal(id) { $('#' + id).classList.remove('active'); }

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */
const G = {
  running: false, over: false,
  t: 0, v: 0, topV: 0, headX: 0, lastFrame: 0,
  cars: [], nextIdx: 0,
  hearts: 3, loaded: 0, moved: 0, presets: 0, strikes: 0,
  rules: [], pool: [], tray: [null, null, null, null],
  manifest: {}, route: '',
  yardW: 0, tieOffset: 0, wheelAngle: 0, puffTimer: 0,
  raf: 0, toastTimer: 0, ruleToastTimer: 0,
};

const el = {};
function cacheEls() {
  ['hud-cars', 'hud-time', 'hud-speed', 'hearts', 'rules-chips', 'yard', 'train', 'tray-top', 'tray-bottom',
    'drag-ghost', 'toast', 'rule-toast', 'countdown', 'title-best', 'btn-mute'].forEach(id => { el[id] = $('#' + id); });
  el.ties = document.querySelector('#track .ties');
}

/* ----- speed curve ----- */
function speedNow() {
  return CFG.baseSpeed + G.t * CFG.accelTime + G.loaded * CFG.accelCars;
}

/* ----- rules ----- */
function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
function isBanned(a, b) {
  if (!a || !b) return null;
  const k = pairKey(a, b);
  return G.rules.find(r => r.key === k) || null;
}
function addRule() {
  // Pick a pair from the pool that isn't already banned. Prefer commodities already on screen so it bites.
  const ids = G.pool.slice();
  for (let tries = 0; tries < 60; tries++) {
    const a = pick(ids); const b = pick(ids);
    if (a === b || isBanned(a, b)) continue;
    const rule = { key: pairKey(a, b), a, b, text: pick(RULE_PHRASES)(BY_ID[a].name, BY_ID[b].name) };
    G.rules.push(rule);
    renderRules(rule);
    showRuleToast(rule);
    Sound.ding();
    return;
  }
}
function renderRules(newRule) {
  const c = el['rules-chips'];
  c.innerHTML = '';
  if (!G.rules.length) { c.innerHTML = '<span class="rules-none">none yet… enjoy it</span>'; return; }
  for (const r of G.rules) {
    const chip = document.createElement('span');
    chip.className = 'chip' + (r === newRule ? ' new' : '');
    chip.dataset.key = r.key;
    chip.title = r.text;
    chip.innerHTML = `${BY_ID[r.a].emoji}<span class="x">✕</span>${BY_ID[r.b].emoji}`;
    c.appendChild(chip);
    if (r === newRule) setTimeout(() => chip.classList.remove('new'), 2800);
  }
}
function flashRuleChip(rule) {
  const chip = el['rules-chips'].querySelector(`[data-key="${rule.key}"]`);
  if (!chip) return;
  chip.classList.remove('hot'); void chip.offsetWidth; chip.classList.add('hot');
  setTimeout(() => chip.classList.remove('hot'), 600);
}

/* ----- legality ----- */
function neighborsOf(car) {
  const prev = G.cars.find(c => c.i === car.i - 1);
  const next = G.cars.find(c => c.i === car.i + 1);
  return [prev, next].filter(c => c && !c.isLoco && c.cargo).map(c => c.cargo);
}
function violation(car, cargoId) {
  for (const n of neighborsOf(car)) {
    const r = isBanned(n, cargoId);
    if (r) return r;
  }
  return null;
}
function legalFor(car) {
  return G.pool.filter(id => !violation(car, id));
}
function frontEmptyCar() {
  // The empty car closest to leaving the yard (smallest x still on screen-ish).
  const empties = G.cars.filter(c => !c.isLoco && !c.cargo && !c.retired).sort((a, b) => a.i - b.i);
  return empties[0] || null;
}

/* ----- tray ----- */
function fillTray(slot, forceLegal) {
  // Prefer something not already in the hand, so the tray stays interesting.
  const others = G.tray.filter((t, i) => i !== slot && t);
  const fresh = G.pool.filter(id => !others.includes(id));
  let id = pick(fresh.length ? fresh : G.pool);
  if (forceLegal) {
    const target = frontEmptyCar();
    if (target) {
      const legal = legalFor(target);
      const trayHasLegal = G.tray.some((t, i) => i !== slot && t && legal.includes(t));
      if (!trayHasLegal && legal.length) id = pick(legal);
    }
  }
  G.tray[slot] = id;
  renderCrate(slot, true);
}
function crateEl(slot) {
  const tray = slot < 2 ? el['tray-top'] : el['tray-bottom'];
  return tray.children[slot % 2];
}
function renderCrate(slot, fresh) {
  const c = crateEl(slot);
  const com = BY_ID[G.tray[slot]];
  c.dataset.slot = slot;
  c.dataset.id = com.id;
  c.innerHTML = `${com.emoji}<small>${com.name}</small>`;
  c.classList.remove('dragging', 'selected', 'fresh');
  if (fresh) { void c.offsetWidth; c.classList.add('fresh'); }
}
function buildTray() {
  el['tray-top'].innerHTML = ''; el['tray-bottom'].innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('div');
    c.className = 'crate';
    (i < 2 ? el['tray-top'] : el['tray-bottom']).appendChild(c);
  }
  G.tray = [null, null, null, null];
  for (let i = 0; i < 4; i++) fillTray(i, false);
}

/* ----- cars ----- */
function makeCar(i) {
  const car = { i, x: 0, cargo: null, preset: false, retired: false, isLoco: i === 0, el: null, missed: false };
  const d = document.createElement('div');
  if (car.isLoco) {
    d.className = 'car loco';
    d.innerHTML = `<div class="cab"></div><div class="boiler"></div><div class="dome"></div><div class="stack"></div><div class="cowcatcher"></div>
      <div class="wheel big w1"></div><div class="wheel big w2"></div><div class="wheel big w3"></div><div class="wheel big w4"></div>`;
  } else {
    d.className = 'car empty';
    d.style.setProperty('--car-color', pick(CAR_COLORS));
    d.innerHTML = `<div class="car-body"><div class="car-slot"></div></div><div class="wheel w1"></div><div class="wheel w2"></div>`;
    // Pre-loaded cars roll in from the yard already full.
    if (G.loaded >= CFG.presetStart && Math.random() < CFG.presetChance(G.loaded)) {
      car.preset = true;
    }
  }
  car.el = d;
  el.train.appendChild(d);
  G.cars.push(car);
  if (car.preset) {
    // Choose a cargo that's legal against the car in front of it (i-1), which already exists.
    const legal = legalFor(car);
    const id = legal.length ? pick(legal) : pick(G.pool);
    loadCar(car, id, true);
  }
  return car;
}
function loadCar(car, id, preset) {
  car.cargo = id;
  car.el.classList.remove('empty', 'target');
  car.el.classList.add('loaded');
  if (preset) car.el.classList.add('preset');
  car.el.querySelector('.car-slot').textContent = BY_ID[id].emoji;
  G.loaded++;
  G.manifest[id] = (G.manifest[id] || 0) + 1;
  if (preset) G.presets++;
  else {
    G.moved++;
    car.el.classList.add('just-loaded');
    setTimeout(() => car.el.classList.remove('just-loaded'), 450);
  }
  el['hud-cars'].textContent = G.loaded;
  // Rules + pool growth are keyed to how long the train is.
  const ruleIdx = G.rules.length;
  if (ruleIdx < CFG.ruleAt.length && G.loaded >= CFG.ruleAt[ruleIdx]) {
    growPool();
    addRule();
  }
}
function growPool() {
  const rest = COMMODITIES.map(c => c.id).filter(id => !G.pool.includes(id));
  if (rest.length) G.pool.push(pick(rest));
}
function carX(i) { return G.headX + i * CFG.pitch + (i > 0 ? CFG.locoW - CFG.carW : 0); }

function placeCars() {
  for (const c of G.cars) {
    c.x = carX(c.i);
    c.el.style.setProperty('--tx', `translateX(${c.x}px)`);
    c.el.style.transform = `translateX(${c.x}px)`;
  }
}
function spawnAndRetire() {
  // spawn until the newest car is off the right edge
  while (carX(G.nextIdx) < G.yardW + CFG.pitch) { makeCar(G.nextIdx); G.nextIdx++; }
  // retire cars that have fully left to the left
  for (const c of G.cars) {
    const w = c.isLoco ? CFG.locoW : CFG.carW;
    if (!c.retired && c.x + w < -10) {
      c.retired = true;
      if (!c.isLoco && !c.cargo) {
        c.missed = true;
        c.el.classList.add('missed');
        strike(`Empty car left the yard!`);
      }
    }
  }
  // clean up DOM for cars long gone
  G.cars = G.cars.filter(c => {
    if (c.retired && c.x < -CFG.pitch * 3) { c.el.remove(); return false; }
    return true;
  });
}

/* ----- strikes / toasts ----- */
function strike(msg) {
  if (G.over) return;
  G.hearts--; G.strikes++;
  renderHearts(true);
  Sound.buzz();
  toast(msg, 'bad');
  el.yard.classList.remove('shake'); void el.yard.offsetWidth; el.yard.classList.add('shake');
  if (G.hearts <= 0) gameOver();
}
function renderHearts(pop) {
  const h = el.hearts;
  h.innerHTML = '';
  for (let i = 0; i < CFG.hearts; i++) {
    const s = document.createElement('span');
    s.textContent = '❤️';
    if (i >= G.hearts) s.classList.add('lost');
    if (pop && i === G.hearts) s.classList.add('pop');
    h.appendChild(s);
  }
}
function toast(msg, kind) {
  const t = el.toast;
  t.textContent = msg;
  t.className = 'toast on ' + (kind || '');
  clearTimeout(G.toastTimer);
  G.toastTimer = setTimeout(() => t.classList.remove('on'), 1300);
}
function showRuleToast(rule) {
  const t = el['rule-toast'];
  t.querySelector('.rule-toast-text').innerHTML = `${BY_ID[rule.a].emoji} ${rule.text} ${BY_ID[rule.b].emoji}`;
  t.classList.add('on');
  clearTimeout(G.ruleToastTimer);
  G.ruleToastTimer = setTimeout(() => t.classList.remove('on'), 2800);
}

/* ----- lifecycle ----- */
function resetGame() {
  cancelAnimationFrame(G.raf);
  G.running = false; G.over = false;
  G.t = 0; G.topV = 0; G.loaded = 0; G.moved = 0; G.presets = 0; G.strikes = 0;
  G.hearts = CFG.hearts; G.rules = []; G.manifest = {};
  G.cars = []; G.nextIdx = 0;
  G.route = routeName();
  G.pool = COMMODITIES.slice(0, CFG.startPool).map(c => c.id);
  el.train.innerHTML = ''; el.train.classList.remove('derail');
  el['hud-cars'].textContent = '0';
  el['hud-time'].textContent = '0:00';
  el['hud-speed'].textContent = mph(CFG.baseSpeed);
  renderHearts(false);
  renderRules();
  el['tray-top'].classList.remove('disabled'); el['tray-bottom'].classList.remove('disabled');
  el['rule-toast'].classList.remove('on');
  el.toast.classList.remove('on');
}
function startGame() {
  resetGame();
  showScreen('screen-game');
  G.yardW = el.yard.clientWidth || window.innerWidth;
  G.headX = G.yardW + 20;             // the loco rolls in from the right
  buildTray();
  spawnAndRetire(); placeCars();
  Sound.ensure();
  // 3-2-1-GO countdown, then roll
  const cd = el.countdown;
  const steps = ['3', '2', '1', 'GO!'];
  let k = 0;
  const tick = () => {
    cd.textContent = steps[k];
    cd.classList.remove('on'); void cd.offsetWidth; cd.classList.add('on');
    Sound.clack();
    k++;
    if (k < steps.length) setTimeout(tick, 650);
    else {
      setTimeout(() => cd.classList.remove('on'), 500);
      Sound.whistle();
      G.running = true;
      G.lastFrame = performance.now();
      G.raf = requestAnimationFrame(frame);
    }
  };
  tick();
}
function frame(now) {
  if (!G.running) return;
  const dt = clamp((now - G.lastFrame) / 1000, 0, 0.05);
  G.lastFrame = now;
  G.t += dt;
  G.v = speedNow();
  G.topV = Math.max(G.topV, G.v);
  G.headX -= G.v * dt;

  spawnAndRetire();
  if (!G.running) return;
  placeCars();

  // scenery: ties scroll, wheels spin, loco puffs
  G.tieOffset = (G.tieOffset - G.v * dt) % 32;
  el.ties.style.backgroundPositionX = `${G.tieOffset}px`;
  G.wheelAngle += (G.v * dt / 18) * 57.3;
  const rot = `rotate(${G.wheelAngle}deg)`;
  for (const c of G.cars) for (const w of c.el.querySelectorAll('.wheel')) w.style.transform = rot;
  G.puffTimer -= dt;
  if (G.puffTimer <= 0) {
    G.puffTimer = clamp(1.1 - G.v / 300, 0.18, 1.1);
    const loco = G.cars.find(c => c.isLoco);
    if (loco && loco.x > -CFG.locoW && loco.x < G.yardW) {
      const p = document.createElement('div');
      p.className = 'puff';
      p.style.left = `${loco.x + CFG.locoW - 34}px`;
      p.style.top = '-20px';
      el.train.appendChild(p);
      setTimeout(() => p.remove(), 1700);
    }
  }

  // HUD
  el['hud-time'].textContent = fmtTime(G.t);
  el['hud-speed'].textContent = mph(G.v);

  G.raf = requestAnimationFrame(frame);
}
function gameOver() {
  G.over = true; G.running = false;
  cancelAnimationFrame(G.raf);
  Drag.cancel();
  Sound.crash();
  el.train.classList.add('derail');
  el['tray-top'].classList.add('disabled'); el['tray-bottom'].classList.add('disabled');
  el.yard.classList.remove('shake'); void el.yard.offsetWidth; el.yard.classList.add('shake');

  const run = {
    id: Date.now().toString(36),
    ts: Date.now(),
    week: isoWeek(new Date()),
    route: G.route,
    cars: G.loaded,
    moved: G.moved,
    presets: G.presets,
    seconds: Math.round(G.t),
    topSpeed: mph(G.topV),
    rules: G.rules.length,
    manifest: G.manifest,
  };
  const prevBest = DB.best();
  DB.addRun(run);
  setTimeout(() => showGameOver(run, prevBest), 1300);
}

/* ------------------------------------------------------------------ */
/* Drag & drop (pointer events; also tap-to-select, tap-to-place)      */
/* ------------------------------------------------------------------ */
const Drag = {
  active: null, // { slot, id, startX, startY, moved, pointerId }
  selected: null,
  init() {
    const trays = [el['tray-top'], el['tray-bottom']];
    for (const t of trays) {
      t.addEventListener('pointerdown', (e) => {
        const crate = e.target.closest('.crate');
        if (!crate || !G.running || Drag.active) return;
        e.preventDefault();
        Sound.ensure();
        const slot = +crate.dataset.slot;
        Drag.active = { slot, id: G.tray[slot], startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
        crate.setPointerCapture?.(e.pointerId);
        Sound.pickup();
      });
    }
    window.addEventListener('pointermove', (e) => Drag.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => Drag.up(e));
    window.addEventListener('pointercancel', () => Drag.cancel());
    // tap a car with a selected crate
    el.train.addEventListener('pointerdown', (e) => {
      if (!Drag.selected || Drag.active || !G.running) return;
      const carEl = e.target.closest('.car');
      const car = G.cars.find(c => c.el === carEl);
      if (car && !car.isLoco && !car.cargo) {
        const slot = Drag.selected;
        Drag.clearSelection();
        Drag.tryDrop(car, slot);
      }
    });
  },
  move(e) {
    const a = Drag.active;
    if (!a) return;
    const dx = e.clientX - a.startX, dy = e.clientY - a.startY;
    if (!a.moved && Math.hypot(dx, dy) > 8) {
      a.moved = true;
      Drag.clearSelection();
      crateEl(a.slot).classList.add('dragging');
      const g = el['drag-ghost'];
      g.textContent = BY_ID[a.id].emoji;
      g.classList.remove('return');
      g.classList.add('on');
    }
    if (a.moved) {
      e.preventDefault();
      const g = el['drag-ghost'];
      g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
      const car = Drag.carAt(e.clientX, e.clientY);
      for (const c of G.cars) c.el.classList.toggle('target', c === car);
    }
  },
  up(e) {
    const a = Drag.active;
    if (!a) return;
    Drag.active = null;
    for (const c of G.cars) c.el.classList.remove('target');
    if (!a.moved) {
      // tap: toggle selection
      if (Drag.selected === a.slot) Drag.clearSelection();
      else { Drag.clearSelection(); Drag.selected = a.slot; crateEl(a.slot).classList.add('selected'); }
      return;
    }
    crateEl(a.slot).classList.remove('dragging');
    const car = Drag.carAt(e.clientX, e.clientY);
    const g = el['drag-ghost'];
    if (car && G.running) {
      g.classList.remove('on');
      Drag.tryDrop(car, a.slot);
    } else {
      // float back to the tray
      const r = crateEl(a.slot).getBoundingClientRect();
      g.classList.add('return');
      g.style.left = (r.left + r.width / 2) + 'px'; g.style.top = (r.top + r.height / 2 + 8) + 'px';
      setTimeout(() => g.classList.remove('on', 'return'), 260);
    }
  },
  cancel() {
    const a = Drag.active;
    Drag.active = null;
    if (a) crateEl(a.slot).classList.remove('dragging');
    el['drag-ghost'].classList.remove('on', 'return');
    for (const c of G.cars) c.el.classList.remove('target');
  },
  clearSelection() {
    if (Drag.selected !== null) crateEl(Drag.selected)?.classList.remove('selected');
    Drag.selected = null;
  },
  carAt(x, y) {
    let best = null, bestD = Infinity;
    for (const c of G.cars) {
      if (c.isLoco || c.cargo || c.retired) continue;
      const r = c.el.getBoundingClientRect();
      const pad = 14;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - 40 && y <= r.bottom + 30) {
        const d = Math.abs((r.left + r.right) / 2 - x);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    return best;
  },
  tryDrop(car, slot) {
    const id = G.tray[slot];
    if (!id || car.cargo || car.retired) return;
    const rule = violation(car, id);
    if (rule) {
      car.el.classList.remove('reject'); void car.el.offsetWidth; car.el.classList.add('reject');
      setTimeout(() => car.el.classList.remove('reject'), 500);
      flashRuleChip(rule);
      strike(`${BY_ID[rule.a].emoji} ${rule.text} ${BY_ID[rule.b].emoji}`);
      return;
    }
    loadCar(car, id, false);
    Sound.thunk();
    if (G.loaded > 0 && G.loaded % 10 === 0) toast(`${G.loaded} cars! 🚂`, 'good');
    fillTray(slot, true);
  },
};

/* ------------------------------------------------------------------ */
/* Game over, weekly dispatch, ledger                                  */
/* ------------------------------------------------------------------ */
function gradeFor(run) {
  const c = run.cars;
  if (c >= 60) return 'Legend of the Line. The dispatcher is speechless.';
  if (c >= 45) return 'Yardmaster material. That train had its own zip code.';
  if (c >= 30) return 'A serious haul. Freight companies are calling.';
  if (c >= 20) return 'Solid shift. The onions got where they were going.';
  if (c >= 12) return 'Not bad for a lumbering start. It got fast, huh?';
  if (c >= 6) return 'A short train, but a train nonetheless.';
  return 'The train left before the coffee kicked in. Try again!';
}
function manifestHtml(manifest, limit) {
  const entries = Object.entries(manifest).sort((a, b) => b[1] - a[1]).slice(0, limit || 99);
  return entries.map(([id, n]) => `<span>${BY_ID[id].emoji} ×${n}</span>`).join('');
}
function showGameOver(run, prevBest) {
  $('#over-route').textContent = run.route;
  $('#over-cars').textContent = run.cars;
  $('#over-moved').textContent = run.moved;
  $('#over-time').textContent = fmtTime(run.seconds);
  $('#over-speed').textContent = run.topSpeed;
  $('#over-rules').textContent = run.rules;
  $('#over-manifest').innerHTML = manifestHtml(run.manifest, 8);
  $('#over-grade').textContent = gradeFor(run);
  const rec = $('#over-record');
  if (!prevBest || run.cars > prevBest.cars) rec.textContent = run.cars > 0 && prevBest ? '🏆 New longest train!' : (prevBest ? '' : '🚂 First route logged');
  else rec.textContent = `Best: ${prevBest.cars} cars`;
  const titles = ['The train got away!', 'Runaway freight!', 'That\'s the caboose, friend.', 'End of the line.', 'Too fast, too furious.'];
  $('#over-title').textContent = pick(titles);
  showScreen('screen-game');
  openModal('screen-over');
}
function dispatchDue() { return (DB.data.sinceDispatch || 0) >= CFG.weeklyEvery; }
function delta(elm, cur, prev, fmt) {
  const f = fmt || (v => v);
  if (prev === null || prev === undefined) { elm.textContent = ''; elm.className = 'delta'; return; }
  const d = cur - prev;
  if (d === 0) { elm.textContent = 'same as last week'; elm.className = 'delta flat'; return; }
  elm.textContent = `${d > 0 ? '▲' : '▼'} ${f(Math.abs(d))} vs last week`;
  elm.className = 'delta ' + (d > 0 ? 'up' : 'down');
}
function showWeekly(onDone) {
  const key = isoWeek(new Date());
  const cur = DB.weekStats(key);
  const prevKey = prevWeekKey(key);
  const prev = DB.data.runs.some(r => r.week === prevKey) ? DB.weekStats(prevKey) : null;
  $('#weekly-sub').textContent = weekLabel(key);
  $('#wk-cars').textContent = cur.cars;
  $('#wk-games').textContent = cur.games;
  $('#wk-moved').textContent = cur.moved;
  $('#wk-time').textContent = fmtTime(cur.seconds);
  $('#wk-longest').textContent = cur.longest;
  delta($('#wk-cars-delta'), cur.cars, prev && prev.cars, v => `${v} cars`);
  delta($('#wk-games-delta'), cur.games, prev && prev.games);
  delta($('#wk-moved-delta'), cur.moved, prev && prev.moved);
  delta($('#wk-time-delta'), cur.seconds, prev && prev.seconds, fmtTime);
  delta($('#wk-longest-delta'), cur.longest, prev && prev.longest);
  const fav = Object.entries(cur.manifest).sort((a, b) => b[1] - a[1])[0];
  $('#wk-fav').innerHTML = fav ? `Most hauled: ${BY_ID[fav[0]].emoji} ${BY_ID[fav[0]].name} (×${fav[1]})` : '';
  // A little visual of the combined train (one emoji per 2 cars, capped).
  const viz = $('#wk-trainviz');
  const n = Math.min(120, Math.ceil(cur.cars / 2));
  viz.textContent = '🚂' + '🚃'.repeat(n);
  DB.data.sinceDispatch = 0; DB.save();
  openModal('screen-weekly');
  $('#btn-weekly-continue').onclick = () => { closeModal('screen-weekly'); onDone && onDone(); };
}
function renderLedger() {
  const body = $('#ledger-body');
  const weeks = DB.weeks();
  if (!weeks.length) {
    body.innerHTML = '<div class="ledger-empty">No routes logged yet.<br>Go load a train! 🚂</div>';
    return;
  }
  const best = DB.best();
  body.innerHTML = weeks.map(key => {
    const s = DB.weekStats(key);
    const runs = DB.data.runs.filter(r => r.week === key).sort((a, b) => b.ts - a.ts);
    return `<div class="week">
      <div class="week-head"><b>${weekLabel(key)}</b><span>${s.games} route${s.games === 1 ? '' : 's'}</span></div>
      <div class="week-totals">
        <div><b>${s.cars}</b>cars</div>
        <div><b>${s.moved}</b>crates</div>
        <div><b>${fmtTime(s.seconds)}</b>on shift</div>
        <div><b>${s.longest}</b>longest</div>
      </div>
      <table class="runs">
        <thead><tr><th>Route</th><th style="text-align:right">Cars</th><th style="text-align:right">Crates</th><th style="text-align:right">Time</th></tr></thead>
        <tbody>${runs.map(r => `<tr class="${best && r.id === best.id ? 'best' : ''}">
          <td><span class="route">${r.route}</span><span class="date">${new Date(r.ts).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${r.rules} rules · ${r.topSpeed} mph</span></td>
          <td class="num">${r.cars}</td><td class="num">${r.moved}</td><td class="num">${fmtTime(r.seconds)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }).join('');
}
function renderTitleBest() {
  const best = DB.best();
  const wk = DB.weekStats(isoWeek(new Date()));
  el['title-best'].innerHTML = best
    ? `🏆 Longest train: <b>${best.cars} cars</b> &nbsp;·&nbsp; This week: <b>${wk.cars}</b> cars over ${wk.games} route${wk.games === 1 ? '' : 's'}`
    : 'No routes logged yet. The yard is waiting.';
}
function renderMute() { el['btn-mute'].textContent = DB.data.muted ? '🔇' : '🔊'; }

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */
function afterGame(next) {
  closeModal('screen-over');
  if (dispatchDue()) showWeekly(next);
  else next();
}
function init() {
  DB.load();
  cacheEls();
  Drag.init();
  renderTitleBest();
  renderMute();

  $('#btn-play').addEventListener('click', () => { Sound.ensure(); startGame(); });
  $('#btn-again').addEventListener('click', () => afterGame(startGame));
  $('#btn-home').addEventListener('click', () => afterGame(() => { renderTitleBest(); showScreen('screen-title'); }));
  $('#btn-howto').addEventListener('click', () => openModal('screen-howto'));
  $('#btn-ledger').addEventListener('click', () => { renderLedger(); openModal('screen-ledger'); });
  $('#btn-clear').addEventListener('click', () => {
    if (confirm('Wipe the whole route ledger? This cannot be undone.')) { DB.clear(); renderLedger(); renderTitleBest(); }
  });
  $('#btn-mute').addEventListener('click', () => { DB.data.muted = !DB.data.muted; DB.save(); renderMute(); Sound.ensure(); if (!DB.data.muted) Sound.ding(); });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));

  // Pause when the tab is hidden so the train doesn't run away while you take a call.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.running) { G.running = false; G.paused = true; cancelAnimationFrame(G.raf); Drag.cancel(); } }
    else if (G.paused && !G.over) { G.paused = false; G.running = true; G.lastFrame = performance.now(); G.raf = requestAnimationFrame(frame); }
  });
  window.addEventListener('resize', () => { G.yardW = el.yard.clientWidth || window.innerWidth; });
  window.addEventListener('contextmenu', (e) => { if (e.target.closest('#screen-game')) e.preventDefault(); });
}
document.addEventListener('DOMContentLoaded', init);

// Expose a little for debugging / tests.
window.FREIGHT = { G, DB, CFG, startGame, isoWeek, prevWeekKey };
