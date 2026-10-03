# Builds the map decorations (coral, kelp, wrecks, landmarks...) and pickups (chest, mine,
# coin, magnet orb) in Blender and renders a sheet for each. Swaying plants get 4 frames;
# everything else is a single frame.
#
# Run from the repo root: node tools/blender/bridge.mjs exec tools/blender/decor.py [ONLY=kelp,chest]
# Output: public/assets/<texture key>-sheet.png. Ground decor stands on the bottom edge of its
# frame (the game anchors it bottom-centre); icicles hang from the top edge.
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
from toonkit import (  # noqa: E402
    DU_PER_BU, OUTLINE, Poser, add_outline, blob, cartoon_eye, clear_scene, cone, ellipsoid,
    flat_material, hex_rgb as H, link, on_skin, plate, render_frames, select_only, setup_render,
    skin_tube, smooth01, surface_y, toon_material, tube,
)

OUT_DIR = os.path.join(REPO_DIR, "public", "assets")
TAU = 2 * math.pi
INK = H("#1f1a26")


def cylinder(name, loc, r, depth, mat, rot=(0, 0, 0), outline=OUTLINE, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc,
                                        rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if outline:
        add_outline(obj, outline, INK)
    return obj


def torus(name, loc, major, minor, mat, rot=(0, 0, 0), outline=0.04):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc,
                                     rotation=rot, major_segments=40, minor_segments=12)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if outline:
        add_outline(obj, outline, INK)
    return obj


def box_mesh(name, loc, size, mat, rot=(0, 0, 0), outline=OUTLINE, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.shade_smooth()
    if outline:
        add_outline(obj, outline, INK)
    return obj


def sway(amount, height):
    """Plants: lean side to side, more toward the top (base fixed at z = -height/2)."""
    def pose(name, p, phase):
        k = smooth01((p[:, 2] + height / 2) / height) ** 1.6
        p[:, 0] += amount * k * np.sin(phase - 1.5 * k)
        return p
    return pose


# ---------------------------------------------------------------------------------------
# Plants and reef life
# ---------------------------------------------------------------------------------------

def kelp(w, h):
    H2 = h / 2
    green = toon_material("Kelp", H("#3c9a4a"), H("#2c7a3a"), split=0.0, soft=4.0)
    leaf = toon_material("KelpLeaf", H("#58b85a"))
    pts = [(math.sin(i * 0.9) * 0.08, 0, -H2 + 0.05 + i * (h - 0.4) / 8) for i in range(9)]
    tube("Stalk", pts, green, 0.10, outline=0.05)
    for i in range(1, 9):
        x, _, z = pts[i]
        sgn = 1 if i % 2 else -1
        plate(f"Leaf{i}", [(x, z - 0.1), (x + sgn * 0.45, z + 0.15), (x + sgn * 0.70, z + 0.65),
                           (x + sgn * 0.25, z + 0.55)], leaf, thickness=0.03, y=-0.02, outline=0.04)
    ellipsoid("Float", (pts[-1][0], -0.02, pts[-1][2] + 0.12), (0.12, 0.10, 0.14), leaf, outline=0.04)
    return sway(0.55, h), 4


def seaweed(w, h):
    H2 = h / 2
    mats = [toon_material("Weed0", H("#4caf50")), toon_material("Weed1", H("#2e8b57")),
            toon_material("Weed2", H("#7cc35a"))]
    for i, (x0, top) in enumerate(((-0.35, 0.72), (0.0, 0.92), (0.32, 0.66), (-0.12, 0.5))):
        z1 = -H2 + top * (h - 0.2)
        plate(f"Blade{i}", [(x0 - 0.10, -H2), (x0 + 0.12, -H2 + 0.6), (x0 - 0.04, z1),
                            (x0 - 0.18, -H2 + 0.7), (x0 + 0.05, -H2)], mats[i % 3],
              thickness=0.03, y=0.05 * i, outline=0.04)
    return sway(0.30, h), 4


def coral_branch(w, h):
    H2 = h / 2
    m = toon_material("Coral", H("#ff6f91"), spots=dict(color=H("#ffc2d1"), scale=14, size=0.15))
    tip = toon_material("CoralTip", H("#ffd0dc"))
    branches = [
        [(0.0, -H2), (0.02, -0.4), (-0.35, 0.2), (-0.55, 0.85)],
        [(0.02, -0.4), (0.30, 0.1), (0.62, 0.70)],
        [(-0.10, -0.1), (-0.05, 0.5), (0.10, 1.05)],
        [(0.30, 0.1), (0.20, 0.55), (0.32, 0.95)],
        [(-0.35, 0.2), (-0.75, 0.40), (-0.95, 0.65)],
    ]
    for i, b in enumerate(branches):
        tube(f"Branch{i}", [(x, 0, z) for x, z in b], m, 0.11 - i * 0.008, outline=0.05)
        x, z = b[-1]
        ellipsoid(f"Tip{i}", (x, 0, z), (0.12, 0.12, 0.12), tip, outline=0.04)
    return None, 1


def coral_brain(w, h):
    H2 = h / 2
    m = toon_material("Brain", H("#f4a63a"), H("#d9822b"), split=-0.4, soft=0.2)
    body = blob("Brain", [((0, 0, -H2 + 0.45), (1.25, 0.9, 0.62))], m, voxel=0.03, outline=None)
    add_outline(body, OUTLINE, INK)
    ink = flat_material("Groove", H("#a85a1a"))
    for i in range(5):
        x = -0.9 + i * 0.45
        skin_tube(body, f"Groove{i}", [(x - 0.1, -H2 + 0.25), (x + 0.12, -H2 + 0.55),
                                       (x - 0.08, -H2 + 0.85)], ink, 0.025, lift=0.0)
    return None, 1


def coral_fan(w, h):
    H2 = h / 2
    m = toon_material("Fan", H("#9b5de5"), spots=dict(color=H("#c9a7ff"), scale=12, size=0.2))
    stalk = toon_material("FanStalk", H("#6a3fb5"))
    tube("Stalk", [(0, 0, -H2), (0.02, 0, -H2 + 0.35)], stalk, 0.08, outline=0.04)
    plate("Fan", [(0.0, -H2 + 0.3), (-1.1, 0.1), (-0.9, 1.15), (0.0, 1.55), (0.95, 1.1), (1.15, 0.1)],
          m, thickness=0.05, outline=0.05)
    ink = flat_material("Vein", H("#6a3fb5"))
    for i, (x, z) in enumerate(((-0.75, 0.9), (-0.3, 1.35), (0.3, 1.35), (0.75, 0.9))):
        tube(f"Vein{i}", [(0, -0.08, -H2 + 0.35), (x * 0.5, -0.08, (z - H2) * 0.5), (x, -0.08, z)],
             ink, 0.018)
    return None, 1


def anemone(w, h):
    H2 = h / 2
    col = toon_material("Column", H("#ff8a5b"))
    tent = toon_material("Tentacle", H("#ffb3c7"))
    tipm = toon_material("TentTip", H("#ff5d8f"))
    cylinder("Column", (0, 0, -H2 + 0.35), 0.38, 0.7, col)
    for i in range(9):
        a = -0.95 + i * (1.9 / 8)
        x = math.sin(a) * 0.32
        y = -math.cos(a) * 0.15 - 0.05
        z0 = -H2 + 0.68
        end = (x * 2.4, y, z0 + 0.55 + 0.25 * math.cos(a * 1.4))
        tube(f"Tentacle{i}", [(x, y, z0), (x * 1.7, y, z0 + 0.35), end], tent, 0.05, outline=0.03)
        ellipsoid(f"Tip{i}", end, (0.065, 0.065, 0.065), tipm)
    return sway(0.12, h), 4


def boulder(w, h):
    H2 = h / 2
    m = toon_material("Boulder", H("#8d8a84"), H("#6c6862"), split=-0.5, soft=0.3,
                      spots=dict(color=H("#5f8f4a"), scale=4, size=0.25, min_z=0.3))
    b = blob("Boulder", [((0, 0, -H2 + 0.62), (1.75, 1.0, 0.70)), ((0.6, 0, -H2 + 0.9), (0.8, 0.7, 0.55))],
             m, voxel=0.03, outline=None, displace=dict(scale=0.4, strength=0.12))
    add_outline(b, OUTLINE, INK)
    return None, 1


def starfish(w, h):
    H2 = h / 2
    m = toon_material("Star", H("#ff8c42"), spots=dict(color=H("#ffd29d"), scale=16, size=0.18))
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = 0.46 if i % 2 == 0 else 0.2
        pts.append((math.cos(a) * r, math.sin(a) * r))
    plate("Star", pts, m, thickness=0.12, outline=0.045, round_=False,
          rot=(math.radians(70), 0, math.radians(8)))
    for o in bpy.data.objects:
        o.location.z -= H2 - 0.30
    return None, 1


def shell(w, h):
    H2 = h / 2
    m = toon_material("Shell", H("#ffc3a0"), H("#ff9a76"), split=-0.2, soft=0.15)
    pts = [(0, -H2 + 0.05)] + [(math.cos(a) * 0.6, -H2 + 0.05 + math.sin(a) * 0.85)
                               for a in np.linspace(0.15, math.pi - 0.15, 9)]
    plate("Shell", pts, m, thickness=0.08, outline=0.045, round_=False)
    ink = flat_material("Rib", H("#d9725a"))
    for i, a in enumerate(np.linspace(0.45, math.pi - 0.45, 5)):
        tube(f"Rib{i}", [(0, -0.06, -H2 + 0.12), (math.cos(a) * 0.5, -0.06, -H2 + 0.05 + math.sin(a) * 0.72)],
             ink, 0.018)
    return None, 1


def urchin(w, h):
    H2 = h / 2
    m = toon_material("Urchin", H("#5b2a86"))
    spine = toon_material("Spine", H("#2d1450"))
    ellipsoid("Body", (0, 0, -H2 + 0.38), (0.42, 0.42, 0.36), m, outline=0.05)
    for i in range(16):
        a = math.radians(15 + i * 10)
        d = (math.cos(a), -0.4 * (i % 2), math.sin(a))
        cone(f"Spine{i}", (math.cos(a) * 0.55, d[1] * 0.3, -H2 + 0.38 + math.sin(a) * 0.5), 0.03,
             0.42, spine, rot=(0, math.pi / 2 - a, 0), outline=0.02)
    return None, 1


# ---------------------------------------------------------------------------------------
# Man-made and landmarks
# ---------------------------------------------------------------------------------------

def anchor(w, h):
    H2 = h / 2
    m = toon_material("Iron", H("#6b5d55"), spots=dict(color=H("#b5652f"), scale=6, size=0.28))
    cylinder("Shank", (0, 0, -0.1), 0.09, 2.5, m, outline=0.045)
    cylinder("Stock", (0, 0, 1.0), 0.07, 1.1, m, rot=(0, math.pi / 2, 0), outline=0.04)
    torus("Ring", (0, 0, 1.38), 0.22, 0.06, m, rot=(math.pi / 2, 0, 0))
    tube("Arms", [(-0.95, 0, -0.85), (-0.6, 0, -1.3), (0, 0, -1.42), (0.6, 0, -1.3), (0.95, 0, -0.85)],
         m, 0.09, outline=0.045)
    for sgn in (-1, 1):
        cone(f"Fluke{sgn}", (sgn * 0.98, 0, -0.72), 0.17, 0.4, m, rot=(0, sgn * 0.5, 0), outline=0.04)
    for o in bpy.data.objects:
        o.rotation_euler = (0, math.radians(-20), 0)
        select_only(o)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        o.location.z -= 0.15
    return None, 1


def barrel(w, h):
    H2 = h / 2
    wood = toon_material("Wood", H("#a0652e"), H("#7c4a1f"), split=-0.4, soft=0.2)
    band = toon_material("Band", H("#4a4a4a"))
    b = blob("Barrel", [((0, 0, -H2 + 0.98), (0.72, 0.72, 0.98))], wood, voxel=0.02, outline=None)
    for v in b.data.vertices:
        z = v.co.z + b.location.z
        if z > H2 - 0.12:
            v.co.z = H2 - 0.12 - b.location.z
        if z < -H2 + 0.04:
            v.co.z = -H2 + 0.04 - b.location.z
    add_outline(b, OUTLINE, INK)
    for i, z in enumerate((-H2 + 0.4, H2 - 0.5)):
        torus(f"Band{i}", (0, 0, z), 0.70, 0.05, band)
    ink = flat_material("Plank", H("#5a3410"))
    for i, x in enumerate((-0.35, 0.0, 0.35)):
        skin_tube(b, f"Plank{i}", [(x, -H2 + 0.1), (x * 1.15, 0.0), (x, H2 - 0.2)], ink, 0.015, lift=0.0)
    return None, 1


def shipwreck(w, h):
    H2 = h / 2
    wood = toon_material("Hull", H("#7a4b2a"), H("#4f2f18"), split=-1.2, soft=0.6,
                         spots=dict(color=H("#4f7a4a"), scale=1.4, size=0.25, min_z=-0.5))
    dark = flat_material("Hole", H("#1a120e"))
    sail = toon_material("Sail", H("#e9dfc8"))
    hull = blob("Hull", [((0, 0, -2.4), (13.5, 2.2, 2.8)), ((-9.5, 0, -1.2), (4.5, 2.0, 2.2)),
                         ((10.5, 0, -1.6), (4.0, 1.9, 2.2))],
                wood, voxel=0.09, outline=None, smooth=8)
    # Flat deck: cut the top off.
    for v in hull.data.vertices:
        if v.co.z + hull.location.z > -0.6:
            v.co.z = -0.6 - hull.location.z
    add_outline(hull, OUTLINE * 1.6, INK)
    hull.rotation_euler = (0, math.radians(4), 0)
    select_only(hull)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    ink = flat_material("Planks", H("#3a2210"))
    for i in range(4):
        z = -1.2 - i * 0.75
        skin_tube(hull, f"Plank{i}", [(-12.5, z + 0.5), (0, z - 0.1), (12.5, z + 0.7)], ink, 0.05,
                  lift=0.0)
    ellipsoid("HullHole", on_skin(hull, 3.5, -2.6, 0.02), (1.6, 0.05, 1.0), dark,
              rot=(0, math.radians(15), 0))
    for i, x in enumerate((-8.0, -5.5, -3.0)):
        ellipsoid(f"Port{i}", on_skin(hull, x, -1.6, 0.02), (0.38, 0.05, 0.38), dark)
    box_mesh("Cabin", (-8.5, 0, 0.3), (5.0, 3.2, 2.0), wood, rot=(0, math.radians(4), 0))
    cylinder("Mast", (1.5, 0, 2.6), 0.28, 7.0, wood, rot=(0, math.radians(-14), 0))
    cylinder("Yard", (2.2, 0, 4.4), 0.16, 5.0, wood, rot=(0, math.radians(76), 0))
    # Torn square sail hanging from the yard.
    plate("Sail", [(0.3, 4.3), (4.2, 4.75), (3.9, 2.4), (3.3, 2.9), (2.7, 2.2), (2.0, 2.7), (1.2, 2.0),
                   (0.6, 2.5)], sail, thickness=0.08, y=-0.6, outline=OUTLINE, round_=False)
    cylinder("Bowsprit", (12.5, 0, 0.2), 0.18, 4.5, wood, rot=(0, math.radians(65), 0))
    for o in bpy.data.objects:
        o.location.z -= H2 - 6.0
    return None, 1


def lighthouse(w, h):
    H2 = h / 2
    red = toon_material("Red", H("#e8483d"))
    white = toon_material("White", H("#f5f5f0"))
    rock = toon_material("Base", H("#8a7a66"))
    glass = flat_material("Lamp", H("#fff3a0"), 2.0)
    roof = toon_material("Roof", H("#3b4a5a"))
    z = -H2 + 0.3
    blob("Rocks", [((0, 0, z), (1.9, 1.3, 0.5)), ((-1.0, 0, z + 0.1), (0.8, 0.8, 0.5))], rock,
         voxel=0.04)
    tower_h = 7.0
    n = 5
    for i in range(n):
        r0 = 1.25 - i * 0.12
        seg = tower_h / n
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=r0, radius2=r0 - 0.12, depth=seg,
                                        location=(0, 0, z + 0.4 + seg * (i + 0.5)))
        o = bpy.context.active_object
        o.name = f"Tower{i}"
        o.data.materials.append(red if i % 2 == 0 else white)
        bpy.ops.object.shade_smooth()
        add_outline(o, OUTLINE, INK)
    top = z + 0.4 + tower_h
    cylinder("Gallery", (0, 0, top + 0.08), 0.95, 0.18, roof)
    cylinder("Lamp", (0, 0, top + 0.6), 0.55, 0.9, glass, outline=0.04)
    cone("Roof", (0, 0, top + 1.35), 0.75, 0.75, roof, outline=OUTLINE)
    door = flat_material("Door", H("#3a2a1a"))
    ellipsoid("Door", (0, -1.2, z + 0.85), (0.3, 0.05, 0.5), door)
    return None, 1


def palm(w, h):
    H2 = h / 2
    trunk = toon_material("Trunk", H("#a87b4f"), spots=dict(color=H("#7c5634"), scale=6, size=0.25))
    leaf = toon_material("Frond", H("#3fae49"))
    nut = toon_material("Coconut", H("#6b4423"))
    pts = [(-0.9, 0, -H2 + 0.1), (-0.6, 0, -H2 + 2.5), (-0.15, 0, -H2 + 5.0), (0.35, 0, -H2 + 7.0)]
    tube("Trunk", pts, trunk, 0.32, outline=OUTLINE)
    cx, _, cz = pts[-1]
    for i, (dx, dz) in enumerate(((-2.3, -1.0), (-1.5, 0.5), (0.2, 0.9), (2.0, 0.3), (2.5, -1.1),
                                  (-0.6, -1.4))):
        plate(f"Frond{i}", [(cx, cz), (cx + dx * 0.45, cz + abs(dz) * 0.4 + 0.55),
                            (cx + dx, cz + dz), (cx + dx * 0.55, cz + dz * 0.3 + 0.1)],
              leaf, thickness=0.05, y=-0.1 + 0.05 * i, outline=0.045)
    for i, (dx, dy) in enumerate(((-0.2, -0.2), (0.2, -0.25), (0.0, -0.05))):
        ellipsoid(f"Nut{i}", (cx + dx, dy, cz - 0.25), (0.2, 0.2, 0.2), nut, outline=0.04)
    return None, 1


def column(w, h):
    H2 = h / 2
    stone = toon_material("Stone", H("#d8c7a0"), H("#b8a47c"), split=-2.0, soft=1.0,
                          spots=dict(color=H("#7fa86a"), scale=3, size=0.3, max_x=0.8))
    cylinder("Shaft", (0, 0, -H2 + 0.3 + 2.8), 0.62, 5.6, stone)
    box_mesh("Base", (0, 0, -H2 + 0.2), (1.8, 1.8, 0.4), stone)
    box_mesh("Capital", (0.1, 0, -H2 + 6.1), (1.7, 1.7, 0.35), stone, rot=(0, math.radians(-8), 0))
    ink = flat_material("Flute", H("#9a8762"))
    shaft = bpy.data.objects["Shaft"]
    for i, x in enumerate((-0.35, 0.0, 0.35)):
        skin_tube(shaft, f"Flute{i}", [(x, -H2 + 0.6), (x, -H2 + 5.6)], ink, 0.03, lift=0.0)
    return None, 1


def statue(w, h):
    H2 = h / 2
    stone = toon_material("Statue", H("#8f8a7f"), H("#6f6a60"), split=-1.2, soft=0.6,
                          spots=dict(color=H("#5f8f4a"), scale=2.5, size=0.3, min_z=0.5))
    head = blob("Head", [((0, 0, -H2 + 2.6), (1.25, 1.0, 2.3)), ((0.15, 0, -H2 + 4.2), (1.3, 1.0, 0.8)),
                         ((0.9, 0, -H2 + 2.4), (0.55, 0.6, 1.1))], stone, voxel=0.05, outline=None)
    for v in head.data.vertices:
        if v.co.z + head.location.z < -H2 + 0.05:
            v.co.z = -H2 + 0.05 - head.location.z
    add_outline(head, OUTLINE, INK)
    dark = flat_material("Shadow", H("#3f3a33"))
    for i, (x, z, sx, sz) in enumerate(((0.45, 3.3, 0.35, 0.18), (0.95, 1.6, 0.35, 0.08))):
        ellipsoid(f"Feature{i}", on_skin(head, x, -H2 + z, 0.0), (sx, 0.05, sz), dark)
    skin_tube(head, "Brow", [(-0.2, -H2 + 3.6), (0.5, -H2 + 3.75), (1.1, -H2 + 3.55)], dark, 0.06,
              lift=0.0)
    return None, 1


def ice_chunk(w, h):
    H2 = h / 2
    ice = toon_material("Ice", H("#cfeeff"), H("#9fd3f0"), split=-0.4, soft=0.3, shine=True)
    b = blob("Ice", [((0, 0, -H2 + 0.6), (1.7, 0.9, 0.65)), ((0.5, 0, -H2 + 1.0), (0.8, 0.7, 0.55),
                                                            (0, 0.3, 0.4))],
             ice, voxel=0.06, smooth=2, outline=None)
    add_outline(b, OUTLINE, H("#3a6a8a"))
    return None, 1


def icicle(w, h):
    H2 = h / 2
    ice = toon_material("Icicle", H("#dff4ff"), H("#a9dcf5"), split=0.0, soft=1.5, shine=True)
    for i, (x, length, r) in enumerate(((0.0, 3.6, 0.32), (-0.42, 2.2, 0.22), (0.4, 1.5, 0.18))):
        cone(f"Icicle{i}", (x, 0.05 * i, H2 - length / 2), r, length, ice, rot=(math.pi, 0, 0),
             outline=0.04)
    return None, 1


def igloo(w, h):
    H2 = h / 2
    snow = toon_material("Snow", H("#f4fbff"), H("#d6ecf7"), split=-1.0, soft=0.5)
    dome = blob("Dome", [((0, 0, -H2), (2.6, 2.0, 2.9))], snow, voxel=0.05, outline=None)
    for v in dome.data.vertices:
        if v.co.z + dome.location.z < -H2 + 0.05:
            v.co.z = -H2 + 0.05 - dome.location.z
    add_outline(dome, OUTLINE, H("#3a6a8a"))
    ink = flat_material("Block", H("#a9c9dc"))
    for i in range(3):
        z = -H2 + 0.7 + i * 0.75
        rr = math.sqrt(max(0.1, 1 - ((z + H2) / 2.9) ** 2)) * 2.5
        skin_tube(dome, f"Row{i}", [(-rr, z), (0, z + 0.05), (rr, z)], ink, 0.03, lift=0.0)
    door = flat_material("Door", H("#2b4a63"))
    ellipsoid("Door", on_skin(dome, 1.1, -H2 + 0.55, 0.02), (0.55, 0.05, 0.6), door)
    return None, 1


def skeleton(w, h):
    H2 = h / 2
    bone = toon_material("Bone", H("#f3ecd8"))
    z = -H2 + 0.6
    tube("Spine", [(-1.9, 0, z), (0, 0, z + 0.08), (1.6, 0, z)], bone, 0.07, outline=0.04)
    for i in range(7):
        x = -1.2 + i * 0.38
        tube(f"Rib{i}", [(x, 0, z + 0.55), (x - 0.12, 0, z), (x, 0, z - 0.45)], bone, 0.045,
             outline=0.03)
    skull = ellipsoid("Skull", (2.0, 0, z + 0.05), (0.55, 0.35, 0.42), bone, outline=0.045)
    dark = flat_material("Socket", H("#3a332a"))
    ellipsoid("Socket", on_skin(skull, 2.15, z + 0.12, 0.02), (0.13, 0.04, 0.13), dark)
    plate("TailBones", [(-1.9, z), (-2.45, z + 0.45), (-2.3, z), (-2.45, z - 0.4)], bone,
          thickness=0.05, outline=0.035, round_=False)
    for o in bpy.data.objects:
        o.location.x -= 0.25
    return None, 1


def vent(w, h):
    H2 = h / 2
    rock = toon_material("VentRock", H("#3b3236"), H("#2a2326"), split=-0.5, soft=0.5)
    glow = flat_material("Magma", H("#ff8a2a"), 2.5)
    b = blob("Chimney", [((0, 0, -H2 + 0.6), (0.95, 0.8, 0.65)), ((0.05, 0, -H2 + 1.6), (0.6, 0.55, 0.8)),
                         ((0.1, 0, -H2 + 2.6), (0.45, 0.42, 0.7))], rock, voxel=0.03, outline=None,
             displace=dict(scale=0.3, strength=0.1))
    add_outline(b, OUTLINE, INK)
    ellipsoid("Mouth", (0.1, 0, -H2 + 3.25), (0.32, 0.32, 0.12), glow, outline=0.03)
    for i, (x, z) in enumerate(((-0.3, 1.2), (0.35, 1.9), (-0.1, 2.4))):
        ellipsoid(f"Crack{i}", on_skin(b, x, -H2 + z, 0.0), (0.07, 0.03, 0.18), glow)
    return None, 1


def clam(w, h):
    H2 = h / 2
    shell_m = toon_material("Clam", H("#4fb3a9"), H("#2f8f86"), split=-0.4, soft=0.3)
    lip = toon_material("Mantle", H("#7b5cff"), spots=dict(color=H("#b9a8ff"), scale=10, size=0.2))
    pearl = toon_material("Pearl", H("#ffffff"), shine=True)
    lower = blob("Lower", [((0, 0, -H2 + 0.45), (1.5, 0.95, 0.5))], shell_m, voxel=0.03, outline=None)
    add_outline(lower, OUTLINE, INK)
    upper = ellipsoid("Upper", (-0.25, 0.1, -H2 + 1.15), (1.35, 0.85, 0.32), shell_m,
                      rot=(0, math.radians(-25), 0), outline=OUTLINE)
    del upper
    ellipsoid("Mantle", (0.15, -0.2, -H2 + 0.85), (1.15, 0.5, 0.18), lip, outline=0.04)
    ellipsoid("Pearl", (0.25, -0.45, -H2 + 0.98), (0.2, 0.2, 0.2), pearl, outline=0.035)
    return None, 1


# ---------------------------------------------------------------------------------------
# Pickups (centre-anchored like the placeholders)
# ---------------------------------------------------------------------------------------

def chest(w, h, open_=False):
    wood = toon_material("ChestWood", H("#a0612a"), H("#7a4519"), split=-0.3, soft=0.2)
    gold = toon_material("ChestGold", H("#ffcf3c"), shine=True)
    box_mesh("Box", (0, 0, -0.25), (1.85, 1.1, 0.95), wood)
    if open_:
        lid = box_mesh("Lid", (-0.45, 0.25, 0.75), (1.85, 1.1, 0.35), wood, rot=(0, math.radians(-70), 0))
        del lid
        coins = toon_material("Coins", H("#ffd84a"), shine=True)
        blob("Treasure", [((0, 0, 0.2), (0.8, 0.45, 0.25)), ((0.2, 0, 0.35), (0.4, 0.3, 0.2))], coins,
             voxel=0.03)
    else:
        lid = blob("Lid", [((0, 0, 0.32), (0.95, 0.56, 0.32))], wood, voxel=0.025, outline=None)
        for v in lid.data.vertices:
            if v.co.z + lid.location.z < 0.22:
                v.co.z = 0.22 - lid.location.z
        add_outline(lid, OUTLINE, INK)
    for i, x in enumerate((-0.6, 0.6)):
        box_mesh(f"Strap{i}", (x, -0.02, -0.1), (0.16, 1.16, 1.0), gold, outline=0.035, bevel=0.02)
    box_mesh("Lock", (0, -0.58, 0.05), (0.32, 0.12, 0.36), gold, outline=0.035, bevel=0.02)
    return None, 1


def mine(w, h):
    iron = toon_material("Mine", H("#3c4650"), H("#2a3138"), split=-0.4, soft=0.3)
    red = flat_material("MineLight", H("#ff3b30"), 2.0)
    ellipsoid("Ball", (0, 0, 0), (0.78, 0.78, 0.78), iron, outline=OUTLINE)
    for i in range(10):
        t = TAU * i / 10
        d = (math.cos(t), -0.3 if i % 2 else 0.3, math.sin(t))
        n = math.sqrt(sum(c * c for c in d))
        d = tuple(c / n for c in d)
        c = cylinder(f"Horn{i}", tuple(c * 0.82 for c in d), 0.08, 0.32, iron, outline=0.035)
        from mathutils import Vector
        c.rotation_euler = Vector((0, 0, 1)).rotation_difference(Vector(d)).to_euler()
        select_only(c)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    ellipsoid("Light", (0, -0.62, 0.35), (0.14, 0.1, 0.14), red, outline=0.03)
    return None, 1


def coin(w, h):
    gold = toon_material("Gold", H("#ffcc33"), shine=True)
    star = toon_material("Star", H("#ffe680"), shine=True)
    cylinder("Coin", (0, 0, 0), 0.44, 0.12, gold, rot=(math.pi / 2, 0, 0), outline=0.04)
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = 0.26 if i % 2 == 0 else 0.11
        pts.append((math.cos(a) * r, math.sin(a) * r))
    plate("Star", pts, star, thickness=0.04, y=-0.09, outline=0.02, round_=False)
    return None, 1


def magnet(w, h):
    bubble = toon_material("Bubble", H("#bfe9ff"), glow=(0.05, 0.08, 0.1))
    red = toon_material("MagnetRed", H("#ff4d4d"))
    steel = toon_material("Steel", H("#e6eef4"), shine=True)
    ellipsoid("Bubble", (0, 0.3, 0), (0.62, 0.3, 0.62), bubble, outline=0.04)
    tube("Horseshoe", [(-0.25, -0.1, -0.1), (-0.25, -0.1, 0.18), (0, -0.1, 0.35), (0.25, -0.1, 0.18),
                       (0.25, -0.1, -0.1)], red, 0.1, outline=0.03)
    for i, x in enumerate((-0.25, 0.25)):
        cylinder(f"Tip{i}", (x, -0.1, -0.2), 0.1, 0.16, steel, outline=0.025)
    return None, 1


# key -> (builder, design size, px per du)
DECOR = {
    "decor-kelp": (kelp, (60, 260), 3),
    "decor-seaweed": (seaweed, (60, 80), 3),
    "decor-coral-branch": (coral_branch, (90, 90), 3),
    "decor-coral-brain": (coral_brain, (80, 56), 3),
    "decor-coral-fan": (coral_fan, (90, 100), 3),
    "decor-anemone": (anemone, (64, 60), 3),
    "decor-boulder": (boulder, (120, 80), 3),
    "decor-starfish": (starfish, (40, 30), 3),
    "decor-shell": (shell, (36, 30), 3),
    "decor-urchin": (urchin, (40, 34), 3),
    "decor-anchor": (anchor, (80, 100), 3),
    "decor-barrel": (barrel, (50, 60), 3),
    "decor-shipwreck": (shipwreck, (900, 360), 2),
    "decor-lighthouse": (lighthouse, (140, 300), 3),
    "decor-palm": (palm, (180, 260), 3),
    "decor-column": (column, (70, 220), 3),
    "decor-statue": (statue, (130, 160), 3),
    "decor-ice-chunk": (ice_chunk, (120, 80), 3),
    "decor-icicle": (icicle, (40, 120), 3),
    "decor-igloo": (igloo, (160, 100), 3),
    "decor-skeleton": (skeleton, (140, 60), 3),
    "decor-vent": (vent, (80, 120), 3),
    "decor-clam": (clam, (90, 60), 3),
    "item-chest": (chest, (64, 52), 3),
    "item-chest-open": (lambda w, h: chest(w, h, True), (64, 52), 3),
    "hazard-mine": (mine, (68, 68), 3),
    "item-coin": (coin, (30, 30), 3),
    "item-magnet": (magnet, (40, 40), 3),
}


def render_decor(key):
    builder, size, px = DECOR[key]
    clear_scene()
    w, h = size[0] / DU_PER_BU, size[1] / DU_PER_BU
    pose, frames = builder(w, h)
    setup_render(*size, px=px)
    poser = Poser((0.0, 0.0))

    class Frames:
        def apply(self, phase):
            if pose:
                poser.apply(lambda name, p: pose(name, p, phase))
            else:
                bpy.context.view_layer.update()

    poses = [dict(phase=TAU * i / frames) for i in range(frames)]
    return render_frames(Frames(), poses, os.path.join(OUT_DIR, f"{key}-sheet.png"),
                         2 if frames > 1 else 1)


only = [s for s in globals().get("ONLY", "").split(",") if s]
keys = [k for k in DECOR if not only or any(o in k for o in only)]
result = {k: render_decor(k)["frame"] for k in keys}
