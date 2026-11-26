# Step 1: import a generated character, clean + decimate, normalise, save a working .blend,
# render orthographic front/side views for joint placement.
# usage: blender -b --factory-startup --python rig_clean.py -- <in.glb> <work.blend> <render_prefix> [target_tris] [height]
import sys, math, bpy, bmesh
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
src, work, out = argv[0], argv[1], argv[2]
target = int(argv[3]) if len(argv) > 3 else 26000
height = float(argv[4]) if len(argv) > 4 else 1.8

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
obj.name = 'Body'
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Weld split vertices so the decimator sees one connected surface (UVs live on loops, so seams survive)
bm = bmesh.new()
bm.from_mesh(obj.data)
before = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00005)
bm.to_mesh(obj.data)
bm.free()
print('WELD', before, '->', len(obj.data.vertices))

obj.data.calc_loop_triangles()
tris = len(obj.data.loop_triangles)
mod = obj.modifiers.new('Decimate', 'DECIMATE')
mod.decimate_type = 'COLLAPSE'
mod.ratio = min(1.0, target / tris)
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=mod.name)
obj.data.calc_loop_triangles()
print('DECIMATE', tris, '->', len(obj.data.loop_triangles))

# Normalise: feet on z=0, centred on x/y, scaled to the requested height (model faces -Y)
vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
k = height / (mx.z - mn.z)
off = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
obj.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation(-off))
obj.data.update()
for p in obj.data.polygons:
    p.use_smooth = True
print('SCALE', round(k, 4), 'SIZE', tuple(round((mx[i] - mn[i]) * k, 3) for i in range(3)))

# Textures down to 1K for the game, packed into the file
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
    img.pack()
    print('IMG', img.name, tuple(img.size))

bpy.ops.wm.save_as_mainfile(filepath=work)
print('SAVED', work)

# Orthographic measurement renders: 800 px = 2.0 m, centre at z = 0.95
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = 800
world = bpy.data.worlds.new('W')
world.color = (0.9, 0.9, 0.92)
scene.world = world
for rot, energy in [((50, 0, 30), 3.0), ((60, 0, 200), 1.5)]:
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = energy
    sun.rotation_euler = tuple(math.radians(a) for a in rot)
    scene.collection.objects.link(sun)
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.0
scene.collection.objects.link(cam)
scene.camera = cam
centre = Vector((0, 0, 0.95))
for name, pos in [('front', Vector((0, -10, 0.95))), ('side', Vector((10, 0, 0.95)))]:
    cam.location = pos
    cam.rotation_euler = (centre - pos).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{out}_{name}.png'
    bpy.ops.render.render(write_still=True)
    print('RENDERED', scene.render.filepath)
