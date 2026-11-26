// input.js — keyboard + mouse state for IRON GASSER. One job: read the pilot.

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseActive = false;
    this._pressed = new Set();
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouse = (e) => {
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
      this.mouseActive = true;
    };
    this._onBlur = () => { this.keys.clear(); };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouse);
    window.addEventListener('blur', this._onBlur);
  }

  down(code) { return this.keys.has(code); }

  // True once, on the frame the key went down; consumed by endFrame().
  pressed(code) { return this._pressed.has(code); }

  // Mouse trim for this frame, then cleared.
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() { this._pressed.clear(); }
}
