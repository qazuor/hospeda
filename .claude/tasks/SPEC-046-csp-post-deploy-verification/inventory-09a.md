# GAP-046-09a — Inline `style=` inventory (SPEC-046 T-006)

> **Date**: 2026-05-16
> **Scope**: `apps/web/src/**/*.{astro,tsx}`
> **Method**: `grep -rnE --include='*.astro' --include='*.tsx' 'style=.*<pattern>'` (ripgrep unavailable in this worktree; grep with explicit globs is equivalent for this purpose).
> **Patterns surveyed**: `transition-delay`, `--corner-bg`, `--brand-accent`, `--wave-header-padding-top`, `width:0%`, `opacity:0` — plus a broader sweep for any inline `style=` declaring a CSS custom property (`--xxx`) to catch the additions the spec list did not enumerate.

## Why this exists

Inline `style=` attributes trigger `style-src-attr` CSP violations because nonces apply to `<style>` elements, not to the `style` attribute. The follow-up tasks **T-007 / T-008 / T-009** refactor each bucket into class- or data-attr-based CSS so the inline emission disappears. **This task produces only the inventory — no source edits.**

## Summary

| Bucket | Refactor target | Files | Entries |
|---|---|---|---|
| **stagger** | T-007 — `data-stagger-index` + CSS map | 25 | **35** |
| **css-var** | T-008 — data-attr + finite CSS-var map | 4 | 4 (+ 1 candidate exception, see below) |
| **animation-state** | T-009 — `.is-reveal-initial` class | 1 | 1 |
| **TOTAL (in scope)** | — | **30 distinct files** | **40** |

## Inventory: stagger pattern (T-007)

Pattern: `style={\`transition-delay: ${expr}ms\`}` or `style="transition-delay: Xms"`.

| # | File | Line | Pattern snippet | Notes |
|---|------|------|---|---|
| 1 | `pages/[lang]/alojamientos/tipo/[type]/index.astro` | 94 | `transition-delay: ${Math.min(i, 6) * 100}ms` | Standard 0–600ms stagger (7 indices). |
| 2 | `pages/[lang]/destinos/[slug]/alojamientos/index.astro` | 48 | `transition-delay: ${Math.min(i, 6) * 100}ms` | Same. |
| 3 | `components/billing/PricingCardsGrid.astro` | 135 | `transition-delay: ${i * 100}ms` | No `Math.min` cap — check if it can exceed 6. |
| 4 | `pages/[lang]/publicaciones/etiqueta/[tag]/index.astro` | 103 | `transition-delay: ${Math.min(i, 6) * 100}ms` | Capped. |
| 5 | `components/sections/StatsSection.astro` | 70 | `transition-delay: ${revealDelay({ index: i })}ms` | Uses `revealDelay()` helper (see [`src/lib/reveal-stagger.ts`](../../../apps/web/src/lib/reveal-stagger.ts)). |
| 6 | `pages/[lang]/beneficios/index.astro` | 129 | `transition-delay: ${i * 100}ms` | Two grids in same file (lines 129 and 200). |
| 7 | `pages/[lang]/beneficios/index.astro` | 200 | `transition-delay: ${i * 100}ms` | — |
| 8 | `components/contact/ContactFAQ.astro` | 67 | `transition-delay: ${i * 80}ms` | 80ms step (not 100ms). |
| 9 | `pages/[lang]/suscriptores/propietarios/index.astro` | 191 | `transition-delay: ${i * 100}ms` | — |
| 10 | `pages/[lang]/suscriptores/propietarios/index.astro` | 225 | `transition-delay: ${i * 100}ms` | — |
| 11 | `pages/[lang]/alojamientos/comodidades/[slug]/index.astro` | 52 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 12 | `pages/[lang]/alojamientos/index.astro` | 642 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 13 | `pages/[lang]/alojamientos/caracteristicas/[slug]/index.astro` | 52 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 14 | `pages/[lang]/eventos/categoria/[category]/index.astro` | 53 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 15 | `pages/[lang]/publicar/index.astro` | 118 | `transition-delay: ${i * 100}ms` | — |
| 16 | `pages/[lang]/publicar/index.astro` | 139 | `transition-delay: ${i * 100}ms` | — |
| 17 | `pages/[lang]/publicaciones/index.astro` | 217 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 18 | `pages/[lang]/eventos/index.astro` | 309 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 19 | `pages/[lang]/eventos/en/[slug]/index.astro` | 49 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 20 | `pages/[lang]/nosotros/index.astro` | 174 | `transition-delay: ${i * 100}ms` | — |
| 21 | `pages/[lang]/publicaciones/autor/[slug]/index.astro` | 112 | `transition-delay: ${i * 80}ms` | 80ms step. |
| 22 | `pages/[lang]/publicaciones/categoria/[category]/index.astro` | 55 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 23 | `pages/[lang]/destinos/[slug]/eventos/index.astro` | 52 | `transition-delay: ${Math.min(i, 6) * 100}ms` | — |
| 24 | `pages/[lang]/destinos/[...path].astro` | 437 | `transition-delay: ${i * 100}ms` | Two entries (lines 437, 475). |
| 25 | `pages/[lang]/destinos/[...path].astro` | 475 | `transition-delay: ${i * 100}ms` | — |
| 26 | `pages/[lang]/preguntas-frecuentes/index.astro` | 290 | `transition-delay: ${Math.min(i, 6) * 60}ms` | **60ms step** (not 100ms/80ms). |
| 27 | `components/CategoryTiles.astro` | 61 | `transition-delay: ${Math.min(i, 6) * 80}ms` | 80ms step. |
| 28 | `pages/[lang]/contacto/index.astro` | 238 | `transition-delay: ${i * 100}ms` | — |
| 29 | `pages/[lang]/contacto/index.astro` | 278 | `transition-delay: 100ms` | **Static value** (not interpolated). |
| 30 | `pages/[lang]/contacto/index.astro` | 300 | `transition-delay: 200ms` | **Static value**. |
| 31 | `components/sections/NextEventsSection.astro` | 95 | `transition-delay: ${revealDelay({ index: i + 1 })}ms` | Uses helper. |
| 32 | `components/sections/NextEventsSection.astro` | 105 | `transition-delay: ${revealDelay({ index: i + 3 })}ms` | Uses helper, offset by 3. |
| 33 | `components/sections/FeaturedAccommodationsSection.astro` | 102 | `transition-delay: ${revealDelay({ index: i })}ms` | Uses helper. |
| 34 | `components/sections/LatestArticlesSection.astro` | 97 | `transition-delay: 0ms` | **Static value**. |
| 35 | `components/sections/LatestArticlesSection.astro` | 109 | `transition-delay: ${revealDelay({ index: i + 1 })}ms` | Uses helper. |

**T-007 refactor plan (recap from spec)**: replace each entry with `data-stagger-index={Math.min(i, 6)}` + CSS rules in `global.css` covering indices 0–6. Two complications to handle:

- **Stagger step is not always 100ms**: entries use 60ms, 80ms, and 100ms steps. The CSS map needs to support all three (e.g. via additional data attributes like `data-stagger-step="60|80|100"`), or each consumer picks its own attribute, or we standardise to one step.
- **`revealDelay()` helper** (`apps/web/src/lib/reveal-stagger.ts`) — referenced from 5 entries — must also be updated, and its JSDoc example should reflect the new pattern.

## Inventory: css-var pattern (T-008)

Pattern: `style={\`--xxx: ${value};\`}` — declaring a CSS custom property per-instance.

| # | File | Line | Pattern snippet | Classification | Notes |
|---|------|------|---|---|---|
| 1 | `components/shared/cards/AccommodationCard.astro` | 106 | `\`--corner-bg: ${newColors.bg}; --corner-text: ${newColors.text};\`` | **css-var (finite)** | `newColors` comes from `getAccommodationTypeColor()` in [`lib/colors.ts`](../../../apps/web/src/lib/colors.ts) — finite set of accommodation types. Refactor to `data-acc-type-color={type}` + map. |
| 2 | `components/shared/ui/WaveHeader.astro` | 34 | `\`--wave-header-padding-top: ${paddingTop};\`` | **css-var (configurable)** | `paddingTop` is a prop. Finite set in practice (a handful of breakpoint-style values). Refactor to `data-wave-padding={small|medium|large}` + map. |
| 3 | `components/shared/cards/ArticleCard.astro` | 82 | `\`--card-accent: ${categoryColor.text};\`` | **css-var (finite)** | `categoryColor` from `getPostCategoryColor()` — finite category set. Refactor to `data-article-category={category}` + map. |
| 4 | `components/shared/cards/EventCardFeatured.astro` | 102 | `\`--category-color: ${categoryColor.text};\`` | **css-var (finite)** | `categoryColor` from `getEventCategoryColor()` — finite event-category set. Refactor to `data-event-category={category}` + map. |

### css-var candidate exception (call out)

| File | Line | Pattern snippet | Why not refactor cleanly |
|---|------|---|---|
| `components/shared/cards/EventCardFeatured.astro` | 168 | `style={\`background-color: ${badgeBgSolid}; color: var(--primary-foreground);\`}` | NOT a CSS custom property declaration — it's a per-instance `background-color`. `badgeBgSolid` is derived from `getEventCategoryColor()` which is finite, so this CAN be refactored alongside entry #4 (same enum drives both). Recommend folding it into T-008. |

The spec list mentioned `--brand-accent`; **zero matches were found** for `style=...--brand-accent`. Either the pattern was removed in a prior refactor or it was never present. No action needed for that specific token.

## Inventory: animation-state pattern (T-009)

Pattern: static inline `style="width: 0%; opacity: 0;"` (initial animation state).

| # | File | Line | Pattern snippet | Notes |
|---|------|------|---|---|
| 1 | `components/shared/navigation/NavigationProgress.astro` | 20 | `style="width: 0%; opacity: 0;"` | Top-of-page progress bar initial state. Refactor to `class="is-reveal-initial"` with `.is-reveal-initial { width: 0%; opacity: 0; }` in `global.css`. |

Only one entry. T-009 should be a trivial replacement.

## Other inline `style=` patterns found in the sweep (NOT in scope of GAP-046-09a)

These were surfaced by the broader CSS-var sweep but are NOT part of the documented T-006 patterns. Cataloguing them here so they aren't lost. Whether to refactor is a separate decision (likely follow-up gap or accepted exception):

| File | Line | Pattern | Recommendation |
|---|------|---|---|
| `components/account/UserFavoritesList.client.tsx` | 671 | `style={{ margin: '0 0 var(--space-3, 12px)' }}` | **Trivial refactor candidate**: replace with class or move into the surrounding CSS module. Out of scope for GAP-046-09a (no CSS-var declaration; just an inline value). |
| `components/sections/SearchBar.client.tsx` | 566 | `style={{ cursor: 'default', opacity: 0.5 }}` | **Refactor to `:disabled` / `[aria-disabled]` selector** in the component's CSS module. Not the `opacity: 0` initial-animation pattern T-009 targets — this is a half-opacity disabled state. Out of scope for GAP-046-09a but worth noting as a CSP violation source. |
| `components/shared/cards/EventCardFeatured.astro` | 168 | `style={\`background-color: ${badgeBgSolid}; color: var(--primary-foreground);\`}` | See css-var candidate exception above — recommend folding into T-008. |

## Spot-check (acceptance criterion)

Three entries verified against the actual source code (T-006 subtask):

1. **`components/CategoryTiles.astro:61`** — confirmed: `style={\`transition-delay: ${Math.min(i, 6) * 80}ms\`}` on a `data-reveal="up"` element.
2. **`components/shared/cards/AccommodationCard.astro:106`** — confirmed: `style={\`--corner-bg: ${newColors.bg}; --corner-text: ${newColors.text};\`}` on `.acc-card__status-corner`.
3. **`components/shared/navigation/NavigationProgress.astro:20`** — confirmed: `style="width: 0%; opacity: 0;"` on `<div id="nav-progress" class="nav-progress">`.

## Post-T-006 discoveries (during T-008)

Two patterns were missed by the initial grep filter because they do not literally contain `--xxx` in the inline `style=`:

| File | Line | Pattern (NOT in T-006 inventory) | Why missed |
|---|------|---|---|
| `components/shared/cards/AccommodationCard.astro` | 115 | `style={\`background-color: ${featuredColors.bg}; color: ${featuredColors.text};\`}` (featured badge) | Direct interpolated property values, no `--xxx` literal. Same constant-color pattern as line 106; refactored alongside it in T-008 by baking values into the scoped `.acc-card__featured-badge` rule. |
| `components/shared/cards/EventCardFeatured.astro` | 129 | `style={\`background: linear-gradient(135deg, ${categoryColor.bg}, ${categoryColor.border});\`}` (image fallback gradient) | Same: direct interpolation, no `--xxx`. Same `data.category` enum drives it; folded into the data-event-category refactor in T-008. |
| `components/shared/cards/EventCardFeatured.astro` | 192 | `style={\`background-color: ${categoryColor.text};\`}` (date block bg) | Same: direct interpolation. Folded into the data-event-category refactor in T-008. |

**Lesson for future audits**: an inline `style=` with `${...}` interpolation is a candidate for `style-src-attr` violation regardless of whether the value is a CSS custom property declaration or a direct property. The pattern to grep is `style=.*\$\{` (handles both shapes).

T-008 ended up touching **7 inline style attrs across 4 files** (4 css-var declarations from the original inventory + 3 direct-property attrs surfaced during the refactor), all replaced with either data-attr maps (event/post/wave) or baked-in constants (accommodation badges).

## Hand-off

The follow-up tasks can run in parallel after this inventory lands:

- **T-007** (stagger, 35 entries, complexity 3) — biggest, needs CSS map + helper update + multi-step support.
- **T-008** (css-var, 4 entries + 1 exception candidate, complexity 4) — touches 4 component files + adds a new CSS map module (`css-var-themes.css` or similar).
- **T-009** (animation-state, 1 entry, complexity 2) — trivial.

All three are unblocked once T-006 is committed.
