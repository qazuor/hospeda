---
specId: SPEC-153
title: Admin Design Tokens — Shared Brand Tokens for Admin/Web
status: draft
complexity: high
owner: qazuor
created: 2026-05-22
parent: (none)
related:
  - SPEC-154 (admin-config-driven-ia — independent, Wave 1 parallel)
  - SPEC-155 (admin-dashboards-v1 — consumes tokens for widget rendering)
  - SPEC-156 (admin-settings-reorganization — consumes tokens for page surfaces)
---

# SPEC-153 — Admin Design Tokens

> **Status**: DRAFT — base scope captured during the admin redesign planning session 2026-05-22. All 8 architectural decisions locked in `.claude/audit/admin-redesign/proposals/05-visual-tokens.md` (v0.1+).

## 1. Origin

Phase 1 audit of admin vs web (`.claude/audit/admin-redesign/phase-1/04-visual-identity.md`) revealed that admin and web today share **NO design tokens** beyond 3 unused hex values in `packages/tailwind-config/shared-styles.css`. The two apps look like different products:

- Web: warm brand palette (river/sky/forest/sand + accent), oklch-based, 3-font system (Roboto + Geologica + Caveat), radius 0.75rem, dark mode via `[data-theme="dark"]`.
- Admin: shadcn slate defaults, system font stack, radius 0.625rem, dark mode via `.dark` class.

A user moving from `hospeda.com.ar` to the admin panel feels like switching to a different app.

Owner's goal: **"que se note que es lo mismo, y no parezca que estás cambiando a una app que no tiene nada que ver"** — same brand at the token level, with admin still feeling like an admin (denser, more productivity-focused).

## 2. Goal

Establish `packages/design-tokens` as the single source of truth for design tokens consumed by both apps. Migrate web first (with pixel-diff safety guarantee — zero visual change), then migrate admin (intentional visual change — admin adopts brand tokens for the first time).

## 3. Scope

### IN
- New package `packages/design-tokens` with TS source + auto-generated `tokens.css` build artifact.
- Palette (5 brand colors + 4 semantic + neutral grays, 10 shades each).
- Typography (Roboto + Geologica families + size/weight/line-height scales).
- Spacing scale (0-24, same numeric scale both apps).
- Radius (single base value 0.75rem).
- Shadows (5-step scale).
- Motion tokens (4 durations + 3 easings).
- Per-app theme mappings: `web-light`, `web-dark`, `admin-light`, `admin-dark`.
- Phase 0 Playwright baseline snapshots of web at multiple breakpoints.
- Phase 2 web migration with pixel-diff validation (0 pixel diff required).
- Phase 3 admin migration:
  - Foundation: import tokens, set `data-app="admin"`, Tailwind v4 theme references CSS vars.
  - Migrate dark mode strategy from `.dark` class to `[data-theme="dark"]` attribute.
  - Replace shadcn slate primary with `river-600` in admin theme.
  - Audit + migrate components hardcoded with shadcn colors.
  - Add Geologica + Roboto font loading.
- Validation script ensuring web's seeded values round-trip byte-for-byte.

### OUT
- New design tokens beyond the documented set in doc 05 §5.
- Component refactoring beyond color/font token migration.
- Refactoring shadcn primitives to a different system.
- Caveat font in admin (decorative, intentionally web-only).
- New dark theme palettes ("hospeda-night" etc.) — infrastructure supports them but they're not added in V1.
- DB-backed runtime token editing (post-V1 phase 2 feature).

## 4. Acceptance criteria

### A. Package creation
- AC-1: `packages/design-tokens` exists with the file structure documented in doc 05 §4.1.
- AC-2: Building the package generates `dist/tokens.css` containing all palette + theme CSS custom properties.
- AC-3: `packages/design-tokens` exports TS types and token objects for type-safe consumption.
- AC-4: Validation script fails the build if any oklch/hex value in `tokens.css` differs from the Phase 0 manifest of web's current values (round-trip check).

### B. Web migration (Phase 2 — zero visual change)
- AC-5: Phase 0 baseline Playwright snapshots captured for: home, accommodations listing, accommodation detail, /publicar, /mi-cuenta/suscripcion, blog index, blog post, contact, legal/cookies — at mobile/tablet/desktop/wide breakpoints, both light + dark themes.
- AC-6: After Phase 2 migration, re-captured snapshots match baseline pixel-by-pixel (allowing only <0.1% font-rendering noise per snapshot).
- AC-7: Web's `global.css` no longer declares palette/typography/spacing/radius tokens inline — they come from `@import '@repo/design-tokens/tokens.css'`.

### C. Admin migration (Phase 3 — intentional visual change)
- AC-8: Admin's root layout sets `data-app="admin"` on `<html>` so admin-theme tokens apply.
- AC-9: Admin's Tailwind v4 theme config references CSS vars (`primary: 'var(--color-primary)'`) instead of literal shadcn slate values.
- AC-10: Admin migrates dark mode from `.dark` class to `[data-theme="dark"]` attribute. Tailwind custom variant updated. No regression in dark mode usability.
- AC-11: Admin primary visually distinct from shadcn slate — uses `river-600` (same hue 259 as web's river-500, more muted).
- AC-12: Geologica + Roboto fonts loaded in admin. Geologica used in H1/H2 only.
- AC-13: Admin sidebar/topbar/main-menu surfaces visibly adopt brand colors (river-derived) instead of generic neutrals.

### D. Cross-app coherence
- AC-14: Side-by-side review (web + admin in two browser windows) shows visually coherent brand identity — same hue family in primary buttons, same typography in headings, same radius on cards.

## 5. Technical approach

Three-phase migration per doc 05 §7. Each phase is independently revertible by git.

### Phase 0 — baseline
1. Write a Playwright script `apps/web/tests/visual-snapshots/capture-baseline.ts` that visits the listed pages at 4 breakpoints × 2 themes = 8 snapshots each.
2. Store snapshots in `apps/web/tests/visual-snapshots/baseline/{page}/{breakpoint}-{theme}.png`.
3. Write `scripts/extract-web-tokens.ts` that parses `apps/web/src/styles/global.css` + `css-var-themes.css` + `lib/colors.ts` and outputs a JSON manifest `packages/design-tokens/seed/web-baseline.json` with all canonical values.

### Phase 1 — package creation
1. Create `packages/design-tokens` with the structure from doc 05 §4.1.
2. Seed `src/tokens/colors.ts` from `seed/web-baseline.json` (canonical 500 values per palette = web's current values, byte-for-byte).
3. Implement shade derivation algorithm (doc 05 §5.1): lightness moves linearly from 0.99 (50) to 0.10 (900); chroma scales to ~50% at extremes; hue locked.
4. Implement theme mappings: `web-light.ts`, `web-dark.ts`, `admin-light.ts`, `admin-dark.ts`.
5. Implement `gen-css.ts` to produce `dist/tokens.css`.
6. Implement `validate.ts` that asserts round-trip identity against the seed manifest.

### Phase 2 — web migrates
1. Add `@repo/design-tokens` to `apps/web` workspace deps.
2. Web's `global.css`: replace inline token declarations with `@import '@repo/design-tokens/tokens.css'`.
3. Re-take Playwright snapshots.
4. Diff each snapshot vs Phase 0 baseline. Acceptance: 0 pixel difference (modulo <0.1% font noise).
5. If any diff > threshold: investigate, fix in tokens package, repeat.

### Phase 3 — admin migrates
1. Add `@repo/design-tokens` to `apps/admin` workspace deps.
2. Admin root layout: set `data-app="admin"` on `<html>` element.
3. Admin's `src/styles.css`: replace shadcn token declarations with `@import '@repo/design-tokens/tokens.css'`.
4. Update `apps/admin/tailwind.config.ts` v4 theme: utilities resolve to CSS vars (`primary: 'var(--color-primary)'`, `radius: 'var(--radius)'`, etc.).
5. Migrate dark mode strategy: replace `.dark` class with `[data-theme="dark"]` attribute. Update Tailwind custom variant config. Update any code that toggles dark mode.
6. Load Geologica + Roboto fonts (via Google Fonts or self-hosted, decided at implementation time).
7. Audit components hardcoded with shadcn slate colors; migrate to token references.
8. Visual review side-by-side with web.

## 6. Task breakdown (atomic, complexity ≤ 4)

Estimated 28 tasks. Atomization at implementation time per CLAUDE.md "Activation criteria" pattern.

Indicative breakdown:
- Phase 0: 3 tasks (Playwright capture script, baseline run, token extraction script)
- Phase 1: 8 tasks (package scaffold, colors TS, typography TS, spacing TS, radius TS, shadows TS, motion TS, themes mapping, gen-css script, validate script)
- Phase 2: 4 tasks (web deps update, global.css refactor, snapshot re-capture, pixel diff verification)
- Phase 3: 10-13 tasks (admin deps, root layout attr, styles.css refactor, Tailwind v4 theme config, dark mode strategy migration, font loading, component audits per area, visual review)

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Web visual regression during Phase 2 | Pixel-diff validation gates Phase 2 acceptance. Phase 0 baseline + Phase 2 re-capture diff = 0. |
| Tailwind v4 + CSS vars compatibility issues | Verify Tailwind v4 supports `theme()` with `var()` references during Phase 1. Fallback: generate Tailwind preset from tokens at build time. |
| `[data-theme]` attribute migration breaking admin dark mode | Test thoroughly in dev before merging. Keep old `.dark` class working for one release cycle. |
| Font loading FOUC in admin | Use `font-display: swap` + preload critical fonts. Avoid Caveat (unnecessary in admin). |
| `oklch()` browser support | Modern browsers (Chrome 111+, Safari 15.4+, Firefox 113+) support it. Already used by web. No regression for our user base. |
| Tokens drift between TS source and generated CSS | Validation script in Phase 1 + every CI build. |
| Web font loading adds latency | Already loaded on web. Admin gets same fonts — net zero for users hitting both. Self-host if Google Fonts becomes a perf issue. |

## 8. Rollback plan

- Phase 0: revert script files, no impact on runtime.
- Phase 1: package can be deleted from workspaces, no other app depends on it yet.
- Phase 2: revert web's `global.css` to inline declarations. One-commit revert.
- Phase 3 sub-steps are independently revertible:
  - 3a (foundation) revert = remove `data-app` attr + restore shadcn defaults
  - 3b (dark mode) revert = re-enable `.dark` class fallback
  - 3c (primary color) revert = re-set shadcn slate as primary
  - 3d (component migrations) revertible per component

## 9. Dependencies

- **External**: none — fully self-contained.
- **Internal**: none (independent — Wave 1 parallel with SPEC-154).

## 10. References

- `.claude/audit/admin-redesign/proposals/05-visual-tokens.md` (primary spec)
- `.claude/audit/admin-redesign/phase-1/04-visual-identity.md` (original audit findings)
- `.claude/audit/admin-redesign/proposals/01-information-architecture.md` (cross-reference for admin IA context)
- `apps/web/src/styles/global.css`, `css-var-themes.css`, `lib/colors.ts` (current web tokens — Phase 0 extraction source)
- `apps/admin/src/styles.css`, `tailwind.config.*` (current admin tokens — to be migrated in Phase 3)
