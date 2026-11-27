# Character motion standard

Use this reference when authoring a hero or moving one from Procedural Geometry to a skinned mesh. Knight is the model-conversion reference. Procedural Ninja and Viking provide different silhouettes and movement styles for the same exercise. A single Tree of Savior PC character is enough to supply an external visual reference.

## Record the same actions

| Action | What to record at normal gameplay zoom |
| --- | --- |
| Idle → walk → sprint | First response to input, first supporting step, alternating contact, and change in cadence |
| Turn 90° → brake → stop | Direction change, last supporting step, torso recovering to neutral, and gear settling afterward |
| Jump → apex → land | Timing of takeoff, pose at the apex, first ground contact, knee and hip compression, and the next step |
| Dodge → recover | Push-off, direction of travel, catch step and return to locomotion |
| Basic attack and one skill → move | Input, anticipation, weapon contact or projectile release, impact reaction/VFX, and first controllable step |

Capture uninterrupted at a stable frame rate with default camera and zoom. Find a clear floor and a single visible target. Record class, gear, frame rate if known, and normal or slow playback. Start with a reference clip and a clip from our game using the same sequence. Capture side views when a contact is hidden by the cape or shield. Keep external footage as a reference and author original game poses and effects.

Public references used for the initial visual review include Maggi's description of why a fixed quarter view makes timing easier to read, and PC footage at [07:29 for running](https://www.youtube.com/watch?v=MS8QT0_KlfE&t=449s) and [11:59 for combat](https://www.youtube.com/watch?v=MS8QT0_KlfE&t=719s). Use the clips to study readability and sequencing. Compare input latency, braking and landing on a controlled recording where each input is known. [IMC's art-direction interview](https://treeofsavior.com/page/news/view.php?n=337)

The [player-provided PC recording analysis](tos-pc-motion-reference.md) timestamps start, turn, brake, landing, sword trails and the dash wake on one character. Use those sequences as the visual reference during the live replay.

## What each hero should share

| Layer | Shared contract | Per-hero authoring |
| --- | --- | --- |
| Gameplay and render motion | Use the authoritative position, velocity, facing, support surface and combat state. Read rendered travel and changes in direction when presenting the pose. Mark the beginning and end of contact and recovery explicitly. | Stride length, speed-dependent cadence, turn lean and the duration of the last step. |
| Contact and landing | Alternate between a clearly supported foot and a swing foot. Permit pivots and intentional slides. Find the support surface for each retained contact. Carry pre-contact vertical speed into landing compression and recovery. | Neutral foot spacing, knee bend, anticipation and limits on compression. Use the existing silhouette and gear to determine how much give reads at gameplay zoom. |
| Rig and secondary motion | Check the imported hip, knee and ankle axes against the authored motion. Align weapon and shield to their sockets. Keep continuous motion through walk/sprint, turn and jump/land transitions, including weapon and cloth follow-through. | Joint ranges, skin weights and motion curves. Decide where cloth, hair, weapons and armor should lag or settle. |
| Skills and presentation | Label anticipation, contact/release and recovery. Trace weapon motion, confirmed impact, VFX, sound and target reaction on one playback timeline. For a blocked, missed or airborne attack, review the corresponding sequence. | Silhouette, animation timing, arc shape, contact emphasis, color and effect scale. Keep gameplay timing and combat balance explicit when reviewing proposed animation changes. |

On flat ground during a declared support interval, track the sole point from first load until release. Use travel within **15% of the hero's standing hip height** over that interval as an initial review threshold, then inspect the recorded motion for the character's intended turn, skid or dodge. Verify that landings from two heights visibly differ and that the hero can recover into another step. Review input-to-action in the game at its ordinary camera and run the replay metrics as a second check. An accepted baseline can only come from the two together.

For the first new skinned hero, implement the common inputs and markers alongside Knight and test both on this sequence. Keep hero-specific clips and style choices in their profiles. Extract shared runtime logic after the same inputs and events work for both rigs. Record a baseline for each approved hero using its own default equipment.

## Reproduce the baseline

The [measurement command](../../tools/rig/measure-motion.mjs) samples the real renderer's character rig in Node at 60 poses/s. It uses the same prescribed speeds, turning path and jump arcs for every model. Terrain adaptation, input/network delay and skill VFX require the separate live replay. Render snapshots retain root, hip, ankle and weapon-hand positions, yaw, torso pitch, grounded state and active clip phase when requested.

```sh
node tools/rig/measure-motion.mjs
node tools/rig/measure-motion.mjs --hero=knight --frames > knight-motion.json
```

With an explicit hero ID the command runs the default rig and the forced Procedural Geometry rig. Both may report `procedural` until that hero has a skinned model. [Baseline data](motion-baseline.json) was collected against production code at `34e3ead`. Keep the protocol version and use identical inputs for before/after comparisons.

| Profile | Walk / sprint ankle drift estimate (units/s, P90) | Pose settled after stop (ms) | Hip drop on low / high jump (units) | Peak weapon-hand speed after attack began (ms) |
| --- | --- | ---: | --- | ---: |
| Knight, skinned | 3.86 / 4.21 | 133 | 0.009 / 0.009 | 100 |
| Knight, procedural | 5.00 / 6.59 | 133 | 0.105 / 0.105 | 67 |
| Ninja, procedural | 5.18 / 7.17 | 133 | 0.177 / 0.177 | 33 |
| Viking, procedural | 5.15 / 7.16 | 133 | 0.119 / 0.119 | 83 |

The drift statistic samples ankles near the bottom of each rig's stride while moving backward relative to its root. Inspect its sample count and raw trajectory alongside the measured speed. It estimates how the boot moves on flat ground, and direct sole tracking during an authored contact is needed for the acceptance check. The JSON also records the time to the first locomotion clip during acceleration, yaw lag while turning, and time to idle after the prescribed dodge ends. The stop number is the last post-stop frame with over 0.15 units/s of ankle motion. Hip drop is measured from standing height through the first 200 ms of ground contact. Peak hand speed describes the visual pose only. Actual impact timing comes from the combat event and effects.

For Knight, the biggest clear difference in this replay is the visible compression on landing. The skinned rig moves its hips by about 9% of the procedural rig's amount, and both rigs use the same compression magnitude for the two tested heights. Both settle after a similar time on this prescribed stop. The next movement review should pair the landing and brake footage with these measurements before deciding how much of each reaction belongs in the common animation layer.

## First skinned motion implementation

Knight uses the same gameplay inputs and adds [support-foot placement](../../public/js/three/knight_footwork.js) during walk and sprint. The solver anchors the supported foot to the visible surface and gives the foot back to the clip near toe-off and during sharp turns. Gait pace and upper-body lean respond to rendered travel. Landing compression uses the last airborne vertical speed. The sword's bright accent uses the authored blade contact marker, while gameplay damage keeps the server timing.

| Knight measure | Before | With support-foot placement and landing response |
| --- | ---: | ---: |
| Walk ankle drift estimate (units/s, P90) | 3.86 | 0.63 |
| Sprint ankle drift estimate (units/s, P90) | 4.21 | 0.54 |
| Low jump hip drop (units) | 0.009 | 0.015 |
| High jump hip drop (units) | 0.009 | 0.064 |

Run the same replay and an in-arena pass before tuning these choices for another skinned hero. Keep the landing strength and lean limits in proportion to that hero, and choose where its authored arcs reach contact instead of copying Knight's clip times.

Review the silhouette at normal gameplay scale as well as the replay metrics. Knight now catches a stop on the lead leg, lets the torso and equipment continue through the transition, and then settles into ready stance. The stop clip blends out immediately when the player moves again. On the fixed replay, the last visible foot motion after stopping extends from 167 ms to 233 ms while the steady-walk and sprint drift estimates stay the same.

## Tree of Savior run, jump and cape (2026-11-26)

The player re-sent the same 55 s recording (`Recording 2026-11-26 214755.mp4`). Close crops of the run (04.80–05.27, 44.00–44.47) and the hop (47.97–48.43) drove a second Knight pass:

- **Run.** The torso leans forward and the hips bounce. A knee drives up in front while the other heel kicks up behind toward the seat, and both feet leave the ground between steps. Seen from behind, the boots land close to the centre line. `walk` (the default 5.4 speed) is now this jog and `run` (sprint) is a stronger version of it. Both come from one `STRIDE` table in [knight_motion.js](../../public/js/three/knight_motion.js), where the thighs adduct (`TRACK`) so the legs no longer splay. The sword arm stays mostly behind the hip so the blade is carried, not brandished.
- **Jump.** Push off through the toes, then both knees gather to the chest with the sword pointed ahead and the shield arm thrown back. The fall clip opens the legs toward the ground and the existing landing compression takes over.
- **Footwork.** Support starts slightly before the contact key (`CATCH` in [knight_footwork.js](../../public/js/three/knight_footwork.js)) so the landing boot does not skim the floor at swing speed. The sole is pulled to the floor only during the supported part of each half stride, which keeps the flight phase.
- **Cape.** [cape_cloth.js](../../public/js/three/cape_cloth.js) runs a three-segment verlet strand per skinned cape. Drag comes from the render root's smoothed velocity and inertia from its acceleration, so the 30 Hz server steps do not make it twitch. Bending stiffness limits creasing. The strand cannot swing forward of its authored drape, and it rides over a heel kicked up behind. The bones ease into the strand's shape. Procedural capes on other heroes keep the old spring.

| Knight measure (same replay) | Before this pass | After |
| --- | ---: | ---: |
| Walk ankle drift estimate (units/s, P90) | 0.63 | 1.01 |
| Sprint ankle drift estimate (units/s, P90) | 0.54 | 1.95 |
| Low / high jump hip drop (units) | 0.015 / 0.064 | 0.046 / 0.102 |

The drift estimate rose because each stride now covers about twice the ground and has a flight phase. The planted boot itself holds still through its support window, which the `plants the supporting foot` test covers. The cape test checks that the hem keeps moving against the torso through a sprint and a turn. The old spring moved 0.000 units sideways and 0.066 vertically there, and the strand moves about 0.3 in each.

`/knight_motion_lab.html` is a dev page that drives one `ChibiView` with scripted snapshots at 60 Hz (`?scenario=walk|sprint|jump|runJump|turn|attack|combo|heavy|jumpAttack|airHeavy|dodge|guard&cam=game|side|front|back`, plus one scenario per Knight skill). `combo` presses J at the server's 280 ms limit, and `jumpAttack` applies the server's lift on the first two air presses. `lab.sheet(name, t0, t1, { cols, rows, mode })` renders a contact sheet for side-by-side comparison with reference frames.

## Tree of Savior sword strikes (2026-11-26)

The sword sections of the same recording (18.6–24.5 and 27.5–28.8) show one rhythm. A quick wind-up cocks the blade over the shoulder or head, and the strike covers its arc in two or three frames with a bright flat crescent. The swing finishes in a low, wide stance with both boots down and holds there briefly before the next swing. Swings alternate between diagonal chops and flat sweeps.

[knight_attacks.js](../../public/js/three/knight_attacks.js) builds the skinned Knight's strikes. `KNIGHT_STRIKES` holds each strike's blade contact, trail window and commit time, and `chibi.js` reads them from there.

| Clip | Strike | Blade contact |
| --- | --- | ---: |
| `attack1` | Diagonal cleave from over the right shoulder into a wide lunge | 0.12 s |
| `attack2` | Backhand: drawn across the hips, swept flat out to the sword side | 0.115 s |
| `attack3` | Finisher: gather, leap with the sword overhead, crush into a deep squat | 0.19 s |
| `heavy` | Shield to the chest, step in and drive it forward | 0.21 s |

- The server deals damage on the press and allows a swing every 280 ms, so the first two strikes reach contact near 0.12 s. Their holds give way to the next swing.
- `stance()` places both boots on the floor through two-bone leg IK when a pose is authored. During a strike the lowest sole is pulled to the floor, and `KnightFootwork.ground()` sets the other boot flat on it. The finisher's leap (`KNIGHT_AIRBORNE`) is exempt.
- Arm and wrist angles were solved against target blade directions and hand positions measured on the real rig. For example, the cleave's wind-up puts the hand above the right shoulder with the blade pointing up and back. If the sword mount or the rig changes, re-solve them with `lab.solve(side, clip, time, dir, at)` in the lab. `side` is `'R'` for the blade or `'L'` for the shield's outer face. Coordinates face +Z with left at +X, measured from the feet.

The previous clips finished the cleave with the back boot about 0.15 units off the floor, which read as a hop. The strike test now requires the hips to drop at least 0.08 below standing and both ankles to sit within 0.03 of rest height after the first two strikes. It also requires the finisher's leap to lift a boot.

## Knight gear skills (2026-11-26)

The server spawns every skill effect on the cast, and the skill state lasts 550 ms. The old skill clips reached their key poses up to 0.3 s after their effects, so the shield slammed down after the Aegis dome had already burst. `buildKnightSkills()` in [knight_attacks.js](../../public/js/three/knight_attacks.js) times each pose to its effect in [knight_holy_vfx.js](../../public/js/three/knight_holy_vfx.js):

| Skill (clip) | Effect timing | Pose |
| --- | --- | --- |
| Excalibur Wave (`sweep`) | Glint on the raised blade 0–0.08 s, vertical arc into the floor at 0.085 s | Blade straight up at 0.035 s, chop into a deep lunge at 0.085 s, hold while the crescent travels |
| Aegis Fortress (`slam`) | Ground impact and dome at 0.05 s | Shield lifts, then drops to one knee with the shield rim planted at 0.05 s and holds |
| Lionheart Warcry (`warcry`) | Light pillar lands 0.02–0.08 s, roar rings from 0.09 s | Short gather, then chest up with the sword thrust into the pillar and the shield arm wide at 0.085 s |
| Chariot Rush (`charge`) | Server launches at 18 u/s, losing 9% per tick | Push off behind the shield, leap shield-first (feet off the floor 0.03–0.2 s), land braced and skid |

`KNIGHT_STRIKES` carries these four as well, so commit times, trail windows and floor contact share the basic strikes' handling. Aegis is marked `kneel`, so the sole is pulled to the floor without leveling the kneeling boot. `charge` plays once for the skinned Knight instead of looping. The lab has a scenario per skill (`?scenario=knight_weapon` and so on). The skill test checks each pose at its effect time and fails on the old clips.

## Aerial combo and air heavy (2026-11-27)

The server rules (see `AIR_COMBO_HITS` and `startAirSlam` in `server.js`) are:

- **Three basic hits per jump.** `airStrikes` counts them until the player lands. It used to reset whenever an attack's 238 ms state ended, so every air hit counted as the first. Hits 1 and 2 lift the attacker to at least 3.8 u/s and the target 7.4 / 6.2 u/s, with only a 0.6 push, so both stay airborne and within reach. Hit 3 spikes the target, which ground-bounces on landing. A fourth press before landing does nothing.
- **Air heavy.** Holding J past the charge threshold in the air, or pressing heavy once, starts a hover with gravity stopped. A held aim lasts up to 1 s and a single press 0.35 s. The heavy locks the nearest enemy within the class's range, and arrow keys switch targets through the `slam` targeting mode. With no enemy it aims ahead. On release or timeout the player plunges to the aimed point at 22 u/s, falling at least 8 u/s, and the landing hits everything within the class's radius. Classes set to `dash` fly at the locked target instead, and spike it if it is airborne. The per-class `heavyAttack.air` in `shared_data.js` holds the mode, range and radius. Knight slams with range 4.5 and radius 2.6. Ninja, samurai, striker and reaper dash. Those values are first guesses for tuning.
- The snapshot carries `airStrikes` and `airSlam` (`phase` aim / dive / dash / impact, `mode`, `x/y/z`, `radius`). The 3D renderer draws the landing zone for every player who is aiming or diving.

| Knight clip | Used for |
| --- | --- |
| `airRise` | Air hit 1: blade rises from low behind to high in front |
| `airCut` | Air hit 2: the ground backhand's upper body over gathered legs |
| `airSpike` | Air hit 3: overhead chop down |
| `slamAim` / `slamDive` / `slamImpact` | Hover with the sword cocked overhead, dive with the legs trailing, chop into the floor on landing |

`ChibiView.strikeClip()` picks the air or ground clip when a strike starts and keeps it through a landing. It uses the snapshot's `airStrikes`, with a local count as fallback.

## Mixamo clips (2026-11-26)

The pipeline has two steps. [mixamo_to_glb.py](../../tools/rig/mixamo_to_glb.py) runs in headless Blender and converts Mixamo FBX files to GLB. Some Mixamo FBX files use properties three.js's FBXLoader cannot read, which is why Blender does the conversion. Then [bake-mixamo.mjs](../../tools/rig/bake-mixamo.mjs) retargets each clip onto the skinned Knight and scores it on the real rig. Clips listed in its `BAKE` table are written to `public/assets/anims/knight/` as the game's own keyframes, and `SKINNED_HEROES.knight.bakedClips` loads them in place of the code clips.

The retarget takes each Mixamo bone's world rotation relative to its T-pose and applies it to the matching Knight bone in the same reference pose. `Spine2` drives `torso`. Hips height scales by the ratio of the two rigs' hip heights. The bake then keeps the lying Knight on top of the floor. It searches each frame for the smallest hips lift, chest raise and chin tuck that clears the body and helmet, then turns the wrists so the sword and shield rest on the floor. The cape's cloth stays above the feet line. Keep the FBX and GLB sources out of the repo.

The Knight now uses these baked clips, chosen by the player after comparison:

| Game clip | Mixamo source | Bake options |
| --- | --- | --- |
| `attack1` / `attack2` / `attack3` | One Hand Sword Combo, cut into its three chops (blade peaks at 1.12 / 2.20 / 3.03 s of the 4.6 s file, the `at` field in `BAKE`) | Retimed so each blade lands at 0.13 / 0.10 / 0.20 s (the nearest 30 fps frames to 0.12 / 0.115 / 0.19); contact and trail stored in the clip and copied into `KNIGHT_STRIKES`. All three keep a boot planted and none leaves the floor, so `KNIGHT_AIRBORNE` only lists the skill `charge` now |
| `walk` / `run` | Sword And Shield Walk / Sword And Shield Run | Rotated so the left heel strikes at phase 0, then retimed for the game's ground speed (5.4 / 7.5 u/s): see "Matching the Mixamo model" below |
| `jump` / `fall` | Sword And Shield Jump (leap 0.17 to 0.5 s, descent 0.5 to 0.8 s) | Hips held at standing height; the landing squat is `updateLanding` |

The first Mixamo pass used the Run file as the walk and Run (2) as the run; the combo came from Slash, attack (2) and attack (3). Those three attacks had a leaping finisher, which the one-handed chops replace. `BAKE` takes a list for a file that holds several strikes.
| `idle`, `idleFidget` | idle, the 7.5 s Sword And Shield Idle | The fidget plays once after 6 s standing still |
| `guard`, `guardHit` | block idle, block (2) | `guardHit` plays on the server's `block` / `parry` events |
| `turnR` / `turnL` | turn / turn (2) | Hips yaw removed and doubled speed, played when the facing jumps by over 0.6 rad while standing |
| `draw` | draw sword 1 | Plays after a respawn |
| `dead` | death | 1.25× speed, kept on top of the floor |

`fix` holds the Knight's shield at the angle the Mixamo model holds its own (see "Shield hold" below). It also turns the right wrist and forearm just enough to keep the blade 0.3 from the helmet's centre, and each frame starts from the previous frame's correction. Blade-through-helmet frames fell from 11 to 1 (Slash) and from 22 to 0 (the long idle). During strikes both boots are grounded in two passes, so pulling one boot down no longer sinks the other. The hand-made ToS clips stay in `knight_motion.js` and `knight_attacks.js`, and the baked clips override them by name. Remove a clip from `bakedClips` to fall back to the hand-made one.

Sheath sword, strafe and the other attacks are not used: the game has no sheathed or strafing state, and the remaining attacks are covered.

## Combat feel pass (2026-11-27)

Checked in the live game at the gameplay camera, slowed down with `public/dev/combat_capture.js` (see below), not only in the lab.

| Piece | Where | What it does |
| --- | --- | --- |
| Blade trail | `SwordTrail` in `chibi.js` | A ribbon 12 % longer behind the hilt and 34 % past the tip, 0.3 s life, three vertices per sample: clear root, azure body, white edge. The azure body keeps the arc readable on pale floors. Normal blending, so it still works on the transparent My Item preview |
| Contact-synced hits | `holdForContact` / `releaseHits` in `chibi.js`, `renderer3d.js`; `attackerId` on the server's `hit` fx | The server resolves a hit when the swing starts, 0.13 s before the blade lands. The client now holds the hit's flash, number and sound until the attacker's blade accent fires, and releases them if the swing never reaches contact (0.42 s). The victim keeps its pose until then too (`holdReaction`, at most 0.3 s), and blocks and parries (which carry `attackerId` as well) are held the same way. Measured live at real speed: the server marks the victim hurt at 82 ms, the flash, sound and flinch land at 199 ms; a block lands at 186 ms with the shield's hit clip at 189 ms. The victim's positional knockback is still applied at once |
| Combo impact | `basicHit` in `knight_holy_vfx.js` | A spiked impact star, a blade-mark needle (hit 1 diagonal, hit 2 short, finisher cross-cut with a floor star and dust) and sparks along the swing. It sets `fx._knightHit`, which mutes the generic red flash in `fx.js` |
| Footfall dust | `kickUp` in `knight_footwork.js` | A small pale puff where a boot lands above ~3.5 u/s |
| Turn in place | `idleExtra` in `chibi.js` | Measured against the yaw the feet last stood at (`stanceYaw`), and only after 0.15 s still, so a direction key no longer flashes the turn pose at run start |
| Shield hold | `SHIELD_HOLD` and `fixHands` in `bake-mixamo.mjs`; `tools/rig/shield-from-model.mjs` | The Mixamo model (Sword And Shield Run (1) Model.fbx) carries its shield rigidly on the left forearm (prop bone `Shield_joint`, a child of `LeftForeArm`), so the angle it is held at is one constant. `shield-from-model.mjs` measures the shield mesh's principal axes (thin axis = face pointing away from the body, long axis = crest) and turns them into the Knight's left wrist rotation `[-0.0086, 0.0277, 0.6796, 0.7330]` (the shield face is the wrist's -Y, its crest +Z). Every baked clip with `fix` writes that wrist on every frame and stores it as `shield`, so the shield turns with the forearm exactly as on the model: face forward and crest up while standing and guarding, face out to the left and rocking in a run. It replaces the earlier forced forward-facing wrist solve and its runtime stabiliser, which held the shield square to the front in every clip |
| Sounds | `SoundFX` in `game_client.js` | Noise-based sword swoosh (light and finisher), a hit made of a thump, a crack and two metal partials, and a shield clank for block and parry. Each call is a few percent off pitch |

Tools:

- `public/dev/combat_capture.js` — in the console of `/?renderer=3d`: `const a = await import('/dev/combat_capture.js'); a.setup({ scale: 0.12 })`, then `await a.shoot({ keys: [['KeyJ', 40]] })` draws a contact sheet of the live game over the page. `scale` slows only the client clock, so keep key holds short. `a.fx('hit', { attackerId: a.me().pl.id }, 1.9)` replays a server event in front of the Knight.
- `node tools/rig/seam-audit.mjs` — plays scripted input through `ChibiView` and lists one-frame bone pops across clip hand-overs. Remaining known pops are the left arm at attack 1 → 2 (the shield bash starts in three frames) and the first frames of some hand-made skills; they are cuts, not slides.
- `node tools/rig/shield-from-model.mjs <model.glb>` — re-derives `SHIELD_HOLD` from a Mixamo model with its shield (export it from Blender with `export_skins=True, export_materials='NONE'`; keep the file out of the repo).
- `?handmade=all` (or a comma list of clip names) on any page plays the hand-made Knight clips in place of the baked ones.

## Matching the Mixamo model (2026-11-27)

The player compared the game with the Mixamo model (Sword And Shield Run (1) Model.fbx) and found the sword angle, the shield and the legs did not match it. `public/dev/compare.html` puts the model and the Knight in the same clip at the same moment (`cmp.sheet('run', 8, { yaw: 40 })`, or open it and pick a clip). It needs the model and clips converted to GLB in `public/dev/ref/` (`model.glb` exported with `export_skins=True, export_materials='NONE'`, then `walk`, `run`, `combo`, `jump`, `idle`, `guard`); those files stay out of the repo (`.git/info/exclude`). Measured against the model:

| What | Before | Now |
| --- | --- | --- |
| Blade angle (idle, guard, walk, run) | 9.6° off (`swordMount` rx 0.38) | ≤ 0.5°: `swordMount.q` in `chibi.js`, and the hand sits the model's distance off the blade axis |
| Shield face / position | face right (1°), centre 0.16 in front of the forearm and 0.06 high | face 1°; centre on the forearm like the model's as far as the Knight's fist allows (`shieldOffset`). Exactly the model's position pushed the fist 7.6 cm out through the shield's face, so the shield sits 0.07 forward of that and a test (`the left hand and forearm stay behind the shield`) ray-casts every hand and forearm vertex to keep them behind it |
| Boot spread, walk / run (lateral, game camera) | 0.32 / 0.36 | 0.14 / 0.16, the model's 0.145 / 0.186 |
| Planted boot slide, run | 2.5 u/s average, 15 u/s spikes | 1.5 u/s average, 10 u/s peak |

How:

- **`reachLegs` (bake).** The Knight's hip sockets are about twice as far apart as the model's, so the model's leg rotations on them splayed the boots. The bake records where the model's boots are relative to its hips (`retarget` returns `feet`) and puts the Knight's boots there, scaled by the ratio of the two leg lengths, with two-bone IK (`KnightFootwork.placeLeg`). The boot keeps its own tilt. Set per clip with `legs: true` in `BAKE`; every fixed clip uses it.
- **`warpGait` (bake).** The game moves the Knight at 5.4 and 7.5 u/s, which for legs half a unit long is a sprint, much faster than the model's walk or run covers (the walk file at 0.4 s per cycle sweeps a boot back at 2.4 u/s, the run at 3.9 u/s). Played that way the pinned boot was dragged until it let go, and that release was the jerk. So the stance (heel strike to toe-off) is retimed to the pace that keeps the boot still at the game's speed and the rest of the step stretches to fill the cycle (walk 0.34 s, run 0.32 s, so 5.9 and 6.3 steps a second), the seam blurred so toe-off is not a kink. The clip stores `groundSpeed` and `stance`, and `KnightFootwork.rate` / `apply` use them instead of the old fixed 5.4 / 7.45 and 0.34.
- **Foot lock keeps the tilt.** A planted boot used to be turned flat, so its heel strike and toe-off snapped (0.5 to 0.9 rad in a frame). It now only holds its heading (`footYaw`, taken at the plant) and keeps the clip's pitch.
- **No hand-made braking.** `brakeL` / `brakeR` popped against the baked clips (0.4 to 0.9 rad on the arms and legs); the Knight now fades from the gait into the idle.
- **Jump and fall** are cut from Sword And Shield Jump (the leap 0.17 to 0.5 s played over 0.38 s, the descent 0.5 to 0.8 s over 0.32 s) with the hips held at standing height, since the server moves the body. The landing squat stays the game's own.
- **Combo** keeps the model's yaw swing: each chop ends with the body about 100° round and the next starts square. A crossfade of 0.08 s hides some of it, not all.

`public/dev/combat_capture.js` `record()` / `jerks()` log every rendered frame of real play and list one-frame bone pops; only compare runs at the same frame rate (the preview pane drops to 30 fps when it is not in front, which doubles every per-frame turn).

## Sword clear of the body, ToS proportions, landing (2026-11-27)

The player reported the sword passing through the Knight's own body, and asked for proportions nearer Tree of Savior's. `node tools/rig/self-collision.mjs [clip ...]` measures it: it skins the body (armour, helmet, shield) frame by frame, tests a few hundred points of the sword against the nearest body surface points and normals (the arm that holds the sword and the cape are left out), and reports frames with the sword more than 2 cm inside and the deepest point. `BodyField` in `tools/rig/body-field.mjs` is the same test, used by the bake.

| Clip | Frames with the sword > 2 cm inside, before | Now |
| --- | --- | --- |
| idle, guard, walk, jump, fall | 0 to 6 of 77 | 0 |
| run | 23 of 39, 6.6 cm deep | 4 of 39, up to 3.8 cm (chest, helmet) |
| attack 1 / 2 / 3 | 5 / 11 / 12 frames, up to 11.6 cm | 1 / 2 / 2 frames, 3.6 / 3.3 / 8.4 cm (one frame of the third chop) |
| turn, guard hit, draw, fidget | 8 to 16 frames, up to 12.9 cm | 1 to 7 frames, up to 4 cm (turnR brushes the helmet for 7 frames) |

`tests/knight_animation.test.mjs` keeps these as per-clip frame limits so a rebake cannot quietly bring the clipping back. The test and the tool judge by the nearest body vertex's normal, so a thin ridge such as the helmet's wings can read as inside when it is not.

- **Smaller sword, shield and head** in `SKINNED_HEROES.knight`: `swordScale` 1.10 to 0.80 (the model's blade is 0.86 long, the Knight's was 1.39), `shieldScale` 1.08 to 0.92, `headScale` 1.10 to 0.96 (the helmet follows the head). This alone cleared idle, guard, walk and the turns.
- **`fixHands` keeps the blade out of the body.** Besides the helmet-distance rule it now adds the sword's penetration into the body field to its cost and searches the hand, forearm and upper arm (`armR`) of the sword arm. Each frame stays within 0.3 rad of its neighbours so it cannot jump to another pose, and a second pass solves again pulled toward the average of its neighbours. A full bake takes about twenty minutes; `--only run,attack3` bakes just those clips, and `fixRadius` in `BAKE` widens how far one frame may stray (the third chop and the turns use 0.55).
- **Landing.** The server marks a player grounded the moment the body lands, but the height drawn closes the last stretch over about 0.15 s, so the Knight used to stand up in mid-air and slide down (idle pose at 0.36 above the floor). `ChibiView.update` now keeps the air pose until the drawn feet are within 0.1 of the floor, so the landing squash and dust also land on the touchdown.
- `public/dev/combat_capture.js` `me()` now picks the player the camera follows: another tab's player in the room used to be picked instead and the keys appeared to do nothing.

## Human anatomy & biomechanics pass (2026-11-27)

An audit of all 30 Knight clips and live 60 Hz locomotion (`node tools/rig/anatomy-audit.mjs --strict`) uncovered five root causes behind unnatural limb bends and pops: a `retarget()` rest-pose mutation bug in [bake-mixamo.mjs](../../tools/rig/bake-mixamo.mjs) affecting multi-clip bakes (`attack1/2/3`, `jump`, `fall`), unconstrained 2-bone leg IK causing lateral knee buckling, unconstrained 3-axis forearm search in `fixHands`, a `hipsY` conflict between `ChibiView.applyLayers` and `KnightFootwork`, and missing `SHIELD_HOLD` on non-baked clips.

- **Shared biomechanics (`public/js/three/knight_anatomy.js`)**: Defines `HUMAN_ROM`, `SHIELD_HOLD` / `SHIELD_HOLD_EULER`, a forward-pole 1-DOF knee hinge solver (`solveAnatomicalLeg`), an anatomical 2-DOF elbow solver (`solveAnatomicalArm`), and `enforceKnightAnatomy()` applied at runtime across crossfades.
- **Baked clips repaired (`tools/rig/repair-knight-clips.mjs`)**: Fixed `retarget()` rest preservation in `bake-mixamo.mjs`, algebraically un-corrupted `attack1/2/3`, `jump`, and `fall`, rebuilt symmetric 60 Hz human gait trajectories for `walk` and `run`, and sanitized all remaining baked clips (`0.0°` knee/elbow hyperextension across all 30 clips and all 7 live sequences).
- **Runtime footwork & handmade clips (`knight_footwork.js`, `chibi.js`, `knight_motion.js`, `knight_attacks.js`)**: Added vestibulo-ocular head stabilization, turn-leading gaze anticipation, organic idle/guard breathing, anatomical landing compression, and re-authored `dash`, `roll`, `hurt`, `knockdown`, `heavy`, `sweep`, `slam`, `warcry`, `charge`, and air strikes with `SHIELD_HOLD_EULER` and natural elbow flexion.

| Knight measure | Previous | After anatomy pass |
| --- | ---: | ---: |
| Walk / sprint ankle slide P90 (units/s) | 4.63 / 0.60 | 0.27 / 0.17 |
| Seam audit pops (`tools/rig/seam-audit.mjs`) | 250 | 37 |
| Low / high jump hip drop (units) | 0.015 / 0.064 | 0.023 / 0.064 |
| Clips passing `anatomy-audit.mjs --strict` | 1 / 30 | 30 / 30 |

## Skinned Shadow Ninja conversion & biomechanics (2026-11-27)

- **Model & gear pipeline (`tools/rig/build_ninja.py`, Blender 5.3 headless)**: Built `public/assets/models/hero-ninja.glb` (12,500-tri Tree-of-Savior painterly Cycles albedo body with curled fists, 96-quad dual-tail `NinjaScarf` cloth mesh, and symmetric `HeroRig`) and `public/assets/models/ninja-gear.glb` (leveled `NinjaBlade` kunai and mannequin-stripped `NinjaHeadband`).
- **Runtime & clips (`public/js/three/ninja_motion.js`, `public/js/three/ninja_attacks.js`)**: Shared `KnightFootwork` foot planting, landing impact scaling, floor guard, dynamic `CapeCloth` scarf drape, dual-weapon `offhandMount` + `offhandTrail` in `public/js/three/chibi.js` (with explicit `'XYZ'` Euler track baking in `makeClip`), dual-wrist `enforceHeroAnatomy` limits in `public/js/three/knight_anatomy.js`, `?hero=ninja` support in `public/knight_motion_lab.html`, and regression coverage in `tests/ninja_animation.test.mjs`.

| Ninja measure | Procedural rig | Skinned rig |
| --- | ---: | ---: |
| Walk / sprint ankle slide P90 (units/s) | 5.18 / 7.17 | 0.37 / 0.53 |
| Low / high jump hip drop (units) | 0.177 / 0.177 | 0.012 / 0.051 |
| Idle after dodge input (ms) | 117 | 0 |
| Clips passing `anatomy-audit.mjs --strict` | — | 26 / 26 (8 / 8 live) |

