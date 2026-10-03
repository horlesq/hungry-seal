# Renders the terrain material atlas: four seamless 512 px tiles (cobbled rock, rippled sand,
# porous coral stone, cracked plates), grayscale and lit from the top-left like every sprite,
# so the terrain shader can tint them per map (docs/ART_DIRECTION.md).
#
# Run from the repo root: node tools/blender/bridge.mjs exec tools/blender/materials.py
# Output: public/assets/terrain-materials.png (1024x1024, tiles in a 2x2 grid:
#   0 rock (top-left), 1 sand (top-right), 2 coral stone (bottom-left), 3 plates (bottom-right)).
#
# Seamless by construction: every object near an edge is also placed one tile over, and the
# camera frames exactly one tile.
import importlib
import math
import os
import sys

import bpy
import numpy as np

REPO_DIR = globals().get("REPO", os.getcwd())
sys.path.insert(0, os.path.join(REPO_DIR, "tools", "blender"))
import toonkit  # noqa: E402

importlib.reload(toonkit)
from toonkit import clear_scene, link  # noqa: E402

OUT = os.path.join(REPO_DIR, "public", "assets", "terrain-materials.png")
TILE = 4.0  # world units per tile
PX = 512


def rng(seed):
    return np.random.default_rng(seed)


def shade_material(name, base=0.78, var=0.0, seed=0):
    """Soft 3-band toon shading in gray (the shader tints it)."""
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
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.08, (0.3, 0.3, 0.3, 1)
    e[1].position, e[1].color = 0.6, (1.0, 1.0, 1.0, 1)
    mid = e.new(0.3)
    mid.color = (0.66, 0.66, 0.66, 1)
    nt.links.new(to_rgb.outputs[0], ramp.inputs[0])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    nt.links.new(ramp.outputs[0], mul.inputs[6])
    v = base
    mul.inputs[7].default_value = (v, v, v, 1)
    nt.links.new(mul.outputs[2], emit.inputs["Color"])
    return mat


def base_plane(mat, z=0.0):
    bpy.ops.mesh.primitive_plane_add(size=TILE * 3, location=(0, 0, z))
    p = bpy.context.active_object
    p.data.materials.append(mat)
    return p


def wrapped(x, y, margin):
    """(x, y) and its copies one tile over, for objects near the tile edges."""
    h = TILE / 2
    out = [(x, y)]
    for dx in (-TILE, 0, TILE):
        for dy in (-TILE, 0, TILE):
            if dx == 0 and dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if -h - margin < nx < h + margin and -h - margin < ny < h + margin:
                out.append((nx, ny))
    return out


def blob(loc, scale, mat, rot=0.0, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    o.rotation_euler = (0, 0, rot)
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def lumpy(o, strength, seed):
    """Irregular stone: noise displacement on a sphere."""
    tex = bpy.data.textures.new(f"Lump{seed}", "CLOUDS")
    tex.noise_scale = 0.35
    mod = o.modifiers.new("Lump", "DISPLACE")
    mod.texture = tex
    mod.strength = strength
    mod.texture_coords = "LOCAL"


def tile_rock(seed=1):
    """Cobbled rock: big, flat, irregular stones of mixed sizes, dark gaps between."""
    r = rng(seed)
    base_plane(shade_material("Grout", 0.32))
    mats = [shade_material(f"Stone{i}", 0.7 + 0.1 * i) for i in range(3)]
    pts = []
    for _ in range(500):
        x, y = r.uniform(-TILE / 2, TILE / 2, 2)
        size = r.uniform(0.22, 0.62)
        if any(math.hypot(x - px, y - py) < (size + ps) * 0.78 for px, py, ps in pts):
            continue
        pts.append((x, y, size))
    for k, (x, y, size) in enumerate(pts):
        m = mats[r.integers(0, 3)]
        rot = r.uniform(0, math.pi)
        sx = size * r.uniform(0.8, 1.25)
        for wx, wy in wrapped(x, y, size * 1.3):
            o = blob((wx, wy, 0.0), (sx, size, size * 0.32), m, rot, 32, 16)
            lumpy(o, 0.35, seed * 1000 + k)


def tile_sand(seed=2):
    """Rippled sand with a few pebbles and shell bits."""
    r = rng(seed)
    sand = shade_material("Sand", 0.86)
    # Ripples: a displaced plane whose waves repeat exactly over the tile.
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=160, y_subdivisions=160, size=TILE * 3)
    g = bpy.context.active_object
    g.data.materials.append(sand)
    for v in g.data.vertices:
        x, y = v.co.x, v.co.y
        k = 2 * math.pi / TILE
        v.co.z = 0.11 * math.sin(k * 5 * (y + 0.12 * math.sin(k * 2 * x))) + 0.03 * math.sin(k * 3 * x)
    bpy.ops.object.shade_smooth()
    pebble = shade_material("Pebble", 0.62)
    for _ in range(26):
        x, y = r.uniform(-TILE / 2, TILE / 2, 2)
        s = r.uniform(0.05, 0.12)
        for wx, wy in wrapped(x, y, s):
            blob((wx, wy, 0.03), (s * 1.3, s, s * 0.6), pebble, r.uniform(0, 3))


def tile_coral(seed=3):
    """Porous coral stone: lumpy bumps with dark pits."""
    r = rng(seed)
    base_plane(shade_material("CoralBase", 0.7))
    bump = shade_material("CoralBump", 0.84)
    pit = shade_material("Pit", 0.22)
    for _ in range(90):
        x, y = r.uniform(-TILE / 2, TILE / 2, 2)
        s = r.uniform(0.12, 0.32)
        for wx, wy in wrapped(x, y, s):
            blob((wx, wy, -0.04), (s, s * r.uniform(0.8, 1.2), s * 0.45), bump, r.uniform(0, 3))
    for _ in range(70):
        x, y = r.uniform(-TILE / 2, TILE / 2, 2)
        s = r.uniform(0.03, 0.07)
        for wx, wy in wrapped(x, y, s):
            blob((wx, wy, 0.12), (s, s, 0.02), pit, 0, 12, 6)


def tile_plates(seed=4):
    """Cracked plates (ice floes, basalt, ruin slabs): overlapping slabs of varied size."""
    r = rng(seed)
    base_plane(shade_material("Crack", 0.26), z=-0.05)
    mats = [shade_material(f"Plate{i}", 0.72 + 0.1 * i) for i in range(3)]
    for k in range(34):
        if True:
            x, y = r.uniform(-TILE / 2, TILE / 2, 2)
            w = r.uniform(0.5, 1.15)
            h = r.uniform(0.45, 1.0)
            rot = r.uniform(-0.6, 0.6)
            m = mats[r.integers(0, 3)]
            for wx, wy in wrapped(x, y, max(w, h)):
                bpy.ops.mesh.primitive_cube_add(location=(wx, wy, k * 0.004))
                o = bpy.context.active_object
                o.scale = (w / 2, h / 2, 0.08)
                o.rotation_euler = (0, 0, rot)
                o.data.materials.append(m)
                mod = o.modifiers.new("Bevel", "BEVEL")
                mod.width = 0.07
                mod.segments = 4
                bpy.ops.object.shade_smooth()


def setup(path):
    scene = bpy.context.scene
    engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.film_transparent = False
    scene.render.resolution_x = PX
    scene.render.resolution_y = PX
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"
    cam_data = bpy.data.cameras.new("TileCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = TILE
    cam = link(bpy.data.objects.new("TileCam", cam_data))
    cam.location = (0, 0, 10)
    scene.camera = cam
    # Key light from the top-left of the image (image up = +Y here).
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 3.0
    sun_data.use_shadow = False
    sun = link(bpy.data.objects.new("Sun", sun_data))
    sun.rotation_euler = (math.radians(40), math.radians(-35), math.radians(-30))
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.4, 0.4, 0.4, 1)
        bg.inputs["Strength"].default_value = 0.5
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_atlas():
    tmp = os.path.join(bpy.app.tempdir or os.getcwd(), "tiles")
    os.makedirs(tmp, exist_ok=True)
    paths = []
    for i, build in enumerate((tile_rock, tile_sand, tile_coral, tile_plates)):
        clear_scene()
        build()
        path = os.path.join(tmp, f"tile{i}.png")
        setup(path)
        paths.append(path)
    atlas = np.zeros((PX * 2, PX * 2, 4), dtype=np.float32)
    for i, path in enumerate(paths):
        img = bpy.data.images.load(path)
        px = np.empty(PX * PX * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        r, c = divmod(i, 2)
        top = (1 - r) * PX  # bottom-up storage
        atlas[top:top + PX, c * PX:(c + 1) * PX] = px.reshape(PX, PX, 4)
    atlas[..., 3] = 1.0
    out = bpy.data.images.new("Atlas", PX * 2, PX * 2, alpha=True)
    out.pixels.foreach_set(atlas.ravel())
    out.filepath_raw = OUT
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    return OUT


result = {"atlas": render_atlas()}
