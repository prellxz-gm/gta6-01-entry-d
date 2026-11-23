// Palmar Bay — config. All tuning + content data in one place.
// Sunset coastal open-world crime game. Deterministic: everything seeded.
export const CFG = {
  title: 'PALMAR BAY',
  subtitle: 'Sunset Coast • Open-World Crime',
  seed: 1337,
  worldSize: 460,          // playable square, metres
  blockSize: 46,
  roadWidth: 12,
  fixedDt: 1 / 60,
  walkSpeed: 7,
  runSpeed: 11,
  carAccel: 26,
  carMaxSpeed: 46,         // ~165 km/h
  carBrake: 40,
  carTurn: 2.1,
  wantedDecayMs: 9000,
  maxWanted: 5,
  startCash: 250,
  saveKey: 'palmar-bay-save-v1',
};

export const SUNSET = {
  skyTop: 0x2b1b4d,
  skyMid: 0xff7a3d,
  skyLow: 0xffc46b,
  sunColor: 0xffb347,
  fogColor: 0xdd7a4a,
  ambient: 0x8a5a7a,
  hemiSky: 0xff9a5c,
  hemiGround: 0x2c2140,
  ocean: 0x1d4e6b,
  sand: 0xe8c98f,
  road: 0x2e2a33,
  sidewalk: 0x6b5a52,
};

export const CAR_COLORS = [0xd21f3c, 0x1f6fd2, 0xf2b705, 0x20b2a6, 0xe8e8e8, 0x222222, 0x7a3fd2, 0xff7a1a];
export const BUILDING_COLORS = [0x3d2b52, 0x51355e, 0x2c3a5e, 0x5e3547, 0x37474f, 0x6b4a2f, 0x44546a, 0x7a4a5e];

// 8 story missions. type: drive | chase | race | steal | deliver | shootout | escape | finale
export const MISSIONS = [
  { id: 1, name: 'Welcome to Palmar Bay', giver: 'Rico', type: 'drive',
    brief: 'Rico needs his ride back. Drive to the pink motel and pick up the package.',
    reward: 300, target: { x: 92, z: -92 }, hint: 'Follow the yellow marker. Drive with W A S D.' },
  { id: 2, name: 'Hot Wheels', giver: 'Rico', type: 'steal',
    brief: 'A rival crew left a sports car by the pier. Steal it — press E near any car — and bring it to the garage.',
    reward: 500, target: { x: -138, z: 92 }, hint: 'Press E next to a car to steal it. Wanted rises!' },
  { id: 3, name: 'Beachfront Sprint', giver: 'Marisol', type: 'race',
    brief: 'Street race along Ocean Drive. Hit all 4 checkpoints before the timer runs out.',
    reward: 800, target: { x: 0, z: 138 }, hint: 'Race! Checkpoints glow green. Beat 90 seconds.' },
  { id: 4, name: 'Payback at the Pier', giver: 'Marisol', type: 'shootout',
    brief: 'Rival thugs hold the pier. Clear them out — pistol (1/2 to swap, click to shoot).',
    reward: 1000, target: { x: -138, z: 138 }, hint: 'Aim with the mouse, click to shoot. Watch your health.' },
  { id: 5, name: 'Midnight Courier', giver: 'Dex', type: 'deliver',
    brief: 'Deliver the package across town to the north docks. Cops are watching — stay cool.',
    reward: 1200, target: { x: 138, z: -138 }, hint: 'Deliver fast. Wanted 2+ brings patrol cars.' },
  { id: 6, name: 'Heat Wave', giver: 'Dex', type: 'escape',
    brief: 'The job went loud. Lose a 3-star wanted level — break line of sight and stay hidden.',
    reward: 1500, target: { x: -92, z: -46 }, hint: 'Escape! Hide in alleys until the stars fade.' },
  { id: 7, name: 'Crew Up', giver: 'Marisol', type: 'chase',
    brief: 'Your crew is pinned down downtown. Chase the convoy and free them — ram their cars off the road.',
    reward: 2000, target: { x: 46, z: 46 }, hint: 'Ram the convoy cars. Your crew fights beside you.' },
  { id: 8, name: 'King of Palmar Bay', giver: 'Rico', type: 'finale',
    brief: 'Finale: outrun a 5-star manhunt — helicopter, roadblocks, everything — and reach the lighthouse.',
    reward: 5000, target: { x: -184, z: -184 }, hint: '5 stars. Helicopter above. Reach the lighthouse alive.' },
];

export const RADIO = [
  { id: 'sunset-fm', name: 'SUNSET FM', desc: 'Synthwave drive', base: 110, wave: 'sawtooth', minor: true },
  { id: 'palmar-98', name: 'PALMAR 98.2', desc: 'Latin coast pop', base: 132, wave: 'triangle', minor: false },
  { id: 'bay-talk', name: 'BAY TALK', desc: 'Bass-heavy beats', base: 96, wave: 'square', minor: true },
];

export const GARAGE_UPGRADES = [
  { id: 'engine', name: 'Turbo Engine', cost: 600, desc: '+25% top speed' },
  { id: 'armor', name: 'Armored Plates', cost: 800, desc: 'Car takes 2x damage' },
  { id: 'nitro', name: 'Nitro Boost', cost: 1000, desc: 'SHIFT = nitro burst' },
];

export const CREW = [
  { id: 'rico', name: 'Rico', role: 'Driver — rams pursuers', cost: 0 },
  { id: 'marisol', name: 'Marisol', role: 'Shooter — fires from your car', cost: 1500 },
  { id: 'dex', name: 'Dex', role: 'Hacker — wanted fades 2x faster', cost: 2500 },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', key: '1', damage: 25, range: 2.2, rate: 400 },
  { id: 'pistol', name: 'Pistol', key: '2', damage: 34, range: 60, rate: 260 },
  { id: 'smg', name: 'SMG', key: '3', damage: 18, range: 45, rate: 90 },
];
