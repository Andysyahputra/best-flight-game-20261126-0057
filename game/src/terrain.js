// terrain.js — procedural ridge terrain for IRON GASSER.
// One deterministic height function shared by the mesh and by collision:
// dark teal basalt ridges, ochre silt flats, a river valley, a runway and a dirt strip.

import * as THREE from 'three';
import { mulberry32 } from './flight.js';

export const WORLD_SIZE = 6000;   // metres, square
export const WORLD_HALF = WORLD_SIZE / 2;

// Runway (paved, heading 090/270) and dirt strip (heading 045), both flattened.
export const RUNWAY = { x: 0, z: 0, headingDeg: 90, length: 900, width: 40 };
export const DIRT_STRIP = { x: 1900, z: -1600, headingDeg: 45, length: 600, width: 30 };

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function valueNoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx), v = smooth(fz);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
}

function fbm(x, z, seed) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(x * freq, z * freq, seed + o * 101) * amp;
    norm += amp; amp *= 0.5; freq *= 2.1;
  }
  return sum / norm; // roughly -1..1
}

// Distance from (x,z) to the centre line of a strip, in metres along/across.
function stripCoords(x, z, strip) {
  const a = strip.headingDeg * Math.PI / 180;
  const dx = x - strip.x, dz = z - strip.z;
  const along = dx * Math.sin(a) - dz * Math.cos(a);
  const across = dx * Math.cos(a) + dz * Math.sin(a);
  return { along, across };
}

export function isOnStrip(x, z, strip, margin = 0) {
  const s = stripCoords(x, z, strip);
  return Math.abs(s.along) <= strip.length / 2 + margin &&
         Math.abs(s.across) <= strip.width / 2 + margin;
}

// Raw ridge height before strips are flattened.
export function baseHeight(x, z, seed) {
  const r = fbm(x / 420, z / 420, seed);
  const ridge = Math.abs(fbm(x / 900 + 7.3, z / 900 - 2.1, seed + 5));
  let h = r * 90 + (1 - ridge) * 150;
  // River valley carving a low channel through the south-west.
  const river = Math.abs(z - (0.00012 * x * x - 0.35 * x - 900));
  if (river < 260) h -= (1 - river / 260) * 120;
  // Silt flats near the runway keep the airfield readable.
  const dRun = Math.hypot(x - RUNWAY.x, z - RUNWAY.z);
  if (dRun < 900) h *= 0.15 + 0.85 * (dRun / 900);
  return h;
}

export function terrainHeight(x, z, seed) {
  let h = baseHeight(x, z, seed);
  // Flatten both strips to their local base height so landings are fair.
  for (const strip of [RUNWAY, DIRT_STRIP]) {
    const s = stripCoords(x, z, strip);
    const edge = Math.max(Math.abs(s.along) / (strip.length / 2), Math.abs(s.across) / (strip.width / 2));
    if (edge < 1.6) {
      const flat = baseHeight(strip.x, strip.z, seed);
      const t = Math.max(0, Math.min(1, (edge - 1.0) / 0.6));
      h = flat + (h - flat) * t;
    }
  }
  return h;
}

export function buildTerrain(scene, seed) {
  const seg = 180;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const teal = new THREE.Color(0x1d4a4a);
  const tealDark = new THREE.Color(0x123330);
  const ochre = new THREE.Color(0xa97c46);
  const ochreLight = new THREE.Color(0xc49a5e);
  const riverCol = new THREE.Color(0x2e6f8e);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z, seed);
    pos.setY(i, h);
    const t = Math.max(0, Math.min(1, (h + 40) / 260));
    c.copy(tealDark).lerp(teal, t);
    if (h < 30) c.lerp(ochre, 0.65);
    if (h > 140) c.lerp(ochreLight, 0.35);
    const river = Math.abs(z - (0.00012 * x * x - 0.35 * x - 900));
    if (h < -30 && river < 260) c.copy(riverCol);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.05, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  scene.add(mesh);

  // Scattered basalt rocks.
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a3f3c, roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 260);
  const rng = mulberry32(seed + 77);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < 260; i++) {
    const x = (rng() - 0.5) * (WORLD_SIZE - 400);
    const z = (rng() - 0.5) * (WORLD_SIZE - 400);
    if (isOnStrip(x, z, RUNWAY, 60) || isOnStrip(x, z, DIRT_STRIP, 60)) { i--; continue; }
    const sc = 4 + rng() * 14;
    e.set(rng() * 3, rng() * 3, rng() * 3); q.setFromEuler(e);
    v.set(x, terrainHeight(x, z, seed) + sc * 0.2, z);
    s.set(sc, sc * (0.6 + rng() * 0.5), sc);
    m.compose(v, q, s);
    rocks.setMatrixAt(i, m);
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  // Paved runway + dirt strip surfaces.
  addStrip(scene, RUNWAY, 0x3a3f45, seed);
  addStrip(scene, DIRT_STRIP, 0x8a6b42, seed);
  return mesh;
}

function addStrip(scene, strip, color, seed) {
  const y = baseHeight(strip.x, strip.z, seed) + 0.6;
  const geo = new THREE.PlaneGeometry(strip.length, strip.width);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(strip.x, y, strip.z);
  mesh.rotation.y = -strip.headingDeg * Math.PI / 180;
  scene.add(mesh);
  // Centreline dashes.
  const dashGeo = new THREE.BoxGeometry(18, 0.3, 2);
  const dashMat = new THREE.MeshBasicMaterial({ color: strip === RUNWAY ? 0xf5f0dc : 0xd8c49a });
  const a = strip.headingDeg * Math.PI / 180;
  for (let d = -strip.length / 2 + 40; d < strip.length / 2 - 20; d += 60) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(
      strip.x + Math.sin(a) * d,
      y + 0.4,
      strip.z - Math.cos(a) * d,
    );
    dash.rotation.y = -a;
    scene.add(dash);
  }
}
