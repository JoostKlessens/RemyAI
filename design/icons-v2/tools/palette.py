"""
The whole palette for all forty-five icons. Twenty values, seven hue families.

WHY A CLOSED LIST AND NOT A COLOUR PER ICON. Forty-five drawings that each
invent their own colours is a fruit bowl, not a set — you can tell because
nothing about the twelfth icon would predict the thirteenth. So the hue is not
chosen per drawing; it is chosen per FOOD FAMILY, and every drawing in that
family inherits it:

    green   plants          leaf, sprout, herbs, legumes, salad greens
    amber   grains & dairy  bread, pasta, grain, cheese, egg yolk, hourglass sand
    orange  roots & spice   carrot, curry
    red     fruit           apple, tomato
    meat    animal protein  beef, pork, chicken, the meat category
    teal    water & cold    fish, the dairy carton's label
    berry   sugar           sweets

    ink     every outline and every UI control
    cream   the neutral inside of things: rice, dough, bowls, egg white, bone

That rule is the reason a stranger can guess a colour before seeing the icon,
and it is what makes the set read as one system at a glance on a chip row.

WHY UI ICONS ARE INK PLUS EXACTLY ONE GREEN. The app's ground is going white
with green accents, so a coloured control would compete with the one accent the
product actually spends. The sixteen UI glyphs are therefore ink line-work with
a single green element — the part that is "the point" of the control: the tick,
the plus, the marked day, the active filter. Two exceptions, both deliberate:
`warning` is amber, because a warning that reads as the accent colour is a
warning nobody heeds; and `timer` gets amber sand, because sand is the one
thing in it that is not the frame.

WHY NOT PULL THESE FROM src/theme/tokens.ts. The tokens are semantic UI roles
(background, surface, accent, positive) and there are 26 of them per scheme;
they answer "what colour is a pressed chip", not "what colour is a carrot".
Borrowing `positive` for a leaf would tie the drawing of a vegetable to the
meaning of a completed meal, and the day one moves the other follows for no
reason. `GREEN` below is deliberately close to the token palette's green
family so the two sit together, and deliberately its own value so they can
part company.

CONTRAST, MEASURED, ON THE GROUND THESE WILL SIT ON. Every fill below is
outlined in INK (#26332C), whose contrast against white is 12.6:1, so the
SILHOUETTE of every icon clears WCAG 1.4.11's 3:1 for a non-text graphic no
matter how pale the fill inside it is. That is the whole reason the outline is
non-negotiable: it means CREAM (#F8F2E4, 1.06:1 against white) can be used as a
neutral body without the icon disappearing on a white card.
"""

# Structure -----------------------------------------------------------------
INK = "#26332C"        # every outline, and the body of every UI control
INK_SOFT = "#7A887F"   # secondary line-work: steam, faint dividers
CREAM = "#F8F2E4"      # the neutral inside: rice, dough, bowls, egg white, bone
WHITE = "#FFFFFF"      # highlights, paper, the inside of an unfilled control

# Plants --------------------------------------------------------------------
GREEN = "#2E7A4E"
GREEN_SOFT = "#BCDFC6"
GREEN_DEEP = "#1C5637"

# Grains, dairy fat, sand ---------------------------------------------------
AMBER = "#E4AC44"
AMBER_SOFT = "#F7E2B4"

# Roots and spice -----------------------------------------------------------
ORANGE = "#E07C3A"
ORANGE_SOFT = "#F6C9A2"

# Fruit ---------------------------------------------------------------------
RED = "#CB4A3D"
RED_SOFT = "#EFAA9E"

# Earth: nuts, soil, wood, chopsticks ---------------------------------------
BROWN = "#8C6446"
BROWN_SOFT = "#D9BCA1"

# Animal protein ------------------------------------------------------------
MEAT = "#B45A3E"
MEAT_SOFT = "#DE9A72"
FAT = "#F3E3D2"        # fat rim, bone, butcher's string

# Water and cold ------------------------------------------------------------
TEAL = "#3E8AA6"
TEAL_SOFT = "#C2DEE9"

# Sugar ---------------------------------------------------------------------
BERRY = "#8D4C85"
BERRY_SOFT = "#E0C3DB"

# Stroke weights ------------------------------------------------------------
# Two weights, not one. UI controls are line drawings and carry Feather's
# optical weight so they still look like controls; food icons are filled
# silhouettes and take a lighter outline, because a 1.9 outline around a filled
# shape eats the fill at 14 pt. Both use the same INK, which is what keeps the
# two languages reading as one set.
SW_UI = 1.9
SW_OUTLINE = 1.45
SW_DETAIL = 1.2

#: Ordered for the contact sheet's swatch row — structure, then hue families.
SWATCHES = [
    ("ink", INK), ("inkSoft", INK_SOFT), ("cream", CREAM),
    ("green", GREEN), ("greenSoft", GREEN_SOFT), ("greenDeep", GREEN_DEEP),
    ("amber", AMBER), ("amberSoft", AMBER_SOFT),
    ("orange", ORANGE), ("orangeSoft", ORANGE_SOFT),
    ("red", RED), ("redSoft", RED_SOFT),
    ("brown", BROWN), ("brownSoft", BROWN_SOFT),
    ("meat", MEAT), ("meatSoft", MEAT_SOFT), ("fat", FAT),
    ("teal", TEAL), ("tealSoft", TEAL_SOFT),
    ("berry", BERRY), ("berrySoft", BERRY_SOFT),
]
