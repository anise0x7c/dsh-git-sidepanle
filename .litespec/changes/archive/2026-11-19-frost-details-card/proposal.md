# Frost the details card like the operation prompt

## Why

The details card paints an opaque solid surface and a prominent shadow. The
shadow is almost entirely clipped by the card's stage, so it adds no visible
depth, while the opaque surface makes the card read differently from the bottom
operation prompt, which uses the Web application's native frosted material.

## What Changes

- The details card uses the same theme-derived translucent menu surface,
  backdrop blur and `@supports` enhancement as the floating operation prompt,
  with the same solid theme surface as the fallback when filtering is not
  available.
- The card's shadow is removed because it had no visible effect.
- The card keeps its separating border, rounded corners, edge gap, scroll
  behavior and slide animation.

## Non-goals

- No change to the bottom operation prompt's material, shadow or layout.
- No change to the details card's content, size, animation, reduced-motion
  behavior or the content beneath it.
