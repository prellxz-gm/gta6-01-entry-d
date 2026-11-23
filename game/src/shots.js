// Palmar Bay — ?shot= scene presets for deterministic screenshots.
// start: title camera over the beach. play: driving downtown.
// chase: 5-star pursuit with heli + roadblocks. end: finale at the lighthouse.
export const SHOTS = {
  start: { wanted: 0, inCar: false, px: -120, pz: 40, heading: 1.9, cam: 'wide' },
  play: { wanted: 1, inCar: true, px: 20, pz: 20, heading: 0.6, cam: 'chase' },
  chase: { wanted: 5, inCar: true, px: 0, pz: -60, heading: 0, cam: 'chase' },
  end: { wanted: 0, inCar: false, px: -170, pz: -160, heading: -2.62, cam: 'wide' },
};

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seed = parseInt(q.get('seed') || '1', 10) || 1;
  const auto = q.get('auto') === '1';
  return { shot: SHOTS[shot] ? shot : null, seed, auto };
}

export function applyShot(game, name) {
  const s = SHOTS[name];
  if (!s || !game) return;
  game.police.setWanted(s.wanted);
  if (name === 'chase') {
    // Seed a hot pursuit: cops close, heli overhead.
    game.player.x = s.px; game.player.z = s.pz;
    game.player.inCar = { id: 'shotcar', x: s.px, z: s.pz, rot: s.heading, speed: 30, color: 0xd21f3c, hp: 100 };
    game.player.heading = s.heading;
    for (const cop of game.police.cops) cop.placed = false;
  } else if (name === 'play') {
    game.player.x = s.px; game.player.z = s.pz;
    game.player.inCar = { id: 'shotcar', x: s.px, z: s.pz, rot: s.heading, speed: 22, color: 0x1f6fd2, hp: 100 };
    game.player.heading = s.heading;
  } else if (name === 'end') {
    game.player.x = s.px; game.player.z = s.pz;
    game.player.heading = s.heading;
    game.missions.current = 7;
    game.missions.start(0);
  } else {
    game.player.x = s.px; game.player.z = s.pz;
    game.player.heading = s.heading;
  }
}
