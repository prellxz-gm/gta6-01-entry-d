// Palmar Bay — main game: loop, HUD, minimap, enemies, saves, menus.
// Fixed timestep (60 Hz), seeded RNG only — no Date.now / Math.random in gameplay.
import * as THREE from 'three';
import { CFG, MISSIONS, RADIO, GARAGE_UPGRADES, CREW, WEAPONS } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { buildCity } from './world.js';
import { Renderer } from './render.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { AudioEngine } from './audio.js';
import { parseShot, applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.rng = makeRng(CFG.seed);
    this.input = new Input();
    this.city = buildCity(CFG.seed);
    this.renderer = new Renderer($('game-canvas'));
    this.renderer.buildStatic(this.city);
    this.player = new Player();
    this.police = new Police(CFG.seed);
    this.missions = new MissionManager();
    this.audio = new AudioEngine();
    this.fx = {};
    this.state = 'menu'; // menu | playing | paused | dead | won
    this.time = 0;
    this.acc = 0;
    this.lastTs = 0;
    this.enemies = [];   // shootout thugs {x,z,hp,mesh}
    this.convoy = [];    // chase targets {x,z,rot,speed,hp,mesh}
    this.trafficMeshes = new Map();
    this.pedMeshes = new Map();
    this.copMeshes = [];
    this.roadblockMeshes = [];
    this.heliMesh = null;
    this.playerMesh = null;
    this.playerCarMesh = null;
    this.marker = null;
    this.enemyMeshes = [];
    this.shotMode = parseShot();
    this.buildDynamicMeshes();
    this.buildMinimap();
    this.bindUI();
    this.loadSave();
    if (this.shotMode.shot) {
      this.startGame(true);
      applyShot(this, this.shotMode.shot);
      // Let the scene settle, then mark ready for the screenshot harness.
      setTimeout(() => { window.__palmarReady = true; }, 1200);
    }
    window.__palmar = this;
    window.__palmarReady = window.__palmarReady || false;
    window.__palmarErrors = [];
    window.addEventListener('error', (e) => { window.__palmarErrors.push(String(e.message || e.error)); });
    requestAnimationFrame((ts) => this.frame(ts));
  }

  buildDynamicMeshes() {
    const R = this.renderer;
    // Traffic.
    for (const t of this.city.traffic) {
      const m = R.makeCarMesh(t.color, false);
      R.dynamic.add(m);
      this.trafficMeshes.set(t.id, m);
    }
    // Parked cars.
    this.parkedMeshes = new Map();
    for (const p of this.city.parked) {
      const m = R.makeCarMesh(p.color, false);
      m.position.set(p.x, 0, p.z); m.rotation.y = p.rot;
      R.dynamic.add(m);
      this.parkedMeshes.set(p.id, m);
    }
    // Peds.
    for (const p of this.city.peds) {
      const m = R.makePedMesh(p.shirt);
      R.dynamic.add(m);
      this.pedMeshes.set(p.id, m);
    }
    // Player on foot.
    this.playerMesh = R.makePersonMesh(0xffd76b, 0x223344);
    R.dynamic.add(this.playerMesh);
    // Mission marker (floating diamond).
    this.marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2),
      new THREE.MeshBasicMaterial({ color: 0xffd76b })
    );
    R.dynamic.add(this.marker);
    // Checkpoint markers for races.
    this.cpMeshes = [];
  }

  buildMinimap() {
    this.mapCanvas = $('minimap');
    this.mapCtx = this.mapCanvas.getContext('2d');
  }

  bindUI() {
    const startBtn = $('start-btn');
    if (startBtn) startBtn.addEventListener('click', () => { this.audio.ensure(); this.audio.sfx('click'); this.startGame(false); });
    const resumeBtn = $('resume-btn');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.togglePause());
    const garageBtn = $('garage-btn');
    if (garageBtn) garageBtn.addEventListener('click', () => this.openGarage());
    const closeGarage = $('close-garage');
    if (closeGarage) closeGarage.addEventListener('click', () => { $('garage-panel').classList.add('hidden'); this.state = 'playing'; });
    const radioBtn = $('radio-btn');
    if (radioBtn) radioBtn.addEventListener('click', () => this.cycleRadio());
    this.input.onKey = (code) => {
      if (this.state !== 'playing') return;
      if (code === 'KeyP' || code === 'Escape') this.togglePause();
      if (code === 'KeyM') this.missions.restart(this.time);
      if (code === 'KeyR') this.cycleRadio();
      if (code === 'KeyG') this.openGarage();
      if (code === 'KeyQ') this.toggleWheel();
      if (code === 'KeyE') this.tryEnterCar();
      if (code === 'KeyF') this.tryExitCar();
    };
    window.addEventListener('mousedown', () => {
      if (this.state === 'playing' && this.player.canShoot(this.time)) this.tryShoot();
    });
  }

  startGame(fromShot) {
    this.state = 'playing';
    $('menu-screen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('pause-screen').classList.add('hidden');
    if (!this.missions.active && !this.missions.done) this.missions.start(0);
    if (!fromShot) this.audio.startRadio();
    this.spawnMissionActors();
  }

  spawnMissionActors() {
    const def = this.missions.currentDef;
    if (!def) return;
    // Clear old.
    for (const m of this.enemyMeshes) this.renderer.dynamic.remove(m);
    this.enemyMeshes = []; this.enemies = []; this.convoy = [];
    if (def.type === 'shootout') {
      for (let i = 0; i < 6; i++) {
        const a = this.rng.range(0, Math.PI * 2);
        const e = { x: def.target.x + Math.sin(a) * 14, z: def.target.z + Math.cos(a) * 14, hp: 100 };
        const m = this.renderer.makePersonMesh(0x8a1a2a, 0x111111);
        m.position.set(e.x, 0, e.z);
        this.renderer.dynamic.add(m);
        e.mesh = m; this.enemies.push(e); this.enemyMeshes.push(m);
      }
    }
    if (def.type === 'chase') {
      for (let i = 0; i < 3; i++) {
        const c = { x: def.target.x + i * 8, z: def.target.z - i * 6, rot: 0.5, speed: 14, hp: 100 };
        const m = this.renderer.makeCarMesh(0x8a1a2a, false);
        m.position.set(c.x, 0, c.z);
        this.renderer.dynamic.add(m);
        c.mesh = m; this.convoy.push(c); this.enemyMeshes.push(m);
      }
    }
  }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; $('pause-screen').classList.remove('hidden'); }
    else if (this.state === 'paused') { this.state = 'playing'; $('pause-screen').classList.add('hidden'); }
  }
  cycleRadio() {
    const st = this.audio.nextStation();
    this.audio.startRadio();
    this.missions.say(`RADIO: ${st.name} — ${st.desc}`, this.time);
  }
  toggleWheel() {
    const w = $('weapon-wheel');
    if (w) w.classList.toggle('hidden');
  }
  openGarage() {
    const p = $('garage-panel');
    if (!p) return;
    p.classList.remove('hidden');
    this.state = 'paused';
    const list = $('garage-list');
    list.innerHTML = '';
    for (const u of GARAGE_UPGRADES) {
      const owned = this.player.upgrades[u.id];
      const row = document.createElement('div');
      row.className = 'garage-row';
      row.innerHTML = `<b>${u.name}</b> — ${u.desc} — ${owned ? 'OWNED' : '$' + u.cost}`;
      if (!owned) {
        const b = document.createElement('button');
        b.textContent = 'Buy';
        b.addEventListener('click', () => {
          if (this.player.cash >= u.cost) {
            this.player.cash -= u.cost; this.player.upgrades[u.id] = true;
            this.audio.sfx('pickup'); this.saveGame(); this.openGarage();
          }
        });
        row.appendChild(b);
      }
      list.appendChild(row);
    }
    const crew = $('crew-list');
    crew.innerHTML = '<h3>Crew</h3>';
    for (const c of CREW) {
      const hired = this.player.crewHired.includes(c.id);
      const row = document.createElement('div');
      row.className = 'garage-row';
      row.innerHTML = `<b>${c.name}</b> — ${c.role} — ${hired ? 'HIRED' : c.cost === 0 ? 'FREE' : '$' + c.cost}`;
      if (!hired && c.cost > 0) {
        const b = document.createElement('button');
        b.textContent = 'Hire';
        b.addEventListener('click', () => {
          if (this.player.cash >= c.cost) {
            this.player.cash -= c.cost; this.player.crewHired.push(c.id);
            this.audio.sfx('pickup'); this.saveGame(); this.openGarage();
          }
        });
        row.appendChild(b);
      }
      crew.appendChild(row);
    }
  }
  tryEnterCar() {
    if (this.player.inCar) return;
    const car = this.player.nearestStealable(this.city, 5);
    if (car) {
      this.player.enterCar(car, this.fx);
      this.police.addHeat(12);
      this.audio.sfx('steal');
      this.missions.say('Car stolen! Wanted +1 star. Lose the cops or lay low.', this.time);
      const pm = this.parkedMeshes.get(car.id);
      if (pm) pm.visible = false;
    }
  }
  tryExitCar() { if (this.player.inCar) { this.player.exitCar(); } }
  tryShoot() {
    const w = this.player.weaponDef;
    this.player.shoot(this.time);
    this.audio.sfx(w.id === 'fists' ? 'punch' : 'shoot');
    if (w.id === 'fists') {
      for (const e of this.enemies) {
        if (Math.hypot(e.x - this.player.x, e.z - this.player.z) < w.range) { e.hp -= w.damage; if (e.hp <= 0) this.killEnemy(e); }
      }
      return;
    }
    // Hitscan: nearest enemy within range and roughly in front (heading cone).
    let best = null, bestD = w.range;
    const hx = Math.sin(this.player.heading), hz = -Math.cos(this.player.heading);
    for (const e of [...this.enemies, ...this.convoy]) {
      const dx = e.x - this.player.pos.x, dz = e.z - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx * hx + dz * hz) / (d || 1);
      if (dot > 0.5 || d < 6) { best = e; bestD = d; }
    }
    if (best) {
      best.hp -= w.damage;
      this.police.addHeat(6);
      if (best.hp <= 0) this.killEnemy(best);
    }
  }
  killEnemy(e) {
    this.player.kills += 1;
    this.player.addCash(50);
    this.audio.sfx('pickup');
    if (this.enemies.includes(e)) {
      this.enemies.splice(this.enemies.indexOf(e), 1);
      if (this.missions.active) this.missions.active.enemiesLeft -= 1;
      this.renderer.dynamic.remove(e.mesh);
    }
    if (this.convoy.includes(e)) {
      this.convoy.splice(this.convoy.indexOf(e), 1);
      if (this.missions.active) this.missions.active.enemiesLeft -= 1;
      this.renderer.dynamic.remove(e.mesh);
    }
  }

  frame(ts) {
    requestAnimationFrame((t) => this.frame(t));
    if (!this.lastTs) this.lastTs = ts;
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (dt > 0.25) dt = 0.25;
    if (this.state === 'playing') {
      this.acc += dt;
      while (this.acc >= CFG.fixedDt) {
        this.tick(CFG.fixedDt);
        this.acc -= CFG.fixedDt;
      }
    }
    this.renderScene(dt);
    this.input.endTick();
  }

  tick(dt) {
    this.time += dt;
    const p = this.player;
    p.update(this.input, dt, this.time, this.city, this.fx);
    // Traffic moves along its lane.
    for (const t of this.city.traffic) {
      t.pos += t.speed * dt;
      const h = CFG.worldSize / 2;
      if (t.pos > h) t.pos = -h;
      if (t.pos < -h) t.pos = h;
    }
    // Peds wander.
    for (const pd of this.city.peds) {
      pd.t += dt;
      pd.x += Math.sin(pd.dir) * pd.speed * dt;
      pd.z += Math.cos(pd.dir) * pd.speed * dt;
      if (Math.abs(pd.x) > 150 || Math.abs(pd.z) > 220) pd.dir += Math.PI / 2;
      if (this.rng.chance(dt * 0.05)) pd.dir = this.rng.range(0, Math.PI * 2);
    }
    // Enemies drift toward the player.
    for (const e of this.enemies) {
      const dx = p.pos.x - e.x, dz = p.pos.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 3) { e.x += (dx / d) * 2.2 * dt; e.z += (dz / d) * 2.2 * dt; }
      else if (this.time % 1 < dt * 2) p.damage(6);
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
    }
    // Convoy flees / rams.
    for (const c of this.convoy) {
      c.rot += 0.4 * dt;
      c.x += Math.sin(c.rot) * c.speed * dt;
      c.z += Math.cos(c.rot) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.rot;
      const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z);
      if (d < 4 && p.inCar) { c.hp -= 40 * dt; if (c.hp <= 0) this.killEnemy(c); }
    }
    // Police.
    const dex = p.crewHired.includes('dex');
    const shotMode = !!this.shotMode.shot;
    this.police.update(dt, this.time, { ...p.pos, dex, shot: shotMode }, !!p.inCar, p.speed, this.rng);
    const cop = this.police.copHitsPlayer(p.pos, p.inCar ? 3.4 : 2.2);
    if (cop && cop.ramCd <= 0 && !shotMode) {
      cop.ramCd = 1.2;
      p.damage(p.inCar ? 8 : 14);
      if (p.inCar) { p.inCar.hp -= 10; this.audio.sfx('crash'); }
      if (p.inCar && p.inCar.hp <= 0) { this.tryExitCar(); this.missions.say('Your car is wrecked!', this.time); }
    }
    // Heli spotlight damage at 5 stars (not in shot mode).
    if (this.police.wanted >= 5 && !shotMode && this.time % 2 < dt * 2) p.damage(2);
    // Missions.
    const res = this.missions.update(dt, this.time, p, this.police, this.fx);
    if (res === 'complete') {
      this.audio.sfx('complete');
      this.saveGame();
      this.spawnMissionActors();
      if (this.missions.done) { this.state = 'won'; $('win-screen').classList.remove('hidden'); }
    } else if (res === 'failed') this.audio.sfx('fail');
    if (this.fx.checkpoint) { this.audio.sfx('checkpoint'); this.fx.checkpoint = false; }
    if (this.fx.steal) { this.fx.steal = false; }
    if (this.fx.complete) this.fx.complete = false;
    if (this.fx.fail) this.fx.fail = false;
    if (this.police.wanted >= 3 && this.time % 3 < dt * 2) this.audio.sfx('siren');
    // Death.
    if (p.health <= 0) {
      this.state = 'dead';
      $('dead-screen').classList.remove('hidden');
      this.audio.sfx('fail');
      this.audio.stopRadio();
    }
    // Autosave every ~20s of play.
    if (Math.floor(this.time) % 20 === 0 && Math.floor(this.time - dt) % 20 !== 0) this.saveGame();
  }

  renderScene(dt) {
    const R = this.renderer;
    const p = this.player;
    // Sync meshes.
    for (const t of this.city.traffic) {
      const m = this.trafficMeshes.get(t.id);
      if (!m) continue;
      m.position.set(t.horizontal ? t.pos : t.lane, 0, t.horizontal ? t.lane : t.pos);
      m.rotation.y = t.horizontal ? (t.speed > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.speed > 0 ? 0 : Math.PI);
    }
    for (const pd of this.city.peds) {
      const m = this.pedMeshes.get(pd.id);
      if (!m) continue;
      m.position.set(pd.x, 0, pd.z);
      m.rotation.y = pd.dir;
      m.position.y = Math.abs(Math.sin(pd.t * 6)) * 0.12;
    }
    // Player mesh / car mesh.
    if (p.inCar) {
      this.playerMesh.visible = false;
      if (!this.playerCarMesh) {
        this.playerCarMesh = R.makeCarMesh(p.inCar.color, false);
        R.dynamic.add(this.playerCarMesh);
      }
      this.playerCarMesh.visible = true;
      this.playerCarMesh.position.set(p.inCar.x, 0, p.inCar.z);
      this.playerCarMesh.rotation.y = p.inCar.rot;
    } else {
      this.playerMesh.visible = true;
      if (this.playerCarMesh) this.playerCarMesh.visible = false;
      this.playerMesh.position.set(p.x, 0, p.z);
      this.playerMesh.rotation.y = p.heading;
      this.playerMesh.position.y = p.speed > 0 ? Math.abs(Math.sin(this.time * 10)) * 0.15 : 0;
    }
    // Cops.
    while (this.copMeshes.length < this.police.cops.length) {
      const m = R.makeCarMesh(0x111111, true);
      R.dynamic.add(m);
      this.copMeshes.push(m);
    }
    this.copMeshes.forEach((m, i) => {
      const c = this.police.cops[i];
      m.visible = !!c;
      if (!c) return;
      m.position.set(c.x, 0, c.z);
      m.rotation.y = c.rot;
      const bar = m.getObjectByName('lightbar');
      if (bar) bar.material.color.setHex(Math.floor(this.time * 4) % 2 === 0 ? 0xff2222 : 0x2244ff);
    });
    // Heli.
    if (this.police.heli) {
      if (!this.heliMesh) {
        this.heliMesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 6),
          new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4, metalness: 0.5 }));
        this.heliMesh.add(body);
        const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x888888 }));
        rotor.position.y = 1;
        rotor.name = 'rotor';
        this.heliMesh.add(rotor);
        const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 50, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
        beam.position.y = -26; beam.rotation.x = Math.PI;
        this.heliMesh.add(beam);
        R.dynamic.add(this.heliMesh);
      }
      this.heliMesh.visible = true;
      this.heliMesh.position.set(this.police.heli.x, this.police.heli.alt, this.police.heli.z);
      const rotor = this.heliMesh.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 18;
    } else if (this.heliMesh) this.heliMesh.visible = false;
    // Roadblocks.
    while (this.roadblockMeshes.length < this.police.roadblocks.length) {
      const g = new THREE.Group();
      for (let i = -1; i <= 1; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 1),
          new THREE.MeshStandardMaterial({ color: i === 0 ? 0xff5533 : 0xeeeeee, roughness: 0.7 }));
        b.position.set(i * 2.6, 0.5, 0);
        g.add(b);
      }
      R.dynamic.add(g);
      this.roadblockMeshes.push(g);
    }
    this.roadblockMeshes.forEach((g, i) => {
      const rb = this.police.roadblocks[i];
      g.visible = !!rb;
      if (!rb) return;
      g.position.set(rb.x, 0, rb.z);
      g.rotation.y = rb.rot;
    });
    // Mission marker + race checkpoints.
    const def = this.missions.currentDef;
    if (def && this.missions.active) {
      this.marker.visible = true;
      const tx = this.missions.active.checkpoints.length
        ? this.missions.active.checkpoints.find((c) => !c.hit) || def.target
        : def.target;
      this.marker.position.set(tx.x, 14 + Math.sin(this.time * 3) * 1.5, tx.z);
      this.marker.rotation.y += dt * 2;
    } else this.marker.visible = false;
    // Camera.
    const pos = p.pos;
    const wideShot = this.shotMode.shot === 'start' || this.shotMode.shot === 'end';
    R.followCamera(pos.x, pos.z, p.heading, !!p.inCar, p.speed, dt, this.time, wideShot);
    R.render();
    this.drawHUD();
    this.drawMinimap();
    if (this.shotMode.shot) {
      const dbg = $('palmar-debug');
      if (dbg) {
        dbg.textContent = JSON.stringify({
          state: this.state, wanted: this.police.wanted, health: Math.round(this.player.health),
          cash: this.player.cash, mission: this.missions.current + 1, inCar: !!this.player.inCar,
          x: Math.round(this.player.pos.x), z: Math.round(this.player.pos.z),
          cops: this.police.cops.length, heli: !!this.police.heli,
          roadblocks: this.police.roadblocks.length, errors: window.__palmarErrors || [],
        });
      }
    }
  }

  drawHUD() {
    const set = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; };
    set('hud-cash', '$' + this.player.cash);
    set('hud-health', Math.ceil(this.player.health) + '');
    set('hud-speed', Math.round(this.player.speed * 3.6) + ' km/h');
    set('hud-weapon', this.player.weaponDef.name);
    set('hud-radio', RADIO[this.audio.station].name);
    const w = this.police.wanted;
    set('hud-wanted', '★'.repeat(w) + '☆'.repeat(5 - w));
    const def = this.missions.currentDef;
    set('hud-mission', this.missions.done ? 'ALL MISSIONS COMPLETE' : def ? `M${def.id} ${def.name} — ${def.brief}` : '');
    const msg = $('hud-message');
    if (msg) {
      const fresh = this.time - this.missions.messageAt < 6;
      msg.textContent = fresh ? this.missions.message : '';
    }
    const hp = $('hud-health-bar');
    if (hp) hp.style.width = this.player.health + '%';
    const hint = $('hud-hint');
    if (hint) {
      hint.textContent = this.player.inCar
        ? 'WASD drive • SHIFT nitro • F exit • Q weapons • R radio • G garage • P pause'
        : 'WASD move • SHIFT run • E steal car • 1/2/3 weapons • click shoot • G garage • P pause';
    }
  }

  drawMinimap() {
    const c = this.mapCtx;
    if (!c) return;
    const S = 150, half = CFG.worldSize / 2;
    const toMap = (x, z) => [(x + half) / CFG.worldSize * S, (z + half) / CFG.worldSize * S];
    c.fillStyle = 'rgba(20,12,30,0.85)';
    c.fillRect(0, 0, S, S);
    // Ocean + sand.
    c.fillStyle = '#1d4e6b';
    c.fillRect(0, 0, 12, S);
    c.fillStyle = '#e8c98f';
    c.fillRect(12, 0, 4, S);
    // Roads.
    c.strokeStyle = '#555';
    c.lineWidth = 3;
    for (let g = -half; g <= half; g += CFG.blockSize) {
      const [x1] = toMap(g, 0); const [, y1] = toMap(0, g);
      c.beginPath(); c.moveTo(x1, 0); c.lineTo(x1, S); c.stroke();
      c.beginPath(); c.moveTo(0, y1); c.lineTo(S, y1); c.stroke();
    }
    // Mission target.
    const def = this.missions.currentDef;
    if (def && this.missions.active) {
      const [mx, my] = toMap(def.target.x, def.target.z);
      c.fillStyle = '#ffd76b';
      c.beginPath(); c.arc(mx, my, 5, 0, Math.PI * 2); c.fill();
    }
    // Cops (blue), player (white triangle).
    c.fillStyle = '#4d8dff';
    for (const cop of this.police.cops) {
      const [mx, my] = toMap(cop.x, cop.z);
      c.fillRect(mx - 2, my - 2, 4, 4);
    }
    const [px, py] = toMap(this.player.pos.x, this.player.pos.z);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffd76b'; c.lineWidth = 1;
    c.beginPath(); c.arc(px, py, 6, 0, Math.PI * 2); c.stroke();
  }

  saveGame() {
    try {
      localStorage.setItem(CFG.saveKey, JSON.stringify({
        player: this.player.serialize(),
        missions: this.missions.serialize(),
      }));
    } catch (e) { /* storage unavailable — play on */ }
  }
  loadSave() {
    try {
      const raw = localStorage.getItem(CFG.saveKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.player.deserialize(s.player);
      this.missions.deserialize(s.missions);
    } catch (e) { /* corrupted save — fresh start */ }
  }
}

window.addEventListener('DOMContentLoaded', () => { new Game(); });
