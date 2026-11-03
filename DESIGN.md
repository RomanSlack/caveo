# Caveo design system

## Discovery
- **Artifact:** operational dashboard (AP fraud control) that must also read clearly in a 3-minute demo video.
- **Audience:** AP clerks and controllers at mid-size companies; hackathon judges watching a screen recording.
- **Primary action:** decide on a payment (approve / reject / escalate) with the evidence in view.
- **Adjectives:** forensic, unflinching, precise, calm-under-fire, ledger-like.
- **Essence:** evidence room ledger.

## Aesthetic and signature move
Cool bone-white ledger surfaces with ink-green structure, one vermilion signal color reserved for containment.
**Signature move, the Chamber:** the right column is a dark, gridded containment window. Every sandbox event lands
there in mono type; blocked attempts are stamped against the wall in vermilion. When the sandbox is destroyed, the
chamber seals with a hatch pattern and a "DESTROYED" plate. The verdict is a ledger stamp, not a pill badge.

## Typography
- Display + UI: **Schibsted Grotesk** (newsroom grotesk: precise, serious, not the AI default).
- Evidence/data: **IBM Plex Mono** (raw evidence, URLs, account numbers, timeline).
- Scale: 1.25 ratio, base 15px: 12 / 15 / 18.75 / 23.4 / 29.3 / 36.6.

## Color (OKLCH)
| role | value |
|---|---|
| bg | oklch(0.975 0.004 170) |
| surface | oklch(0.995 0.002 170) |
| fg / ink | oklch(0.24 0.03 170) |
| muted | oklch(0.50 0.02 170) |
| border | oklch(0.88 0.01 170) |
| brand (ink green) | oklch(0.36 0.06 170) |
| signal (vermilion, containment + critical) | oklch(0.60 0.20 33) |
| high (amber) | oklch(0.72 0.15 70) |
| medium (ochre) | oklch(0.80 0.12 95) |
| pass (green) | oklch(0.60 0.12 155) |
| chamber bg | oklch(0.19 0.02 170) |

Severity is always shown as color + word + glyph, never color alone.

## Tokens
- Spacing base 4px; tight 8 inside groups, 24-32 between regions.
- Radius: 4px (controls, chips), 8px (panels). No shadows: defined 1px edges only.
- Motion: 160ms / 240ms, ease-out cubic-bezier(0.2, 0.7, 0.2, 1); timeline rows enter with opacity + 6px translate;
  the "seal" is an opacity fade of the hatch. prefers-reduced-motion removes translate.

## Layout
Three regions, full height: inbox rail (300px) | case evidence (fluid) | chamber (380px, dark).
Decision bar pinned at the bottom of the case column.

## Components
Buttons ranked: one primary (ink fill) per view, secondary outlined, destructive actions outlined in signal.
All have hover / active / focus-visible (2px ring) / disabled states. Tables: labels left, figures right, tabular-nums.

## Slop audit
Run against references/slop-checklist.md after build. See changelog.

## Changelog
- 2026-11-03: initial system.
