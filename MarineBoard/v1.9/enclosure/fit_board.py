# Place the KiCad board STEP into the enclosure and report clearances.
#
# Export the board first (from the repo root):
#   /Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli pcb export step \
#     -o MarineBoard/enclosure/MarineBoard-board.step --force --subst-models \
#     --user-origin 193.75x37.75mm \
#     -D KICAD10_3DMODEL_DIR=/Applications/KiCad/KiCad.app/Contents/SharedSupport/3dmodels \
#     -D KICAD9_3DMODEL_DIR=/Applications/KiCad/KiCad.app/Contents/SharedSupport/3dmodels \
#     -D KICAD_3RD_PARTY="$HOME/Documents/KiCad/10.0/3rdparty" \
#     MarineBoard/MarineBoard.kicad_pcb
#
# Then:
#   /Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd MarineBoard/enclosure/fit_board.py

import os

import FreeCAD as App
import Part

HERE = os.path.dirname(os.path.abspath(__file__))
# Must match make_enclosure.py
WALL = 3.2
FLOOR = 2.8
LEFT = 20.0
FRONT = 20.0
BOARD_Y = 67.5
STANDOFF_H = 12.0
BOARD_X0 = WALL + LEFT
BOARD_Y0 = WALL + FRONT
BOARD_Z = FLOOR + STANDOFF_H


def main():
    import Import

    enc = App.openDocument(os.path.join(HERE, "MarineBoard-enclosure.FCStd"))
    bottom = enc.getObject("Bottom").Shape.copy()
    lid = enc.getObject("Lid").Shape.copy()
    App.closeDocument(enc.Name)

    board_doc = App.newDocument("kicad")
    Import.insert(os.path.join(HERE, "MarineBoard-board.step"), "kicad")
    root = None
    for obj in board_doc.Objects:
        shape = getattr(obj, "Shape", None)
        if shape is None or shape.isNull():
            continue
        bb = shape.BoundBox
        if bb.XLength > 80 and bb.YLength > 60 and bb.ZLength > 15:
            root = obj
    if root is None:
        raise RuntimeError("board assembly not found in the STEP")

    # STEP +Y is the KiCad 3D view's up (antenna, U9). Translate only.
    # Mirroring Y lands the holes but puts the ESP32 at the wrong end.
    board = root.Shape.copy()
    board.translate(App.Vector(BOARD_X0, BOARD_Y0 + BOARD_Y, BOARD_Z))

    floor_gap = None
    for solid in board.Solids:
        bb = solid.BoundBox
        if 12.0 < bb.XLength < 14.0 and 12.0 < bb.YLength < 14.0 and 8.0 < bb.ZLength < 9.2:
            gap = bb.ZMin - FLOOR
            if floor_gap is None or gap < floor_gap:
                floor_gap = gap
                print("L2 bottom z %.2f   floor z %.2f   clearance %.2f mm" % (bb.ZMin, FLOOR, gap))
    if floor_gap is None:
        raise RuntimeError("L2 solid not found")
    if floor_gap < 1.0:
        raise RuntimeError("L2 clearance is only %.2f mm" % floor_gap)

    # Point just under the inductor, and one in the floor skin. A full boolean
    # of the KiCad assembly is too heavy for this check.
    l2y = BOARD_Y0 + (BOARD_Y - 49.62)
    under = App.Vector(BOARD_X0 + 40.75, l2y, FLOOR + floor_gap / 2.0)
    skin = App.Vector(BOARD_X0 + 40.75, l2y, FLOOR / 2.0)
    if bottom.isInside(under, 0.05, True):
        raise RuntimeError("L2 occupies solid plastic at %s" % under)
    if not bottom.isInside(skin, 0.05, True):
        raise RuntimeError("floor missing under L2")
    print("L2 is above the floor")

    # D5 has no STEP in this KiCad install, so the fit file showed an empty
    # spot. The body is the WS2812B-2020, 2.0 x 2.0 x 0.84 mm, on the footprint
    # centre. D16, the power LED, is the part 3.7 mm away that does export.
    d5x = BOARD_X0 + (252.275 - 193.75)
    d5y = BOARD_Y0 + (BOARD_Y - (70.67 - 37.75))
    d5 = Part.makeBox(2.0, 2.0, 0.84, App.Vector(d5x - 1.0, d5y - 1.0, BOARD_Z + 1.51))

    fit = App.newDocument("EnclosureFit")
    b = fit.addObject("Part::Feature", "Bottom")
    b.Shape = bottom
    l = fit.addObject("Part::Feature", "Lid")
    l.Shape = lid
    k = fit.addObject("Part::Feature", "KiCad_board")
    k.Shape = board
    led = fit.addObject("Part::Feature", "D5_status_LED")
    led.Shape = d5
    for obj, color in (
        (b, (0.55, 0.32, 0.12)),
        (l, (0.95, 0.82, 0.15)),
        (k, (0.15, 0.55, 0.30)),
        (led, (0.95, 0.95, 0.95)),
    ):
        try:
            obj.ViewObject.ShapeColor = color
        except Exception:
            pass
    try:
        l.ViewObject.Transparency = 60
    except Exception:
        pass
    fit_path = os.path.join(HERE, "MarineBoard-enclosure-fit.FCStd")
    fit.saveAs(fit_path)
    print("saved", fit_path)


main()
