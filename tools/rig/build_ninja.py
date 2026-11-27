# Build the Tree-of-Savior painterly skinned Shadow Ninja hero and modular gear.
# Usage:
#   "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup --python tools/rig/build_ninja.py -- <scratch_dir>
import math
import os
import sys
import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SCRATCH = argv[0] if argv else os.path.join(os.path.expanduser('~'), 'ninja_build')
os.makedirs(SCRATCH, exist_ok=True)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC_DIR = os.environ.get('NINJA_SOURCE_DIR', r'C:\Users\phcar\figther-ai\art\blender\source\ninja')
OUT_HERO = os.path.join(REPO_ROOT, 'public', 'assets', 'models', 'hero-ninja.glb')
OUT_GEAR = os.path.join(REPO_ROOT, 'public', 'assets', 'models', 'ninja-gear.glb')

TARGET_HEIGHT = 1.76
BODY_TRIS = 12500
BLADE_TRIS = 1800
HEADBAND_TRIS = 2200
SCARF_TEX_SIZE = 256


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
    bg.inputs['Strength'].default_value = 1.32
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.66, 0.61, 0.75, 1.0)  # soft mauve-indigo bounce
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (1.0, 0.98, 0.94, 1.0)   # warm storybook ivory sky
    map_range = nt.nodes.new('ShaderNodeMapRange')
    map_range.inputs['From Min'].default_value = -1.0
    map_range.inputs['From Max'].default_value = 1.0
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], map_range.inputs['Value'])
    nt.links.new(map_range.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

    # Symmetric 4-corner soft overhead fill lights (no cast shadows) for even 360 painterly highlights
    for idx, (lx, ly, lz) in enumerate([(-2.5, -2.5, 3.2), (2.5, -2.5, 3.2), (-2.5, 2.5, 3.0), (2.5, 2.5, 3.0)]):
        ldata = bpy.data.lights.new(f'Fill{idx}', 'AREA')
        ldata.energy = 140.0
        ldata.size = 3.0
        ldata.color = (1.0, 0.97, 0.93) if ly < 0 else (0.93, 0.94, 1.0)
        ldata.use_shadow = False
        lobj = bpy.data.objects.new(f'Fill{idx}', ldata)
        lobj.location = (lx, ly, lz)
        lobj.rotation_euler = (-Vector((lx, ly, lz))).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(lobj)


def bake_painterly_albedo(obj, tex_name, size=1024, double_sided=False):
    scene = bpy.context.scene
    # Downscale giant 4K source textures first so Cycles bake stays fast
    for im in bpy.data.images:
        if im.size[0] > 1024:
            im.scale(1024, 1024)

    img = bpy.data.images.new(tex_name, width=size, height=size, alpha=False)
    img.colorspace_settings.name = 'sRGB'

    # Ensure source materials are active and attach an unlinked Image Texture node for bake target
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
        # Slightly boost base color / clamp metallic so iron/silver plates stay bright ToS painted tones
        for n in nt.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                met_in = n.inputs.get('Metallic')
                if met_in and not met_in.is_linked and met_in.default_value > 0.35:
                    met_in.default_value = 0.28
                elif met_in and met_in.is_linked:
                    met_in.default_value = 0.25
                    for l in list(met_in.links):
                        nt.links.remove(l)

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='COMBINED')
    img.pack()

    # Replace material with single clean unlit/principled albedo-only material for Three.js MakeToSMaterial
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


def curl_fists(body):
    # Curl open A-pose hands into compact, anatomical clenched shinobi fists (zero protruding fingers).
    for sgn in (1, -1):
        knuckle_x = 0.550 * sgn
        palm_vs = [v.co for v in body.data.vertices
                   if 0.51 <= v.co.x * sgn <= 0.575 and -0.18 <= v.co.y <= -0.02 and 0.82 <= v.co.z <= 0.94]
        if not palm_vs:
            continue
        cy = sum(p.y for p in palm_vs) / len(palm_vs)
        cz = sum(p.z for p in palm_vs) / len(palm_vs) - 0.022
        grip = Vector((knuckle_x, cy - 0.015, cz))

        curled = 0
        for v in body.data.vertices:
            ax = v.co.x * sgn
            if ax <= 0.525 or v.co.z < 0.72 or v.co.z > 1.00:
                continue
            t = max(0.0, min(1.0, (ax - 0.525) / 0.145))
            # Fingers curl around an axis running along forearm/wrist -> palm (bending inward & down under palm)
            is_thumb = (v.co.y < cy - 0.045 and v.co.z < cz + 0.02 and ax < 0.60)
            if is_thumb:
                # Fold thumb neatly inward across palm front
                blend = min(1.0, (ax - 0.525) / 0.05)
                tx = (0.555 - (ax - 0.525) * 0.25) * sgn
                ty = cy - 0.042
                tz = cz - 0.012
                v.co.x = v.co.x * (1.0 - blend) + tx * blend
                v.co.y = v.co.y * (1.0 - blend) + ty * blend
                v.co.z = v.co.z * (1.0 - blend) + tz * blend
            else:
                # Wrap fingers around Y axis (palm center (knuckle_x, cy, cz)) so tips tuck under into palm
                theta = t * math.pi * 1.18
                rad = max(0.018, 0.036 - 0.014 * t)
                local_x = knuckle_x + (math.sin(theta) * rad + 0.018) * sgn
                local_z = cz + math.cos(theta) * rad * 0.85 - 0.010 * t
                local_y = cy + (v.co.y - cy) * (1.0 - 0.35 * t)
                blend = min(1.0, (ax - 0.525) / 0.030)
                v.co.x = v.co.x * (1.0 - blend) + local_x * blend
                v.co.y = v.co.y * (1.0 - blend) + local_y * blend
                v.co.z = v.co.z * (1.0 - blend) + local_z * blend
            curled += 1
        print(f'CURLED fist side={sgn}: {curled} verts, gripCenter=({grip.x:+.3f}, {grip.y:+.3f}, {grip.z:+.3f})')


def make_scarf_texture():
    img = bpy.data.images.new('tos_ninja_scarf_tex', width=SCARF_TEX_SIZE, height=SCARF_TEX_SIZE, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    # Vertical gradient in V: dark slate-indigo at neck (v=1) -> rich shinobi violet cloth -> warm lavender-gold woven border near tip (v=0..0.12)
    px = np.zeros((SCARF_TEX_SIZE, SCARF_TEX_SIZE, 4), dtype=np.float32)
    u = np.linspace(0.0, 1.0, SCARF_TEX_SIZE, dtype=np.float32)[None, :]
    v = np.linspace(0.0, 1.0, SCARF_TEX_SIZE, dtype=np.float32)[:, None]

    base_r = 0.24 + 0.10 * np.sin(v * math.pi)
    base_g = 0.19 + 0.06 * np.sin(v * math.pi)
    base_b = 0.42 + 0.14 * np.sin(v * math.pi)

    # Edge trim along u edges & bottom tip
    edge_u = np.exp(-((np.minimum(u, 1.0 - u)) / 0.07) ** 2)
    tip_band = np.exp(-(((v - 0.10) / 0.032) ** 2)) + 0.5 * np.exp(-(((v - 0.17) / 0.015) ** 2))
    gold = np.clip(tip_band + edge_u * 0.45, 0.0, 1.0)
    r = base_r * (1.0 - gold) + 0.56 * gold
    g = base_g * (1.0 - gold) + 0.45 * gold
    b = base_b * (1.0 - gold) + 0.68 * gold

    # Subtle fabric weave shading (painted strokes)
    weave = 1.0 + 0.04 * np.sin(u * 48.0) * np.cos(v * 64.0)
    px[:, :, 0] = np.clip(r * weave, 0.0, 1.0)
    px[:, :, 1] = np.clip(g * weave, 0.0, 1.0)
    px[:, :, 2] = np.clip(b * weave, 0.0, 1.0)
    px[:, :, 3] = 1.0
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img


def build_ninja_scarf(collar_pos):
    # Two overlapping fluttering shinobi scarf ribbons descending smoothly behind the back scabbard
    mesh = bpy.data.meshes.new('NinjaScarf')
    obj = bpy.data.objects.new('NinjaScarf', mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')

    # Collar knot + two streaming tails (one slightly longer & wider, angled clear of body & scabbard)
    rows = 12
    cols = 4
    tails = [
        # (x_off, width_top, width_bot, sway_x, back_curve, z_end)
        (0.035, 0.11, 0.16, 0.10, 0.13, 0.36),
        (-0.045, 0.09, 0.13, -0.09, 0.11, 0.44),
    ]
    y_top = collar_pos.y + 0.125  # safely behind torso/scabbard (scabbard is ~0.07..0.11)
    z_top = collar_pos.z - 0.03   # ~1.19
    for t_idx, (x0, w0, w1, sway_x, back_y, z_end) in enumerate(tails):
        grid = []
        for ri in range(rows + 1):
            t = ri / rows  # 0 at top -> 1 at tip
            z = z_top + (z_end - z_top) * t
            # S-curve flow behind back
            cx = x0 + sway_x * (t ** 1.15) + 0.015 * math.sin(t * math.pi * 2.0 + t_idx)
            cy = y_top + back_y * math.sin(t * math.pi * 0.58) + (0.012 if t_idx == 0 else 0.024)
            w = w0 + (w1 - w0) * (t ** 0.85)
            # Swallow-tail notch at bottom
            row_verts = []
            for ci in range(cols + 1):
                u = ci / cols
                sx = (u - 0.5) * w
                notch = 0.035 * (1.0 - abs(u * 2.0 - 1.0)) * (t ** 3)
                bend_y = 0.012 * math.cos((u - 0.5) * math.pi)
                vx = cx + sx
                vy = cy + bend_y
                vz = z + notch
                v = bm.verts.new((vx, vy, vz))
                row_verts.append((v, u, 1.0 - t))
            grid.append(row_verts)
        for ri in range(rows):
            for ci in range(cols):
                v00, u00, w00 = grid[ri][ci]
                v10, u10, w10 = grid[ri][ci + 1]
                v11, u11, w11 = grid[ri + 1][ci + 1]
                v01, u01, w01 = grid[ri + 1][ci]
                f = bm.faces.new((v00, v10, v11, v01))
                f.smooth = True
                for l, (uv_u, uv_v) in zip(f.loops, [(u00, w00), (u10, w10), (u11, w11), (u01, w01)]):
                    l[uv_layer].uv = (uv_u, uv_v)

    bm.to_mesh(mesh)
    bm.free()

    img = make_scarf_texture()
    mat = bpy.data.materials.new('tos_ninja_scarf_ToS')
    mat.use_nodes = True
    mat.use_backface_culling = False
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.9
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    mesh.materials.append(mat)
    print(f'CREATED NinjaScarf ({len(mesh.polygons)} polys)')
    return obj


def build_hero_ninja():
    clear_scene()
    setup_painterly_world()
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, 'body.glb'))
    body = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    body.name = 'Body'
    tris = weld_and_decimate(body, BODY_TRIS)

    # Normalize: feet on z = 0, centered on X/Y, height = 1.76 m (faces -Y, left = +X)
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    k = TARGET_HEIGHT / (mx.z - mn.z)
    off = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    body.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation(-off))
    body.data.update()
    print(f'BODY cleaned tris={tris} scale={k:.4f}')

    curl_fists(body)
    bake_painterly_albedo(body, 'tos_ninja_body_tex', size=1024, double_sided=False)

    # Measure symmetric joints directly from the normalized mesh
    verts = [body.matrix_world @ v.co for v in body.data.vertices]

    def mid_x_sym(zlo, zhi, xlo, xhi, ylo=-0.35, yhi=0.35, fb=None):
        lpts = [v for v in verts if zlo <= v.z <= zhi and xlo <= v.x <= xhi and ylo <= v.y <= yhi]
        rpts = [v for v in verts if zlo <= v.z <= zhi and -xhi <= v.x <= -xlo and ylo <= v.y <= yhi]
        pts = lpts + [Vector((-v.x, v.y, v.z)) for v in rpts]
        if not pts:
            return Vector(fb)
        xs = [p.x for p in pts]
        ys = [p.y for p in pts]
        return Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (zlo + zhi) / 2))

    def arm_x_sym(xlo, xhi, zlo=0.72, zhi=1.22, ylo=-0.28, yhi=0.10, fb=None):
        lpts = [v for v in verts if xlo <= v.x <= xhi and zlo <= v.z <= zhi and ylo <= v.y <= yhi]
        rpts = [v for v in verts if -xhi <= v.x <= -xlo and zlo <= v.z <= zhi and ylo <= v.y <= yhi]
        pts = lpts + [Vector((-v.x, v.y, v.z)) for v in rpts]
        if not pts:
            return Vector(fb)
        ys = [p.y for p in pts]
        zs = [p.z for p in pts]
        return Vector(((xlo + xhi) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))

    J = {}
    for s, sgn in (('L', 1), ('R', -1)):
        hip = mid_x_sym(0.70, 0.78, 0.05, 0.22, -0.18, 0.08, (0.13, -0.05, 0.74))
        knee = mid_x_sym(0.39, 0.45, 0.14, 0.34, -0.18, 0.08, (0.23, -0.06, 0.42))
        ankle = mid_x_sym(0.09, 0.13, 0.24, 0.40, -0.16, 0.06, (0.31, -0.06, 0.11))
        # Exact sole Z extents for grounded ankle
        foot_pts = [v for v in verts if v.z <= 0.04 and v.x * sgn > 0.18]
        heel_y = max((v.y for v in foot_pts), default=0.02)
        toe_y = min((v.y for v in foot_pts), default=-0.25)

        shoulder = arm_x_sym(0.18, 0.23, 1.00, 1.15, -0.18, 0.05, (0.20, -0.06, 1.07))
        elbow = arm_x_sym(0.34, 0.39, 0.94, 1.08, -0.18, 0.05, (0.365, -0.06, 1.01))
        wrist = arm_x_sym(0.48, 0.515, 0.85, 0.98, -0.22, 0.02, (0.495, -0.10, 0.90))
        hand = arm_x_sym(0.54, 0.585, 0.80, 0.95, -0.22, 0.02, (0.56, -0.11, 0.86))

        J['hip' + s] = Vector((hip.x * sgn, hip.y, hip.z))
        J['knee' + s] = Vector((knee.x * sgn, knee.y, knee.z))
        J['ankle' + s] = Vector((ankle.x * sgn, ankle.y, ankle.z))
        J['toe' + s] = Vector((ankle.x * sgn, toe_y, 0.03))
        J['heel' + s] = Vector((ankle.x * sgn, heel_y, 0.03))
        J['shoulder' + s] = Vector((shoulder.x * sgn, shoulder.y, shoulder.z))
        J['elbow' + s] = Vector((elbow.x * sgn, elbow.y, elbow.z))
        J['wrist' + s] = Vector((wrist.x * sgn, wrist.y, wrist.z))
        J['hand' + s] = Vector((hand.x * sgn, hand.y, hand.z))

    neck_pts = [v for v in verts if 1.20 <= v.z <= 1.26 and -0.10 <= v.x <= 0.10 and -0.18 <= v.y <= 0.05]
    neck_y = sum(v.y for v in neck_pts) / len(neck_pts) if neck_pts else -0.07
    pelvis_y = (J['hipL'].y + J['hipR'].y) / 2
    pelvis_z = 0.76
    J['pelvis'] = Vector((0.0, pelvis_y, pelvis_z))
    J['neck'] = Vector((0.0, neck_y, 1.23))
    J['headTop'] = Vector((0.0, neck_y, 1.70))

    # Scarf mesh behind upper back
    scarf = build_ninja_scarf(Vector((0.0, neck_y, 1.22)))
    y_scarf = neck_y + 0.125
    J['cape1'] = Vector((0.0, y_scarf, 1.19))
    J['cape2'] = Vector((0.0, y_scarf + 0.06, 0.92))
    J['cape3'] = Vector((0.0, y_scarf + 0.11, 0.65))
    J['capeTip'] = Vector((0.0, y_scarf + 0.13, 0.36))

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
    bone('cape1', J['cape1'], J['cape2'], 'torso')
    bone('cape2', J['cape2'], J['cape3'], 'cape1', True)
    bone('cape3', J['cape3'], J['capeTip'], 'cape2', True)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Bind Body with automatic heat weights
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # Clean up Body weights: ensure 0 unweighted vertices, rigid sandals, rigid head, rigid back scabbard
    for b in arm_data.bones:
        if b.name not in body.vertex_groups:
            body.vertex_groups.new(name=b.name)
    vg = {g.name: g for g in body.vertex_groups}
    all_bone_names = list(vg.keys())

    def set_rigid(v_idx, bone_name):
        for g in body.vertex_groups:
            g.remove([v_idx])
        vg[bone_name].add([v_idx], 1.0, 'REPLACE')

    unweighted_fixed = 0
    for v in body.data.vertices:
        p = v.co
        # 1. Sandals/feet strictly rigid on footL/footR so sole leveling is crystal clean
        if p.z <= 0.085 and abs(p.x) > 0.10:
            set_rigid(v.index, 'footL' if p.x >= 0 else 'footR')
            continue
        # 2. Head, mask, ears, spiky hair strictly rigid on head (excluding diagonal katana hilt on back R shoulder!)
        is_hilt = (p.x < -0.17 and p.y > 0.02 and p.y < 0.15 and 1.15 <= p.z <= 1.44 and (-p.x - 0.16) * 0.8 + (p.z - 1.15) * 0.4 > 0.05)
        is_scabbard_back = (p.y > 0.055 and 0.63 <= p.z <= 1.21 and abs(p.x) < 0.25)
        if is_hilt or is_scabbard_back:
            set_rigid(v.index, 'torso')
            continue
        if p.z >= 1.245:
            set_rigid(v.index, 'head')
            continue
        # 3. Fix any zero-weight vertices by nearest bone head
        total_w = sum(g.weight for g in v.groups)
        if total_w < 1e-4:
            best_b = min(
                [b for b in arm_data.bones if not b.name.startswith('cape')],
                key=lambda b: ((b.head_local + b.tail_local) * 0.5 - p).length_squared
            )
            set_rigid(v.index, best_b.name)
            unweighted_fixed += 1
        elif p.y < -0.09 and abs(p.x) < 0.115 and 0.34 <= p.z <= 0.72:
            # Front hanging center loincloth flap: keep strongly anchored to hips so wide strides never tear it
            w_hips = 0.0
            for ge in v.groups:
                if body.vertex_groups[ge.group].name == 'hips':
                    w_hips = ge.weight
            new_hips = max(w_hips, 0.65)
            vg['hips'].add([v.index], new_hips, 'REPLACE')
    print('BODY weights cleaned, unweighted_fixed=', unweighted_fixed)

    # Bind NinjaScarf monotonically along torso -> cape1 -> cape2 -> cape3
    scarf.parent = rig
    mod = scarf.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    for bname in ('torso', 'cape1', 'cape2', 'cape3'):
        scarf.vertex_groups.new(name=bname)
    z0, z1, z2, z3 = 1.21, 0.94, 0.68, 0.38
    for v in scarf.data.vertices:
        z = v.co.z
        if z >= 1.16:
            scarf.vertex_groups['torso'].add([v.index], 1.0, 'REPLACE')
        elif z >= z1:
            t = max(0.0, min(1.0, (1.16 - z) / (1.16 - z1)))
            scarf.vertex_groups['torso'].add([v.index], 1.0 - t, 'REPLACE')
            scarf.vertex_groups['cape1'].add([v.index], t, 'REPLACE')
        elif z >= z2:
            t = max(0.0, min(1.0, (z1 - z) / (z1 - z2)))
            scarf.vertex_groups['cape1'].add([v.index], 1.0 - t, 'REPLACE')
            scarf.vertex_groups['cape2'].add([v.index], t, 'REPLACE')
        else:
            t = max(0.0, min(1.0, (z2 - z) / max(0.05, z2 - z3)))
            scarf.vertex_groups['cape2'].add([v.index], 1.0 - t, 'REPLACE')
            scarf.vertex_groups['cape3'].add([v.index], t, 'REPLACE')

    # Print calibrated JS constants (convert Blender -> Three.js glTF Y-up: threeX=X, threeY=Z, threeZ=-Y)
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
    # Rest sagittal angle backwards from vertical (-Y in Three.js)
    thigh_rest = math.atan2(-thigh_v[2], -thigh_v[1])
    shin_rest = math.atan2(-shin_v[2], -shin_v[1])
    sole_heel_z = -(J['heelL'].y - ankle_l.y)
    sole_toe_z = -(J['toeL'].y - ankle_l.y)
    cape_tip_local = Vector(bl_to_three(J['capeTip'])) - Vector(bl_to_three(J['cape3']))
    cape_tip_rig = cape_tip_local / s

    print('=== NINJA RIG METRICS ===')
    print(f'hipHeight: {hip_h:.4f} (s={s:.4f})')
    print(f'restFootY: {ankle_l.z:.4f}')
    print(f'soleZ: [{sole_heel_z:.4f}, {sole_toe_z:.4f}]')
    print(f'LEG_RIG: THIGH={thigh_len:.4f}, SHIN={shin_len:.4f}, THIGH_REST={thigh_rest:.4f}, SHIN_REST={shin_rest:.4f}, ANKLE={ankle_l.z/s:.4f}, PIVOT={(J["pelvis"].z - hip_l.z)/s:.4f}')
    print(f'capeTip (in cape3 local rig units): [{cape_tip_rig.x:.4f}, {cape_tip_rig.y:.4f}, {cape_tip_rig.z:.4f}]')
    print('handR world:', J['handR'], 'handL world:', J['handL'])
    print('neck world:', J['neck'], 'headCenter Approx: (0, -0.09, 1.46)')

    # Set mesh datablock names cleanly too
    body.data.name = 'Body'
    scarf.data.name = 'NinjaScarf'
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    body.select_set(True)
    scarf.select_set(True)
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


def build_ninja_gear(J):
    clear_scene()
    setup_painterly_world()

    # --- 1. NinjaBlade from blade.glb ---
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, 'blade.glb'))
    blade = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    blade.name = 'NinjaBlade'
    weld_and_decimate(blade, BLADE_TRIS)

    # Rotate so pommel is at +Y, blade tip at -Y (Three.js +Z), edge/guard flare along Z (Three.js Y).
    # Raw blade.glb runs from x=-0.449 (pommel) to x=+0.709 (tip) with ~11 deg nose-up tilt in XZ.
    co = np.empty(len(blade.data.vertices) * 3, dtype=np.float32)
    blade.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    p_lo = co[co[:, 0] < -0.20].mean(axis=0)
    p_hi = co[co[:, 0] > 0.35].mean(axis=0)
    slope = math.atan2(float(p_hi[2] - p_lo[2]), float(p_hi[0] - p_lo[0]))
    # Step 1: level horizontal in XZ by rotating +slope around Y
    # Step 2: rotate -90 deg around Z so +X tip maps to -Y (= Three.js +Z) and -X pommel maps to +Y (= Three.js -Z)
    rot_m = Euler((0.0, 0.0, -math.pi * 0.5), 'XYZ').to_matrix().to_4x4() @ Euler((0.0, slope, 0.0), 'XYZ').to_matrix().to_4x4()
    blade.data.transform(rot_m)

    # Re-read bounds, center handle around x=0, z=0, guard around y=-0.04, scale total length to 0.60 m
    co = np.empty(len(blade.data.vertices) * 3, dtype=np.float32)
    blade.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    # Guard/crossguard is widest Z span around y ~ -0.02..+0.02
    length = float(co[:, 1].max() - co[:, 1].min())
    scale_b = 0.60 / length
    # Center of grip lies ~26% from pommel (+Y max) toward tip (-Y min)
    grip_y = float(co[:, 1].max()) - 0.24 * length
    ctr_x = float((co[:, 0].min() + co[:, 0].max()) * 0.5)
    # Handle Z center from the pommel/grip region
    grip_mask = co[:, 1] > (co[:, 1].max() - 0.34 * length)
    ctr_z = float(co[grip_mask, 2].mean())
    blade.data.transform(Matrix.Scale(scale_b, 4) @ Matrix.Translation(Vector((-ctr_x, -grip_y, -ctr_z))))
    blade.data.update()

    b_co = np.empty(len(blade.data.vertices) * 3, dtype=np.float32)
    blade.data.vertices.foreach_get('co', b_co)
    b_co = b_co.reshape(-1, 3)
    print(f'BLADE normalized three.js bounds: X=[{b_co[:,0].min():.3f},{b_co[:,0].max():.3f}] Y=[{b_co[:,2].min():.3f},{b_co[:,2].max():.3f}] Z=[{-b_co[:,1].max():.3f},{-b_co[:,1].min():.3f}]')
    bake_painterly_albedo(blade, 'tos_ninja_blade_tex', size=512, double_sided=False)

    # Detach materials cleanly before importing headband so bake nodes don't collide
    blade_mat = blade.data.materials[0]

    # --- 2. NinjaHeadband from headband.glb ---
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC_DIR, 'headband.glb'))
    hb = [o for o in bpy.data.objects if o.type == 'MESH' and o is not blade][0]
    hb.name = 'NinjaHeadband'
    weld_and_decimate(hb, 60000)

    img = [im for im in bpy.data.images if im not in (blade_mat.node_tree.nodes['Image Texture'].image,)
           and 'normal' not in im.name.lower() and 'rough' not in im.name.lower()
           and 'metal' not in im.name.lower() and im.size[0] > 0][0]
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[:, :, :3]

    bm = bmesh.new()
    bm.from_mesh(hb.data)
    uv_lay = bm.loops.layers.uv.active
    to_del = []
    for f in bm.faces:
        cs = [l[uv_lay].uv for l in f.loops]
        u = sum(c.x for c in cs) / len(cs)
        v = sum(c.y for c in cs) / len(cs)
        ix = int((u % 1.0) * w) % w
        iy = int((v % 1.0) * h) % h
        r, g, b = px[iy, ix]
        luma = 0.299 * r + 0.587 * g + 0.114 * b
        mx, mn = max(r, g, b), min(r, g, b)
        sat = (mx - mn) / mx if mx > 1e-4 else 0.0
        c = f.calc_center_median()

        # Protect the entire front metal forehead plate (measured Y-Z step: z=0.580..0.702)
        is_front_plate = (0.580 <= c.z <= 0.702 and abs(c.x) <= 0.138 and c.y <= -0.240)
        # Drop mannequin regions strictly:
        # 1) Mannequin chest/shoulders/lower-stand below ribbon tips or near center neck below z=0.558
        if c.z < 0.14 or (c.z < 0.26 and abs(c.x) < 0.28):
            to_del.append(f); continue
        if c.z < 0.560 and (c.y < 0.04 or abs(c.x) < 0.175):
            to_del.append(f); continue
        # 2) Unconditional tilted top-plane and front-bottom-plane cut (keeps full plate + blue band rim)
        if not is_front_plate and c.z > 0.710 - 0.14 * (c.y + 0.25):
            to_del.append(f); continue
        if c.y < 0.05 and c.z < 0.574 - 0.10 * (c.y + 0.25):
            to_del.append(f); continue
        # 3) Inner mannequin cranium core
        if not is_front_plate and c.z >= 0.555 and math.hypot(c.x, c.y + 0.02) < 0.192:
            to_del.append(f); continue
        # 4) Neutral white/pale-grey mannequin faces anywhere outside plate & blue cloth
        is_white = (luma > 0.46 and sat < 0.14) or (luma > 0.30 and sat < 0.09 and c.z > 0.45)
        if is_white and not is_front_plate and not (b > r + 0.025):
            to_del.append(f); continue

    bmesh.ops.delete(bm, geom=to_del, context='FACES')

    bm.faces.ensure_lookup_table()
    seen = set()
    islands = []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack = [f]
        seen.add(f.index)
        comp = [f]
        while stack:
            cur = stack.pop()
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf.index not in seen:
                        seen.add(nf.index)
                        stack.append(nf)
                        comp.append(nf)
        islands.append(comp)
    islands.sort(key=len, reverse=True)
    # Keep major islands (band ring + ribbon tails >= 120 faces)
    small = [f for comp in islands if len(comp) < 120 for f in comp]
    if small:
        bmesh.ops.delete(bm, geom=small, context='FACES')
    bm.to_mesh(hb.data)
    bm.free()

    # Remove any isolated edges/verts
    bm = bmesh.new()
    bm.from_mesh(hb.data)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(hb.data)
    bm.free()

    # Decimate headband cleanly (2600 tris preserves leaf swirl crest detail)
    hb.data.calc_loop_triangles()
    cur_t = len(hb.data.loop_triangles)
    if cur_t > 2600:
        mod = hb.modifiers.new('Dec2', 'DECIMATE')
        mod.ratio = 2600 / cur_t
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in hb.data.polygons:
        p.use_smooth = True

    # Align headband onto Ninja Body head (origin at head bone neck(0, -0.054, 1.23))
    # Measure ONLY the headband ring (z >= 0.57) radius so ribbons do not skew scaling!
    h_co = np.empty(len(hb.data.vertices) * 3, dtype=np.float32)
    hb.data.vertices.foreach_get('co', h_co)
    h_co = h_co.reshape(-1, 3)
    ring = h_co[h_co[:, 2] >= 0.57]
    hb_cx = float((ring[:, 0].min() + ring[:, 0].max()) * 0.5)
    hb_cy = float((ring[:, 1].min() + ring[:, 1].max()) * 0.5)
    hb_cz = float((ring[:, 2].min() + ring[:, 2].max()) * 0.5)
    hb_rx = float(ring[:, 0].max() - ring[:, 0].min()) * 0.5
    hb_ry = float(ring[:, 1].max() - ring[:, 1].min()) * 0.5
    # Fit cleanly outside Body's sculpted band so zero Z-fighting
    sx = 0.252 / max(0.1, hb_rx)
    sy = 0.258 / max(0.1, hb_ry)
    sz = max(0.68, min(0.95, 0.115 / max(0.05, float(ring[:, 2].max() - ring[:, 2].min()))))
    M_hb = (
        Matrix.Translation(Vector((0.0, -0.026, 0.250)))
        @ Matrix.Diagonal((sx, sy, sz, 1.0))
        @ Matrix.Translation(Vector((-hb_cx, -hb_cy, -hb_cz)))
    )
    hb.data.transform(M_hb)
    hb.data.update()
    blade.data.name = 'NinjaBlade'
    hb.data.name = 'NinjaHeadband'
    print(f'HEADBAND final tris={len(hb.data.loop_triangles)}, scale=({sx:.3f}, {sy:.3f}, {sz:.3f})')

    bake_painterly_albedo(hb, 'tos_ninja_headband_tex', size=512, double_sided=True)

    # Export NinjaBlade + NinjaHeadband to ninja-gear.glb
    bpy.ops.object.select_all(action='DESELECT')
    blade.select_set(True)
    hb.select_set(True)
    bpy.context.view_layer.objects.active = blade
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
    # Assemble hero-ninja.glb + ninja-gear.glb in Blender to visually verify placement & renders
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=OUT_HERO)
    bpy.ops.import_scene.gltf(filepath=OUT_GEAR)

    rig = bpy.data.objects['HeroRig']
    hb = bpy.data.objects['NinjaHeadband']
    blade_r = bpy.data.objects['NinjaBlade']
    blade_l = blade_r.copy()
    blade_l.data = blade_r.data.copy()
    blade_l.name = 'NinjaBladeL'
    bpy.context.scene.collection.objects.link(blade_l)

    # Parent headband to head bone at exact bone-local origin
    hb.parent = rig
    hb.parent_type = 'BONE'
    hb.parent_bone = 'head'
    # In Blender pose space bone origin is bone head, and bone_relative=True puts object origin at bone head!
    # We'll place objects directly at world positions matching chibi.js (bone head + unscaled offset) for visual QC:
    hb.parent = None
    hb.location = J['neck']
    hb.rotation_euler = (0, 0, 0)

    # Preview dual blades gripped in curled fists (handle aligned perpendicular to arm, edge forward-down)
    # In HeroRig, rest arm runs along +X (armL) or -X (armR) slightly tilted down (-Z).
    # chibi.js mount maps NinjaBlade (+Z Blender UP -> +Y Three, -Y Blender -> +Z Three) cleanly into hand.
    blade_r.parent = None
    blade_r.location = J['handR'] + Vector((-0.01, -0.025, -0.020))
    blade_r.rotation_euler = Euler((math.radians(15), 0.0, math.radians(-18)), 'XYZ')
    blade_l.parent = None
    blade_l.location = J['handL'] + Vector((0.01, -0.025, -0.020))
    blade_l.rotation_euler = Euler((math.radians(15), 0.0, math.radians(18)), 'XYZ')

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
        ('full', Vector((0, 0, 0.90)), 2.05, [('front', (0, -6, 0)), ('back', (0, 6, 0)), ('side', (6, 0, 0))]),
        ('handR', J['handR'], 0.45, [('close', (0, -3, 0.3))]),
        ('head', Vector((0, -0.05, 1.45)), 0.72, [('front', (0, -3, 0)), ('side', (3, 0, 0)), ('back', (0, 3, 0))]),
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
    # Render headband alone without Body to verify zero mannequin residue
    for obj_hide in bpy.data.objects:
        if obj_hide.type == 'MESH' and obj_hide is not hb:
            obj_hide.hide_render = True
    cam.data.ortho_scale = 0.72
    ctr = Vector((0, -0.05, 1.45))
    for vname, off in [('front', (0, -3, 0)), ('back', (0, 3, 0))]:
        pos = ctr + Vector(off)
        cam.location = pos
        cam.rotation_euler = (ctr - pos).to_track_quat('-Z', 'Y').to_euler()
        outp = os.path.join(SCRATCH, f'qc_hbonly_{vname}.png')
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
            'handR': b['handR'].head_local.copy(),
            'handL': b['handL'].head_local.copy(),
        }
        build_ninja_gear(J)
        render_qc(J)
    else:
        J = build_hero_ninja()
        build_ninja_gear(J)
        render_qc(J)
