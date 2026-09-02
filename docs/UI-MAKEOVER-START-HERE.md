# UI makeover — start here

Fresh-session entry point. Everything else is in the two documents below; do
not re-derive what they already say.

| Read | What it is |
|---|---|
| `docs/UI-MAKEOVER-HANDOVER.md` | Context: the brief, the owner's rulings, constraints, hazards, open decisions. |
| `docs/UI-RESEARCH-PLAN.md` | The research programme. Six workstreams, each with a deliverable and a method. |

Still authoritative: `DESIGN.md`, `DESIGN-SOCIAL.md`, `PRODUCT-DECISIONS.md`
(PD-001…PD-020), `ARCHITECTURE.md`. `DESIGN-SOCIAL.md` carries three dated
`SUPERSEDED` / `CORRECTED` notes from 2026-08-27 — those passages are stale,
the rest of the file is not.

## Status

Phase 1 (scoping) **done**. Phase 2 (research) **done** — six reports, 7,782
lines, 45 renders, refereed in `docs/ui-research/ASSEMBLY.md`.
Phase 3 (execution) **not started — this is the job**.

**Start at `docs/ui-research/ASSEMBLY.md`.** It applies §3.7's referee table
where two reports disagree, lists seven places the standing documents are
factually wrong about the code, carries the seventeen decisions that are the
owner's, and sets the phase 3 order. The six `WS*.md` reports are the evidence
behind it; read the one you need, not all six.

Two things in it that change what phase 3 does:

- **A defect pass comes before the makeover.** Ten defects were found and
  verified that depend on no direction — cook mode has no exit, the thumbnail
  fallback never fires because an expired URL is not `null`, the timer loses
  time when backgrounded. `ASSEMBLY.md` §5.
- **The research asks to spend one constraint, and it is not a §8 refusal.** It
  is one sentence in `DESIGN.md` about the palette being ~95% cool graphite.
  `ASSEMBLY.md` §4.1, D2.

## What was done (phase 2, for the record)

One agent per workstream, six in parallel, sharing no memory — each brief
self-contained, pointed at both documents above, told to read its own section of
the plan as its spec, and writing to `docs/ui-research/WS<n>-<name>.md`.
Research agents were read-only on code, and that held: nothing under `src/`,
`tests/`, `supabase/`, `package.json` or `app.json` was touched.

**If you re-run any of this: make the agent create its report file early and
fill it in section by section.** A session rate limit killed five of the six on
the first attempt, four of them at the moment they were about to write, and
everything they had learned was lost because none of it was on disk.

1. Direction and palette
2. Layout and density at phone width
3. Dutch voice and copy
4. Icons, imagery, and the empty frame
5. Motion, feedback, and cook mode
6. The social layer, and the refusals

Then assemble per §3.7 of the plan (the referee table — who owns a call when
two workstreams disagree), put options to the owner, and only then touch code.

## Four things that are easy to get wrong

**The owner rejected the cliché, not warmth.** Cream-and-terracotta recipe-blog
styling stays out; warmth and softness are allowed if the execution is
distinctive.

**The film-editing metaphor may be replaced.** *Proof sheet*, *timecode*, *edit
bay* — he ruled it can go if something serves "de evolutie van het kookboek"
better, accepting that typography, icons and component names follow.

**The §8 refusals are rebuttable, not binding.** Likes, streaks, timestamps,
infinite scroll may be recommended — *"als dit eruit komt dat het verstandig is
om te doen mag het wél"*. Engage with the original reasoning; never reintroduce
one by accident. Read receipts and the private/public grade split are the
expensive ones.

**Prove every new component is mounted.** Five times in this repo a consumer
shipped with no producer while the suite stayed green. A component nobody
renders is this project's signature failure.

## The central question

Every conventional source of warmth has been refused somewhere here — warm
palettes, food photography, emoji, rounded cards, likes, celebration. **By what
mechanism does Remy become warm and gently funny?** If none exists inside the
current constraints, name the constraint the owner should spend.

## Two measured defects

- `background` → `surface` is **1.096:1** light, **1.078:1** dark. The card
  hierarchy is not subtle, it is absent. `tests/contrast.test.ts` misses it —
  it guards text legibility, not structural separation.
- **Every button is monospace** (`typeScale.button`), so `Ja` reads as a
  terminal command.

## Gates and traps

```
npm test          # 1524 tests / 69 files green
npm run typecheck # NEVER pipe to tail — it masks failures. Redirect, echo $? separately.
npm run lint      # zero warnings
npx expo export --platform web
```

Colour only via `src/theme/tokens.ts` (`no-color-literals` is an error). Dutch
copy, English code. 800-line file ceiling. **Phone width cannot be verified on
this machine** — headless Chrome renders wide and crops, so narrow screenshots
are not evidence.

Branch `feat/live-import-and-plan-phases`, pushed and in sync.
