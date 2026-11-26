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
  - **Anatomical pronated gauntlet weapon grip & intact zero-clip split `KnightCape`** (`hero-knight.glb`
    13.3k tris = `Body` 11.5k + intact un-decimated `KnightCape` 1.84k sharing 1 baked albedo texture;
    `knight-gear.glb` 5.8k tris): both open A-pose hands curled along a smooth circular arc into clenched
    fists, with `handR` pronated `+82°` across the wrist cuff so the 4 fingers wrap cleanly around the
    leather handle tunnel and `KnightSword` rotated 90° around its blade axis so the crossguard and
    cutting edge align vertically with the forearm/knuckle plane (`swordMount: { p: [0.029, -0.090, 0.006], rx: 0.38 }`,
    `swordTrail: { base: [0, 0, 0.16], tip: [0, 0, 1.04] }`); `KnightCape` cleanly split via albedo-color
    + geometry face-BFS with morphological gap closing, smooth 2D local back-of-body clearance diffused
    across neighbors (zero side notches, zero step creases), monotonic `torso -> cape1 -> cape2 -> cape3`
    weights, `THREE.DoubleSide` material + torso-pitch compensation in `chibi.js`, and visibility toggled
    by `gear.trinket === heroId`.
  - **Stripped-gear continuity**: `useSkinned = !!(skinned && (!gear.armor || gear.armor === pl.heroId))`
    so dropping armor, helmet, and cape keeps the skinned anime Knight model (never reverts to old
    procedural geometry).
  - **Fluid 60 FPS grounded animations + flat-sole ankle lock (`stepFps: 0`, `?step=15` optional)**:
    added `footL`/`footR` to `JOINTS` and `LAYER_JOINTS`, plus a runtime flat-sole + ground-contact
    lock in `ChibiView.applyLayers()` for grounded `shield` `idle` & `guard` (levels both boot soles
    to 0° pitch/roll and clamps `hips.position.y` to `restFootY - min(yL, yR)` for exact ground
    contact on both arena floor and My Item pedestal); rebuilt equal-height `READY.shield` / 2.10s
    calm `idle`, 8-keyframe 4-phase `run` (heel-strike -> flat stance -> toe push-off), 4-phase
    `dash`, low shield-evade dodge (`'shield:roll': null`), tucked-knee `jump`/`fall`, deep braced
    Paladin High `guard`, smooth attack follow-through, and RGBA `SwordTrail`.
  - **Lightweight, cohesive ToS VFX & WebGL budget (`knight_holy_vfx.js`, `knight_effekseer_3d.js`,
    `renderer3d.js`)**: all 7 Knight moves (including `basic_slash`, `heavy_shield_bash`,
    `guard_parry`) run on zero-download procedural `KnightHolyVFX` (removed clashing neon-blue/pink
    basic slash discs and 10 Knight PNG downloads); other 9 hero VFX suites lazy-load on demand
    (cuts ~99 startup VFX PNG downloads / ~12 MB / ~100 MB VRAM); unused empty `#effekseerCanvas`
    second WebGL context and multi-pass `UnrealBloomPass` disabled by default (`?effekseer=1`,
    `?bloom=1` opt-in); 1024×1024 soft shadows and refined grounded contact shadow + thin gold ring.
  - Verified live in browser at default `/` (idle, run, dash, guard, dodge, `J` slash, `Q` skill,
    all transferable gear dropped `E`/`R`/`F`, My Item 3D close-up grip, 0 Knight VFX PNG requests,
    0 console/network/WebGL errors).
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
