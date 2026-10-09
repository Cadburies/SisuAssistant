# Marine Board enclosure — FreeCAD 1.0
#
# Two printed parts, same split as the PCBWay box in
# MarineBoard/Documentation/PCBWay delivery 2026-08-15/
# Enclosure Design File (superseded)/:
#   bottom — the board screws to bosses in the floor
#   lid    — drops on, four corner screws
#
# FreeCAD +Y is north, the top of the KiCad 3D view (antenna and U9).
# The board is centered east-west. East, west, and south gutters are 20 mm.
# North stays the short side.
# KiCad's file +Y points south. Board features are stored after fy().
# Do not mirror the STEP: that puts the ESP32 at the south end.
# There is no USB-C cutout: the first flash is done with the board out,
# and later updates are OTA.
#
# Rebuild:
#   /Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd MarineBoard/enclosure/make_enclosure.py
#
# Assumptions, change the constants and rebuild if a real connector differs:
#   EW-LP20 panel front-mount: hole 22.5 mm +0.2, datasheet EW-LP20L
#   M12 5-pin and both 12G sockets: 12 mm panel hole, modelled at 12.4 mm
#   Panel holes: one LP20-3, one M12-5, one 12G-2, three 12G-3.
#   Female plugs are not modelled.
#   M12 flange screws are not modelled (the bolt pattern is not on the listing)
#   2.0 mm round silicone cord in the lid groove
#   M3 self-tapping screws, blind holes, so nothing pierces the floor

import math
import os

import FreeCAD as App
import Part

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"

# Board, from MarineBoard.kicad_pcb Edge.Cuts. Origin is the min corner.
# fy() flips the file's Y so FreeCAD +Y matches the KiCad 3D view.
BOARD_X = 83.0
BOARD_Y = 67.5
BOARD_T = 1.6


def fy(file_y):
    return BOARD_Y - file_y


H1 = (3.50, fy(3.50))
H2 = (79.25, fy(4.00))
H3 = (78.50, fy(63.50))
H4 = (3.50, fy(63.50))
D5 = (58.53, fy(32.92))
HOLES = (H1, H2, H3, H4)

# Clearance from the inner wall to the board edge.
# East and west are equal, so the board is centered that way. North (U9)
# stays short. South is the power gutter.
SIDE = 20.0
LEFT = SIDE     # west, U13
RIGHT = SIDE    # east, U4 U5 U6 U7
FRONT = 20.0    # south, relay / CN1 / CN2
BACK = 14.0     # north, U9 / antenna

WALL = 3.2
FLOOR = 2.8
INNER_H = 38.0
SHELL_R = 6.5
# 12 mm clears L2. The KiCad model (B82477, 8.5 mm) hangs 8.6 mm below
# the board. A 9 mm boss left 0.4 mm, which is not enough.
STANDOFF_H = 12.0
STANDOFF_OD = 8.0
BOARD_PILOT_D = 2.7    # M3 thread-forming
BOARD_PILOT_DEPTH = 5.0

# Cord sits in a ledge just inside the wall, inboard of the corner screws.
LEDGE_W = 13.5
LEDGE_H = 4.0
GROOVE_INSET = 13.5    # from the outside face to the outer edge of the groove
GROOVE_W = 2.0
GROOVE_D = 1.3         # 2.0 mm cord stands proud by about 0.7 mm

LID_T = 3.2
LIP_GAP = 0.45
LIP_T = 1.5
LIP_H = 2.6

# Corner screws, in the solid corner, outside the cord.
SCREW_XY_INSET = 7.0
POST_R = 4.5
LID_CLEAR_D = 3.4
LID_BORE_D = 6.2
LID_BORE_H = 1.8
POST_PILOT_D = 2.6
POST_PILOT_DEPTH = 9.0

# (outside legend, wall, position, diameter)
# south/north position is board X. east/west position is board Y (north +).
# Legends read left to right facing that wall, in pin order: south wall is
# west-to-east, east wall is south-to-north.
# East terminals are 7.5–9.5 mm apart, closer than two Ø12.4 holes, so those
# three holes keep that order at EAST_PITCH, centered on U7 / U4 / U5+U6.
EAST_PITCH = 20.0
_east_targets = (fy(13.50), fy(23.02), (fy(31.02) + fy(38.52)) / 2.0)
_east_mid = sum(_east_targets) / 3.0
_east = (
    _east_mid + EAST_PITCH,
    _east_mid,
    _east_mid - EAST_PITCH,
)
CONNECTORS = (
    ("TMP/RPM/ENBL", "west", fy(25.50), 12.4),       # opposite U13
    ("GND/+12V/PWM", "south", 39.50, 22.7),          # LP20, opposite F1
    ("NO/CO/NC", "south", 12.80, 12.4),              # opposite U12
    ("CAN", "east", _east[0], 12.4),                 # M12, opposite U7
    ("SH-/SH+", "east", _east[1], 12.4),             # opposite U4
    ("LVL2/+12V/LVL1", "east", _east[2], 12.4),      # opposite U5/U6
)
CONN_Z = 20.0
LABEL_SIZE = 2.2
LABEL_DEPTH = 0.55

LIGHT_D = 5.2
LIGHT_BOSS_OD = 9.0
LIGHT_BOSS_H = 8.0
LIGHT_CB_D = 10.0
LIGHT_CB_H = 1.4
LED_ABOVE_BOARD = 0.9

INNER_X = LEFT + BOARD_X + RIGHT
INNER_Y = FRONT + BOARD_Y + BACK
OUTER_X = INNER_X + 2 * WALL
OUTER_Y = INNER_Y + 2 * WALL
BODY_Z = FLOOR + INNER_H
BOARD_X0 = WALL + LEFT
BOARD_Y0 = WALL + FRONT


def v(x, y, z=0.0):
    return App.Vector(x, y, z)


def rounded_rect_face(x, y, w, h, r, z=0.0):
    r = min(r, w / 2.0 - 0.05, h / 2.0 - 0.05)
    if r < 0.2:
        wire = Part.makePolygon([
            v(x, y, z), v(x + w, y, z), v(x + w, y + h, z), v(x, y + h, z), v(x, y, z)
        ])
        return Part.Face(wire)

    def arc(cx, cy, a0, a1):
        mid = (a0 + a1) / 2.0

        def pt(a):
            return v(cx + r * math.cos(a), cy + r * math.sin(a), z)

        return Part.Arc(pt(a0), pt(mid), pt(a1)).toShape()

    shapes = [
        Part.makeLine(v(x + r, y, z), v(x + w - r, y, z)),
        arc(x + w - r, y + r, -math.pi / 2, 0),
        Part.makeLine(v(x + w, y + r, z), v(x + w, y + h - r, z)),
        arc(x + w - r, y + h - r, 0, math.pi / 2),
        Part.makeLine(v(x + w - r, y + h, z), v(x + r, y + h, z)),
        arc(x + r, y + h - r, math.pi / 2, math.pi),
        Part.makeLine(v(x, y + h - r, z), v(x, y + r, z)),
        arc(x + r, y + r, math.pi, 3 * math.pi / 2),
    ]
    wire = Part.Wire(shapes)
    if not wire.isClosed():
        raise RuntimeError("rounded rect did not close")
    return Part.Face(wire)


def prism(x, y, w, h, z0, z1, r):
    face = rounded_rect_face(x, y, w, h, r, z0)
    return face.extrude(v(0, 0, z1 - z0))


def ring(x, y, w, h, z0, height, outer_r, inset_a, inset_b):
    outer = prism(
        x + inset_a, y + inset_a, w - 2 * inset_a, h - 2 * inset_a,
        z0, z0 + height, max(0.4, outer_r - inset_a),
    )
    inner = prism(
        x + inset_b, y + inset_b, w - 2 * inset_b, h - 2 * inset_b,
        z0 - 0.2, z0 + height + 0.2, max(0.4, outer_r - inset_b),
    )
    return outer.cut(inner)


def add(doc, name, shape):
    obj = doc.addObject("Part::Feature", name)
    obj.Shape = shape
    return obj


def shapestring(doc, text, size):
    import Draft
    obj = Draft.make_shapestring(String=text, FontFile=FONT, Size=size, Tracking=0)
    doc.recompute()
    shape = obj.Shape.copy()
    doc.removeObject(obj.Name)
    if shape.isNull() or len(shape.Faces) == 0:
        raise RuntimeError("label failed: %s" % text)
    bb = shape.BoundBox
    shape.translate(v(-(bb.XMin + bb.XMax) / 2.0, -bb.YMin, -bb.ZMin))
    return shape


def outside_label(doc, text, wall, cx, cy, hole_d):
    """Legend on the outer face, upright with the lid up, reading left to right."""
    shape = shapestring(doc, text, LABEL_SIZE)
    width = shape.BoundBox.XLength
    shape.rotate(v(0, 0, 0), v(1, 0, 0), 90)
    z0 = CONN_Z + hole_d / 2.0 + 1.2
    depth = LABEL_DEPTH
    if wall == "south":
        shape.translate(v(cx, -0.2, z0))
        solid = shape.extrude(v(0, depth + 0.2, 0))
    elif wall == "east":
        shape.rotate(v(0, 0, 0), v(0, 0, 1), 90)
        shape.translate(v(OUTER_X + 0.2, cy, z0))
        solid = shape.extrude(v(-(depth + 0.2), 0, 0))
    elif wall == "west":
        shape.rotate(v(0, 0, 0), v(0, 0, 1), -90)
        shape.translate(v(-0.2, cy, z0))
        solid = shape.extrude(v(depth + 0.2, 0, 0))
    else:
        raise RuntimeError("no outside face for %s" % wall)
    if z0 + LABEL_SIZE > BODY_Z - 1.0:
        raise RuntimeError("label %s hits the lid rim" % text)
    return solid, width


def screw_points():
    return (
        (SCREW_XY_INSET, SCREW_XY_INSET),
        (OUTER_X - SCREW_XY_INSET, SCREW_XY_INSET),
        (OUTER_X - SCREW_XY_INSET, OUTER_Y - SCREW_XY_INSET),
        (SCREW_XY_INSET, OUTER_Y - SCREW_XY_INSET),
    )


def require_inside(shape, point, expect, label):
    hit = shape.isInside(v(*point), 0.08, True)
    if hit != expect:
        raise RuntimeError("%s: inside=%s, wanted %s at %s" % (label, hit, expect, point))


def build():
    doc = App.newDocument("MarineBoardEnclosure")

    body = prism(0, 0, OUTER_X, OUTER_Y, 0, BODY_Z, SHELL_R)
    cavity = prism(WALL, WALL, INNER_X, INNER_Y, FLOOR, BODY_Z + 1, 3.0)
    body = body.cut(cavity)

    for cx, cy in screw_points():
        body = body.fuse(Part.makeCylinder(POST_R, BODY_Z - FLOOR, v(cx, cy, FLOOR)))

    ledge_outer = prism(WALL, WALL, INNER_X, INNER_Y, BODY_Z - LEDGE_H, BODY_Z, 2.5)
    ledge_inner = prism(
        WALL + LEDGE_W, WALL + LEDGE_W,
        INNER_X - 2 * LEDGE_W, INNER_Y - 2 * LEDGE_W,
        BODY_Z - LEDGE_H - 0.2, BODY_Z + 0.2, 1.5,
    )
    body = body.fuse(ledge_outer.cut(ledge_inner))

    groove = ring(
        0, 0, OUTER_X, OUTER_Y, BODY_Z - GROOVE_D, GROOVE_D + 0.4,
        SHELL_R, GROOVE_INSET, GROOVE_INSET + GROOVE_W,
    )
    body = body.cut(groove)

    for cx, cy in screw_points():
        pilot = Part.makeCylinder(POST_PILOT_D / 2.0, POST_PILOT_DEPTH + 0.2, v(cx, cy, BODY_Z - POST_PILOT_DEPTH))
        body = body.cut(pilot)

    for hx, hy in HOLES:
        cx = BOARD_X0 + hx
        cy = BOARD_Y0 + hy
        stand = Part.makeCylinder(STANDOFF_OD / 2.0, STANDOFF_H, v(cx, cy, FLOOR))
        pilot = Part.makeCylinder(
            BOARD_PILOT_D / 2.0, BOARD_PILOT_DEPTH + 0.2,
            v(cx, cy, FLOOR + STANDOFF_H - BOARD_PILOT_DEPTH),
        )
        body = body.fuse(stand).cut(pilot)

    placed = []
    for name, wall, pos, dia in CONNECTORS:
        if wall == "south":
            cx, cy = BOARD_X0 + pos, 0.0
            hole = Part.makeCylinder(dia / 2.0, WALL + 2.0, v(cx, -1.0, CONN_Z), v(0, 1, 0))
        elif wall == "east":
            cx, cy = OUTER_X, BOARD_Y0 + pos
            hole = Part.makeCylinder(dia / 2.0, WALL + 2.0, v(OUTER_X - WALL - 1.0, cy, CONN_Z), v(1, 0, 0))
        elif wall == "west":
            cx, cy = 0.0, BOARD_Y0 + pos
            hole = Part.makeCylinder(dia / 2.0, WALL + 2.0, v(-1.0, cy, CONN_Z), v(1, 0, 0))
        else:
            raise RuntimeError("unknown wall %s" % wall)
        body = body.cut(hole)
        label, width = outside_label(doc, name, wall, cx, cy, dia)
        body = body.cut(label)
        placed.append((name, wall, cx, cy, dia, width))
        print("HOLE %-16s %-5s at %.1f, %.1f   dia %.1f   label %.1f mm" % (name, wall, cx, cy, dia, width))

    for i, (n1, w1, x1, y1, d1, lab1) in enumerate(placed):
        for n2, w2, x2, y2, d2, lab2 in placed[i + 1:]:
            if w1 != w2:
                continue
            gap = math.hypot(x1 - x2, y1 - y2) - d1 / 2.0 - d2 / 2.0
            if gap < 3.0:
                raise RuntimeError("%s and %s leave only %.1f mm of wall" % (n1, n2, gap))
            if abs((x1 - x2) if w1 == "south" else (y1 - y2)) < (lab1 + lab2) / 2.0 + 1.0:
                raise RuntimeError("labels %s and %s overlap" % (n1, n2))

    lid = prism(0, 0, OUTER_X, OUTER_Y, BODY_Z, BODY_Z + LID_T, SHELL_R)
    lip_x = WALL + LEDGE_W + LIP_GAP
    lip_y = WALL + LEDGE_W + LIP_GAP
    lip_w = INNER_X - 2 * (LEDGE_W + LIP_GAP)
    lip_h = INNER_Y - 2 * (LEDGE_W + LIP_GAP)
    lip_outer = prism(lip_x, lip_y, lip_w, lip_h, BODY_Z - LIP_H, BODY_Z, 1.2)
    lip_inner = prism(
        lip_x + LIP_T, lip_y + LIP_T, lip_w - 2 * LIP_T, lip_h - 2 * LIP_T,
        BODY_Z - LIP_H - 0.2, BODY_Z + 0.2, 0.8,
    )
    lid = lid.fuse(lip_outer.cut(lip_inner))

    for cx, cy in screw_points():
        lid = lid.cut(Part.makeCylinder(LID_CLEAR_D / 2.0, LID_T + 2.0, v(cx, cy, BODY_Z - 1.0)))
        lid = lid.cut(Part.makeCylinder(LID_BORE_D / 2.0, LID_BORE_H + 0.2, v(cx, cy, BODY_Z + LID_T - LID_BORE_H)))

    lx = BOARD_X0 + D5[0]
    ly = BOARD_Y0 + D5[1]
    led_z = FLOOR + STANDOFF_H + BOARD_T + LED_ABOVE_BOARD
    boss_bottom = BODY_Z - LIGHT_BOSS_H
    if boss_bottom < led_z + 8.0:
        raise RuntimeError("light-pipe boss reaches the LED")
    boss = Part.makeCylinder(LIGHT_BOSS_OD / 2.0, LIGHT_BOSS_H, v(lx, ly, boss_bottom))
    bore = Part.makeCylinder(LIGHT_D / 2.0, LIGHT_BOSS_H + LID_T + 2.0, v(lx, ly, boss_bottom - 1.0))
    counter = Part.makeCylinder(LIGHT_CB_D / 2.0, LIGHT_CB_H + 1.0, v(lx, ly, BODY_Z + LID_T - LIGHT_CB_H))
    lid = lid.fuse(boss).cut(bore).cut(counter)

    board = Part.makeBox(BOARD_X, BOARD_Y, BOARD_T, v(BOARD_X0, BOARD_Y0, FLOOR + STANDOFF_H))
    for hx, hy in HOLES:
        board = board.cut(Part.makeCylinder(
            1.6, BOARD_T + 1.0, v(BOARD_X0 + hx, BOARD_Y0 + hy, FLOOR + STANDOFF_H - 0.5)
        ))

    body_obj = add(doc, "Bottom", body)
    lid_obj = add(doc, "Lid", lid)
    board_obj = add(doc, "Board_outline_not_printed", board)
    for obj, color in (
        (body_obj, (0.55, 0.32, 0.12)),
        (lid_obj, (0.95, 0.82, 0.15)),
        (board_obj, (0.15, 0.55, 0.30)),
    ):
        try:
            obj.ViewObject.ShapeColor = color
        except Exception:
            pass
    try:
        board_obj.ViewObject.Transparency = 35
    except Exception:
        pass

    doc.recompute()
    for obj in (body_obj, lid_obj, board_obj):
        if not obj.Shape.isValid() or len(obj.Shape.Solids) != 1:
            raise RuntimeError("%s is not one valid solid (%d)" % (obj.Name, len(obj.Shape.Solids)))

    # Fit checks. A shared face (board on a boss, lid on the rim) has no volume.
    if body.common(board).Volume > 1.0:
        raise RuntimeError("board intersects the bottom")
    if body.common(lid).Volume > 1.0:
        raise RuntimeError("lid intersects the bottom")

    for name, wall, cx, cy, dia, _width in placed:
        if wall == "south":
            center = (cx, WALL / 2.0, CONN_Z)
            beside = (cx, WALL / 2.0, CONN_Z + dia / 2.0 + 2.0)
        elif wall == "east":
            center = (OUTER_X - WALL / 2.0, cy, CONN_Z)
            beside = (OUTER_X - WALL / 2.0, cy, CONN_Z + dia / 2.0 + 2.0)
        else:
            center = (WALL / 2.0, cy, CONN_Z)
            beside = (WALL / 2.0, cy, CONN_Z + dia / 2.0 + 2.0)
        require_inside(body, center, False, name + " hole")
        require_inside(body, beside, True, name + " wall")

    hx, hy = H1
    require_inside(body, (BOARD_X0 + hx, BOARD_Y0 + hy, FLOOR + STANDOFF_H - 1.0), False, "board pilot")
    require_inside(body, (BOARD_X0 + hx, BOARD_Y0 + hy, FLOOR + 2.0), True, "plastic under board pilot")
    require_inside(body, (OUTER_X / 2.0, OUTER_Y / 2.0, 1.0), True, "floor")
    require_inside(body, (OUTER_X / 2.0, (GROOVE_INSET + GROOVE_W / 2.0), BODY_Z - 0.4), False, "gasket groove")
    require_inside(body, (OUTER_X / 2.0, (GROOVE_INSET + GROOVE_W / 2.0), BODY_Z - 2.4), True, "ledge under groove")
    sx, sy = screw_points()[0]
    require_inside(body, (sx, sy, BODY_Z - 1.0), False, "lid-screw pilot")
    require_inside(body, (sx, sy, BODY_Z - POST_PILOT_DEPTH - 1.0), True, "plastic under lid-screw pilot")
    require_inside(lid, (lx, ly, BODY_Z + LID_T / 2.0), False, "light bore")
    require_inside(lid, (lx + 8.0, ly, BODY_Z + LID_T / 2.0), True, "lid beside light bore")
    # Wire channels stay open at board height.
    channel_z = FLOOR + STANDOFF_H + 4.0
    require_inside(body, (BOARD_X0 + BOARD_X + RIGHT / 2.0, BOARD_Y0 + 30.0, channel_z), False, "east gutter")
    require_inside(body, (WALL + LEFT / 2.0, BOARD_Y0 + 30.0, channel_z), False, "west gutter")
    require_inside(body, (BOARD_X0 + 55.0, WALL + FRONT / 2.0, channel_z), False, "power gutter")

    lid_print = lid.copy()
    lid_print.rotate(v(0, 0, 0), v(1, 0, 0), 180)
    lid_print.translate(v(0, 0, -lid_print.BoundBox.ZMin))

    fcstd = os.path.join(HERE, "MarineBoard-enclosure.FCStd")
    doc.saveAs(fcstd)

    import Import
    import MeshPart

    Import.export([body_obj, lid_obj], os.path.join(HERE, "MarineBoard-enclosure.step"))
    Import.export([body_obj], os.path.join(HERE, "MarineBoard-enclosure-bottom.step"))
    Import.export([lid_obj], os.path.join(HERE, "MarineBoard-enclosure-top.step"))

    MeshPart.meshFromShape(Shape=body, LinearDeflection=0.08, AngularDeflection=0.3).write(
        os.path.join(HERE, "MarineBoard-enclosure-body.stl")
    )
    MeshPart.meshFromShape(Shape=lid_print, LinearDeflection=0.08, AngularDeflection=0.3).write(
        os.path.join(HERE, "MarineBoard-enclosure-lid.stl")
    )

    bb = body.BoundBox
    print("BOTTOM  %.1f x %.1f x %.1f mm   volume %.1f cm3" % (bb.XLength, bb.YLength, bb.ZLength, body.Volume / 1000.0))
    print("LID     %.1f mm thick   volume %.1f cm3" % (LID_T, lid.Volume / 1000.0))
    print("CAVITY  %.1f x %.1f x %.1f" % (INNER_X, INNER_Y, INNER_H))
    print("GUTTERS south %.0f mm   east/west %.0f mm   north %.0f mm" % (FRONT, SIDE, BACK))
    print("LED top z %.1f   light boss bottom z %.1f" % (led_z, boss_bottom))
    print("saved", fcstd)


build()
