# aiBA Architecture

This document describes the current runtime contract before modularization. It is intentionally descriptive: changing a boundary requires updating this file and the verification checks in the same commit.

## Current Shape

- `index.html` is both the application shell and the owner of most game logic.
- The page contains about 5,500 lines of inline JavaScript.
- `/next/index.html` is generated as a 192-line application shell; gameplay ownership lives under `src/`.
- Files under `src/` are classic browser scripts. They publish APIs through `window.AIBA*` and depend on load order rather than imports.
- There is no bundler or framework. The production build is served as static files.
- `scripts/check.js` is the regression gate and freezes growth of inline JavaScript.

## Boot Order

The production page currently boots in five phases. This order is a compatibility contract.

1. **Engine and data**
   - local Three.js, then CDN fallbacks
   - `assets-manifest.js`
   - `config.js`
2. **Early services and UI helpers**
   - player selection, identity, leaderboard, share, recorder
   - shot physics, face overlays, haptics, visual director
3. **Inline core state**
   - constants, seeded random, `G`, audio cue arbitration
4. **Runtime services and scene/game implementation**
   - vision, audio, NBA DNA
   - renderer, scene, camera, court, players, modes, results, main loop
5. **Late compatibility hooks**
   - game flow, navigation, scene lifecycle, result stats, gear
   - avatar/roster/shot motion, hero moments, hot hand, performance settings

Late hooks load after `animate()` is declared because several modules wrap or patch functions owned by the inline core.

## Current Ownership

| Area | Current owner | Public/implicit contract |
|---|---|---|
| App state and mode transitions | `index.html` | lexical `G`, `PAUSE`, `goHome`, `goDiff` |
| Three.js world and main loop | `index.html` | lexical `scene`, `renderer`, `camera`, `animate` |
| Shot lifecycle | `index.html` + `shot-motion.js` + `shot-physics.js` | patched `startCharge`, `releaseShot`, `shotCurves` |
| Vision input | `vision.js` | reads core functions/state; exports `AIBAVisionFrame` |
| Audio | `audio.js` + inline cue arbitration | global playback helpers and `AIBAAudio` |
| Recording | `recorder.js` | `AIBARecorder`, called once per rendered frame |
| Leaderboards | identity/API/UI modules | `AIBAIdentity`, `AIBALeaderboard`, `AIBALeaderboardUI` |
| Modes | mostly `index.html` | contest, battle and Rack Rush share `G` and scene objects |
| Scene progression | `index.html` + `scene-lifecycle.js` | flower/beach reset hooks |

## Known Coupling Risks

- A classic script can see globals on `window`, but not every top-level lexical binding is a stable API.
- Several late modules monkey-patch core functions. Moving a declaration can silently change which implementation runs.
- Audio, vision and recording are tied to browser user gestures and frame timing.
- The seeded match logic and non-seeded presentation logic deliberately use different random sources.
- The leaderboard and local settings use production storage keys and must not be touched by experimental entry points.
- A syntactically valid refactor can still alter shot feel, animation timing, camera framing or final-video capture.

## Target Boundaries

The target remains a static browser game. A framework or bundler is not required for the first migration.

```text
app shell
  -> core/runtime        explicit state, services and events
  -> core/game-loop      frame orchestration only
  -> rendering/*         scene, court, players, camera, effects
  -> modes/*             lifecycle: enter/start/update/finish/exit
  -> services/*          audio, vision, recorder, leaderboard, share
  -> ui/*                menus, HUD, results, player selection
  -> data/*              config, roster, scenes, audio manifest
```

## Runtime Rules

1. New features must not add inline JavaScript to `index.html`.
2. New modules access shared state through `window.AIBA.runtime`, not through new loose globals.
3. A module owns its state or receives it through an explicit context object.
4. Mode modules implement `enter`, `start`, `update`, `finish` and `exit` where applicable.
5. The main loop calls modules; modules do not start additional animation loops.
6. Production and experimental entries use different storage namespaces.
7. Behavior migration and behavior redesign are separate commits.

## Experimental Migration Status

- `src/modes/rack-rush.js` owns Rack Rush setup, timers, rules, records and results under `/next/`.
- `src/modes/contest.js` owns contest drawing order, rounds, bracket, finals, tiebreak and championship results under `/next/`.
- Contest replay remains in the legacy core because its camera, ball ghost and render-loop integration are shared rendering concerns.
- `src/modes/percent-battle/` owns battle state and clock, spot stocks and cooldowns, opponent decisions and animation, and result construction under `/next/`.
- Percent Battle ball collision, final-shot cinematic and camera updates remain in the shared core because other rendering systems call them directly.
- `src/modes/practice.js` owns the three-shot warmup lifecycle and completion detection; it deliberately calls the shared shot lifecycle instead of duplicating it.
- `src/ui/panels.js`, `loading.js`, `menu.js`, `setup.js`, `pregame.js` and `pause.js` own shared overlays, the loading gate, the home cover/mode information, difficulty/court selection, pregame roster drawing/matchups, and pause/return-home flow under `/next/`.
- Route parity is verified for Rack Rush, Percent Battle, Three-Point Contest and NBA DNA, including return-home paths without a refresh.
- `src/rendering/core.js` owns the WebGL renderer, root scene/camera, environment roots, adaptive render scale, resize handling and base lights under `/next/`.
- `src/rendering/materials.js` owns pixel-canvas textures, basketball skins, shared basketball materials and the ball geometry under `/next/`.
- `src/rendering/court.js` owns indoor/outdoor court textures, the full-court floor mesh and the active shooting-spot ring under `/next/`.
- `src/rendering/arena.js` owns indoor stands, wall banners, the backcourt show and the instanced arena crowd under `/next/`.
- `src/rendering/spectators.js` owns active-basket spectators and outdoor street crowds, including their reactions.
- `src/rendering/hoop.js` owns both hoops, backboards, nets, arena light cones and the jumbotron.
- `src/rendering/environments.js` owns outdoor parks, rain, progressive flowers, beach sunset and court-preset transitions.
- `src/rendering/props.js` owns ball racks, rack-ball visibility, first-person hands and held-ball props.
- `src/rendering/characters.js` owns the voxel player factory, visual styling, roster actors and bench placement.
- `src/rendering/character-visuals.js` owns opt-in player-specific visual profiles layered over the shared voxel rig.
- `src/rendering/equipment-visuals.js` owns lightweight shoe, arm-guard and head-gear geometry; `?gear=classic` restores the legacy shapes.
- `src/rendering/camera.js` owns player world position, camera modes, automatic framing and play-camera updates.
- `src/rendering/motion.js` owns the legacy base pose curves, pass animation and movement between shooting spots; `shot-motion.js` still applies the production V2 pose patch later in boot.
- `src/rendering/effects.js` owns shadow blobs, fire/confetti particles, shared tweens and camera glides.
- `src/presentation/cinematics.js` owns hero shots, opponent live shows, lead-change cutaways, celebrations and victory cameras.
- `src/presentation/pregame.js` owns randomized warmup actions, actor restoration and the pregame camera sequence.
- `src/presentation/battle.js` owns Percent Battle cutaway completion, overtake gating, final-run presentation and score calls.
- `src/gameplay/shots.js` owns shot selection, charge/release, scoring and authoritative basketball simulation.
- `src/gameplay/collisions.js` owns shared airborne-ball collision response.
- `src/presentation/replay.js` owns highlight selection playback and replay cameras.
- `src/presentation/win-cinematic.js` owns the Percent Battle winning-shot sequence.
- `src/ui/battle-controls.js` owns projected battle spots and the player-following power meter.
- `src/core/input.js` owns pointer, keyboard and device-tilt input registration.
- `src/core/game-loop.js` owns the single animation loop and frame dispatch.
- `src/core/scene-init.js` owns one-time scene construction before the compatibility adapter is created.
- `src/core/error-boundary.js` and `foundation.js` own fatal-error display and the small DOM/math helper surface.
- `src/data/game-config.js` owns court/mode constants, seeded match randomness, player profiles and asset-derived configuration.
- `src/data/dialogue.js` owns presentation copy used by rivals, announcers, makes and misses.
- `src/core/state.js` owns the shared legacy-compatible `G` and `PAUSE` state during the migration.
- `src/services/audio-cues.js` owns cue priority, cooldown and streak/miss voice arbitration; `audio.js` remains the playback engine.
- `src/ui/result-copy.js` owns result ratings and rotating NBA quotes.
- Desktop and portrait captures cover indoor and outdoor scene construction after the court-element migration.
- The generated experimental entry is now 192 lines, down from roughly 5,600 in the production entry. Its only inline scripts are NEXT diagnostics and Three.js fallback bootstrapping.

## Acceptance Matrix

Every ownership migration must run the script gate and manually cover the affected rows.

| Flow | Required evidence |
|---|---|
| Boot | loading gate dismisses once; cover video and menu BGM start after gesture |
| Navigation | every mode can enter setup, switch courts and return home without refresh |
| Touch shot | charge, jump, release, rim/backboard collision and landing feel unchanged |
| Vision shot | camera starts once; charge and fast release are recognized |
| Contest | complete a round, hero moment, result card and replay |
| Percent Battle | opponent, spot cooldown, score calls and final celebration work |
| Rack Rush | challenge and Speed 100 timers, scoring, result and ranking work |
| NBA DNA | upload, animated comparison and result poster work |
| Recording | final shots, celebration, result and mixed audio are present |
| Replay/reset | second run does not retain flowers, scores, hot hand or stale scene state |

## Rollback Rule

Before each ownership migration, keep a named backup tag. Each migration is one focused commit. A failed migration must be reversible without reverting unrelated game content.
