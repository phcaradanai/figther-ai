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
