// sky.js — dawn sky dome, low sun and drifting cloud billboards for IRON GASSER.
// One warm dawn style, shared by every mission.

import * as THREE from 'three';
import { mulberry32 } from './flight.js';

export function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1c3a5e');  // zenith, deep blue
  grad.addColorStop(0.45, '#5d7ea6'); // mid sky
  grad.addColorStop(0.72, '#e8a56b'); // dawn band
  grad.addColorStop(0.86, '#ffb347'); // horizon glow
  grad.addColorStop(1.0, '#7a5a3a');  // below horizon
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const rng = mulberry32(4242);
  for (let i = 0; i < 26; i++) {
    const x = 30 + rng() * 196, y = 40 + rng() * 48, r = 14 + rng() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,244,230,0.55)');
    grad.addColorStop(1, 'rgba(255,244,230,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSky(scene, seed) {
  // Gradient dome.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(9000, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  dome.name = 'skyDome';
  scene.add(dome);

  // Low dawn sun: a glowing disc + warm directional light.
  const sunTexC = document.createElement('canvas');
  sunTexC.width = 128; sunTexC.height = 128;
  const sg = sunTexC.getContext('2d');
  const sgrad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  sgrad.addColorStop(0, 'rgba(255,240,200,1)');
  sgrad.addColorStop(0.35, 'rgba(255,190,100,0.9)');
  sgrad.addColorStop(1, 'rgba(255,150,60,0)');
  sg.fillStyle = sgrad; sg.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(sunTexC);
  sunTex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false }));
  sun.scale.set(1400, 1400, 1);
  sun.position.set(-5200, 900, -6800);
  scene.add(sun);

  const light = new THREE.DirectionalLight(0xffc98a, 2.6);
  light.position.set(-4000, 900, -5200);
  scene.add(light);
  scene.add(new THREE.HemisphereLight(0x8fb4d8, 0x4a3a28, 1.5));

  // Drifting cloud billboards.
  const cloudTex = makeCloudTexture();
  const rng = mulberry32(seed + 31);
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, fog: false, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    const sc = 500 + rng() * 700;
    spr.scale.set(sc, sc * 0.45, 1);
    spr.position.set((rng() - 0.5) * 11000, 700 + rng() * 500, (rng() - 0.5) * 11000);
    spr.userData.drift = 2 + rng() * 4;
    scene.add(spr);
    clouds.push(spr);
  }
  return {
    update(dt) {
      for (const cl of clouds) {
        cl.position.x += cl.userData.drift * dt;
        if (cl.position.x > 6000) cl.position.x = -6000;
      }
    },
  };
}
