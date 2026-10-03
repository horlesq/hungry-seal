# Shared helpers for the Blender sprite scripts (seal.py, creatures.py): toon materials,
# blob bodies, fins, eyes, vertex posing, and packing rendered frames into a sprite sheet.
#
# Conventions: characters face +X, Z is up, the orthographic camera looks along +Y, so the
# near (visible) side is -Y. 1 Blender unit = DU_PER_BU game design units, the same for every
# sprite so outlines come out equally thick in game.
import math
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector

DU_PER_BU = 28.0  # game design units per Blender unit
PX_PER_DU = 3  # render density (manifest resolution: 3)
OUTLINE = 0.075  # outline shell thickness (BU)
INK = (0.04, 0.07, 0.10)


def srgb(c):
    """Palette values are sRGB; Blender colors are linear."""
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c[:3]) + (1.0,)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.metaballs, bpy.data.curves, bpy.data.materials,
                 bpy.data.cameras, bpy.data.lights, bpy.data.textures):
        for block in list(coll):
            coll.remove(block)
    _OUTLINE_MATS.clear()
    _EYE_MATS.clear()


# ---------------------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------------------

def _math(nt, op, a=None, b=None):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def _mix(nt, fac, a, b):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    if isinstance(fac, (int, float)):
        m.inputs["Factor"].default_value = fac
    else:
        nt.links.new(fac, m.inputs["Factor"])
    for sock, v in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, tuple):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs[2]


def toon_material(name, color, belly=None, split=0.0, soft=0.03, tilt=0.0, spots=None,
                  shine=False, glow=None):
    """Soft two-tone toon shading on a flat color.

    belly: lower color below the line z = split - tilt * x (object space), blended over `soft`.
    spots: dict(color, scale, size, min_z, max_x) -> Voronoi dots, optionally above min_z and
           behind max_x.
    shine: adds a bright highlight band (metallic/golden look).
    glow:  extra emission color added on top (bioluminescence)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs[0], out.inputs[0])

    diffuse = nt.nodes.new("ShaderNodeBsdfDiffuse")
    to_rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    nt.links.new(diffuse.outputs[0], to_rgb.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (0.62, 0.62, 0.66, 1)
    ramp.color_ramp.elements[1].position = 0.32
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    if shine:
        ramp.color_ramp.elements.new(0.62).color = (1, 1, 1, 1)
        hi = ramp.color_ramp.elements.new(0.72)
        hi.color = (1.6, 1.5, 1.25, 1)
    nt.links.new(to_rgb.outputs[0], ramp.inputs[0])

    coords = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coords.outputs["Object"], sep.inputs[0])
    base = srgb(color)
    if belly:
        # Signed height above the belly line.
        line = _math(nt, "SUBTRACT", sep.outputs["Z"], _math(nt, "MULTIPLY", sep.outputs["X"], -tilt))
        h = _math(nt, "SUBTRACT", line, split)
        fac = _math(nt, "MULTIPLY", _math(nt, "ADD", _math(nt, "DIVIDE", h, 2 * soft), 0.5), 1.0)
        clamp = nt.nodes.new("ShaderNodeClamp")
        nt.links.new(fac, clamp.inputs[0])
        base = _mix(nt, clamp.outputs[0], srgb(belly), srgb(color))
    if spots:
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = spots.get("scale", 2.6)
        vor.feature = "F1"
        nt.links.new(coords.outputs["Object"], vor.inputs["Vector"])
        mask = _math(nt, "LESS_THAN", vor.outputs["Distance"], spots.get("size", 0.22))
        if "min_z" in spots:
            mask = _math(nt, "MULTIPLY", mask, _math(nt, "GREATER_THAN", sep.outputs["Z"], spots["min_z"]))
        if "max_x" in spots:
            mask = _math(nt, "MULTIPLY", mask, _math(nt, "LESS_THAN", sep.outputs["X"], spots["max_x"]))
        if not isinstance(base, tuple):
            base = _mix(nt, mask, base, srgb(spots["color"]))
        else:
            base = _mix(nt, mask, base, srgb(spots["color"]))
    if isinstance(base, tuple):
        rgb = nt.nodes.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = base
        base = rgb.outputs[0]

    shade = nt.nodes.new("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.blend_type = "MULTIPLY"
    shade.inputs["Factor"].default_value = 1.0
    nt.links.new(base, shade.inputs[6])
    nt.links.new(ramp.outputs[0], shade.inputs[7])
    col = shade.outputs[2]
    if glow:
        add = nt.nodes.new("ShaderNodeMix")
        add.data_type = "RGBA"
        add.blend_type = "ADD"
        add.inputs["Factor"].default_value = 1.0
        nt.links.new(col, add.inputs[6])
        add.inputs[7].default_value = srgb(glow)
        col = add.outputs[2]
    nt.links.new(col, emit.inputs["Color"])
    return mat


def flat_material(name, color, strength=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = srgb(color)
    emit.inputs["Strength"].default_value = strength
    nt.links.new(emit.outputs[0], out.inputs[0])
    return mat


_OUTLINE_MATS = {}


def outline_material(color=INK):
    key = tuple(round(c, 3) for c in color)
    mat = _OUTLINE_MATS.get(key)
    if mat is None:
        mat = flat_material("Outline", color)
        mat.use_backface_culling = True
        _OUTLINE_MATS[key] = mat
    return mat


# ---------------------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------------------

def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def add_outline(obj, thickness=OUTLINE, color=INK):
    """Inverted-hull outline: a slightly bigger back-facing shell in the ink color."""
    obj.data.materials.append(outline_material(color))
    mod = obj.modifiers.new("Outline", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.material_offset = len(obj.data.materials) - 1
    mod.use_rim = False
    return obj


def ellipsoid(name, loc, scale, mat, rot=(0, 0, 0), segments=32, rings=16, outline=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rot
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if outline:
        add_outline(obj, outline)
    return obj


def cone(name, loc, radius, depth, mat, rot=(0, 0, 0), outline=None, verts=24):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=0.0, depth=depth,
                                    location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if outline:
        add_outline(obj, outline)
    return obj


def blob(name, parts, mat, voxel=0.03, smooth=12, outline=OUTLINE, displace=None):
    """Ellipsoids merged into one smooth shape (voxel remesh + smoothing).
    parts: [((x, y, z), (sx, sy, sz)) or ((x, y, z), (sx, sy, sz), (rx, ry, rz))]."""
    objs = []
    for i, p in enumerate(parts):
        rot = p[2] if len(p) > 2 else (0, 0, 0)
        objs.append(ellipsoid(f"{name}{i}", p[0], p[1], mat, rot=rot))
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = name
    remesh = body.modifiers.new("Merge", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    if displace:
        # Fluffy fur / bumpy skin: noise displacement baked into the mesh.
        tex = bpy.data.textures.new(name + "Noise", "CLOUDS")
        tex.noise_scale = displace.get("scale", 0.12)
        mod = body.modifiers.new("Fluff", "DISPLACE")
        mod.texture = tex
        mod.strength = displace.get("strength", 0.06)
        mod.mid_level = 0.5
        bpy.ops.object.modifier_apply(modifier=mod.name)
    sm = body.modifiers.new("Soften", "SMOOTH")
    sm.factor = 1.0
    sm.iterations = smooth
    bpy.ops.object.modifier_apply(modifier=sm.name)
    bpy.ops.object.shade_smooth()
    if outline:
        add_outline(body, outline)
    return body


def plate(name, pts, mat, thickness=0.05, y=0.0, outline=OUTLINE, round_=True, rot=None):
    """A flat fin/flipper from a 2D outline [(x, z), ...] in the XZ plane at depth y."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = thickness / 2
    cu.bevel_depth = thickness * 0.35
    cu.bevel_resolution = 2
    sp = cu.splines.new("BEZIER" if round_ else "POLY")
    if round_:
        sp.bezier_points.add(len(pts) - 1)
        for bp, (x, z) in zip(sp.bezier_points, pts):
            bp.co = (x, z, 0)
            bp.handle_left_type = bp.handle_right_type = "AUTO"
    else:
        sp.points.add(len(pts) - 1)
        for pt, (x, z) in zip(sp.points, pts):
            pt.co = (x, z, 0, 1)
    sp.use_cyclic_u = True
    cu.materials.append(mat)
    obj = link(bpy.data.objects.new(name, cu))
    obj.rotation_euler = (math.pi / 2, 0, 0)
    obj.location = (0, y, 0)
    select_only(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    if rot:
        obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    if outline:
        add_outline(obj, outline)
    return obj


def tube(name, points, mat, bevel=0.012, outline=None):
    """A round line through 3D points (whiskers, legs, antennae), as a mesh."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, co in zip(sp.bezier_points, points):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.materials.append(mat)
    obj = link(bpy.data.objects.new(name, cu))
    select_only(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    if outline:
        add_outline(obj, outline)
    return obj


def surface_y(body, x, z, fallback=-0.5):
    """Near-side (camera-facing) y of `body`'s surface at (x, z)."""
    inv = body.matrix_world.inverted()
    origin = inv @ Vector((x, -10.0, z))
    direction = inv.to_3x3() @ Vector((0.0, 1.0, 0.0))
    hit, loc, _n, _i = body.ray_cast(origin, direction)
    return (body.matrix_world @ loc).y if hit else fallback


def on_skin(body, x, z, lift=0.0):
    return (x, surface_y(body, x, z) - lift, z)


def skin_tube(body, name, pts, mat, bevel, lift=0.02):
    """A line drawn on the near surface through (x, z) points."""
    last = -0.5
    out = []
    for x, z in pts:
        y = surface_y(body, x, z, fallback=last)
        last = y
        out.append((x, y - lift, z))
    return tube(name, out, mat, bevel)


_EYE_MATS = {}


def eye_mats():
    if not _EYE_MATS:
        _EYE_MATS.update(
            black=flat_material("EyeBlack", (0.02, 0.03, 0.04)),
            white=flat_material("EyeWhite", (1, 1, 1), 1.15),
            ink=flat_material("Ink", INK),
        )
    return _EYE_MATS


def cartoon_eye(body, name, x, z, r, sclera=True, pupil=0.62, look=(0.15, 0.0), lift=0.0):
    """Big cartoon eye on the near surface: optional white with outline, black pupil, shine."""
    m = eye_mats()
    y = surface_y(body, x, z) - lift
    parts = []
    if sclera:
        parts.append(ellipsoid(name + "White", (x, y, z), (r, r * 0.45, r * 1.08), m["white"],
                               outline=OUTLINE * 0.6))
        pr = r * pupil
        px, pz = x + look[0] * r, z + look[1] * r
        parts.append(ellipsoid(name + "Pupil", (px, y - r * 0.4, pz), (pr, pr * 0.4, pr * 1.08),
                               m["black"]))
    else:
        pr = r
        px, pz = x, z
        parts.append(ellipsoid(name + "Pupil", (x, y, z), (r, r * 0.4, r * 1.12), m["black"]))
    parts.append(ellipsoid(name + "Shine", (px + pr * 0.3, y - r * 0.75, pz + pr * 0.38),
                           (pr * 0.34, pr * 0.1, pr * 0.34), m["white"], segments=16, rings=8))
    return parts


def mirror_to_far_side(obj, suffix="Far"):
    """Copies a near-side detail to the far side (y -> -y)."""
    dup = obj.copy()
    dup.data = obj.data.copy()
    dup.name = obj.name + suffix
    link(dup)
    dup.matrix_world = Matrix.Scale(-1, 4, (0, 1, 0)) @ obj.matrix_world
    select_only(dup)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return dup


# ---------------------------------------------------------------------------------------
# Posing: every frame bends vertices from their rest positions (no armature needed).
# ---------------------------------------------------------------------------------------

def smooth01(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


def rotate_xz(p, pivot, angle, weight=1.0):
    """Rotates points about the Y axis through pivot (x, z), i.e. in the visible plane."""
    a = angle * weight
    c, s = np.cos(a), np.sin(a)
    dx, dz = p[:, 0] - pivot[0], p[:, 2] - pivot[1]
    p[:, 0] = pivot[0] + c * dx - s * dz
    p[:, 2] = pivot[1] + s * dx + c * dz
    return p


def rotate_xy(p, pivot, angle, weight=1.0):
    """Rotates points about the Z axis through pivot (x, y): a sideways (yaw) bend."""
    a = angle * weight
    c, s = np.cos(a), np.sin(a)
    dx, dy = p[:, 0] - pivot[0], p[:, 1] - pivot[1]
    p[:, 0] = pivot[0] + c * dx - s * dy
    p[:, 1] = pivot[1] + s * dx + c * dy
    return p


class Poser:
    """Stores rest vertex positions of every mesh; `apply(fn)` bends them for one frame.
    fn(name, points) -> points, with points an (N, 3) world-space array."""

    def __init__(self, pivot=(0.0, 0.0), skip=()):
        self.rig = link(bpy.data.objects.new("Rig", None))
        self.rig.location = (pivot[0], 0, pivot[1])
        bpy.context.view_layer.update()
        self.rest = {}
        for obj in bpy.data.objects:
            if obj.type != "MESH":
                continue
            obj.parent = self.rig
            obj.matrix_parent_inverse = self.rig.matrix_world.inverted()
            if obj.name in skip:
                continue
            n = len(obj.data.vertices)
            co = np.empty(n * 3)
            obj.data.vertices.foreach_get("co", co)
            loc = np.array(obj.location)
            self.rest[obj.name] = (co.reshape(n, 3) + loc, loc)

    def apply(self, fn, yaw=0.0):
        for name, (world, loc) in self.rest.items():
            p = fn(name, world.copy())
            obj = bpy.data.objects[name]
            obj.data.vertices.foreach_set("co", (p - loc).ravel())
            obj.data.update()
        self.rig.rotation_euler = (0, 0, -math.radians(yaw))
        bpy.context.view_layer.update()


# ---------------------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------------------

def setup_render(w_du, h_du, center=(0.0, 0.0)):
    """Ortho camera framing a w_du x h_du design-unit box centred on `center` (BU)."""
    scene = bpy.context.scene
    engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = int(w_du * PX_PER_DU)
    scene.render.resolution_y = int(h_du * PX_PER_DU)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"

    cam_data = bpy.data.cameras.new("SpriteCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(w_du, h_du) / DU_PER_BU
    cam = link(bpy.data.objects.new("SpriteCam", cam_data))
    cam.location = (center[0], -12.0, center[1])
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam

    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 3.0
    sun_data.use_shadow = False  # toon look: shading from the ramp only, no shadow acne
    sun = link(bpy.data.objects.new("Sun", sun_data))
    sun.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-30))

    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.35, 0.38, 0.42, 1)
        bg.inputs["Strength"].default_value = 0.6


def render_frames(poser, poses, out_path, cols):
    """Renders each pose (dict for poser.apply) and packs the frames into one sheet."""
    scene = bpy.context.scene
    w, h = scene.render.resolution_x, scene.render.resolution_y
    tmp = os.path.join(bpy.app.tempdir or os.getcwd(), "sprite_frames")
    os.makedirs(tmp, exist_ok=True)
    paths = []
    for i, kw in enumerate(poses):
        poser.apply(**kw)
        path = os.path.join(tmp, f"frame{i:02d}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        paths.append(path)

    rows = math.ceil(len(paths) / cols)
    sheet = np.zeros((rows * h, cols * w, 4), dtype=np.float32)
    for i, path in enumerate(paths):
        img = bpy.data.images.load(path)
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        r, c = divmod(i, cols)
        top = (rows - 1 - r) * h  # Blender images are stored bottom-up
        sheet[top:top + h, c * w:(c + 1) * w] = px.reshape(h, w, 4)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out = bpy.data.images.new("Sheet", cols * w, rows * h, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = out_path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    return {"path": out_path, "frames": len(paths), "frame": [w, h], "cols": cols}
