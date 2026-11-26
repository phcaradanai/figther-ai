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
- Blender MCP connects once Blender's window is open (the add-on auto-starts its server),
  but all AI generators are off. The user generates models themselves on
  https://hy3d.tencent.ai/ and hands over GLBs. Source test files: `D:\3D-Models\*.glb`
  (`bc111a...` = adventurer used for the test, `c5376b...` = girl mid-walk (hard to rig),
  `1127c3...` = katana).

## Not done (next steps, in order)

1. **Load the skinned model in the game** behind `?skinned=1` (design below). Test with
   `hero-test-adventurer.glb` mapped to `knight`.
2. When the user delivers the real knight (`art/source/knight/body.glb` + helmet/sword/
   shield GLBs; prompts were given in chat: A-pose, no weapon/helmet/cape), run the
   pipeline on it, attach sword/shield to `handR`/`handL` and the helmet to `head`, build
   a skinned cape on its own bone(s), then make skinned the default for the knight.
3. Later: author better knight animations (Blender actions exported into the GLB and
   preferred over the code clips by name), then the other 9 heroes.

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

## Game loader design (not written yet)

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
