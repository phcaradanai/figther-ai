# Build the painterly skinned Samurai (hero id `samurai`) and her modular gear (katana, kabuto, back banner).
# Usage:
#   "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python tools/rig/build_samurai.py -- <scratch_dir> [--gear-only]
# The four ~80 MB sources hold ~860k vertices each, so decimation is cached in <scratch_dir>/<name>_dec.blend.
import math
import os
import sys
import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCRATCH = argv[0] if argv and not argv[0].startswith('--') else os.path.join(os.path.expanduser('~'), 'samurai_build')
os.makedirs(SCRATCH, exist_ok=True)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC_DIR = os.environ.get('SAMURAI_SOURCE_DIR', r'C:\Users\phcar\figther-ai\art\blender\source\samurai')
OUT_HERO = os.path.join(REPO_ROOT, 'public', 'assets', 'models', 'hero-samurai.glb')
OUT_GEAR = os.path.join(REPO_ROOT, 'public', 'assets', 'models', 'samurai-gear.glb')

TARGET_HEIGHT = 1.70
RAW_HEIGHT = 1.0885      # body.glb: 1.09 tall (bun included), faces -Y, left = +X, arms in a T pose
RAW_CENTER_X = -0.010
RAW_CENTER_Y = 0.0
BODY_TRIS = 18000
HELMET_TRIS = 3500
KATANA_TRIS = 3500
FLAG_TRIS = 2500
KATANA_LENGTH = 1.10     # metres, pommel to tip
KATANA_GRIP_BELOW_GUARD = 0.10
HELMET_WIDTH = 0.64      # metres across the shoulder guards
FLAG_SCALE = 0.90


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
                    hand = abs(v.co.x - RAW_CENTER_X) > 0.335 and 0.72 < v.co.z < 0.84
                    face = v.co.z > 0.89 and v.co.y < -0.035 and abs(v.co.x - RAW_CENTER_X) < 0.10
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
    bg.inputs['Strength'].default_value = 1.30
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.62, 0.52, 0.52, 1.0)  # warm lantern bounce
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (1.0, 0.97, 0.93, 1.0)   # pale paper sky
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
        ldata.energy = 170.0
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
    """Source-sculpt coordinates (metres, T pose) to the normalised model (feet on z = 0, hips at y = 0)."""
    return Vector(((x - RAW_CENTER_X) * k, (y - RAW_CENTER_Y) * k, z * k))


# Joint positions measured on the decimated sculpt (left side, +X), source units.
RAW_JOINTS = {
    'pelvis': (RAW_CENTER_X, 0.0, 0.535),
    'hip': (0.075, 0.0, 0.530),
    'knee': (0.140, -0.002, 0.285),
    'ankle': (0.195, 0.020, 0.080),
    'shoulder': (0.105, 0.005, 0.780),
    'elbow': (0.235, 0.002, 0.775),
    'wrist': (0.350, 0.0, 0.772),
    'hand': (0.465, 0.0, 0.775),
    'neck': (RAW_CENTER_X, -0.005, 0.865),
    'headTop': (RAW_CENTER_X, -0.005, 1.088),
    'headCenter': (RAW_CENTER_X, -0.010, 0.975),
}


def shape_fists(body, J, k):
    """Curl both hands' fingers around a bar that crosses the palm (a katana hilt).

    The sculpt's hands are open and flat, palm down, fingers along the horizontal arm. The rig bends the arm from a
    canonical hanging pose, where this palm faces the thigh; raising the arm forward to hold the sword leaves the
    palm facing inward with the knuckles stacked vertically. The right hand closes fully around the hilt; the left
    stays loosely curled. Returns the grip-bar centre for each side.
    """
    grips = {}
    curled = 0
    R_BEND = 0.040
    for sgn, phi_max in ((1, 1.55), (-1, 2.35)):
        elbow = Vector((J['elbowL'].x * sgn, J['elbowL'].y, J['elbowL'].z))
        wrist = Vector((J['wrist'].x * sgn, J['wrist'].y, J['wrist'].z))
        tip = Vector((J['hand'].x * sgn, J['hand'].y, J['hand'].z))
        fore_dir = Vector((wrist.x - elbow.x, 0.0, wrist.z - elbow.z)).normalized()
        hand_dir = Vector((tip.x - wrist.x, 0.0, tip.z - wrist.z)).normalized()
        beta = math.atan2(hand_dir.cross(fore_dir).y, hand_dir.dot(fore_dir))
        axis = fore_dir
        n = Vector((-axis.z * sgn, 0.0, axis.x * sgn))
        if n.z < 0:
            n = -n                       # dorsal normal: the back of the hand (up in the T pose)
        b = axis.cross(n)                # along the knuckle line (Y)
        knuckle = wrist + axis * 0.085
        grips[sgn] = knuckle - n * R_BEND
        for v in body.data.vertices:
            in_hand = v.co.x * sgn >= wrist.x * sgn - 0.01 and abs(v.co.z - wrist.z) < 0.14
            r0 = v.co - wrist
            a0 = r0.dot(hand_dir)
            if a0 > 0.0 and in_hand and (r0 - hand_dir * a0).length <= 0.14:
                t = max(0.0, min(1.0, a0 / 0.03))
                v.co = wrist + Matrix.Rotation(beta * t * t * (3.0 - 2.0 * t), 3, 'Y') @ r0
            rel = v.co - knuckle
            a = rel.dot(axis)
            if a <= 0.0 or not in_hand or (rel - axis * a).length > 0.14:
                continue
            c = rel.dot(n)
            e = rel.dot(b)
            phi = min(a / R_BEND, phi_max)
            rho = R_BEND + c
            extra = max(0.0, a - phi_max * R_BEND)
            a2 = rho * math.sin(phi) + extra * math.cos(phi_max)
            c2 = rho * math.cos(phi) - R_BEND - extra * math.sin(phi_max)
            v.co = knuckle + axis * a2 + n * c2 + b * e
            curled += 1
    print(f'CURLED fists: {curled} verts; grip centres L={tuple(round(c, 3) for c in grips[1])} R={tuple(round(c, 3) for c in grips[-1])}')
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
    # geta: heel / toe from the sole
    vs = np.empty(len(body.data.vertices) * 3, dtype=np.float32)
    body.data.vertices.foreach_get('co', vs)
    vs = vs.reshape(-1, 3)
    sole = vs[(vs[:, 2] <= 0.04 * k) & (vs[:, 0] > 0.10 * k)]
    toe_y, heel_y = float(sole[:, 1].min()), float(sole[:, 1].max())
    for s, sgn in (('L', 1), ('R', -1)):
        J['toe' + s] = Vector((J['ankle' + s].x, toe_y, 0.03))
        J['heel' + s] = Vector((J['ankle' + s].x, heel_y, 0.03))
    print(f'BODY scale={k:.4f} sole y=[{toe_y:.3f},{heel_y:.3f}]')

    grips = shape_fists(body, J, k)
    J['gripL'] = grips[1]
    J['gripR'] = grips[-1]
    bake_painterly_albedo(body, 'tos_samurai_body_tex', size=1024, double_sided=True)

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

    def seg_dist_xy(p, a, b):
        # distance in XY from p to the segment a-b (a leg axis seen from above)
        ab = Vector((b.x - a.x, b.y - a.y, 0.0))
        ap = Vector((p.x - a.x, p.y - a.y, 0.0))
        t = max(0.0, min(1.0, ap.dot(ab) / max(ab.length_squared, 1e-9)))
        return (ap - ab * t).length

    neck_z = J['neck'].z
    ankle_z = J['ankleL'].z
    arm_z = J['shoulderL'].z
    fixed = {'foot': 0, 'shin': 0, 'head': 0, 'skirt': 0, 'sleeve': 0, 'orphan': 0}
    for v in body.data.vertices:
        p = v.co
        side = 'L' if p.x >= 0 else 'R'
        ax = abs(p.x)
        # 1. Geta and tabi: sole and ankle rigid on the foot, the sock above on the shin
        if p.z <= 0.30 * k:
            leg_d = seg_dist_xy(p, J['ankle' + side], J['knee' + side])
            foot_d = math.hypot(p.x - J['ankle' + side].x, p.y - J['ankle' + side].y)
            if foot_d < 0.10 * k or leg_d < 0.055 * k:
                if p.z <= ankle_z + 0.015 * k:
                    set_rigid(v.index, 'foot' + side)
                    fixed['foot'] += 1
                    continue
                if p.z <= ankle_z + 0.06 * k:
                    set_blend(v.index, 'foot' + side, 'shin' + side, (p.z - (ankle_z + 0.015 * k)) / (0.045 * k))
                    fixed['foot'] += 1
                    continue
                if p.z <= 0.24 * k and leg_d < 0.05 * k:
                    set_rigid(v.index, 'shin' + side)
                    fixed['shin'] += 1
                    continue
        # 2. Head, hair and bun
        if p.z >= neck_z + 0.02 * k:
            set_rigid(v.index, 'head')
            fixed['head'] += 1
            continue
        # 3. Hakama and the lacquered tassets: hang from the hips, follow the thighs a little (never the shins)
        if 0.17 * k <= p.z <= 0.52 * k:
            leg_d = min(seg_dist_xy(p, J['hip' + side], J['knee' + side]), seg_dist_xy(p, J['knee' + side], J['ankle' + side]))
            if leg_d > 0.065 * k:
                h_t = max(0.0, min(1.0, (0.52 * k - p.z) / (0.34 * k)))
                w_hips = 0.80 - 0.40 * h_t
                lr = max(0.0, min(1.0, (p.x + 0.09 * k) / (0.18 * k)))
                for g in body.vertex_groups:
                    g.remove([v.index])
                vg['hips'].add([v.index], w_hips, 'REPLACE')
                w_legs = 1.0 - w_hips
                if lr > 0.02:
                    vg['legL'].add([v.index], w_legs * lr, 'ADD')
                if lr < 0.98:
                    vg['legR'].add([v.index], w_legs * (1.0 - lr), 'ADD')
                fixed['skirt'] += 1
                continue
        # 4. The hanging half of each wide sleeve: tie it to the torso the further it hangs below the arm, so with
        # the arm lowered it drapes at her side instead of sticking out as a wing
        if ax > 0.13 * k and 0.50 * k < p.z < arm_z - 0.05 * k:
            arm_ids = {vg['arm' + side].index, vg['fore' + side].index, vg['hand' + side].index}
            weights = {g.group: g.weight for g in v.groups}
            total = sum(weights.values())
            if total > 1e-4 and sum(w for gi, w in weights.items() if gi in arm_ids) > 0.5 * total:
                f_torso = max(0.0, min(1.0, (arm_z - 0.05 * k - p.z) / (0.13 * k)))
                for gi, w in weights.items():
                    if gi in arm_ids:
                        body.vertex_groups[gi].add([v.index], w * (1.0 - f_torso), 'REPLACE')
                        vg['torso'].add([v.index], w * f_torso, 'ADD')
                fixed['sleeve'] += 1
                continue
        # 5. Orphans (zero weight) go to the nearest bone midpoint
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
    print('=== SAMURAI RIG METRICS ===')
    print(f'hipHeight: {hip_h:.4f} (s={s:.4f})')
    print(f'restFootY: {ankle_l.z:.4f}')
    print(f'soleZ: [{sole_heel_z:.4f}, {sole_toe_z:.4f}]')
    print(f'LEG_RIG: THIGH={thigh_len:.4f}, SHIN={shin_len:.4f}, THIGH_REST={thigh_rest:.4f}, SHIN_REST={shin_rest:.4f}, ANKLE={ankle_l.z/s:.4f}, PIVOT={(J["pelvis"].z - hip_l.z)/s:.4f}')
    for name in ('handR', 'handL', 'wristR', 'elbowR', 'shoulderR', 'neck', 'headCenter', 'headTop', 'gripR'):
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


def mesh_array(obj):
    co = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
    obj.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def build_gear(J):
    clear_scene()
    setup_painterly_world()
    k = TARGET_HEIGHT / RAW_HEIGHT

    # --- Katana ---
    # Source: a curved blade lying diagonally in the XZ plane, pommel top-right, tip bottom-left, tsuba (guard) the
    # widest cross-section. Output frame (the right fist's mount frame, three.js axes): blade along +Z, spine +Y
    # (so the cutting edge faces -Y, forward once the arm is raised), flat sides along X, origin in the hilt under
    # the guard where the fist closes.
    sword = load_decimated('katana', KATANA_TRIS)
    sword.name = 'SamuraiKatana'
    co = mesh_array(sword).astype(np.float64)
    centre = co.mean(axis=0)
    _, _, vt = np.linalg.svd(co - centre, full_matrices=False)
    axis = vt[0]
    t = (co - centre) @ axis
    length = float(t.max() - t.min())
    perp = (co - centre) - np.outer(t, axis)
    spread = np.linalg.norm(perp, axis=1)
    bins = np.linspace(t.min(), t.max(), 41)
    widths = []
    for i in range(40):
        m = (t >= bins[i]) & (t < bins[i + 1])
        widths.append(float(spread[m].max()) if m.any() else 0.0)
    guard_t = (bins[int(np.argmax(widths))] + bins[int(np.argmax(widths)) + 1]) * 0.5
    # the handle is the shorter side of the guard
    handle_is_min = (guard_t - t.min()) < (t.max() - guard_t)
    u_dir = axis if handle_is_min else -axis          # from the handle toward the tip
    tt = (co - centre) @ u_dir
    chord_perp = (co - centre) - np.outer(tt, u_dir)
    mid = (tt > np.quantile(tt, 0.40)) & (tt < np.quantile(tt, 0.85))
    bow = chord_perp[mid].mean(axis=0)
    thin = vt[2]                                      # least-variance axis: the blade's flat-side normal
    bow = bow - thin * float(bow @ thin)
    bow_len = float(np.linalg.norm(bow))
    edge = bow / bow_len if bow_len > 1e-6 else vt[1]
    spine = -edge
    flat = np.cross(spine, u_dir)
    flat = flat / np.linalg.norm(flat)
    scale = KATANA_LENGTH / length
    guard_pos = centre + axis * guard_t
    grip = guard_pos - u_dir * (KATANA_GRIP_BELOW_GUARD / scale)
    print(f'KATANA raw length={length:.3f} guard t={guard_t:.3f} handle_is_min={handle_is_min} bow={bow_len:.4f}')
    # to the Blender frame: three (X, Y, Z) = (flat, spine, u) and blender (x, y, z) = (X, -Z, Y)
    vv = co - grip
    new = np.stack([vv @ flat, -(vv @ u_dir), vv @ spine], axis=1) * scale
    for i, vert in enumerate(sword.data.vertices):
        vert.co = Vector(new[i])
    sword.data.update()
    n2 = mesh_array(sword)
    print(f'KATANA three.js bounds: X=[{n2[:,0].min():.3f},{n2[:,0].max():.3f}] Y=[{n2[:,2].min():.3f},{n2[:,2].max():.3f}] Z=[{-n2[:,1].max():.3f},{-n2[:,1].min():.3f}]')
    bake_painterly_albedo(sword, 'tos_samurai_katana_tex', size=512)

    # --- Kabuto ---
    # Source: front toward -Y, z = 0 at the neck-guard hem. Output: head-local (origin at the neck joint, Blender
    # axes), scaled so the shoulder guards span HELMET_WIDTH.
    helm = load_decimated('helmet', HELMET_TRIS)
    helm.name = 'SamuraiHelmet'
    h = mesh_array(helm)
    width = float(h[:, 0].max() - h[:, 0].min())
    hs = HELMET_WIDTH / width
    cx = float((h[:, 0].max() + h[:, 0].min()) * 0.5)
    bowl = h[h[:, 2] > 0.45 * float(h[:, 2].max())]
    cy = float((bowl[:, 1].max() + bowl[:, 1].min()) * 0.5)
    head_c = J['headCenter']
    neck = J['neck']
    rim_raw = 0.53 * float(h[:, 2].max()) / 1.0
    dz = (head_c.z + 0.06 - neck.z) - rim_raw * hs
    helm.data.transform(Matrix.Translation(Vector((0.0, head_c.y - neck.y, dz))) @ Matrix.Scale(hs, 4) @ Matrix.Translation(Vector((-cx, -cy, 0.0))))
    helm.data.update()
    h2 = mesh_array(helm)
    print(f'HELMET head-local bounds: X=[{h2[:,0].min():.3f},{h2[:,0].max():.3f}] Y=[{h2[:,1].min():.3f},{h2[:,1].max():.3f}] Z=[{h2[:,2].min():.3f},{h2[:,2].max():.3f}]')
    bake_painterly_albedo(helm, 'tos_samurai_helmet_tex', size=512, double_sided=True)

    # --- Back banner (sashimono) ---
    # Source: a banner on a stand: pole, cross bar and cloth, with a round pedestal at z = 0. Cut the pedestal, turn
    # the cloth to face backwards and put the foot of the pole at the origin (torso-local mount).
    flag = load_decimated('flag', FLAG_TRIS)
    flag.name = 'SamuraiFlag'
    bm = bmesh.new()
    bm.from_mesh(flag.data)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0.16), plane_no=(0, 0, 1), clear_inner=True, use_snap_center=False)
    bm.to_mesh(flag.data)
    bm.free()
    f = mesh_array(flag)
    foot = Vector((float((f[:, 0].max() + f[:, 0].min()) * 0.5), float((f[:, 1].max() + f[:, 1].min()) * 0.5), float(f[:, 2].min())))
    rot_z = Euler((0.0, 0.0, math.pi), 'XYZ').to_matrix().to_4x4()   # cloth face turned to the back (+Y)
    flag.data.transform(Matrix.Scale(FLAG_SCALE, 4) @ rot_z @ Matrix.Translation(-foot))
    flag.data.update()
    f2 = mesh_array(flag)
    print(f'FLAG three.js bounds: X=[{f2[:,0].min():.3f},{f2[:,0].max():.3f}] Y=[{f2[:,2].min():.3f},{f2[:,2].max():.3f}] Z=[{-f2[:,1].max():.3f},{-f2[:,1].min():.3f}]')
    bake_painterly_albedo(flag, 'tos_samurai_flag_tex', size=512, double_sided=True)

    sword.data.name = 'SamuraiKatana'
    helm.data.name = 'SamuraiHelmet'
    flag.data.name = 'SamuraiFlag'
    keep = {'tos_samurai_katana_tex', 'tos_samurai_helmet_tex', 'tos_samurai_flag_tex'}
    for im in list(bpy.data.images):
        if im.name not in keep and im.users == 0:
            bpy.data.images.remove(im)
    bpy.ops.object.select_all(action='DESELECT')
    for o in (sword, helm, flag):
        o.select_set(True)
    bpy.context.view_layer.objects.active = sword
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
    helm = bpy.data.objects['SamuraiHelmet']
    sword = bpy.data.objects['SamuraiKatana']
    flag = bpy.data.objects['SamuraiFlag']
    for o in (helm, sword, flag):
        o.parent = None
        o.rotation_mode = 'XYZ'
        o.rotation_euler = (0, 0, 0)
    helm.location = J['neck']
    sword.location = J.get('gripR', J['handR'])
    flag.location = Vector((0.0, J['pelvis'].y + 0.17, J['pelvis'].z + 0.06))

    for name, p in J.items():
        if name in ('handR', 'handL', 'elbowR', 'elbowL', 'shoulderR', 'shoulderL', 'hipR', 'hipL', 'kneeR', 'kneeL', 'ankleR', 'ankleL', 'neck', 'pelvis'):
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
        ('full', Vector((0, 0, 0.92)), 2.05, [('front', (0, -6, 0)), ('back', (0, 6, 0)), ('side', (6, 0, 0))]),
        ('handR', J['handR'], 0.6, [('front', (0, -3, 0.0)), ('top', (0, 0, 3))]),
        ('head', Vector((0, -0.03, 1.45)), 1.0, [('front', (0, -3, 0)), ('side', (3, 0, 0))]),
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
    k = TARGET_HEIGHT / RAW_HEIGHT
    return {
        'neck': b['head'].head_local.copy(), 'pelvis': b['hips'].head_local.copy(),
        'handR': b['handR'].head_local.copy(), 'handL': b['handL'].head_local.copy(),
        'headCenter': Vector((0.0, -0.010 * k, 0.975 * k)),
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
