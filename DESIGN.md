# Caveo design system: "Craft Box"

## Direction
Apple-grade layout, spacing and type discipline, built from tactile craft materials (kraft cardboard, stitched felt,
peel-off stickers, glossy 2000s gel buttons, hazard tape), inspired by the hand-made look of crafted games.
All materials and the mascot are original (generated for this project; prompts in `pitch/asset-prompts/`).
Adjectives: tactile, playful, trustworthy, vivid, crafted. Essence: a hand-built airlock.

## Signature moves
- **The Chamber**: a felt-lined containment box with hazard tape across the top and a glass glare. Blocked attempts
  are slapped on as red die-cut stickers; the "Sandbox destroyed" seal carries Latch in his STOP pose.
- **Latch**: the felt airlock-guard mascot. Calm (keyhole shield) on the landing screen and in the tour bubble;
  alarmed (STOP hand) when a sandbox is destroyed.
- **The path**: every case carries one sticky 5-step track (Arrived, Sandboxed, Checked, Vaulted, Your call). Steps light
  green as the pipeline runs, turn red with a "!" when that step found trouble, and the current step pings in sky blue.
  Case sections carry the same numbers, and a finished case always offers "Next email" so the flow never dead-ends.
- **Verdict stickers**: rotated, white die-cut border, slap-on spring animation.

## Type
Display: **Fredoka** (rounded, chunky). UI/body: **Figtree**. Evidence: **JetBrains Mono**.

## Color (OKLCH)
kraft 0.74 0.075 70 · paper 0.985 0.012 85 · ink 0.27 0.03 60 · felt 0.25 0.025 220 ·
green 0.52 0.11 155 (pass/primary) · red 0.60 0.20 28 (critical/blocked) · sun 0.86 0.15 88 (hold/hazard) · sky 0.72 0.10 235 (focus/new).
Severity is always color + word + glyph.

## Materials and tokens
Paper cards: radius 22px, stitched dashed outline inset 8px, soft layered lift shadow.
Buttons: pill gel with top gloss highlight; one primary (green) per view; danger is red gel.
Motion: spring cubic-bezier(0.34, 1.4, 0.5, 1) for stickers and pops, ease-out 160-260ms elsewhere; reduced-motion honored.

## Layout
Three floating boards on kraft: inbox (320) | case (fluid) | chamber (420). Frosted sticky top bar.
Tablet: chamber drops below. Phone: case first (hook), then inbox, then chamber.

## Changelog
- 2026-11-03: initial "evidence ledger" system.
- 2026-11-04: added the path (linear 5-step process), numbered sections, vault row, next-email flow, 3-step landing.
- 2026-11-03: replaced with "Craft Box" at Roman's request (Apple polish + 2000s tactile vibe).
