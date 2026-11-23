# @repo/design-tokens

Shared design tokens consumed by both `apps/web` and `apps/admin`. Single source of truth for palette, typography, spacing, radius, shadows, and motion across the Hospeda platform.

> **Status**: SPEC-153 Phase 1 — scaffold only. Tokens, themes, build pipeline, and validation land in subsequent tasks (T-153-06 through T-153-19).

## Package layout

```text
packages/design-tokens/
├── src/
│   ├── tokens/         # Primitive TS modules: colors, typography, spacing, radius, shadows, motion, z-index, layout
│   ├── themes/         # Per-app semantic mappings: web-light, web-dark, admin-light, admin-dark
│   ├── generators/     # generate-css.ts (TS tokens → dist/tokens.css), validate.ts (round-trip vs seed). Named "generators" rather than "build" because the repo's root .gitignore excludes `**/build/`, which would otherwise hide the source files.
│   └── index.ts        # Type-safe exports for TS consumers
├── seed/
│   └── web-baseline.json  # Byte-for-byte snapshot of web's current tokens (extracted via scripts/extract-web-tokens.ts)
├── dist/                  # Build output: index.{js,cjs,d.ts} + tokens.css
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## Consumers

- **Web** (`apps/web`) imports `@repo/design-tokens/tokens.css` from its `global.css` (Phase 2 migration).
- **Admin** (`apps/admin`) imports `@repo/design-tokens/tokens.css` from its `styles.css` and references the CSS vars in its Tailwind v4 `@theme` (Phase 3 migration).

Both apps remain free to layer app-specific overrides on top — the package only provides the foundational tokens.

## Theme architecture

The generated `dist/tokens.css` declares four selector scopes:

| Selector | Active for |
|----------|------------|
| `:root` | Web (default scope) — light theme |
| `[data-theme="dark"]:not([data-app="admin"])` | Web — dark theme |
| `[data-app="admin"]` | Admin — light theme |
| `[data-app="admin"][data-theme="dark"]` | Admin — dark theme |

Admin opts into its theme by setting `data-app="admin"` on the `<html>` element. Web is the default scope and does not need an attribute.

## Build pipeline

```bash
pnpm --filter @repo/design-tokens build
```

Runs three steps in order:

1. **tsup** — compiles `src/index.ts` to ESM + CJS + `.d.ts` in `dist/`.
2. **generate-css** — reads the TS token modules and emits `dist/tokens.css` with all palette + theme declarations.
3. **validate** — parses the generated CSS and asserts byte-for-byte parity against `seed/web-baseline.json`. Fails the build if any token drifts from web's current canonical value.

The round-trip validation is what guarantees Phase 2's pixel-diff acceptance (AC-6 of SPEC-153): if `tokens.css` produces values identical to web's current ones, the migration cannot regress visually.

## Re-extracting the baseline

If `apps/web/src/styles/global.css` legitimately changes (e.g., a token is added or renamed BEFORE the SPEC-153 migration completes), regenerate the seed manifest:

```bash
pnpm --filter @repo/design-tokens extract:web
```

This re-runs `scripts/extract-web-tokens.ts` against the latest `global.css` and rewrites `seed/web-baseline.json`. Use sparingly — every regeneration moves the gold-standard reference and invalidates pixel-diff baselines captured before it.

## Out of scope

Documented in `seed/web-baseline.json` under `outOfScope`:

- `apps/web/src/styles/css-var-themes.css` — content-type themes (event/post/accommodation categories). Stays in `apps/web`.
- `apps/web/src/lib/colors.ts` — runtime color mapper functions. Stays in `apps/web`.
- `apps/web/src/styles/components.css` — BEM component classes. Consumer only, stays in `apps/web`.
- `apps/web/src/styles/feedback-overrides.css` — FAB visual overrides. Consumer only, stays in `apps/web`.

## Mi Cuenta app tokens (HOS-2413)

`src/themes/web-account.ts` holds the account-area tokens. They are spread into `web-light.ts` and `web-dark.ts`:

- **HOS-2454 (T-001)**: `status-{success,warning,danger,info,neutral}-{bg,fg,border,solid}`, `focus-ring`, `radius-control` / `radius-surface`, `control-h-{sm,md,lg}`, and the app typography aliases. Each alias is `--app-<role>` (a font shorthand) plus `-size`, `-leading`, `-weight` and, where the catalog sets one, `-tracking`.
- **Kit delta (T-002)**: `action-*`, `on-action-*`, `control-bg`, `control-border`, `nav-active-*`, `upsell-*`, `shadow-sticky`, `sidebar-w`, `editor-nav-w`, `form-max` and `reading-max`. `ACCOUNT_BREAKPOINTS_REM` and `CQ_EDITOR_NAV_REM` are TS-only, because custom properties cannot be used inside `@media` / `@container` preludes.

Nothing outside `apps/web/src/components/account/ui/` consumes them in this phase. The AA pairs are tested in `src/tokens/app-tokens-contrast.test.ts` and `src/tokens/account-kit-contrast.test.ts`. `seed/web-baseline.json` is not touched: it is the frozen extraction of `global.css`, and none of these names exist there.

## Owner decisions

### D4 «color de acción» (HOS-2409, owner comment 2026-11-20)

`--action-primary` is an exact alias of `--brand-primary`, and `--action-accent` of `--brand-accent`, in both themes. Their `--on-action-*` text is white, and the base fill is never replaced by a darker token. White on these colors misses WCAG AA; the owner accepted that. The ratios computed from this package's theme values are pinned as `OWNER_ACCEPTED_D4` in `src/tokens/account-kit-contrast.test.ts`:

| Pair | Light | Dark |
|---|---|---|
| white on `--action-primary` | 3.56:1 | 2.93:1 |
| white on `--action-accent` | 2.82:1 | 2.62:1 |

The test fails if an alias drifts or a ratio drops below its pin. A palette change therefore forces someone to revisit the decision instead of silently worsening it.

**Hover (owner decision, 2026-11-21).** `--action-primary-hover` and `--action-accent-hover` are the brand fill about 8% darker: OKLCH lightness × `ACTION_HOVER_LIGHTNESS_FACTOR` (0.92), same chroma and hue, in both themes. Darker means white text on hover measures at or above the base pair. The test pins these exactly as `OWNER_ACCEPTED_D4_HOVER`, and asserts each one is at least its base pair:

| Pair | Light | Dark |
|---|---|---|
| white on `--action-primary-hover` | 4.38:1 | 3.61:1 |
| white on `--action-accent-hover` | 3.48:1 | 3.26:1 |

## References

- SPEC: `.qtm/specs/SPEC-153-admin-design-tokens/spec.md`
- Design proposal: `.claude/audit/admin-redesign/proposals/05-visual-tokens.md`
- Phase 0 deliverables: `seed/web-baseline.json`
- Visual regression (light and dark): `apps/e2e/tests/visual/` (HOS-2471), see
  `apps/e2e/README.md` → «Visual regression»
