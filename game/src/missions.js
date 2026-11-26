// missions.js — the three sorties of IRON GASSER, plus landing and crash detection.
// RING RUN: 8 rings in order, against the clock.
// INTERCEPT: tag 3 drone freighters by holding the crosshair on each for 2 s.
// FERRY LANDING: low fuel, crosswind gusts, put her on the 600 m dirt strip.

import * as THREE from 'three';
import { buildRing, buildFreighter } from './aircraft.js';
import { terrainHeight, RUNWAY, DIRT_STRIP, isOnStrip, WORLD_HALF } from './terrain.js';
import { clamp, mulberry32 } from './flight.js';

export const MISSIONS = {
  1: { name: 'RING RUN', desc: 'Thread 8 glowing rings in order, against the clock.' },
  2: { name: 'INTERCEPT', desc: 'Tag 3 drone freighters before they exit the map.' },
  3: { name: 'FERRY LANDING', desc: 'Low fuel, crosswind gusts. Land on the dirt strip.' },
};

const FT = 3.28084;

export class MissionManager {
  constructor(scene, seed) {
    this.scene = scene;
    this.seed = seed;
    this.group = new THREE.Group();
    this.group.name = 'missionObjects';
    scene.add(this.group);
    this.reset();
  }

  reset() {
    while (this.group.children.length) {
      const c = this.group.children[0];
      this.group.remove(c);
    }
    this.id = 0;
    this.rings = [];
    this.ringIndex = 0;
    this.freighters = [];
    this.lockTarget = null;
    this.lockProgress = 0;
    this.lockAttempts = 0;
    this.elapsed = 0;
    this.score = 0;
    this.ringsCleared = 0;
    this.freightersTagged = 0;
    this.result = null; // { outcome, title, detail, score }
    this.flashText = '';
    this.flashUntil = 0;
    this.flashColor = '#8fe388';
    this._warnedFuel = false;
  }

  flash(text, color = '#8fe388', seconds = 2.2) {
    this.flashText = text;
    this.flashColor = color;
    this.flashUntil = this.elapsed + seconds;
  }

  // --- Mission setup: positions the aircraft and builds the objective objects.
  start(id, flight) {
    this.reset();
    this.id = id;
    const rng = mulberry32(this.seed + id * 991);
    if (id === 1) {
      flight.reset(-1400, 1280, 1400, 45);
      flight.speedKts = 480; flight.throttle = 0.9; flight.fuel = 78;
      // 8 rings winding north-east across the ridges, 400-700 m apart.
      let x = -900, z = 900, alt = 1250, hdg = 45;
      for (let i = 0; i < 8; i++) {
        hdg += (rng() - 0.5) * 50;
        const step = 550 + rng() * 250;
        x += Math.sin(hdg * Math.PI / 180) * step;
        z -= Math.cos(hdg * Math.PI / 180) * step;
        alt = clamp(alt + (rng() - 0.5) * 260, 700, 1600);
        const ring = buildRing(26);
        ring.position.set(x, alt, z);
        ring.rotation.y = hdg * Math.PI / 180;
        ring.userData.index = i;
        this.group.add(ring);
        this.rings.push(ring);
      }
      this.flash('RING RUN — FLY THROUGH RING 1', '#ffb347', 3);
    } else if (id === 2) {
      flight.reset(0, 1000, 1800, 0);
      flight.speedKts = 380; flight.throttle = 0.75; flight.fuel = 90;
      // 3 freighters crossing west-to-east at different lanes and altitudes.
      const lanes = [-1400, -200, 1000];
      for (let i = 0; i < 3; i++) {
        const f = buildFreighter();
        const z = lanes[i];
        f.position.set(-2600 + i * 300, 850 + i * 120, z);
        f.rotation.y = Math.PI / 2; // facing +x
        f.userData.vel = new THREE.Vector3(95 + i * 12, 0, 0);
        f.userData.tagged = false;
        f.userData.exited = false;
        f.userData.lock = 0;
        this.group.add(f);
        this.freighters.push(f);
      }
      this.flash('INTERCEPT — HOLD SPACE ON A FREIGHTER TO TAG IT', '#ffb347', 3);
    } else {
      // Ferry: 8 km out from the dirt strip, low fuel, gusty crosswind.
      const a = DIRT_STRIP.headingDeg * Math.PI / 180;
      const sx = DIRT_STRIP.x - Math.sin(a) * 8000;
      const sz = DIRT_STRIP.z + Math.cos(a) * 8000;
      flight.reset(sx, 1850, sz, DIRT_STRIP.headingDeg);
      flight.speedKts = 300; flight.throttle = 0.55; flight.fuel = 35;
      flight.gearDown = false;
      this.flash('FERRY LANDING — DIRT STRIP AHEAD, FUEL 35%', '#ffb347', 3);
    }
  }

  // Bearing + range to a point, for the HUD waypoint line.
  waypointTo(flight, x, y, z) {
    const dx = x - flight.x, dz = z - flight.z;
    const distM = Math.hypot(dx, dz);
    const brg = ((Math.atan2(dx, -dz) * 180 / Math.PI) % 360 + 360) % 360;
    const rel = Math.round(((brg - flight.headingDeg) % 360 + 540) % 360 - 180);
    const arrow = rel > 10 ? '▶' : rel < -10 ? '◀' : '▲';
    return `${arrow} ${String(Math.round(brg)).padStart(3, '0')}°  ${(distM / 1852).toFixed(1)} NM  ${Math.round((y - flight.y) * FT)} FT`;
  }

  update(dt, flight, input, audio) {
    if (this.result) return this.result;
    this.elapsed += dt;
    const out = { status: 'flying' };

    // Crosswind gusts on the ferry sortie.
    if (this.id === 3) {
      flight.gust = Math.sin(this.elapsed * 0.45) * 9 + Math.sin(this.elapsed * 1.3) * 4;
    } else {
      flight.gust = 0;
    }

    // --- Ring Run ---
    if (this.id === 1 && this.ringIndex < this.rings.length) {
      const ring = this.rings[this.ringIndex];
      ring.rotation.z += dt * 0.4;
      const d = Math.hypot(
        flight.x - ring.position.x, flight.y - ring.position.y, flight.z - ring.position.z,
      );
      if (d < 24) {
        this.ringIndex++;
        this.ringsCleared++;
        this.score += 1000;
        ring.visible = false;
        audio.ringChime();
        if (this.ringIndex < this.rings.length) {
          this.flash(`RING ${this.ringIndex} CLEARED — ${this.rings.length - this.ringIndex} TO GO`);
        } else {
          const bonus = Math.max(0, Math.round((300 - this.elapsed) * 10));
          this.score += bonus;
          this.finish('complete', 'RING RUN COMPLETE',
            `All 8 rings cleared in ${this.fmtTime(this.elapsed)}. Time bonus +${bonus}.`);
          return this.result;
        }
      }
    }

    // --- Intercept ---
    if (this.id === 2) {
      for (const f of this.freighters) {
        if (f.userData.tagged || f.userData.exited) continue;
        f.position.addScaledVector(f.userData.vel, dt);
        f.userData.beacon.material.color.setHex(
          Math.floor(this.elapsed * 4) % 2 ? 0xff3333 : 0x881111,
        );
        if (Math.abs(f.position.x) > WORLD_HALF || Math.abs(f.position.z) > WORLD_HALF) {
          f.userData.exited = true;
          f.visible = false;
          this.flash('FREIGHTER ESCAPED THE MAP', '#ff8a3d');
        }
      }
      const remaining = this.freighters.filter((f) => !f.userData.tagged && !f.userData.exited);
      if (remaining.length === 0) {
        if (this.freightersTagged === 3) {
          this.score += 1500;
          this.finish('complete', 'INTERCEPT COMPLETE',
            'All 3 freighters tagged. The ridge line is clear.');
        } else {
          this.finish('failed', 'FREIGHTERS ESCAPED',
            `${this.freightersTagged} of 3 tagged. The rest slipped past the ridge line.`);
        }
        return this.result;
      }
      // Lock: freighter near the crosshair + Space held.
      let best = null, bestAng = Infinity;
      const fwd = flight.forward();
      for (const f of remaining) {
        const dx = f.position.x - flight.x, dy = f.position.y - flight.y, dz = f.position.z - flight.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > 2200) continue;
        const dot = (fwd.x * dx + fwd.y * dy + fwd.z * dz) / dist;
        const ang = Math.acos(clamp(dot, -1, 1)) * 180 / Math.PI;
        if (ang < bestAng) { bestAng = ang; best = { f, dist, ang }; }
      }
      if (best && best.ang < 6 && input.down('Space')) {
        if (this.lockTarget !== best.f) { this.lockTarget = best.f; this.lockProgress = 0; }
        this.lockProgress += dt / 2;
        if (Math.floor(this.lockProgress * 10) !== Math.floor((this.lockProgress - dt / 2) * 10)) audio.lockBeep();
        if (this.lockProgress >= 1) {
          best.f.userData.tagged = true;
          best.f.visible = false;
          this.freightersTagged++;
          this.score += 1000;
          this.lockTarget = null; this.lockProgress = 0;
          audio.lockDone();
          this.flash(`FREIGHTER TAGGED — ${3 - this.freightersTagged} LEFT`);
        }
      } else {
        this.lockTarget = null;
        this.lockProgress = 0;
      }
    }

    // --- Terrain / landing / crash ---
    const ground = terrainHeight(flight.x, flight.z, this.seed);
    const agl = flight.y - ground;
    if (agl <= 1.5) {
      const onRunway = isOnStrip(flight.x, flight.z, RUNWAY);
      const onDirt = isOnStrip(flight.x, flight.z, DIRT_STRIP);
      const onStrip = onRunway || onDirt;
      const gentle = flight.vspeed > -8;
      const slow = flight.speedKts < 205;
      if (onStrip && flight.gearDown && gentle && slow) {
        audio.impact();
        if (this.id === 3) {
          const fuelBonus = Math.round(flight.fuel * 10);
          this.score += 2000 + fuelBonus;
          this.finish('complete', 'LANDED — MISSION COMPLETE',
            `Touchdown on the dirt strip. Sink ${Math.abs(Math.round(flight.vspeed * 196.85))} FPM, ` +
            `fuel ${Math.round(flight.fuel)}% left. Fuel bonus +${fuelBonus}.`);
        } else if (this.id === 1 && this.ringIndex >= this.rings.length) {
          this.finish('complete', 'LANDED — MISSION COMPLETE', 'Rings done, wheels down. Sortie complete.');
        } else {
          this.finish('complete', 'LANDED — SORTIE OVER',
            'Wheels down on a strip, but the objective was not finished.');
        }
        return this.result;
      }
      // Any other ground contact is a crash (or a hard landing).
      const hard = flight.vspeed < -8 || flight.speedKts > 205;
      const broke = flight.addDamage(hard ? 100 : 60);
      audio.impact();
      this.finish('crashed', 'CRASHED',
        hard
          ? `Hard impact — sink ${Math.abs(Math.round(flight.vspeed * 196.85))} FPM at ${Math.round(flight.speedKts)} kts. The airframe broke up.`
          : 'Terrain strike. The ridge wins this time.');
      void broke;
      return this.result;
    }

    // Low-fuel warning beep once.
    if (flight.fuel < 20 && !this._warnedFuel) {
      this._warnedFuel = true;
      audio.warning();
      this.flash('LOW FUEL', '#ff4444', 2.5);
    }
    // Damage from scraping ridges at very low AGL is handled by the crash check above.

    // Ferry: flameout far from the strip with no hope = failed sortie.
    if (flight.flameout && this.id === 3) {
      const d = Math.hypot(flight.x - DIRT_STRIP.x, flight.z - DIRT_STRIP.z);
      if (d > 6000 && agl < 300) {
        this.finish('failed', 'OUT OF FUEL — SORTIE LOST', 'Flameout too far from the strip to glide home.');
        return this.result;
      }
    }
    return out;
  }

  finish(outcome, title, detail) {
    this.result = { outcome, title, detail, score: this.score, elapsed: this.elapsed };
  }

  fmtTime(s) {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  // HUD strings for this mission.
  hudState(flight) {
    let objective = '', waypointText = '', timerText = this.fmtTime(this.elapsed);
    if (this.id === 1) {
      objective = `RING RUN — RING ${Math.min(this.ringIndex + 1, 8)} OF 8`;
      const ring = this.rings[this.ringIndex];
      if (ring) waypointText = this.waypointTo(flight, ring.position.x, ring.position.y, ring.position.z);
      if (this.lockTarget) waypointText += '';
    } else if (this.id === 2) {
      objective = `INTERCEPT — TAG ${this.freightersTagged} / 3 FREIGHTERS`;
      const next = this.freighters.find((f) => !f.userData.tagged && !f.userData.exited);
      if (next) waypointText = this.waypointTo(flight, next.position.x, next.position.y, next.position.z);
      if (this.lockTarget) {
        const pct = Math.round(this.lockProgress * 100);
        waypointText = `LOCKING… ${pct}% — KEEP THE CROSSHAIR ON IT`;
      }
    } else if (this.id === 3) {
      objective = 'FERRY LANDING — DIRT STRIP, GEAR DOWN, GENTLE SINK';
      waypointText = this.waypointTo(flight, DIRT_STRIP.x, terrainHeight(DIRT_STRIP.x, DIRT_STRIP.z, this.seed), DIRT_STRIP.z);
      if (Math.abs(flight.gust) > 5) {
        waypointText += `   GUST ${flight.gust > 0 ? '→' : '←'} ${Math.abs(Math.round(flight.gust))} M/S`;
      }
    }
    return { objective, waypointText, timerText };
  }
}
