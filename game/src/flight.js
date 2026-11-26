// flight.js — arcade flight model for IRON GASSER.
// State is metres / radians / knots. Control authority scales with speed:
// mushy when slow, crisp when fast. Fuel burns with throttle; damage degrades handling.

export const KTS_TO_MS = 0.514444;
export const MS_TO_FT = 3.28084;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Deterministic seeded RNG (mulberry32) so terrain and missions repeat per seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class FlightState {
  constructor() {
    this.reset(0, 1200, 0, 0);
  }

  reset(x, altM, z, headingDeg) {
    this.x = x; this.y = altM; this.z = z;
    this.heading = headingDeg * Math.PI / 180; // 0 = north (-z), clockwise
    this.pitch = 0;                            // radians, + = nose up
    this.bank = 0;                             // radians, + = right wing down
    this.speedKts = 240;
    this.throttle = 0.62;                      // 0..1, >0.85 = afterburner
    this.fuel = 100;                           // percent
    this.damage = 0;                           // percent
    this.gearDown = false;
    this.flaps = false;
    this.vspeed = 0;                           // m/s, + = climbing
    this.flameout = false;
    this.airbrake = false;
    this.gust = 0;                             // crosswind gust, m/s
    this.time = 0;
  }

  get altFt() { return this.y * MS_TO_FT; }
  get headingDeg() { return ((this.heading * 180 / Math.PI) % 360 + 360) % 360; }
  get afterburner() { return this.throttle > 0.85 && !this.flameout; }

  // Forward unit vector from heading + pitch.
  forward() {
    const cp = Math.cos(this.pitch);
    return {
      x: Math.sin(this.heading) * cp,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.heading) * cp,
    };
  }

  update(dt, ctrl) {
    this.time += dt;
    const handling = this.damage >= 50 ? 0.55 : 1; // battered airframe answers sluggishly
    const speedMs = this.speedKts * KTS_TO_MS;

    // Throttle.
    if (ctrl.throttleUp) this.throttle = clamp(this.throttle + dt * 0.45, 0, 1);
    if (ctrl.throttleDown) this.throttle = clamp(this.throttle - dt * 0.45, 0, 1);
    this.airbrake = !!ctrl.airbrake;

    // Target speed from throttle; drag from gear/flaps/brake; flameout glides down.
    let targetKts = this.flameout ? 0 : 120 + this.throttle * 420;
    if (this.gearDown) targetKts -= 25;
    if (this.flaps) targetKts -= 30;
    if (this.airbrake) targetKts -= 90;
    const accel = this.flameout ? 18 : 55;
    this.speedKts += clamp(targetKts - this.speedKts, -accel * dt, accel * dt);
    this.speedKts = Math.max(0, this.speedKts);

    // Authority: full above ~250 kts, weak below ~120 kts.
    const authority = clamp((this.speedKts - 90) / 220, 0.15, 1) * handling;

    // Bank from roll input, springs back toward level.
    const rollIn = (ctrl.rollRight ? 1 : 0) - (ctrl.rollLeft ? 1 : 0);
    const targetBank = rollIn * 1.05 + (ctrl.mouseDX || 0) * 0.0016;
    this.bank += clamp(targetBank - this.bank, -2.2 * authority * dt, 2.2 * authority * dt);
    this.bank = clamp(this.bank, -1.25, 1.25);
    if (!rollIn) this.bank *= Math.max(0, 1 - 0.9 * dt);

    // Heading follows bank; pitch from trim input + mouse.
    this.heading = wrapAngle(this.heading + Math.tan(this.bank) * (speedMs / 220) * dt * 0.9);
    const pitchIn = (ctrl.pitchUp ? 1 : 0) - (ctrl.pitchDown ? 1 : 0);
    const targetPitch = clamp(pitchIn * 0.22 + (ctrl.mouseDY || 0) * -0.0009, -0.3, 0.3);
    this.pitch += clamp(targetPitch - this.pitch, -1.4 * authority * dt, 1.4 * authority * dt);
    if (!pitchIn && !ctrl.mouseDY) this.pitch *= Math.max(0, 1 - 0.6 * dt);

    // Stall: below 130 kts the nose drops and sink grows.
    const stall = this.speedKts < 130 ? (130 - this.speedKts) / 130 : 0;

    // Vertical speed: pitch component, minus stall sink, plus flap lift.
    const climb = Math.sin(this.pitch) * speedMs;
    this.vspeed = climb - stall * 14 + (this.flaps ? 1.5 : 0) - (this.flameout ? 4 : 0);
    this.y += this.vspeed * dt;

    // Move along the velocity vector (heading + pitch), plus crosswind drift.
    const f = this.forward();
    this.x += f.x * speedMs * dt + this.gust * dt * 0.4;
    this.z += f.z * speedMs * dt;

    // Fuel burn: idle sips, afterburner gulps.
    if (!this.flameout) {
      const burn = (0.10 + this.throttle * 0.55 + (this.afterburner ? 0.9 : 0)) * dt;
      this.fuel = Math.max(0, this.fuel - burn);
      if (this.fuel <= 0) { this.fuel = 0; this.flameout = true; }
    }
    if (this.y > 6000) this.y = 6000; // service ceiling
  }

  addDamage(amount) {
    this.damage = clamp(this.damage + amount, 0, 100);
    return this.damage >= 100;
  }
}
