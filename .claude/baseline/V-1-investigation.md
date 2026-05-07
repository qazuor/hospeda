# V-1 Hero subtitle artifact — Investigation

## Method

Loaded `http://localhost:4321/es/` (main repo, current state) at 375x812 and
414x896 with Playwright. Inspected `.hero__title` and `.hero__description`
computed styles + bounding boxes. See screenshots:

- `V-1-before-mobile-375.png`
- `V-1-before-mobile-414.png`

## Measurements

### 375 px viewport

| Property | Value |
|---|---|
| `.hero__title` font-size | 36px |
| `.hero__title` line-height | 36px (ratio 1.0 from `@media (max-width:1024px)` rule) |
| `.hero__title` height | 72px (2 lines) |
| `.hero__title` bottom | 283.59 px |
| `.hero__description` top | 307.59 px |
| `.hero__description` line-height | 24px (1.5) |
| `.hero__description` height | 48px (2 lines) |
| `.hero__description` bottom | 355.59 px |
| `.social-proof` top | (depends on flex-wrap) |

### 414 px viewport

| Property | Value |
|---|---|
| `.hero__title` font-size | 36.7px |
| `.hero__title` line-height | 36.7px (1.0) |
| `.hero__title` bottom | 285 px |
| `.hero__description` top | 309 px |
| `.hero__description` bottom | 357 px |
| `.social-proof` top | 333 px |
| `.social-proof` bottom | 391.8 px |
| **Overlap (desc.bottom - sp.top)** | **24 px** |

## Findings

Two distinct artifacts visible at 375/414 px:

1. **Title glyph clipping** — `.hero__title` uses `line-height: 0.896` in base
   styles and `line-height: 1` inside `@media (max-width: 1024px)`. With
   `font-size: 36px` and LH = font-size, descenders/ascenders sit flush against
   the line box. With heading font (decorative, large x-height) this is
   visually tight but the descenders ("p" in "escapada") are not actually
   clipped at this viewport. Cosmetic only.

2. **Subtitle overlapped by social-proof block (REAL artifact)** — At 414 the
   description's last line sits at y=309..357 while `.social-proof` starts at
   y=333. A 24-pixel overlap. The "70+" badge and avatars visibly cover the
   word "litoral" / "experiencias" in the description. Root cause:
   `.hero__bottom { margin-top: -80px }` pulls the search/social-proof block
   up by 80 px to overlap the hero row, but at narrow viewports the hero row
   no longer has the right column (image hidden by `display: none` at <=640px),
   so the negative margin drags the social proof onto the description text.

## Recommended fix (matching SPEC-099 V-1 guidance)

Apply both changes in `apps/web/src/components/sections/HeroSection.astro`:

1. Bump `.hero__title` `line-height` to `1.0` (already there) and explicitly
   ensure descender room by adding `padding-bottom: 0.05em` is NOT needed.
   The spec asks for line-height bump at <=640px — already applied via the
   1024px breakpoint. Keep the explicit 640px rule for documentation.
2. Add `overflow-wrap: anywhere; line-height: 1.5;` to `.hero__description`
   (line-height already 1.5; add `overflow-wrap: anywhere` to handle long
   words gracefully on the narrowest viewports).
3. **Critical (real artifact fix)**: Reduce `.hero__bottom { margin-top }`
   negative pull at narrow viewports where the right-column image is hidden,
   so social-proof no longer overlaps the description. At <=640px set
   `margin-top: 0` (or a small positive value like 1rem).

## Conclusion

V-1 fix consists of:

- `.hero__title` line-height: 1.0 at <=640px (already in 1024px breakpoint;
  add explicit 640px rule for clarity).
- `.hero__description` `overflow-wrap: anywhere`.
- `.hero__bottom` `margin-top: 0` at <=640px to eliminate the 24px overlap
  with social-proof avatars.
