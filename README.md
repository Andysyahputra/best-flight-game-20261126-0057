# IRON GASSER — Make the best flight game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Andysyahputra/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Andysyahputra/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original 3D flight game built for the [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057) "Make the best flight game" bounty. Fly the IRON GASSER, a blended-wing pulse-detonation demonstrator, in chase view over procedural basalt ridges — through glowing rings, against drone freighters, and down onto a 600 m dirt strip.

## Play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open http://localhost:8080). No network needed; everything is static files under `game/`.

## Missions

1. **Ring Run** — fly through 8 glowing target rings in order, against the clock.
2. **Intercept** — hold the crosshair on 3 drone freighters for 2 s each to tag them before they leave the map.
3. **Ferry Landing** — land on the dirt strip with limited fuel and crosswind gusts. Gear down, gentle sink rate.

## Controls

- **W / S** — throttle up / down
- **A / D** — bank / turn
- **Arrow keys** — pitch trim
- **Mouse** — pitch / roll trim
- **Shift** — air-brake
- **Space** — lock / tag (Intercept)
- **G** — landing gear (below 250 kts)
- **F** — flaps
- **C** — chase / cockpit camera
- **R** — restart sortie
- **P** — pause

Fuel burns with throttle (afterburner fastest; 0% = flameout glide). Damage degrades handling at 50%+ and breaks the airframe at 100%. Landings and crashes read clearly on the debrief screen.

## Tech

- three.js (vendored minified module build under `game/vendor/`) for the 3D chase view; procedural heightmap terrain, dawn sky, drifting clouds.
- HUD is a lit Canvas 2D overlay: altitude, airspeed, heading tape, fuel/damage, mission timer, waypoint bearing/range, objective text.
- All sound is synthesised Web Audio (engine hum, wind, lock beeps, impact). No audio files, no network.
- Source split by job under `game/src/` (`main.js`, `input.js`, `flight.js`, `terrain.js`, `aircraft.js`, `hud.js`, `missions.js`, `camera.js`, `audio.js`, `sky.js`).
- `main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
