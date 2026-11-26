# Convert Mixamo FBX animations to GLB (skeleton + animation only) so the Node
# bake script can read every file the same way. Some Mixamo FBX files use
# properties three.js's FBXLoader cannot parse; Blender's importer reads them.
#
#   blender -b --factory-startup --python tools/rig/mixamo_to_glb.py -- <fbx dir> <out dir>
import os
import sys

import bpy

src, out = sys.argv[sys.argv.index('--') + 1:][:2]
os.makedirs(out, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.lower().endswith('.fbx'):
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(src, name), automatic_bone_orientation=False, ignore_leaf_bones=True)
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    actions = [a for a in bpy.data.actions if a.frame_range[1] > a.frame_range[0]]
    if not actions:
        print('SKIP (no animation)', name)
        continue
    scene = bpy.context.scene
    start, end = actions[0].frame_range
    scene.frame_start, scene.frame_end = int(start), int(end)
    target = os.path.join(out, os.path.splitext(name)[0] + '.glb')
    bpy.ops.export_scene.gltf(filepath=target, export_format='GLB', export_animations=True,
                              export_skins=False, export_force_sampling=True, export_frame_range=True)
    print('OK', name, 'fps', scene.render.fps, 'frames', start, end)
