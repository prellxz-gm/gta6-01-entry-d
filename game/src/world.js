// Palmar Bay — city generation. Seeded grid city on a sunset coast.
// West edge (x < -160) is beach + ocean. Roads form a grid; buildings fill blocks.
import { CFG, SUNSET, CAR_COLORS, BUILDING_COLORS } from './config.js';
import { makeRng } from './random.js';

export function buildCity(seed) {
  const rng = makeRng(seed);
  const half = CFG.worldSize / 2; // 230
  const step = CFG.blockSize;     // 46
  const roads = [];               // road centre lines
  for (let c = -half; c <= half; c += step) {
    roads.push({ axis: 'x', at: c });
    roads.push({ axis: 'z', at: c });
  }
  const buildings = [];
  const palms = [];
  const lights = [];
  // Buildings: one per block interior, skipping beach strip and road crossings.
  for (let gx = -half + step; gx < half; gx += step) {
    for (let gz = -half + step; gz < half; gz += step) {
      const cx = gx + step / 2, cz = gz + step / 2;
      if (cx < -150) continue; // beach strip, no buildings
      if (rng.chance(0.14)) { // plaza / park instead
        palms.push({ x: cx, z: cz });
        continue;
      }
      const w = rng.range(16, 26), d = rng.range(16, 26);
      const h = rng.range(10, 52) * (rng.chance(0.12) ? 1.8 : 1);
      buildings.push({
        x: cx, z: cz, w, d, h,
        color: rng.pick(BUILDING_COLORS),
        lit: rng.chance(0.7),
      });
      if (rng.chance(0.5)) palms.push({ x: cx + w / 2 + 4, z: cz + rng.range(-8, 8) });
    }
  }
  // Street lights along roads.
  for (let c = -half + step; c < half; c += step) {
    for (let t = -half; t < half; t += step) {
      lights.push({ x: c + 7, z: t });
      lights.push({ x: t, z: c + 7 });
    }
  }
  // Beach palms row.
  for (let z = -half + 10; z < half; z += 24) palms.push({ x: -158 + rng.range(-4, 4), z });
  // Lighthouse at the far north-west corner (finale target).
  const lighthouse = { x: -184, z: -184 };
  // Traffic cars: seeded routes on the grid.
  const traffic = [];
  for (let i = 0; i < 26; i++) {
    const horizontal = rng.chance(0.5);
    const lane = (Math.floor(rng.range(-4, 5)) * step) + (rng.chance(0.5) ? 3 : -3);
    traffic.push({
      id: 't' + i, color: rng.pick(CAR_COLORS),
      horizontal, lane,
      pos: rng.range(-half, half),
      speed: rng.range(7, 13) * (rng.chance(0.5) ? 1 : -1),
    });
  }
  // Pedestrians on sidewalks.
  const peds = [];
  for (let i = 0; i < 40; i++) {
    peds.push({
      id: 'p' + i,
      x: rng.range(-150, half - 10), z: rng.range(-half + 10, half - 10),
      dir: rng.range(0, Math.PI * 2),
      speed: rng.range(0.8, 1.8),
      shirt: rng.pick([0xff5a5a, 0x5aff8a, 0x5ac8ff, 0xffe15a, 0xff9ad5, 0xffffff]),
      t: rng.range(0, 100),
    });
  }
  // Parked stealable cars near road edges.
  const parked = [];
  const spots = [
    { x: 30, z: -60 }, { x: -60, z: 30 }, { x: 80, z: 60 }, { x: -120, z: -30 },
    { x: 120, z: -120 }, { x: -30, z: 120 }, { x: 150, z: 10 }, { x: -138, z: 92 },
    { x: 60, z: -150 }, { x: -90, z: -120 },
  ];
  for (let i = 0; i < spots.length; i++) {
    parked.push({ id: 'park' + i, x: spots[i].x, z: spots[i].z, rot: rng.range(0, Math.PI * 2), color: rng.pick(CAR_COLORS), taken: false });
  }
  return { half, step, roads, buildings, palms, lights, lighthouse, traffic, peds, parked, oceanX: -168 };
}

export function clampToWorld(x, z) {
  const h = CFG.worldSize / 2 - 4;
  return { x: Math.max(-h, Math.min(h, x)), z: Math.max(-h, Math.min(h, z)) };
}

export function nearestRoad(x, z) {
  // Distance to the closest grid road centre — used to keep cars on roads.
  const s = CFG.blockSize;
  const dx = Math.abs(((x + s / 2) % s + s) % s - s / 2);
  const dz = Math.abs(((z + s / 2) % s + s) % s - s / 2);
  return Math.min(dx, dz);
}

export { SUNSET };
