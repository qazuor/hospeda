# Variant Token Derivation — SPEC-176 T-003

## Scan Command Used

All patterns were extracted by scanning `apps/web/src/` for `oklch(from` occurrences:

```bash
# Total line count
grep -rn "oklch(from" apps/web/src/ | wc -l
# → 676 lines

# Alpha-only canonical pairs (simple base token, no fallback value)
grep -rh "oklch(from" apps/web/src/ | \
  grep -oE "oklch\(from var\(--([a-z][a-z0-9-]*)\) l c h / ([0-9]+\.?[0-9]*)\)" | \
  sed "..." | python3 -c "..." # canonicalize and count

# Lightness-multiply pairs
grep -rh "oklch(from" apps/web/src/ | \
  grep -oE "oklch\(from var\(--([a-z][a-z0-9-]*)\) calc\(l \* ([0-9]+\.?[0-9]*)\) c h\)"

# Lightness-subtract pairs
grep -rh "oklch(from" apps/web/src/ | \
  grep -oE "oklch\(from var\(--([a-z][a-z0-9-]*)\) calc\(l - ([0-9]+\.?[0-9]*)\) c h\)"

# Lightness-add pairs
grep -rh "oklch(from" apps/web/src/ | \
  grep -oE "oklch\(from var\(--([a-z][a-z0-9-]*)\) calc\(l \+ ([0-9]+\.?[0-9]*)\) c h\)"
```

## Real Unique-Pair Count

**138 canonical entries** (NOT the spec-estimated ~42).

The spec.md §3 estimated "~27 alpha + ~15 lightness = 42 total" based on an earlier
partial census. The full scan of the actual source reveals significantly more unique
combinations:

| Family             | Canonical pairs | Replaces strings |
|--------------------|-----------------|------------------|
| `alpha`            | 116             | 119 (3 with variants) |
| `lightness-multiply` | 10            | 10 |
| `lightness-subtract` | 10            | 10 |
| `lightness-add`    | 2               | 2 |
| **TOTAL**          | **138**         | **141** |

The spec undercount was due to:
1. Only counting the most-frequent base tokens (brand-primary, brand-accent). The full
   source uses 19 distinct base tokens with alpha variants.
2. Counting only a subset of alpha values (e.g. 0.05/0.10/0.15/0.20/0.25/0.30). The
   actual CSS has 116 unique (base, alpha) pairs across values from 0.03 to 1.0.
3. Missing the `lightness-add` family entirely (2 gradient-stop usages of `calc(l + N)`).

## Per-Family Breakdown

### Alpha family (116 canonical pairs, 119 replaces strings)

Base tokens used:
- `accent-foreground`: 1 alpha value (0.35)
- `border`: 6 values (0.30, 0.35, 0.40, 0.50, 0.60, 0.80)
- `brand-accent`: 29 values (0.04–0.85)
- `brand-primary`: 23 values (0.03–0.45)
- `core-background`: 1 value (0.40)
- `core-card`: 9 values (0.55–1.0)
- `core-foreground`: 19 values (0.04–0.92)
- `core-muted-foreground`: 12 values (0.08–0.85)
- `destructive`: 7 values (0.08–0.80)
- `footer-fg`: 3 values (0.08, 0.12, 0.50)
- `hospeda-sky`: 1 value (0.15)
- `info`: 1 value (0.08)
- `primary-foreground`: 4 values (0.30, 0.75, 0.80, 0.85)
- `ring`: 1 value (0.50)
- `success`: 1 value (0.12)
- `surface-dark`: 1 value (0.40)
- `surface-dark-foreground`: 1 value (0.75)
- `warning`: 2 values (0.10, 0.12)

### Lightness-multiply family (10 pairs)

| Token name | Base | Factor |
|------------|------|--------|
| `brand-accent-l82` | brand-accent | 0.82 |
| `brand-accent-l90` | brand-accent | 0.90 |
| `brand-accent-l112` | brand-accent | 1.12 |
| `brand-primary-l80` | brand-primary | 0.80 |
| `brand-primary-l85` | brand-primary | 0.85 |
| `brand-primary-l90` | brand-primary | 0.90 |
| `brand-primary-l115` | brand-primary | 1.15 |
| `core-card-l97` | core-card | 0.97 |
| `core-foreground-l115` | core-foreground | 1.15 |
| `destructive-l85` | destructive | 0.85 |

### Lightness-subtract family (10 pairs)

| Token name | Base | Offset |
|------------|------|--------|
| `border-lm05` | border | 0.05 |
| `brand-accent-lm04` | brand-accent | 0.04 |
| `brand-accent-lm05` | brand-accent | 0.05 |
| `brand-accent-lm06` | brand-accent | 0.06 |
| `brand-accent-lm15` | brand-accent | 0.15 |
| `brand-primary-lm05` | brand-primary | 0.05 |
| `brand-primary-lm06` | brand-primary | 0.06 |
| `brand-primary-lm12` | brand-primary | 0.12 |
| `core-card-lm03` | core-card | 0.03 |
| `destructive-lm04` | destructive | 0.04 |

### Lightness-add family (2 pairs)

**This family was NOT in the spec estimate.** Found in gradient stop usages only:

| Token name | Base | Offset | Context |
|------------|------|--------|---------|
| `brand-primary-lp10` | brand-primary | 0.10 | gradient stop |
| `surface-dark-lp05` | surface-dark | 0.05 | gradient stop |

Naming convention (D6): `{base}-lp{NN}` where NN = round(offset * 100), zero-padded.

## Literal-Spelling Variants Found

Three canonical (base, family, param) tuples appear with multiple literal spellings
in the CSS source. The T-005 codemod must replace ALL spellings with the same
`var(--token)` reference.

| Token name | Canonical `replaces` | Variant spelling |
|------------|---------------------|-----------------|
| `brand-accent-a30` | `oklch(from var(--brand-accent) l c h / 0.3)` | `oklch(from var(--brand-accent) l c h / 0.30)` |
| `brand-primary-a30` | `oklch(from var(--brand-primary) l c h / 0.3)` | `oklch(from var(--brand-primary) l c h / 0.30)` |
| `core-muted-foreground-a20` | `oklch(from var(--core-muted-foreground) l c h / 0.2)` | `oklch(from var(--core-muted-foreground) l c h / 0.20)` |

The canonical `replaces` field in `VARIANT_TOKEN_MAP` holds the shorter form.
The variant spellings are in `replacesVariants: string[]`.

**T-005 codemod instruction:** For each entry, replace BOTH `entry.replaces` AND
each string in `entry.replacesVariants ?? []` with `var(--${entry.name})`.

## Patterns NOT Included in VARIANT_TOKEN_MAP

The following patterns were found in the scan but are intentionally excluded:

1. **Patterns with fallback values in `var()`** — e.g.
   `oklch(from var(--destructive, #e74c3c) l c h / 0.25)`. These have a CSS
   fallback hardcoded into the `var()` call and are less common. T-005 will
   report them as unmatched cases; they must be resolved manually or by adding
   entries if the base token is in the theme. (28 occurrences found.)

2. **Patterns with `oklch()` fallback in `var()`** — e.g.
   `oklch(from var(--destructive, oklch(0.6 0.2 25)) l c h / 0.15)`. Same issue
   as above but with an oklch color as fallback. (Multiple occurrences found.)

3. **Dynamic template literal patterns** — `oklch(from var(--${cssToken}) l c h / ${bgOpacity})`
   in `apps/web/src/lib/colors.ts`. These are runtime JS-computed and cannot be
   statically tokenized. T-006 handles the `@repo/icons` equivalent; the
   `colors.ts` helpers may need a separate token-lookup helper.

4. **Fully-transparent alpha=0 pattern** — `oklch(from var(--core-foreground) l c h / 0)`.
   A transparent color has no meaningful sRGB fallback; excluded intentionally.
   (2 occurrences in DestinationCard gradient stops.)

5. **`oklch(from white ...)` pattern** — `oklch(from white l c h / 0.75)` in
   components.css. This uses a literal color (not a var()) as the origin, so it
   cannot be tokenized. (1 occurrence.)

6. **Gradient-stop trailing syntax** — Many patterns extracted had trailing gradient
   syntax appended (`l c h / 0.08) 60%,`). These were filtered out by requiring
   the regex to match the complete `oklch(...)` balanced parenthesis. The actual
   CSS color value is always the first complete match.

## Note on `core-card-a100` (alpha=1.0)

The pattern `oklch(from var(--core-card) l c h / 1)` (alpha=1, integer not decimal)
appears in the source. The D6 name is `core-card-a100`. The `replaces` string is
`'oklch(from var(--core-card) l c h / 1)'` (not `0.1` — the CSS source uses `1`,
not `1.0`). T-004 should emit the sRGB fallback without an alpha suffix since
alpha=1 means fully opaque (equivalent to `rgb(R G B)` without alpha).

## Alpha consolidation (conservative ≤0.025 grid)

Applied in T-003 phase 2. Reduces 116 faithful alpha tokens to 92.

### Grid

14 canonical steps: **0.05, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.75, 0.90**

Snap rule: snap only if `|raw_value − nearest_step| ≤ 0.025`. Values farther than 0.025
from every grid step keep their own token at their real value.

### Full mapping table (real value → token, delta)

| Raw value | Snaps to | Token name (example base: brand-accent) | Delta |
|-----------|----------|----------------------------------------|-------|
| 0.03 | 0.05 | `brand-primary-a05` | 0.020 |
| 0.04 | 0.05 | `brand-accent-a05` / `brand-primary-a05` | 0.010 |
| 0.05 | 0.05 | `*-a05` (exact) | 0.000 |
| 0.06 | 0.05 | `brand-accent-a05` / `brand-primary-a05` | 0.010 |
| 0.07 | 0.08 | `brand-accent-a08` / `core-foreground-a08` | 0.010 |
| 0.08 | 0.08 | `*-a08` (exact) | 0.000 |
| 0.10 | 0.10 | `*-a10` (exact) | 0.000 |
| 0.12 | 0.12 | `*-a12` (exact) | 0.000 |
| 0.14 | 0.15 | `brand-accent-a15` / `brand-primary-a15` | 0.010 |
| 0.15 | 0.15 | `*-a15` (exact) | 0.000 |
| 0.16 | 0.15 | `brand-accent-a15` / `brand-primary-a15` | 0.010 |
| 0.18 | 0.20 | `brand-accent-a20` / `brand-primary-a20` / `core-foreground-a20` | 0.020 |
| 0.20 | 0.20 | `*-a20` (exact) | 0.000 |
| 0.22 | 0.20 | `brand-accent-a20` / `brand-primary-a20` | 0.020 |
| 0.25 | 0.25 | `*-a25` (exact) | 0.000 |
| 0.26 | 0.25 | `brand-primary-a25` | 0.010 |
| 0.28 | 0.30 | `brand-accent-a30` / `brand-primary-a30` | 0.020 |
| 0.30 | 0.30 | `*-a30` (exact) | 0.000 |
| 0.32 | 0.30 | `brand-accent-a30` / `brand-primary-a30` | 0.020 |
| 0.35 | 0.35 | `*-a35` (exact) | 0.000 |
| 0.40 | 0.40 | `*-a40` (exact) | 0.000 |
| 0.42 | 0.40 | `brand-accent-a40` | 0.020 |
| 0.45 | — kept-own | `*-a45` | n/a |
| 0.50 | 0.50 | `*-a50` (exact) | 0.000 |
| 0.55 | — kept-own | `*-a55` | n/a |
| 0.60 | 0.60 | `*-a60` (exact) | 0.000 |
| 0.70 | — kept-own | `*-a70` | n/a |
| 0.72 | — kept-own | `core-foreground-a72` | n/a |
| 0.75 | 0.75 | `*-a75` (exact) | 0.000 |
| 0.80 | — kept-own | `*-a80` | n/a |
| 0.82 | — kept-own | `core-foreground-a82` | n/a |
| 0.85 | — kept-own | `*-a85` | n/a |
| 0.90 | 0.90 | `*-a90` (exact) | 0.000 |
| 0.92 | 0.90 | `core-card-a90` / `core-foreground-a90` | 0.020 |
| 0.95 | — kept-own | `core-card-a95` | n/a |
| 1.00 | — always own | `core-card-a100` (opaque) | n/a |

### Count before / after

| | Count |
|---|---|
| Faithful (T-003 scan) | 116 |
| After consolidation | 92 |
| Reduction | 24 |
| Merge groups | 15 |
| Values kept-own | 19 |
| Max snap delta | 0.020 |

### Kept-own values (19 — no grid step within 0.025)

Values 0.45, 0.55, 0.70, 0.72, 0.80, 0.82, 0.85, 0.92→a90, 0.95 are either:
- Equidistant between two grid steps (e.g. 0.45 is 0.05 from both 0.40 and 0.50), or
- The nearest step is > 0.025 away (e.g. 0.70 is 0.05 from 0.75).

These values get their own token named after their exact value:
`border-a80`, `brand-accent-a45`, `brand-accent-a55`, `brand-accent-a70`,
`brand-accent-a80`, `brand-accent-a85`, `brand-primary-a45`, `core-card-a55`,
`core-card-a70`, `core-card-a85`, `core-card-a95`, `core-foreground-a45`,
`core-foreground-a55`, `core-foreground-a72`, `core-foreground-a82`,
`core-muted-foreground-a85`, `destructive-a80`, `primary-foreground-a80`,
`primary-foreground-a85`.

Exception: `core-foreground-a90` and `core-card-a90` — the source value 0.92 snaps
to 0.90 (delta=0.02 ≤ 0.025), so the token is named after the canonical step (a90)
but `replaces` holds the actual source literal `/0.92` or `/0.9`.

### Total after consolidation (all families)

| Family | Before | After | Note |
|--------|--------|-------|------|
| alpha | 116 | 92 | conservative grid consolidation |
| lightness-multiply | 10 | 10 | faithful 1:1 |
| lightness-subtract | 10 | 10 | faithful 1:1 |
| lightness-add | 2 | 2 | faithful 1:1 |
| **TOTAL** | **138** | **114** | **24 tokens saved** |
