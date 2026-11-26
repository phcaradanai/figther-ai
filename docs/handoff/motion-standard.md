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

## Knight air strikes (2026-11-26)

Jump attacks used to play the ground clips, so the Knight dropped into a wide lunge in mid-air. The server's air rules are:
- The first jump attack launches the target.
- Every later one in the same jump spikes the target down. The first two presses also lift the Knight to at least 3.8 u/s.
- An air heavy spikes the target.

The skinned Knight now has a clip for each case:

| Clip | Used for | Motion |
| --- | --- | --- |
| `airRise` | First jump attack | Blade rises from low behind to high in front, knees gathered |
| `airSpike` | Later jump attacks | Sword cocked overhead, chopped down forward, legs kicking back |
| `airSmash` | Air heavy | Forward somersault (`KNIGHT_AIR_FLIP`) into the same downward chop |

`ChibiView.strikeClip()` chooses between the ground and air clip when a strike starts, and the strike keeps that clip through a landing. Air strikes are excluded from the floor contact pass. The count of air strikes resets once the Knight is grounded and not attacking. The blade accent now fires on the contact of whichever swing started with the server's slash event, on the ground or in the air.

## Mixamo clips (2026-11-26)

The pipeline has two steps. [mixamo_to_glb.py](../../tools/rig/mixamo_to_glb.py) runs in headless Blender and converts Mixamo FBX files to GLB. Some Mixamo FBX files use properties three.js's FBXLoader cannot read, which is why Blender does the conversion. Then [bake-mixamo.mjs](../../tools/rig/bake-mixamo.mjs) retargets each clip onto the skinned Knight and scores it on the real rig. Clips listed in its `BAKE` table are written to `public/assets/anims/knight/` as the game's own keyframes, and `SKINNED_HEROES.knight.bakedClips` loads them in place of the code clips.

The retarget takes each Mixamo bone's world rotation relative to its T-pose and applies it to the matching Knight bone in the same reference pose. `Spine2` drives `torso`. Hips height scales by the ratio of the two rigs' hip heights. The bake then keeps the lying Knight on top of the floor. It searches each frame for the smallest hips lift, chest raise and chin tuck that clears the body and helmet, then turns the wrists so the sword and shield rest on the floor. The cape's cloth stays above the feet line. Keep the FBX and GLB sources out of the repo.

Score of the Lite Sword and Shield Pack against the Knight's own clips:

| Mixamo clip | Result | Reason |
| --- | --- | --- |
| death | **Used as `dead`**, at 1.25× speed | Staggers back and falls flat in 1.9 s, inside the 3 s respawn. The old clip just folded down and sank 0.4 into the floor. |
| attack, attack (2)–(4) | Not used | Fastest blade at 0.33–1.17 s against the 0.12 s contact the server needs. attack and attack (4) put the blade through the helmet for 42 and 25 frames. |
| block idle, block, block (2) | Not used | The shield ends up facing the Knight's right side, not forward. block and block (2) are moves into and out of a block, not a hit being absorbed. |
| idle | Not used | Holds the shield edge-on. |
| run, run (2) | Not used | Realistic jog instead of the Tree of Savior run. |
| strafe, turn, draw sword, sheath sword | Not used | No matching game state. |

