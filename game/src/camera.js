// camera.js — chase camera that springs behind the velocity vector, never snaps.
// C toggles to a cockpit view from the canopy.

import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase'; // 'chase' | 'cockpit'
    this.shake = 0;      // 0..1, set by main.js (damage / impact shudder)
    this._pos = new THREE.Vector3(0, 200, 200);
    this._look = new THREE.Vector3(0, 100, 0);
    this._up = new THREE.Vector3(0, 1, 0);
  }

  toggle() { this.mode = this.mode === 'chase' ? 'cockpit' : 'chase'; }

  _applyShake() {
    if (this.shake <= 0) return;
    const s = this.shake * 0.9;
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s;
    this.camera.position.z += (Math.random() - 0.5) * s;
  }

  update(dt, flight, aircraftGroup) {
    const heading = flight.heading, pitch = flight.pitch, bank = flight.bank;
    const f = flight.forward();
    const px = flight.x, py = flight.y, pz = flight.z;

    if (this.mode === 'cockpit') {
      // Camera at the canopy, looking along the nose.
      const cx = px + f.x * 2 + Math.sin(heading) * 0.0;
      const cy = py + 0.9;
      const cz = pz + f.z * 2;
      this._pos.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 18));
      this._look.lerp(new THREE.Vector3(px + f.x * 120, py + f.y * 120, pz + f.z * 120), Math.min(1, dt * 18));
      this.camera.position.copy(this._pos);
      this.camera.up.set(Math.sin(bank) * 0.9, Math.cos(bank), 0);
      this.camera.lookAt(this._look);
      this._applyShake();
      return;
    }

    // Chase: behind and above, offset by speed, smoothed with a spring.
    const dist = 26 + flight.speedKts * 0.02;
    const height = 7 + flight.speedKts * 0.012;
    const backX = px - f.x * dist;
    const backY = py - f.y * dist + height;
    const backZ = pz - f.z * dist;
    const k = Math.min(1, dt * 3.2); // spring rate: smooth, never a snap
    this._pos.lerp(new THREE.Vector3(backX, backY, backZ), k);
    const lookX = px + f.x * 60, lookY = py + f.y * 60 - 1, lookZ = pz + f.z * 60;
    this._look.lerp(new THREE.Vector3(lookX, lookY, lookZ), Math.min(1, dt * 6));
    this.camera.position.copy(this._pos);
    // Roll the camera a little with the bank so the horizon feels alive.
    this._up.set(Math.sin(bank) * 0.35, Math.cos(bank * 0.35), 0);
    this.camera.up.copy(this._up);
    this.camera.lookAt(this._look);
    this._applyShake();
    void aircraftGroup; void pitch;
  }
}
