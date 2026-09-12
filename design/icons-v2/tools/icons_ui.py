"""
The nineteen non-food icons: sixteen controls and three display glyphs.

WHY CONTROLS ARE A DIFFERENT DRAWING LANGUAGE FROM FOOD, ON PURPOSE. A control
is a line drawing (open strokes, no fill) and a food is a filled silhouette,
and that difference is doing work rather than being an inconsistency: a chip
row shows both at once, and the eye needs to know at a glance which of the two
little pictures it can press. That split is also what the app has today —
Feather's stroked UI beside MaterialCommunityIcons' solid food — so this
redesign keeps a distinction the product already reads correctly and gives it
a reason instead of an accident.

WHAT HOLDS THE TWO HALVES TOGETHER: one ink (#26332C) for every line in both
languages, one corner-rounding habit, one 24x24 grid, and green as the only
accent a control is allowed. Nothing else.

⚠ `timer` AND `clock` ARE THE PAIR MOST LIKELY TO COLLIDE and are drawn apart
deliberately, because iconFont.ts already paid for this once: it refused
MaterialCommunityIcons' own `timer` (a dial) precisely because "it would
collide with `clock` at 16 pt". So `clock` is the only circle in the UI set and
`timer` is an hourglass with amber sand — different silhouette, different
colour, no shared part.
"""

import math

import palette as p
from geometry import circle, path, pline, poly, rect, style


def ui(stroke: str = p.INK, sw: float = p.SW_UI, fill=None) -> dict:
    """A control's line-work."""
    return style(fill=fill, stroke=stroke, sw=sw)


def solid(fill: str, sw: float = p.SW_OUTLINE, stroke: str = p.INK) -> dict:
    """A filled shape with the shared ink outline."""
    return style(fill=fill, stroke=stroke, sw=sw)


def flat(fill: str) -> dict:
    """A fill with no outline — only ever used for a detail INSIDE an outline."""
    return style(fill=fill)


def _gear(cx: float, cy: float, r_out: float, r_in: float, teeth: int = 8):
    """Four points per tooth: tip start, tip end, valley start, valley end."""
    step = 2 * math.pi / teeth
    tip = step * 0.21
    gap = step * 0.10
    points = []
    for i in range(teeth):
        a = i * step
        for angle, radius in (
            (a - tip, r_out),
            (a + tip, r_out),
            (a + tip + gap, r_in),
            (a + step - tip - gap, r_in),
        ):
            points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return points


# ---------------------------------------------------------------------------
# The sixteen controls
# ---------------------------------------------------------------------------

UI_ICONS = [
    # The posts are drawn FIRST so the body tucks over their lower halves —
    # cheaper and more robust than clipping, and it survives any stroke weight.
    ("calendar", [
        pline([(8, 2.4), (8, 6.4)], ui()),
        pline([(16, 2.4), (16, 6.4)], ui()),
        rect(3, 4.6, 18, 16.8, 2.6, solid(p.WHITE, sw=p.SW_UI)),
        path("M3 7.2 C3 5.76 4.16 4.6 5.6 4.6 H18.4 C19.84 4.6 21 5.76 21 7.2 V9.8 H3 Z", flat(p.GREEN_SOFT)),
        pline([(3, 9.8), (21, 9.8)], ui(sw=1.5)),
        rect(3, 4.6, 18, 16.8, 2.6, ui()),
        # The single green day. One marked square, not three: the icon means
        # "a calendar", and a grid of dots at 14 pt is grey noise.
        rect(10.4, 12.6, 4.6, 4.6, 1.1, flat(p.GREEN)),
    ]),
    # Green, because a tick is the app's "yes". Heavier than the other UI
    # strokes (2.5 vs 1.9) so it still reads as a tick and not as a chevron at
    # 14 pt, where the two are three pixels apart.
    ("check", [pline([(4.8, 12.6), (9.6, 17.6), (19.2, 7.0)], ui(p.GREEN, 2.5))]),
    ("chevron-right", [pline([(9.2, 5.4), (15.8, 12), (9.2, 18.6)], ui(p.INK, 2.2))]),
    ("clipboard", [
        rect(4, 4.6, 16, 16.8, 2.4, solid(p.WHITE, sw=p.SW_UI)),
        rect(8.4, 2.2, 7.2, 4.2, 1.6, solid(p.GREEN_SOFT, sw=1.6)),
        pline([(7.8, 12), (16.2, 12)], ui(p.GREEN, 1.6)),
        pline([(7.8, 15.6), (14, 15.6)], ui(p.INK_SOFT, 1.5)),
    ]),
    ("clock", [
        circle(12, 12, 8.6, solid(p.WHITE, sw=p.SW_UI)),
        pline([(12, 12), (12, 7.2)], ui(p.INK, 1.8)),
        pline([(12, 12), (15.8, 13.6)], ui(p.INK, 1.8)),
        circle(12, 12, 1.05, flat(p.GREEN)),
    ]),
    # Ink, not red. `close` dismisses; it does not destroy, and a red cross on
    # a sheet header reads as "delete this".
    ("close", [
        pline([(6.6, 6.6), (17.4, 17.4)], ui(p.INK, 2.2)),
        pline([(17.4, 6.6), (6.6, 17.4)], ui(p.INK, 2.2)),
    ]),
    ("external-link", [
        pline([(19.4, 13.2), (19.4, 18.8), (5.2, 18.8), (5.2, 4.6), (10.8, 4.6)], ui()),
        pline([(11.4, 12.6), (19.4, 4.6)], ui(p.GREEN)),
        pline([(14.2, 4.6), (19.4, 4.6), (19.4, 9.8)], ui(p.GREEN)),
    ]),
    ("filter", [path("M3.6 5 H20.4 L14.2 12.6 V19.4 L9.8 17.2 V12.6 Z", solid(p.GREEN_SOFT, sw=1.7))]),
    # Two people, the front one green — so the icon still says "friends" in a
    # tab bar at 24 pt where the back figure is barely two strokes wide.
    ("friends", [
        circle(15.8, 8.6, 3.0, solid(p.WHITE, sw=1.6)),
        path("M10.4 20.2 C10.4 16.5 12.8 14 15.8 14 C18.8 14 21.2 16.5 21.2 20.2 Z", solid(p.WHITE, sw=1.6)),
        circle(9.0, 8.8, 3.4, solid(p.GREEN_SOFT, sw=1.7)),
        path("M2.6 20.6 C2.6 16.4 5.4 13.8 9 13.8 C12.6 13.8 15.4 16.4 15.4 20.6 Z", solid(p.GREEN_SOFT, sw=1.7)),
    ]),
    # Green like `check`: both are additive. `close` stays ink, which is what
    # keeps a rotated cross from reading as a plus at 14 pt — colour separates
    # them before the rotation does.
    ("plus", [
        pline([(12, 5), (12, 19)], ui(p.GREEN, 2.4)),
        pline([(5, 12), (19, 12)], ui(p.GREEN, 2.4)),
    ]),
    ("recipes", [
        path("M12 6.6 C10 4.9 6.6 4.3 3.4 4.7 V18.7 C6.6 18.3 10 18.9 12 20.5 Z", solid(p.CREAM, sw=1.6)),
        path("M12 6.6 C14 4.9 17.4 4.3 20.6 4.7 V18.7 C17.4 18.3 14 18.9 12 20.5 Z", solid(p.WHITE, sw=1.6)),
        pline([(5.4, 9.6), (10, 9.6)], ui(p.GREEN, 1.3)),
        pline([(5.4, 12.6), (9.2, 12.6)], ui(p.INK_SOFT, 1.3)),
        pline([(14, 9.6), (18.6, 9.6)], ui(p.INK_SOFT, 1.3)),
        pline([(14, 12.6), (17.8, 12.6)], ui(p.INK_SOFT, 1.3)),
    ]),
    # Two facets rather than one outline plus a fold line: at 14 pt a hairline
    # fold vanishes and the plane becomes a shard, while a filled facet keeps
    # the crease at any size.
    ("send", [
        poly([(21.2, 3.0), (3.0, 9.6), (11.3, 13.0)], solid(p.WHITE, sw=1.5)),
        poly([(21.2, 3.0), (11.3, 13.0), (14.2, 21.0)], solid(p.GREEN_SOFT, sw=1.5)),
    ]),
    ("settings", [
        poly(_gear(12, 12, 9.6, 6.9), solid(p.WHITE, sw=1.6)),
        circle(12, 12, 3.3, solid(p.GREEN_SOFT, sw=1.6)),
    ]),
    # One arrow ink, one green. Two identical arrows crossing is a knot at
    # 14 pt; two colours make it two paths swapping, which is what shuffle is.
    ("shuffle", [
        path("M3.2 6.8 H6.6 C10.2 6.8 11.8 17.2 15.4 17.2 H19.4", ui()),
        pline([(17.4, 15.1), (19.7, 17.2), (17.4, 19.3)], ui()),
        path("M3.2 17.2 H6.6 C10.2 17.2 11.8 6.8 15.4 6.8 H19.4", ui(p.GREEN)),
        pline([(17.4, 4.7), (19.7, 6.8), (17.4, 8.9)], ui(p.GREEN)),
    ]),
    # An hourglass, never a dial — see this file's header. The amber sand is
    # the only colour, and it is also the only part that moves in real life.
    ("timer", [
        pline([(6.6, 3.0), (17.4, 3.0)], ui(p.INK, 2.0)),
        pline([(6.6, 21.0), (17.4, 21.0)], ui(p.INK, 2.0)),
        path(
            "M7.6 3.4 H16.4 C16.4 8.2 12 11 12 12 C12 13 16.4 15.8 16.4 20.6 H7.6 "
            "C7.6 15.8 12 13 12 12 C12 11 7.6 8.2 7.6 3.4 Z",
            solid(p.WHITE, sw=1.6),
        ),
        path("M9.3 5.4 H14.7 C14.4 8.2 12 10.3 12 10.3 C12 10.3 9.6 8.2 9.3 5.4 Z", flat(p.AMBER)),
        path("M8.9 18.9 C9.5 16.5 12 15.2 12 15.2 C12 15.2 14.5 16.5 15.1 18.9 Z", flat(p.AMBER)),
        pline([(12, 12.4), (12, 14.0)], ui(p.AMBER, 1.0)),
    ]),
    # The one control that is NOT ink-plus-green. A warning drawn in the
    # accent colour is a warning that looks like every other affordance.
    ("warning", [
        path(
            "M10.5 4.0 C11.2 2.9 12.8 2.9 13.5 4.0 L22.0 18.6 C22.7 19.8 21.9 21.2 20.5 21.2 "
            "H3.5 C2.1 21.2 1.3 19.8 2.0 18.6 Z",
            solid(p.AMBER, sw=1.6),
        ),
        pline([(12, 9.2), (12, 14.6)], ui(p.INK, 2.0)),
        circle(12, 17.6, 1.15, flat(p.INK)),
    ]),
]


# ---------------------------------------------------------------------------
# The three display glyphs
# ---------------------------------------------------------------------------

DISPLAY_ICONS = [
    # THE ONLY GREEN VESSEL IN THE SET, and that is the point: this is the
    # glyph docs/archief/HANDOVER.md names by hand for the empty library — the first
    # thing a new user sees — so it carries the brand colour while every other
    # pot, pan and bowl stays cream. Nothing else competes with it.
    ("cooking-pot", [
        path("M4.2 12.2 C2.2 12.2 2.2 15.6 4.2 15.6", ui(p.INK, 1.8)),
        path("M19.8 12.2 C21.8 12.2 21.8 15.6 19.8 15.6", ui(p.INK, 1.8)),
        path(
            "M4.2 9.6 H19.8 V16.4 C19.8 19 17.8 20.9 15.4 20.9 H8.6 C6.2 20.9 4.2 19 4.2 16.4 Z",
            solid(p.GREEN),
        ),
        circle(12, 5.4, 1.6, solid(p.CREAM)),
        rect(2.9, 6.9, 18.2, 2.8, 1.4, solid(p.CREAM)),
    ]),
    # Steam is the whole identity here. Three curls, in the soft ink rather
    # than in a colour, because coloured steam reads as smoke or as a flourish;
    # grey steam reads as heat. The carrot and herb specks in the broth are
    # what keep it from being read as a plain bowl of water.
    ("bowl-steam", [
        path("M8.6 2.6 C7.4 3.9 9.8 5.0 8.6 6.3", ui(p.INK_SOFT, 1.5)),
        path("M12 2.0 C10.8 3.3 13.2 4.4 12 5.7", ui(p.INK_SOFT, 1.5)),
        path("M15.4 2.6 C14.2 3.9 16.6 5.0 15.4 6.3", ui(p.INK_SOFT, 1.5)),
        path("M2.6 10.4 H21.4 C21.4 15.8 17.2 20.0 12 20.0 C6.8 20.0 2.6 15.8 2.6 10.4 Z", solid(p.WHITE)),
        path("M4.4 12.0 H19.6 C19.0 15.6 15.8 18.4 12 18.4 C8.2 18.4 5.0 15.6 4.4 12.0 Z", flat(p.AMBER_SOFT)),
        circle(10.2, 14.4, 1.0, flat(p.ORANGE)),
        circle(13.8, 15.4, 0.9, flat(p.GREEN)),
    ]),
    # The history badge on a library tile, at 14 pt. It keeps the chef's hat
    # iconFont.ts settled on ("an unmistakable silhouette at 14 pt … impossible
    # to read as a to-do box") and adds the one thing that argument was missing:
    # a green band, so the badge says DONE in the same colour the tick does.
    # ⚠ It must never converge on `wok`, which sits on the same screen — see
    # icons_food.py's note on that pair. A toque and a long-handled pan share
    # no part, no proportion and no colour.
    #
    # REDRAWN AFTER RASTERISING: the first version READ AS A CUPCAKE at 14 and
    # 16 px, and the reason was specific rather than vague. Two vertical pleat
    # lines on the band are exactly what a paper cupcake liner has, and the
    # crown was tall and bumpy enough to pass for frosting. So the pleats are
    # gone (replaced by one HORIZONTAL line, which a liner never has), the
    # crown is flatter and wider, and it now overhangs the band on both sides —
    # a toque mushrooms, a cupcake does not.
    ("cooked", [
        # THREE DISTINCT LOBES WITH VALLEYS BETWEEN THEM, not one smooth dome.
        # A smooth dome over a band is frosting on a cupcake; three puffs is a
        # toque, and the valleys are what the eye uses to tell them apart.
        path(
            "M5.2 12.8 C3.0 12.8 1.9 11.0 2.4 9.0 C2.9 6.8 5.0 5.8 6.8 6.6 "
            "C6.6 4.0 8.6 2.0 12 2.0 C15.4 2.0 17.4 4.0 17.2 6.6 "
            "C19.0 5.8 21.1 6.8 21.6 9.0 C22.1 11.0 21.0 12.8 18.8 12.8 Z",
            solid(p.WHITE),
        ),
        # The band is NARROWER than the crown's own base (9.2 against 13.6) and
        # shorter than it was, so the crown visibly overhangs and dominates.
        # That overhang is the single feature a toque has and a cupcake has not,
        # which is why the band shrank rather than the crown growing.
        rect(7.4, 12.4, 9.2, 5.4, 0.9, solid(p.GREEN)),
    ]),
]
