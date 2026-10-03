# Builds the cartoon seal skins in Blender, animates them, and renders one sprite sheet per
# skin (swim cycle, bite, turn) that the game plays as frames.
#
# Run from the repo root: node tools/blender/bridge.mjs exec tools/blender/seal.py [ONLY=walrus,pirate]
# (needs Blender open with the Blender Lab MCP add-on serving localhost:9876), or headless:
# blender -b -P tools/blender/seal.py
#
# Facing +X (right), Z up, camera looking along +Y. Shared helpers live in toonkit.py.
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
    INK, OUTLINE, Poser, add_outline, blob, cone, clear_scene, ellipsoid, flat_material,
    hex_rgb, mirror_to_far_side, on_skin, render_frames, setup_render, skin_tube, smooth01,
    surface_y, toon_material, tube,
)

OUT_DIR = os.path.join(REPO_DIR, "public", "assets")
FRAME_DU = (176, 88)  # design units per frame (manifest frameWidth/Height = 3x this)
CENTER = (-0.05, 0.12)  # frame centre (x, z) in BU: the sprite's origin

# Sprite sheet layout; must match SEAL_SHEET in src/config/assets.ts.
SWIM_FRAMES = 8  # one full undulation
BITE_OPEN = (0.35, 0.7, 1.0)  # mouth openness per bite frame
# Degrees, head swinging toward the camera. The game mirrors these for the second half of
# a turn (a yaw of 180 - a looks like a flipped), so 90 isn't needed.
TURN_YAWS = (22.5, 45.0, 67.5)
# Last frame: hurt (eyes squeezed shut, mouth open in an "ouch").
SHEET_COLS = 3

# Swim pose tuning (BU / radians).
TAIL_AMP = 0.42  # vertical tail sweep at the hind flippers
WAVE_K = 0.9  # phase lag per unit along the body (wave travels head -> tail)
HEAD_BOB = 0.05
FLIPPER_SWING = 0.40
JAW_DROP = 0.48

H = hex_rgb
BASE = dict(
    back=H("#5d7d95"), belly=H("#dfe8ee"), muzzle=H("#eef3f7"), flipper=H("#52708a"),
    outline=INK, spots=None, bulk=1.0,
    head=(1.60, 0.44), head_size=(0.84, 0.76, 0.82),
    snout=(2.18, 0.22), snout_size=(0.46, 0.42, 0.38),
    eye=1.0, flipper_size=(0.38, 0.08, 0.16),
)
HARBOR_SPOTS = dict(color=H("#3e566b"), scale=2.6, size=0.22, min_z=0.1, max_x=1.0)

STYLES = {
    "harbor": dict(spots=HARBOR_SPOTS),
    "arctic": dict(
        back=H("#e8eff5"), belly=H("#ffffff"), muzzle=H("#ffffff"), flipper=H("#cfdce6"),
        outline=H("#2b3d4f"), fluffy=True, eye=1.28, blush=True, bulk=1.06,
        head=(1.52, 0.46), head_size=(0.92, 0.82, 0.88), snout=(2.10, 0.24),
        snout_size=(0.40, 0.40, 0.36)),
    "sealion": dict(
        back=H("#8e5b33"), belly=H("#cc9e6b"), muzzle=H("#c9996a"), flipper=H("#6f4526"),
        outline=H("#3a2414"), bulk=0.92, head=(1.82, 0.70), head_size=(0.66, 0.58, 0.62),
        snout=(2.32, 0.52), snout_size=(0.42, 0.32, 0.28), neck=True, ear=True,
        flipper_size=(0.62, 0.09, 0.20)),
    "tropical": dict(
        back=H("#7a776d"), belly=H("#e3d7bf"), muzzle=H("#efe6d4"), flipper=H("#5c5951"),
        outline=H("#2c2a26"), lei=True, blush=True),
    "leopard": dict(
        back=H("#66717c"), belly=H("#d3d8dc"), muzzle=H("#e3e7ea"), flipper=H("#4c555e"),
        outline=H("#1e242a"), head=(1.70, 0.40), head_size=(0.92, 0.80, 0.80),
        snout=(2.26, 0.20), snout_size=(0.50, 0.44, 0.36), wide_mouth=True,
        spots=dict(color=H("#2c343c"), scale=3.4, size=0.2, max_x=1.3)),
    "walrus": dict(
        back=H("#a8735a"), belly=H("#dcae90"), muzzle=H("#ecc7aa"), flipper=H("#8d5c46"),
        outline=H("#3b2418"), bulk=1.15, head=(1.60, 0.34), head_size=(0.86, 0.82, 0.84),
        snout=(2.20, 0.14), snout_size=(0.48, 0.48, 0.44), eye=0.72, tusks=True,
        moustache=True, wrinkles=True),
    "elephant": dict(
        back=H("#7d6f62"), belly=H("#bca893"), muzzle=H("#a08d7a"), flipper=H("#61554a"),
        outline=H("#2d241d"), bulk=1.12, head=(1.60, 0.40), head_size=(0.86, 0.80, 0.84),
        snout=(2.08, 0.22), snout_size=(0.38, 0.40, 0.34), eye=0.8, proboscis=True,
        wrinkles=True),
    "pirate": dict(
        back=H("#5a7890"), belly=H("#dbe5ec"), muzzle=H("#eef3f7"), flipper=H("#4e6b84"),
        spots=dict(HARBOR_SPOTS, size=0.18), bandana=True, eyepatch=True),
    "golden": dict(
        back=H("#e8ae1e"), belly=H("#ffe58e"), muzzle=H("#fff0b0"), flipper=H("#c98a10"),
        outline=H("#6b4404"), shine=True, blush=True),
}
SHEET_NAMES = {"harbor": "seal-sheet.png"}  # others: seal-<id>-sheet.png

MOUTH_PARTS = ("MouthOpen", "Tongue", "ToothA", "ToothB")
NO_JAW = ("Proboscis", "Bandana", "Patch", "Strap", "Knot", "Lei")


def build(style):
    s = dict(BASE, **style)
    clear_scene()
    m_body = toon_material("Skin", s["back"], s["belly"], split=-0.117, soft=0.027, tilt=-0.10,
                           spots=s["spots"], shine=s.get("shine"))
    m_flip = toon_material("Flipper", s["flipper"], shine=s.get("shine"))
    m_muzzle = toon_material("Muzzle", s["muzzle"], shine=s.get("shine"))
    m_eye = flat_material("Eye", (0.02, 0.03, 0.04))
    m_white = flat_material("Highlight", (1, 1, 1), 1.2)
    m_nose = flat_material("Nose", (0.05, 0.07, 0.09))
    m_line = flat_material("Line", s["outline"])
    ol = s["outline"]
    near = []  # near-side details mirrored to the far side for the turn frames

    hx, hz = s["head"]
    mx, mz = s["snout"]
    bulk = s["bulk"]
    parts = [
        ((-0.20, 0, 0.00), (1.50, 0.85, 0.98 * bulk)),  # torso
        ((0.80, 0, 0.14), (0.95, 0.80, 0.90 * bulk)),  # chest
        ((hx, 0, hz), s["head_size"]),  # head
        ((mx, 0, mz), s["snout_size"]),  # muzzle
        ((-1.35, 0, -0.02), (0.90, 0.62, 0.70 * bulk)),  # hips
        ((-1.95, 0, -0.04), (0.52, 0.40, 0.40)),  # tail end
    ]
    if s.get("neck"):
        parts.append(((1.25, 0, 0.42), (0.70, 0.62, 0.66)))
    fluff = dict(scale=0.09, strength=0.07) if s.get("fluffy") else None
    body = blob("SealBody", parts, m_body, voxel=0.035, outline=None, displace=fluff)
    add_outline(body, OUTLINE, ol)

    # Whisker pad: a lighter bump on the near side of the muzzle.
    pad = (0.42, 0.32, 0.32) if s.get("moustache") else (0.36, 0.30, 0.27)
    px, pz = mx + 0.06, mz - 0.06
    near.append(ellipsoid("Muzzle", (px, surface_y(body, px, pz) + 0.16, pz), pad, m_muzzle))

    # Hind flippers: two paddles side by side pointing straight back.
    for name, y, z, tilt in (("HindFar", 0.16, 0.10, -0.22), ("HindNear", -0.16, -0.16, 0.20)):
        f = ellipsoid(name, (-2.50, y, z), (0.50, 0.07, 0.19), m_flip, rot=(0, tilt, 0))
        add_outline(f, 0.06, ol)
    # Front flipper on the near side, angled down and back, with little claws.
    fsx = s["flipper_size"][0]
    fx, fz = (0.42, -0.70) if fsx > 0.5 else (0.42, -0.66)
    fy = surface_y(body, fx, fz) + 0.02
    ff = ellipsoid("FrontFlipper", (fx, fy, fz), s["flipper_size"], m_flip,
                   rot=(0, math.radians(-40), 0))
    add_outline(ff, 0.06, ol)
    near.append(ff)
    tip = (fx - 0.76 * fsx, fz - 0.64 * fsx)
    for i in range(3):
        near.append(ellipsoid(f"Claw{i}", (tip[0] + i * 0.03, fy - 0.09, tip[1] + i * 0.06),
                              (0.04, 0.02, 0.022), m_line, segments=12, rings=8))

    # Big dark eye with highlights.
    er = s["eye"]
    ex, ez = hx + 0.20, hz + 0.20
    ey = surface_y(body, ex, ez)
    EYE[:] = (ex, ey, ez)
    near.append(ellipsoid("Eye", (ex, ey, ez), (0.21 * er, 0.08, 0.24 * er), m_eye))
    near.append(skin_tube(body, "Squint", [(ex - 0.13 * er, ez + 0.15 * er), (ex + 0.09 * er, ez),
                                           (ex - 0.13 * er, ez - 0.15 * er)], m_line, 0.035, 0.03))
    near.append(ellipsoid("EyeShine", (ex + 0.06 * er, ey - 0.08, ez + 0.09 * er),
                          (0.075 * er, 0.02, 0.075 * er), m_white, segments=16, rings=8))
    near.append(ellipsoid("EyeShine2", (ex - 0.06 * er, ey - 0.08, ez - 0.10 * er),
                          (0.032 * er, 0.01, 0.032 * er), m_white, segments=12, rings=6))
    if not s.get("bandana"):
        near.append(skin_tube(body, "Brow", [(ex - 0.17, ez + 0.08 + 0.2 * er),
                                             (ex - 0.02, ez + 0.14 + 0.2 * er),
                                             (ex + 0.13, ez + 0.10 + 0.2 * er)], m_line, 0.014))

    # Nose at the snout tip, and a smile.
    if not s.get("proboscis"):
        near.append(ellipsoid("Nose", on_skin(body, mx + 0.38, mz + 0.12, -0.02),
                              (0.11, 0.08, 0.08), m_nose))
    lift = 0.20  # the muzzle pad bulges ~0.16 out of the body
    mouth = [(mx + 0.24, mz - 0.18), (mx + 0.09, mz - 0.26), (mx - 0.10, mz - 0.21)]
    if s.get("wide_mouth"):
        mouth.append((mx - 0.34, mz - 0.10))
    near.append(skin_tube(body, "Mouth", mouth, m_line, 0.022, lift))
    if s.get("moustache"):
        # Bristly walrus moustache: rows of dots, short stiff whiskers.
        for i in range(12):
            r, c = divmod(i, 4)
            near.append(ellipsoid(f"Dot{i}", on_skin(body, mx - 0.06 + c * 0.11, mz + 0.06 - r * 0.09,
                                                     lift + 0.02),
                                  (0.02, 0.01, 0.02), m_line, segments=8, rings=6))
    else:
        for i, (dx, dz) in enumerate(((0.02, 0.04), (0.12, 0.04), (0.07, -0.04), (0.17, -0.04))):
            near.append(ellipsoid(f"Dot{i}", on_skin(body, mx + dx, mz + dz, lift + 0.01),
                                  (0.018, 0.01, 0.018), m_line, segments=8, rings=6))
    wl = 0.45 if s.get("moustache") else 0.6
    for i, (z0, z1) in enumerate(((0.04, 0.20), (-0.01, 0.01), (-0.06, -0.18))):
        near.append(skin_tube(body, f"Whisker{i}",
                              [(mx + 0.16, mz + z0), (mx + 0.16 + wl / 2, mz + (z0 + z1) / 2 + 0.03),
                               (mx + 0.16 + wl, mz + z1)], m_line, 0.013, lift + 0.03))

    # Open mouth (bite frames only): dark inside, tongue and two little teeth, sized per frame.
    my = surface_y(body, mx + 0.09, mz - 0.22) - 0.19
    m_mouth = flat_material("MouthInside", (0.30, 0.05, 0.08))
    m_tongue = flat_material("Tongue", (0.92, 0.45, 0.50))
    m_tooth = flat_material("Tooth", (1, 1, 1), 1.1)
    for name, loc, size, mat in (
        ("MouthOpen", (mx + 0.09, my, 0.0), (0.24, 0.02, 1.0), m_mouth),
        ("Tongue", (mx + 0.06, my - 0.02, 0.0), (0.13, 0.015, 0.45), m_tongue),
        ("ToothA", (mx + 0.20, my - 0.03, 0.0), (0.03, 0.01, 0.05), m_tooth),
        ("ToothB", (mx - 0.02, my - 0.03, 0.0), (0.03, 0.01, 0.05), m_tooth),
    ):
        ellipsoid(name, loc, (1, 1, 1), mat, segments=24, rings=12).scale = size

    extras(s, body, near, m_flip, m_line, (hx, hz), (mx, mz), (ex, ey, ez))

    for obj in near:
        mirror_to_far_side(obj)
    setup_render(*FRAME_DU, CENTER)
    return (mx, mz)


def extras(s, body, near, m_flip, m_line, head, snout, eye):
    hx, hz = head
    mx, mz = snout
    ex, ey, ez = eye
    ol = s["outline"]
    if s.get("blush"):
        m = flat_material("Blush", (1.0, 0.62, 0.68))
        near.append(ellipsoid("Blush", on_skin(body, ex + 0.02, ez - 0.30, 0.0),
                              (0.13, 0.03, 0.07), m))
    if s.get("ear"):
        ear = ellipsoid("Ear", on_skin(body, hx - 0.30, hz + 0.16, -0.02), (0.10, 0.05, 0.06),
                        m_flip, rot=(0, math.radians(30), 0))
        add_outline(ear, 0.04, ol)
        near.append(ear)
    if s.get("tusks"):
        m = toon_material("Tusk", (0.98, 0.95, 0.86))
        for name, dy in (("TuskNear", -0.14), ("TuskFar", 0.14)):
            cone(name, (mx + 0.10, dy, mz - 0.62), 0.07, 0.72, m,
                 rot=(math.pi, math.radians(-12), 0), outline=0.045)
    if s.get("wrinkles"):
        for i in range(3):
            x = 0.95 + i * 0.16
            near.append(skin_tube(body, f"Wrinkle{i}", [(x, hz - 0.05), (x - 0.06, hz - 0.30),
                                                         (x, hz - 0.55)], m_line, 0.014))
    if s.get("proboscis"):
        # Big droopy trunk hanging over the mouth.
        m = toon_material("Proboscis", H("#6d5d4f"))
        nose = blob("Proboscis", [((mx + 0.30, 0, mz + 0.24), (0.34, 0.28, 0.26)),
                                  ((mx + 0.54, 0, mz + 0.04), (0.25, 0.24, 0.27)),
                                  ((mx + 0.58, 0, mz - 0.22), (0.19, 0.19, 0.22))],
                    m, voxel=0.025, outline=None)
        add_outline(nose, OUTLINE, ol)
        nm = flat_material("Nostril", (0.08, 0.06, 0.05))
        near.append(ellipsoid("ProboscisNostril", on_skin(nose, mx + 0.60, mz - 0.36, 0.0),
                              (0.06, 0.02, 0.035), nm))
        for i in range(2):
            near.append(skin_tube(nose, f"ProboscisFold{i}",
                                  [(mx + 0.40 + i * 0.12, mz + 0.34 - i * 0.14),
                                   (mx + 0.50 + i * 0.12, mz + 0.24 - i * 0.14),
                                   (mx + 0.56 + i * 0.12, mz + 0.12 - i * 0.14)], m_line, 0.013))
    if s.get("lei"):
        petals = [H("#ff6fa5"), H("#ffd23f"), H("#ff8a3d"), H("#ffffff")]
        leaf = flat_material("LeiLeaf", H("#3fae5a"))
        mats = [toon_material(f"LeiPetal{i}", c) for i, c in enumerate(petals)]
        cz = 0.22
        n = 20
        for i in range(n):
            t = 2 * math.pi * i / n
            dy, dz = math.cos(t), math.sin(t)
            # The garland leans: further back on top, hanging forward under the chin, so it
            # reads as a loop from the side.
            cx = 1.00 - 0.32 * dz
            hit = radial_surface(body, cx, cz, dy, dz)
            if hit is None:
                continue
            y, z = hit
            f = ellipsoid(f"Lei{i}", (cx, y + dy * 0.05, z + dz * 0.05), (0.13, 0.13, 0.13),
                          mats[i % 4], segments=16, rings=8)
            add_outline(f, 0.035, ol)
            ellipsoid(f"LeiLeaf{i}", (cx - 0.11, y + dy * 0.03, z + dz * 0.03),
                      (0.10, 0.06, 0.05), leaf, segments=12, rings=6)
    if s.get("bandana"):
        m = toon_material("Bandana", H("#d8322b"),
                          spots=dict(color=(1, 1, 1), scale=4.5, size=0.2))
        cap = ellipsoid("Bandana", (hx - 0.06, 0, hz + 0.36), (0.80, 0.80, 0.42), m)
        add_outline(cap, OUTLINE, ol)
        for i, (dz, rot) in enumerate(((0.08, 25), (-0.10, -15))):
            k = ellipsoid(f"Knot{i}", (hx - 0.90, -0.10, hz + 0.30 + dz), (0.26, 0.06, 0.10),
                          m, rot=(0, math.radians(rot), 0))
            add_outline(k, 0.045, ol)
    if s.get("eyepatch"):
        m = flat_material("Patch", (0.05, 0.05, 0.06))
        patch = ellipsoid("Patch", (ex, ey - 0.12, ez), (0.27, 0.03, 0.28), m)
        add_outline(patch, 0.03, ol)
        tube("Strap", [(ex - 0.24, ey - 0.06, ez + 0.10), (ex - 0.40, ey + 0.02, ez + 0.32),
                       (ex - 0.48, ey + 0.10, ez + 0.52)], m, 0.025)


def radial_surface(body, x, cz, dy, dz):
    from mathutils import Vector
    inv = body.matrix_world.inverted()
    origin = inv @ Vector((x, dy * 3.0, cz + dz * 3.0))
    direction = inv.to_3x3() @ Vector((0.0, -dy, -dz))
    hit, loc, _n, _i = body.ray_cast(origin, direction)
    if not hit:
        return None
    w = body.matrix_world @ loc
    return w.y, w.z


EYE = [0.0, 0.0, 0.0]


class SealPoser:
    def __init__(self, snout):
        self.mx, self.mz = snout
        self.poser = Poser(CENTER, skip=MOUTH_PARTS)
        for n in MOUTH_PARTS:
            bpy.data.objects[n].hide_render = True
        for obj in bpy.data.objects:
            if obj.name.startswith("EyeShine") and obj.name.endswith("Far"):
                obj.hide_render = True  # the far eye is behind the head in every frame
        self.mouth_rest = {n: (bpy.data.objects[n].location.copy(), bpy.data.objects[n].scale.copy())
                           for n in MOUTH_PARTS}

    def wave(self, x, phase):
        tail = smooth01((0.6 - x) / 3.6) ** 1.4
        head = smooth01((x - 0.6) / 1.5)
        return (TAIL_AMP * tail * np.sin(phase - WAVE_K * (0.6 - x))
                + HEAD_BOB * head * np.sin(phase + math.pi))

    def frame(self, phase=0.0, bite=0.0, yaw=0.0, hurt=False):
        # Hurt: swap the open eyes for squeezed-shut ones.
        for obj in bpy.data.objects:
            if obj.name.startswith("Squint"):
                obj.hide_render = not hurt
            elif obj.name.startswith("Eye") and not obj.name.endswith("Far"):
                obj.hide_render = hurt

        sweep = FLIPPER_SWING * math.sin(phase + 0.6)
        hinge = self.mx - 0.32
        line = self.mz - 0.12

        def bend(name, p):
            if name.startswith(("FrontFlipper", "Claw")):
                c, s_ = math.cos(sweep), math.sin(sweep)
                px, pz = self.flipper_pivot
                dx, dz = p[:, 0] - px, p[:, 2] - pz
                p[:, 0] = px + c * dx - s_ * dz
                p[:, 2] = pz + s_ * dx + c * dz
            if bite > 0 and not name.startswith(NO_JAW):
                w = smooth01((p[:, 0] - hinge) / 0.25) * smooth01((line - p[:, 2]) / 0.12)
                p[:, 2] -= JAW_DROP * bite * w * (0.6 + (p[:, 0] - hinge))
                p[:, 0] -= 0.05 * bite * w
            if name.startswith("EyeShine") and yaw:
                eye = np.array(EYE)
                a = math.radians(yaw)
                c, s_ = math.cos(a), math.sin(a)
                d = p - eye
                p[:, 0] = eye[0] + c * d[:, 0] - s_ * d[:, 1]
                p[:, 1] = eye[1] + s_ * d[:, 0] + c * d[:, 1]
            p[:, 2] += self.wave(p[:, 0], phase)
            return p

        self.poser.apply(bend, yaw)
        self.pose_mouth(phase, bite)
        bpy.context.view_layer.update()

    def pose_mouth(self, phase, bite):
        lift = float(self.wave(np.array([self.mx + 0.09]), phase)[0])
        drop = JAW_DROP * bite * (0.6 + 0.41)
        top = self.mz - 0.16
        for name in MOUTH_PARTS:
            obj = bpy.data.objects[name]
            obj.hide_render = bite <= 0
            loc, size = self.mouth_rest[name]
            obj.location = loc.copy()
            obj.scale = size.copy()
            if name == "MouthOpen":
                obj.scale.z = 0.03 + drop * 0.5
                obj.location.z = top - drop * 0.5 + lift
            elif name == "Tongue":
                obj.scale.z = 0.02 + drop * 0.2
                obj.location.z = top - drop * 0.75 + lift
            else:  # teeth hang from the upper lip
                obj.location.z = top - 0.03 + lift


def render_skin(skin):
    snout = build(STYLES[skin])
    sp = SealPoser(snout)
    ff = bpy.data.objects["FrontFlipper"]
    xs = [v.co.x + ff.location.x for v in ff.data.vertices]
    zs = [v.co.z + ff.location.z for v in ff.data.vertices]
    # Shoulder pivot: the flipper's top-front end.
    top = max(range(len(xs)), key=lambda i: xs[i] + zs[i])
    sp.flipper_pivot = (xs[top] - 0.05, zs[top] - 0.05)

    class Frames:  # adapter: render_frames calls poser.apply(**kw)
        def apply(self, **kw):
            sp.frame(**kw)

    poses = [dict(phase=2 * math.pi * i / SWIM_FRAMES) for i in range(SWIM_FRAMES)]
    poses += [dict(bite=b) for b in BITE_OPEN]
    poses += [dict(yaw=y) for y in TURN_YAWS]
    poses += [dict(bite=0.55, hurt=True)]
    name = SHEET_NAMES.get(skin, f"seal-{skin}-sheet.png")
    return render_frames(Frames(), poses, os.path.join(OUT_DIR, name), SHEET_COLS)


only = [s for s in globals().get("ONLY", "").split(",") if s] or list(STYLES)
result = {skin: render_skin(skin)["path"] for skin in only}
