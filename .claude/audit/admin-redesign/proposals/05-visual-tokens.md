---
proposal: visual-tokens
status: DRAFT (8 ejes locked, implementation pending)
version: 0.1
date-started: 2026-05-22
last-updated: 2026-05-22
related: 01-information-architecture.md (v0.10+), audit phase-1/04-visual-identity.md
scope: design tokens unification between apps/admin and apps/web — shared brand at token level, distinct density at component level
---

# Visual Identity Tokens — admin ↔ web alignment

> **Living document.** Defines the shared design tokens that align admin and web visually while respecting each app's tooling and ergonomics (admin = Tailwind + shadcn for productivity density; web = vanilla CSS / CSS Modules for marketing warmth). All 8 axes locked 2026-05-22.

## How to read this doc

- All architectural decisions are in §3 (the 8 ejes).
- Token system specs in §5 — these are the ACTUAL VALUES the V1 implementation must use.
- Migration plan in §7 — 3 phases with explicit safety guarantees (web is bit-for-bit identical after migration).

---

## 1. Goal

A user moving from `hospeda.com.ar` to the admin panel must feel **"same product, different mode"**, not "switched to a different app". The brand language (colors, fonts) is unified; the working mode (density, interaction patterns) differs.

## 2. Principle [LOCKED]

> **Brand shared at the token level. Density distinct at the component level.**

Concretely:
- **Same brand palette** (river / sky / forest / sand) in both apps.
- **Same fonts** (Roboto for body, Geologica for headings — Caveat NOT in admin).
- **Same numeric scale** for spacing, but admin uses tighter density defaults at the component level.
- **Same radius**.
- **Same dark-mode strategy** (`[data-theme="dark"]`).
- **Same functional semantics** (success/warning/danger/info), defined separately from the brand palette but with harmonized hues.

---

## 3. The 8 axes — locked decisions

| # | Eje | Decision (locked) |
|---|-----|-------------------|
| 1 | Where tokens live | **New package `packages/design-tokens`** — tooling-agnostic, consumed by both apps. NOT extending `packages/tailwind-config` (which is admin-territory). |
| 2 | Format | **TS source + auto-generated CSS** — TS files export typed tokens; build script generates `dist/tokens.css`. Both apps import the CSS at runtime, the TS gives type safety. |
| 3 | Admin primary | **Derived from river (option B)** — same hue (259) as web's river, but different shade. Admin uses `river-600` (more muted, denser). Web continues with `river-500` (canonical, vibrant). |
| 4 | Fonts | **Roboto (body) + Geologica (headings)** — Caveat (web's decorative) is NOT in admin. Admin gets brand personality via Geologica in H1/H2 only. |
| 5 | Radius | **0.75rem** (web's current value). Admin adopts this — minor visual harmonization, no UX impact. |
| 6 | Dark mode strategy | **`[data-theme="dark"]` attribute** (web's current). Admin migrates from `.dark` class. More extensible (allows `[data-theme="hospeda-night"]` future variants). Tailwind v4 supports this via custom variant. |
| 7 | Semantic colors (success/warning/danger/info) | **Separate functional palettes**, harmonized hues with brand. NOT derived from river/sky/forest/sand (those are brand identity; semantic is functional convention). |
| 8 | Component-level density | **No shared components — only tokens**. Admin and web keep their tooling separately (Tailwind+shadcn vs CSS Modules). Each app uses its own component implementations against the shared tokens. |

---

## 4. Architecture

### 4.1 File structure

```
packages/design-tokens/
├── src/
│   ├── tokens/
│   │   ├── colors.ts            # palette (brand + semantic + neutral)
│   │   ├── typography.ts        # families, sizes, weights, line-heights
│   │   ├── spacing.ts           # 0-12 scale
│   │   ├── radius.ts            # radius scale
│   │   ├── shadows.ts           # elevation scale
│   │   └── motion.ts            # durations + easings
│   ├── themes/
│   │   ├── web-light.ts         # semantic mapping for web (light)
│   │   ├── web-dark.ts          # semantic mapping for web (dark)
│   │   ├── admin-light.ts       # semantic mapping for admin (light)
│   │   └── admin-dark.ts        # semantic mapping for admin (dark)
│   ├── build/
│   │   ├── generate-css.ts      # TS tokens → dist/tokens.css
│   │   └── validate.ts          # round-trip check: web's current values match palette
│   └── index.ts                 # exports TS types + token objects
├── dist/
│   └── tokens.css               # auto-generated, both apps consume
├── package.json
└── README.md
```

### 4.2 How each app consumes

**Web** (`apps/web/src/styles/global.css`):
```css
@import '@repo/design-tokens/tokens.css';
/* web-specific overrides + utility classes */
```

The `tokens.css` file declares:
```css
:root {
  /* palette (always available regardless of theme) */
  --palette-river-500: oklch(0.63 0.19 259);
  /* ... */

  /* web light theme — the default for web */
  --color-primary: var(--palette-river-500);
  /* ... */
}

[data-theme="dark"] {
  --color-primary: var(--palette-river-400);
  /* ... */
}

/* admin theme — applied only on admin via class or attribute */
[data-app="admin"] {
  --color-primary: var(--palette-river-600);
  /* ... */
}

[data-app="admin"][data-theme="dark"] {
  --color-primary: var(--palette-river-500);
  /* ... */
}
```

**Admin** (`apps/admin/src/styles.css` + `tailwind.config.ts`):
- Imports the same `tokens.css`.
- Tailwind theme uses `var(--color-primary)` etc. for utility class generation.
- Admin's root layout sets `data-app="admin"` on `<html>` so the admin theme tokens apply.

This is the standard pattern: **one CSS file, many themes via attributes**.

### 4.3 Build pipeline

- `packages/design-tokens` builds in Turborepo before any consumer (admin, web).
- The build runs `generate-css.ts` which:
  1. Reads the TS token files.
  2. Generates `dist/tokens.css` with all palette + theme mappings.
  3. Validates that web's current values from the original `global.css` round-trip identically (any drift = build fails).

---

## 5. Token system specifications

### 5.1 Palette — 10 shades per color

Each color has 10 shades (50-900). The **canonical value** (500) is web's current value; other shades derived programmatically (lightness + chroma adjustments preserving hue).

**Brand colors** (anchored to web's current values per Eje 3 safety):

| Palette | 500 (canonical) | Hue locked | Notes |
|---------|----------------|------------|-------|
| `river` | `oklch(0.63 0.19 259)` | 259 (blue) | Web `--brand-primary` + `--hospeda-river`. Web uses 500 as primary; admin uses **600** (derived) per Eje 3. |
| `sky` | `oklch(0.80 0.08 259)` | 259 (same hue as river) | Web `--hospeda-sky`. Light/airy. Used for backgrounds, hover surfaces. |
| `forest` | `oklch(0.50 0.14 155)` | 155 (green) | Web `--hospeda-forest`. Used for gastronomy/nature contexts. |
| `sand` | `oklch(0.70 0.12 75)` | 75 (yellow-gold) | Web `--hospeda-sand`. Used for crafts/warmth contexts. |
| `accent` | `oklch(0.70 0.18 55)` | 55 (orange-honey) | Web `--brand-accent`. Used for highlights, CTAs secondary. |

**Semantic functional** (separate from brand per Eje 7, harmonized hues):

| Palette | 500 (canonical) | Hue | Use |
|---------|----------------|-----|-----|
| `success` | `oklch(0.62 0.15 150)` | 150 (green, slightly different from forest to avoid brand confusion) | Confirmations, positive states |
| `warning` | `oklch(0.74 0.15 78)` | 78 (amber, close to sand) | Warnings, attention needed |
| `danger` | `oklch(0.58 0.22 25)` | 25 (red-orange, NOT pure red) | Destructive actions, errors |
| `info` | `oklch(0.66 0.14 240)` | 240 (blue-cyan, distinct from river to avoid brand confusion) | Informational, neutral notices |

**Neutral grays** (10 shades, shared base for both apps):

| Shade | Light theme | Dark theme |
|-------|-------------|------------|
| `neutral-50` | `oklch(0.985 0 0)` | (used as `--bg-elevated` in dark) |
| `neutral-100` | `oklch(0.95 0 0)` | |
| `neutral-200` | `oklch(0.90 0 0)` | |
| `neutral-300` | `oklch(0.83 0 0)` | |
| `neutral-400` | `oklch(0.70 0 0)` | |
| `neutral-500` | `oklch(0.55 0 0)` | |
| `neutral-600` | `oklch(0.42 0 0)` | |
| `neutral-700` | `oklch(0.30 0 0)` | (used as `--bg-elevated` in dark) |
| `neutral-800` | `oklch(0.18 0 0)` | (used as `--bg-app` in dark) |
| `neutral-900` | `oklch(0.10 0 0)` | (used as `--bg-base` in dark) |

**Shade derivation algorithm** (for non-canonical shades when generating):

- Lightness moves linearly from `0.99` (50) to `0.10` (900), passing through canonical at 500.
- Chroma scales: full at 500, ~50% at 50/900 (more grey at extremes for visual harmony).
- Hue: locked per palette.

This is implemented in `generate-css.ts`. Exact 10-shade values per palette are derived at build time; this doc specifies the canonical (500) only.

### 5.2 Typography

```ts
export const typography = {
  fontFamily: {
    sans: 'Roboto, system-ui, sans-serif',         // body, UI
    heading: 'Geologica, sans-serif',              // h1-h3 only
    mono: 'JetBrains Mono, monospace',             // code blocks (web only)
    // Caveat NOT exported — web's existing usage stays inline in web's CSS
    // (web can keep importing Caveat for marketing-specific contexts)
  },
  fontSize: {
    xs:   '0.75rem',   // 12px
    sm:   '0.875rem',  // 14px
    base: '1rem',      // 16px
    lg:   '1.125rem',  // 18px
    xl:   '1.25rem',   // 20px
    '2xl':'1.5rem',    // 24px
    '3xl':'1.875rem',  // 30px
    '4xl':'2.25rem',   // 36px
    '5xl':'3rem',      // 48px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};
```

**Per-app typography defaults** (component-level density, Eje 8):

- **Web**: body = `font-size base / line-height relaxed (1.75)`. Headings use Geologica heavily.
- **Admin**: body = `font-size sm / line-height normal (1.5)`. Geologica reserved for H1 of section pages, H2 of detail tabs. Other headings use Roboto semibold.

### 5.3 Spacing

Same numeric scale, both apps:

```ts
export const spacing = {
  0:   '0',
  1:   '0.25rem',  // 4px
  2:   '0.5rem',   // 8px
  3:   '0.75rem',  // 12px
  4:   '1rem',     // 16px
  5:   '1.25rem',  // 20px
  6:   '1.5rem',   // 24px
  8:   '2rem',     // 32px
  10:  '2.5rem',   // 40px
  12:  '3rem',     // 48px
  16:  '4rem',     // 64px
  20:  '5rem',     // 80px
  24:  '6rem',     // 96px
};
```

**Per-app density** (Eje 8):

- **Web** defaults (in component styles): card padding `8` (32px), section gap `12` (48px).
- **Admin** defaults: card padding `4-5` (16-20px), section gap `6-8` (24-32px).

Same tokens, different choices per context — not enforced by the token system, just convention.

### 5.4 Radius

Single value (Eje 5): **0.75rem** for the base.

```ts
export const radius = {
  none: '0',
  sm:   '0.375rem',   // 6px — for small UI (badges, inline buttons)
  base: '0.75rem',    // 12px — cards, inputs, buttons (default)
  lg:   '1rem',       // 16px — large surfaces (modals, panels)
  full: '9999px',     // pills, avatars
};
```

### 5.5 Shadows

```ts
export const shadows = {
  none: 'none',
  sm:   '0 1px 2px 0 oklch(0 0 0 / 0.05)',
  base: '0 1px 3px 0 oklch(0 0 0 / 0.1), 0 1px 2px 0 oklch(0 0 0 / 0.06)',
  md:   '0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -1px oklch(0 0 0 / 0.06)',
  lg:   '0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -2px oklch(0 0 0 / 0.05)',
  xl:   '0 20px 25px -5px oklch(0 0 0 / 0.1), 0 10px 10px -5px oklch(0 0 0 / 0.04)',
};
```

Per-app convention: web tends to use `md`/`lg` for cards (softer, more breathing); admin uses `sm`/`base` (denser, subtler).

### 5.6 Motion

```ts
export const motion = {
  duration: {
    fast:   '150ms',
    base:   '200ms',
    slow:   '300ms',
    slower: '500ms',
  },
  easing: {
    out:     'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut:   'cubic-bezier(0.65, 0, 0.35, 1)',
    spring:  'cubic-bezier(0.34, 1.56, 0.64, 1)',  // playful, for web
  },
};
```

Web can use `spring` for marketing micro-interactions. Admin defaults to `out` (fast, professional).

---

## 6. Per-app semantic theme mapping

### 6.1 Web theme

```ts
// themes/web-light.ts
export const webLight = {
  '--color-primary':         palette.river[500],     // canonical river — saturated, vibrant
  '--color-primary-hover':   palette.river[400],     // lighter on hover
  '--color-primary-pressed': palette.river[600],     // darker on press
  '--color-accent':          palette.accent[500],
  '--color-bg-app':          palette.neutral[50],
  '--color-bg-elevated':     'oklch(1 0 0)',         // pure white cards
  '--color-fg-primary':      palette.neutral[900],
  '--color-fg-secondary':    palette.neutral[600],
  '--color-fg-muted':        palette.neutral[400],
  '--color-border':          palette.neutral[200],
  '--color-success':         palette.success[500],
  '--color-warning':         palette.warning[500],
  '--color-danger':          palette.danger[500],
  '--color-info':            palette.info[500],
  '--font-body':             typography.fontFamily.sans,
  '--font-heading':          typography.fontFamily.heading,
  '--radius':                radius.base,
  // ... etc
};
```

### 6.2 Admin theme

```ts
// themes/admin-light.ts
export const adminLight = {
  '--color-primary':         palette.river[600],     // derived river — same hue, more muted/denser
  '--color-primary-hover':   palette.river[500],
  '--color-primary-pressed': palette.river[700],
  '--color-accent':          palette.accent[600],    // also slightly muted
  '--color-bg-app':          palette.neutral[100],   // slightly grayer than web (more "workspace")
  '--color-bg-elevated':     'oklch(1 0 0)',
  '--color-fg-primary':      palette.neutral[900],
  '--color-fg-secondary':    palette.neutral[700],
  '--color-fg-muted':        palette.neutral[500],
  '--color-border':          palette.neutral[200],
  '--color-success':         palette.success[600],   // slightly muted semantics
  '--color-warning':         palette.warning[600],
  '--color-danger':          palette.danger[600],
  '--color-info':            palette.info[600],
  '--font-body':             typography.fontFamily.sans,
  '--font-heading':          typography.fontFamily.heading,
  '--radius':                radius.base,
  // ... etc
};
```

### 6.3 Dark themes

Same structure as light, with shade selections shifted (e.g., web-dark primary = `river[400]`, admin-dark primary = `river[500]`).

Full dark theme specs to be detailed at implementation time — same architectural pattern as above.

---

## 7. Migration plan — safety-first

### Phase 0 — baseline (before any changes)

1. **Playwright visual snapshots of web** at multiple breakpoints (mobile, tablet, desktop, wide). Pages: home, listing accommodations, detail accommodation, /publicar, /mi-cuenta/suscripcion, blog index, blog post, contact, legal pages. Both light + dark themes.
2. Store snapshots in `apps/web/tests/visual-snapshots/baseline/`.
3. **Extract web's current tokens verbatim** from `apps/web/src/styles/global.css` + `css-var-themes.css` + `lib/colors.ts`. Produce a JSON manifest of canonical values per palette.

### Phase 1 — create the package

1. Create `packages/design-tokens` with file structure per §4.1.
2. **Seed canonical 500 values from Phase 0 manifest, byte-for-byte**. Do NOT introduce new values yet — the package initially reproduces web's current tokens exactly.
3. Implement `generate-css.ts` to produce `dist/tokens.css`.
4. Add validation in `build/validate.ts`: parse Phase 0 manifest + parse generated CSS. If any oklch value differs, build fails with diff output.

### Phase 2 — web migrates

1. Web replaces inline token declarations with `@import '@repo/design-tokens/tokens.css'`.
2. Re-take Playwright snapshots.
3. **Pixel-by-pixel diff against Phase 0 baseline**. Acceptance threshold: 0 pixel differences (allowing only known font-rendering noise <0.1% per snapshot).
4. If any diff > threshold: investigate root cause, fix in tokens package, repeat.
5. Web is now consuming shared tokens, identical visually.

### Phase 3 — admin migrates

1. Admin sets `data-app="admin"` on `<html>` element (root layout).
2. Admin replaces `apps/admin/src/styles.css` shadcn defaults with imports from `@repo/design-tokens/tokens.css`.
3. Admin's Tailwind theme config maps utilities to CSS vars (`primary: 'var(--color-primary)'`, etc.).
4. Admin migrates dark mode from `.dark` class to `[data-theme="dark"]` attribute. Tailwind v4 custom variant config updated.
5. Visual review of admin (no baseline since intentional change — capture new snapshots for future reference).
6. Component-by-component audit: any place using hardcoded shadcn colors → migrate to token references.

### Rollback strategy

- All 3 phases independently revertible by git.
- Phase 2 has explicit visual regression check — if fails, revert.
- Phase 3 is the "intentional change" phase — no rollback needed unless catastrophic.

---

## 8. Implementation order (for the SPEC)

1. **Phase 0 baseline** — Playwright snapshots + token extraction script (NO code changes).
2. **Phase 1 package creation** — `packages/design-tokens` scaffolded, seeded, validated.
3. **Phase 2 web migration** — verify visual identity preserved.
4. **Phase 3 admin migration**:
   - 3a: Foundation (import tokens, set `data-app="admin"`, configure Tailwind to use CSS vars).
   - 3b: Migrate dark mode strategy.
   - 3c: Replace shadcn slate primary with river-600 in component themes.
   - 3d: Audit + migrate components hardcoded with shadcn colors.
   - 3e: Add Geologica to admin's font loading.

Each sub-step is independent and reversible.

---

## Open questions

_None — all 8 ejes locked._

The detailed 10-shade values per palette + exact dark theme mappings are deferred to implementation time. They derive from the canonical 500 values + the algorithm in §5.1. Doc 05 establishes the architecture + principles + canonical values; implementation produces the precise CSS.

---

## Decisions log

| Date | Decision | Section |
|------|----------|---------|
| 2026-05-22 | Principle: brand shared at token level, density distinct at component level | §2 |
| 2026-05-22 | Eje 1: tokens in new package `packages/design-tokens` (NOT extending tailwind-config) | §3, §4.1 |
| 2026-05-22 | Eje 2: TS source + auto-generated CSS via build script | §3, §4.3 |
| 2026-05-22 | Eje 3: admin primary derived from river (river-600), web continues with river-500 | §3, §6 |
| 2026-05-22 | Eje 4: fonts = Roboto (body) + Geologica (headings) shared; Caveat stays web-only (not in admin tokens) | §3, §5.2 |
| 2026-05-22 | Eje 5: radius base = 0.75rem (web's current value adopted by admin) | §3, §5.4 |
| 2026-05-22 | Eje 6: dark mode strategy = `[data-theme="dark"]` attribute (admin migrates from `.dark` class) | §3, §4.2 |
| 2026-05-22 | Eje 7: semantic colors (success/warning/danger/info) defined separately from brand palette, with harmonized hues | §3, §5.1 |
| 2026-05-22 | Eje 8: no shared components — only tokens; admin and web keep their tooling separate | §3 |
| 2026-05-22 | Palette structure: 10 shades per color (50-900). Web's current values become 500 (canonical). Other shades derived via lightness + chroma algorithm preserving hue | §5.1 |
| 2026-05-22 | Migration safety: Phase 0 snapshots + token extraction → Phase 1 package seeded byte-for-byte from web → Phase 2 web migrates with pixel-diff validation → Phase 3 admin migrates (intentional visual change) | §7 |
| 2026-05-22 | Per-app density convention: web uses larger spacing tokens (8/12 for padding/gap), admin uses smaller (4-5/6-8). NOT enforced by tokens — convention at component-style level | §5.3, §3 (Eje 8) |
| 2026-05-22 | Admin sets `data-app="admin"` on `<html>` to scope admin theme tokens. Web is the default scope (no `data-app`). | §4.2 |

---

## Change log

| Date | Version | Change |
|------|---------|--------|
| 2026-05-22 | 0.1 | Initial draft. 8 axes locked after discussion. Architecture for `packages/design-tokens` defined. Token specifications: palette (5 brand colors + 4 semantic + neutral, 10 shades each), typography (Roboto + Geologica), spacing (0-24), radius (0.75rem base), shadows (5-step scale), motion (4 durations + 3 easings). Per-app theme mappings (web-light/dark + admin-light/dark) with concrete shade picks. Migration plan with 3 phases + safety-first guarantees (Phase 0 baseline snapshots, byte-for-byte seeded tokens, pixel-diff validation for web). |
