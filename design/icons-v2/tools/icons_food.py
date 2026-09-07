"""
The twenty-six food icons: fifteen dish tags and eleven ingredient categories.

THE THREE GUESSES THIS FILE EXISTS TO RETIRE. iconFont.ts marks three mappings
with a ⚠ because MaterialCommunityIcons could not draw the thing and a stand-in
was picked instead. Drawing our own removes the constraint that caused all
three, so all three are answered here rather than inherited:

  potato       was `food-variant`, a covered serving dish — "it says 'a dish'
               and not 'a potato'". It is now a potato: a lumpy tan tuber with
               eyes. Nothing else in the set is tan and lumpy except the peanut,
               which is waisted; see the pair note below.
  salad-bowl   was `leaf`, because the font had no salad. It is now a wide
               WOODEN bowl with greens overflowing the rim and a tomato — the
               only brown vessel in the set, which is what tells it apart from
               the four cream bowls at 14 pt.
  leaf/sprout  CROSSED in the font: Remy's `leaf` (vegetarisch) was drawn by
               `sprout` and Remy's `sprout` (veganistisch) by `leaf-circle`,
               because the plain leaf had been spent on salad. With salad no
               longer needing a leaf, the crossing has no reason to exist and
               is gone: `leaf` is one leaf, `sprout` is a seedling rising from
               soil. The stricter of the two (vegan) is the one growing out of
               the ground, which is the association the word carries anyway.
               Still a leaf and a seedling, never a crossed-out animal — PD-006
               keeps descriptive categories and safety claims apart, and a
               prohibition sign is the grammar of an allergen warning.

PAIRS HELD APART ON PURPOSE, because tests/iconFont.test.ts refuses two names
on one drawing ("which would make two controls look identical") and the same
rule has to survive when the drawings are ours:

  cooked / wok            A toque and a long-handled pan. These two sit on the
                          SAME screen — the badge on a library tile and the
                          "Wokgerecht" chip — which is exactly the collision
                          iconFont.ts documented at length. They now share no
                          part, no proportion and no colour.
  the five round bowls    bowl-steam (three steam curls, pale broth),
                          rice-bowl (a white mound ABOVE the rim, plus a foot),
                          curry-bowl (solid orange, cream swirl, no steam),
                          salad-bowl (wooden, greens over the rim),
                          noodles (NO bowl at all — a nest and chopsticks).
                          Silhouette first, colour second; either alone would
                          be too thin a difference at 14 pt.
  potato / nuts           A rounded tuber with dark eyes versus a WAISTED
                          peanut shell with ridges. Both are tan, which is why
                          the waist is doing the work and not the colour.
  beef / meat             A bone versus butcher's string. `beef` is the dish
                          tag (a T-bone), `meat` is the ingredient category (a
                          tied roast) — a category glyph must not name a
                          species, which is the same reason iconFont.ts refused
                          `cow` for it.
  pasta / noodles         A farfalle bowtie versus a nest of wavy strands. Two
                          tangles-with-a-utensil would have been the obvious
                          drawing and would have collided; a geometric pasta
                          shape shares nothing with a strand.
  leaf / sprout / herbs   One big leaf; two cotyledons over brown soil; a
                          diagonal sprig with leaves along it. Three green
                          plants is the densest corner of this set.
"""

import palette as p
from geometry import circle, ellipse, fmt, path, pline, poly, rect, style


def solid(fill: str, sw: float = p.SW_OUTLINE, stroke: str = p.INK, rot=None) -> dict:
    return style(fill=fill, stroke=stroke, sw=sw, rot=rot)


def flat(fill: str, rot=None) -> dict:
    """A fill with no outline — only for a detail INSIDE an outlined shape."""
    return style(fill=fill, rot=rot)


def line(stroke: str, sw: float, rot=None) -> dict:
    return style(stroke=stroke, sw=sw, rot=rot)


def leaf(cx, cy, rx, ry, rot_deg, fill, sw=p.SW_DETAIL, stroke=p.INK):
    """
    A pointed lens — the one shape this whole set reuses.

    Two mirrored cubics meeting in a point at each end. A taper is what
    separates a leaf from a capsule, which is the same observation
    remyGlyphs.ts made about the pea pod ("an untapered stadium shape reads as
    a pill"). Rotation stays OUT of the path and in the transform so it can be
    nudged without recomputing eight control points.
    """
    d = (
        f"M{fmt(cx)} {fmt(cy - ry)} "
        f"C{fmt(cx + rx * 1.12)} {fmt(cy - ry * 0.45)} {fmt(cx + rx * 1.12)} {fmt(cy + ry * 0.45)} "
        f"{fmt(cx)} {fmt(cy + ry)} "
        f"C{fmt(cx - rx * 1.12)} {fmt(cy + ry * 0.45)} {fmt(cx - rx * 1.12)} {fmt(cy - ry * 0.45)} "
        f"{fmt(cx)} {fmt(cy - ry)} Z"
    )
    rot = (rot_deg, cx, cy) if rot_deg else None
    return path(d, style(fill=fill, stroke=stroke, sw=sw, rot=rot))


# ---------------------------------------------------------------------------
# The fifteen dish tags
# ---------------------------------------------------------------------------

_POD_ROT = (-18, 12, 12)
_WOK_ROT = (-20, 11, 13)

DISH_ICONS = [
    # A farfalle, not a fork of spaghetti. Drawing pasta as strands would have
    # made it a near-twin of `noodles`, and the two appear in the same chip
    # row; a geometric shape shares nothing with a strand.
    ("pasta", [
        path(
            "M10.6 10.3 C8.0 8.5 5.4 7.3 3.2 7.5 C3.8 9.3 3.8 14.7 3.2 16.5 "
            "C5.4 16.7 8.0 15.5 10.6 13.7 Z",
            solid(p.AMBER_SOFT, sw=p.SW_DETAIL),
        ),
        path(
            "M13.4 10.3 C16.0 8.5 18.6 7.3 20.8 7.5 C20.2 9.3 20.2 14.7 20.8 16.5 "
            "C18.6 16.7 16.0 15.5 13.4 13.7 Z",
            solid(p.AMBER_SOFT, sw=p.SW_DETAIL),
        ),
        rect(10.0, 9.9, 4.0, 4.2, 1.0, solid(p.AMBER, sw=p.SW_DETAIL)),
        pline([(11.4, 10.9), (11.4, 13.1)], line(p.INK, 0.9)),
        pline([(12.6, 10.9), (12.6, 13.1)], line(p.INK, 0.9)),
    ]),
    # The mound sits ABOVE the rim and the bowl has a foot. Both are there to
    # separate it from `bowl-steam` by silhouette rather than by contents,
    # because contents are the first thing that vanishes at 14 pt.
    ("rice-bowl", [
        path("M6.4 12.4 C6.4 8.8 8.8 6.4 12 6.4 C15.2 6.4 17.6 8.8 17.6 12.4 Z", solid(p.WHITE)),
        ellipse(9.8, 9.6, 0.95, 0.5, flat(p.INK_SOFT, rot=(-25, 9.8, 9.6))),
        ellipse(12.2, 8.6, 0.95, 0.5, flat(p.INK_SOFT, rot=(15, 12.2, 8.6))),
        ellipse(14.4, 10.0, 0.95, 0.5, flat(p.INK_SOFT, rot=(-15, 14.4, 10.0))),
        ellipse(11.4, 10.9, 0.95, 0.5, flat(p.INK_SOFT, rot=(30, 11.4, 10.9))),
        rect(9.4, 19.4, 5.2, 2.2, 0.9, solid(p.CREAM)),
        path("M3.4 12.2 H20.6 C20.6 16.8 16.8 20.4 12 20.4 C7.2 20.4 3.4 16.8 3.4 12.2 Z", solid(p.CREAM)),
    ]),
    # ⚠ ONE OF THE THREE RETIRED GUESSES. A potato, not a covered dish.
    ("potato", [
        path(
            "M4.0 13.2 C3.2 9.0 6.8 5.6 11.4 5.5 C16.4 5.4 20.6 8.2 20.8 12.4 "
            "C21.0 16.8 17.0 19.9 12.2 19.7 C7.8 19.5 4.8 17.2 4.0 13.2 Z",
            solid(p.BROWN_SOFT),
        ),
        ellipse(8.6, 8.8, 2.2, 1.2, flat(p.CREAM, rot=(-25, 8.6, 8.8))),
        pline([(8.8, 11.0), (9.8, 11.7)], line(p.BROWN, 1.3)),
        pline([(14.0, 9.2), (15.0, 9.9)], line(p.BROWN, 1.3)),
        pline([(11.4, 14.8), (12.4, 15.5)], line(p.BROWN, 1.3)),
        pline([(16.4, 13.6), (17.2, 14.3)], line(p.BROWN, 1.3)),
    ]),
    # No bowl at all. Four of the fifteen dishes are already round vessels, and
    # a fifth would have made the row unreadable — so noodles is the nest.
    #
    # THICKENED AFTER RASTERISING: at 14 px the first version was a thin amber
    # squiggle with one brown bar over it and read as neither noodles nor
    # chopsticks. Strands went 1.9 -> 2.3, the nest gained a fourth strand so
    # it reads as a MASS rather than as lines, and the two sticks were pulled
    # apart so the gap between them survives to 14 px — a gap is what makes
    # two sticks two sticks.
    ("noodles", [
        path("M2.6 13.6 C4.8 10.8 9.0 10.8 11.2 13.4", line(p.AMBER_SOFT, 2.3)),
        path("M2.4 16.4 C4.8 13.2 9.2 13.0 11.6 15.8 C13.4 17.8 15.8 17.6 17.2 15.6", line(p.AMBER, 2.3)),
        path("M2.8 19.4 C5.0 16.6 9.0 16.4 11.4 18.6 C13.2 20.2 15.6 20.0 17.0 18.2", line(p.AMBER, 2.3)),
        pline([(12.6, 16.4), (21.4, 5.8)], line(p.BROWN, 1.8)),
        pline([(15.4, 17.2), (22.2, 9.0)], line(p.BROWN, 1.8)),
        path("M11.0 14.4 C13.0 11.8 15.2 9.8 17.4 8.2", line(p.AMBER, 2.3)),
    ]),
    ("bread", [
        path(
            "M3.2 13.6 C3.2 9.5 7.2 6.4 12 6.4 C16.8 6.4 20.8 9.5 20.8 13.6 V16.4 "
            "C20.8 18.0 19.5 19.2 18.0 19.2 H6.0 C4.5 19.2 3.2 18.0 3.2 16.4 Z",
            solid(p.AMBER),
        ),
        path(
            "M3.2 15.9 H20.8 V16.4 C20.8 18.0 19.5 19.2 18.0 19.2 H6.0 C4.5 19.2 3.2 18.0 3.2 16.4 Z",
            solid(p.CREAM, sw=p.SW_DETAIL),
        ),
        pline([(7.2, 12.6), (9.2, 10.0)], line(p.INK, 1.3)),
        pline([(10.9, 13.0), (12.9, 10.4)], line(p.INK, 1.3)),
        pline([(14.6, 12.6), (16.6, 10.0)], line(p.INK, 1.3)),
    ]),
    # ⚠ ONE OF THE THREE RETIRED GUESSES. The only WOODEN bowl in the set, so
    # the eye separates it from the cream ones before it reads the contents.
    ("salad-bowl", [
        leaf(7.0, 10.0, 2.6, 4.0, -38, p.GREEN),
        leaf(12.0, 8.6, 2.8, 4.4, 4, p.GREEN_SOFT),
        leaf(17.0, 10.2, 2.6, 4.0, 38, p.GREEN),
        path("M2.4 12.6 H21.6 C21.6 16.9 17.3 20.4 12 20.4 C6.7 20.4 2.4 16.9 2.4 12.6 Z", solid(p.BROWN_SOFT)),
        circle(15.8, 11.6, 1.9, solid(p.RED, sw=p.SW_DETAIL)),
    ]),
    # The only RECTANGULAR vessel. That is the whole differentiator, and it is
    # a stronger one than any amount of browned-cheese detail at 14 pt.
    ("casserole-dish", [
        rect(4.2, 5.6, 15.6, 3.6, 1.4, solid(p.ORANGE, sw=p.SW_DETAIL)),
        circle(8.0, 7.0, 1.1, flat(p.CREAM)),
        circle(12.0, 6.6, 1.0, flat(p.CREAM)),
        circle(16.0, 7.1, 1.1, flat(p.CREAM)),
        rect(0.9, 8.3, 2.2, 1.8, 0.9, solid(p.CREAM, sw=p.SW_DETAIL)),
        rect(20.9, 8.3, 2.2, 1.8, 0.9, solid(p.CREAM, sw=p.SW_DETAIL)),
        path(
            "M3.2 10.0 H20.8 V16.6 C20.8 18.0 19.7 19.1 18.3 19.1 H5.7 C4.3 19.1 3.2 18.0 3.2 16.6 Z",
            solid(p.CREAM),
        ),
        rect(2.2, 7.6, 19.6, 2.8, 1.1, solid(p.CREAM)),
    ]),
    # ⚠ THE PAIR THE OLD FONT COULD NOT SEPARATE. See this file's header: this
    # and `cooked` share a screen, so they are drawn as far apart as the two
    # meanings allow — a long handle and food in the air, versus a hat.
    #
    # REDRAWN AFTER RASTERISING, AND THIS IS THE ONE THE WARNING ABOVE WAS
    # ABOUT. The first version was an upright semicircular pan with a short
    # handle, and at 14 px it was a BOWL WITH A SPOON — indistinguishable from
    # `salad-bowl` two chips away. Three changes, each aimed at one cause:
    # the pan is flatter (18 wide by 7 deep, where every bowl here is nearer
    # 2:1), the whole pan is TILTED 20° so no bowl silhouette survives, and the
    # handle is long, straight and ends in a thick wooden grip instead of
    # tapering like a spoon. The food is thrown clear of the rim, which only
    # makes sense for a pan.
    ("wok", [
        circle(5.4, 5.6, 1.5, solid(p.GREEN, sw=p.SW_DETAIL)),
        rect(8.6, 3.0, 3.2, 1.9, 0.95, solid(p.ORANGE, sw=p.SW_DETAIL)),
        circle(12.6, 5.2, 1.3, solid(p.RED, sw=p.SW_DETAIL)),
        pline([(19.0, 11.2), (23.4, 11.2)], line(p.INK, 2.2, rot=_WOK_ROT)),
        pline([(21.6, 11.2), (23.4, 11.2)], line(p.BROWN, 2.9, rot=_WOK_ROT)),
        path(
            "M2.0 11.4 H20.0 C20.0 15.6 16.0 18.4 11.0 18.4 C6.0 18.4 2.0 15.6 2.0 11.4 Z",
            solid(p.CREAM, rot=_WOK_ROT),
        ),
        circle(7.4, 13.4, 1.1, flat(p.GREEN, rot=_WOK_ROT)),
        circle(11.4, 14.0, 1.0, flat(p.ORANGE, rot=_WOK_ROT)),
    ]),
    # Solid orange to the rim, a cream swirl, no steam. The elliptical top
    # surface is what stops it reading as a flat disc at 48 pt.
    ("curry-bowl", [
        path("M3.0 11.6 H21.0 C21.0 16.5 16.9 20.4 12 20.4 C7.1 20.4 3.0 16.5 3.0 11.6 Z", solid(p.ORANGE)),
        ellipse(12, 11.6, 9.0, 2.1, solid(p.ORANGE)),
        path("M8.4 11.4 C9.4 10.2 12.0 10.0 13.4 11.0 C14.6 11.9 14.0 13.0 12.4 12.8", line(p.CREAM, 1.5)),
        leaf(16.4, 10.6, 1.4, 2.2, 35, p.GREEN, sw=1.0),
    ]),
    # BONE ENLARGED AFTER RASTERISING: at 14 px the first version's two knuckles
    # were a single grey pixel-blob and the icon read as a plain peach circle.
    # The shaft went 2.9 -> 3.6 and the knuckles 2.0/1.9 -> 2.4/2.2, which is
    # the difference between "a drumstick" and "a ball".
    ("chicken", [
        pline([(12.4, 13.4), (18.2, 7.4)], line(p.INK, 5.0)),
        pline([(12.4, 13.4), (18.2, 7.4)], line(p.FAT, 3.6)),
        circle(17.0, 6.2, 2.4, solid(p.FAT, sw=p.SW_DETAIL)),
        circle(19.4, 8.4, 2.2, solid(p.FAT, sw=p.SW_DETAIL)),
        path(
            "M4.2 16.2 C2.6 12.6 5.0 8.4 9.0 7.8 C12.6 7.3 15.4 9.8 14.8 13.4 "
            "C14.2 17.0 10.6 19.6 7.4 18.9 C5.6 18.5 4.8 17.6 4.2 16.2 Z",
            solid(p.MEAT_SOFT),
        ),
    ]),
    # A T-bone. The bone is not decoration: it is the only thing separating
    # this from the `meat` category.
    #
    # SIMPLIFIED AND ENLARGED AFTER RASTERISING: the first version carried a
    # cream fat crescent along the top-left edge as well as the bone, and at
    # 14 px the two pale shapes merged into "a red disc with white smudges".
    # The crescent is gone (it was the less meaningful of the two) and the bone
    # grew from 2.7 to 3.4 — one clear pale shape beats two competing ones at
    # the size this actually renders.
    ("beef", [
        path(
            "M3.6 11.4 C3.2 7.6 6.8 5.0 11.2 4.9 C16.4 4.8 20.8 7.6 21.0 12.0 "
            "C21.2 16.4 17.0 19.7 12.2 19.5 C7.4 19.3 4.0 15.4 3.6 11.4 Z",
            solid(p.MEAT),
        ),
        pline([(15.2, 8.8), (17.8, 10.4)], line(p.MEAT_SOFT, 1.3)),
        pline([(14.8, 12.6), (17.8, 13.6)], line(p.MEAT_SOFT, 1.3)),
        # BOTH INK STROKES FIRST, THEN BOTH FAT ONES. Interleaving them
        # (ink, fat, ink, fat) painted the crossbar's dark outline straight
        # through the upright's pale fill, and the bone came out as two
        # separate sticking plasters rather than as one T.
        pline([(12.8, 6.8), (11.2, 15.4)], line(p.INK, 4.8)),
        pline([(7.8, 14.4), (15.0, 16.2)], line(p.INK, 4.2)),
        pline([(12.8, 6.8), (11.2, 15.4)], line(p.FAT, 3.4)),
        pline([(7.8, 14.4), (15.0, 16.2)], line(p.FAT, 2.9)),
    ]),
    # Bacon, not a pig. A pig names the ANIMAL; the tag means the meat, and the
    # same objection iconFont.ts raised against `cow` for the meat category
    # applies one row up. Two rashers also read at 14 pt, where a pig's snout
    # and ears do not.
    #
    # DARKENED AND FATTENED AFTER RASTERISING: at 14 px the first version was
    # four pale wavy lines that read as ribbon, not as bacon. Both rashers are
    # now the full-strength MEAT rather than one MEAT and one MEAT_SOFT, the
    # band is 4.2 deep instead of 3.2, and the fat streak went 1.3 -> 1.8 so it
    # survives as a stripe instead of dissolving into the meat.
    ("pork", [
        path(
            "M2.6 7.2 C5.8 4.4 9.0 9.4 12.2 6.6 C15.4 3.8 18.2 7.8 21.4 6.2 L21.4 10.4 "
            "C18.2 12.0 15.4 8.0 12.2 10.8 C9.0 13.6 5.8 8.6 2.6 11.4 Z",
            solid(p.MEAT, sw=p.SW_DETAIL),
        ),
        path("M2.6 9.3 C5.8 6.5 9.0 11.5 12.2 8.7 C15.4 5.9 18.2 9.9 21.4 8.3", line(p.FAT, 1.8)),
        path(
            "M2.6 14.4 C5.8 11.6 9.0 16.6 12.2 13.8 C15.4 11.0 18.2 15.0 21.4 13.4 L21.4 17.6 "
            "C18.2 19.2 15.4 15.2 12.2 18.0 C9.0 20.8 5.8 15.8 2.6 18.6 Z",
            solid(p.MEAT, sw=p.SW_DETAIL),
        ),
        path("M2.6 16.5 C5.8 13.7 9.0 18.7 12.2 15.9 C15.4 13.1 18.2 17.1 21.4 15.5", line(p.FAT, 1.8)),
    ]),
    # The only teal object in the set, which is most of why it reads instantly.
    # It serves two names — the `visgerecht` dish tag and the `vis` ingredient
    # category — exactly as the font's `fish` did; that reuse is a mapping
    # decision in iconFont.ts, not a second drawing.
    ("fish", [
        path("M7.4 12 L2.6 7.6 L3.8 12 L2.6 16.4 Z", solid(p.TEAL, sw=p.SW_DETAIL)),
        path("M12.0 6.4 C13.2 4.0 15.6 3.4 16.8 4.8 C15.6 5.2 14.4 5.6 13.6 6.2 Z", solid(p.TEAL, sw=p.SW_DETAIL)),
        path(
            "M6.4 12.0 C6.4 8.0 10.6 5.4 14.6 5.8 C18.6 6.2 21.4 9.0 21.4 12.0 "
            "C21.4 15.0 18.6 17.8 14.6 18.2 C10.6 18.6 6.4 16.0 6.4 12.0 Z",
            solid(p.TEAL),
        ),
        ellipse(14.4, 14.6, 4.0, 1.9, flat(p.TEAL_SOFT)),
        path("M16.6 7.0 C15.4 9.4 15.4 14.4 16.6 16.8", line(p.INK, 1.2)),
        circle(18.2, 10.4, 1.05, flat(p.INK)),
        circle(18.5, 10.1, 0.36, flat(p.WHITE)),
    ]),
    # ⚠ THE UNCROSSED HALF OF THE THIRD GUESS. Vegetarisch: one leaf.
    ("leaf", [
        pline([(2.4, 21.6), (5.4, 18.6)], line(p.INK, 1.8)),
        path("M4.4 19.6 C3.8 12.2 8.6 5.2 19.8 4.4 C20.6 15.2 13.4 20.6 4.4 19.6 Z", solid(p.GREEN)),
        path("M5.0 19.0 C9.0 15.2 14.0 10.6 18.4 6.6", line(p.CREAM, 1.3)),
        pline([(8.8, 13.8), (8.2, 10.4)], line(p.CREAM, 1.0)),
        pline([(12.8, 10.0), (12.4, 6.8)], line(p.CREAM, 1.0)),
        pline([(10.6, 16.2), (13.4, 15.0)], line(p.CREAM, 1.0)),
    ]),
    # ⚠ THE OTHER HALF. Veganistisch: a seedling out of the soil. The brown
    # mound is the differentiator against `leaf` and `herbs` — it is the only
    # earth in the set, and it survives to 14 pt because it is a solid mass.
    ("sprout", [
        path("M3.4 20.8 C4.6 17.6 8.0 16.0 12 16.0 C16 16.0 19.4 17.6 20.6 20.8 Z", solid(p.BROWN)),
        pline([(12, 17.0), (12, 10.0)], line(p.GREEN, 1.8)),
        leaf(9.6, 8.4, 2.5, 3.7, -42, p.GREEN),
        leaf(14.4, 7.6, 2.5, 3.7, 42, p.GREEN_SOFT),
    ]),
]


# ---------------------------------------------------------------------------
# The eleven ingredient categories
# ---------------------------------------------------------------------------

CATEGORY_ICONS = [
    # A carrot for the whole group, the same compromise the font made — but the
    # green top is new and it is what makes it read as A VEGETABLE rather than
    # as an orange cone.
    ("vegetables", [
        leaf(8.4, 5.0, 1.8, 3.2, -30, p.GREEN),
        leaf(12.0, 3.8, 1.8, 3.4, 0, p.GREEN),
        leaf(15.6, 5.0, 1.8, 3.2, 30, p.GREEN),
        path(
            "M8.4 9.8 C8.4 8.4 9.8 7.6 12 7.6 C14.2 7.6 15.6 8.4 15.6 9.8 "
            "L12.8 20.8 C12.5 21.8 11.5 21.8 11.2 20.8 Z",
            solid(p.ORANGE),
        ),
        pline([(9.4, 11.6), (11.2, 11.2)], line(p.INK, 1.1)),
        pline([(12.6, 13.8), (14.4, 13.4)], line(p.INK, 1.1)),
        pline([(10.6, 16.2), (12.4, 15.8)], line(p.INK, 1.1)),
    ]),
    # An apple. Red is spent on fruit and on nothing else warm-and-round, which
    # is what keeps it from being read as a tomato or as a piece of meat.
    ("fruit", [
        path("M12 8.2 C12 6.2 12.4 4.6 13.4 3.4", line(p.BROWN, 1.5)),
        leaf(15.4, 5.0, 1.7, 2.8, 125, p.GREEN),
        path(
            "M12 8.4 C10.6 6.6 7.6 6.2 5.6 7.8 C3.4 9.6 3.4 13.9 5.2 17.1 "
            "C6.4 19.3 8.2 20.9 9.8 20.5 C10.8 20.2 11.2 19.7 12 19.7 "
            "C12.8 19.7 13.2 20.2 14.2 20.5 C15.8 20.9 17.6 19.3 18.8 17.1 "
            "C20.6 13.9 20.6 9.6 18.4 7.8 C16.4 6.2 13.4 6.6 12 8.4 Z",
            solid(p.RED),
        ),
        ellipse(8.4, 11.2, 1.8, 1.1, flat(p.RED_SOFT, rot=(-30, 8.4, 11.2))),
    ]),
    # A gable-top carton, keeping the shape remyGlyphs.ts arrived at after
    # rasterising four silhouettes ("a narrow fin over a steep 45° shoulder read
    # as a jar… a plain peaked gable with no fin read as a HOUSE"). That work is
    # not repeated; it is inherited, and colour is added on top — the teal band
    # with a white drop is what a milk carton has and a house does not.
    ("dairy", [
        path(
            "M4.4 9.8 H19.6 V19.6 C19.6 20.7 18.7 21.6 17.6 21.6 H6.4 "
            "C5.3 21.6 4.4 20.7 4.4 19.6 Z",
            solid(p.CREAM),
        ),
        path("M4.4 9.8 L8.6 4.6 H15.4 L19.6 9.8 Z", solid(p.WHITE)),
        rect(8.4, 2.4, 7.2, 2.4, 0.7, solid(p.WHITE, sw=p.SW_DETAIL)),
        rect(6.4, 12.4, 11.2, 6.4, 1.0, solid(p.TEAL, sw=p.SW_DETAIL)),
        path(
            "M12 13.2 C13.3 14.6 14.1 15.5 14.1 16.4 C14.1 17.6 13.2 18.4 12 18.4 "
            "C10.8 18.4 9.9 17.6 9.9 16.4 C9.9 15.5 10.7 14.6 12 13.2 Z",
            flat(p.WHITE),
        ),
    ]),
    ("cheese", [
        path(
            "M4.0 17.8 H19.6 C20.6 17.8 21.2 17.0 21.2 16.2 V7.4 C21.2 6.4 20.2 6.0 19.4 6.6 "
            "L3.4 16.0 C2.4 16.6 2.8 17.8 4.0 17.8 Z",
            solid(p.AMBER),
        ),
        circle(15.6, 11.4, 1.5, solid(p.CREAM, sw=1.0)),
        circle(11.0, 14.4, 1.2, solid(p.CREAM, sw=1.0)),
        circle(17.8, 14.6, 1.0, solid(p.CREAM, sw=1.0)),
    ]),
    # Sunny side up rather than a shell. A shell in profile is an oval, and
    # this set already has a potato, a peanut and a roast that are ovals; a
    # yolk is the one egg-shaped thing nothing else in the set has.
    ("egg", [
        path(
            "M4.4 13.6 C3.2 10.0 5.8 6.4 9.4 6.2 C11.2 6.1 12.2 4.8 14.6 5.2 "
            "C18.4 5.8 21.0 8.8 20.4 12.2 C20.0 14.6 21.0 16.2 19.2 18.2 "
            "C17.2 20.6 13.2 20.9 10.2 19.7 C7.6 18.6 5.2 17.2 4.4 13.6 Z",
            solid(p.CREAM),
        ),
        circle(12.6, 12.4, 4.0, solid(p.AMBER, sw=p.SW_DETAIL)),
        circle(11.2, 11.0, 1.1, flat(p.AMBER_SOFT)),
    ]),
    # ⚠ REDRAWN OUTRIGHT AFTER RASTERISING — THE WORST FAILURE IN THE SET.
    #
    # The first attempt was a tied roast: a horizontal oval in meat-brown with
    # two cream strings across it. At 14 AND 16 px it read as A RUGBY BALL, and
    # the diagnosis is embarrassing in hindsight — an oval with two light
    # lacing-like bands across it IS a rugby ball, and no amount of colour was
    # going to argue with the silhouette. This is the same class of mistake
    # remyGlyphs.ts recorded for its own first two tries ("read as a jar",
    # "read as a HOUSE"), which is exactly why that file insists the shape be
    # looked at and not reasoned about.
    #
    # A skewer instead: three chunks on a diagonal stick. Nothing else in these
    # forty-five is a diagonal line with things threaded on it, so it cannot be
    # confused with anything; it names no species, which is the constraint the
    # category carries; and it stays clearly apart from the three specific
    # meats (a drumstick, a bone-in steak, two rashers).
    ("meat", [
        pline([(3.8, 20.2), (20.2, 3.8)], line(p.BROWN, 1.7)),
        rect(5.0, 13.4, 5.6, 5.6, 1.5, solid(p.MEAT, rot=(-45, 7.8, 16.2))),
        rect(9.2, 9.2, 5.6, 5.6, 1.5, solid(p.MEAT, rot=(-45, 12.0, 12.0))),
        rect(13.4, 5.0, 5.6, 5.6, 1.5, solid(p.MEAT, rot=(-45, 16.2, 7.8))),
        pline([(6.4, 16.4), (7.6, 17.6)], line(p.FAT, 1.3)),
        pline([(10.6, 12.2), (11.8, 13.4)], line(p.FAT, 1.3)),
        pline([(14.8, 8.0), (16.0, 9.2)], line(p.FAT, 1.3)),
    ]),
    # THE ICON COLOUR ACTUALLY FIXES. remyGlyphs.ts measured its own pea pod and
    # wrote down where it fails: "at 16 PHYSICAL px the three peas are faint,
    # close to merging into the pod", because they were HOLES cut by an
    # even-odd fill and a hole has no colour of its own. Here the peas are
    # light-green discs with their own ink outline, so they are three separate
    # objects at any size rather than three absences.
    ("legumes", [
        path("M2.6 12.0 C6.4 6.6 17.6 6.6 21.4 12.0 C17.6 17.4 6.4 17.4 2.6 12.0 Z",
             solid(p.GREEN, rot=_POD_ROT)),
        circle(7.9, 12.0, 2.0, solid(p.GREEN_SOFT, sw=1.0, rot=_POD_ROT)),
        circle(12.0, 12.0, 2.0, solid(p.GREEN_SOFT, sw=1.0, rot=_POD_ROT)),
        circle(16.1, 12.0, 2.0, solid(p.GREEN_SOFT, sw=1.0, rot=_POD_ROT)),
        pline([(2.8, 12.0), (1.4, 10.4)], line(p.GREEN, 1.5, rot=_POD_ROT)),
    ]),
    # Entirely in the amber family, including the leaves, so it cannot be
    # confused with `herbs` — which is entirely green — at any size.
    ("grain", [
        path("M12 21.4 C12 17.0 12 12.0 12 6.4", line(p.BROWN, 1.6)),
        leaf(8.0, 16.6, 1.5, 3.0, -62, p.AMBER_SOFT, sw=1.0),
        leaf(16.0, 17.6, 1.5, 3.0, 62, p.AMBER_SOFT, sw=1.0),
        leaf(9.0, 11.2, 1.7, 2.9, -38, p.AMBER, sw=1.0),
        leaf(15.0, 11.2, 1.7, 2.9, 38, p.AMBER, sw=1.0),
        leaf(9.2, 7.4, 1.7, 2.9, -38, p.AMBER, sw=1.0),
        leaf(14.8, 7.4, 1.7, 2.9, 38, p.AMBER, sw=1.0),
        leaf(12.0, 4.6, 1.7, 2.9, 0, p.AMBER, sw=1.0),
    ]),
    # ⚠ REDRAWN AFTER RASTERISING — THE SECOND-WORST FAILURE IN THE SET.
    #
    # The first attempt was a peanut in its shell, chosen precisely BECAUSE its
    # waist would tell it apart from the potato. It did — but a tan two-lobed
    # shape with ridges across the middle READ AS A DOG BONE at 14 and 16 px,
    # which is a collision with something not even in the set and therefore one
    # no amount of internal pair-checking would have caught. Only looking did.
    #
    # A hazelnut instead: a rounded nut under a brown cap with a short stem.
    # The CAP is the differentiator now, and it is a better one than the waist
    # was — a potato has no cap, and no other icon here has a lid-like top on a
    # rounded body. It costs the plural (one nut for "noten"), which is the
    # same compromise `fruit` already makes with one apple.
    ("nuts", [
        pline([(12, 6.4), (12, 3.2)], line(p.BROWN, 1.6)),
        path(
            "M4.8 13.6 C4.8 10.2 8.0 7.8 12 7.8 C16 7.8 19.2 10.2 19.2 13.6 "
            "C19.2 17.8 15.8 21.6 12 21.6 C8.2 21.6 4.8 17.8 4.8 13.6 Z",
            solid(p.BROWN_SOFT),
        ),
        # The cap's lower edge is SCALLOPED, not straight. A smooth cap makes an
        # acorn, which is a nut nobody cooks with; three bumps make a hazelnut
        # husk. At 14 px the scallop is invisible and the icon is still "a nut
        # with a cap", so the detail costs nothing where it cannot be seen.
        path(
            "M4.2 11.8 C4.2 8.6 7.7 6.2 12 6.2 C16.3 6.2 19.8 8.6 19.8 11.8 "
            "C18.6 11.0 17.8 9.8 16.4 10.2 C15.0 10.6 14.6 9.4 12 9.4 "
            "C9.4 9.4 9.0 10.6 7.6 10.2 C6.2 9.8 5.4 11.0 4.2 11.8 Z",
            solid(p.BROWN),
        ),
        ellipse(9.0, 14.8, 1.9, 1.2, flat(p.CREAM, rot=(-30, 9.0, 14.8))),
    ]),
    # A sprig on a diagonal, entirely green. Against `sprout` it has no soil;
    # against `leaf` it is many small leaves instead of one big one.
    ("herbs", [
        path("M4.8 20.8 C6.8 15.8 10.4 10.4 15.6 6.2", line(p.GREEN, 1.7)),
        leaf(5.4, 15.4, 1.6, 2.8, -58, p.GREEN, sw=1.0),
        leaf(9.8, 17.0, 1.6, 2.8, 32, p.GREEN_SOFT, sw=1.0),
        leaf(9.4, 11.4, 1.6, 2.8, -58, p.GREEN, sw=1.0),
        leaf(14.0, 12.8, 1.6, 2.8, 32, p.GREEN_SOFT, sw=1.0),
        leaf(16.4, 5.6, 1.5, 2.6, -20, p.GREEN, sw=1.0),
    ]),
    # A wrapped sweet. Berry is spent on this and nothing else, so it is the
    # one icon whose hue alone identifies it.
    #
    # THE SWIRL BECAME TWO STRIPES AFTER RASTERISING: a white spiral inside a
    # dark round body READ AS AN EYE at 14 and 16 px — a pupil with a catchlight
    # — which is a genuinely alarming thing to find in an ingredient list. Two
    # straight diagonal stripes say "wrapper" and cannot curl into a pupil.
    ("sweets", [
        poly([(7.8, 12.0), (3.0, 8.4), (4.4, 12.0), (3.0, 15.6)], solid(p.BERRY_SOFT, sw=p.SW_DETAIL)),
        poly([(16.2, 12.0), (21.0, 8.4), (19.6, 12.0), (21.0, 15.6)], solid(p.BERRY_SOFT, sw=p.SW_DETAIL)),
        ellipse(12, 12, 4.8, 4.2, solid(p.BERRY)),
        pline([(9.6, 14.4), (13.2, 9.6)], line(p.WHITE, 1.5)),
        pline([(11.8, 15.2), (15.0, 10.8)], line(p.WHITE, 1.5)),
    ]),
]
