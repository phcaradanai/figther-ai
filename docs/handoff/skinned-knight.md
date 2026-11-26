# Handoff: skinned hero models (knight first)

Status as of 2026-11-26. Goal from the user: replace the procedural chibi knight with a
Tree-of-Savior-quality **skinned** model (modular gear later), driven by the game's
existing animation clips. Do not reuse the old procedural look; quality is what matters.

## Done

- **Knight gear-skill VFX** (committed `08933b2`, `79c2b3f`): `public/js/three/knight_holy_vfx.js`,
  `holy_textures.js`. Feedback the user gave: crisp + compact like ToS, snappy impact
  (white flash, hit-stop, cracks, sparks), *not* big or glowy/floaty.
- **Rig pipeline proven** on a Hunyuan3D test character (an adventurer with cape + dagger):
  `tools/rig/` scripts, output `public/assets/models/hero-test-adventurer.glb` (1.9 MB,
  26k tris, 1K JPEG textures, 15-joint skin). Posed renders with the game's own knight
  poses looked clean (no tearing at shoulders/elbows/hips/knees).
- **Tree of Savior Quasi-3D / Hand-Painted Knight shipped as default**
  (`public/assets/models/hero-knight.glb` **1.23 MB**, 13k tris, 18-joint rig, 1 albedo
  texture; `public/assets/models/knight-gear.glb` **0.50 MB**, 5.8k tris total:
  `KnightHelmet` 2.2k, `KnightSword` 1.8k, `KnightShield` 1.8k, 3 albedo textures;
  `public/js/three/chibi.js`):
  - **Blender Cycles painterly bake**: bakes symmetric 360° storybook sky dome + metallic
    highlights + normal-map micro-details + warm-indigo AO directly into a single albedo
    texture per mesh, stripping `normalMap` and `metallicRoughnessMap` (12 textures → 4,
    total download 3.35 MB → 1.73 MB, tris 40k → 18.8k, ~3× lower GPU VRAM).
  - **ToS M Storybook Toon shader v2 (`painterly: true`)**: lightweight `MeshToonMaterial` with
    smooth 16-texel high-key ramp (`TOS_RAMP`, `0.58..1.00`), warm-sepia highlight / soft-mauve
    shadow split-tone (`tosWarmTint`), and delicate warm-brown Fresnel ink contour
    (`onBeforeCompile`, 0 extra draw calls); skips heavy PBR/IBL/normal lookups while preserving
    emissive hit-flash/Super Armor tints and opacity.
  - **Chibi-heroic proportions & ToS M Swordsman/Peltasta/Murmilo clips**: `headScale: 1.12`,
    `swordScale: 1.12`, `shieldScale: 1.10`; upright chest & head, broadsword held out in open
    silhouette to the right flank, kite shield angled forward; lively bounce idle, Double Slash
    (`attack1`), Shield Bash + reverse cut (`attack2`), airborne Highlander Crosscut (`attack3`),
    Murmilo Shield Drive (`heavy`), and wide Excalibur cleave (`sweep`).
  - **Live 3D `SwordTrail` crescent ribbon + hybrid 15 FPS stepping (`stepFps: 15`)**:
    zero-allocation per-vertex RGBA curved sword-blade arc trail (`SWORD_TRAIL_WINDOWS`) that
    switches out of 15 FPS stepped cadence during active swings so blade arcs stay silky smooth
    while idle/locomotion/holds keep the snappy ToS/2D 15 FPS feel (`?step=0` disables).
  - **Telephoto diorama camera (`renderer3d.js`, `stage.js`)**: `FOV 22`, `CAM_PITCH 0.62`,
    `camDist 41` (wheel `22..58`), matched fog pullback (`+11/+15`), and unobstructed north
    `sky_temple` painted castle backdrop.
  - **A-pose arm alignment (`alignArms: true`)** + **3-bone skinned cape** (`cape1..cape3`,
    topologically isolated from legs/arms via BFS + two-pass bone-heat binding).
  - **Modular gear** via `Builder.glbPart()` (`KnightHelmet`, `KnightSword`, `KnightShield`,
    plus dropped loot in `buildGearItem`), mixed helmet scaling (`otherHelmetScale: 0.56`),
    and procedural fallback when `gear.armor !== heroId` (`?skinned=0` disables skinned).
  - Verified live in browser at default `/` (idle, run, guard, 3-hit combo with golden
    `SwordTrail`, Q/E/R/F skills + Super Armor emissive, helmet drop & pickup, My Item 3D
    turntable, unobstructed north-west sky at FOV 22, 0 console/network/WebGL errors).
- Blender MCP connects once Blender's window is open (the add-on auto-starts its server),
  but all AI generators are off. The user generates models themselves on
  https://hy3d.tencent.ai/ and hands over GLBs. Source files: `D:\3D-Models\*.glb` and
  `art/blender/source/knight/*.glb` (untracked in main checkout).

## Not done (next steps, in order)

1. Author bespoke knight animations (Blender actions exported into the GLB and preferred
   over the code clips by name).
2. Repeat the skinned body + modular gear pipeline for the other 9 heroes.

## Pipeline (Blender 5.2, headless; `blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"`)

```
blender -b --factory-startup --python tools/rig/rig_clean.py -- <in.glb> <work1.blend> <render_prefix> 26000 1.8
powershell -File tools/rig/grid.ps1 -In <render_prefix>_front.png -Out front_grid.png -AxisLabel X
powershell -File tools/rig/grid.ps1 -In <render_prefix>_side.png  -Out side_grid.png  -AxisLabel Y
blender -b <work1.blend> --python tools/rig/rig_skeleton.py -- <work2.blend>
blender -b <work2.blend> --python tools/rig/rig_pose_test.py -- <render_prefix> <hipHeight>
blender -b <work2.blend> --python tools/rig/rig_export.py -- public/assets/models/<name>.glb
```

- `rig_clean.py`: import, weld, decimate to ~26k tris, feet on z=0, height 1.8 m, model
  faces -Y (= three.js +Z), textures to 1K and packed; renders ortho front/side
  (800 px = 2 m, centre z=0.95) for the grid overlay.
- `rig_skeleton.py`: places joints from cross-section extents. **The slice heights
  (hip 0.76-0.80, knee 0.45-0.49, ankle 0.10-0.13, shoulder 1.15-1.2, elbow 0.96-1.0,
  wrist 0.81-0.84, hand 0.69-0.72, neck 1.28-1.33, pelvis 0.80) are tuned for the
  adventurer**: read them off the grid renders and adjust for each new model. Binds with
  bone-heat automatic weights and prints unweighted vertices (adventurer: 0).
- Bone names/hierarchy match `chibi.js`: hips > torso > head; torso > armL/armR > fore > hand;
  hips > legL/legR > shin > foot. Model's left is +X.
- `rig_pose_test.py` converts chibi.js pose tables (three.js Euler XYZ, model axes) to
  Blender pose bones; `hipHeight` is the model's pelvis height (adventurer 0.80).

## Game loader design (implemented — default for knight; `?skinned=0` disables)

Exported bones carry Blender's rest orientations, but chibi.js clips set absolute joint
quaternions assuming an **identity rest** in model axes, plus `hips.position = (0, hipsY, 0)`
with the rest hips at `HIPS_Y = 0.62`. So, in `chibi.js`:

1. Top-level `await` load (like `workshop`) of `SKINNED_HEROES = { knight: { url, hipHeight: 0.8,
   fused: ['weapon','trinket','helmet'] } }`, only when `?skinned=1`.
2. `buildSkinnedRig(b, heroId, gear, model)`:
   - `root > body(node 'body') > rigScale(scale s = hipHeight / 0.62)`. Don't scale `body`
     itself: `ChibiView` overwrites `R.body.scale` every frame for squash & stretch.
   - `SkeletonUtils.clone(model.scene)`, `updateMatrixWorld(true)`, read each bone's world
     position; create new `THREE.Bone`s (same names, identity rotation) with
     `position = (world - parentWorld) / s`, parented in chibi order under `rigScale`;
     expose them as `R.hips`, `R.torso`, ... `R.footR`.
   - For each `SkinnedMesh`: map `skeleton.bones` by name to the new bones, move the mesh
     under `body` with an identity transform, clone its material (per-character emissive
     flash), push it to `b.materials`, `castShadow = true`, `frustumCulled = false`,
     `root.updateMatrixWorld(true)`, then `mesh.bind(new THREE.Skeleton(bones), mesh.matrixWorld)`.
     Attached bind mode re-inverts the mesh's world matrix each frame, so squash and root
     motion apply once.
   - Rigid attachments under a bone need a child group scaled `1/s` (bones carry `s`).
     Skip slots listed in `fused`. `R.extras = { capes: [], orbiters: [], thrusters: [] }`.
3. `Builder.bake()` must skip skinned meshes but keep their materials: in `collect`,
   `if (child.isSkinnedMesh) { keep.add(child.material); continue; }`.
4. `ChibiView` constructor: use `buildSkinnedRig` when a model is loaded for `pl.heroId`
   and `pl.gear.armor === pl.heroId`; otherwise keep the procedural `buildRig` (mixed or
   stripped armor).
5. Verify in the browser at `http://localhost:3100/?skinned=1`. `.claude/launch.json`
   (uncommitted) starts this repo's server on port 3100; the user's port 3000 server
   runs another checkout. Fire Q/E/R/F in a private room. A headless-Edge capture script
   that was used is described in the session; it is not in the repo.

## Notes

- `art/blender/hero-workshop.blend` showed as modified at the start of this work but was
  not edited by this session; leave it alone unless the user says otherwise.
- AGENTS.md: commit and merge into `main` after verifying.
