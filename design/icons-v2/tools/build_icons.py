"""
Write the forty-five .svg files, the contact sheet, and (optionally) proof PNGs.

Run:  python design/icons-v2/tools/build_icons.py
      python design/icons-v2/tools/build_icons.py --raster <dir>

WHY IT READS src/components/iconFont.ts. The set is only correct if it draws
exactly the names the app asks for, and that list lives in one place. Retyping
it here would create a second list that can silently disagree with the first —
the failure iconFont.ts's own header spends four paragraphs refusing ("two
tables keyed by the same name are two tables that can disagree"). So the names
are parsed out of the source and asserted against what this generator draws. It
is a READ. Nothing under src/ is written, ever, by anything in this directory.

THAT CHECK IMMEDIATELY EARNED ITS KEEP: the brief for this work said "41
iconen" and then listed 45, and ICON_NAMES holds 45. A hand-copied list would
have shipped four missing drawings and a confident sentence saying otherwise.

WHY THE CONTACT SHEET INLINES EVERY SVG instead of using <img src="pasta.svg">.
Opened from the filesystem, a browser treats each file:// document as its own
opaque origin, so external SVG references are the kind of thing that works on
one machine and shows forty-five broken-image icons on another. Inlining makes
the page one self-contained file that opens offline, which is the whole point
of handing it over for review.
"""

import argparse
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import palette as p  # noqa: E402
from geometry import render, subpaths_of, to_inline_svg, to_svg  # noqa: E402
from icons_food import CATEGORY_ICONS, DISH_ICONS  # noqa: E402
from icons_ui import DISPLAY_ICONS, UI_ICONS  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(os.path.dirname(OUT_DIR))
ICON_FONT_TS = os.path.join(REPO_ROOT, "src", "components", "iconFont.ts")

#: The four sizes the owner has to judge these at. 14 is the library tile's
#: BADGE_GLYPH_SIZE, 16 is a chip and an ingredient row, 24 is the tab bar.
#: 48 is not a size the app uses — it is there so a human can see what they
#: are approving.
PREVIEW_SIZES = (14, 16, 24, 48)

GROUPS = [
    ("Bediening", "De zestien knoppen en besturingselementen. Inkt met één groen accent.", UI_ICONS),
    ("Weergave", "Grote glyphs: de lege bibliotheek, de soepkom, en de badge op een tegel.", DISPLAY_ICONS),
    ("Gerechten", "Eén per DISH_TAGS-ingang. De chips in de 'Waarmee?'-rij.", DISH_ICONS),
    ("Ingrediëntcategorieën", "Eén per INGREDIENT_CATEGORIES-ingang. De ingrediëntenlijst.", CATEGORY_ICONS),
]

ALL_ICONS = [entry for _, _, group in GROUPS for entry in group]


def icon_names_from_source() -> list:
    """The names the app asks for, read out of ICON_NAMES rather than retyped."""
    with open(ICON_FONT_TS, encoding="utf-8") as handle:
        source = handle.read()
    match = re.search(r"export const ICON_NAMES = \[(.*?)\] as const;", source, re.S)
    if not match:
        raise SystemExit("could not find ICON_NAMES in " + ICON_FONT_TS)
    return re.findall(r"'([a-z-]+)',", match.group(1))


def bounding_box(shapes):
    """Every flattened point, ignoring stroke width. Catches a drawing that ran off the grid."""
    from geometry import _rotate

    xs, ys = [], []
    for shape in shapes:
        for points, _ in subpaths_of(shape):
            for x, y in _rotate(points, shape[2].get("rot")):
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def write_svgs() -> None:
    for name, shapes in ALL_ICONS:
        with open(os.path.join(OUT_DIR, f"{name}.svg"), "w", encoding="utf-8") as handle:
            handle.write(to_svg(shapes))


def _swatch_row() -> str:
    cells = "".join(
        f'<div class="swatch"><span style="background:{value}"></span>'
        f"<code>{name}</code><small>{value}</small></div>"
        for name, value in p.SWATCHES
    )
    return f'<div class="swatches">{cells}</div>'


def _dense_row(shapes_by_name, background: str, caption: str) -> str:
    icons = "".join(to_inline_svg(shapes, 16) for _, shapes in shapes_by_name)
    return (
        f'<figure class="dense" style="background:{background}">'
        f'<div class="dense-row">{icons}</div>'
        f"<figcaption>{html.escape(caption)}</figcaption></figure>"
    )


def _card(name: str, shapes) -> str:
    sizes = "".join(
        f'<div class="size"><div class="stage">{to_inline_svg(shapes, size)}</div>'
        f"<small>{size}</small></div>"
        for size in PREVIEW_SIZES
    )
    return f'<article class="card"><div class="sizes">{sizes}</div><h3>{html.escape(name)}</h3></article>'


def write_contact_sheet() -> None:
    sections = []
    for title, blurb, group in GROUPS:
        cards = "".join(_card(name, shapes) for name, shapes in group)
        sections.append(
            f'<section><header class="group"><h2>{html.escape(title)}'
            f'<span class="count">{len(group)}</span></h2>'
            f"<p>{html.escape(blurb)}</p></header>"
            f'<div class="grid">{cards}</div></section>'
        )
    page = _PAGE.format(
        total=len(ALL_ICONS),
        swatches=_swatch_row(),
        # The three grounds these actually land on, read out of the tokens the
        # parallel white-and-green revision just committed — NOT invented here,
        # and NOT plain white: `background` turned out to be a pale mint
        # (#D9ECDC), which is a warmer-cooler clash risk for every cream fill in
        # the set and therefore the single most useful thing to show.
        dense_white=_dense_row(
            ALL_ICONS, "#FFFFFF",
            "Alle 45 op 16 pt, op surfaceRaised (#FFFFFF) — de kaart waar de meeste iconen op staan.",
        ),
        dense_surface=_dense_row(
            ALL_ICONS, "#D9ECDC",
            "Dezelfde rij op background (#D9ECDC) — de nieuwe groene grond, niet wit.",
        ),
        dense_sunken=_dense_row(
            ALL_ICONS, "#C6DEC9",
            "En op surfaceSunken (#C6DEC9) — de put van een niet-geselecteerde chip.",
        ),
        sections="".join(sections),
    )
    with open(os.path.join(OUT_DIR, "contact-sheet.html"), "w", encoding="utf-8") as handle:
        handle.write(page)


def write_rasters(directory: str) -> None:
    """Proof PNGs for MY OWN eyes — not a deliverable, and not a device test."""
    from PIL import Image

    os.makedirs(directory, exist_ok=True)
    pad, label = 10, 16
    cell = max(PREVIEW_SIZES) + pad * 2
    columns = len(PREVIEW_SIZES)
    rows = len(ALL_ICONS)
    sheet = Image.new("RGB", (cell * columns, (cell + label) * rows), (255, 255, 255))
    for row, (name, shapes) in enumerate(ALL_ICONS):
        for column, size in enumerate(PREVIEW_SIZES):
            image = render(shapes, size)
            x = column * cell + (cell - size) // 2
            y = row * (cell + label) + (cell - size) // 2
            sheet.paste(image, (x, y), image)
        # A single big render per icon too, so a shape can be inspected alone.
        render(shapes, 128).save(os.path.join(directory, f"{name}-128.png"))
    sheet.save(os.path.join(directory, "_proof-sheet.png"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raster", help="directory for proof PNGs (not part of the deliverable)")
    args = parser.parse_args()

    drawn = [name for name, _ in ALL_ICONS]
    expected = icon_names_from_source()
    missing = [n for n in expected if n not in drawn]
    extra = [n for n in drawn if n not in expected]
    duplicates = sorted({n for n in drawn if drawn.count(n) > 1})
    if missing or extra or duplicates:
        raise SystemExit(f"name mismatch — missing={missing} extra={extra} duplicates={duplicates}")
    if drawn != expected:
        raise SystemExit("drawn in a different ORDER than ICON_NAMES; the contact sheet would mislead")

    for name, shapes in ALL_ICONS:
        x0, y0, x1, y1 = bounding_box(shapes)
        if x0 < 0.3 or y0 < 0.3 or x1 > 23.7 or y1 > 23.7:
            print(f"  ! {name} runs to ({x0:.1f},{y0:.1f})-({x1:.1f},{y1:.1f}) on a 24 grid")

    write_svgs()
    write_contact_sheet()
    print(f"wrote {len(ALL_ICONS)} svg files + contact-sheet.html to {OUT_DIR}")
    if args.raster:
        write_rasters(args.raster)
        print(f"wrote proof rasters to {args.raster}")


_PAGE = """<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Remy iconen v2 — contactblad</title>
<style>
  :root {{
    --ink: #26332C; --ink-2: #55635B; --ink-3: #8A968E;
    --rule: #E3E8E3; --green: #2E7A4E; --paper: #FFFFFF; --sunken: #F4F6F3;
    --mono: ui-monospace, "SFMono-Regular", "Cascadia Mono", "Consolas", monospace;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); }}
  .wrap {{ max-width: 1180px; margin: 0 auto; padding: 56px 28px 96px; }}

  .masthead {{ border-bottom: 2px solid var(--ink); padding-bottom: 22px; margin-bottom: 34px; }}
  .eyebrow {{ font-family: var(--mono); font-size: 11px; letter-spacing: .14em;
              text-transform: uppercase; color: var(--green); margin: 0 0 10px; }}
  h1 {{ font-size: clamp(28px, 4vw, 46px); line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 12px; }}
  .lede {{ margin: 0; max-width: 62ch; color: var(--ink-2); font-size: 15px; line-height: 1.6; }}
  .lede strong {{ color: var(--ink); }}

  .swatches {{ display: flex; flex-wrap: wrap; gap: 10px; margin: 26px 0 6px; }}
  .swatch {{ display: flex; flex-direction: column; gap: 4px; width: 92px; }}
  .swatch span {{ height: 30px; border-radius: 3px; border: 1px solid var(--rule); }}
  .swatch code {{ font-family: var(--mono); font-size: 10px; color: var(--ink); }}
  .swatch small {{ font-family: var(--mono); font-size: 9px; color: var(--ink-3); }}

  .dense {{ margin: 0 0 14px; padding: 18px 20px 12px; border: 1px solid var(--rule); border-radius: 4px; }}
  .dense-row {{ display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }}
  .dense figcaption {{ font-family: var(--mono); font-size: 10.5px; color: var(--ink-2);
                       margin-top: 14px; letter-spacing: .02em; }}

  section {{ margin-top: 52px; }}
  .group {{ border-top: 1px solid var(--ink); padding-top: 12px; margin-bottom: 20px; }}
  .group h2 {{ font-size: 19px; margin: 0 0 4px; display: flex; align-items: baseline; gap: 10px;
               letter-spacing: -0.01em; }}
  .count {{ font-family: var(--mono); font-size: 11px; color: var(--green); }}
  .group p {{ margin: 0; font-size: 13px; color: var(--ink-2); }}

  .grid {{ display: grid; gap: 1px; background: var(--rule);
           grid-template-columns: repeat(auto-fill, minmax(216px, 1fr));
           border: 1px solid var(--rule); }}
  .card {{ background: var(--paper); padding: 18px 14px 12px; }}
  .card:hover {{ background: var(--sunken); }}
  .sizes {{ display: flex; align-items: flex-end; justify-content: center; gap: 14px; min-height: 62px; }}
  .size {{ display: flex; flex-direction: column; align-items: center; gap: 5px; }}
  .stage {{ display: flex; align-items: flex-end; height: 48px; }}
  .size small {{ font-family: var(--mono); font-size: 9px; color: var(--ink-3); }}
  .card h3 {{ font-family: var(--mono); font-size: 11.5px; font-weight: 500; text-align: center;
              margin: 14px 0 0; color: var(--ink); letter-spacing: .01em; }}

  .note {{ margin-top: 56px; border-left: 3px solid var(--green); padding: 4px 0 4px 16px;
           font-size: 13.5px; line-height: 1.65; color: var(--ink-2); max-width: 70ch; }}
  .note strong {{ color: var(--ink); }}
</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <p class="eyebrow">Remy · iconen v2 · ter beoordeling</p>
    <h1>{total} iconen, opnieuw getekend, in kleur</h1>
    <p class="lede">Elk icoon staat hieronder op <strong>14, 16, 24 en 48 pt</strong> — 14 is de badge op
      een bibliotheektegel, 16 een chip en de ingrediëntenlijst, 24 de tabbalk. 48 gebruikt de app niet;
      die staat er zodat je kunt zien wat je goedkeurt. Alles is SVG-tekst, geen font.
      <strong>Nog nergens ingebouwd</strong> — bedraden is een aparte stap, na jouw akkoord.</p>
    {swatches}
  </header>

  {dense_white}
  {dense_surface}
  {dense_sunken}

  {sections}

  <p class="note"><strong>Wat hier wél is vastgesteld:</strong> de vormen zijn op 14, 16, 24 en 48 px
  gerasterd en met het oog bekeken, en elk icoon past binnen het 24×24-raster.
  <strong>Wat hier níet is vastgesteld:</strong> geen toestel en geen <code>react-native-svg</code> heeft
  deze tekeningen ooit gerenderd. Antialiasing op een echt scherm, en of de optische zwaarte klopt naast
  de tekst in de app, staan allebei nog open.</p>
</div>
</body>
</html>
"""


if __name__ == "__main__":
    main()
