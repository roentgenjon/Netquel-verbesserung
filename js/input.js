/**
 * Unified input handler — keyboard, mouse, and touch.
 * Supports both WASD (new) and Arrow keys (classic) controls.
 */
class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, left: false, right: false, middle: false };
    this.wheel = 0;
    this.chatMode = false;
    this._handlers = {};

    this._bind();
  }

  _bind() {
    const el = window;

    el.addEventListener('keydown', e => this._onKeyDown(e));
    el.addEventListener('keyup', e => this._onKeyUp(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvas.addEventListener('mouseup', e => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', e => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onKeyDown(e) {
    if (this.chatMode) return;
    this.keys[e.code] = true;
    this.keys[e.key] = true;
    this._emit('keydown', e);
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
    this.keys[e.key] = false;
    this._emit('keyup', e);
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
  }

  _onMouseDown(e) {
    if (e.button === 0) this.mouse.left = true;
    if (e.button === 1) { this.mouse.middle = true; e.preventDefault(); }
    if (e.button === 2) this.mouse.right = true;
    this._emit('mousedown', e);
  }

  _onMouseUp(e) {
    if (e.button === 0) this.mouse.left = false;
    if (e.button === 1) this.mouse.middle = false;
    if (e.button === 2) this.mouse.right = false;
    this._emit('mouseup', e);
  }

  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  }

  off(event, handler) {
    if (!this._handlers[event]) return;
    this._handlers[event] = this._handlers[event].filter(h => h !== handler);
  }

  _emit(event, data) {
    if (!this._handlers[event]) return;
    for (const h of this._handlers[event]) h(data);
  }

  isDown(code) { return !!this.keys[code]; }

  // ── WASD / Arrow movement ──
  get thrust() {
    return this.isDown('KeyW') || this.isDown('ArrowUp') || this.isDown('w') || this.isDown('W');
  }
  get reverse() {
    return this.isDown('KeyS') || this.isDown('ArrowDown') || this.isDown('s') || this.isDown('S');
  }
  get rotateLeft() {
    return this.isDown('KeyA') || this.isDown('ArrowLeft') || this.isDown('a') || this.isDown('A');
  }
  get rotateRight() {
    return this.isDown('KeyD') || this.isDown('ArrowRight') || this.isDown('d') || this.isDown('D');
  }
  get boost() {
    return this.isDown('KeyE') || this.isDown('e') || this.isDown('E');
  }
  get fire() {
    return this.isDown('Space') || this.mouse.left;
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
}
