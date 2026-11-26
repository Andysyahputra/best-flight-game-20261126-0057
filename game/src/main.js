// main.js — IRON GASSER entry point: render loop + state machine (menu / sortie / debrief).
// Wires input, flight model, terrain, sky, aircraft, camera, HUD, missions and audio.

import * as THREE from 'three';
import { Input } from './input.js';
import { FlightState, clamp } from './flight.js';
import { buildTerrain, terrainHeight, RUNWAY, DIRT_STRIP } from './terrain.js';
import { buildSky } from './sky.js';
import { buildAircraft } from './aircraft.js';
import { ChaseCamera } from './camera.js';
import { Hud } from './hud.js';
import { MissionManager, MISSIONS } from './missions.js';
import { GameAudio } from './audio.js';

const SEED = 20261126;
const params = new URLSearchParams(location.search);
const shot = params.get('shot');

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc98d5f, 1500, 7500);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 20000);

buildTerrain(scene, SEED);
const sky = buildSky(scene, SEED);
const aircraft = buildAircraft();
scene.add(aircraft.group);
aircraft.group.rotation.order = 'YXZ';

const input = new Input();
const flight = new FlightState();
const chase = new ChaseCamera(camera);
const hud = new Hud(document.getElementById('hud'));
const missions = new MissionManager(scene, SEED);
const audio = new GameAudio();

// --- Revision 2: damage smoke trail + camera shudder ---
// A pool of soft grey sprites trailing from the tail once the airframe is
// battered (damage >= 50%); the chase camera shudders with the damage too.
function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(60,60,60,0.8)');
  grad.addColorStop(0.6, 'rgba(80,80,80,0.4)');
  grad.addColorStop(1, 'rgba(80,80,80,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const smokeTex = makeSmokeTexture();
const smokePool = [];
for (let i = 0; i < 40; i++) {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: smokeTex, transparent: true, opacity: 0, depthWrite: false,
  }));
  spr.visible = false;
  scene.add(spr);
  smokePool.push({ spr, life: 0 });
}
let smokeIdx = 0;
function emitSmoke(x, y, z) {
  const p = smokePool[smokeIdx++ % smokePool.length];
  p.life = 1.6;
  p.spr.visible = true;
  p.spr.position.set(x, y, z);
  p.spr.scale.set(3, 3, 1);
  p.spr.material.opacity = 0.55;
}
function updateSmoke(dt) {
  for (const p of smokePool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.spr.visible = false; continue; }
    p.spr.position.y += dt * 3;
    const sc = 3 + (1.6 - p.life) * 6;
    p.spr.scale.set(sc, sc, 1);
    p.spr.material.opacity = 0.55 * (p.life / 1.6);
  }
}

let phase = 'menu'; // 'menu' | 'flying' | 'paused' | 'debrief'
let missionId = 0;
let lastCrashGuard = 0;

const $ = (id) => document.getElementById(id);

function show(el, on) { el.classList.toggle('hidden', !on); }

function startMission(id) {
  missionId = id;
  missions.start(id, flight);
  aircraft.setGear(flight.gearDown);
  aircraft.setFlaps(flight.flaps);
  phase = 'flying';
  show($('menu'), false);
  show($('pause'), false);
  show($('debrief'), false);
  audio.start();
  lastCrashGuard = flight.time;
}

function toMenu() {
  phase = 'menu';
  missions.reset();
  flight.reset(0, 1200, 0, 0);
  show($('menu'), true);
  show($('pause'), false);
  show($('debrief'), false);
}

function showDebrief(result) {
  phase = 'debrief';
  const ok = result.outcome === 'complete';
  $('debriefTitle').textContent = result.title;
  $('debriefTitle').style.color = ok ? '#8fe388' : '#ff8a3d';
  $('debriefText').textContent = result.detail;
  $('debriefStats').innerHTML =
    `Mission: <b>${MISSIONS[missionId].name}</b> &nbsp;·&nbsp; Score: <b>${result.score}</b> ` +
    `&nbsp;·&nbsp; Time: <b>${missions.fmtTime(result.elapsed)}</b> &nbsp;·&nbsp; ` +
    `Fuel left: <b>${Math.round(flight.fuel)}%</b> &nbsp;·&nbsp; Damage: <b>${Math.round(flight.damage)}%</b>`;
  show($('debrief'), true);
}

$('m1').addEventListener('click', () => startMission(1));
$('m2').addEventListener('click', () => startMission(2));
$('m3').addEventListener('click', () => startMission(3));
$('resumeBtn').addEventListener('click', () => { phase = 'flying'; show($('pause'), false); });
$('quitBtn').addEventListener('click', toMenu);
$('againBtn').addEventListener('click', () => startMission(missionId));
$('menuBtn').addEventListener('click', toMenu);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  hud.resize();
});

// --- Screenshot staging (?shot=...): deterministic scenes, real game code.
// The scene is staged at a fixed, plausible pose (aircraft, ring/strip, HUD values)
// and held there so a slow software renderer still captures the intended frame.
function stageShot() {
  if (shot === 'cover') {
    startMission(1);
    // Park the jet 600 m behind ring 1, slightly above it, banking toward it.
    const ring = missions.rings[0];
    const dx = ring.position.x - flight.x, dz = ring.position.z - flight.z;
    const d = Math.hypot(dx, dz);
    const ux = dx / d, uz = dz / d;
    flight.x = ring.position.x - ux * 600;
    flight.z = ring.position.z - uz * 600;
    flight.y = ring.position.y + 25;
    flight.heading = Math.atan2(ux, -uz);
    flight.bank = 0.45;
    flight.pitch = -0.02;
    flight.speedKts = 480; flight.throttle = 0.9; flight.fuel = 78;
    missions.elapsed = 47;
    missions.flash('RING RUN — FLY THROUGH RING 1', '#ffb347', 999);
  } else if (shot === 'lowpass') {
    startMission(1);
    const ring = missions.rings[0];
    const dx = ring.position.x - flight.x, dz = ring.position.z - flight.z;
    const d = Math.hypot(dx, dz);
    const ux = dx / d, uz = dz / d;
    flight.x = ring.position.x - ux * 500;
    flight.z = ring.position.z - uz * 500;
    flight.y = terrainHeight(flight.x, flight.z, SEED) + 55;
    flight.heading = Math.atan2(ux, -uz);
    flight.speedKts = 520;
    flight.throttle = 0.95;
    // Bring ring 1 down to just above the deck for this staged low pass.
    missions.rings[0].position.y = flight.y + 80;
    missions.elapsed = 32;
    missions.flash('RING RUN — FLY THROUGH RING 1', '#ffb347', 999);
  } else if (shot === 'final') {
    startMission(3);
    // Warp to short final: 1.2 km out, gear + flaps down, on the glide path.
    const a = DIRT_STRIP.headingDeg * Math.PI / 180;
    flight.x = DIRT_STRIP.x - Math.sin(a) * 800;
    flight.z = DIRT_STRIP.z + Math.cos(a) * 800;
    flight.y = terrainHeight(DIRT_STRIP.x, DIRT_STRIP.z, SEED) + 110;
    flight.heading = a;
    flight.speedKts = 165;
    flight.throttle = 0.4;
    flight.gearDown = true;
    flight.flaps = true;
    aircraft.setGear(true);
    aircraft.setFlaps(true);
    missions.elapsed = 204;
    missions.flash('FERRY LANDING — DIRT STRIP AHEAD, FUEL 35%', '#ffb347', 999);
  }
  // Snap the chase camera onto the staged pose at once (no spring travel).
  if (shot !== 'menu') {
    aircraft.group.position.set(flight.x, flight.y, flight.z);
    aircraft.group.rotation.y = -flight.heading;
    aircraft.group.rotation.x = flight.pitch;
    aircraft.group.rotation.z = -flight.bank;
    chase.update(1, flight, aircraft.group);
  }
  // shot=menu (or none): stay on the mission-select menu.
}
if (shot) stageShot();

// Expose a small handle so automated checks can drive the game.
window.__game = {
  get phase() { return phase; },
  get missionId() { return missionId; },
  flight, missions,
  startMission, toMenu,
  get ringCount() { return missions.rings.length; },
};

// --- Main loop ---
const clock = new THREE.Clock();
let shotTime = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (phase === 'flying' && !shot) {
    // In ?shot= staging mode the pose is held fixed (see stageShot) so the
    // frame the screenshot captures is the staged one; live play is unaffected.
    // One-shot keys.
    if (input.pressed('KeyG') && flight.speedKts < 250) {
      flight.gearDown = !flight.gearDown;
      aircraft.setGear(flight.gearDown);
    }
    if (input.pressed('KeyF')) {
      flight.flaps = !flight.flaps;
      aircraft.setFlaps(flight.flaps);
    }
    if (input.pressed('KeyC')) chase.toggle();
    if (input.pressed('KeyR')) { startMission(missionId); input.endFrame(); return; }
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      phase = 'paused';
      show($('pause'), true);
      input.endFrame();
      return;
    }

    const mouse = input.consumeMouse();
    const ctrl = {
      throttleUp: input.down('KeyW') || input.down('ArrowUp'),
      throttleDown: input.down('KeyS') || input.down('ArrowDown'),
      rollLeft: input.down('KeyA') || input.down('ArrowLeft'),
      rollRight: input.down('KeyD') || input.down('ArrowRight'),
      pitchUp: input.down('ArrowUp'),
      pitchDown: input.down('ArrowDown'),
      airbrake: input.down('ShiftLeft') || input.down('ShiftRight'),
      mouseDX: mouse.dx,
      mouseDY: mouse.dy,
    };
    // Screenshot staging: hold a gentle right bank and level pitch on the cover shot.
    if (shot === 'cover') {
      ctrl.rollRight = true;
      ctrl.throttleUp = true;
    }
    if (shot === 'lowpass') ctrl.throttleUp = true;
    if (shot === 'final') { ctrl.throttleDown = false; }

    flight.update(dt, ctrl);
    const result = missions.update(dt, flight, input, audio);
    if (result && result.status !== 'flying') {
      showDebrief(result);
    }
    audio.update(flight.throttle, flight.speedKts, flight.afterburner);
    void lastCrashGuard;
  } else if (phase === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      phase = 'flying';
      show($('pause'), false);
    }
    if (input.pressed('KeyR')) { startMission(missionId); }
  }

  // Aircraft follows the flight state.
  aircraft.group.position.set(flight.x, flight.y, flight.z);
  aircraft.group.rotation.y = -flight.heading;
  aircraft.group.rotation.x = flight.pitch;
  aircraft.group.rotation.z = -flight.bank;
  aircraft.setBankVisual(flight.bank);
  aircraft.setAfterburner(flight.afterburner, flight.throttle);

  // Menu idle: slow orbit around the parked jet on the runway.
  if (phase === 'menu') {
    const t = performance.now() * 0.00008;
    const y = terrainHeight(RUNWAY.x, RUNWAY.z, SEED);
    aircraft.group.position.set(RUNWAY.x, y + 2.2, RUNWAY.z);
    aircraft.group.rotation.set(0, -RUNWAY.headingDeg * Math.PI / 180, 0);
    camera.position.set(
      RUNWAY.x + Math.sin(t) * 55,
      y + 18 + Math.sin(t * 0.7) * 4,
      RUNWAY.z + Math.cos(t) * 55,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(RUNWAY.x, y + 3, RUNWAY.z);
  } else {
    chase.update(dt, flight, aircraft.group);
  }

  sky.update(dt);

  // Damage smoke + shudder while flying battered.
  if (phase === 'flying' && flight.damage >= 50) {
    const f = flight.forward();
    emitSmoke(flight.x - f.x * 4, flight.y - f.y * 4, flight.z - f.z * 4);
    emitSmoke(flight.x - f.x * 4 + 1, flight.y - f.y * 4, flight.z - f.z * 4);
    chase.shake = clamp(flight.damage / 160, 0, 0.6);
  } else {
    chase.shake = 0;
  }
  updateSmoke(dt);

  // HUD state.
  const m = missions.hudState(flight);
  hud.draw({
    phase,
    altFt: flight.altFt,
    vspeed: flight.vspeed,
    speedKts: flight.speedKts,
    fuel: flight.fuel,
    damage: flight.damage,
    headingDeg: flight.headingDeg,
    pitchDeg: flight.pitch * 180 / Math.PI,
    throttle: flight.throttle,
    afterburner: flight.afterburner,
    gearDown: flight.gearDown,
    flaps: flight.flaps,
    flameout: flight.flameout,
    time: flight.time,
    timerText: m.timerText,
    objective: m.objective,
    waypointText: m.waypointText,
    flashText: missions.flashText,
    flashUntil: missions.flashUntil,
    flashColor: missions.flashColor,
    terrainWarning: phase === 'flying' && (flight.y - terrainHeight(flight.x, flight.z, SEED)) < 120 && flight.vspeed < 0,
  });

  renderer.render(scene, camera);
  if (shot) shotTime += dt;
  input.endFrame();
}
frame();
