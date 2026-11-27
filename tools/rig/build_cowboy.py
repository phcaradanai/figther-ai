# Build the painterly skinned Cowgirl (hero id `cowboy`) and her modular gear (revolver, hat).
# The source folder is named `cowgirl`; the game's hero id stays `cowboy` (twin-gun style).
# Usage:
#   "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python tools/rig/build_cowboy.py -- <scratch_dir> [--gear-only]
# The three 80 MB sources hold ~860k vertices each, so decimation is cached in <scratch_dir>/<name>_dec.blend.
import math
import os
import sys
import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCRATCH = argv[0] if argv and not argv[0].startswith('--') else os.path.join(os.path.expanduser('~'), 'cowboy_build')
os.makedirs(SCRATCH, exist_ok=True)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC_DIR = os.environ.get('COWBOY_SOURCE_DIR', r'C:\Users\phcar\figther-ai\art\blender\source\cowgirl')
OUT_HERO = os.path.join(REPO_ROOT, 'public', 'assets', 'models', 'hero-cowboy.glb')
OUT_GEAR = os.path.join(REPO_ROOT, 'public', 'assets', 'models', 'cowboy-gear.glb')

TARGET_HEIGHT = 1.66
RAW_HEIGHT = 1.1009      # body.glb is 1.10 tall, faces -Y, left = +X, arms in an A pose
RAW_CENTER_X = 0.010     # the sculpt is 1 cm off-centre in X
RAW_CENTER_Y = -0.030    # hips / ankles sit at y = -0.03 in the source, normalised to y = 0
BODY_TRIS = 18000
GUN_TRIS = 4000
HAT_TRIS = 3000
GUN_LENGTH = 0.36        # metres, muzzle to hammer
HAT_BRIM = 0.60          # metres, brim width


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_decimated(name, tris):
    """Import a source GLB, weld, decimate in two stages and cache the result as a .blend."""
    cache = os.path.join(SCRATCH, f'{name}_dec.blend')
    if not os.path.exists(cache):
        clear_scene()
        bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, name + '.glb'))
        obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
        obj.name = name
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00003)
        bm.to_mesh(obj.data)
        bm.free()
        for stage, target in enumerate((tris * 4, tris)):
            obj.data.calc_loop_triangles()
            count = len(obj.data.loop_triangles)
            if count <= target:
                continue
            if name == 'body' and stage == 1:
                # keep the hands (they become fists) and the face detailed, spend fewer triangles elsewhere
                keep = obj.vertex_groups.new(name='keep')
                for v in obj.data.vertices:
                    hand = abs(v.co.x - RAW_CENTER_X) > 0.255 and 0.55 < v.co.z < 0.70
                    face = v.co.z > 0.90 and v.co.y < -0.06 and abs(v.co.x - RAW_CENTER_X) < 0.12
                    if hand or face:
                        keep.add([v.index], 1.0, 'REPLACE')
            mod = obj.modifiers.new('Decimate', 'DECIMATE')
            mod.decimate_type = 'COLLAPSE'
            mod.ratio = target / count
            mod.use_collapse_triangulate = True
            if name == 'body' and stage == 1:
                mod.vertex_group = 'keep'
                mod.invert_vertex_group = True   # the group is what the collapse is allowed to touch, so protect it
                mod.vertex_group_factor = 1.0
            bpy.ops.object.modifier_apply(modifier=mod.name)
            if name == 'body' and stage == 1:
                obj.vertex_groups.remove(obj.vertex_groups['keep'])
        for im in bpy.data.images:
            if im.size[0] > 1024:
                im.scale(1024, 1024)
            im.pack()
        bpy.ops.wm.save_as_mainfile(filepath=cache, compress=True)
        # the cache is now the open file and cannot be appended from itself: start a clean scene again
        clear_scene()
        setup_painterly_world()
    with bpy.data.libraries.load(cache) as (src, dst):
        dst.objects = [name]
    obj = bpy.data.objects[name]
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def setup_painterly_world():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2
    scene.cycles.bake_type = 'COMBINED'
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_diffuse = True
    scene.render.bake.use_pass_glossy = True
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.margin = 8

    world = bpy.data.worlds.new('ToSWorld')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 1.18
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.70, 0.55, 0.46, 1.0)  # dusty sunset bounce
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (1.0, 0.96, 0.88, 1.0)   # warm storybook sky
    map_range = nt.nodes.new('ShaderNodeMapRange')
    map_range.inputs['From Min'].default_value = -1.0
    map_range.inputs['From Max'].default_value = 1.0
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], map_range.inputs['Value'])
    nt.links.new(map_range.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

    for idx, (lx, ly, lz) in enumerate([(-2.5, -2.5, 3.2), (2.5, -2.5, 3.2), (-2.5, 2.5, 3.0), (2.5, 2.5, 3.0)]):
        ldata = bpy.data.lights.new(f'Fill{idx}', 'AREA')
        ldata.energy = 140.0
        ldata.size = 3.0
        ldata.color = (1.0, 0.96, 0.90) if ly < 0 else (0.98, 0.93, 0.88)
        ldata.use_shadow = False
        lobj = bpy.data.objects.new(f'Fill{idx}', ldata)
        lobj.location = (lx, ly, lz)
        lobj.rotation_euler = (-Vector((lx, ly, lz))).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(lobj)


def bake_painterly_albedo(obj, tex_name, size=1024, double_sided=False):
    img = bpy.data.images.new(tex_name, width=size, height=size, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    for mat in obj.data.materials:
        if not mat.use_nodes:
            mat.use_nodes = True
        nt = mat.node_tree
        tex_node = nt.nodes.new('ShaderNodeTexImage')
        tex_node.name = 'BakeTarget'
        tex_node.image = img
        for n in nt.nodes:
            n.select = False
        tex_node.select = True
        nt.nodes.active = tex_node
        for n in nt.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                met_in = n.inputs.get('Metallic')
                if met_in is not None:
                    for link in list(met_in.links):
                        nt.links.remove(link)
                    met_in.default_value = min(met_in.default_value, 0.28) if met_in.default_value > 0.35 else 0.25
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='COMBINED')
    img.pack()

    clean_mat = bpy.data.materials.new(f'{tex_name}_ToS')
    clean_mat.use_nodes = True
    clean_mat.use_backface_culling = not double_sided
    nt = clean_mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.88
    if 'Metallic' in bsdf.inputs:
        bsdf.inputs['Metallic'].default_value = 0.0
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.1
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    obj.data.materials.clear()
    obj.data.materials.append(clean_mat)
    print(f'BAKED {tex_name} ({size}x{size})')
    return img


def raw_to_model(x, y, z, k):
    """Source-sculpt coordinates (metres, A pose) to the normalised model (feet on z = 0, hips at y = 0)."""
    return Vector(((x - RAW_CENTER_X) * k, (y - RAW_CENTER_Y) * k, z * k))


# Joint positions measured on the decimated sculpt (left side, +X), source units.
RAW_JOINTS = {
    'pelvis': (RAW_CENTER_X, -0.030, 0.545),
    'hip': (0.088, -0.030, 0.540),
    'knee': (0.128, -0.026, 0.300),
    'ankle': (0.165, -0.030, 0.085),
    'shoulder': (0.128, -0.035, 0.755),
    'elbow': (0.215, -0.045, 0.705),
    'wrist': (0.290, -0.062, 0.632),
    'hand': (0.372, -0.068, 0.612),
    'neck': (RAW_CENTER_X, -0.030, 0.875),
    'headTop': (RAW_CENTER_X, -0.030, 1.100),
    'headCenter': (RAW_CENTER_X, -0.020, 1.000),
}


def shape_fists(body, J, k):
    """Curl both hands' fingers into a loose fist around a bar that crosses the palm (a revolver grip).

    The sculpt's hands are open and flat, palm down, fingers along the (nearly horizontal) arm. The rig bends the
    arm from a canonical hanging pose, where this palm faces the thigh; raising the arm forward to aim then leaves
    the palm facing inward with the knuckles stacked vertically, exactly how a pistol is held. So the fingers are
    bent about the Y axis through a point under the knuckles (a bend deformer keeps their thickness).
    Returns the grip-bar centre for each side.
    """
    grips = {}
    curled = 0
    R_BEND, PHI_MAX = 0.030, 2.35
    for sgn in (1, -1):
        elbow = Vector((J['elbowL'].x * sgn, J['elbowL'].y, J['elbowL'].z))
        wrist = Vector((J['wrist'].x * sgn, J['wrist'].y, J['wrist'].z))
        tip = Vector((J['hand'].x * sgn, J['hand'].y, J['hand'].z))
        # The sculpt's hand is cocked ~30 degrees off the forearm. The rig's hand bone follows the forearm, so first
        # straighten the hand onto the forearm line (eased in over 3 cm), then curl it.
        fore_dir = Vector((wrist.x - elbow.x, 0.0, wrist.z - elbow.z)).normalized()
        hand_dir = Vector((tip.x - wrist.x, 0.0, tip.z - wrist.z)).normalized()
        beta = math.atan2(hand_dir.cross(fore_dir).y, hand_dir.dot(fore_dir))
        axis = fore_dir
        n = Vector((-axis.z * sgn, 0.0, axis.x * sgn))
        if n.z < 0:
            n = -n                       # dorsal normal: the back of the hand (up in the A pose)
        b = axis.cross(n)                # along the knuckle line (Y)
        knuckle = wrist + axis * 0.058
        grips[sgn] = knuckle - n * R_BEND
        for v in body.data.vertices:
            r0 = v.co - wrist
            a0 = r0.dot(hand_dir)
            if a0 > 0.0 and v.co.x * sgn >= 0.30 * k and 0.8 <= v.co.z <= 1.05 and (r0 - hand_dir * a0).length <= 0.12:
                t = max(0.0, min(1.0, a0 / 0.03))
                v.co = wrist + Matrix.Rotation(beta * t * t * (3.0 - 2.0 * t), 3, 'Y') @ r0
            rel = v.co - knuckle
            a = rel.dot(axis)
            if a <= 0.0 or v.co.x * sgn < 0.30 * k or v.co.z < 0.8 or v.co.z > 1.05:
                continue
            if (rel - axis * a).length > 0.12:
                continue
            c = rel.dot(n)
            e = rel.dot(b)
            phi = min(a / R_BEND, PHI_MAX)
            rho = R_BEND + c
            extra = max(0.0, a - PHI_MAX * R_BEND)
            a2 = rho * math.sin(phi) + extra * math.cos(PHI_MAX)
            c2 = rho * math.cos(phi) - R_BEND - extra * math.sin(PHI_MAX)
            v.co = knuckle + axis * a2 + n * c2 + b * e
            curled += 1
    print(f'CURLED fists: {curled} verts; grip centres L={tuple(round(c, 3) for c in grips[1])}')
    return grips


def make_rig(J):
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

    bone('hips', J['pelvis'], J['pelvis'] + Vector((0, 0, 0.08)))
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
    return rig, arm_data


def build_hero():
    clear_scene()
    setup_painterly_world()
    body = load_decimated('body', BODY_TRIS)
    body.name = 'Body'
    body.data.name = 'Body'
    k = TARGET_HEIGHT / RAW_HEIGHT
    body.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation(Vector((-RAW_CENTER_X, -RAW_CENTER_Y, 0.0))))
    body.data.update()
    bpy.context.view_layer.objects.active = body

    J = {}
    for name, p in RAW_JOINTS.items():
        if name in ('hip', 'knee', 'ankle', 'shoulder', 'elbow', 'wrist', 'hand'):
            left = raw_to_model(*p, k)
            J[name + 'L'] = left
            J[name + 'R'] = Vector((-left.x, left.y, left.z))
        else:
            J[name] = raw_to_model(*p, k)
    J['wrist'] = J['wristL']
    J['hand'] = J['handL']
    # boots: heel / toe from the source sole
    vs = np.empty(len(body.data.vertices) * 3, dtype=np.float32)
    body.data.vertices.foreach_get('co', vs)
    vs = vs.reshape(-1, 3)
    sole = vs[(vs[:, 2] <= 0.06 * k) & (vs[:, 0] > 0.10 * k)]
    toe_y, heel_y = float(sole[:, 1].min()), float(sole[:, 1].max())
    for s, sgn in (('L', 1), ('R', -1)):
        J['toe' + s] = Vector((J['ankle' + s].x, toe_y, 0.03))
        J['heel' + s] = Vector((J['ankle' + s].x, heel_y, 0.03))
    print(f'BODY scale={k:.4f} sole y=[{toe_y:.3f},{heel_y:.3f}]')

    grips = shape_fists(body, J, k)
    J['gripL'] = grips[1]
    J['gripR'] = grips[-1]
    bake_painterly_albedo(body, 'tos_cowboy_body_tex', size=1024, double_sided=False)

    rig, arm_data = make_rig(J)
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    for b in arm_data.bones:
        if b.name not in body.vertex_groups:
            body.vertex_groups.new(name=b.name)
    vg = {g.name: g for g in body.vertex_groups}

    def set_rigid(v_idx, bone_name):
        for g in body.vertex_groups:
            g.remove([v_idx])
        vg[bone_name].add([v_idx], 1.0, 'REPLACE')

    def set_blend(v_idx, a, b, t):
        for g in body.vertex_groups:
            g.remove([v_idx])
        vg[a].add([v_idx], 1.0 - t, 'REPLACE')
        vg[b].add([v_idx], t, 'ADD')

    s_ = k
    neck_z = J['neck'].z
    ankle_z = J['ankleL'].z
    boot_top = 0.285 * s_
    fixed = {'boot': 0, 'head': 0, 'hair': 0, 'orphan': 0}
    for v in body.data.vertices:
        p = v.co
        side = 'L' if p.x >= 0 else 'R'
        ax = abs(p.x)
        # 1. Boots: sole + ankle rigid on the foot, shaft rigid on the shin, soft blend between them
        if p.z <= boot_top and ax > 0.095 * s_:
            if p.z <= ankle_z + 0.02 * s_:
                set_rigid(v.index, 'foot' + side)
            elif p.z <= ankle_z + 0.075 * s_:
                set_blend(v.index, 'foot' + side, 'shin' + side, (p.z - (ankle_z + 0.02 * s_)) / (0.055 * s_))
            else:
                set_rigid(v.index, 'shin' + side)
            fixed['boot'] += 1
            continue
        # 2. Skull and hair above the neck are rigid on the head
        if p.z >= neck_z + 0.04 * s_:
            set_rigid(v.index, 'head')
            fixed['head'] += 1
            continue
        # 3. Hair that falls behind the neck and shoulder blades follows the head (and soft-blends into the back)
        back = J['neck'].y + 0.055 * s_
        if p.z >= 0.775 * s_ and p.y > back and ax < 0.17 * s_:
            t = max(0.0, min(1.0, (0.835 * s_ - p.z) / (0.060 * s_)))
            set_blend(v.index, 'head', 'torso', t)
            fixed['hair'] += 1
            continue
        # 4. Orphans (zero weight) go to the nearest bone midpoint
        total_w = sum(g.weight for g in v.groups)
        if total_w < 1e-4:
            best = min(arm_data.bones, key=lambda b: ((b.head_local + b.tail_local) * 0.5 - p).length_squared)
            set_rigid(v.index, best.name)
            fixed['orphan'] += 1
    print('BODY weights', fixed)

    def bl_to_three(v):
        return (v.x, v.z, -v.y)

    hip_h = J['pelvis'].z
    s = hip_h / 0.62
    ankle_l, hip_l, knee_l = J['ankleL'], J['hipL'], J['kneeL']
    thigh_v = bl_to_three((knee_l - hip_l) / s)
    shin_v = bl_to_three((ankle_l - knee_l) / s)
    thigh_len = math.sqrt(sum(c * c for c in thigh_v))
    shin_len = math.sqrt(sum(c * c for c in shin_v))
    thigh_rest = math.atan2(-thigh_v[2], -thigh_v[1])
    shin_rest = math.atan2(-shin_v[2], -shin_v[1])
    sole_heel_z = -(J['heelL'].y - ankle_l.y)
    sole_toe_z = -(J['toeL'].y - ankle_l.y)
    print('=== COWBOY RIG METRICS ===')
    print(f'hipHeight: {hip_h:.4f} (s={s:.4f})')
    print(f'restFootY: {ankle_l.z:.4f}')
    print(f'soleZ: [{sole_heel_z:.4f}, {sole_toe_z:.4f}]')
    print(f'LEG_RIG: THIGH={thigh_len:.4f}, SHIN={shin_len:.4f}, THIGH_REST={thigh_rest:.4f}, SHIN_REST={shin_rest:.4f}, ANKLE={ankle_l.z/s:.4f}, PIVOT={(J["pelvis"].z - hip_l.z)/s:.4f}')
    for name in ('handR', 'handL', 'wristR', 'elbowR', 'shoulderR', 'neck', 'headCenter', 'headTop'):
        print(f'JOINT {name}: {tuple(round(c, 4) for c in J[name])}')

    body.data.validate(verbose=False)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=OUT_HERO,
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
    print(f'EXPORTED {OUT_HERO} ({os.path.getsize(OUT_HERO) // 1024} KB)')
    return J


def build_gear(J):
    clear_scene()
    setup_painterly_world()
    k = TARGET_HEIGHT / RAW_HEIGHT

    # --- Revolver ---
    # Source: stands on a gold pedestal (z = 0), barrel along -X (muzzle at x = -0.587), grip toward +X / down.
    # Output (Blender): muzzle along -Y (= three.js +Z), sights up (+Z), grip centre at the origin.
    gun = load_decimated('gun', GUN_TRIS)
    gun.name = 'CowboyGun'
    bm = bmesh.new()
    bm.from_mesh(gun.data)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0.088), plane_no=(0, 0, 1), clear_inner=True, use_snap_center=False)
    # cap the open grip bottom
    open_edges = [e for e in bm.edges if e.is_boundary]
    if open_edges:
        bmesh.ops.holes_fill(bm, edges=open_edges, sides=64)
    bm.to_mesh(gun.data)
    bm.free()
    gscale = GUN_LENGTH / 1.021
    grip = Vector((0.250, 0.0, 0.215))   # source coords: centre of the wooden grip
    rot = Euler((0.0, 0.0, math.radians(90.0)), 'XYZ').to_matrix().to_4x4()
    gun.data.transform(rot @ Matrix.Scale(gscale, 4) @ Matrix.Translation(-grip))
    gun.data.update()
    g_co = np.empty(len(gun.data.vertices) * 3, dtype=np.float32)
    gun.data.vertices.foreach_get('co', g_co)
    g_co = g_co.reshape(-1, 3)
    print(f'GUN three.js bounds: X=[{g_co[:,0].min():.3f},{g_co[:,0].max():.3f}] Y=[{g_co[:,2].min():.3f},{g_co[:,2].max():.3f}] Z=[{-g_co[:,1].max():.3f},{-g_co[:,1].min():.3f}]')
    bake_painterly_albedo(gun, 'tos_cowboy_gun_tex', size=512)
    keep = bpy.data.images['tos_cowboy_gun_tex']
    for im in list(bpy.data.images):
        if im is not keep and im.users == 0:
            bpy.data.images.remove(im)

    # --- Hat ---
    # Source: faces -Y (star at the front), brim width 0.95, z = 0 at the lowest brim point.
    hat = load_decimated('hat', HAT_TRIS)
    hat.name = 'CowboyHat'
    h_co = np.empty(len(hat.data.vertices) * 3, dtype=np.float32)
    hat.data.vertices.foreach_get('co', h_co)
    h_co = h_co.reshape(-1, 3)
    crown = h_co[h_co[:, 2] > 0.30]
    cx = float((crown[:, 0].min() + crown[:, 0].max()) * 0.5)
    cy = float((crown[:, 1].min() + crown[:, 1].max()) * 0.5)
    brim = float(h_co[:, 0].max() - h_co[:, 0].min())
    hscale = HAT_BRIM / brim
    head_c = J['headCenter']
    neck = J['neck']
    # head-local: origin at the neck joint. Seat the crown base on the hair, tipped slightly back.
    seat = Vector((0.0, head_c.y - neck.y - 0.005, (1.012 * k) - neck.z - 0.115 + 0.075))
    tilt = Euler((math.radians(-8.0), 0.0, 0.0), 'XYZ').to_matrix().to_4x4()
    hat.data.transform(Matrix.Translation(seat) @ tilt @ Matrix.Scale(hscale, 4) @ Matrix.Translation(Vector((-cx, -cy, 0.0))))
    hat.data.update()
    h2 = np.empty(len(hat.data.vertices) * 3, dtype=np.float32)
    hat.data.vertices.foreach_get('co', h2)
    h2 = h2.reshape(-1, 3)
    print(f'HAT head-local bounds: X=[{h2[:,0].min():.3f},{h2[:,0].max():.3f}] Y=[{h2[:,1].min():.3f},{h2[:,1].max():.3f}] Z=[{h2[:,2].min():.3f},{h2[:,2].max():.3f}]')
    bake_painterly_albedo(hat, 'tos_cowboy_hat_tex', size=512, double_sided=True)

    gun.data.name = 'CowboyGun'
    hat.data.name = 'CowboyHat'
    bpy.ops.object.select_all(action='DESELECT')
    gun.select_set(True)
    hat.select_set(True)
    bpy.context.view_layer.objects.active = gun
    bpy.ops.export_scene.gltf(
        filepath=OUT_GEAR,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_animations=False,
        export_materials='EXPORT',
        export_image_format='JPEG',
        export_image_quality=88,
    )
    print(f'EXPORTED {OUT_GEAR} ({os.path.getsize(OUT_GEAR) // 1024} KB)')


def render_qc(J):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=OUT_HERO)
    bpy.ops.import_scene.gltf(filepath=OUT_GEAR)
    hat = bpy.data.objects['CowboyHat']
    gun = bpy.data.objects['CowboyGun']
    hat.parent = None
    hat.location = J['neck']
    hat.rotation_mode = 'XYZ'
    hat.rotation_euler = (0, 0, 0)
    # preview one revolver in each fist, barrel along the forearm, sights up
    for side, sgn in (('R', -1), ('L', 1)):
        g = gun if side == 'R' else gun.copy()
        if side == 'L':
            g.data = gun.data
            bpy.context.scene.collection.objects.link(g)
        g.parent = None
        arm_dir = (J['wrist' + side] - J['elbow' + side]) if 'elbowL' in J else Vector((sgn, 0, 0))
        f = Vector((arm_dir.x, 0.0, arm_dir.z)).normalized()
        up = Vector((0.0, -1.0, 0.0))     # once the arm is raised to aim, the hanging pose's "front" is up
        m = Matrix(((((-f).cross(up))[0], (-f)[0], up[0]), (((-f).cross(up))[1], (-f)[1], up[1]), (((-f).cross(up))[2], (-f)[2], up[2])))
        g.location = J.get('grip' + side, J['hand' + side])
        g.rotation_mode = 'XYZ'
        g.rotation_euler = m.to_euler()

    for name, p in J.items():
        if name in ('handR', 'handL', 'elbowR', 'elbowL', 'shoulderR', 'shoulderL', 'wristR', 'wristL', 'hipR', 'hipL', 'kneeR', 'kneeL', 'ankleR', 'ankleL', 'neck', 'pelvis'):
            m = bpy.data.objects.new('J_' + name, bpy.data.meshes.new('J_' + name))
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.012)
            bm.to_mesh(m.data)
            bm.free()
            m.location = p
            mat = bpy.data.materials.new('jm')
            mat.diffuse_color = (1, 0, 1, 1)
            m.data.materials.append(mat)
            bpy.context.scene.collection.objects.link(m)

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 700
    scene.render.resolution_y = 700
    world = bpy.data.worlds.new('W')
    world.color = (0.82, 0.85, 0.90)
    scene.world = world
    for rot, e in [((50, 0, 30), 2.5), ((60, 0, 210), 1.4)]:
        sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
        sun.data.energy = e
        sun.rotation_euler = tuple(math.radians(a) for a in rot)
        scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    cam.data.type = 'ORTHO'
    scene.collection.objects.link(cam)
    scene.camera = cam
    for tag, ctr, span, angles in [
        ('full', Vector((0, 0, 0.88)), 1.95, [('front', (0, -6, 0)), ('back', (0, 6, 0)), ('side', (6, 0, 0))]),
        ('handR', J['handR'], 0.5, [('front', (0, -3, 0.0)), ('top', (0, 0, 3))]),
        ('head', Vector((0, -0.03, 1.40)), 0.9, [('front', (0, -3, 0)), ('side', (3, 0, 0))]),
    ]:
        cam.data.ortho_scale = span
        for vname, off in angles:
            pos = ctr + Vector(off)
            cam.location = pos
            cam.rotation_euler = (ctr - pos).to_track_quat('-Z', 'Y').to_euler()
            outp = os.path.join(SCRATCH, f'qc_{tag}_{vname}.png')
            scene.render.filepath = outp
            bpy.ops.render.render(write_still=True)
            print('QC_RENDERED', outp)


def joints_from_rig():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=OUT_HERO)
    rig = bpy.data.objects['HeroRig']
    b = rig.data.bones
    return {
        'neck': b['head'].head_local.copy(), 'pelvis': b['hips'].head_local.copy(),
        'handR': b['handR'].head_local.copy(), 'handL': b['handL'].head_local.copy(),
        'headCenter': Vector((0.0, -0.02 * TARGET_HEIGHT / RAW_HEIGHT, 1.0 * TARGET_HEIGHT / RAW_HEIGHT)),
    }


if __name__ == '__main__':
    if '--gear-only' in argv:
        J = joints_from_rig()
        build_gear(J)
        render_qc(J)
    else:
        J = build_hero()
        build_gear(J)
        render_qc(J)
