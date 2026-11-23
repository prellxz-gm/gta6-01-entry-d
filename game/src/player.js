// Palmar Bay — player: on foot + driving, stealing cars, weapons, health/cash.
import { CFG, WEAPONS } from './config.js';
import { clampToWorld } from './world.js';

export class Player {
  constructor() {
    this.x = 0; this.z = 40;
    this.heading = 0;           // facing angle, 0 = -z? we use sin/cos forward
    this.speed = 0;
    this.inCar = null;          // car object or null
    this.health = 100;
    this.cash = CFG.startCash;
    this.weapon = 0;            // index into WEAPONS
    this.lastShotAt = -9999;
    this.stolen = 0;
    this.kills = 0;
    this.raceBest = null;
    this.upgrades = { engine: false, armor: false, nitro: false };
    this.crewHired = ['rico'];
  }
  get weaponDef() { return WEAPONS[this.weapon]; }
  get pos() { return this.inCar ? { x: this.inCar.x, z: this.inCar.z } : { x: this.x, z: this.z }; }

  update(input, dt, now, world, fx) {
    if (this.inCar) this.drive(input, dt, now, fx);
    else this.walk(input, dt, now, world);
    // Weapon swap.
    if (input.wasPressed('Digit1')) this.weapon = 0;
    if (input.wasPressed('Digit2')) this.weapon = 1;
    if (input.wasPressed('Digit3')) this.weapon = 2;
  }
  walk(input, dt, now, world) {
    let mx = 0, mz = 0;
    if (input.forward) mz -= 1;
    if (input.back) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const len = Math.hypot(mx, mz);
    const sp = input.run ? CFG.runSpeed : CFG.walkSpeed;
    if (len > 0) {
      mx /= len; mz /= len;
      this.x += mx * sp * dt;
      this.z += mz * sp * dt;
      this.heading = Math.atan2(mx, -mz); // face movement; forward = -z at heading 0
      this.speed = sp;
    } else this.speed = 0;
    const c = clampToWorld(this.x, this.z);
    this.x = c.x; this.z = c.z;
  }
  drive(input, dt, now, fx) {
    const car = this.inCar;
    const top = CFG.carMaxSpeed * (this.upgrades.engine ? 1.25 : 1);
    if (input.forward) car.speed += CFG.carAccel * dt;
    if (input.back) car.speed -= CFG.carBrake * dt;
    car.speed -= car.speed * 0.6 * dt; // drag
    if (this.upgrades.nitro && input.run && input.forward) {
      car.speed += 30 * dt;
      if (fx) fx.nitro = true;
    }
    car.speed = Math.max(-12, Math.min(top, car.speed));
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    car.rot += steer * CFG.carTurn * dt * dir * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
    car.x += Math.sin(car.rot) * car.speed * dt;
    car.z += Math.cos(car.rot) * car.speed * dt;
    const c = clampToWorld(car.x, car.z);
    if (c.x !== car.x || c.z !== car.z) { car.speed *= -0.25; car.x = c.x; car.z = c.z; if (fx) fx.bump = true; }
    this.heading = car.rot;
    this.speed = Math.abs(car.speed);
  }
  nearestStealable(world, maxDist) {
    let best = null, bestD = maxDist;
    for (const p of world.parked) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    for (const t of world.traffic) {
      const tx = t.horizontal ? t.pos : t.lane;
      const tz = t.horizontal ? t.lane : t.pos;
      const d = Math.hypot(tx - this.x, tz - this.z);
      if (d < bestD && Math.abs(t.speed) < 4) { bestD = d; best = { id: t.id, x: tx, z: tz, rot: t.horizontal ? Math.PI / 2 : 0, color: t.color, traffic: t, taken: false }; }
    }
    return best;
  }
  enterCar(car, fx) {
    this.inCar = { id: car.id, x: car.x, z: car.z, rot: car.rot || 0, speed: 0, color: car.color, hp: 100, armor: this.upgrades.armor };
    if (car.taken !== undefined) car.taken = true;
    if (car.traffic) car.traffic.speed = 0;
    this.stolen += 1;
    if (fx) fx.steal = true;
  }
  exitCar() {
    if (!this.inCar) return;
    this.x = this.inCar.x + Math.sin(this.inCar.rot + Math.PI / 2) * 3;
    this.z = this.inCar.z + Math.cos(this.inCar.rot + Math.PI / 2) * 3;
    this.inCar = null;
    this.speed = 0;
  }
  canShoot(now) { return (now - this.lastShotAt) * 1000 >= this.weaponDef.rate; }
  shoot(now) { this.lastShotAt = now; }
  damage(amount) { this.health = Math.max(0, this.health - amount); }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
  addCash(n) { this.cash += n; }
  serialize() {
    return {
      cash: this.cash, health: this.health, weapon: this.weapon,
      upgrades: this.upgrades, crewHired: this.crewHired,
      stolen: this.stolen, kills: this.kills, raceBest: this.raceBest,
      x: this.x, z: this.z,
    };
  }
  deserialize(s) {
    if (!s) return;
    this.cash = s.cash ?? this.cash; this.health = s.health ?? 100;
    this.weapon = s.weapon ?? 0; this.upgrades = { ...this.upgrades, ...(s.upgrades || {}) };
    this.crewHired = s.crewHired || this.crewHired;
    this.stolen = s.stolen || 0; this.kills = s.kills || 0; this.raceBest = s.raceBest ?? null;
    if (typeof s.x === 'number') { this.x = s.x; this.z = s.z; }
  }
}
