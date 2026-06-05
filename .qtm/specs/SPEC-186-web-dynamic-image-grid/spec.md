---
specId: SPEC-186
title: Web Dynamic Image Grid — count-aware gallery layout, fixed-ratio cells & per-cell responsive images
slug: web-dynamic-image-grid
type: feature
status: in-progress
complexity: medium
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-186-web-dynamic-image-grid
worktree: /home/qazuor/projects/WEBS/hospeda-spec-186-web-dynamic-image-grid
linearIssues:
  - BETA-53
tags:
  - web
  - gallery
  - image-grid
  - responsive-images
  - cloudinary
  - accessibility
  - ui-polish
---

# SPEC-186 — Web Dynamic Image Grid

> Skeleton note: this is the formalized functional spec. Tasks and `index.json`
> updates are produced by the caller after this file lands — do not generate them here.

## 1. Origin & problem statement

### BETA-53 — "Implementar grid dinámico de imágenes según cantidad disponible"

The web image gallery (`apps/web`) renders the same fixed layout regardless of how
many images an entity actually has. The grid was designed for a "full" gallery (one
large featured image plus three stacked thumbnails) and degrades badly when fewer
images are present: it leaves **empty gaps**, produces an **unbalanced composition**,
and on the "extras" path it **silently hides images** behind hard slice caps with no
affordance to see the rest.

The ask is to make the grid **adapt its layout to the available image count** (1, 2,
3, 4, 5+) so the composition always looks intentional, never broken or gappy, and so
that when there are more images than the inline preview shows, the user gets an
explicit "see all" affordance instead of silently-dropped images.

### Concrete current bugs (verified this session)

1. **Fixed 3-row thumbnail grid leaves empty gaps.** In the `detail` variant
   (`ImageGallery.client.tsx` `DetailVariant`, ~line 200) the thumbnail column is
   `styles.thumbGrid` which is hard-coded `grid-template-rows: repeat(3, 1fr)`
   (`ImageGallery.module.css` ~line 84). With only 1 or 2 thumbnails the grid still
   reserves 3 rows, so cells are stretched/empty and the mosaic looks broken. The
   ONLY count-aware branch that exists today is the binary `mosaicWithThumbs` toggle
   (0 thumbs vs 1+ thumbs) — there is no per-count layout.

2. **No count adaptation in `cover-plus-grid`.** The `cover-plus-grid` variant
   (`CoverPlusGridVariant`, ~line 277) always renders the extras as a fixed
   `grid-template-columns: repeat(3, 1fr)` (`.inlineGrid`, ~line 161) with no branch
   for 1/2/3/4 extras — a single extra image becomes a lone cell in a 3-column track.

3. **Hard caps silently hide images.** `DetailVariant` does `thumbs.slice(0, 3)`
   (~line 202) and `CoverPlusGridVariant` does `rest.slice(0, 6)` (~line 308). Any
   image beyond the cap simply never renders inline and there is **no "+N más"
   overlay or link** to reach them — the only way to see all photos is the separate
   `/fotos` sub-page, which the inline grid never points to.

4. **The `/fotos` all-photos sub-page is a divergent masonry.** The dedicated
   sub-page (`pages/[lang]/alojamientos/[slug]/fotos.astro`) uses a CSS
   `columns: 3` masonry with its own breakpoints (1024px→2, 768px→1) and a
   completely different cell system from the inline gallery. It does not share the
   count-aware rules and visually diverges from the gallery it is the "see all"
   destination for.

5. **Dead legacy component.** `apps/web/src/components/accommodation/HeroGallery.astro`
   (204 lines, GLightbox-based) is imported nowhere — it survives only as references
   in JSDoc comments in `lib/media.ts` (~lines 105, 275), `lib/api/transforms.ts`
   (~line 636), and `data/types.ts` (~line 576). It is confusing dead weight.

## 2. Current architecture (verified facts)

| Concern | Location | State today |
|---------|----------|-------------|
| Primary gallery island | `apps/web/src/components/ImageGallery.client.tsx` | React island, hydrated `client:visible`; two variants via `variant` prop |
| Gallery styles | `apps/web/src/components/ImageGallery.module.css` | Single `@media (max-width: 640px)` breakpoint |
| `detail` variant | `ImageGallery.client.tsx` `DetailVariant` (~line 200) | `[featured, ...thumbs]`, `thumbs.slice(0,3)`, `.mosaic` 2fr/1fr + `.thumbGrid` `repeat(3,1fr)` |
| `cover-plus-grid` variant | `ImageGallery.client.tsx` `CoverPlusGridVariant` (~line 277) | `[cover, ...rest]`, `rest.slice(0,6)`, `.coverPlusGrid` + `.inlineGrid` `repeat(3,1fr)` |
| Lightbox | `Lightbox` sub-component (~line 65) | Uses shared `Dialog.client.tsx` (transparent, full): focus-trap, scroll-lock, Esc, arrow-keys, prev/next, thumb strip, `{n}/{total}` aria-live counter |
| All-photos sub-page | `apps/web/src/pages/[lang]/alojamientos/[slug]/fotos.astro` | Pure Astro, CSS `columns:3` masonry, `<a data-glightbox>` links, shows ALL images + videos |
| Dead component | `apps/web/src/components/accommodation/HeroGallery.astro` | Imported nowhere; only JSDoc references remain |
| Media helper | `@repo/media` `getMediaUrl(url, options)` + `MEDIA_PRESETS` (`packages/media/src/presets.ts`) | 7 presets; `gallery = w_800,q_auto,f_auto,dpr_auto`; supports `width`/`height`/`raw` overrides |
| Web media extractor | `apps/web/src/lib/media.ts` `extractGalleryItems()` (~line 284) | Produces `GalleryItem { url, caption?, description? }` applying the `gallery` preset |

### Component-facing data shapes

- `GalleryImage { url: string; alt: string; caption?: string }` — the island's input
  interface (`ImageGallery.client.tsx` ~line 29).
- `GalleryItem { url: string; caption?: string; description?: string }` — produced by
  `extractGalleryItems()` in `lib/media.ts` (~line 108).

### Image data shape — schema SSOT

`packages/schemas/src/common/media.schema.ts`:

- `ImageSchema { moderationState, url, caption?(3-100), description?(10-300), alt?(1-200), publicId?, attribution? }`
- `MediaSchema { featuredImage?, gallery?[], videos?[] }`

There is **NO `order`, NO `width`/`height`, and NO srcset metadata anywhere** in the
schema. This is the decisive constraint: a true masonry / proportion-respecting layout
needs intrinsic `width`/`height` to avoid CLS, and the schema does not carry them.

### Image rendering today

- Remote/API images render as a plain `<img>` with a **single** Cloudinary-transformed
  URL — no `srcset`, no `<picture>`. `dpr_auto` / `f_auto` / `q_auto` handle
  format/DPR negotiation at the CDN.
- Local static images use `astro:assets` `<Image>` (heroes/cards only — **not** the
  gallery grids).
- The featured image is the **LCP candidate** on the detail page (`loading="eager"`,
  `fetchPriority="high"`, `width={800}`, `height={480}`); thumbnails are
  `loading="lazy"`.
- A single Cloudinary `gallery` preset (`w_800,q_auto,f_auto,dpr_auto`) is applied to
  every gallery cell regardless of how big that cell renders — small cells download an
  800px image they never need.

### Used on (4 entities share the island)

| Page | Variant |
|------|---------|
| Accommodation detail `pages/[lang]/alojamientos/[slug].astro` | `detail` |
| Event detail `pages/[lang]/eventos/[slug].astro` | `detail` |
| Post detail `pages/[lang]/publicaciones/[slug].astro` | `cover-plus-grid` |
| Destination detail via `components/destination/DestinationGallery.astro` | `detail` |

Any layout/markup change to the island is a 4-entity blast radius — call this out in
testing.

### Project rules that constrain this work

- **Web styling = vanilla CSS / CSS Modules** (`*.module.css` colocated). NO Tailwind
  in `apps/web` (Tailwind is admin-only).
- **i18n for all user-facing text** via `@repo/i18n`; default locale is Spanish (`es`),
  also `en` and `pt`. New strings (`+N más`, "ver todas") MUST be i18n keys.
- **Astro: minimize client JS**; `client:visible` for the island is correct and stays.
- **Accessibility**: alt text required at component level (fallback = entity name); new
  interactive elements (the `+N` overlay, lightbox triggers) must be keyboard-accessible
  with aria labels; the existing focus-trap / Esc / arrow-key lightbox behavior is
  preserved.
- **Performance**: featured image stays the LCP candidate (eager/high priority); other
  cells stay lazy; per-cell `srcset` must NOT regress LCP. Fixed-ratio cells inherently
  prevent CLS (a stated benefit of the chosen approach).
- **Schemas SSOT** in `@repo/schemas`. No schema change is needed here (see §10 D-2).
- `@repo/media` `getMediaUrl` is the single image-URL builder; new presets are added in
  `packages/media/src/presets.ts`, never inline in components.

## 3. Goals & non-goals

### Goals

1. Make both island variants (`detail` and `cover-plus-grid`) compose a balanced,
   gap-free layout at every image count (1, 2, 3, 4, 5+), driven by explicit
   count-aware layout rules.
2. For 5+ images, render a bounded preview with a `+N más` overlay on the last cell
   that opens the lightbox / links to `/fotos`, replacing the silent hard caps.
3. Use fixed-ratio cells (`aspect-ratio` + `object-fit: cover`) instead of masonry, and
   request the matching crop from Cloudinary (`c_fill` + the cell's aspect ratio) for
   optimal quality/weight and zero CLS.
4. Add per-cell responsive images (`srcset` / `sizes`) so small cells request lighter
   variants, via new size-keyed Cloudinary presets in `@repo/media`.
5. Unify the `/fotos` all-photos sub-page under the same fixed-ratio dynamic-grid cell
   system (it stays the full "see all" destination — showing all photos — but with the
   new cells, not the divergent masonry).
6. Delete the dead `HeroGallery.astro` and clean up its dangling JSDoc references.

### Non-goals (explicitly out of scope)

1. **Masonry / proportion-respecting layout is OUT.** It was explicitly rejected: it
   needs intrinsic `width`/`height` (which the schema lacks → CLS) and fights the
   count-based control the issue asks for. Deferred to future work IF `width`/`height`
   are later added to the schema (see §8).
2. **No schema changes.** Fixed-ratio cells + Cloudinary `c_fill` need no `width`/
   `height` on the image schema (see §10 D-2).
3. **No `apps/admin` changes.** This spec touches `apps/web` and `@repo/media` only.
4. **No change to the lightbox interaction model.** Focus-trap, Esc, arrow-key nav,
   prev/next, thumbnail strip, and the aria-live counter stay exactly as-is — only what
   *feeds* the lightbox changes.
5. **No video grid redesign.** Video items in `/fotos` keep their current handling
   (YouTube thumbnail + play overlay + GLightbox). They are only touched if trivially
   affected by sharing the new cell wrapper.
6. No new gallery features (zoom, captions overlay redesign, slideshow autoplay, etc.).

## 4. Functional requirements & acceptance criteria

### FR-1 — Count-aware layout for the `detail` variant (BETA-53)

`DetailVariant` composes a balanced, gap-free grid at each image count. The fixed
`thumbs.slice(0, 3)` cap and the always-3-rows `.thumbGrid` are REPLACED by explicit
count-aware layout rules plus a `+N más` overlay at 5+. The layout matrix is locked in
§5.

```
Given the detail variant receives exactly 1 image
  When the gallery renders
  Then a single full-width featured cell is shown with no empty thumbnail column
  And no thumbnail grid and no "+N más" overlay are rendered

Given the detail variant receives exactly 2 images
  When the gallery renders
  Then two cells are shown side by side (no stretched/empty third row)

Given the detail variant receives exactly 3 images
  When the gallery renders
  Then one featured cell plus two thumbnails are shown filling the column with no gap

Given the detail variant receives exactly 4 images
  When the gallery renders
  Then one featured cell plus three thumbnails are shown filling the column with no gap

Given the detail variant receives 5 or more images
  When the gallery renders
  Then a bounded set of cells (per the §5 matrix) is shown
  And the last visible cell carries a "+N más" overlay where N = total − visibleCount
  And every image beyond the visible set is reachable only via that overlay (lightbox or /fotos), never silently dropped

Given the "+N más" overlay cell
  When the user clicks it or activates it via keyboard (Enter/Space)
  Then the lightbox opens at the first hidden image (or navigates to /fotos per D-7)
  And the overlay control has an aria-label announcing the remaining count
```

### FR-2 — Count-aware layout for the `cover-plus-grid` variant (BETA-53)

`CoverPlusGridVariant` applies the same count-aware principle to its extras row. The
fixed `rest.slice(0, 6)` cap and the always-`repeat(3,1fr)` `.inlineGrid` are REPLACED
by count-aware column rules plus the `+N más` overlay at 5+ total. Matrix in §5.

```
Given the cover-plus-grid variant receives exactly 1 image
  When the gallery renders
  Then only the 16:9 cover cell is shown with no empty extras grid

Given the cover-plus-grid variant receives 2, 3, or 4 images
  When the gallery renders
  Then the cover cell plus 1/2/3 extras render in a column track matching the extras count (no lone cell in a 3-column track)

Given the cover-plus-grid variant receives 5 or more images
  When the gallery renders
  Then a bounded extras set is shown and the last extras cell carries the "+N más" overlay
  And the overlay behaves identically to FR-1 (keyboard-accessible, aria-labelled, opens lightbox / links to /fotos)
```

### FR-3 — Fixed-ratio cells via `object-fit: cover` + Cloudinary `c_fill` crop (BETA-53)

Every grid cell has a fixed `aspect-ratio` (per cell role, §5). Images fill via
`object-fit: cover` with a tunable `object-position` (default `center`). The cell
requests the crop from Cloudinary with `c_fill` + the cell's aspect ratio.

```
Given any grid cell with a fixed aspect-ratio
  When its image loads
  Then the image fills the cell via object-fit: cover, centered, with no letterboxing and no distortion

Given a cell's image is requested from Cloudinary
  When the URL is built
  Then it uses c_fill with the cell's aspect ratio so the CDN returns an already-cropped asset (not a full image cropped client-side)

Given the page lays out before any gallery image has loaded
  When measuring layout shift
  Then the gallery contributes zero CLS because every cell reserves its space via aspect-ratio
```

### FR-4 — Per-cell responsive images via new `@repo/media` size presets (BETA-53)

Add Cloudinary size presets keyed by cell role/size (e.g. `galleryFeatured`,
`galleryHalf`, `galleryQuarter`, `galleryThumb`) to `packages/media/src/presets.ts`.
Each gallery `<img>` gets a `srcset` (≥2 width candidates from the cell's preset family)
and a `sizes` attribute matching the cell's rendered width per breakpoint, so small
cells request lighter images.

```
Given a gallery cell renders at a small size (e.g. a quarter thumbnail)
  When its <img> is built
  Then it carries a srcset with at least two width candidates from the cell's preset family
  And a sizes attribute matching the cell's rendered width per breakpoint
  And the browser selects a lighter variant than the full 800px gallery image

Given the featured cell (the LCP candidate)
  When its <img>/srcset is built
  Then it keeps loading="eager" + fetchPriority="high"
  And its srcset does not cause the browser to pick a heavier candidate than the previous single 800px URL at the same viewport (no LCP regression)

Given a new gallery size preset is requested via getMediaUrl
  When getMediaUrl applies it to a Cloudinary URL
  Then the resulting transform contains c_fill + the preset's ar_/w_ tokens and passes the existing preset allowlist tests
```

### FR-5 — Unify the `/fotos` sub-page under the fixed-ratio dynamic-grid cells (BETA-53)

Replace the `columns:3` masonry in `fotos.astro` with the same fixed-ratio cell system
(shared CSS-module class names / rules from §6). `/fotos` remains the full "see all"
destination — it shows **all** photos (and videos), but each item renders in a
fixed-ratio cell with `object-fit: cover` and a Cloudinary `c_fill` crop, matching the
inline gallery's visual language.

```
Given the /fotos sub-page for an accommodation with N images
  When it renders
  Then it shows ALL N images (plus any videos) — no bounded cap, no "+N más" overlay (it is itself the destination)
  And each item renders in a fixed-ratio cell (object-fit cover, c_fill crop), not a columns-based masonry

Given the /fotos sub-page at narrow / mid / wide viewports
  When it renders
  Then the cell grid reflows per explicit breakpoints (no empty gaps, no broken last row)

Given a video item on /fotos
  When it renders in the new cell
  Then its thumbnail + play overlay + GLightbox link continue to work (no regression)
```

### FR-6 — Delete `HeroGallery.astro` + clean up JSDoc references

Delete `apps/web/src/components/accommodation/HeroGallery.astro` (imported nowhere) and
remove the now-dangling `HeroGallery` references in the JSDoc comments of `lib/media.ts`
(~lines 105, 275), `lib/api/transforms.ts` (~line 636), and `data/types.ts` (~line 576).

```
Given the HeroGallery.astro component is deleted
  When the web app builds and typechecks
  Then there is no broken import and no reference to HeroGallery remains in source (including JSDoc)

Given the deletion
  When the accommodation detail page and /fotos sub-page are rendered
  Then both still render correctly (HeroGallery was never wired into them)
```

### FR-7 — Responsive behavior with explicit breakpoints per image count (BETA-53)

Each image count has defined behavior at the documented breakpoints (mobile / tablet /
desktop). The single `640px` breakpoint is extended as needed (locked breakpoints in
§5). At the narrowest viewport the gallery collapses gracefully without horizontal
overflow or empty cells.

```
Given any supported image count
  When the viewport is at mobile / tablet / desktop widths
  Then the grid uses the §5 matrix's layout for that count + breakpoint with no horizontal overflow and no empty cell

Given a narrow (mobile) viewport
  When the detail variant has 5+ images
  Then the bounded preview reflows to the mobile composition and the "+N más" overlay remains on the last visible cell
```

### FR-8 — Accessibility & i18n of new strings (BETA-53)

New user-facing strings (`+N más`, "ver todas las fotos") are i18n keys in `es`/`en`/`pt`.
The `+N` overlay and any new triggers are keyboard-accessible with aria labels;
all-cell alt text falls back to the entity name when an image has no caption/alt.

```
Given the "+N más" overlay
  When a screen reader encounters it
  Then it is announced with an aria-label that includes the remaining count and is reachable + activatable by keyboard

Given the new strings
  When the page is rendered in es, en, or pt
  Then the "+N más" / "ver todas" text is sourced from @repo/i18n in the active locale (no hardcoded literals)

Given a gallery image with no caption/alt
  When its cell renders
  Then its alt attribute falls back to the entity name (never empty for content images)
```

## 5. Layout matrix (locked)

Cell roles and their suggested aspect ratios:

| Cell role | Suggested aspect-ratio | Typical Cloudinary preset family |
|-----------|------------------------|----------------------------------|
| `featured` (detail) / `cover` (cover-plus-grid) | `16 / 10` (detail) · `16 / 9` (cover) | `galleryFeatured` |
| `half` (a cell that spans half the row) | `4 / 3` | `galleryHalf` |
| `quarter` (a small thumbnail in a 2×2 / column) | `1 / 1` | `galleryQuarter` |
| `thumb` (lightbox strip / fallback) | `1 / 1` | `galleryThumb` |

### `detail` variant — count → composition

| Count | Desktop layout | Cells | `+N` overlay on |
|-------|----------------|-------|-----------------|
| 1 | single full-width featured | `featured` (full width) | — |
| 2 | two equal columns | `featured` (`half`) + `half` | — |
| 3 | `2fr` featured + 1 column of 2 thumbs (`repeat(2,1fr)`) | `featured` + 2× `quarter` | — |
| 4 | `2fr` featured + 1 column of 3 thumbs (`repeat(3,1fr)`) | `featured` + 3× `quarter` | — |
| 5+ | `2fr` featured + 1 column of 3 thumbs | `featured` + 3× `quarter`; **last quarter** = overlay | last `quarter` (N = total − 4) |

> The 5+ row reuses the 4-image composition (featured + 3 quarters) but turns the last
> quarter into the `+N más` overlay cell. This keeps a single tested grid shape for the
> dense case and matches today's `slice(0,3)` thumb budget (now bounded *with* an
> affordance instead of a silent drop).

### `cover-plus-grid` variant — count → composition

| Count | Extras layout | Extras cells | `+N` overlay on |
|-------|---------------|--------------|-----------------|
| 1 | none | cover only | — |
| 2 | 1 extra full-width-of-extras | `cover` + 1× `half` | — |
| 3 | `repeat(2,1fr)` | `cover` + 2× `half` | — |
| 4 | `repeat(3,1fr)` | `cover` + 3× `quarter` | — |
| 5+ | `repeat(3,1fr)` | `cover` + 3× `quarter`; **last quarter** = overlay | last `quarter` (N = total − 4) |

### `/fotos` sub-page — all photos, fixed-ratio cells

| Viewport | Columns | Cell ratio |
|----------|---------|------------|
| desktop (≥1024px) | 3 | `4 / 3` (`half` role) |
| tablet (640–1023px) | 2 | `4 / 3` |
| mobile (<640px) | 1 | `4 / 3` |

> `/fotos` shows ALL items — no bound, no overlay. It is the overlay's destination.

### Breakpoints (locked)

- Mobile: `max-width: 640px` (existing breakpoint — extend, do not add a second below it).
- Tablet: `641px–1023px`.
- Desktop: `≥1024px`.

> At mobile width the `detail` 5+ composition collapses to a single column of the
> featured cell + a horizontal/2-up thumb row (mirroring today's mobile `.thumbGrid`
> behavior) with the `+N más` overlay on the last visible thumb.

## 6. Suggested CSS-module class names

New / changed classes in `ImageGallery.module.css` (and shared by `fotos.astro` via a
small colocated module or shared rules). Junior-implementable naming:

| Class | Purpose |
|-------|---------|
| `.grid` | generic count-aware grid container (data-attribute `data-count` drives the template) |
| `.gridCount1` … `.gridCount4` `.gridCount5plus` | per-count `grid-template` rules (or `[data-count="N"]` selectors) |
| `.cellFeatured` | featured/cover cell wrapper (`aspect-ratio` per §5, `grid-row`/`grid-column` span) |
| `.cellHalf` | half-width cell (`aspect-ratio: 4/3`) |
| `.cellQuarter` | small thumbnail cell (`aspect-ratio: 1/1`) |
| `.cellImg` | the `<img>` inside any cell (`width/height:100%`, `object-fit:cover`, `object-position:center`) |
| `.moreOverlay` | the `+N más` overlay layer on the last cell (semi-transparent scrim + centered count) |
| `.moreOverlayBtn` | keyboard-accessible button/link carrying the overlay aria-label |
| `.fotosGrid` | `/fotos` fixed-ratio grid (replaces `.fotos__masonry`) |
| `.fotosCell` | `/fotos` cell wrapper (`aspect-ratio: 4/3`) |

Existing `.thumbGrid` `grid-template-rows: repeat(3,1fr)` is removed/superseded by the
count-aware rules. `.mosaic` / `.mosaicWithThumbs` are folded into `.grid` + count
selectors. Lightbox classes (`.lightbox*`) are untouched.

## 7. Suggested `@repo/media` presets

New entries in `packages/media/src/presets.ts` (each ends in `q_auto,f_auto,dpr_auto`
per the existing convention, uses `c_fill` + `g_auto`, and includes an `ar_` token so
the crop matches the cell ratio):

| Preset | Suggested transform | Used by |
|--------|---------------------|---------|
| `galleryFeatured` | `w_1000,ar_16:10,c_fill,g_auto,q_auto,f_auto,dpr_auto` | featured/cover cell |
| `galleryHalf` | `w_640,ar_4:3,c_fill,g_auto,q_auto,f_auto,dpr_auto` | half cells, `/fotos` cells |
| `galleryQuarter` | `w_400,ar_1:1,c_fill,g_auto,q_auto,f_auto,dpr_auto` | quarter thumbnails |
| `galleryThumb` | `w_120,ar_1:1,c_fill,g_auto,q_auto,f_auto,dpr_auto` | lightbox strip (optional) |

`srcset` width candidates per cell are produced via `getMediaUrl(url, { preset, width })`
(the existing `width` override replaces the preset `w_` token) — e.g. featured at
`{ 640, 1000, 1400 }`, half at `{ 400, 640, 900 }`, quarter at `{ 200, 400, 600 }`.

> Note: `ar_` is already in `getMediaUrl`'s `ALLOWED_RAW_TOKEN_PREFIXES`, and `c_fill`
> is the same crop mode the `card`/`hero` presets already use — these presets fit the
> existing safe-token model with no helper change required (only new preset keys + the
> preset-count test updated from 7 to 11).

## 8. Phased implementation plan

Ordered so the low-risk, single-variant change lands first and the broadest-blast-radius
change (the shared srcset + `/fotos`) lands after the layout is proven. Each phase is a
natural pause point.

### Phase 1 — `detail` variant count-aware layout + CSS

1. Replace `DetailVariant`'s `slice(0,3)` + binary `mosaicWithThumbs` with count-aware
   composition (1/2/3/4/5+) and the `+N más` overlay on the last cell at 5+.
1b. Remove the OUTER pre-slice in `apps/web/src/pages/[lang]/alojamientos/[slug].astro`
   (lines ~293-310): the page builds `galleryImages` as `[featured, ...gallery.slice(0, 3)]`
   before passing it to the island, so the island never receives more than 4 images on
   accommodation pages. Pass the full gallery; the island now owns all capping. Without
   this, the 5+ overlay is unreachable on the most important entity. (Events and posts
   already pass the full gallery — no page-level change needed there.)
2. Add the `.grid` / `.cellFeatured` / `.cellHalf` / `.cellQuarter` / `.moreOverlay`
   classes and the per-count rules in `ImageGallery.module.css`.
3. Vitest + testing-library: assert cell count, the overlay presence + label at 5+,
   overlay keyboard activation, no overlay at ≤4.

**Pause point:** the most-used variant adapts to count with the overlay; one variant proven.

### Phase 2 — `cover-plus-grid` variant count-aware layout

4. Apply the same count rules to `CoverPlusGridVariant` (replace `slice(0,6)` +
   fixed `repeat(3,1fr)`); reuse the Phase 1 cell classes.
5. Tests mirroring Phase 1 for this variant (post detail page coverage).

**Pause point:** both island variants are count-aware and gap-free.

### Phase 3 — Fixed-ratio cells + Cloudinary `c_fill` crop

6. Give every cell a fixed `aspect-ratio` + `object-fit: cover` (+ `object-position`
   default `center`), and request the crop from Cloudinary with `c_fill` + the cell's
   ratio (interim: via the existing `card`/`hero` presets or a `raw` `c_fill,ar_…`
   until Phase 4 adds the dedicated presets).
7. CLS test (no layout shift contributed by the gallery); object-position sanity.

**Pause point:** cells are fixed-ratio and crop server-side; CLS eliminated.

### Phase 4 — Per-cell responsive `srcset`/`sizes` presets in `@repo/media`

8. Add the four `gallery*` presets to `packages/media/src/presets.ts`; update the
   preset-count test (7 → 11) and the safe-token test.
9. Wire `srcset` + `sizes` per cell role in the island (and update `extractGalleryItems`
   /`lib/media.ts` only if the cells need the base public-id to build candidates).
10. Tests: preset transforms contain `c_fill`+`ar_`; srcset has ≥2 candidates per cell;
    featured keeps eager/high-priority and does not pick a heavier LCP candidate.

**Pause point:** small cells download lighter images; LCP unregressed.

### Phase 5 — `/fotos` sub-page unification

11. Replace the `columns:3` masonry in `fotos.astro` with the fixed-ratio
    `.fotosGrid`/`.fotosCell` system (all photos + videos, `c_fill`, breakpoints per §5).
    NOTE: the current masonry media queries use `1024px→2` / `768px→1`; the locked §5
    breakpoints are `≥1024=3` / `640–1023=2` / `<640=1` — replace BOTH media queries,
    not just the `columns` rule (the 768px query must not survive).
12. Verify video thumbnail + play overlay + GLightbox still work; reflow test at the
    three breakpoints.

**Pause point:** `/fotos` matches the inline gallery's visual language.

### Phase 6 — Delete `HeroGallery.astro` + cleanup

13. Delete `apps/web/src/components/accommodation/HeroGallery.astro`.
14. Remove dangling `HeroGallery` JSDoc references in `lib/media.ts`,
    `lib/api/transforms.ts`, `data/types.ts`.
15. Build + typecheck green; grep proves zero `HeroGallery` references remain.

**Pause point:** dead code gone, references clean.

### Phase 7 — Closeout & visual smoke

16. Manual visual validation of the gallery at 1/2/3/4/5+ images on all four entities
    - `/fotos` at the three breakpoints; flip spec + task index to completed.

## 9. Risk and rollback

| Risk | Mitigation |
|------|------------|
| **Visual regression across 4 entities** sharing the island (Phase 1–4) | Changes are additive count branches; per-count + per-variant tests; manual smoke of accommodation/event (detail) + post (cover-plus-grid) + destination before merge; rollback = revert the phase commit |
| **LCP regression from srcset** (Phase 4) | Featured cell keeps `loading=eager`+`fetchPriority=high`; `sizes` for featured pins the candidate so the browser does not over-fetch; explicit "no heavier than the old 800px URL" acceptance test |
| **Crop hides important subject matter** (`c_fill`, Phase 3) | Use `g_auto` (Cloudinary smart gravity, already in card/hero presets) + tunable `object-position`; smoke a few real listings whose subject is off-center |
| **`/fotos` behavior change** (Phase 5) | `/fotos` keeps showing ALL items (no new cap); only the cell rendering changes; video path explicitly regression-tested; rollback = revert Phase 5 commit (the inline gallery is unaffected) |
| **Overlay diverts users from `/fotos` or vice versa** | D-7 locks the overlay target (lightbox by default) so behavior is deterministic and testable |

## 10. Design decisions (locked)

1. **Bounded preview + `+N más` is kept** — the inline grid never renders all images on
   the detail page. The existing hard caps (`slice(0,3)` / `slice(0,6)`) are REPLACED by
   count-aware rules + the overlay, not removed.
2. **No schema change.** Fixed-ratio cells + Cloudinary `c_fill` crop need no intrinsic
   `width`/`height` on `ImageSchema`. Masonry (which would need them) is explicitly
   deferred. The `@repo/schemas` media schema is untouched.
3. **Fixed-ratio cells, NOT masonry.** Each cell has a fixed `aspect-ratio` filled by
   `object-fit: cover`; masonry is rejected (CLS without width/height; fights count
   control). Masonry is deferred future work IF width/height are later added.
4. **Cloudinary does the crop** via `c_fill` + the cell's `ar_` ratio (+ `g_auto` smart
   gravity) so the CDN returns an already-cropped, right-sized asset.
5. **Per-cell responsive images** via new size-keyed `gallery*` presets in `@repo/media`;
   each cell `<img>` gets `srcset` + `sizes` keyed by its role/size.
6. **Lightbox interaction model is unchanged** — only the data feeding it and the trigger
   set change.
7. **`+N más` overlay default target = the lightbox** (opens at the first hidden image),
   matching the existing inline-gallery UX. A "ver todas las fotos" link to `/fotos`
   remains available (it already exists as the sub-page) but the overlay click opens the
   lightbox by default; this keeps a single deterministic, testable behavior.
8. **`/fotos` stays the full "see all" destination** — all photos + videos, no bound,
   no overlay — but rendered with the new fixed-ratio cell system (no masonry).
9. **`HeroGallery.astro` is deleted** (dead code) and its JSDoc references cleaned in the
   same change.

## 11. Out-of-scope / future work

- **Masonry / proportion-respecting layout** — deferred; requires `width`/`height` added
  to `ImageSchema` in `@repo/schemas` first.
- **Adding `width`/`height` (and optional `order`) to the image schema** — a separate
  schema + API + admin spec.
- **Video grid redesign** — videos keep current handling; a richer video gallery is a
  future spec.
- **Any `apps/admin` gallery/media-manager changes.**
- Gallery zoom/pan, slideshow autoplay, or caption-overlay redesign.

## 12. Key file pointers

| File | Relevance |
|------|-----------|
| `apps/web/src/components/ImageGallery.client.tsx` | Count-aware `DetailVariant` + `CoverPlusGridVariant`; `+N más` overlay; per-cell srcset |
| `apps/web/src/components/ImageGallery.module.css` | New `.grid`/`.cell*`/`.moreOverlay` classes + per-count rules + breakpoints; remove `.thumbGrid` 3-row rule |
| `apps/web/src/pages/[lang]/alojamientos/[slug]/fotos.astro` | Replace `columns:3` masonry with fixed-ratio `.fotosGrid`/`.fotosCell` |
| `apps/web/src/components/accommodation/HeroGallery.astro` | DELETE (dead) |
| `apps/web/src/lib/media.ts` | Remove `HeroGallery` JSDoc refs (~lines 105, 275); possibly add srcset-candidate helper |
| `apps/web/src/lib/api/transforms.ts` | Remove `HeroGallery` JSDoc ref (~line 636) |
| `apps/web/src/data/types.ts` | Remove `HeroGallery` JSDoc ref (~line 576) |
| `packages/media/src/presets.ts` | Add `galleryFeatured`/`galleryHalf`/`galleryQuarter`/`galleryThumb` presets |
| `packages/media/src/__tests__/presets.test.ts` | Update preset-count (7 → 11) + safe-token assertions |
| `packages/media/src/get-media-url.ts` | No change expected (`ar_`/`c_fill` already allowlisted) — verify only |
| `packages/i18n/...` (web gallery namespace) | New `+N más` / "ver todas" keys in es/en/pt |
| `packages/schemas/src/common/media.schema.ts` | Read-only reference — NOT changed (D-2) |

## 13. Testing strategy

Per the project's Test-Informed Development rules (Vitest + testing-library, AAA,
≥90% coverage):

- **Pure logic — tests first:** the count→composition selection (how many cells, which
  cell gets the overlay, N computation) extracted as a pure helper; the new `@repo/media`
  presets (transform tokens contain `c_fill`+`ar_`, end in `dpr_auto`, pass the safe-token
  allowlist); srcset-candidate generation (≥2 candidates, correct `w_` per candidate).
- **Components — tests alongside:** `ImageGallery` island at 1/2/3/4/5+ for BOTH variants
  (cell count, overlay presence + aria-label + keyboard activation at 5+, no overlay at
  ≤4); featured cell keeps `loading=eager`+`fetchPriority=high`; alt fallback to entity
  name; lightbox still opens from cells and the overlay.
- **`/fotos` integration:** all items render in fixed-ratio cells; video item keeps
  thumbnail+play+GLightbox; reflow at the three breakpoints.
- **Visual validation at 1/2/3/4/5+ (the issue's explicit ask):** the project has a
  **no-committed-PNG policy** — prefer DOM/computed-style assertions (e.g. assert the
  grid template / cell count / aspect-ratio per count) and/or Playwright + canvas
  comparison over committing screenshots. Run the visual check for both variants and
  `/fotos` at mobile/tablet/desktop in the closeout smoke (Phase 7).
- **CLS:** assert the gallery contributes zero layout shift (fixed aspect-ratio cells).
- **Regression:** any bug found during the work gets a reproducing test before the fix.
- **Manual web smoke (Phase 7):** accommodation/event/destination (detail) + post
  (cover-plus-grid) + `/fotos`, at 1/2/3/4/5+ images, all three locales for the new strings.

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-06-05 | spec-realign | D-1: Phase 1 step 1b added — remove outer gallery pre-slice in `alojamientos/[slug].astro` (island never received >4 images; 5+ overlay unreachable on accommodations). D-10: Phase 5 note — replace BOTH masonry media queries (current 1024/768px vs locked 1024/640px). Verified vs staging 2026-06-05: zero drift elsewhere; HeroGallery confirmed dead (4 JSDoc refs only); SPEC-191 `/colaborar/fotos` does not overlap. | Spec amended, status draft → in-progress |
