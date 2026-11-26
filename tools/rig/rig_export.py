# Export a rigged hero (HeroRig armature + its skinned meshes) as a game GLB.
# usage: blender -b <rigged.blend> --python tools/rig/rig_export.py -- <out.glb>
import sys, bpy

argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]

rig = bpy.data.objects['HeroRig']
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
skinned = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]
for o in skinned:
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
# Export in rest pose with no animation: the game drives the joints itself
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_skins=True,
    export_def_bones=True,
    export_rest_position_armature=True,
    export_animations=False,
    export_materials='EXPORT',
    export_image_format='JPEG',
    export_image_quality=88,
)
print('EXPORTED', out, [o.name for o in skinned])
