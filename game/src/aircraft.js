// aircraft.js — the IRON GASSER airframe, built from three.js primitives.
// Blended-wing pulse-detonation demonstrator: sharp chines, ventral intake,
// 2D thrust-vector nozzles, glowing afterburner cones. Original design.

import * as THREE from 'three';

export function buildAircraft() {
  const g = new THREE.Group();
  g.name = 'ironGasser';

  const skin = new THREE.MeshStandardMaterial({ color: 0xa2adb8, roughness: 0.45, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c343c, roughness: 0.6, metalness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xd88a2a, roughness: 0.5, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2f45, roughness: 0.15, metalness: 0.9 });

  // Fuselage: a stretched, flattened cone nose + cylindrical body.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 8), skin);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -5.2; nose.scale.y = 0.62;
  g.add(nose);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.85, 6.5, 10), skin);
  body.rotation.x = Math.PI / 2; body.position.z = -0.6; body.scale.y = 0.62;
  g.add(body);

  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8), glass);
  canopy.scale.set(0.85, 0.5, 1.9); canopy.position.set(0, 0.55, -3.4);
  g.add(canopy);

  // Delta main wing: a flattened, swept shape from an extruded triangle.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(9.5, 3.4); wingShape.lineTo(9.5, 4.6);
  wingShape.lineTo(1.2, 2.6); wingShape.lineTo(0, 1.4); wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.22, bevelEnabled: false });
  const wingR = new THREE.Mesh(wingGeo, skin);
  wingR.rotation.x = -Math.PI / 2; wingR.position.set(0.4, -0.05, 0.4);
  g.add(wingR);
  const wingL = new THREE.Mesh(wingGeo, skin);
  wingL.rotation.x = -Math.PI / 2; wingL.rotation.z = Math.PI; wingL.position.set(-0.4, -0.05, 0.4);
  g.add(wingL);
  // Wing-tip accent stripes.
  for (const s of [1, -1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.6), accent);
    tip.position.set(s * 9.6, 0.12, 4.2);
    g.add(tip);
  }

  // Canards.
  const canShape = new THREE.Shape();
  canShape.moveTo(0, 0); canShape.lineTo(2.6, 1.1); canShape.lineTo(2.6, 1.7);
  canShape.lineTo(0.3, 0.9); canShape.closePath();
  const canGeo = new THREE.ExtrudeGeometry(canShape, { depth: 0.12, bevelEnabled: false });
  for (const s of [1, -1]) {
    const can = new THREE.Mesh(canGeo, dark);
    can.rotation.x = -Math.PI / 2;
    if (s < 0) can.rotation.z = Math.PI;
    can.position.set(s * 0.5, 0.1, -4.4);
    g.add(can);
  }

  // Twin canted tail fins.
  for (const s of [1, -1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 2.4), dark);
    fin.position.set(s * 1.6, 1.0, 2.6);
    fin.rotation.z = -s * 0.35;
    g.add(fin);
  }

  // Ventral intake under the nose.
  const intake = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.6), dark);
  intake.position.set(0, -0.75, -2.6);
  g.add(intake);

  // 2D thrust-vector nozzles + afterburner cones (glow when lit).
  const burnerMat = new THREE.MeshBasicMaterial({ color: 0xff9a2a, transparent: true, opacity: 0 });
  const burners = [];
  for (const s of [1, -1]) {
    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.0), dark);
    nozzle.position.set(s * 0.85, 0, 3.4);
    g.add(nozzle);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 10), burnerMat);
    cone.rotation.x = Math.PI / 2; cone.position.set(s * 0.85, 0, 5.4);
    g.add(cone);
    burners.push(cone);
  }

  // Navigation lights: red port, green starboard, white tail.
  const nav = [];
  for (const [x, color] of [[-9.8, 0xff2222], [9.8, 0x22ff66], [0, 0xffffff]]) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    lamp.position.set(x, 0.1, x === 0 ? 4.2 : 4.3);
    g.add(lamp); nav.push(lamp);
  }

  // Landing gear: nose + two mains, hidden until lowered.
  const gear = new THREE.Group();
  gear.name = 'gear';
  const legMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.8 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [x, z] of [[0, -3.6], [-2.2, 1.8], [2.2, 1.8]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6), legMat);
    leg.position.set(x, -1.2, z);
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wheelMat);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, -1.9, z);
    gear.add(wheel);
  }
  gear.visible = false;
  g.add(gear);

  // Flaps: thin trailing-edge panels that drop when flaps are set.
  const flapL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.9), dark);
  flapL.position.set(-4.4, -0.12, 4.6);
  const flapR = flapL.clone(); flapR.position.x = 4.4;
  g.add(flapL); g.add(flapR);

  return {
    group: g,
    setAfterburner(on, intensity) {
      burnerMat.opacity = on ? 0.55 + 0.45 * intensity : 0;
      const s = on ? 1 + 0.25 * Math.sin(performance.now() * 0.04) : 1;
      for (const cone of burners) cone.scale.set(s, s, 1 + 0.4 * intensity);
    },
    setGear(down) { gear.visible = down; },
    setFlaps(down) {
      flapL.rotation.x = down ? 0.5 : 0;
      flapR.rotation.x = down ? 0.5 : 0;
    },
    setBankVisual(bank) { g.rotation.z = -bank * 0.25; },
  };
}

// A glowing target ring for the Ring Run mission.
export function buildRing(radius = 26) {
  const group = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 1.1, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95 }),
  );
  group.add(torus);
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.55, 0.35, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.7 }),
  );
  group.add(inner);
  group.userData.torus = torus;
  return group;
}

// A drone freighter for the Intercept mission: boxy hull, cargo pods, beacon.
export function buildFreighter() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0x5a6a72, roughness: 0.6, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 12), hull);
  g.add(body);
  const podMat = new THREE.MeshStandardMaterial({ color: 0xc47f2e, roughness: 0.7, metalness: 0.3 });
  for (const s of [1, -1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 8), podMat);
    pod.position.set(s * 2.4, -0.4, 0);
    g.add(pod);
  }
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3333 }),
  );
  beacon.position.set(0, 1.6, 0);
  g.add(beacon);
  g.userData.beacon = beacon;
  return g;
}
