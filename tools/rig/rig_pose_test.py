# Pose the skinned model with the game's own chibi.js knight poses and render them.
# Poses are three.js Euler XYZ per joint, relative to an identity rest in model axes
# (model faces +Z, left is +X, Y up). Converted to Blender pose-bone rotations here.
# usage: blender -b <rigged.blend> --python rig_pose_test.py -- <render_prefix> [hipHeight]
import sys, math, bpy
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]
hip_h = float(argv[1]) if len(argv) > 1 else 0.80
S = hip_h / 0.62  # game rig normalisation (chibi.js hips rest at 0.62)


def P(*layers):
    d = {}
    for l in layers:
        d.update(l)
    return d


STANCE = {'torso': [0.06, 0, 0], 'head': [0.06, 0, 0], 'legL': [-0.1, 0, 0.05], 'shinL': [0.14, 0, 0], 'legR': [0.12, 0, -0.05], 'shinR': [0.1, 0, 0], 'hipsY': 0.62}
READY = {'armL': [-0.4, 0, -0.12], 'foreL': [-1.3, 0, 0], 'armR': [0.5, 0, -0.32], 'foreR': [-0.25, 0, 0], 'torso': [0.12, 0.22, 0], 'head': [0.05, -0.18, 0], 'legL': [-0.38, 0, 0.13], 'shinL': [0.48, 0, 0], 'legR': [0.4, 0, -0.15], 'shinR': [0.36, 0, 0], 'hipsY': 0.55}
base = P(STANCE, READY)
crouchWide = {'legL': [-0.55, 0, 0.16], 'shinL': [0.75, 0, 0], 'legR': [0.45, 0, -0.16], 'shinR': [0.6, 0, 0], 'hipsY': 0.5}
deepLunge = {'legL': [-0.95, 0, 0.12], 'shinL': [1.05, 0, 0], 'legR': [0.78, 0, -0.12], 'shinR': [0.32, 0, 0], 'hipsY': 0.42}
tucked = {'armL': [0.15, 0, 0.3], 'foreL': [-1.25, 0, 0]}
POSES = {
    'rest': {},
    'ready': base,
    'sweep_hit': P(base, deepLunge, tucked, {'torso': [0.48, 0.78, 0], 'head': [-0.05, -0.55, 0], 'armR': [-1.12, 0, 0.6], 'foreR': [-0.04, 0, 0]}),
    'overhead': P(base, {'torso': [-0.32, -0.2, 0], 'head': [-0.25, 0.1, 0], 'armR': [-2.95, 0, -0.15], 'foreR': [-0.45, 0, 0], 'legL': [-0.2, 0, 0.12], 'shinL': [0.3, 0, 0], 'legR': [0.35, 0, -0.12], 'shinR': [0.6, 0, 0], 'hipsY': 0.62}),
    'guard': P(base, {'torso': [0.22, 0.1, 0], 'head': [0.15, -0.1, 0], 'armL': [-1.25, 0, -0.2], 'foreL': [-0.5, 0, 0], 'armR': [0.6, 0, -0.35], 'legL': [-0.45, 0, 0.15], 'shinL': [0.6, 0, 0], 'legR': [0.45, 0, -0.16], 'shinR': [0.45, 0, 0], 'hipsY': 0.52}),
}


def three_euler_to_blender(e):
    # three XYZ Euler: M = Rx(ax) Ry(ay) Rz(az) about three axes.
    # three -> blender axes: X->X, Y->Z, Z->-Y
    ax, ay, az = e
    return (Matrix.Rotation(ax, 3, 'X') @ Matrix.Rotation(ay, 3, 'Z') @ Matrix.Rotation(-az, 3, 'Y'))


rig = bpy.data.objects['HeroRig']
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 560
scene.render.resolution_y = 700
world = bpy.data.worlds.new('W')
world.color = (0.75, 0.77, 0.8)
scene.world = world
for rot, energy in [((50, 0, 30), 3.2), ((65, 0, 200), 1.6)]:
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = energy
    sun.rotation_euler = tuple(math.radians(a) for a in rot)
    scene.collection.objects.link(sun)
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.3
scene.collection.objects.link(cam)
scene.camera = cam
centre = Vector((0, 0.1, 0.9))

for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'

for pname, pose in POSES.items():
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
        e = pose.get(pb.name)
        R = pb.bone.matrix_local.to_3x3()
        if e:
            D = three_euler_to_blender(e)
            pb.rotation_quaternion = (R.inverted() @ D @ R).to_quaternion()
        if pb.name == 'hips' and 'hipsY' in pose:
            dz = (pose['hipsY'] - 0.62) * S
            pb.location = R.inverted() @ Vector((0, 0, dz))
    bpy.context.view_layer.update()
    for view, ang in [('front', 0), ('q34', 45)]:
        a = math.radians(ang)
        cam.location = centre + Vector((math.sin(a) * 8, -math.cos(a) * 8, 0.6))
        cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{out}_{pname}_{view}.png'
        bpy.ops.render.render(write_still=True)
    print('POSED', pname)
