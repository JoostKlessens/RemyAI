"""
Shape primitives, SVG emission and a small rasteriser — one geometry, two outputs.

WHY ONE MODULE PRODUCES BOTH THE .svg AND THE .png. The point of rasterising
at all is to answer "does this read at 14 pt", and that answer is worthless if
the picture I looked at was drawn from a different description than the picture
that ships. So every icon is declared once, as a list of shapes, and this file
turns that one declaration into SVG text and into pixels. A separate preview
renderer (an SVG viewer, a browser screenshot) would drift the moment either
side gained a feature the other lacked.

WHY A HAND-WRITTEN RASTERISER AND NOT cairosvg. cairosvg is installed but its
native half is not: `import cairosvg` on this machine fails with
"cannot load library 'libcairo-2.dll'". Pillow 12.1.0 is present and can fill
polygons and stroke polylines, so the missing piece was only bezier flattening,
which is thirty lines. That is the same trade remyGlyphs.ts recorded when it
rasterised the milk carton: "the rasteriser was Pillow with the curves
flattened by hand".

WHAT THIS RASTERISER DOES **NOT** ESTABLISH, stated here rather than in a
footnote, because it is the single most important limitation of the whole
exercise: it is not react-native-svg. It approximates round joins by stamping a
disc at every flattened vertex, it fills each subpath independently (so no
even-odd holes — which is why every "hole" in these drawings is an opaque shape
painted on top instead), and it antialiases by supersampling rather than by
whatever the platform does. It answers "is this silhouette legible at this
size". It does not answer "does a phone draw this".

DELIBERATELY SMALL SVG SUBSET: path (M/L/H/V/C/Q/Z), circle, ellipse, rect,
polygon, polyline, flat fills, flat strokes, and rotation via a <g transform>.
No gradients, no filters, no masks, no CSS. react-native-svg 15.15.4 draws all
of it; anything richer would render in a browser and silently differ on device.
"""

import math
import re

# How many straight segments a curve becomes when flattened. High enough that a
# 48 pt render at 8x supersampling shows no faceting, cheap enough that the
# whole set rasterises in under a second.
CURVE_STEPS = 24
CIRCLE_STEPS = 96


def fmt(value: float) -> str:
    """A coordinate as short text. SVG path data is meant to be read."""
    text = f"{round(float(value), 2):.2f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


def hex_to_rgb(value: str) -> tuple:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------------------
# Shape constructors. A shape is (kind, geometry, style).
# ---------------------------------------------------------------------------


def style(fill=None, stroke=None, sw=1.4, rot=None) -> dict:
    """`rot` is (degrees, cx, cy) and becomes a <g transform="rotate(...)">."""
    return {"fill": fill, "stroke": stroke, "sw": sw, "rot": rot}


def path(d: str, st: dict) -> tuple:
    return ("path", d, st)


def circle(cx: float, cy: float, r: float, st: dict) -> tuple:
    return ("circle", (cx, cy, r), st)


def ellipse(cx: float, cy: float, rx: float, ry: float, st: dict) -> tuple:
    return ("ellipse", (cx, cy, rx, ry), st)


def rect(x: float, y: float, w: float, h: float, rx: float, st: dict) -> tuple:
    return ("rect", (x, y, w, h, rx), st)


def poly(points, st: dict) -> tuple:
    return ("poly", list(points), st)


def pline(points, st: dict) -> tuple:
    return ("pline", list(points), st)


# ---------------------------------------------------------------------------
# Path parsing and flattening
# ---------------------------------------------------------------------------

_TOKEN = re.compile(r"[A-Za-z]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?")


def _cubic(p0, p1, p2, p3):
    out = []
    for i in range(1, CURVE_STEPS + 1):
        t = i / CURVE_STEPS
        u = 1 - t
        x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
        y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
        out.append((x, y))
    return out


def _quad(p0, p1, p2):
    out = []
    for i in range(1, CURVE_STEPS + 1):
        t = i / CURVE_STEPS
        u = 1 - t
        x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
        y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
        out.append((x, y))
    return out


def parse_path(d: str):
    """SVG path data -> [(points, closed), ...]. Supports M/L/H/V/C/Q/Z, both cases."""
    tokens = _TOKEN.findall(d)
    i = 0
    subpaths = []
    current = []
    closed = False
    cursor = (0.0, 0.0)
    start = (0.0, 0.0)
    command = None

    def flush():
        nonlocal current, closed
        if len(current) > 1:
            subpaths.append((current, closed))
        current = []
        closed = False

    def number():
        nonlocal i
        value = float(tokens[i])
        i += 1
        return value

    while i < len(tokens):
        token = tokens[i]
        if re.match(r"[A-Za-z]", token):
            command = token
            i += 1
            if command in ("Z", "z"):
                if current:
                    closed = True
                    flush()
                cursor = start
                continue
        rel = command.islower()
        base = cursor if rel else (0.0, 0.0)
        if command in ("M", "m"):
            x, y = number() + base[0], number() + base[1]
            flush()
            cursor = start = (x, y)
            current = [cursor]
            command = "L" if command == "M" else "l"
        elif command in ("L", "l"):
            cursor = (number() + base[0], number() + base[1])
            current.append(cursor)
        elif command in ("H", "h"):
            cursor = (number() + base[0], cursor[1])
            current.append(cursor)
        elif command in ("V", "v"):
            cursor = (cursor[0], number() + base[1])
            current.append(cursor)
        elif command in ("C", "c"):
            p1 = (number() + base[0], number() + base[1])
            p2 = (number() + base[0], number() + base[1])
            p3 = (number() + base[0], number() + base[1])
            current.extend(_cubic(cursor, p1, p2, p3))
            cursor = p3
        elif command in ("Q", "q"):
            p1 = (number() + base[0], number() + base[1])
            p2 = (number() + base[0], number() + base[1])
            current.extend(_quad(cursor, p1, p2))
            cursor = p2
        else:
            raise ValueError(f"unsupported path command {command!r} in {d!r}")
    flush()
    return subpaths


def _ellipse_points(cx, cy, rx, ry):
    return [
        (cx + rx * math.cos(2 * math.pi * i / CIRCLE_STEPS), cy + ry * math.sin(2 * math.pi * i / CIRCLE_STEPS))
        for i in range(CIRCLE_STEPS)
    ]


def _rect_points(x, y, w, h, rx):
    if rx <= 0:
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    rx = min(rx, w / 2, h / 2)
    steps = 16
    corners = [
        (x + w - rx, y + h - rx, 0),
        (x + rx, y + h - rx, 90),
        (x + rx, y + rx, 180),
        (x + w - rx, y + rx, 270),
    ]
    points = []
    for cx, cy, start_deg in corners:
        for i in range(steps + 1):
            a = math.radians(start_deg + 90 * i / steps)
            points.append((cx + rx * math.cos(a), cy + rx * math.sin(a)))
    return points


def subpaths_of(shape):
    kind, geom, _ = shape
    if kind == "path":
        return parse_path(geom)
    if kind == "circle":
        cx, cy, r = geom
        return [(_ellipse_points(cx, cy, r, r), True)]
    if kind == "ellipse":
        cx, cy, rx, ry = geom
        return [(_ellipse_points(cx, cy, rx, ry), True)]
    if kind == "rect":
        x, y, w, h, rx = geom
        return [(_rect_points(x, y, w, h, rx), True)]
    if kind == "poly":
        return [(list(geom), True)]
    if kind == "pline":
        return [(list(geom), False)]
    raise ValueError(f"unknown shape kind {kind!r}")


# ---------------------------------------------------------------------------
# SVG emission
# ---------------------------------------------------------------------------


def _paint_attrs(st: dict) -> str:
    fill = st.get("fill") or "none"
    parts = [f'fill="{fill}"']
    if st.get("stroke"):
        parts.append(f'stroke="{st["stroke"]}"')
        parts.append(f'stroke-width="{fmt(st["sw"])}"')
        parts.append('stroke-linecap="round"')
        parts.append('stroke-linejoin="round"')
    return " ".join(parts)


def shape_to_svg(shape) -> str:
    kind, geom, st = shape
    paint = _paint_attrs(st)
    if kind == "path":
        body = f'<path d="{geom}" {paint}/>'
    elif kind == "circle":
        cx, cy, r = geom
        body = f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}" {paint}/>'
    elif kind == "ellipse":
        cx, cy, rx, ry = geom
        body = f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(rx)}" ry="{fmt(ry)}" {paint}/>'
    elif kind == "rect":
        x, y, w, h, rx = geom
        body = (
            f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" '
            f'rx="{fmt(rx)}" {paint}/>'
        )
    elif kind in ("poly", "pline"):
        pts = " ".join(f"{fmt(x)},{fmt(y)}" for x, y in geom)
        tag = "polygon" if kind == "poly" else "polyline"
        body = f'<{tag} points="{pts}" {paint}/>'
    else:
        raise ValueError(f"unknown shape kind {kind!r}")
    rot = st.get("rot")
    if rot:
        deg, cx, cy = rot
        return f'<g transform="rotate({fmt(deg)} {fmt(cx)} {fmt(cy)})">{body}</g>'
    return body


def to_svg(shapes, view_box: str = "0 0 24 24", size: int = 24) -> str:
    inner = "\n  ".join(shape_to_svg(s) for s in shapes)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" '
        f'width="{size}" height="{size}" fill="none">\n  {inner}\n</svg>\n'
    )


def to_inline_svg(shapes, size: int, view_box: str = "0 0 24 24") -> str:
    """One line of markup for the contact sheet, so the page needs no fetch."""
    inner = "".join(shape_to_svg(s) for s in shapes)
    return (
        f'<svg viewBox="{view_box}" width="{size}" height="{size}" fill="none" '
        f'aria-hidden="true">{inner}</svg>'
    )


# ---------------------------------------------------------------------------
# Rasteriser
# ---------------------------------------------------------------------------


def _rotate(points, rot):
    if not rot:
        return points
    deg, cx, cy = rot
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [((x - cx) * ca - (y - cy) * sa + cx, (x - cx) * sa + (y - cy) * ca + cy) for x, y in points]


def render(shapes, size: int, supersample: int = 8, grid: float = 24.0):
    """Rasterise to an RGBA image of `size` x `size` device pixels."""
    from PIL import Image, ImageDraw

    big = int(size * supersample)
    scale = big / grid
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for shape in shapes:
        st = shape[2]
        fill = hex_to_rgb(st["fill"]) + (255,) if st.get("fill") else None
        stroke = hex_to_rgb(st["stroke"]) + (255,) if st.get("stroke") else None
        width = max(1, int(round(st.get("sw", 1.4) * scale)))
        for points, closed in subpaths_of(shape):
            pts = [(x * scale, y * scale) for x, y in _rotate(points, st.get("rot"))]
            if len(pts) < 2:
                continue
            if fill and closed:
                draw.polygon(pts, fill=fill)
            if stroke:
                line = pts + [pts[0]] if closed else pts
                draw.line(line, fill=stroke, width=width, joint="curve")
                # Round caps and joins: Pillow has neither, so stamp a disc at
                # every flattened vertex. Cheap, and exactly what a round join is.
                r = width / 2
                for x, y in line:
                    draw.ellipse([x - r, y - r, x + r, y + r], fill=stroke)
    return image.resize((size, size), Image.LANCZOS)
