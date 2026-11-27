# Build the Tree-of-Savior painterly skinned Fire Archmage hero and modular gear.
# Usage:
#   "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python tools/rig/build_pyromancer.py -- <scratch_dir>
import math
import os
import sys
import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCRATCH = argv[0] if argv else os.path.join(os.path.expanduser('~'), 'pyro_build')
os.makedirs(SCRATCH, exist_ok=True)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC_DIR = os.environ.get('PYRO_SOURCE_DIR', r'C:\Users\phcar\figther-ai\art\blender\source\pyromancer')
OUT_HERO = os.path.join(REPO_ROOT, 'public', 'assets', 'models', 'hero-mage.glb')
OUT_GEAR = os.path.join(REPO_ROOT, 'public', 'assets', 'models', 'mage-gear.glb')

TARGET_HEIGHT = 1.74
BODY_TRIS = 14000
STAFF_TRIS = 2400
HAT_TRIS = 2600
ORB_TRIS = 2000


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def weld_and_decimate(obj, target_tris, weld_dist=0.00005):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld_dist)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.calc_loop_triangles()
    tris = len(obj.data.loop_triangles)
    if tris > target_tris:
        mod = obj.modifiers.new('Decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = max(0.001, min(1.0, target_tris / tris))
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.calc_loop_triangles()
    for p in obj.data.polygons:
        p.use_smooth = True
    return len(obj.data.loop_triangles)


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
    ramp.color_ramp.elements[0].color = (0.72, 0.54, 0.48, 1.0)  # warm ember bounce
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (1.0, 0.96, 0.90, 1.0)   # warm storybook ivory sky
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


def bake_painterly_albedo(obj, tex_name, size=1024, double_sided=False, emissive_boost=0.0):
    for im in bpy.data.images:
        if im.size[0] > 1024:
            im.scale(1024, 1024)

    img = bpy.data.images.new(tex_name, width=size, height=size, alpha=False)
    img.colorspace_settings.name = 'sRGB'

    if not obj.data.materials:
        mat = bpy.data.materials.new(f'{tex_name}_mat')
        mat.use_nodes = True
        obj.data.materials.append(mat)
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
                if met_in and not met_in.is_linked and met_in.default_value > 0.35:
                    met_in.default_value = 0.28
                elif met_in and met_in.is_linked:
                    met_in.default_value = 0.25
                    for l in list(met_in.links):
                        nt.links.remove(l)
                if emissive_boost > 0.0 and 'Emission Strength' in n.inputs:
                    n.inputs['Emission Strength'].default_value = max(
                        n.inputs['Emission Strength'].default_value, emissive_boost
                    )

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


def shape_hands(body):
    # Right hand (-X): curl open fingers into a compact staff-gripping fist.
    sgn = -1
    knuckle_x = -0.548
    palm_vs = [v.co for v in body.data.vertices
               if -0.580 <= v.co.x <= -0.510 and -0.22 <= v.co.y <= 0.02 and 0.84 <= v.co.z <= 0.98]
    if palm_vs:
        cy = sum(p.y for p in palm_vs) / len(palm_vs)
        cz = sum(p.z for p in palm_vs) / len(palm_vs) - 0.015
        curled = 0
        for v in body.data.vertices:
            ax = -v.co.x
            if ax <= 0.525 or v.co.z < 0.78 or v.co.z > 1.02:
                continue
            t = max(0.0, min(1.0, (ax - 0.525) / 0.120))
            is_thumb = (v.co.y < cy - 0.042 and v.co.z < cz + 0.025 and ax < 0.60)
            if is_thumb:
                blend = min(1.0, (ax - 0.528) / 0.060) * 0.85
                tx = -(0.556 - (ax - 0.528) * 0.22)
                ty = cy - 0.032
                tz = cz - 0.008
                v.co.x = v.co.x * (1.0 - blend) + tx * blend
                v.co.y = v.co.y * (1.0 - blend) + ty * blend
                v.co.z = v.co.z * (1.0 - blend) + tz * blend
            else:
                theta = t * math.pi * 1.15
                rad = max(0.019, 0.034 - 0.012 * t)
                local_x = knuckle_x + (math.sin(theta) * rad + 0.015) * sgn
                local_z = cz + math.cos(theta) * rad * 0.82 - 0.009 * t
                local_y = cy + (v.co.y - cy) * (1.0 - 0.30 * t)
                blend = min(1.0, (ax - 0.525) / 0.036)
                v.co.x = v.co.x * (1.0 - blend) + local_x * blend
                v.co.y = v.co.y * (1.0 - blend) + local_y * blend
                v.co.z = v.co.z * (1.0 - blend) + local_z * blend
            curled += 1
        print(f'CURLED right staff fist: {curled} verts around ({knuckle_x:+.3f}, {cy:+.3f}, {cz:+.3f})')

    # Left hand (+X): preserve natural open spellcasting palm, softly relaxing stiff finger tips downward.
    relaxed = 0
    for v in body.data.vertices:
        if v.co.x > 0.555 and 0.82 <= v.co.z <= 1.00:
            t = max(0.0, min(1.0, (v.co.x - 0.555) / 0.090))
            v.co.z -= 0.014 * (t ** 1.3)
            v.co.y -= 0.008 * t
            relaxed += 1
    print(f'RELAXED left casting palm: {relaxed} verts')


def build_hero_mage():
    clear_scene()
    setup_painterly_world()
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, 'body.glb'))
    body = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    body.name = 'Body'
    tris = weld_and_decimate(body, BODY_TRIS)

    # Normalize: feet on z = 0, centered X/Y, height = 1.74 m (faces -Y, left = +X, right = -X)
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    k = TARGET_HEIGHT / (mx.z - mn.z)
    off = Vector(((mn.x + mx.x) * 0.5, (mn.y + mx.y) * 0.5, mn.z))
    body.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation(-off))
    body.data.update()
    print(f'BODY cleaned tris={tris} scale={k:.4f}')

    shape_hands(body)
    bake_painterly_albedo(body, 'tos_mage_body_tex', size=1024, double_sided=False)

    verts = [body.matrix_world @ v.co for v in body.data.vertices]

    def mid_x_sym(zlo, zhi, xlo, xhi, ylo=-0.35, yhi=0.35, fb=None):
        lpts = [v for v in verts if zlo <= v.z <= zhi and xlo <= v.x <= xhi and ylo <= v.y <= yhi]
        rpts = [v for v in verts if zlo <= v.z <= zhi and -xhi <= v.x <= -xlo and ylo <= v.y <= yhi]
        pts = lpts + [Vector((-v.x, v.y, v.z)) for v in rpts]
        if not pts:
            return Vector(fb)
        xs = [p.x for p in pts]
        ys = [p.y for p in pts]
        return Vector(((min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5, (zlo + zhi) * 0.5))

    def arm_x_sym(xlo, xhi, zlo=0.80, zhi=1.18, ylo=-0.25, yhi=0.05, fb=None):
        lpts = [v for v in verts if xlo <= v.x <= xhi and zlo <= v.z <= zhi and ylo <= v.y <= yhi]
        rpts = [v for v in verts if -xhi <= v.x <= -xlo and zlo <= v.z <= zhi and ylo <= v.y <= yhi]
        pts = lpts + [Vector((-v.x, v.y, v.z)) for v in rpts]
        if not pts:
            return Vector(fb)
        ys = [p.y for p in pts]
        zs = [p.z for p in pts]
        return Vector(((xlo + xhi) * 0.5, (min(ys) + max(ys)) * 0.5, (min(zs) + max(zs)) * 0.5))

    J = {}
    for s, sgn in (('L', 1), ('R', -1)):
        hip = mid_x_sym(0.68, 0.76, 0.05, 0.21, -0.18, 0.10, (0.13, -0.04, 0.72))
        knee = mid_x_sym(0.39, 0.45, 0.08, 0.28, -0.16, 0.10, (0.18, -0.04, 0.42))
        ankle = mid_x_sym(0.10, 0.14, 0.13, 0.27, -0.12, 0.06, (0.20, -0.03, 0.12))
        foot_pts = [v for v in verts if v.z <= 0.045 and v.x * sgn > 0.10]
        heel_y = max((v.y for v in foot_pts), default=0.06)
        toe_y = min((v.y for v in foot_pts), default=-0.23)

        shoulder = arm_x_sym(0.16, 0.22, 1.04, 1.16, -0.18, 0.06, (0.19, -0.04, 1.10))
        elbow = arm_x_sym(0.32, 0.37, 0.94, 1.08, -0.18, 0.04, (0.345, -0.05, 1.00))
        wrist = arm_x_sym(0.47, 0.51, 0.86, 0.98, -0.20, 0.00, (0.49, -0.09, 0.91))
        hand = arm_x_sym(0.54, 0.585, 0.84, 0.96, -0.20, 0.00, (0.56, -0.10, 0.90))

        J['hip' + s] = Vector((hip.x * sgn, hip.y, hip.z))
        J['knee' + s] = Vector((knee.x * sgn, knee.y, knee.z))
        J['ankle' + s] = Vector((ankle.x * sgn, ankle.y, ankle.z))
        J['toe' + s] = Vector((ankle.x * sgn, toe_y, 0.03))
        J['heel' + s] = Vector((ankle.x * sgn, heel_y, 0.03))
        J['shoulder' + s] = Vector((shoulder.x * sgn, shoulder.y, shoulder.z))
        J['elbow' + s] = Vector((elbow.x * sgn, elbow.y, elbow.z))
        J['wrist' + s] = Vector((wrist.x * sgn, wrist.y, wrist.z))
        J['hand' + s] = Vector((hand.x * sgn, hand.y, hand.z))

    neck_pts = [v for v in verts if 1.19 <= v.z <= 1.25 and -0.09 <= v.x <= 0.09 and -0.16 <= v.y <= 0.12]
    neck_y = sum(v.y for v in neck_pts) / len(neck_pts) if neck_pts else -0.035
    pelvis_y = (J['hipL'].y + J['hipR'].y) * 0.5
    pelvis_z = 0.74
    J['pelvis'] = Vector((0.0, pelvis_y, pelvis_z))
    J['neck'] = Vector((0.0, neck_y, 1.22))
    J['headTop'] = Vector((0.0, neck_y, 1.68))

    head_pts = [v for v in verts if 1.38 <= v.z <= 1.50]
    head_cx = (min(v.x for v in head_pts) + max(v.x for v in head_pts)) * 0.5 if head_pts else 0.0
    head_cy = (min(v.y for v in head_pts) + max(v.y for v in head_pts)) * 0.5 if head_pts else -0.05
    J['headCenter'] = Vector((head_cx, head_cy, 1.44))

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

    unweighted_fixed = 0
    for v in body.data.vertices:
        p = v.co
        # 1. Rigid leather boots (soles strictly rigid on footL/footR)
        if p.z <= 0.145 and abs(p.x) > 0.08:
            set_rigid(v.index, 'footL' if p.x >= 0 else 'footR')
            continue
        # 2. Rigid head & hair above z = 1.24 (keeping hood collar on torso below z = 1.23)
        if p.z >= 1.24:
            set_rigid(v.index, 'head')
            continue
        # 3. Clean flared mage robe skirt weights: never let shin/foot bones pull hem verts;
        # blend smoothly between hips near waist and legL/R lower down with soft center split.
        if 0.24 <= p.z <= 0.72 and abs(p.x) < 0.38:
            r_x = abs(p.x)
            # Only outer robe skirt / hem region (below cuff height z < 0.72 and away from boot shaft)
            is_center_skirt = (r_x < 0.10 or p.y < -0.14 or p.y > 0.12)
            if p.z < 0.58 and is_center_skirt:
                for g in body.vertex_groups:
                    g.remove([v.index])
                # Height factor: 0 at waist (0.72) -> 1 at lower hem (0.28)
                h_t = max(0.0, min(1.0, (0.72 - p.z) / 0.44))
                w_hips = 0.65 - 0.35 * h_t
                w_legs = 1.0 - w_hips
                # Smooth left/right thigh split near x = 0 so center lapel never stretches/tears
                lr = max(0.0, min(1.0, (p.x + 0.08) / 0.16))
                vg['hips'].add([v.index], w_hips, 'REPLACE')
                if lr > 0.02:
                    vg['legL'].add([v.index], w_legs * lr, 'ADD')
                if lr < 0.98:
                    vg['legR'].add([v.index], w_legs * (1.0 - lr), 'ADD')
                continue

        # 4. Fix any orphan zero-weight vertices by nearest bone midpoint
        total_w = sum(g.weight for g in v.groups)
        if total_w < 1e-4:
            best_b = min(
                arm_data.bones,
                key=lambda b: ((b.head_local + b.tail_local) * 0.5 - p).length_squared
            )
            set_rigid(v.index, best_b.name)
            unweighted_fixed += 1

    print('BODY weights cleaned, unweighted_fixed=', unweighted_fixed)

    def bl_to_three(v):
        return (v.x, v.z, -v.y)

    hip_h = J['pelvis'].z
    s = hip_h / 0.62
    ankle_l = J['ankleL']
    hip_l = J['hipL']
    knee_l = J['kneeL']
    thigh_v = bl_to_three((knee_l - hip_l) / s)
    shin_v = bl_to_three((ankle_l - knee_l) / s)
    thigh_len = math.sqrt(sum(c * c for c in thigh_v))
    shin_len = math.sqrt(sum(c * c for c in shin_v))
    thigh_rest = math.atan2(-thigh_v[2], -thigh_v[1])
    shin_rest = math.atan2(-shin_v[2], -shin_v[1])
    sole_heel_z = -(J['heelL'].y - ankle_l.y)
    sole_toe_z = -(J['toeL'].y - ankle_l.y)

    print('=== MAGE RIG METRICS ===')
    print(f'hipHeight: {hip_h:.4f} (s={s:.4f})')
    print(f'restFootY: {ankle_l.z:.4f}')
    print(f'soleZ: [{sole_heel_z:.4f}, {sole_toe_z:.4f}]')
    print(f'LEG_RIG: THIGH={thigh_len:.4f}, SHIN={shin_len:.4f}, THIGH_REST={thigh_rest:.4f}, SHIN_REST={shin_rest:.4f}, ANKLE={ankle_l.z/s:.4f}, PIVOT={(J["pelvis"].z - hip_l.z)/s:.4f}')
    print('handR world:', J['handR'], 'handL world:', J['handL'])
    print('neck world:', J['neck'], 'headCenter:', J['headCenter'])

    body.data.name = 'Body'
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
    print(f'EXPORTED {OUT_HERO} ({os.path.getsize(OUT_HERO)//1024} KB)')
    return J


def detach_bake_images(keep_imgs):
    # Remember already baked images so each imported gear piece finds its own fresh raw image
    pass


def build_mage_gear(J):
    clear_scene()
    setup_painterly_world()

    # --- 1. MageStaff from staff.glb ---
    # Raw staff.glb runs vertically from z=0.0 (butt) to z=1.199 (flame crystal tip),
    # with wide flame face along +-X.
    # Rotate +90 deg around X so raw +Z tip maps to Blender -Y (= Three.js +Z, matching R.staff axis!),
    # raw +Y maps to Blender +Z (= Three.js +Y), keeping ornate face symmetrical in X.
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, 'staff.glb'))
    staff = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    staff.name = 'MageStaff'
    weld_and_decimate(staff, STAFF_TRIS)

    staff.data.transform(Euler((math.pi * 0.5, 0.0, 0.0), 'XYZ').to_matrix().to_4x4())
    co = np.empty(len(staff.data.vertices) * 3, dtype=np.float32)
    staff.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    length = float(co[:, 1].max() - co[:, 1].min())
    scale_st = 1.34 / length
    # Place hand grip 35% up the shaft from butt (+Y max) toward flame tip (-Y min)
    grip_y = float(co[:, 1].max()) - 0.35 * length
    ctr_x = float((co[:, 0].min() + co[:, 0].max()) * 0.5)
    ctr_z = float((co[:, 2].min() + co[:, 2].max()) * 0.5)
    staff.data.transform(Matrix.Scale(scale_st, 4) @ Matrix.Translation(Vector((-ctr_x, -grip_y, -ctr_z))))
    staff.data.update()
    s_co = np.empty(len(staff.data.vertices) * 3, dtype=np.float32)
    staff.data.vertices.foreach_get('co', s_co)
    s_co = s_co.reshape(-1, 3)
    print(f'STAFF three.js bounds: X=[{s_co[:,0].min():.3f},{s_co[:,0].max():.3f}] Y=[{s_co[:,2].min():.3f},{s_co[:,2].max():.3f}] Z=[{-s_co[:,1].max():.3f},{-s_co[:,1].min():.3f}]')
    bake_painterly_albedo(staff, 'tos_mage_staff_tex', size=512, double_sided=False, emissive_boost=0.0)
    # Remove any unreferenced imported images before loading next gear item so image cleanup never collides
    keep_img = bpy.data.images['tos_mage_staff_tex']
    for im in list(bpy.data.images):
        if im is not keep_img and im.users == 0:
            bpy.data.images.remove(im)

    # --- 2. MageHat from hat.glb ---
    # Raw hat.glb faces -Y (golden flame emblem at front -Y), z=0.0..0.621, brim diameter ~1.04.
    # Seat brim above eyebrows/front hair curls so crown hair never pokes through the crest.
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, 'hat.glb'))
    hat = [o for o in bpy.data.objects if o.type == 'MESH' and o is not staff][0]
    hat.name = 'MageHat'
    weld_and_decimate(hat, HAT_TRIS)

    h_co = np.empty(len(hat.data.vertices) * 3, dtype=np.float32)
    hat.data.vertices.foreach_get('co', h_co)
    h_co = h_co.reshape(-1, 3)
    rim = h_co[h_co[:, 2] <= 0.14]
    cx = float((rim[:, 0].min() + rim[:, 0].max()) * 0.5)
    cy = float((rim[:, 1].min() + rim[:, 1].max()) * 0.5)
    cz = float(rim[:, 2].min())
    hat_scale = 0.98
    hat_tilt = Euler((math.radians(8.0), 0.0, 0.0), 'XYZ').to_matrix().to_4x4()
    head_offset_y = float(J['headCenter'].y - J['neck'].y)
    # Seat lower brim around z=1.555 (neck 1.22 + 0.335) so upper crown cleanly clears top hair!
    hat_target = Vector((0.0, head_offset_y + 0.005, 0.335))
    M_hat = (
        Matrix.Translation(hat_target)
        @ hat_tilt
        @ Matrix.Scale(hat_scale, 4)
        @ Matrix.Translation(Vector((-cx, -cy, -cz)))
    )
    hat.data.transform(M_hat)
    hat.data.update()
    h2 = np.empty(len(hat.data.vertices) * 3, dtype=np.float32)
    hat.data.vertices.foreach_get('co', h2)
    h2 = h2.reshape(-1, 3)
    print(f'HAT head-local bounds: X=[{h2[:,0].min():.3f},{h2[:,0].max():.3f}] Y=[{h2[:,1].min():.3f},{h2[:,1].max():.3f}] Z=[{h2[:,2].min():.3f},{h2[:,2].max():.3f}]')
    bake_painterly_albedo(hat, 'tos_mage_hat_tex', size=512, double_sided=True, emissive_boost=0.0)

    # --- 3. MageOrb from orb.glb ---
    # Raw orb.glb has sphere core + ring spanning z=0.0..0.55 and top flame up to z=1.193, size ~0.81 x 0.80 x 1.19.
    # Center the orb core around (0, 0, 0) in upright Blender +Z (= Three.js +Y), scale outer ring to ~0.27 m.
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, 'orb.glb'))
    orb = [o for o in bpy.data.objects if o.type == 'MESH' and o not in (staff, hat)][0]
    orb.name = 'MageOrb'
    weld_and_decimate(orb, ORB_TRIS)

    o_co = np.empty(len(orb.data.vertices) * 3, dtype=np.float32)
    orb.data.vertices.foreach_get('co', o_co)
    o_co = o_co.reshape(-1, 3)
    ring = o_co[o_co[:, 2] <= 0.45]
    ox = float((ring[:, 0].min() + ring[:, 0].max()) * 0.5)
    oy = float((ring[:, 1].min() + ring[:, 1].max()) * 0.5)
    oz = float(ring[:, 2].min() + (ring[:, 2].max() - ring[:, 2].min()) * 0.58)
    orb_diam = float(ring[:, 0].max() - ring[:, 0].min())
    orb_scale = 0.27 / max(0.2, orb_diam)
    orb.data.transform(Matrix.Scale(orb_scale, 4) @ Matrix.Translation(Vector((-ox, -oy, -oz))))
    orb.data.update()
    o2 = np.empty(len(orb.data.vertices) * 3, dtype=np.float32)
    orb.data.vertices.foreach_get('co', o2)
    o2 = o2.reshape(-1, 3)
    print(f'ORB local bounds: X=[{o2[:,0].min():.3f},{o2[:,0].max():.3f}] Y=[{o2[:,1].min():.3f},{o2[:,1].max():.3f}] Z=[{o2[:,2].min():.3f},{o2[:,2].max():.3f}]')
    bake_painterly_albedo(orb, 'tos_mage_orb_tex', size=512, double_sided=False, emissive_boost=0.0)

    staff.data.name = 'MageStaff'
    hat.data.name = 'MageHat'
    orb.data.name = 'MageOrb'
    bpy.ops.object.select_all(action='DESELECT')
    staff.select_set(True)
    hat.select_set(True)
    orb.select_set(True)
    bpy.context.view_layer.objects.active = staff
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
    print(f'EXPORTED {OUT_GEAR} ({os.path.getsize(OUT_GEAR)//1024} KB)')


def render_qc(J):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=OUT_HERO)
    bpy.ops.import_scene.gltf(filepath=OUT_GEAR)

    hat = bpy.data.objects['MageHat']
    staff = bpy.data.objects['MageStaff']
    orb = bpy.data.objects['MageOrb']

    hat.parent = None
    hat.location = J['neck']
    hat.rotation_euler = (0, 0, 0)

    # Preview upright staff in right curled fist (in Blender: staff points along -Y initially -> rotate +90 deg X so tip is +Z up!)
    staff.parent = None
    staff.location = J['handR'] + Vector((-0.010, -0.015, -0.025))
    staff.rotation_euler = Euler((math.radians(-85.0), 0.0, 0.0), 'XYZ')

    # Preview floating Fire Orb beside left shoulder, clear of wide hat brim
    orb.parent = None
    orb.location = J['pelvis'] + Vector((0.48, 0.20, 0.42))
    orb.rotation_euler = (0, 0, 0)

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
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
        ('full', Vector((0, 0, 0.96)), 2.25, [('front', (0, -6, 0)), ('back', (0, 6, 0)), ('side', (6, 0, 0))]),
        ('handR', J['handR'], 0.55, [('staff', (0, -3, 0.3))]),
        ('head', Vector((0, -0.05, 1.52)), 0.96, [('front', (0, -3, 0)), ('side', (3, 0, 0))]),
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


if __name__ == '__main__':
    if '--gear-only' in argv:
        clear_scene()
        bpy.ops.import_scene.gltf(filepath=OUT_HERO)
        rig = bpy.data.objects['HeroRig']
        b = rig.data.bones
        J = {
            'neck': b['head'].head_local.copy(),
            'pelvis': b['hips'].head_local.copy(),
            'handR': b['handR'].head_local.copy(),
            'handL': b['handL'].head_local.copy(),
            'headCenter': Vector((0.0, -0.05, 1.44)),
        }
        build_mage_gear(J)
        render_qc(J)
    else:
        J = build_hero_mage()
        build_mage_gear(J)
        render_qc(J)
