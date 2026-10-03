# Builds the map decorations (coral, kelp, wrecks, landmarks, beach props, edge clusters...)
# and pickups (chest, mine, coin, magnet orb) in Blender and renders a sheet for each. Swaying
# plants get 4 frames; edge clusters and huts are variant sheets (one look per frame); everything
# else is a single frame.
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


# ---------------------------------------------------------------------------------------
# Fishing boats and what they throw (centre-anchored, the boat sits on the water line)
# ---------------------------------------------------------------------------------------

def profile_solid(name, pts, half_width, mat, bevel=0.16):
    """A solid from a side profile [(x, z), ...] extruded across the view (hulls)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = half_width
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for pt, (x, z) in zip(sp.points, pts):
        pt.co = (x, z, 0, 1)
    sp.use_cyclic_u = True
    cu.materials.append(mat)
    obj = link(bpy.data.objects.new(name, cu))
    obj.rotation_euler = (math.pi / 2, 0, 0)
    select_only(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    return obj


def boat(w, h):
    """Fishing boat facing right with a fisherman at the stern, harpoon raised. The keel sits
    at 94% of the frame height (the game's origin) and the water line at ~77%."""
    H2 = h / 2
    keel = H2 - 0.94 * h
    deck = keel + 2.15
    hull_m = toon_material("Hull", H("#d2463a"), H("#9e2d2b"), split=keel + 1.0, soft=0.25)
    cream = toon_material("Cream", H("#f2e6d0"))
    blue = toon_material("Roof", H("#3b6fa8"))
    wood = toon_material("Wood", H("#a0652e"))
    glass = flat_material("Glass", H("#7fd6f2"), 1.1)
    # Hull from its side profile: square transom at the stern, a raked bow, sheer rising forward.
    bottom = []
    for i in range(13):
        u = i / 12
        x = -4.3 + u * 8.7
        z = keel + 0.55 * max(0.0, (x - 1.8) / 2.6) ** 2 + 0.35 * max(0.0, (-3.2 - x) / 1.1) ** 2
        bottom.append((x, z))
    sheer = [(5.75, deck + 0.8), (4.6, deck + 0.42), (3.0, deck + 0.18), (0.5, deck + 0.04), (-2.5, deck + 0.04),
             (-4.95, deck + 0.18)]
    hull = profile_solid("Hull", [(-4.75, keel + 0.75)] + bottom + [(5.0, keel + 1.2), (5.45, deck - 0.2)] + sheer,
                         1.05, hull_m)
    add_outline(hull, OUTLINE * 1.3, INK)
    skin_tube(hull, "Stripe", [(-4.85, deck - 0.3), (-2.0, deck - 0.36), (1.0, deck - 0.36), (3.6, deck - 0.18),
                               (5.45, deck + 0.3)], cream, 0.11, lift=0.0)
    box_mesh("Deck", (0.0, 0, deck + 0.02), (9.4, 2.1, 0.12), wood, bevel=0.03)
    # Wheelhouse.
    box_mesh("Cabin", (-0.6, 0, deck + 1.05), (2.8, 2.0, 1.9), cream, bevel=0.08)
    box_mesh("CabinRoof", (-0.6, 0, deck + 2.08), (3.3, 2.4, 0.26), blue, bevel=0.08)
    for i, x in enumerate((-1.3, 0.1)):
        box_mesh(f"Window{i}", (x, -1.02, deck + 1.35), (0.9, 0.06, 0.65), glass, outline=0.03, bevel=0.03)
    cylinder("Funnel", (-1.5, 0, deck + 2.6), 0.22, 0.9, blue)
    ring_m = toon_material("Buoy", H("#ff7a2e"))
    torus("Lifebuoy", (0.9, -1.08, deck + 0.75), 0.36, 0.11, ring_m, rot=(math.pi / 2, 0, 0))
    # Mast with a boom out over the bow and a bundled net hanging from it.
    cylinder("Mast", (2.4, 0, deck + 2.1), 0.13, 4.2, wood)
    cylinder("Boom", (3.85, 0, deck + 3.2), 0.08, 3.4, wood, rot=(0, math.radians(62), 0))
    tube("Line", [(5.3, -0.1, deck + 3.95), (5.32, -0.1, deck + 2.5), (5.3, -0.1, deck + 1.05)],
         flat_material("Rope", H("#5a4630")), 0.025)
    net_m = toon_material("Bundle", H("#6fa86a"), spots=dict(color=H("#3f6e3c"), scale=9, size=0.25))
    ellipsoid("NetBundle", (5.3, -0.1, deck + 0.75), (0.45, 0.4, 0.42), net_m, outline=OUTLINE)
    # The fisherman: yellow oilskins and sou'wester, beard, harpoon up.
    coat = toon_material("Coat", H("#f2c94c"), H("#d9a92a"), split=deck + 0.6, soft=0.2)
    skin = toon_material("Skin", H("#f1b68f"))
    beard = toon_material("Beard", H("#8a5a3a"))
    fx = -3.55
    body = blob("Fisher", [((fx, 0, deck + 0.75), (0.55, 0.45, 0.75)), ((fx, 0, deck + 1.35), (0.45, 0.4, 0.35))],
                coat, voxel=0.03, outline=None)
    add_outline(body, OUTLINE, INK)
    head = ellipsoid("Head", (fx + 0.05, 0, deck + 1.98), (0.47, 0.44, 0.46), skin, outline=OUTLINE)
    ellipsoid("Beard", (fx + 0.2, -0.1, deck + 1.68), (0.27, 0.3, 0.2), beard, outline=0.03)
    ellipsoid("Hat", (fx, 0, deck + 2.32), (0.6, 0.55, 0.16), coat, outline=OUTLINE)
    ellipsoid("HatTop", (fx + 0.02, 0, deck + 2.45), (0.38, 0.36, 0.24), coat, outline=OUTLINE)
    cartoon_eye(head, "Eye", fx + 0.26, deck + 2.08, 0.1, pupil=0.7, look=(0.3, 0.0))
    ellipsoid("Nose", on_skin(head, fx + 0.42, deck + 1.9, 0.02), (0.11, 0.08, 0.09), skin, outline=0.03)
    # Arm up holding the harpoon, which points forward and up.
    tube("Arm", [(fx + 0.25, -0.35, deck + 1.35), (fx + 0.6, -0.4, deck + 1.75), (fx + 0.75, -0.42, deck + 2.25)],
         coat, 0.13, outline=0.04)
    ellipsoid("Hand", (fx + 0.78, -0.45, deck + 2.32), (0.15, 0.13, 0.15), skin, outline=0.03)
    shaft_from = (fx - 0.6, -0.5, deck + 1.55)
    shaft_to = (fx + 2.0, -0.5, deck + 3.05)
    tube("Shaft", [shaft_from, ((shaft_from[0] + shaft_to[0]) / 2, -0.5, (shaft_from[2] + shaft_to[2]) / 2),
                   shaft_to], wood, 0.05, outline=0.03)
    steel = toon_material("Steel", H("#c8d0d8"), shine=True)
    ang = math.atan2(shaft_to[2] - shaft_from[2], shaft_to[0] - shaft_from[0])
    cone("Tip", (shaft_to[0] + 0.18 * math.cos(ang), -0.5, shaft_to[2] + 0.18 * math.sin(ang)), 0.1, 0.42, steel,
         rot=(0, math.pi / 2 - ang, 0), outline=0.03)
    return None, 1


def net(w, h):
    """A square fishing net with orange floats along the top, sagging a little."""
    rope = toon_material("Rope", H("#e8d6b0"))
    float_m = toon_material("Float", H("#ff8a2e"))
    s = min(w, h) / 2 - 0.35
    n = 6
    for i in range(n + 1):
        t = -s + 2 * s * i / n
        sag = 0.12 * math.sin(math.pi * i / n)
        tube(f"V{i}", [(t, 0, s), (t + 0.08, 0, 0), (t, 0, -s + sag)], rope, 0.035, outline=0.025)
        tube(f"H{i}", [(-s, 0, t), (0, 0, t - 0.1 - sag), (s, 0, t)], rope, 0.035, outline=0.025)
    for i, x in enumerate((-s, -s / 3, s / 3, s)):
        ellipsoid(f"Float{i}", (x, -0.05, s), (0.2, 0.2, 0.2), float_m, outline=0.035)
    lead = toon_material("Lead", H("#5a6470"))
    for i, x in enumerate((-s, s)):
        ellipsoid(f"Weight{i}", (x, -0.05, -s), (0.15, 0.15, 0.15), lead, outline=0.03)
    return None, 1


def harpoon(w, h):
    """A harpoon pointing right: wooden shaft, barbed steel head, rope loop at the back."""
    W2 = w / 2
    wood = toon_material("Shaft", H("#a0652e"))
    steel = toon_material("Steel", H("#c8d0d8"), shine=True)
    cylinder("Shaft", (-0.35, 0, 0), 0.06, w - 1.2, wood, rot=(0, math.pi / 2, 0), outline=0.035)
    cone("Head", (W2 - 0.38, 0, 0), 0.15, 0.55, steel, rot=(0, math.pi / 2, 0), outline=0.035)
    for sgn in (-1, 1):
        cone(f"Barb{sgn}", (W2 - 0.72, 0, sgn * 0.13), 0.06, 0.32, steel,
             rot=(0, -math.pi / 2 + sgn * 0.6, 0), outline=0.025)
    torus("Loop", (-W2 + 0.3, 0, 0), 0.16, 0.04, toon_material("Rope", H("#5a4630")),
          rot=(math.pi / 2, 0, 0))
    return None, 1


def crate(w, h):
    """A wooden fish crate with fish tails sticking out of the top."""
    H2 = h / 2
    wood = toon_material("Crate", H("#b07a3e"), H("#8a5a28"), split=-0.3, soft=0.2)
    box_mesh("Box", (0, 0, -0.12), (w - 0.25, 1.0, h - 0.5), wood, bevel=0.05)
    ink = flat_material("Slat", H("#4a2c10"))
    for i, z in enumerate((-0.35, 0.12)):
        box_mesh(f"Slat{i}", (0, -0.52, z), (w - 0.35, 0.04, 0.05), ink, outline=None, bevel=0.0)
    fish_m = toon_material("Fish", H("#8fb8d4"), H("#e8f4fa"), split=0.0, soft=0.05)
    for i, (x, tilt) in enumerate(((-0.28, 0.45), (0.25, -0.35))):
        # Body standing up out of the crate, head on top, leaning outward.
        fish = ellipsoid(f"Fish{i}", (x, -0.15, H2 - 0.45), (0.13, 0.12, 0.3), fish_m, rot=(0, tilt, 0),
                         outline=0.03)
        ex = x - 0.11 * math.sin(tilt) + 0.04
        ellipsoid(f"FishEye{i}", on_skin(fish, ex, H2 - 0.3, 0.01), (0.045, 0.02, 0.045),
                  flat_material(f"FishPupil{i}", H("#10161c")))
    return None, 1


# ---------------------------------------------------------------------------------------
# Edge props: clusters set into the terrain's contour (any angle) to break its smooth
# outline. Variant sheets: each frame is a different arrangement, not an animation.
# Rocks and ice are light and neutral so the game can tint them to the map.
# ---------------------------------------------------------------------------------------

def stripes(obj, mats, n, axis=(0, 1)):
    """Alternating materials around the object's local Z axis (umbrella canopy, beach ball)."""
    for m in mats[1:]:
        obj.data.materials.append(m)
    for poly in obj.data.polygons:
        c = poly.center
        a = math.atan2(c[axis[1]], c[axis[0]])
        poly.material_index = int((a + math.pi) / (2 * math.pi) * n) % len(mats)


ROCK_SETS = [
    [(-0.70, 0.0, 1.00, 0.85), (0.75, 0.0, 0.75, 0.62), (0.05, -0.35, 0.45, 0.36)],
    [(-1.20, 0.0, 0.62, 0.55), (0.00, 0.0, 0.85, 0.78), (1.20, 0.0, 0.60, 0.50)],
    [(-0.25, 0.0, 1.60, 0.58), (1.25, -0.25, 0.52, 0.42)],
    [(0.00, 0.0, 0.70, 1.15), (-0.95, -0.2, 0.55, 0.50), (0.92, 0.1, 0.46, 0.42)],
]


def edge_rocks(w, h, v):
    H2 = h / 2
    m = toon_material("EdgeRock", H("#e2dbcf"), H("#b9af9f"), split=-H2 + 0.55, soft=0.3,
                      spots=dict(color=H("#a49a8b"), scale=3.2, size=0.18))
    rng = np.random.default_rng(40 + v)
    for i, (x, y, rx, rz) in enumerate(ROCK_SETS[v]):
        # Faceted stone: a jittered low-poly ball, flat shaded so each face catches the light.
        z = -H2 + rz * 0.8
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(x, y, z))
        b = bpy.context.active_object
        b.name = f"Rock{i}"
        for vert in b.data.vertices:
            vert.co *= 1.0 + rng.uniform(-0.16, 0.12)
            if vert.co.z > 0.55:
                vert.co.z = 0.55 + (vert.co.z - 0.55) * 0.4
        b.scale = (rx, 0.75 * rx, rz)
        b.rotation_euler = (0, rng.uniform(-0.25, 0.25), rng.uniform(0, math.pi))
        b.data.materials.append(m)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        bpy.ops.object.shade_flat()
        add_outline(b, OUTLINE, INK)
    return None, 1


def coral_dome(name, x, r, color, groove):
    H2 = CORAL_H2
    m = toon_material(name, H(color), spots=dict(color=H(groove), scale=7, size=0.2))
    b = blob(name, [((x, 0, -H2 + r * 0.55), (r, r * 0.8, r * 0.75))], m, voxel=0.025, outline=None)
    add_outline(b, OUTLINE, INK)


def coral_twig(name, x, height, color, tip):
    H2 = CORAL_H2
    m = toon_material(name, H(color))
    tm = toon_material(name + "Tip", H(tip))
    z0 = -H2
    arms = [[(x, z0), (x + 0.02, z0 + height * 0.45), (x - 0.3, z0 + height * 0.75), (x - 0.42, z0 + height)],
            [(x + 0.02, z0 + height * 0.45), (x + 0.3, z0 + height * 0.7), (x + 0.4, z0 + height * 0.92)],
            [(x - 0.05, z0 + height * 0.6), (x + 0.02, z0 + height * 0.85), (x + 0.0, z0 + height * 1.05)]]
    for i, a in enumerate(arms):
        tube(f"{name}{i}", [(px, 0, pz) for px, pz in a], m, 0.09 - 0.012 * i, outline=0.045)
        ellipsoid(f"{name}T{i}", (a[-1][0], 0, a[-1][1]), (0.1, 0.1, 0.1), tm, outline=0.035)


def coral_tubes(name, x, n, color, inner):
    H2 = CORAL_H2
    m = toon_material(name, H(color))
    dark = flat_material(name + "Hole", H(inner))
    heights = (1.15, 0.7, 0.95, 0.6)
    for i in range(n):
        lean = (i - (n - 1) / 2) * 0.22
        hh = heights[i % 4]
        hx = x + (i - (n - 1) / 2) * 0.26
        top = (hx + math.sin(lean) * hh, -0.06 * i, -H2 + math.cos(lean) * hh)
        tube(f"{name}{i}", [(hx, -0.06 * i, -H2), ((hx + top[0]) / 2, -0.06 * i, (top[2] - H2) / 2), top], m, 0.15,
             outline=0.045)
        torus(f"{name}L{i}", top, 0.14, 0.05, m, rot=(0, lean, 0), outline=0.03)
        ellipsoid(f"{name}H{i}", (top[0], top[1], top[2] + 0.02), (0.1, 0.1, 0.03), dark)


def coral_fan_small(name, x, size, color, vein):
    H2 = CORAL_H2
    m = toon_material(name, H(color), spots=dict(color=H(vein), scale=12, size=0.2))
    s = size
    pts = [(x, -H2 + 0.05)]
    for k in range(11):
        a = math.radians(160 - k * 14)
        r = (1.55 if k % 2 == 0 else 1.38) * s
        pts.append((x + math.cos(a) * r * 0.62, -H2 + 0.15 + math.sin(a) * r))
    plate(name, pts, m, thickness=0.05, y=0.15, outline=0.045, round_=False)
    ink = flat_material(name + "Vein", H(vein))
    for k, a in enumerate((140, 112, 90, 68, 40)):
        r = math.radians(a)
        tube(f"{name}V{k}", [(x, 0.08, -H2 + 0.1), (x + math.cos(r) * 0.85 * s * 0.62, 0.08,
                                                   -H2 + 0.15 + math.sin(r) * 1.3 * s)], ink, 0.02)


CORAL_H2 = 80 / DU_PER_BU / 2
CORAL_SETS = [
    [("dome", -0.85, 0.62, "#f4a63a", "#c9761f"), ("twig", 0.35, 1.5, "#ff6f91", "#ffd0dc"),
     ("tubes", 1.35, 3, "#9b5de5", "#3b1a63")],
    [("fan", -0.55, 1.0, "#9b5de5", "#c9a7ff"), ("dome", 0.75, 0.55, "#ffd34d", "#d9a52a"),
     ("twig", -1.45, 1.1, "#ff8a5b", "#ffd6c2")],
    [("tubes", -1.0, 3, "#ffd34d", "#6a4a10"), ("twig", 0.15, 1.7, "#4fc3f7", "#d6f3ff"),
     ("dome", 1.2, 0.5, "#ff6f91", "#c94a6a")],
    [("twig", -0.45, 1.8, "#ff8a5b", "#ffe0d0"), ("fan", 0.95, 0.85, "#ff6f91", "#ffc2d1"),
     ("dome", -1.45, 0.48, "#7cc35a", "#4e8f36")],
]


def edge_coral(w, h, v):
    for i, (kind, x, a, color, b) in enumerate(CORAL_SETS[v]):
        name = f"C{i}"
        x *= 0.75
        if kind == "dome":
            coral_dome(name, x, a, color, b)
        elif kind == "twig":
            coral_twig(name, x, a, color, b)
        elif kind == "tubes":
            coral_tubes(name, x, int(a), color, b)
        else:
            coral_fan_small(name, x, a, color, b)
    return None, 1


ICE_SETS = [
    [(-0.6, 1.7, -0.25), (0.15, 2.3, 0.05), (0.85, 1.4, 0.35), (-1.25, 0.9, -0.5)],
    [(-0.9, 1.2, -0.4), (0.0, 1.6, 0.15), (0.9, 1.9, 0.3)],
    [(0.0, 2.5, 0.0), (-0.75, 1.3, -0.45), (0.8, 1.1, 0.5), (1.35, 0.7, 0.7)],
    [(-1.1, 1.5, -0.3), (-0.3, 1.0, -0.1), (0.5, 1.8, 0.2), (1.2, 1.2, 0.45)],
]


def edge_ice(w, h, v):
    H2 = h / 2
    m = toon_material("Ice", H("#f2fbff"), H("#a9daf2"), split=-H2 + 0.6, soft=0.35)
    hi = flat_material("IceShine", H("#ffffff"), 1.25)
    for i, (x, length, lean) in enumerate(ICE_SETS[v]):
        r = 0.22 + 0.09 * length
        base = (x, 0.1 * i - 0.2, -H2 + 0.05)
        d = (math.sin(lean), 0, math.cos(lean))
        obj = cone(f"Shard{i}", (base[0] + d[0] * length / 2, base[1], base[2] + d[2] * length / 2), r, length, m,
                   rot=(0, lean, 0), verts=6)
        bpy.ops.object.shade_flat()
        add_outline(obj, 0.05, INK)
        tube(f"Glint{i}", [(base[0] - r * 0.4 + d[0] * length * 0.15, base[1] - r - 0.02, base[2] + length * 0.2),
                           (base[0] - r * 0.15 + d[0] * length * 0.6, base[1] - r * 0.5 - 0.02,
                            base[2] + d[2] * length * 0.6)], hi, 0.025)
    return None, 1


# ---------------------------------------------------------------------------------------
# Beach props (ground decor, bottom-centre anchored)
# ---------------------------------------------------------------------------------------

def umbrella(w, h):
    """Striped beach umbrella over a towel, with a beach ball."""
    H2 = h / 2
    pole_m = toon_material("Pole", H("#f5f5f0"))
    red = toon_material("CanopyRed", H("#ef4b3f"))
    white = toon_material("CanopyWhite", H("#fbf6ec"))
    tilt = math.radians(-8)
    foot = 0.1
    top = (foot + 4.2 * math.sin(-tilt), -H2 + 4.2 * math.cos(tilt))
    tube("Pole", [(foot, 0, -H2 - 0.1), ((foot + top[0]) / 2, 0, (top[1] - H2) / 2), (top[0], 0, top[1])], pole_m,
         0.07, outline=0.04)
    # Canopy: the top of a squashed sphere, striped in wedges.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0, location=(0, 0, 0))
    can = bpy.context.active_object
    can.name = "Canopy"
    bm_verts = can.data.vertices
    for vert in bm_verts:
        if vert.co.z < 0.15:
            vert.co.z = 0.15
    can.data.materials.append(red)
    stripes(can, [red, white], 8)
    can.scale = (2.0, 2.0, 1.0)
    can.location = (top[0] + 0.0, 0, top[1] - 0.6)
    can.rotation_euler = (0, tilt, 0)
    bpy.ops.object.shade_smooth()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    add_outline(can, 0.06, INK)
    ellipsoid("Knob", (top[0] + 0.12, 0, top[1] + 0.42), (0.12, 0.12, 0.12), red, outline=0.03)
    towel = toon_material("Towel", H("#3b9be0"))
    box_mesh("Towel", (-1.1, -0.2, -H2 + 0.06), (2.0, 1.2, 0.07), towel, outline=0.035, bevel=0.02)
    ink = flat_material("TowelStripe", H("#fbf6ec"))
    for i, x in enumerate((-1.7, -0.5)):
        box_mesh(f"TowelStripe{i}", (x, -0.81, -H2 + 0.05), (0.2, 0.02, 0.06), ink, outline=None, bevel=0.0)
    ball_m = [toon_material("BallR", H("#ef4b3f")), toon_material("BallW", H("#fbf6ec")),
              toon_material("BallB", H("#3b9be0")), toon_material("BallY", H("#ffd34d"))]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.38, location=(1.55, -0.4, -H2 + 0.37))
    ball = bpy.context.active_object
    ball.name = "Ball"
    ball.data.materials.append(ball_m[0])
    stripes(ball, ball_m, 6, axis=(0, 2))
    bpy.ops.object.shade_smooth()
    add_outline(ball, 0.035, INK)
    return None, 1


def sandcastle(w, h):
    H2 = h / 2
    sand = toon_material("Castle", H("#f0d595"), H("#d9b56e"), split=-H2 + 0.3, soft=0.25,
                         spots=dict(color=H("#c9a25a"), scale=14, size=0.12))
    mound = blob("Mound", [((0, 0, -H2 + 0.1), (1.55, 0.95, 0.32))], sand, voxel=0.025, outline=None)
    add_outline(mound, OUTLINE, INK)
    box_mesh("Keep", (0, 0, -H2 + 0.75), (1.1, 0.85, 0.85), sand, bevel=0.06)
    for i, x in enumerate((-0.42, 0.0, 0.42)):
        box_mesh(f"Merlon{i}", (x, -0.2, -H2 + 1.27), (0.22, 0.4, 0.2), sand, outline=0.035, bevel=0.03)
    for i, x in enumerate((-0.92, 0.92)):
        cylinder(f"Tower{i}", (x, 0, -H2 + 0.75), 0.32, 1.25, sand, outline=OUTLINE, verts=24)
        cone(f"Spire{i}", (x, 0, -H2 + 1.62), 0.36, 0.5, sand, outline=0.045)
    door = flat_material("Door", H("#8a6a3a"))
    ellipsoid("Door", (0, -0.45, -H2 + 0.42), (0.18, 0.04, 0.24), door)
    tube("Stick", [(0, 0, -H2 + 1.2), (0, 0, -H2 + 1.75), (0.0, 0, -H2 + 2.25)],
         toon_material("Stick", H("#a0652e")), 0.03, outline=0.025)
    plate("Flag", [(0.02, -H2 + 2.25), (0.55, -H2 + 2.08), (0.02, -H2 + 1.9)], toon_material("Flag", H("#ef4b3f")),
          thickness=0.03, outline=0.03, round_=False)
    return None, 1


def lifeguard(w, h):
    """Lifeguard tower on stilts: yellow hut, red roof, ladder, flag."""
    H2 = h / 2
    wood = toon_material("Stilt", H("#f5f5f0"))
    hut = toon_material("Hut", H("#ffd34d"), H("#e8b52a"), split=-H2 + 4.6, soft=0.3)
    roof = toon_material("Roof", H("#e8483d"))
    deck = -H2 + 4.0
    for i, (x, y) in enumerate(((-1.25, -0.8), (1.25, -0.8), (-1.25, 0.8), (1.25, 0.8))):
        tube(f"Leg{i}", [(x * 1.25, y, -H2 - 0.05), (x * 1.12, y, -H2 + 2.0), (x, y, deck)], wood, 0.11,
             outline=0.04)
    tube("Brace0", [(-1.5, -0.85, -H2 + 0.9), (0.0, -0.85, -H2 + 2.4), (1.4, -0.85, deck - 0.2)], wood, 0.06,
         outline=0.035)
    box_mesh("Deck", (0, 0, deck), (3.4, 2.2, 0.22), wood, bevel=0.04)
    box_mesh("Hut", (0, 0.1, deck + 1.0), (2.6, 1.9, 1.8), hut, bevel=0.06)
    glass = flat_material("Glass", H("#7fd6f2"), 1.1)
    box_mesh("Window", (0.2, -0.86, deck + 1.2), (1.5, 0.06, 0.8), glass, outline=0.03, bevel=0.03)
    roof_obj = profile_solid("Roof", [(-1.75, deck + 1.85), (1.75, deck + 1.85), (0.0, deck + 2.75)], 1.2, roof,
                             bevel=0.08)
    add_outline(roof_obj, OUTLINE, INK)
    rail = toon_material("Rail", H("#f5f5f0"))
    box_mesh("Rail", (0, -1.05, deck + 0.45), (3.4, 0.08, 0.1), rail, outline=0.03, bevel=0.02)
    for i, x in enumerate((-1.6, -0.55, 0.55, 1.6)):
        box_mesh(f"Post{i}", (x, -1.05, deck + 0.22), (0.08, 0.08, 0.5), rail, outline=0.03, bevel=0.01)
    # Ladder down the front.
    for i, x in enumerate((0.85, 1.35)):
        tube(f"LadderRail{i}", [(x, -1.2, deck + 0.1), (x + 0.55, -1.2, -H2 + 0.1)], wood, 0.05, outline=0.03)
    for i in range(6):
        u = (i + 0.5) / 6
        z = deck + 0.1 + u * (-H2 + 0.1 - deck - 0.1)
        tube(f"Rung{i}", [(0.85 + 0.55 * u, -1.22, z), (1.35 + 0.55 * u, -1.22, z)], wood, 0.035, outline=0.025)
    tube("FlagPole", [(-1.2, 0.2, deck + 2.3), (-1.2, 0.2, deck + 3.2), (-1.2, 0.2, deck + 3.9)], wood, 0.04,
         outline=0.03)
    plate("Flag", [(-1.18, deck + 3.9), (-0.25, deck + 3.65), (-1.18, deck + 3.35)], roof, thickness=0.03,
          y=0.2, outline=0.03, round_=False)
    torus("Lifebuoy", (-0.95, -0.98, deck + 1.0), 0.32, 0.1, toon_material("Buoy", H("#ff7a2e")),
          rot=(math.pi / 2, 0, 0))
    return None, 1


def hut(w, h, v):
    """Wooden beach hut on short stilts. Variant 0: straw roof; 1: snow on the roof."""
    H2 = h / 2
    wood = toon_material("Planks", H("#b07a3e"), H("#8a5a28"), split=-H2 + 1.6, soft=0.4)
    post = toon_material("Post", H("#7a4b2a"))
    floor = -H2 + 0.9
    for i, x in enumerate((-2.4, -0.8, 0.8, 2.4)):
        cylinder(f"Stilt{i}", (x, -0.9, -H2 + 0.4), 0.13, 1.0, post, outline=0.04, verts=16)
    box_mesh("Floor", (0, 0, floor), (5.8, 2.6, 0.25), post, bevel=0.04)
    box_mesh("Walls", (0.0, 0.1, floor + 1.45), (4.4, 2.2, 2.7), wood, bevel=0.06)
    ink = flat_material("Seam", H("#5a3410"))
    for i in range(5):
        z = floor + 0.45 + i * 0.5
        box_mesh(f"Seam{i}", (0.0, -1.02, z), (4.3, 0.02, 0.035), ink, outline=None, bevel=0.0)
    door = toon_material("Door", H("#3b6fa8"))
    box_mesh("Door", (-1.0, -1.03, floor + 1.05), (0.95, 0.06, 1.85), door, outline=0.035, bevel=0.03)
    glass = flat_material("Glass", H("#7fd6f2"), 1.1)
    box_mesh("Window", (1.05, -1.03, floor + 1.7), (1.0, 0.06, 0.8), glass, outline=0.035, bevel=0.03)
    for i, x in enumerate((0.38, 1.72)):
        box_mesh(f"Shutter{i}", (x, -1.05, floor + 1.7), (0.3, 0.05, 0.9), door, outline=0.03, bevel=0.02)
    roof_m = (toon_material("Straw", H("#e0b85a"), H("#c4973a"), split=floor + 3.0, soft=0.3,
                            spots=dict(color=H("#b5862e"), scale=6, size=0.2))
              if v == 0 else toon_material("Snow", H("#ffffff"), H("#d6ecf8"), split=floor + 3.0, soft=0.3))
    roof = profile_solid("Roof", [(-3.05, floor + 2.6), (3.05, floor + 2.6), (0.0, floor + 4.4)], 1.45, roof_m,
                         bevel=0.12)
    add_outline(roof, OUTLINE, INK)
    if v == 1:
        ice = toon_material("Icicle", H("#e6f6ff"))
        for i, x in enumerate((-2.6, -1.9, -0.9, 0.4, 1.3, 2.2)):
            obj = cone(f"Icicle{i}", (x, -1.4, floor + 2.35), 0.09, 0.45 + 0.12 * (i % 3), ice, rot=(math.pi, 0, 0))
            add_outline(obj, 0.025, INK)
    box_mesh("Step", (-1.0, -1.5, -H2 + 0.3), (1.1, 0.5, 0.18), post, outline=0.035, bevel=0.03)
    return None, 1


def render_variants(key, builder, size, px, count):
    """Builds and renders `count` variants of a prop into one sheet (2 columns)."""
    tmp = os.path.join(bpy.app.tempdir or os.getcwd(), "variant_frames")
    os.makedirs(tmp, exist_ok=True)
    w, h = size[0] / DU_PER_BU, size[1] / DU_PER_BU
    paths = []
    for i in range(count):
        clear_scene()
        builder(w, h, i)
        setup_render(*size, px=px)
        scene = bpy.context.scene
        path = os.path.join(tmp, f"{key}-{i}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        paths.append(path)
    fw, fh = int(size[0] * px), int(size[1] * px)
    cols = 2 if count > 1 else 1
    rows = math.ceil(count / cols)
    sheet = np.zeros((rows * fh, cols * fw, 4), dtype=np.float32)
    for i, path in enumerate(paths):
        img = bpy.data.images.load(path)
        pxs = np.empty(fw * fh * 4, dtype=np.float32)
        img.pixels.foreach_get(pxs)
        bpy.data.images.remove(img)
        r, c = divmod(i, cols)
        top = (rows - 1 - r) * fh
        sheet[top:top + fh, c * fw:(c + 1) * fw] = pxs.reshape(fh, fw, 4)
    out = bpy.data.images.new("Sheet", cols * fw, rows * fh, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = os.path.join(OUT_DIR, f"{key}-sheet.png")
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    return [fw, fh]


# key -> (builder(w, h, variant), design size, px per du, variant count)
VARIANTS = {
    "decor-edge-rock": (edge_rocks, (120, 80), 3, 4),
    "decor-edge-coral": (edge_coral, (110, 80), 3, 4),
    "decor-edge-ice": (edge_ice, (110, 90), 3, 4),
    "decor-hut": (hut, (220, 200), 2, 2),
}


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
    "boat-fishing": (boat, (360, 200), 2),
    "hazard-net": (net, (120, 120), 3),
    "hazard-harpoon": (harpoon, (90, 16), 3),
    "item-crate": (crate, (46, 40), 3),
    "decor-umbrella": (umbrella, (150, 150), 3),
    "decor-sandcastle": (sandcastle, (90, 70), 3),
    "decor-lifeguard": (lifeguard, (140, 240), 2),
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
for k, (builder, size, px, count) in VARIANTS.items():
    if not only or any(o in k for o in only):
        result[k] = render_variants(k, builder, size, px, count)
