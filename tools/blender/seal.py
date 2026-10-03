# Builds the cartoon harbor seal in Blender, animates it, and renders the sprite sheet
# (swim cycle, bite, turn) the game plays as frames.
# Run from the repo root: node tools/blender/bridge.mjs exec tools/blender/seal.py
# (needs Blender open with the Blender Lab MCP add-on serving localhost:9876), or headless:
# blender -b -P tools/blender/seal.py
#
# Facing +X (right), Z up, camera looking along +Y. Toon shading (two soft tones) plus an
# inverted-hull outline so it matches the game's thick-outlined cartoon style.
import math
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector

# The bridge defines REPO (the repo root); a headless run uses the working directory.
OUT_DIR = os.path.join(globals().get("REPO", os.getcwd()), "public", "assets")
# Each frame: 176x88 design units rendered at 3x (resolution: 3 in the manifest) so it stays
# sharp when the seal grows and the camera zooms in.
RENDER_W, RENDER_H = 528, 264

# Sprite sheet layout; must match SEAL_SHEET in src/config/assets.ts.
SWIM_FRAMES = 8  # one full undulation
BITE_OPEN = (0.35, 0.7, 1.0)  # mouth openness per bite frame
# Degrees, head swinging toward the camera. The game mirrors these for the second half of
# a turn (a yaw of 180 - a looks like a flipped), so 90 isn't needed.
TURN_YAWS = (22.5, 45.0, 67.5)
SHEET_COLS = 3
SHEET_NAME = "seal-sheet.png"

# Swim pose tuning (world units / radians).
TAIL_AMP = 0.42  # vertical tail sweep at the hind flippers
WAVE_K = 0.9  # phase lag per unit along the body (wave travels head -> tail)
HEAD_BOB = 0.05
FLIPPER_SWING = 0.40
JAW_DROP = 0.48
ORTHO_W = 6.3  # world units across the frame (2:1 frame -> 3.0 tall)
CENTER = (-0.05, 0.12)  # frame centre (x, z): the sprite's origin

PALETTE = {
    "back": (0.33, 0.45, 0.56),
    "belly": (0.86, 0.91, 0.94),
    "muzzle": (0.92, 0.95, 0.97),
    "flipper": (0.26, 0.37, 0.48),
    "spots": (0.20, 0.29, 0.38),
    "outline": (0.04, 0.07, 0.10),
    "eye": (0.02, 0.03, 0.04),
    "nose": (0.05, 0.07, 0.09),
}


def srgb(c):
    """Palette values are sRGB; Blender colors are linear."""
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.metaballs, bpy.data.curves, bpy.data.materials,
                 bpy.data.cameras, bpy.data.lights):
        for block in list(coll):
            coll.remove(block)


# ---------------------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------------------

def toon_material(name, color, color_bottom=None, spots=None):
    """Two-tone soft toon shading. Optional vertical gradient (back -> belly) and spots."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs[0], out.inputs[0])

    # Light term -> toon ramp.
    diffuse = nt.nodes.new("ShaderNodeBsdfDiffuse")
    to_rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    nt.links.new(diffuse.outputs[0], to_rgb.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (0.62, 0.62, 0.66, 1)
    ramp.color_ramp.elements[1].position = 0.32
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(to_rgb.outputs[0], ramp.inputs[0])

    # Base color: flat, or a back -> belly gradient in object space.
    if color_bottom:
        coords = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(coords.outputs["Object"], sep.inputs[0])
        grad = nt.nodes.new("ShaderNodeValToRGB")
        grad.color_ramp.interpolation = "EASE"
        grad.color_ramp.elements[0].position = 0.42
        grad.color_ramp.elements[0].color = srgb(color_bottom)
        grad.color_ramp.elements[1].position = 0.45
        grad.color_ramp.elements[1].color = srgb(color)
        # Belly line: a clean two-tone split that rises toward the head (z - 0.10 * x),
        # mapped from [-0.9, 0.9] to [0, 1].
        tilt = nt.nodes.new("ShaderNodeMath")
        tilt.operation = "MULTIPLY_ADD"
        tilt.inputs[1].default_value = -0.10
        nt.links.new(sep.outputs["X"], tilt.inputs[0])
        nt.links.new(sep.outputs["Z"], tilt.inputs[2])
        mapz = nt.nodes.new("ShaderNodeMapRange")
        mapz.inputs["From Min"].default_value = -0.9
        mapz.inputs["From Max"].default_value = 0.9
        nt.links.new(tilt.outputs[0], mapz.inputs["Value"])
        nt.links.new(mapz.outputs[0], grad.inputs[0])
        base = grad.outputs[0]
        if spots:
            # Dark spots on the back only.
            vor = nt.nodes.new("ShaderNodeTexVoronoi")
            vor.inputs["Scale"].default_value = 2.6
            vor.feature = "F1"
            nt.links.new(coords.outputs["Object"], vor.inputs["Vector"])
            dots = nt.nodes.new("ShaderNodeMath")
            dots.operation = "LESS_THAN"
            dots.inputs[1].default_value = 0.22
            nt.links.new(vor.outputs["Distance"], dots.inputs[0])
            upper = nt.nodes.new("ShaderNodeMath")
            upper.operation = "GREATER_THAN"
            upper.inputs[1].default_value = 0.55
            nt.links.new(mapz.outputs[0], upper.inputs[0])
            not_head = nt.nodes.new("ShaderNodeMath")
            not_head.operation = "LESS_THAN"
            not_head.inputs[1].default_value = 1.0
            nt.links.new(sep.outputs["X"], not_head.inputs[0])
            on_back = nt.nodes.new("ShaderNodeMath")
            on_back.operation = "MULTIPLY"
            nt.links.new(upper.outputs[0], on_back.inputs[0])
            nt.links.new(not_head.outputs[0], on_back.inputs[1])
            mask = nt.nodes.new("ShaderNodeMath")
            mask.operation = "MULTIPLY"
            nt.links.new(dots.outputs[0], mask.inputs[0])
            nt.links.new(on_back.outputs[0], mask.inputs[1])
            mix_spots = nt.nodes.new("ShaderNodeMix")
            mix_spots.data_type = "RGBA"
            nt.links.new(mask.outputs[0], mix_spots.inputs["Factor"])
            nt.links.new(base, mix_spots.inputs[6])
            mix_spots.inputs[7].default_value = srgb(spots)
            base = mix_spots.outputs[2]
    else:
        rgb = nt.nodes.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = srgb(color)
        base = rgb.outputs[0]

    shade = nt.nodes.new("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.blend_type = "MULTIPLY"
    shade.inputs["Factor"].default_value = 1.0
    nt.links.new(base, shade.inputs[6])
    nt.links.new(ramp.outputs[0], shade.inputs[7])
    nt.links.new(shade.outputs[2], emit.inputs["Color"])
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


def outline_material():
    mat = flat_material("Outline", PALETTE["outline"])
    mat.use_backface_culling = True
    return mat


# ---------------------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------------------

def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_outline(obj, mat_outline, thickness=0.08):
    obj.data.materials.append(mat_outline)
    mod = obj.modifiers.new("Outline", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.material_offset = len(obj.data.materials) - 1
    mod.use_rim = False


def ellipsoid(name, loc, scale, mat, rot=(0, 0, 0), segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rot
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def body_mesh(mat):
    """Torso, chest, head, muzzle, hips and tail as ellipsoids, merged into one chubby shape
    (voxel remesh) and smoothed so the joins flow."""
    parts = [
        # centre (x, z), semi-axes (x, y, z)
        ((-0.20, 0.00), (1.50, 0.85, 0.98)),  # torso
        ((0.80, 0.14), (0.95, 0.80, 0.90)),  # chest / neck
        ((1.60, 0.44), (0.84, 0.76, 0.82)),  # head
        ((2.18, 0.22), (0.46, 0.42, 0.38)),  # muzzle
        ((-1.35, -0.02), (0.90, 0.62, 0.70)),  # hips
        ((-1.95, -0.04), (0.52, 0.40, 0.40)),  # tail end
    ]
    objs = [ellipsoid(f"Body{i}", (x, 0, z), size, mat) for i, ((x, z), size) in enumerate(parts)]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = "SealBody"
    remesh = body.modifiers.new("Merge", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.035
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = body.modifiers.new("Soften", "SMOOTH")
    smooth.factor = 1.0
    smooth.iterations = 12
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    bpy.ops.object.shade_smooth()
    return body


def surface_y(body, x, z, fallback=-0.6):
    """Near-side (camera-facing) y of the body surface at (x, z), so face details sit on the
    skin whatever the body proportions are."""
    inv = body.matrix_world.inverted()
    origin = inv @ Vector((x, -5.0, z))
    direction = inv.to_3x3() @ Vector((0.0, 1.0, 0.0))
    hit, loc, _normal, _index = body.ray_cast(origin, direction)
    return (body.matrix_world @ loc).y if hit else fallback


def whisker_curve(name, points, mat, bevel=0.012):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = bevel
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, co in zip(sp.bezier_points, points):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.materials.append(mat)
    return link(bpy.data.objects.new(name, cu))


def build():
    clear_scene()
    m_body = toon_material("SealSkin", PALETTE["back"], PALETTE["belly"], PALETTE["spots"])
    m_flip = toon_material("Flipper", PALETTE["flipper"])
    m_muzzle = toon_material("Muzzle", PALETTE["muzzle"])
    m_eye = flat_material("Eye", PALETTE["eye"])
    m_white = flat_material("Highlight", (1, 1, 1), 1.2)
    m_nose = flat_material("Nose", PALETTE["nose"])
    m_line = flat_material("Line", PALETTE["outline"])
    m_out = outline_material()

    body = body_mesh(m_body)
    add_outline(body, m_out)

    def on_skin(x, z, lift=0.0):
        """Point on the near surface at (x, z), lifted toward the camera."""
        return (x, surface_y(body, x, z) - lift, z)

    def skin_curve(name, pts, mat, bevel, lift=0.02):
        last = -0.6
        out = []
        for x, z in pts:
            y = surface_y(body, x, z, fallback=last)
            last = y
            out.append((x, y - lift, z))
        return whisker_curve(name, out, mat, bevel)

    # Whisker pad: a lighter bump on the near side of the muzzle.
    mx, mz = 2.24, 0.16
    ellipsoid("Muzzle", (mx, surface_y(body, mx, mz) + 0.16, mz), (0.36, 0.30, 0.27), m_muzzle)

    # Hind flippers: two paddles side by side pointing straight back (not a forked tail).
    for name, y, z, tilt in (("HindFar", 0.16, 0.10, -0.22), ("HindNear", -0.16, -0.16, 0.20)):
        f = ellipsoid(name, (-2.50, y, z), (0.50, 0.07, 0.19), m_flip, rot=(0, tilt, 0))
        add_outline(f, m_out, 0.06)
    # Front flipper on the near side, angled down and back.
    fx, fz = 0.42, -0.66
    fy = surface_y(body, fx, fz) + 0.02
    ff = ellipsoid("FrontFlipper", (fx, fy, fz), (0.38, 0.08, 0.16), m_flip,
                   rot=(0, math.radians(-40), 0))
    add_outline(ff, m_out, 0.06)
    # Little claws.
    for i in range(3):
        ellipsoid(f"Claw{i}", (fx - 0.26 + i * 0.03, fy - 0.09, fz - 0.22 + i * 0.06),
                  (0.04, 0.02, 0.022), m_line, segments=12, rings=8)

    # Big dark eye with highlights.
    ex, ez = 1.80, 0.64
    ey = surface_y(body, ex, ez)
    EYE_CENTER[:] = (ex, ey, ez)
    ellipsoid("Eye", (ex, ey, ez), (0.21, 0.08, 0.24), m_eye)
    ellipsoid("EyeShine", (ex + 0.06, ey - 0.08, ez + 0.09), (0.075, 0.02, 0.075), m_white,
              segments=16, rings=8)
    ellipsoid("EyeShine2", (ex - 0.06, ey - 0.08, ez - 0.10), (0.032, 0.01, 0.032), m_white,
              segments=12, rings=6)
    skin_curve("Brow", [(ex - 0.17, ez + 0.28), (ex - 0.02, ez + 0.34), (ex + 0.13, ez + 0.30)],
               m_line, 0.014)
    # Nose at the snout tip, and a smile.
    nx, nz = 2.56, 0.34
    ellipsoid("Nose", on_skin(nx, nz, -0.02), (0.11, 0.08, 0.08), m_nose)
    smile_lift = 0.20  # the muzzle pad bulges ~0.16 out of the body
    skin_curve("Mouth", [(2.42, 0.04), (2.27, -0.04), (2.08, 0.01)], m_line, 0.022, smile_lift)
    # Whisker dots and whiskers.
    for i, (x, z) in enumerate(((2.20, 0.26), (2.30, 0.26), (2.25, 0.18), (2.35, 0.18))):
        ellipsoid(f"Dot{i}", on_skin(x, z, smile_lift + 0.01), (0.018, 0.01, 0.018), m_line,
                  segments=8, rings=6)
    for i, (z0, z1) in enumerate(((0.26, 0.42), (0.21, 0.23), (0.16, 0.04))):
        skin_curve(f"Whisker{i}", [(2.34, z0), (2.64, (z0 + z1) / 2 + 0.03), (2.94, z1)],
                   m_line, 0.013, smile_lift + 0.03)

    # Open mouth (bite frames only): dark inside, tongue and two little teeth, sized per frame.
    my = surface_y(body, 2.28, 0.0) - 0.19
    m_mouth = flat_material("MouthInside", (0.30, 0.05, 0.08))
    m_tongue = flat_material("Tongue", (0.92, 0.45, 0.50))
    m_tooth = flat_material("Tooth", (1, 1, 1), 1.1)
    for name, loc, size, mat in (
        ("MouthOpen", (2.27, my, 0.0), (0.24, 0.02, 1.0), m_mouth),
        ("Tongue", (2.24, my - 0.02, 0.0), (0.13, 0.015, 0.45), m_tongue),
        ("ToothA", (2.38, my - 0.03, 0.0), (0.03, 0.01, 0.05), m_tooth),
        ("ToothB", (2.16, my - 0.03, 0.0), (0.03, 0.01, 0.05), m_tooth),
    ):
        ellipsoid(name, loc, (1, 1, 1), mat, segments=24, rings=12).scale = size

    # Curves -> meshes so the pose code can bend everything the same way.
    curves = [o for o in bpy.data.objects if o.type == "CURVE"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in curves:
        o.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.convert(target="MESH")

    # The model only had details on the near side; mirror them so turning shows a full face.
    for name in [o.name for o in bpy.data.objects]:
        if name.startswith(NEAR_DETAILS):
            mirror_to_far_side(bpy.data.objects[name])

    setup_render()


EYE_CENTER = [0.0, 0.0, 0.0]  # set by build(); eye highlights orbit it to face the camera
MOUTH_PARTS = ("MouthOpen", "Tongue", "ToothA", "ToothB")
NEAR_DETAILS = ("Eye", "Brow", "Nose", "Mouth", "Dot", "Whisker", "Muzzle", "FrontFlipper",
                "Claw")


def mirror_to_far_side(obj):
    if obj.name in MOUTH_PARTS:
        return
    dup = obj.copy()
    dup.data = obj.data.copy()
    dup.name = obj.name + "Far"
    link(dup)
    dup.matrix_world = Matrix.Scale(-1, 4, (0, 1, 0)) @ obj.matrix_world
    # Bake the mirror into the mesh so the normals (and the outline shell) stay correct.
    bpy.ops.object.select_all(action="DESELECT")
    dup.select_set(True)
    bpy.context.view_layer.objects.active = dup
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def setup_render():
    scene = bpy.context.scene
    engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = RENDER_W
    scene.render.resolution_y = RENDER_H
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"

    cam_data = bpy.data.cameras.new("SpriteCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ORTHO_W
    cam = link(bpy.data.objects.new("SpriteCam", cam_data))
    cam.location = (CENTER[0], -12.0, CENTER[1])
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


# ---------------------------------------------------------------------------------------
# Posing: vertices are bent from their rest positions each frame (no armature needed).
# ---------------------------------------------------------------------------------------

def smooth01(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


class Poser:
    def __init__(self):
        cx, cz = CENTER
        self.rig = link(bpy.data.objects.new("Rig", None))
        self.rig.location = (cx, 0, cz)
        bpy.context.view_layer.update()
        self.rest = {}
        for obj in bpy.data.objects:
            if obj.type != "MESH":
                continue
            # Parent everything to the rig (keeping placement) so turns pivot on the sprite origin.
            obj.parent = self.rig
            obj.matrix_parent_inverse = self.rig.matrix_world.inverted()
            if obj.name in MOUTH_PARTS:
                obj.hide_render = True
                continue
            if obj.name.startswith("EyeShine") and obj.name.endswith("Far"):
                obj.hide_render = True  # the far eye is behind the head in every frame
            n = len(obj.data.vertices)
            local = np.empty(n * 3)
            obj.data.vertices.foreach_get("co", local)
            local = local.reshape(n, 3)
            loc = np.array(obj.location)  # transforms are applied, so world = local + location
            self.rest[obj.name] = (local + loc, loc)
        self.mouth_rest = {n: (Vector(bpy.data.objects[n].location),
                               Vector(bpy.data.objects[n].scale)) for n in MOUTH_PARTS}

    def wave(self, x, phase):
        """Vertical bend of the body: grows toward the tail, travels head -> tail."""
        tail = smooth01((0.6 - x) / 3.6) ** 1.4
        head = smooth01((x - 0.6) / 1.5)
        return (TAIL_AMP * tail * np.sin(phase - WAVE_K * (0.6 - x))
                + HEAD_BOB * head * np.sin(phase + math.pi))

    def jaw_weight(self, x, z):
        return smooth01((x - 1.86) / 0.25) * smooth01((0.10 - z) / 0.12)

    def pose(self, phase=0.0, bite=0.0, yaw=0.0):
        sweep = FLIPPER_SWING * math.sin(phase + 0.6)
        for name, (world, loc) in self.rest.items():
            p = world.copy()
            if name.startswith(("FrontFlipper", "Claw")):
                # Paddle around the shoulder.
                px, pz = 0.71, -0.42
                c, s = math.cos(sweep), math.sin(sweep)
                dx, dz = p[:, 0] - px, p[:, 2] - pz
                p[:, 0] = px + c * dx - s * dz
                p[:, 2] = pz + s * dx + c * dz
            if bite > 0:
                w = self.jaw_weight(p[:, 0], p[:, 2])
                p[:, 2] -= JAW_DROP * bite * w * (0.6 + (p[:, 0] - 1.86))
                p[:, 0] -= 0.05 * bite * w
            if name.startswith("EyeShine") and yaw:
                # Highlights sit in front of the eye; keep them facing the camera as it turns.
                eye = np.array(EYE_CENTER)
                a = math.radians(yaw)
                c, s = math.cos(a), math.sin(a)
                d = p - eye
                p[:, 0] = eye[0] + c * d[:, 0] - s * d[:, 1]
                p[:, 1] = eye[1] + s * d[:, 0] + c * d[:, 1]
            p[:, 2] += self.wave(p[:, 0], phase)
            obj = bpy.data.objects[name]
            obj.data.vertices.foreach_set("co", (p - loc).ravel())
            obj.data.update()
        self.pose_mouth(phase, bite)
        self.rig.rotation_euler = (0, 0, -math.radians(yaw))
        bpy.context.view_layer.update()

    def pose_mouth(self, phase, bite):
        lift = float(self.wave(np.array([2.27]), phase)[0])
        drop = JAW_DROP * bite * (0.6 + 0.41)  # jaw drop at the mouth's centre
        for name in MOUTH_PARTS:
            obj = bpy.data.objects[name]
            obj.hide_render = bite <= 0
            loc, size = self.mouth_rest[name]
            obj.location = loc.copy()
            obj.scale = size.copy()
            if name == "MouthOpen":
                obj.scale.z = 0.03 + drop * 0.5
                obj.location.z = 0.06 - drop * 0.5 + lift
            elif name == "Tongue":
                obj.scale.z = 0.02 + drop * 0.2
                obj.location.z = 0.06 - drop * 0.75 + lift
            else:  # teeth hang from the upper lip
                obj.location.z = 0.03 + lift


def render_frame(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def build_sheet(paths):
    """Packs the frame PNGs into one sheet, row-major from the top-left."""
    rows = math.ceil(len(paths) / SHEET_COLS)
    w, h = RENDER_W, RENDER_H
    sheet = np.zeros((rows * h, SHEET_COLS * w, 4), dtype=np.float32)
    for i, path in enumerate(paths):
        img = bpy.data.images.load(path)
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        r, c = divmod(i, SHEET_COLS)
        # Blender images are stored bottom-up.
        top = (rows - 1 - r) * h
        sheet[top:top + h, c * w:(c + 1) * w] = px.reshape(h, w, 4)
    out = bpy.data.images.new("SealSheet", SHEET_COLS * w, rows * h, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    path = os.path.join(OUT_DIR, SHEET_NAME)
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    return path


def render_all():
    poser = Poser()
    tmp = os.path.join(bpy.app.tempdir or os.getcwd(), "seal_frames")
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    poses = [dict(phase=2 * math.pi * i / SWIM_FRAMES) for i in range(SWIM_FRAMES)]
    poses += [dict(bite=b) for b in BITE_OPEN]
    poses += [dict(yaw=y) for y in TURN_YAWS]
    paths = []
    for i, kw in enumerate(poses):
        poser.pose(**kw)
        path = os.path.join(tmp, f"frame{i:02d}.png")
        render_frame(path)
        paths.append(path)
    poser.pose()
    return build_sheet(paths), len(paths)


build()
sheet, frames = render_all()
result = {"rendered": sheet, "frames": frames, "objects": len(bpy.data.objects)}
