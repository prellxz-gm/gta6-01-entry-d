// Palmar Bay — keyboard + pointer input. Fixed key map, no surprises.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed each tick
    this.mouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.onKey = null; // callback(code) for UI shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (this.onKey) this.onKey(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousedown', (e) => { this.mouseDown = true; this.mouseX = e.clientX; this.mouseY = e.clientY; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  endTick() { this.pressed.clear(); }
  get forward() { return this.down('KeyW') || this.down('ArrowUp'); }
  get back() { return this.down('KeyS') || this.down('ArrowDown'); }
  get left() { return this.down('KeyA') || this.down('ArrowLeft'); }
  get right() { return this.down('KeyD') || this.down('ArrowRight'); }
  get run() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
}
