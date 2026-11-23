// Palmar Bay — 8 story missions + street-race checkpoints + crew bonuses.
import { MISSIONS } from './config.js';

export class MissionManager {
  constructor() {
    this.list = MISSIONS;
    this.current = 0;           // index into list
    this.active = null;         // runtime state for the current mission
    this.completed = [];
    this.message = '';
    this.messageAt = 0;
  }
  get currentDef() { return this.list[this.current] || null; }
  get done() { return this.current >= this.list.length; }
  start(now) {
    const def = this.currentDef;
    if (!def) return;
    this.active = {
      def, startedAt: now, checkpoints: [],
      raceTime: def.type === 'race' ? 90 : null,
      raceLeft: def.type === 'race' ? 90 : null,
      enemies: def.type === 'shootout' ? 6 : def.type === 'chase' ? 3 : 0,
      enemiesLeft: def.type === 'shootout' ? 6 : def.type === 'chase' ? 3 : 0,
    };
    if (def.type === 'race') {
      const t = def.target;
      this.active.checkpoints = [
        { x: t.x, z: t.z - 60, hit: false }, { x: t.x + 60, z: t.z - 20, hit: false },
        { x: t.x + 40, z: t.z + 60, hit: false }, { x: t.x - 40, z: t.z + 40, hit: false },
      ];
    }
    this.say(`MISSION ${def.id}: ${def.name} — ${def.brief}`, now);
  }
  say(text, now) { this.message = text; this.messageAt = now; }
  distToTarget(p) {
    const def = this.currentDef;
    if (!def) return 0;
    return Math.hypot(def.target.x - p.x, def.target.z - p.z);
  }
  // Returns 'complete' | 'failed' | null. Mutates player cash via callback.
  update(dt, now, player, police, fx) {
    if (!this.active || this.done) return null;
    const a = this.active;
    const p = player.pos;
    if (a.def.type === 'race') {
      a.raceLeft -= dt;
      for (const cp of a.checkpoints) {
        if (!cp.hit && Math.hypot(cp.x - p.x, cp.z - p.z) < 12) { cp.hit = true; if (fx) fx.checkpoint = true; }
      }
      if (a.checkpoints.every((c) => c.hit)) return this.complete(now, player, fx);
      if (a.raceLeft <= 0) { this.fail(now, fx); return 'failed'; }
      return null;
    }
    if (a.def.type === 'escape') {
      if (police.wanted === 0 && now - a.startedAt > 5) return this.complete(now, player, fx);
      return null;
    }
    if (a.def.type === 'shootout' || a.def.type === 'chase') {
      if (a.enemiesLeft <= 0) return this.complete(now, player, fx);
      return null;
    }
    // drive / steal / deliver / finale: reach the marker.
    if (this.distToTarget(p) < 12) {
      if (a.def.type === 'finale' && police.wanted < 3) {
        this.say('The lighthouse is hot — you need at least 3 stars of heat for the finale!', now);
        return null;
      }
      return this.complete(now, player, fx);
    }
    return null;
  }
  complete(now, player, fx) {
    const def = this.active.def;
    player.addCash(def.reward);
    if (def.type === 'race') {
      const t = now - this.active.startedAt;
      if (!player.raceBest || t < player.raceBest) player.raceBest = Math.round(t * 10) / 10;
    }
    this.completed.push(def.id);
    this.say(`MISSION COMPLETE: ${def.name}  +$${def.reward}`, now);
    if (fx) fx.complete = true;
    this.current += 1;
    this.active = null;
    if (!this.done) this.start(now);
    else this.say('ALL MISSIONS DONE — you are the King of Palmar Bay!', now);
    return 'complete';
  }
  fail(now, fx) {
    this.say(`MISSION FAILED: ${this.active.def.name} — try again (press M to restart it)`, now);
    if (fx) fx.fail = true;
    this.active = null;
  }
  restart(now) {
    if (this.done) return;
    this.start(now);
  }
  serialize() { return { current: this.current, completed: this.completed }; }
  deserialize(s) {
    if (!s) return;
    this.current = s.current || 0;
    this.completed = s.completed || [];
  }
}
