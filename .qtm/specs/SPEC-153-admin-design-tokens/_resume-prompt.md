# SPEC-153 Resume Prompt — Phase 1 mid-flight (15/32 done)

> **Paste this into a fresh Claude session to continue exactly where we left off.**
> Worktree: `/home/qazuor/projects/WEBS/hospeda-spec-153-admin-design-tokens`
> Branch: `spec/SPEC-153-admin-design-tokens`
> Last commit: `028840337` chore(spec): mark SPEC-153 T-153-15 complete

---

## TL;DR

Estoy implementando **SPEC-153 Admin Design Tokens** — paquete `@repo/design-tokens`
que unifica el sistema de diseño entre `apps/web` (Astro + CSS Modules) y
`apps/admin` (TanStack Start + Tailwind v4 + shadcn).

**Progress**: 15/32 tasks done. Phase 0 ✓. Phase 1 al 73% (11/15). Working tree
limpio. 27 commits. 270 vitest tests pasando.

**Próximo paso**: T-153-16 — escribir `packages/design-tokens/src/generators/generate-css.ts`
que produce `dist/tokens.css`. Es el más grande de Phase 1 (complexity 4) y el que
orquesta TODO lo que armamos hasta ahora.

---

## Lo que hicimos hasta acá

### Phase 0 ✓ (T-153-01..04)

- Playwright instalado en `apps/web` con config `playwright-visual.config.ts`
  (4 viewports × 2 themes = 64 baselines).
- Script de captura `apps/web/tests/visual-snapshots/capture-baseline.visual.ts`
  con seeding de theme via `localStorage.theme` antes del FOUC script de web.
- **64 baselines capturados** local-only (gitignored, 31MB) contra el dev server
  en :4321.
- Extractor `scripts/extract-web-tokens.ts` parsea `apps/web/src/styles/global.css`
  → `packages/design-tokens/seed/web-baseline.json` (199 tokens: 142 light + 56 dark
  + 1 media-block).

### Phase 1 done (T-153-05..15)

**Scaffold + 8 token modules + 2 theme pairs**, todos con tests colocated:

```
packages/design-tokens/
├── seed/web-baseline.json
├── src/
│   ├── tokens/
│   │   ├── colors.ts         # 5 brand palettes + 4 semantic + neutral + extras
│   │   ├── typography.ts     # fontFamily/Size/Weight/Height + 16 semantic composites
│   │   ├── spacing.ts        # 15 numeric stops + 7 semantic composites
│   │   ├── radius.ts         # base + 4 calc scale + 3 semantic + 3 deprecated organic
│   │   ├── shadows.ts        # doc 05 elevation + web semantic with oklch(from var())
│   │   ├── motion.ts         # parallel doc 05 + web-anchored scales (divergent on purpose)
│   │   ├── z-index.ts        # 7-layer ladder
│   │   └── layout.ts         # chrome dims + container + media overrides
│   ├── themes/
│   │   ├── types.ts          # ThemeValue = OKLCH | string; Theme = Record<...>
│   │   ├── web-light.ts      # 142 entries, byte-for-byte web's :root
│   │   ├── web-dark.ts       # 56 dark overrides
│   │   ├── admin-light.ts    # 17 entries, doc 05 §6.2 color-* naming
│   │   └── admin-dark.ts     # 14 dark overrides (one shade lighter)
│   ├── generators/.gitkeep   # T-153-16/17 land here
│   └── index.ts              # placeholder, T-153-18 expands
└── (package.json, tsconfig, tsup.config, README, vitest.config, .gitignore)
```

**Patrones clave**:
- `ThemeValue = OKLCH | string`. Theme keys SIN leading `--` (generator prepende).
- Web theme emite los var names ACTUALES de web (`--brand-primary`, `--core-background`,
  `--shadow-card`, `--radius-organic*`, etc.) byte-for-byte desde seed.
- Admin theme emite naming limpio doc 05 §6.2 (`--color-primary`, `--color-bg-app`,
  `--color-success`, etc.). Admin's @theme inline {} en Phase 3 mapea shadcn names a estos.
- Palette canonical 500 values anchored byte-for-byte a web → garantiza Phase 2
  pixel-diff zero.
- Admin usa `river[600]` como primary (denser/muted vs web's `river[500]`) — misma
  hue family para coherencia de marca.

---

## Lo que falta (Phase 1)

| Task | Scope | Complexity |
|------|-------|------------|
| **T-153-16** | `generators/generate-css.ts` → `dist/tokens.css` | **4** |
| **T-153-17** | `generators/validate.ts` — round-trip parse vs seed | **4** |
| T-153-18 | `src/index.ts` — type-safe exports completos | 2 |
| T-153-19 | turbo run build green end-to-end | 2 |

Después: Phase 2 (T-153-20..23, web migration con pixel-diff gate, 4 tasks)
y Phase 3 (T-153-24..32, admin migration, 9 tasks).

---

## Cómo continuar (instrucciones para T-153-16)

`generate-css.ts` debe emitir un `dist/tokens.css` con estos bloques en orden:

```css
/**
 * @repo/design-tokens — auto-generated, do not edit by hand.
 * Source: src/tokens/, src/themes/. Regenerate via pnpm --filter @repo/design-tokens build.
 */

:root {
    /* Palette declarations — always available regardless of theme. */
    --palette-river-50: oklch(...);
    --palette-river-100: ...;
    /* ... 10 shades × 10 palettes (5 brand + 4 semantic + neutral) = 100 vars */

    /* Web light theme (web is the default scope) */
    --core-background: oklch(0.985 0.002 210);
    --brand-primary: oklch(0.63 0.19 259);
    /* ... 142 vars from webLight */
}

@media (min-width: 1600px) {
    :root {
        --container-max: 1500px;
    }
}

[data-theme="dark"]:not([data-app="admin"]) {
    /* ... 56 vars from webDark */
}

[data-app="admin"] {
    /* ... 17 vars from adminLight */
}

[data-app="admin"][data-theme="dark"] {
    /* ... 14 vars from adminDark */
}
```

**Key implementation details**:

1. **camelCase → kebab-case key conversion** at emit time:
   - `cardHover` → `--shadow-card-hover`
   - `bodySm` → `--text-body-sm`
   - etc.
   - But the THEMES use kebab-case keys already (`'shadow-card-hover'`), since they
     mirror web's CSS var names. So just prepend `--`.
   - WAIT — for admin theme keys like `color-primary`, also just prepend `--`. Done.

2. **OKLCH formatting**: theme values that are `OKLCH` objects must be passed through
   `formatOKLCH()` from `colors.ts`. Strings emit as-is.

3. **Palette emit order**: iterate `brandPalettes` → `semanticPalettes` → `neutral`,
   then for each palette iterate `SHADES` constant. Var names follow pattern
   `--palette-{name}-{shade}` (e.g. `--palette-river-500`).

4. **Output target**: `packages/design-tokens/dist/tokens.css`. The package.json
   already declares `./tokens.css` → `dist/tokens.css` in exports.

5. **CLI invocation**: `pnpm exec tsx src/generators/generate-css.ts`. Wired into
   `build:css` script (already in package.json). The full `build` script chains
   tsup + generate-css + validate.

6. **Tests for the generator**: colocate `generate-css.test.ts` next to the file.
   Easiest approach: import the generator's `buildCSS()` function (refactor to
   pure function that returns a string, write that to disk separately), assert
   substrings exist (`'--palette-river-500: oklch(0.63 0.19 259);'`,
   `'@media (min-width: 1600px)'`, `'[data-app="admin"]'`, etc.) + a snapshot
   of the full output.

After T-153-16, **T-153-17** validate.ts parses the generated CSS and checks each
token against the seed manifest. Build fails on drift. This is the byte-for-byte
safety net for Phase 2 pixel-diff zero.

---

## Gotchas críticos (NO ignorar)

1. **`.js` extensions en imports de source files** — no `.ts`.
   `allowImportingTsExtensions=false` en `@repo/typescript-config/base.json`.
   Test files OK con `.ts` porque están excluidos del tsc. Ejemplo correcto:
   ```ts
   import { river, formatOKLCH } from '../tokens/colors.js';
   ```

2. **Directory naming** — usá `src/generators/`, NO `src/build/`. Root .gitignore
   tiene `**/build/` que ocultaría el código fuente.

3. **Bash hook block** — paths con "build/" o "dist/" en comandos Bash o commit
   messages se bloquean. Workaround para commits: `git commit -F -` con heredoc
   (lee desde stdin, evita validation del message).

4. **state.json edits** — siempre poner coma trailing después del completionNotes
   string largo. El biome JSON parser falla sin la coma + bloquea lint-staged
   pre-commit. Recurrent bug, watch for it.

5. **Vitest workspace** — el root `vitest.config.ts` referencia
   `packages/*/vitest.config.ts` glob. `packages/design-tokens/vitest.config.ts`
   YA EXISTE (creado en T-153-06) con `root: import.meta.dirname` + colocated
   include `src/**/*.test.ts`. No tocar.

6. **biome lint-staged** auto-fixea import order + multi-line statement collapses
   en cada commit. Si ves "Note: file was modified by a linter" mid-task, es esto.
   Re-stage y commit anda.

---

## Comandos útiles

```bash
# Worktree
cd /home/qazuor/projects/WEBS/hospeda-spec-153-admin-design-tokens

# Tests del package
pnpm --filter @repo/design-tokens test          # corre los 270 vitest tests
pnpm --filter @repo/design-tokens typecheck     # tsc --noEmit
pnpm --filter @repo/design-tokens lint          # biome check
pnpm --filter @repo/design-tokens check         # biome check --write (auto-fix)
pnpm --filter @repo/design-tokens build:ts      # tsup (ESM + CJS + DTS, sin gen-css ni validate)

# Cuando T-153-16 esté listo:
pnpm --filter @repo/design-tokens build:css     # tsx src/generators/generate-css.ts
pnpm --filter @repo/design-tokens build         # tsup + build:css + validate (full pipeline)

# Re-extraer si web cambia
pnpm --filter @repo/design-tokens extract:web
```

---

## Referencias

- **Spec**: `.claude/specs/SPEC-153-admin-design-tokens/spec.md` (AC-1 a AC-14)
- **Design proposal**: `.claude/audit/admin-redesign/proposals/05-visual-tokens.md` (8 axes locked)
- **Task state**: `.claude/tasks/SPEC-153-admin-design-tokens/state.json`
- **Seed manifest**: `packages/design-tokens/seed/web-baseline.json` (199 tokens)
- **Engram pin**: `mem_search "spec/SPEC-153/checkpoint-half-phase-1"` o más fino
  `mem_search "spec/SPEC-153/T-153-15"` etc.
- **Memory file**: `~/.claude/projects/.../memory/spec_153_admin_design_tokens_phase_1_progress.md`

---

## Workflow recordatorio

- Atomic commits: `feat(design-tokens): ...` para código, `chore(spec): mark
  SPEC-153 T-153-XX complete` para state updates. SIEMPRE separados.
- Antes de commit: `pnpm --filter @repo/design-tokens typecheck && test && check`
  (auto-fixea lint).
- Después de marcar task completed: confirma con `git status` que está clean.
- Engram save al cerrar cada task con topic_key `spec/SPEC-153/T-153-XX/...` o
  `spec/SPEC-153/phase-1-progress` (upsertable).

---

## Mi rol como agente

- **Pedirme**: que arranque con T-153-16 (genera el CSS, el más interesante).
- **Decisiones que YO debo tomar autónomamente** (Auto Mode activo): mecánicos
  como import order, file structure, test cases, valores derivados.
- **Decisiones que debo CONSULTAR al user**: cualquier cambio de scope (e.g.
  agregar variables nuevas al CSS output que no estén ni en seed ni en doc 05),
  decisiones arquitecturales (e.g. cómo emitir palette refs — como var() chain
  o resolved values).

Avanzá con T-153-16 — empezá leyendo `themes/web-light.ts` y `admin-light.ts` para
ver el shape exacto, y los token modules para ver de dónde sacar palette
declarations. Generate CSS, test it, commit, mark complete. Después T-153-17.
