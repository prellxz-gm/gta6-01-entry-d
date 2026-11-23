// Palmar Bay — wanted system + police: patrol cars, helicopter, roadblocks.
// 5-star dispatch: 1-2 stars patrol, 3+ pursuit + heli, 4+ roadblocks, 5 = full manhunt.
import { CFG } from './config.js';
import { makeRng } from './random.js';

export class Police {
  constructor(seed) {
    this.rng = makeRng(seed + 77);
    this.wanted = 0;
    this.heat = 0;              // 0..100, drives wanted up/down
    this.cops = [];             // {x,z,rot,speed,mesh}
    this.heli = null;           // {x,z,alt,angle}
    this.roadblocks = [];       // {x,z,rot}
    this.hiddenTimer = 0;
    this.lastDecay = 0;
  }
  addHeat(n) {
    this.heat = Math.min(100, this.heat + n);
    this.wanted = this.heat <= 0 ? 0 : this.heat < 20 ? 1 : this.heat < 40 ? 2 : this.heat < 60 ? 3 : this.heat < 85 ? 4 : 5;
    this.syncUnits();
  }
  setWanted(level) {
    this.wanted = Math.max(0, Math.min(5, level));
    this.heat = [0, 10, 30, 50, 70, 95][this.wanted];
    this.syncUnits();
  }
  syncUnits() {
    const wantCops = this.wanted === 0 ? 0 : this.wanted === 1 ? 1 : this.wanted === 2 ? 2 : this.wanted === 3 ? 3 : this.wanted === 4 ? 4 : 6;
    while (this.cops.length < wantCops) {
      this.cops.push({ x: 0, z: 0, rot: 0, speed: 0, placed: false, ramCd: 0 });
    }
    this.cops.length = wantCops;
    this.heli = this.wanted >= 3 ? (this.heli || { x: 0, z: 0, alt: 55, angle: 0 }) : null;
    const wantBlocks = this.wanted >= 4 ? (this.wanted === 4 ? 2 : 3) : 0;
    while (this.roadblocks.length < wantBlocks) {
      this.roadblocks.push({ x: 0, z: 0, rot: 0, placed: false });
    }
    this.roadblocks.length = wantBlocks;
  }
  update(dt, now, playerPos, playerInCar, playerSpeed, rng) {
    // Decay: hidden + slow = wanted fades. Dex crew doubles the fade.
    // Shot mode (deterministic screenshots) freezes wanted.
    const hidden = playerSpeed < 2;
    if (this.wanted > 0 && !playerPos.shot) {
      this.hiddenTimer = hidden ? this.hiddenTimer + dt : 0;
      const rate = (this.hiddenTimer > 4 ? 2.2 : 0.4) * dt;
      this.heat = Math.max(0, this.heat - rate * (playerPos.dex ? 2 : 1));
      const w = this.heat <= 0 ? 0 : this.heat < 20 ? 1 : this.heat < 40 ? 2 : this.heat < 60 ? 3 : this.heat < 85 ? 4 : 5;
      if (w !== this.wanted) { this.wanted = w; this.syncUnits(); }
    }
    const px = playerPos.x, pz = playerPos.z;
    for (const cop of this.cops) {
      if (!cop.placed) {
        const a = rng.range(0, Math.PI * 2);
        cop.x = px + Math.sin(a) * 70; cop.z = pz + Math.cos(a) * 70;
        cop.placed = true;
      }
      const dx = px - cop.x, dz = pz - cop.z;
      const dist = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let dRot = want - cop.rot;
      while (dRot > Math.PI) dRot -= Math.PI * 2;
      while (dRot < -Math.PI) dRot += Math.PI * 2;
      cop.rot += Math.max(-2.4 * dt, Math.min(2.4 * dt, dRot));
      const target = playerInCar ? 34 : 16;
      cop.speed += (target - cop.speed) * dt * 0.8;
      cop.x += Math.sin(cop.rot) * cop.speed * dt;
      cop.z += Math.cos(cop.rot) * cop.speed * dt;
      cop.ramCd -= dt;
      // Ram = damage handled by main via proximity.
      if (dist > 240) { cop.placed = false; }
    }
    if (this.heli) {
      this.heli.angle += dt * 0.5;
      this.heli.x = px + Math.sin(this.heli.angle) * 26;
      this.heli.z = pz + Math.cos(this.heli.angle) * 26;
      this.heli.alt = 52 + Math.sin(now * 0.7) * 3;
    }
    for (const rb of this.roadblocks) {
      if (!rb.placed) {
        const a = rng.range(0, Math.PI * 2);
        rb.x = px + Math.sin(a) * 55; rb.z = pz + Math.cos(a) * 55;
        rb.rot = rng.range(0, Math.PI);
        rb.placed = true;
      }
    }
  }
  copHitsPlayer(playerPos, radius) {
    for (const cop of this.cops) {
      if (Math.hypot(cop.x - playerPos.x, cop.z - playerPos.z) < radius) return cop;
    }
    return null;
  }
}
