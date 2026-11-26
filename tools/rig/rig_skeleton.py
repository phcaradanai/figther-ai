# Step 2: fit the game skeleton to the cleaned mesh from cross-section centroids,
# bind with automatic (bone heat) weights, save, and report weight health.
# usage: blender -b <work_step1.blend> --python rig_skeleton.py -- <out_step2.blend>
import sys, bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]
body = bpy.data.objects['Body']
verts = [body.matrix_world @ v.co for v in body.data.vertices]


def centroid(zlo, zhi, xlo, xhi, ylo=-0.3, yhi=0.3, fallback=None):
    pts = [v for v in verts if zlo <= v.z <= zhi and xlo <= v.x <= xhi and ylo <= v.y <= yhi]
    if not pts:
        print('  EMPTY SLICE', zlo, zhi, xlo, xhi, '-> fallback', fallback)
        return Vector(fallback)
    c = sum(pts, Vector()) / len(pts)
    # use the middle of the x/y extent (centroid is biased toward the denser side)
    xs = sorted(p.x for p in pts); ys = sorted(p.y for p in pts)
    mid = Vector(((xs[0] + xs[-1]) / 2, (ys[0] + ys[-1]) / 2, (zlo + zhi) / 2))
    return mid


J = {}
for side, sgn in (('L', 1), ('R', -1)):
    lo, hi = (0.03, 0.4) if sgn > 0 else (-0.4, -0.03)
    J['hip' + side] = centroid(0.76, 0.80, *((0.04, 0.2) if sgn > 0 else (-0.2, -0.04)), -0.1, 0.22, (0.11 * sgn, 0.1, 0.78))
    J['knee' + side] = centroid(0.45, 0.49, lo, hi, -0.1, 0.35, (0.14 * sgn, 0.12, 0.47))
    J['ankle' + side] = centroid(0.10, 0.13, lo, hi, -0.1, 0.35, (0.15 * sgn, 0.16, 0.11))
    J['toe' + side] = Vector((J['ankle' + side].x, J['ankle' + side].y - 0.17, 0.04))
    alo, ahi = (0.19, 0.45) if sgn > 0 else (-0.45, -0.19)
    J['shoulder' + side] = centroid(1.15, 1.2, *((0.17, 0.32) if sgn > 0 else (-0.32, -0.17)), -0.1, 0.22, (0.23 * sgn, 0.07, 1.19))
    J['elbow' + side] = centroid(0.96, 1.0, alo, ahi, -0.05, 0.3, (0.28 * sgn, 0.12, 0.98))
    J['wrist' + side] = centroid(0.81, 0.84, alo, ahi, -0.05, 0.35, (0.3 * sgn, 0.14, 0.82))
    J['hand' + side] = centroid(0.69, 0.72, alo, ahi, -0.07, 0.35, (0.31 * sgn, 0.14, 0.7))
    # Shoulders sit a little inside the sleeve centre
    J['shoulder' + side].x -= 0.02 * sgn
    J['shoulder' + side].z = 1.19

chest = centroid(1.05, 1.15, -0.16, 0.16, -0.15, 0.2, (0, 0.06, 1.1))
neck = centroid(1.28, 1.33, -0.08, 0.08, -0.1, 0.2, (0, 0.06, 1.3))
pelvis_y = (J['hipL'].y + J['hipR'].y) / 2
J['pelvis'] = Vector((0, pelvis_y, 0.80))
J['chest'] = chest
J['neck'] = Vector((0, neck.y, 1.30))
J['headTop'] = Vector((0, neck.y, 1.78))
for k in sorted(J):
    v = J[k]
    print(f'JOINT {k:10s} ({v.x:+.3f}, {v.y:+.3f}, {v.z:+.3f})')

# Game skeleton (names match public/js/three/chibi.js joints)
arm_data = bpy.data.armatures.new('HeroRig')
rig = bpy.data.objects.new('HeroRig', arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None, connect=False):
    b = eb.new(name)
    b.head = head
    b.tail = tail
    if parent:
        b.parent = eb[parent]
        b.use_connect = connect
    return b


bone('hips', J['pelvis'], J['pelvis'] + Vector((0, 0, 0.1)))
bone('torso', J['pelvis'] + Vector((0, 0, 0.02)), J['neck'], 'hips')
bone('head', J['neck'], J['headTop'], 'torso')
for s in ('L', 'R'):
    bone('arm' + s, J['shoulder' + s], J['elbow' + s], 'torso')
    bone('fore' + s, J['elbow' + s], J['wrist' + s], 'arm' + s, True)
    bone('hand' + s, J['wrist' + s], J['hand' + s], 'fore' + s, True)
    bone('leg' + s, J['hip' + s], J['knee' + s], 'hips')
    bone('shin' + s, J['knee' + s], J['ankle' + s], 'leg' + s, True)
    bone('foot' + s, J['ankle' + s], J['toe' + s], 'shin' + s, True)
bpy.ops.object.mode_set(mode='OBJECT')

# Bind with bone-heat weights
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# Weight health
groups = {g.index: g.name for g in body.vertex_groups}
unweighted = 0
per_bone = {n: 0 for n in groups.values()}
for v in body.data.vertices:
    ws = [(groups[g.group], g.weight) for g in v.groups if g.weight > 0.01]
    if not ws:
        unweighted += 1
    else:
        best = max(ws, key=lambda t: t[1])[0]
        per_bone[best] += 1
print('UNWEIGHTED', unweighted, 'of', len(body.data.vertices))
print('DOMINANT', per_bone)
bpy.ops.wm.save_as_mainfile(filepath=out)
print('SAVED', out)
