# Builds the sea creatures (prey, predators, jellyfish) in Blender and renders a looping
# animation sheet for each: tails sweep, wings flap, legs walk, bells pulse.
#
# Run from the repo root: node tools/blender/bridge.mjs exec tools/blender/creatures.py [ONLY=shark,crab]
# Output: public/assets/<texture key>-sheet.png, frames of the placeholder's design size x3
# (x2 for the bosses), 2 columns. Everything faces +X (right) and is centred on the frame, like the placeholders.
import importlib
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

REPO_DIR = globals().get("REPO", os.getcwd())
sys.path.insert(0, os.path.join(REPO_DIR, "tools", "blender"))
import toonkit  # noqa: E402

importlib.reload(toonkit)
from toonkit import (  # noqa: E402
    DU_PER_BU, OUTLINE, Poser, add_outline, blob, cartoon_eye, clear_scene, cone, ellipsoid,
    flat_material, hex_rgb as H, on_skin, plate, render_frames, rotate_xy, rotate_xz,
    setup_render, skin_tube, smooth01, surface_y, toon_material, tube,
)

OUT_DIR = os.path.join(REPO_DIR, "public", "assets")
COLS = 2
TAU = 2 * math.pi


def rotate_yz(p, pivot, angle, weight=1.0):
    """Rotates points about the X axis through pivot (y, z) (wing flaps)."""
    a = angle * weight
    c, s = np.cos(a), np.sin(a)
    dy, dz = p[:, 1] - pivot[0], p[:, 2] - pivot[1]
    p[:, 1] = pivot[0] + c * dy - s * dz
    p[:, 2] = pivot[1] + s * dy + c * dz
    return p


def spike(name, center, direction, length, radius, mat, ol):
    d = Vector(direction).normalized()
    base = Vector(center) + d * 0.0
    obj = cone(name, base + d * (length / 2), radius, length, mat)
    obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    add_outline(obj, 0.035, ol)
    return obj


def fin_mat(name, color):
    return toon_material(name, color)


# ---------------------------------------------------------------------------------------
# Fish family (minnow, sardine, lanternfish)
# ---------------------------------------------------------------------------------------

def fish(w_du, h_du, back, belly, fin, outline, eye_r, stripe=None, side_spots=None,
         glow_dots=None, glow_eye=None):
    W, Hh = w_du / DU_PER_BU, h_du / DU_PER_BU
    L = W * 0.88
    x0, x1 = -L / 2, L / 2  # tail tip, nose
    tl = L * 0.34  # tail fin length
    bl = L - tl * 0.7
    bx = x1 - bl / 2
    hh = Hh * 0.30  # body half height
    th = hh * 0.62
    m_body = toon_material("Body", back, belly, split=-0.15 * hh, soft=0.04 * hh / 0.27)
    m_fin = fin_mat("Fin", fin)
    body = blob("Body", [((bx, 0, 0), (bl / 2, th, hh)),
                         ((bx + bl * 0.22, 0, 0.01), (bl * 0.30, th * 0.95, hh * 0.92)),
                         ((bx - bl * 0.40, 0, 0), (bl * 0.18, th * 0.45, hh * 0.32))],
                m_body, voxel=0.018, outline=None)
    add_outline(body, OUTLINE, outline)
    root = bx - bl * 0.46
    plate("Tail", [(root + 0.06, 0.0), (x0, hh * 1.05), (x0 + tl * 0.32, 0.0), (x0, -hh * 1.05)],
          m_fin, thickness=0.035, outline=0.05, round_=False)
    plate("Dorsal", [(bx - bl * 0.2, hh * 0.7), (bx - bl * 0.05, hh * 1.45), (bx + bl * 0.12, hh * 0.8)],
          m_fin, thickness=0.03, outline=0.05, round_=False)
    plate("Anal", [(bx - bl * 0.32, -hh * 0.6), (bx - bl * 0.22, -hh * 1.25), (bx - bl * 0.08, -hh * 0.7)],
          m_fin, thickness=0.03, outline=0.05, round_=False)
    if stripe:
        m = flat_material("Stripe", stripe)
        skin_tube(body, "Stripe", [(bx - bl * 0.38, 0.0), (bx - bl * 0.1, 0.02), (bx + bl * 0.08, 0.02)],
                  m, hh * 0.13, lift=0.0)
    if side_spots:
        m = flat_material("SideSpot", side_spots)
        for i in range(5):
            x = bx + bl * 0.18 - i * bl * 0.12
            ellipsoid(f"Spot{i}", on_skin(body, x, hh * 0.25), (hh * 0.09, 0.01, hh * 0.09), m,
                      segments=12, rings=6)
    if glow_dots:
        m = flat_material("Photophore", glow_dots, 2.2)
        for i in range(6):
            x = bx + bl * 0.30 - i * bl * 0.13
            ellipsoid(f"Glow{i}", on_skin(body, x, -hh * 0.55), (hh * 0.11, 0.01, hh * 0.11), m,
                      segments=12, rings=6)
    ex = x1 - bl * 0.2
    cartoon_eye(body, "Eye", ex, hh * 0.18, eye_r)
    if glow_eye:
        m = flat_material("EyeGlow", glow_eye, 2.2)
        ellipsoid("EyeLamp", on_skin(body, ex + eye_r * 1.4, -hh * 0.25), (hh * 0.13, 0.01, hh * 0.13),
                  m, segments=12, rings=6)
    ink = flat_material("Ink", outline)
    skin_tube(body, "Mouth", [(x1 - 0.03, -hh * 0.18), (x1 - 0.09, -hh * 0.28), (x1 - 0.15, -hh * 0.24)],
              ink, 0.014, lift=0.0)
    skin_tube(body, "Gill", [(ex - eye_r * 2.2, hh * 0.45), (ex - eye_r * 2.7, 0.0),
                             (ex - eye_r * 2.2, -hh * 0.45)], ink, 0.013, lift=0.0)
    pect = plate("Pect", [(ex - eye_r * 2.4, -hh * 0.2), (ex - eye_r * 4.6, -hh * 0.55),
                          (ex - eye_r * 4.0, -hh * 0.15)], m_fin, thickness=0.03,
                 y=surface_y(body, ex - eye_r * 3.2, -hh * 0.3) - 0.03, outline=0.04, round_=False)
    piv = bx - bl * 0.1
    pect_root = (ex - eye_r * 2.4, -hh * 0.2)

    def pose(name, p, phase):
        if name.startswith("Pect"):
            rotate_xz(p, pect_root, 0.35 * math.sin(2 * phase))
        w = smooth01((piv - p[:, 0]) / (piv - x0)) ** 1.3
        rotate_xy(p, (piv, 0), 0.6 * math.sin(phase), w)
        rotate_xz(p, (piv, 0), 0.10 * math.sin(phase + 1.2), w)
        return p

    return pose, 4


# ---------------------------------------------------------------------------------------
# Prey
# ---------------------------------------------------------------------------------------

def minnow():
    return fish(48, 26, H("#7fb6d6"), H("#eef6fb"), H("#f3b25c"), H("#2b4658"), 0.12,
                stripe=H("#ffc078"))


def sardine():
    return fish(60, 26, H("#3a6fa8"), H("#e6edf3"), H("#8fb3cf"), H("#1d3350"), 0.11,
                side_spots=H("#1d3350"))


def lanternfish():
    return fish(38, 20, H("#22356a"), H("#4a68a0"), H("#2a3f73"), H("#0a1128"), 0.10,
                glow_dots=H("#a8fcff"), glow_eye=H("#a8fcff"))


def shrimp():
    ol = H("#8a3b3b")
    m = toon_material("Shell", H("#f6a48c"), H("#ffd6c6"), split=-0.08, soft=0.04)
    pts = [(0.42, 0.14, 0.24), (0.22, 0.17, 0.25), (0.02, 0.15, 0.23), (-0.18, 0.09, 0.20),
           (-0.34, -0.01, 0.16), (-0.44, -0.13, 0.12), (-0.48, -0.25, 0.09)]
    body = blob("Body", [((x, 0, z), (r * 1.1, r * 0.85, r)) for x, z, r in pts], m, voxel=0.015,
                outline=None)
    add_outline(body, OUTLINE, ol)
    ink = flat_material("Ink", ol)
    for i, (x, z, r) in enumerate(pts[1:5]):
        skin_tube(body, f"Segment{i}", [(x + 0.02, z + r * 0.9), (x + 0.05, z), (x + 0.02, z - r * 0.8)],
                  ink, 0.011, lift=0.0)
    cone("Rostrum", (0.70, 0, 0.28), 0.05, 0.26, m, rot=(0, math.radians(80), 0), outline=0.03)
    fan = fin_mat("Fan", H("#f28b70"))
    plate("Tail", [(-0.46, -0.30), (-0.70, -0.38), (-0.66, -0.52), (-0.48, -0.46)], fan,
          thickness=0.03, outline=0.035)
    m_eye = flat_material("EyeBlack", (0.03, 0.03, 0.04))
    white = flat_material("EyeWhite", (1, 1, 1), 1.2)
    tube("Stalk", [(0.48, -0.15, 0.24), (0.55, -0.20, 0.30)], m, 0.03)
    ellipsoid("Eye", (0.57, -0.23, 0.32), (0.075, 0.06, 0.08), m_eye)
    ellipsoid("EyeShine", (0.59, -0.29, 0.35), (0.025, 0.01, 0.025), white, segments=12, rings=6)
    ant = flat_material("Antenna", H("#c85c4a"))
    for i, (zz, yy) in enumerate(((0.62, -0.1), (0.48, 0.05))):
        tube(f"Antenna{i}", [(0.55, yy, 0.30), (0.70, yy, zz), (0.30, yy, zz + 0.05),
                             (-0.40, yy, zz - 0.02)], ant, 0.012)
    legs = []
    for i in range(5):
        x = 0.30 - i * 0.14
        legs.append(tube(f"Leg{i}", [(x, -0.10, -0.02 - i * 0.02), (x - 0.03, -0.12, -0.16 - i * 0.02),
                                     (x - 0.08, -0.12, -0.24 - i * 0.02)], ant, 0.016))

    def pose(name, p, phase):
        if name.startswith("Leg"):
            i = int(name[3])
            rotate_xz(p, (0.30 - i * 0.14, -0.02), 0.45 * math.sin(phase + i * 0.9))
        if name.startswith("Antenna"):
            w = smooth01((0.55 - p[:, 0]) / 0.9)
            p[:, 2] += 0.06 * math.sin(phase + 1.0) * w
        w = smooth01((-0.25 - p[:, 0]) / 0.45)
        rotate_xz(p, (-0.25, -0.05), 0.22 * math.sin(phase), w)
        return p

    return pose, 4


def squid():
    ol = H("#7a2a3c")
    m = toon_material("Squid", H("#f28aa0"), H("#ffc4cf"), split=-0.06, soft=0.03,
                      spots=dict(color=H("#d9607a"), scale=9.0, size=0.18, min_z=0.0))
    body = blob("Body", [((0.40, 0, 0.0), (0.66, 0.28, 0.28)), ((0.95, 0, 0.0), (0.24, 0.16, 0.16)),
                         ((-0.32, 0, 0.0), (0.26, 0.27, 0.27))], m, voxel=0.018, outline=None)
    add_outline(body, OUTLINE, ol)
    fin = fin_mat("Fin", H("#ef8098"))
    plate("Fin", [(0.70, 0.0), (0.98, 0.40), (1.17, 0.02), (0.98, -0.40)], fin, thickness=0.03,
          outline=0.045, round_=False)
    cartoon_eye(body, "Eye", -0.22, 0.06, 0.14)
    tm = [toon_material("Tentacle0", H("#ef8098")), toon_material("Tentacle1", H("#d9607a"))]
    for i in range(6):
        z0 = 0.16 - i * 0.065
        y = -0.12 + (i % 3) * 0.12
        tube(f"Tentacle{i}", [(-0.45, y, z0), (-0.75, y, z0 * 1.4), (-1.05, y, z0 * 1.6 - 0.05),
                              (-1.18, y, z0 * 1.6)], tm[i % 2], 0.04 - 0.002 * i, outline=0.03)

    def pose(name, p, phase):
        if name.startswith("Tentacle"):
            k = (-0.45 - p[:, 0])
            w = smooth01(k / 0.75)
            p[:, 2] += 0.09 * np.sin(phase - 4.0 * k) * w
            p[:, 0] += 0.05 * math.sin(phase) * w
        if name.startswith("Fin"):
            rotate_xz(p, (0.95, 0.0), 0.0)
            p[:, 2] *= 1.0 + 0.18 * math.sin(phase)
        if name == "Body" or name.startswith("Eye"):
            # Mantle pulse.
            w = smooth01((p[:, 0] + 0.1) / 0.6)
            p[:, 2] *= 1.0 - 0.06 * math.sin(phase) * w
        return p

    return pose, 4


def penguin():
    ol = H("#0e1620")
    m = toon_material("Penguin", H("#1d2733"), H("#f6f8fa"), split=-0.06, soft=0.025, tilt=0.05)
    dx = -0.06
    body = blob("Body", [((dx, 0, 0), (0.74, 0.34, 0.37)), ((dx + 0.62, 0, 0.06), (0.33, 0.29, 0.30)),
                         ((dx - 0.62, 0, -0.02), (0.30, 0.20, 0.18))], m, voxel=0.018, outline=None)
    add_outline(body, OUTLINE, ol)
    orange = toon_material("Beak", H("#f29a2e"))
    cone("Beak", (dx + 1.02, 0, 0.04), 0.075, 0.26, orange, rot=(0, math.pi / 2, 0), outline=0.035)
    for i, y in enumerate((-0.07, 0.07)):
        ellipsoid(f"Foot{i}", (dx - 0.86, y, -0.08), (0.12, 0.05, 0.05), orange, outline=0.035)
    cartoon_eye(body, "Eye", dx + 0.74, 0.14, 0.085)
    blush = flat_material("Blush", H("#ff9db0"))
    ellipsoid("Cheek", on_skin(body, dx + 0.72, -0.02), (0.06, 0.01, 0.035), blush)
    wing_root = (dx + 0.28, 0.02)
    plate("Wing", [(dx + 0.30, 0.06), (dx - 0.05, -0.02), (dx - 0.42, -0.14), (dx - 0.30, -0.02),
                   (dx + 0.25, 0.14)], toon_material("Flipper", H("#34465a")), thickness=0.04, y=surface_y(body, dx, 0.0) - 0.02,
          outline=0.045)

    def pose(name, p, phase):
        if name.startswith("Wing"):
            rotate_xz(p, wing_root, -0.55 * math.sin(phase))
        if name.startswith("Foot"):
            rotate_xz(p, (dx - 0.75, -0.06), 0.4 * math.sin(phase + math.pi))
        p[:, 2] += 0.03 * math.sin(phase) * smooth01((p[:, 0] + 0.2) / 1.0)
        return p

    return pose, 4


def turtle():
    ol = H("#1e3a22")
    shell = toon_material("Shell", H("#4f9a4a"), spots=dict(color=H("#7fbf6a"), scale=2.4, size=0.30))
    skin = toon_material("Skin", H("#9fd27a"), H("#d9eeb0"), split=-0.05, soft=0.03)
    under = toon_material("Plastron", H("#e9d98f"))
    sh = blob("Shell", [((-0.12, 0, 0.12), (1.05, 0.74, 0.55))], shell, voxel=0.025, outline=None)
    add_outline(sh, OUTLINE, ol)
    ellipsoid("Plastron", (-0.10, 0, -0.10), (1.00, 0.66, 0.24), under, outline=0.05)
    head = blob("Head", [((0.88, 0, 0.0), (0.32, 0.24, 0.22)), ((1.20, 0, 0.06), (0.32, 0.27, 0.27))],
                skin, voxel=0.02, outline=None)
    add_outline(head, OUTLINE, ol)
    cartoon_eye(head, "Eye", 1.30, 0.16, 0.09)
    ink = flat_material("Ink", ol)
    skin_tube(head, "Smile", [(1.48, -0.02), (1.40, -0.08), (1.30, -0.06)], ink, 0.014, lift=0.0)
    flip = [((0.55, -0.05), (0.05, -0.80), (0.38, -0.82), (0.80, -0.22))]
    plate("FlipperNear", [(0.62, -0.08), (0.05, -0.82), (0.36, -0.86), (0.86, -0.22)], skin,
          thickness=0.05, y=-0.62, outline=0.05)
    plate("FlipperFar", [(0.62, -0.02), (0.15, -0.70), (0.42, -0.72), (0.86, -0.16)], skin,
          thickness=0.05, y=0.55, outline=0.05)
    plate("RearNear", [(-0.90, -0.15), (-1.30, -0.40), (-1.15, -0.48), (-0.80, -0.28)], skin,
          thickness=0.05, y=-0.45, outline=0.05)
    cone("TailTip", (-1.22, 0, -0.02), 0.07, 0.24, skin, rot=(0, -math.pi / 2, 0), outline=0.035)
    del flip

    def pose(name, p, phase):
        if name.startswith("FlipperNear"):
            rotate_xz(p, (0.70, -0.10), 0.55 * math.sin(phase))
        if name.startswith("FlipperFar"):
            rotate_xz(p, (0.70, -0.06), 0.55 * math.sin(phase - 0.5))
        if name.startswith("Rear"):
            rotate_xz(p, (-0.85, -0.2), 0.3 * math.sin(phase + 1.5))
        if name.startswith(("Head", "Eye", "Smile")):
            p[:, 2] += 0.03 * math.sin(phase + 1.0)
        return p

    return pose, 4


def seabird():
    ol = H("#3a4652")
    white = toon_material("Feathers", H("#f6f8fa"), H("#ffffff"), split=-0.1)
    grey = toon_material("Wing", H("#b9c4ce"))
    black = toon_material("WingTip", H("#2b333b"))
    body = blob("Body", [((-0.05, 0, 0.0), (0.58, 0.27, 0.27)), ((0.50, 0, 0.12), (0.25, 0.23, 0.24)),
                         ((-0.62, 0, 0.03), (0.28, 0.14, 0.08))], white, voxel=0.018, outline=None)
    add_outline(body, OUTLINE, ol)
    beak = toon_material("Beak", H("#f5b02e"))
    cone("Beak", (0.83, 0, 0.09), 0.07, 0.26, beak, rot=(0, math.radians(95), 0), outline=0.035)
    cartoon_eye(body, "Eye", 0.56, 0.20, 0.075)
    for i, y in enumerate((-0.06, 0.06)):
        ellipsoid(f"Foot{i}", (-0.40, y, -0.27), (0.10, 0.04, 0.04), beak, outline=0.03)
    # Side-view wings: swept back from the shoulder, flapping up and down in the view plane.
    # The wing material turns black toward the tip (z - 10 x above the split).
    wing_m = toon_material("WingTip", H("#2b333b"), H("#b9c4ce"), split=4.4, soft=0.04, tilt=-10)
    far_m = toon_material("WingFar", H("#20272e"), H("#97a3ae"), split=4.4, soft=0.04, tilt=-10)
    shoulder = (0.18, 0.10)
    wing = [(0.24, 0.12), (0.02, 0.28), (-0.30, 0.42), (-0.56, 0.44), (-0.44, 0.30), (-0.18, 0.10),
            (0.05, 0.04)]
    plate("WingNear", wing, wing_m, thickness=0.035, y=-0.30, outline=0.045, round_=False)
    plate("WingFar", wing, far_m, thickness=0.035, y=0.30, outline=0.045, round_=False)
    del black, grey

    def pose(name, p, phase):
        if name.startswith("Wing"):
            lag = 0.35 if name.endswith("Far") else 0.0
            rotate_xz(p, shoulder, 0.1 + 0.62 * math.sin(phase - lag))
        p[:, 2] -= 0.05 * math.sin(phase)
        return p

    return pose, 4


def pufferfish(puffed=False):
    ol = H("#6a4a10")
    r = 0.60 if puffed else 0.43
    col = H("#e9a52a") if puffed else H("#f2b134")
    m = toon_material("Puffer", col, H("#fbe6a8"), split=-0.12 * r / 0.46, soft=0.04,
                      spots=dict(color=H("#8a5a14"), scale=5.0, size=0.16, min_z=0.0))
    body = blob("Body", [((0, 0, 0), (r * (0.98 if puffed else 1.05), r * 0.9, r * 0.92))], m,
                voxel=0.02, outline=None)
    add_outline(body, OUTLINE, ol)
    sp = toon_material("Spike", H("#fff1c4"))
    n = 26 if puffed else 9
    for i in range(n):
        if puffed:
            t = TAU * i / n
            d = (math.cos(t), -0.35 - 0.25 * (i % 2), math.sin(t))
        else:
            t = math.radians(30 + i * 15)
            d = (-math.cos(t) * 0.8, -0.3, math.sin(t))
        dv = Vector(d).normalized()
        spike(f"Spike{i}", tuple(dv * r * 0.86), d, 0.20 if puffed else 0.13, 0.05, sp, ol)
    fin = fin_mat("Fin", H("#e39a1e"))
    tip = max(-0.66, -r - 0.22)
    plate("Tail", [(-r * 0.9, 0.0), (tip, 0.20), (tip + 0.06, 0.0), (tip, -0.20)], fin,
          thickness=0.03, outline=0.04)
    pect_root = (0.0, 0.0)
    er = 0.15 if puffed else 0.14
    cartoon_eye(body, "Eye", r * 0.48, r * 0.30, er)
    ink = flat_material("Ink", ol)
    if puffed:
        skin_tube(body, "Brow", [(r * 0.30, r * 0.62), (r * 0.48, r * 0.58), (r * 0.66, r * 0.50)],
                  ink, 0.02, lift=0.0)
    lips = toon_material("Lips", H("#f58a6a"))
    ellipsoid("Lips", (r * 0.96, -0.05, -r * 0.12), (0.07, 0.09, 0.075), lips, outline=0.035)

    def pose(name, p, phase):
        if name.startswith("Tail"):
            rotate_xy(p, (-r * 0.9, 0), 0.5 * math.sin(phase))
        if name.startswith("Pect"):
            rotate_xz(p, pect_root, 0.5 * math.sin(2 * phase))
        if puffed:
            s = 1 + 0.025 * math.sin(phase)
            p[:, 0] *= s
            p[:, 2] *= s
        else:
            p[:, 2] += 0.02 * math.sin(phase)
        return p

    return pose, 4


def crab():
    """Front view (it walks sideways)."""
    ol = H("#5a1410")
    shell = toon_material("Shell", H("#e0503f"), H("#f39478"), split=-0.08, soft=0.03)
    leg = toon_material("Leg", H("#c63d2e"))
    body = blob("Body", [((0, 0, 0.0), (0.56, 0.32, 0.27))], shell, voxel=0.018, outline=None)
    add_outline(body, OUTLINE, ol)
    for sgn, side in ((-1, "L"), (1, "R")):
        tube(f"Stalk{side}", [(sgn * 0.16, -0.12, 0.20), (sgn * 0.20, -0.14, 0.42)], leg, 0.035,
             outline=0.03)
        ellipsoid(f"EyeWhite{side}", (sgn * 0.20, -0.15, 0.50), (0.10, 0.08, 0.11),
                  flat_material(f"White{side}", (1, 1, 1), 1.15), outline=0.035)
        ellipsoid(f"EyePupil{side}", (sgn * 0.19, -0.22, 0.49), (0.05, 0.02, 0.06),
                  flat_material(f"Pupil{side}", (0.03, 0.03, 0.04)))
        tube(f"Arm{side}", [(sgn * 0.48, -0.10, 0.02), (sgn * 0.66, -0.14, 0.08),
                            (sgn * 0.72, -0.16, 0.22)], leg, 0.045, outline=0.035)
        ellipsoid(f"Claw{side}", (sgn * 0.74, -0.16, 0.34), (0.15, 0.11, 0.17), shell, outline=0.045)
        ellipsoid(f"Finger{side}", (sgn * 0.62, -0.16, 0.44), (0.05, 0.05, 0.11), shell,
                  rot=(0, sgn * math.radians(-35), 0), outline=0.035)
        for i in range(3):
            z = -0.06 - i * 0.07
            tube(f"Leg{side}{i}", [(sgn * 0.42, 0.02 * i, z), (sgn * (0.66 + i * 0.04), 0.02 * i, z + 0.06),
                                   (sgn * (0.78 + i * 0.05), 0.02 * i, z - 0.30)], leg, 0.032,
                 outline=0.03)
    ink = flat_material("Ink", ol)
    skin_tube(body, "Smile", [(-0.10, -0.06), (0.0, -0.11), (0.10, -0.06)], ink, 0.016, lift=0.0)

    def pose(name, p, phase):
        if name.startswith("Leg"):
            side, i = name[3], int(name[4])
            ph = phase + (i + (1 if side == "R" else 0)) * math.pi
            lift = max(0.0, math.sin(ph))
            w = smooth01((np.abs(p[:, 0]) - 0.5) / 0.3)
            p[:, 2] += 0.08 * lift * w
        if name.startswith("Finger"):
            sgn = -1 if name.endswith("L") else 1
            rotate_xz(p, (sgn * 0.66, 0.36), sgn * 0.35 * max(0.0, math.sin(2 * phase)))
        bob = 0.025 * math.sin(2 * phase)
        if not name.startswith("Leg"):
            p[:, 2] += bob
        return p

    return pose, 4


# ---------------------------------------------------------------------------------------
# Hazard
# ---------------------------------------------------------------------------------------

def jellyfish():
    ol = H("#7a2a6e")
    bell_m = toon_material("Bell", H("#ffb6e3"), H("#e889d6"), split=0.30, soft=0.10,
                           glow=(0.10, 0.02, 0.08))
    bell = blob("Bell", [((0, 0, 0.55), (0.82, 0.82, 0.62)), ((0, 0, 0.22), (0.86, 0.86, 0.18))],
                bell_m, voxel=0.025, outline=None)
    # Flatten the underside: cut away below the rim.
    for v in bell.data.vertices:
        if v.co.z + bell.location.z < 0.12:
            v.co.z = 0.12 - bell.location.z
    add_outline(bell, OUTLINE, ol)
    dots = flat_material("BellDots", H("#ffe4f6"), 1.3)
    for i, (x, z) in enumerate(((-0.35, 0.75), (0.05, 0.95), (0.40, 0.70), (-0.10, 0.55))):
        ellipsoid(f"Dot{i}", on_skin(bell, x, z, 0.0), (0.07, 0.01, 0.07), dots, segments=12, rings=6)
    tm = [toon_material("Tent0", H("#ff9fd6")), toon_material("Tent1", H("#d28aff"))]
    for i in range(7):
        x = -0.66 + i * 0.22
        y = -0.25 if i % 2 else 0.1
        tube(f"Tentacle{i}", [(x, y, 0.15), (x + 0.05, y, -0.35), (x - 0.04, y, -0.75),
                              (x + 0.03, y, -1.25)], tm[i % 2], 0.028, outline=0.025)
    arm = toon_material("Arm", H("#f7a3e0"))
    for i, x in enumerate((-0.16, 0.0, 0.16)):
        tube(f"Arm{i}", [(x, -0.3, 0.12), (x + 0.08, -0.3, -0.25), (x - 0.06, -0.3, -0.62)], arm,
             0.06, outline=0.035)

    def pose(name, p, phase):
        squash = math.sin(phase)
        if name.startswith(("Bell", "Dot")):
            p[:, 0] *= 1 + 0.07 * squash
            p[:, 2] = 0.12 + (p[:, 2] - 0.12) * (1 - 0.08 * squash)
        else:
            depth = smooth01((0.15 - p[:, 2]) / 1.3)
            p[:, 0] += 0.10 * np.sin(phase - 3.0 * p[:, 2]) * depth
            p[:, 0] *= 1 + 0.05 * squash * (1 - depth)
            p[:, 2] += 0.05 * squash
        return p

    return pose, 4


# ---------------------------------------------------------------------------------------
# Predators
# ---------------------------------------------------------------------------------------

def teeth_row(body, name, x_from, x_to, z_of, n, mat, down=True, length=0.16, lift=0.0):
    for i in range(n):
        x = x_from + (x_to - x_from) * i / max(1, n - 1)
        z = z_of(x)
        y = surface_y(body, x, z) - lift
        d = (0, 0, -1) if down else (0, 0, 1)
        obj = cone(f"{name}{i}", (x, y, z + (-length / 2 if down else length / 2)), 0.045, length, mat,
                   rot=(math.pi if down else 0, 0, 0))
        add_outline(obj, 0.025)
        del d


def shark():
    ol = H("#1c2a38")
    m = toon_material("Shark", H("#5d7488"), H("#f0f4f7"), split=-0.22, soft=0.04, tilt=-0.03)
    fin = toon_material("SharkFin", H("#52687c"))
    body = blob("Body", [((0.3, 0, 0.05), (2.3, 0.78, 0.88)), ((2.2, 0, 0.0), (1.3, 0.70, 0.74)),
                         ((3.0, 0, -0.04), (0.82, 0.50, 0.50)), ((-2.0, 0, 0.05), (1.25, 0.40, 0.45)),
                         ((-2.95, 0, 0.08), (0.55, 0.20, 0.22))], m, voxel=0.04, outline=None)
    add_outline(body, OUTLINE, ol)
    plate("Tail", [(-2.95, 0.10), (-3.80, 1.30), (-3.62, 0.40), (-3.50, 0.05), (-3.72, -0.80),
                   (-3.05, -0.10)], fin, thickness=0.07, round_=False)
    plate("Dorsal", [(-0.45, 0.72), (0.12, 1.25), (0.40, 1.72), (0.62, 1.66), (1.05, 0.78)], fin,
          thickness=0.07, round_=False)
    plate("Dorsal2", [(-2.35, 0.40), (-2.15, 0.70), (-1.95, 0.42)], fin, thickness=0.05, round_=False)
    pect_root = (1.30, -0.45)
    plate("Pect", [(1.40, -0.42), (0.40, -1.35), (0.65, -1.40), (1.00, -0.60), (1.25, -0.40)], fin,
          thickness=0.06, y=surface_y(body, 1.0, -0.5) - 0.04, round_=False)
    ink = flat_material("Ink", ol)
    for i in range(3):
        x = 1.45 + i * 0.16
        skin_tube(body, f"Gill{i}", [(x, 0.28), (x - 0.06, 0.0), (x, -0.28)], ink, 0.02, lift=0.0)
    # Mean little eye with a brow.
    cartoon_eye(body, "Eye", 2.62, 0.30, 0.15, pupil=0.7, look=(0.25, 0.0))
    skin_tube(body, "Brow", [(2.42, 0.56), (2.65, 0.50), (2.86, 0.40)], ink, 0.035, lift=0.0)
    # Toothy grin.
    mouth = flat_material("MouthDark", H("#3a1820"))

    def jaw_z(x):
        return -0.40 + 0.18 * (x - 2.4)

    skin_tube(body, "Mouth", [(3.45, -0.25), (3.0, -0.36), (2.55, -0.40), (2.25, -0.30)], mouth,
              0.06, lift=0.0)
    tooth = flat_material("Tooth", (1, 1, 1), 1.1)
    teeth_row(body, "Tooth", 2.45, 3.30, lambda x: -0.39 + 0.16 * (x - 2.45), 6, tooth,
              length=0.15, lift=0.03)
    del jaw_z
    piv = 0.6

    def pose(name, p, phase):
        if name.startswith("Pect"):
            rotate_xz(p, pect_root, 0.12 * math.sin(phase))
        w = smooth01((piv - p[:, 0]) / 4.4) ** 1.2
        rotate_xy(p, (piv, 0), 0.42 * math.sin(phase), w)
        rotate_xz(p, (piv, 0), 0.06 * math.sin(phase + 1.0), w)
        head = smooth01((p[:, 0] - 1.5) / 2.0)
        rotate_xy(p, (1.5, 0), -0.06 * math.sin(phase), head)
        return p

    return pose, 6


def orca():
    ol = H("#0a0e12")
    m = toon_material("Orca", H("#15191e"), H("#f4f6f8"), split=-0.38, soft=0.04, tilt=-0.05)
    fin = toon_material("OrcaFin", H("#15191e"))
    body = blob("Body", [((0.0, 0, 0.0), (2.8, 0.95, 1.02)), ((2.6, 0, -0.05), (1.4, 0.86, 0.88)),
                         ((3.5, 0, -0.14), (0.78, 0.62, 0.58)), ((-2.6, 0, 0.08), (1.3, 0.44, 0.52)),
                         ((-3.5, 0, 0.12), (0.55, 0.22, 0.24))], m, voxel=0.045, outline=None)
    add_outline(body, OUTLINE, ol)
    plate("Fluke", [(-3.55, 0.12), (-4.35, 0.95), (-4.05, 0.15), (-4.35, -0.65), (-3.6, 0.02)], fin,
          thickness=0.08, round_=False)
    plate("Dorsal", [(-0.55, 0.92), (0.0, 1.55), (0.15, 2.0), (0.38, 1.98), (0.62, 0.95)], fin,
          thickness=0.08, round_=False)
    pect_root = (2.0, -0.62)
    plate("Pect", [(2.15, -0.60), (1.25, -1.45), (1.60, -1.70), (2.20, -0.95)], fin, thickness=0.07,
          y=surface_y(body, 1.8, -0.7) - 0.04)
    white = toon_material("OrcaWhite", H("#f4f6f8"))
    patch = ellipsoid("EyePatch", on_skin(body, 2.55, 0.30, -0.02), (0.48, 0.05, 0.17), white,
                      rot=(0, math.radians(8), 0))
    del patch
    grey = toon_material("Saddle", H("#7d8794"))
    ellipsoid("Saddle", on_skin(body, -0.70, 0.72, -0.02), (0.55, 0.05, 0.14), grey,
              rot=(0, math.radians(-10), 0))
    cartoon_eye(body, "Eye", 3.10, 0.12, 0.14, pupil=0.72, look=(0.2, 0.0), lift=0.03)
    ink = flat_material("Ink", H("#f4f6f8"))
    skin_tube(body, "Brow", [(2.92, 0.36), (3.12, 0.32), (3.30, 0.24)], flat_material("Ink2", ol),
              0.035, lift=0.04)
    mouth = flat_material("MouthDark", H("#3a1820"))
    skin_tube(body, "Mouth", [(4.25, -0.30), (3.80, -0.40), (3.30, -0.42), (2.95, -0.32)], mouth,
              0.06, lift=0.0)
    tooth = flat_material("Tooth", (1, 1, 1), 1.1)
    teeth_row(body, "Tooth", 3.15, 4.05, lambda x: -0.41 + 0.10 * (x - 3.15), 6, tooth,
              length=0.15, lift=0.03)
    del ink

    def pose(name, p, phase):
        if name.startswith("Pect"):
            rotate_xz(p, pect_root, 0.18 * math.sin(phase))
        # Whales beat their tails up and down.
        tail = smooth01((1.0 - p[:, 0]) / 5.0) ** 1.5
        p[:, 2] += 0.55 * tail * np.sin(phase - 0.5 * (1.0 - p[:, 0]))
        head = smooth01((p[:, 0] - 1.5) / 2.5)
        p[:, 2] += 0.06 * head * math.sin(phase + math.pi)
        return p

    return pose, 6


def anglerfish():
    ol = H("#10060f")
    m = toon_material("Angler", H("#6e4270"), H("#9a6f98"), split=-0.35, soft=0.06,
                      spots=dict(color=H("#4e2c4e"), scale=3.0, size=0.18, min_z=-0.3))
    fin = toon_material("AnglerFin", H("#7e5279"))
    body = blob("Body", [((-0.25, 0, -0.10), (1.40, 1.00, 1.18)), ((0.65, 0, -0.08), (1.15, 0.95, 1.10))],
                m, voxel=0.04, outline=None)
    add_outline(body, OUTLINE, ol)
    plate("Tail", [(-1.55, 0.0), (-2.25, 0.62), (-2.05, 0.0), (-2.25, -0.62)], fin, thickness=0.06)
    plate("Dorsal", [(-0.9, 0.95), (-0.6, 1.35), (-0.3, 1.0)], fin, thickness=0.05, round_=False)
    pect_root = (-0.2, -0.3)
    # Huge gaping mouth on the near side with needle teeth.
    dark = flat_material("Maw", H("#1a0712"))
    my = surface_y(body, 1.30, -0.45) - 0.04
    ellipsoid("Maw", (1.30, my, -0.45), (0.55, 0.04, 0.42), dark, rot=(0, math.radians(-10), 0))
    tooth = flat_material("Fang", H("#f4f1e4"), 1.1)
    for i in range(6):
        x = 0.90 + i * 0.16
        obj = cone(f"FangTop{i}", (x, my - 0.05, -0.10 - 0.04 * i - 0.12), 0.05, 0.26, tooth,
                   rot=(math.pi, 0, 0))
        add_outline(obj, 0.02)
        obj = cone(f"FangLow{i}", (x + 0.06, my - 0.05, -0.80 + 0.03 * i + 0.11), 0.045, 0.22, tooth)
        add_outline(obj, 0.02)
    cartoon_eye(body, "Eye", 0.95, 0.42, 0.17, pupil=0.4, look=(0.3, -0.1))
    ink = flat_material("Ink", H("#c7b6c4"))
    skin_tube(body, "Brow", [(0.70, 0.70), (0.95, 0.64), (1.20, 0.52)], flat_material("BrowInk", ol),
              0.04, lift=0.0)
    del ink
    # Lure: stalk arching forward to a glowing bulb at the glow offset (58, -44 du).
    lure = (58 / DU_PER_BU, 44 / DU_PER_BU - 0.06)  # kept inside the frame while swaying
    stalk = toon_material("Stalk", H("#5a3a55"))
    tube("Stalk", [(0.45, 0, 0.95), (0.70, 0, 1.45), (1.40, 0, 1.75), (lure[0] - 0.05, 0, lure[1] + 0.06)],
         stalk, 0.035, outline=0.03)
    ellipsoid("Bulb", (lure[0], 0, lure[1]), (0.13, 0.13, 0.13), flat_material("Lamp", H("#e8ffff"), 2.5),
              outline=0.035)
    lure_root = (0.45, 0.95)

    def pose(name, p, phase):
        if name.startswith(("Stalk", "Bulb")):
            w = smooth01((p[:, 0] - 0.45) / 1.6)
            rotate_xz(p, lure_root, 0.08 * math.sin(phase), w)
        if name.startswith("Pect"):
            rotate_xz(p, pect_root, 0.4 * math.sin(2 * phase))
        if name.startswith("Tail"):
            rotate_xy(p, (-1.5, 0), 0.5 * math.sin(phase))
        if name.startswith(("Maw", "FangLow")):
            p[:, 2] -= 0.04 * (1 + math.sin(phase))
        return p

    return pose, 6


def barracuda():
    """Long silver hunter: dark bars on the back, underbite full of teeth, forked tail."""
    ol = H("#1e2a35")
    m = toon_material("Barracuda", H("#8ea6b8"), H("#eef3f6"), split=-0.06, soft=0.03, tilt=0.02)
    fin = toon_material("BarracudaFin", H("#5d7488"))
    body = blob("Body", [((0.15, 0, 0.0), (1.30, 0.23, 0.26)), ((1.10, 0, -0.02), (0.62, 0.19, 0.20)),
                         ((1.55, 0, -0.05), (0.30, 0.11, 0.11)), ((1.62, 0, -0.11), (0.22, 0.08, 0.06)),
                         ((-0.95, 0, 0.0), (0.62, 0.15, 0.17)), ((-1.38, 0, 0.0), (0.24, 0.08, 0.09))],
                m, voxel=0.016, outline=None)
    add_outline(body, OUTLINE, ol)
    plate("Tail", [(-1.45, 0.03), (-1.92, 0.44), (-1.74, 0.02), (-1.92, -0.42), (-1.45, -0.04)], fin,
          thickness=0.035, outline=0.05, round_=False)
    plate("Dorsal", [(0.05, 0.20), (0.22, 0.50), (0.42, 0.21)], fin, thickness=0.03, outline=0.05,
          round_=False)
    plate("Dorsal2", [(-0.95, 0.13), (-0.84, 0.34), (-0.66, 0.14)], fin, thickness=0.03, outline=0.05,
          round_=False)
    plate("Anal", [(-0.95, -0.13), (-0.84, -0.31), (-0.66, -0.14)], fin, thickness=0.03, outline=0.05,
          round_=False)
    bar = flat_material("Bar", H("#4f6577"))
    for i in range(6):
        x = 0.85 - i * 0.32
        ellipsoid(f"Bar{i}", on_skin(body, x, 0.12), (0.06, 0.01, 0.12), bar,
                  rot=(0, math.radians(-25), 0), segments=12, rings=6)
    ink = flat_material("Ink", ol)
    cartoon_eye(body, "Eye", 1.22, 0.07, 0.085, pupil=0.66, look=(0.3, 0.0))
    skin_tube(body, "Brow", [(1.09, 0.17), (1.23, 0.16), (1.36, 0.11)], ink, 0.02, lift=0.0)
    skin_tube(body, "Mouth", [(1.80, -0.10), (1.55, -0.10), (1.30, -0.08)],
              flat_material("Gape", H("#3a1820")), 0.022, lift=0.0)
    tooth = flat_material("Tooth", (1, 1, 1), 1.1)
    for i in range(5):
        x = 1.36 + i * 0.1
        y = surface_y(body, x, -0.09) - 0.02
        obj = cone(f"Tooth{i}", (x, y, -0.12), 0.026, 0.07, tooth, rot=(math.pi, 0, 0))
        add_outline(obj, 0.015)
    pect_root = (0.85, -0.08)
    plate("Pect", [(0.88, -0.06), (0.55, -0.26), (0.62, -0.08)], fin, thickness=0.025,
          y=surface_y(body, 0.7, -0.1) - 0.03, outline=0.035, round_=False)
    piv = 0.6

    def pose(name, p, phase):
        if name.startswith("Pect"):
            rotate_xz(p, pect_root, 0.3 * math.sin(phase))
        w = smooth01((piv - p[:, 0]) / 2.5) ** 1.2
        rotate_xy(p, (piv, 0), 0.5 * math.sin(phase), w)
        rotate_xz(p, (piv, 0), 0.07 * math.sin(phase + 1.0), w)
        return p

    return pose, 6


def hammerhead():
    """Shark with a cartoon hammer: the head flattens into a tall T with an eye at each end."""
    ol = H("#2a261c")
    m = toon_material("Hammer", H("#7f7a6c"), H("#f2efe6"), split=-0.22, soft=0.04, tilt=-0.03)
    fin = toon_material("HammerFin", H("#726d60"))
    body = blob("Body", [((0.2, 0, 0.05), (2.3, 0.70, 0.80)), ((2.0, 0, 0.0), (1.3, 0.60, 0.64)),
                         ((2.95, 0, -0.02), (0.62, 0.40, 0.42)), ((3.40, 0, 0.04), (0.30, 0.30, 1.02)),
                         ((-2.0, 0, 0.05), (1.25, 0.37, 0.42)), ((-2.95, 0, 0.08), (0.55, 0.19, 0.21))],
                m, voxel=0.04, outline=None)
    add_outline(body, OUTLINE, ol)
    plate("Tail", [(-2.95, 0.10), (-3.92, 1.45), (-3.68, 0.42), (-3.55, 0.05), (-3.76, -0.72),
                   (-3.05, -0.10)], fin, thickness=0.07, round_=False)
    plate("Dorsal", [(-0.35, 0.66), (0.15, 1.30), (0.35, 1.85), (0.60, 1.80), (0.95, 0.72)], fin,
          thickness=0.07, round_=False)
    plate("Dorsal2", [(-2.35, 0.38), (-2.15, 0.66), (-1.95, 0.40)], fin, thickness=0.05, round_=False)
    pect_root = (1.30, -0.45)
    plate("Pect", [(1.40, -0.42), (0.40, -1.30), (0.65, -1.36), (1.00, -0.58), (1.25, -0.40)], fin,
          thickness=0.06, y=surface_y(body, 1.0, -0.5) - 0.04, round_=False)
    ink = flat_material("Ink", ol)
    for i in range(3):
        x = 1.45 + i * 0.16
        skin_tube(body, f"Gill{i}", [(x, 0.26), (x - 0.06, 0.0), (x, -0.26)], ink, 0.02, lift=0.0)
    cartoon_eye(body, "EyeTop", 3.42, 0.84, 0.15, pupil=0.7, look=(0.25, 0.0))
    cartoon_eye(body, "EyeLow", 3.42, -0.76, 0.13, pupil=0.7, look=(0.25, 0.0))
    skin_tube(body, "Brow", [(3.18, 1.06), (3.42, 1.04), (3.64, 0.96)], ink, 0.035, lift=0.0)
    mouth = flat_material("MouthDark", H("#3a1820"))
    skin_tube(body, "Mouth", [(3.12, -0.30), (2.85, -0.42), (2.50, -0.42), (2.25, -0.32)], mouth,
              0.06, lift=0.0)
    tooth = flat_material("Tooth", (1, 1, 1), 1.1)
    teeth_row(body, "Tooth", 2.42, 3.02, lambda x: -0.41 + 0.10 * (x - 2.42), 5, tooth,
              length=0.14, lift=0.03)
    piv = 0.6

    def pose(name, p, phase):
        if name.startswith("Pect"):
            rotate_xz(p, pect_root, 0.12 * math.sin(phase))
        w = smooth01((piv - p[:, 0]) / 4.4) ** 1.2
        rotate_xy(p, (piv, 0), 0.42 * math.sin(phase), w)
        rotate_xz(p, (piv, 0), 0.06 * math.sin(phase + 1.0), w)
        head = smooth01((p[:, 0] - 1.5) / 2.0)
        rotate_xy(p, (1.5, 0), -0.06 * math.sin(phase), head)
        return p

    return pose, 6


def eel(kind):
    """Long eel facing right that waves in the view plane. moray: mottled green, gaping jaw
    with fangs, fin along the back. electric: dark blue knifefish with glowing yellow bands."""
    moray = kind == "moray"
    if moray:
        ol = H("#22300f")
        m = toon_material("Eel", H("#7d9a3e"), H("#c9d98a"), split=-0.18, soft=0.05,
                          spots=dict(color=H("#3e5220"), scale=4.5, size=0.28, max_x=2.2))
        fin = toon_material("EelFin", H("#6c8836"))
    else:
        ol = H("#0c1430")
        m = toon_material("Eel", H("#2c3d6a"), H("#6c86c4"), split=-0.16, soft=0.05)
        fin = toon_material("EelFin", H("#3a4f86"))
    x0, x1 = -2.95 + 0.15, 2.30  # body tube from near the tail tip to the head
    # Tapers evenly from the head to a thin tail; many overlapping parts keep it smooth.
    radius = lambda x: 0.05 + 0.27 * smooth01(np.clip((x - x0) / (x1 - x0), 0, 1) ** 0.7)  # noqa: E731
    parts = []
    n = 28
    for i in range(n):
        x = x0 + i / (n - 1) * (x1 - x0)
        r = float(radius(x))
        parts.append(((x, 0, 0.0), (0.32, r * 0.9, r)))
    if moray:
        parts += [((2.42, 0, 0.08), (0.58, 0.30, 0.30)),
                  ((2.30, 0, -0.20), (0.50, 0.24, 0.13), (0, math.radians(10), 0))]
    else:
        parts += [((2.40, 0, 0.0), (0.55, 0.28, 0.28)), ((2.80, 0, -0.02), (0.20, 0.18, 0.18))]
    body = blob("Body", parts, m, voxel=0.022, outline=None)
    add_outline(body, OUTLINE, ol)
    if moray:
        # A long low fin along the back, from behind the head to the tail tip.
        plate("FinTop", [(1.85, 0.20), (1.40, 0.46), (0.40, 0.50), (-0.80, 0.42), (-2.00, 0.30),
                         (-2.95, 0.04), (-2.00, 0.10), (-0.80, 0.18), (0.40, 0.20), (1.40, 0.16)],
              fin, thickness=0.04, y=0.05, outline=0.05)
        plate("FinLow", [(0.20, -0.22), (-0.80, -0.38), (-2.00, -0.28), (-2.95, -0.03), (-2.00, -0.10),
                         (-0.80, -0.16)], fin, thickness=0.04, y=0.05, outline=0.05)
    else:
        # Knifefish: one long ribbon fin along the belly.
        plate("FinLow", [(1.70, -0.20), (0.60, -0.48), (-0.80, -0.46), (-2.00, -0.32), (-2.95, -0.03),
                         (-2.00, -0.10), (-0.80, -0.18), (0.60, -0.18)], fin, thickness=0.04, y=0.05,
              outline=0.05)
        band = flat_material("Band", H("#ffe14d"), 2.2)
        for i in range(6):
            x = 1.55 - i * 0.62
            r = float(radius(x))
            skin_tube(body, f"Band{i}", [(x + 0.05, r * 0.85), (x - 0.03, 0.0), (x + 0.05, -r * 0.85)],
                      band, 0.035, lift=0.0)
    ink = flat_material("Ink", ol)
    if moray:
        maw = flat_material("Maw", H("#3a1220"))
        my = surface_y(body, 2.62, -0.10) - 0.02
        ellipsoid("Maw", (2.62, my, -0.10), (0.36, 0.04, 0.10), maw, rot=(0, math.radians(-8), 0))
        tooth = flat_material("Fang", H("#f4f1e4"), 1.1)
        for i in range(4):
            x = 2.40 + i * 0.14
            obj = cone(f"FangTop{i}", (x, my - 0.03, -0.04 - 0.012 * i), 0.03, 0.10, tooth,
                       rot=(math.pi, 0, 0))
            add_outline(obj, 0.015)
            obj = cone(f"FangLow{i}", (x + 0.05, my - 0.03, -0.18 + 0.015 * i), 0.026, 0.09, tooth)
            add_outline(obj, 0.015)
        cartoon_eye(body, "Eye", 2.52, 0.20, 0.11, pupil=0.55, look=(0.3, 0.0))
        skin_tube(body, "Brow", [(2.36, 0.33), (2.52, 0.33), (2.68, 0.27)], ink, 0.025, lift=0.0)
        for i, x in enumerate((2.86, 2.92)):
            obj = cone(f"Nostril{i}", (x, surface_y(body, x - 0.1, 0.12) - 0.02 + 0.04 * i, 0.16), 0.025,
                       0.12, fin, rot=(0, math.radians(35), 0))
            add_outline(obj, 0.015, ol)
    else:
        cartoon_eye(body, "Eye", 2.62, 0.10, 0.075, pupil=0.7, look=(0.3, 0.0))
        skin_tube(body, "Mouth", [(2.98, -0.06), (2.85, -0.11), (2.68, -0.10)], ink, 0.02, lift=0.0)
    head_x = 1.9

    def pose(name, p, phase):
        # A wave runs from the head to the tail in the visible plane; the head stays put.
        x = p[:, 0]
        w = smooth01((head_x - x) / 4.0)
        p[:, 2] += 0.17 * np.sin(phase + 2.0 * (x - head_x)) * w
        if moray and name.startswith(("Maw", "FangLow")):
            p[:, 2] -= 0.025 * (1 + math.sin(phase * 2))
        return p

    return pose, 6


BOSS_STYLES = {
    "kraken": dict(body="#d9473f", belly="#ff9b85", spot="#9e2a35", fin="#c53c3a", outline="#3d0f16",
                   sucker="#ffd2c4"),
    "colossal": dict(body="#e6ecf6", belly="#ffffff", spot="#a9b8d6", fin="#cdd8ec", outline="#25304a",
                     sucker="#ffffff", eye_glow="#7fd8ff"),
    "abyssal": dict(body="#4d2a7a", belly="#7a4fb0", spot="#2e164f", fin="#5b3290", outline="#14061f",
                    sucker="#e8c9ff", glow="#ff5fd0"),
}


def giant_squid(style):
    """Boss squid, arms first (facing right): long mantle and fins trailing left, a huge eye,
    eight writhing arms and two feeding tentacles with clubs."""
    s = BOSS_STYLES[style]
    ol = H(s["outline"])
    m = toon_material("Squid", H(s["body"]), H(s["belly"]), split=-0.5, soft=0.2,
                      spots=dict(color=H(s["spot"]), scale=1.6, size=0.2))
    fin = toon_material("SquidFin", H(s["fin"]))
    mantle = blob("Body", [((-2.5, 0, 0.25), (2.5, 1.15, 1.20)), ((-4.4, 0, 0.30), (1.25, 0.78, 0.82)),
                           ((-5.3, 0, 0.32), (0.55, 0.40, 0.40)), ((0.2, 0, 0.0), (1.05, 1.05, 1.05)),
                           ((1.0, 0, -0.05), (0.6, 0.85, 0.80))], m, voxel=0.05, outline=None)
    add_outline(mantle, OUTLINE * 1.4, ol)
    # Rhomboid fin around the mantle tip.
    plate("Fin", [(-3.9, 0.32), (-5.0, 1.75), (-6.25, 0.34), (-5.0, -1.10)], fin, thickness=0.1, y=0.3,
          outline=OUTLINE * 1.3, round_=False)
    arm_m = toon_material("Arm", H(s["body"]), H(s["belly"]), split=-0.15, soft=0.06)
    sucker = flat_material("Sucker", H(s["sucker"]), 1.05)
    arms = []
    # (root z, depth y, length, end lift): spread out from the head.
    specs = [(0.65, 0.5, 3.8, 1.4), (0.45, 0.2, 4.4, 0.9), (0.25, -0.2, 4.8, 0.4), (0.05, -0.5, 4.6, -0.2),
             (-0.15, 0.4, 4.4, -0.7), (-0.35, -0.1, 4.5, -1.1), (-0.55, -0.45, 4.1, -1.5),
             (-0.70, 0.3, 3.6, -1.9)]
    for i, (z0, y, length, lift) in enumerate(specs):
        # Many overlapping parts so the thin tips stay one smooth piece.
        parts = []
        k = 22
        for j in range(k):
            u = j / (k - 1)
            x = 1.2 + u * length
            z = z0 + lift * u ** 1.4 + 0.25 * math.sin(u * 3.0 + i)
            r = 0.36 * (1 - u) + 0.07
            parts.append(((x, y, z), (max(r, length / k * 1.3), r, r)))
        arms.append(blob(f"Arm{i}", parts, arm_m, voxel=0.045, outline=None))
        add_outline(arms[-1], OUTLINE, ol)
    # Two feeding tentacles, thin, ending in clubs.
    for i, (z0, lift) in enumerate(((0.15, 1.1), (-0.25, -1.3))):
        parts = []
        k = 20
        for j in range(k):
            u = j / (k - 1)
            parts.append(((1.2 + u * 4.5, -0.7, z0 + lift * u ** 1.2), (0.3, 0.11, 0.11)))
        parts.append(((5.55, -0.7, z0 + lift + 0.05), (0.42, 0.22, 0.26)))
        arms.append(blob(f"ArmClub{i}", parts, arm_m, voxel=0.04, outline=None))
        add_outline(arms[-1], OUTLINE, ol)
    # Suckers along the underside of the near arms.
    for a in (arms[3], arms[5], arms[8], arms[9]):
        verts = [a.matrix_world @ v.co for v in a.data.vertices]
        for j in range(6):
            x = 1.9 + j * 0.55
            near = [c for c in verts if abs(c.x - x) < 0.08]
            if not near:
                continue
            zc = min(c.z for c in near) + 0.07
            ysurf = surface_y(a, x, zc, fallback=None)
            if ysurf is None:
                continue
            ellipsoid(f"{a.name}Sucker{j}", (x, ysurf - 0.02, zc), (0.09, 0.03, 0.06), sucker,
                      segments=12, rings=6)
    if s.get("glow"):
        g = flat_material("Photophore", H(s["glow"]), 2.4)
        rng = np.random.default_rng(7)
        for j in range(16):
            x = rng.uniform(-5.0, -0.6)
            z = rng.uniform(-0.6, 1.1)
            ysurf = surface_y(mantle, x, z, fallback=None)
            if ysurf is None:
                continue
            ellipsoid(f"Glow{j}", (x, ysurf - 0.02, z), (0.11, 0.02, 0.11), g, segments=12, rings=6)
    cartoon_eye(mantle, "Eye", 0.35, 0.28, 0.46, pupil=0.5, look=(0.3, -0.05))
    if s.get("eye_glow"):
        ring = flat_material("EyeRing", H(s["eye_glow"]), 2.0)
        ellipsoid("EyeRing", on_skin(mantle, 0.35, 0.28, -0.005), (0.56, 0.02, 0.56), ring)
    skin_tube(mantle, "Brow", [(-0.10, 0.80), (0.35, 0.86), (0.80, 0.70)], flat_material("BrowInk", ol),
              0.07, lift=0.0)

    def pose(name, p, phase):
        if name.startswith("Arm"):
            i = int(name[3]) if name[3].isdigit() else 8 + int(name[7])
            x = p[:, 0]
            w = smooth01((x - 1.1) / 4.5)
            p[:, 2] += 0.42 * np.sin(phase - 1.3 * (x - 1.1) + i * 0.8) * w
            p[:, 0] -= 0.12 * (1 + math.sin(phase + i * 0.5)) * w
        if name.startswith("Fin"):
            k = smooth01((-p[:, 0] - 3.9) / 2.3)
            p[:, 2] += 0.25 * math.sin(phase) * k * np.sign(p[:, 2] - 0.3)
        if name == "Body" or name.startswith(("Eye", "Glow", "Brow")):
            # The mantle swells and squeezes.
            w = smooth01((-p[:, 0] - 0.5) / 3.0)
            p[:, 2] = 0.3 + (p[:, 2] - 0.3) * (1.0 + 0.05 * math.sin(phase) * w)
        return p

    return pose, 6


# key -> (builder, design size of one frame[, px per du])
CREATURES = {
    "creature-minnow": (minnow, (48, 26)),
    "creature-shrimp": (shrimp, (44, 32)),
    "creature-sardine": (sardine, (60, 26)),
    "creature-squid": (squid, (70, 36)),
    "creature-penguin": (penguin, (60, 34)),
    "creature-turtle": (turtle, (86, 58)),
    "creature-seabird": (seabird, (72, 44)),
    "creature-pufferfish": (pufferfish, (40, 32)),
    "creature-pufferfish-puffed": (lambda: pufferfish(True), (40, 40)),
    "creature-crab": (crab, (52, 36)),
    "creature-lanternfish": (lanternfish, (38, 20)),
    "predator-shark": (shark, (220, 104)),
    "predator-orca": (orca, (250, 120)),
    "predator-anglerfish": (anglerfish, (130, 96)),
    "hazard-jellyfish": (jellyfish, (60, 80)),
    "predator-barracuda": (barracuda, (110, 40)),
    "predator-hammerhead": (hammerhead, (240, 110)),
    "creature-moray": (lambda: eel("moray"), (170, 44)),
    "creature-eel-electric": (lambda: eel("electric"), (180, 44)),
    "boss-kraken": (lambda: giant_squid("kraken"), (380, 200), 2),
    "boss-colossal": (lambda: giant_squid("colossal"), (380, 200), 2),
    "boss-abyssal": (lambda: giant_squid("abyssal"), (380, 200), 2),
}


def render_creature(key):
    builder, size, *px = CREATURES[key]
    clear_scene()
    pose, frames = builder()
    setup_render(*size, px=px[0] if px else 3)
    poser = Poser((0.0, 0.0))

    class Frames:
        def apply(self, phase):
            poser.apply(lambda name, p: pose(name, p, phase))

    poses = [dict(phase=TAU * i / frames) for i in range(frames)]
    return render_frames(Frames(), poses, os.path.join(OUT_DIR, f"{key}-sheet.png"), COLS)


only = [s for s in globals().get("ONLY", "").split(",") if s]
keys = [k for k in CREATURES if not only or any(o in k for o in only)]
result = {k.split("-", 1)[1]: render_creature(k)["frames"] for k in keys}
