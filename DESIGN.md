# Caveo design system: "Craft Box"

## Direction
Apple-grade layout, spacing and type discipline, built from tactile craft materials (kraft cardboard, stitched felt,
peel-off stickers, glossy 2000s gel buttons, hazard tape), inspired by the hand-made look of crafted games.
All materials and the mascot are original (generated for this project; prompts in `pitch/asset-prompts/`).
Adjectives: tactile, playful, trustworthy, vivid, crafted. Essence: a hand-built airlock.

## Signature moves
- **The Chamber**: a felt-lined containment box with hazard tape across the top and a glass glare. Blocked attempts
  are slapped on as red die-cut stickers; the "Sandbox destroyed" seal carries Latch in his STOP pose.
- **Latch**: the felt airlock-guard mascot, with eight poses that swap with a squash-and-pop and each have their own loop:
  point (landing, at the inbox), sleep (empty Chamber, floating Zs), carry (taking the file in), inspect (magnifier, checking),
  alarm (STOP, quarantined), phone (hold: call the vendor; escalated), cheer (ready/approved, clean seal), calm (default). Calm (keyhole shield) on the landing screen and in the tour bubble;
  alarmed (STOP hand) when a sandbox is destroyed.
- **The path**: every case carries one sticky 5-step track (Arrived, Sandboxed, Checked, Vaulted, Your call). Steps light
  green as the pipeline runs, turn red with a "!" when that step found trouble, and the current step pings in sky blue.
  Case sections carry the same numbers, and a finished case always offers "Next email" so the flow never dead-ends.
- **The guide**: on first visit Latch hops out of the hero and walks you through ONE email (the booby-trapped Summit
  "secure viewer", pinned to the top of the inbox because it lights up the Chamber the most), one real click at a time,
  then stops for good. It joins on your first click (the landing explains itself, and the hero Latch never vanishes).
  A stitched yellow ring marks the next thing to press; the page is never dimmed and never auto-scrolled. The note
  appears in place at each step (never slides across the screen) and is placed so it never covers another Latch or
  the Chamber. If the target is off screen the note docks with "Show me", which scrolls to it.
- **Latch never moves the page**: in-flow spots (hero, Chamber idle, verdict react) are fixed boxes sized to the tallest
  pose they show, and Latch stands on the floor of the box, so pose swaps cannot shift layout.
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
- 2026-11-04: interactive guide (spotlight + Latch note), first visit only, restart with "Start with the first email".
- 2026-11-04: guide covers the first email only, starts on the booby-trap invoice, no dimming, no auto-scroll, Show me fixed; fixed-box Latch spots stop pose swaps from shifting layout.
- 2026-11-04: guide starts on the first click, appears in place instead of flying in, keeps clear of other Latches; gentler pose swaps; re-rendering the same case no longer replays entrance animations.
- 2026-11-04: Latch got six new poses (latch3-*.webp) and a pose state machine.
- 2026-11-04: added the path (linear 5-step process), numbered sections, vault row, next-email flow, 3-step landing.
- 2026-11-03: replaced with "Craft Box" at Roman's request (Apple polish + 2000s tactile vibe).
