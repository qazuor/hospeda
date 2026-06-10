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

## References

- SPEC: `.qtm/specs/SPEC-153-admin-design-tokens/spec.md`
- Design proposal: `.claude/audit/admin-redesign/proposals/05-visual-tokens.md`
- Phase 0 deliverables: `seed/web-baseline.json`, `apps/web/tests/visual-snapshots/`
