---
spec-id: SPEC-218
title: astro check in web CI — load the App.Locals augmentation, clean .astro type errors, gate typecheck
type: improvement
complexity: medium
status: draft
created: 2026-06-11T00:00:00Z
---

# SPEC-218 — `astro check` in web CI

## Overview

**Goal.** Make `apps/web` actually typecheck its `.astro` files in CI, so page-logic
type bugs are caught before they ship.

**Motivation.** The web typecheck gate is `astro sync && tsc --noEmit --project ./tsconfig.json`.
`tsc` does **not** look inside `.astro` frontmatter — only `.ts`/`.tsx`. So type errors
living in page frontmatter (the most common place for data-shape logic) ship green. This is
a recurring, already-felt class of bug:

- **W6** (SPEC-213): `result.data.total` read off the wrong shape on a destinations page —
  a `.astro` frontmatter type error CI never saw.
- **W8 / W4**: same family — wrong response shape consumed in `.astro` page logic.

Running `astro check` (which DOES typecheck `.astro`) on the current tree surfaces
**185 errors across 484 files** (plus 63 hints) that `tsc --noEmit` is blind to.

**Success criteria.**

1. `pnpm --dir apps/web exec astro check` exits **0** errors.
2. `astro check` is wired into the web typecheck step so CI fails on any future `.astro`
   type error.
3. No behavioral change to the app — these are type-only fixes plus a CI wiring change.

### Root cause of the 117-error cluster (verified, not assumed)

**117 of the 185 errors are one cluster:** `Property 'locale' / 'user' / 'cspNonce' does
not exist on type 'Locals'` (57 + 53 + 7). The intuitive guess — "`App.Locals` is not
augmented" — is **wrong**. The augmentation **already exists** and is correct, in
`apps/web/src/env.d.ts`:

```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
declare namespace App {
    interface Locals {
        locale: 'es' | 'en' | 'pt';
        user: { ... } | null;
        cspNonce: string;
    }
}
```

The real cause is a **tsconfig program-membership bug**: `apps/web/tsconfig.json` uses
explicit-extension `include` globs:

```json
"include": [".astro/types.d.ts", "src/**/*.ts", "src/**/*.tsx", "src/**/*.astro", "integrations/**/*.ts"]
```

TypeScript does **not** pull a global-ambient `.d.ts` into the program via these globs, and
because nothing `import`s or `/// <reference>`s `env.d.ts`, it is **dropped from the program
entirely**. Verified three ways in the SPEC-218 worktree:

- `tsc --noEmit --listFilesOnly` and `tsc --showConfig`: `apps/web/src/env.d.ts` is **absent**
  from the resolved file set (only `node_modules/**/env.d.ts` appear).
- A `@ts-expect-error` probe (`const a: string = (l as App.Locals).locale`) compiles clean
  under plain `tsc` — i.e. the augmentation is dead under `tsc` too, not just `astro check`.
  The app only builds because the middleware **casts** locals
  (`(context.locals as { locale: typeof locale }).locale = …`), so no `.ts`/`.tsx` ever relies
  on the augmented type. `.astro` pages read `Astro.locals.locale` directly and were never
  typechecked.
- Neither adding `"src/env.d.ts"` literally to `include` nor adding a `"src/**/*.d.ts"` glob
  pulls it in. **Only `"files": ["src/env.d.ts"]` does.**

**Validated fix:** adding `"files": ["src/env.d.ts"]` to `apps/web/tsconfig.json` drops
`astro check` from **185 → 68 errors** (the 117 `Locals` errors → **0**), with no source
changes. The remaining 68 are genuine `.astro` type bugs (the W6/W8 class) handled in Phase 2.

**Baseline.** `astro check` on `origin/staging` @ 2a6292ba6 (SPEC-218 worktree base),
2026-06-11: 185 errors / 484 files / 63 hints. After the Phase-1 fix: 68 errors / 63 hints.

---

## User Stories & Acceptance Criteria

### US-1 — The existing `App.Locals` augmentation is actually loaded

GIVEN `apps/web/src/env.d.ts` declaring `App.Locals` with `locale`, `user`, `cspNonce`,
WHEN `tsc` / `astro check` build the program,
THEN `env.d.ts` is a program input (verifiable via `tsc --listFilesOnly`) and
`Astro.locals.locale` / `.user` / `.cspNonce` resolve with no `ts(2339)` — clearing all 117
`Locals` errors.

### US-2 — `.astro` type errors are caught in CI

GIVEN a `.astro` page with a frontmatter type error (e.g. reading a property off the wrong
response shape),
WHEN CI runs the web typecheck step,
THEN the build fails with the `astro check` diagnostic pointing at the offending line.

### US-3 — The tree is clean before the gate is armed

GIVEN the full `apps/web` source,
WHEN `astro check` runs,
THEN it reports **0 errors** (the 63 hints may remain; they do not fail the gate).

### US-4 — The gate is permanent and can't silently regress

GIVEN the web typecheck script and the CI typecheck job,
WHEN either runs locally or in CI,
THEN `astro check` is part of it, so a regression cannot merge green. A guard also keeps the
`env.d.ts` augmentation from silently falling out of the program again.

---

## Technical Approach

### Phase 1 — Foundation: load the `App.Locals` augmentation (kills 117) + guard

The augmentation already exists and is correct. The fix is to put `env.d.ts` into the
program.

1. **`apps/web/tsconfig.json`** — add the augmentation file to `files`:

   ```json
   "files": ["src/env.d.ts"],
   ```

   `files` is additive to `include` (program = `files` ∪ `include` − `exclude`), so no other
   src globbing changes. This is the surgical fix that respects the project's deliberate
   explicit-extension `include`. (Rejected alternatives, both proven NOT to load it: adding
   `"src/env.d.ts"` to `include`, or a `"src/**/*.d.ts"` glob. The broad astro-recommended
   `include: ["**/*"]` would work but widens the program beyond the project's intent.)
2. **Verify**: `tsc --listFilesOnly` lists `apps/web/src/env.d.ts`; `astro check` error count
   drops to ~68 with 0 `Locals` errors. Record before/after in `progress.md`.
3. **Regression guard** (US-4): a tiny typecheck-time guard so this can't silently break
   again — e.g. a `.ts` unit/type test asserting `App.Locals` has `locale`/`user`/`cspNonce`
   (a `satisfies` / `expectTypeOf`-style assertion that fails to compile if the augmentation
   isn't loaded). Lives in `apps/web` and runs under the same typecheck. This is cheaper and
   more durable than relying on review to catch a dropped `files` entry.

### Phase 2 — Cleanup: the remaining 68 real `.astro` errors

After Phase 1, re-run `astro check` and bucket by diagnostic code. Baseline buckets
(re-confirm exact counts at impl time):

- **ts(2322)** type-assignment mismatches — **22**
- **ts(2339)** property-does-not-exist (now NON-`Locals`: real wrong-shape reads, the W6/W8
  class) — **21**
- **ts(2345)** argument-type mismatches — **9**
- **ts(7006)** implicit-`any` parameters — **6**
- **ts(2352)** unsafe conversions — **5**
- **ts(2724)** no exported member (wrong import name) — **2**
- **ts(2353)** object-literal/interface gaps incl. `BreadcrumbItem.href` — **2**
- **ts(2358)** `instanceof` LHS — **1**

For each: **fix the real type**, never suppress. No `any`, no `@ts-ignore` / `@ts-expect-error`
to reach zero. ts(2339)/ts(2322)/ts(2345) are the dangerous ones — several are likely real
runtime bugs (wrong response shape consumed). When the shape is genuinely wrong, fix the
logic and add/adjust a test; that is exactly the bug class this gate exists to catch.
ts(7006) is mechanical (add the param type). Interface gaps (ts2353) are fixed at the
canonical type definition (`@repo/schemas` / the component's type), not at the call site.

Group into atomic tasks by **directory or error family** so each is independently
reviewable and revertable. Files with the most errors (impl ordering hint):
`AccountLayout.astro` (11), `alojamientos/mapa.astro` (7), `Footer.astro` (7),
`publicar/nueva.astro` (6), `publicaciones/[slug].astro` (6), `alojamientos/[slug].astro` (6),
`destinos/index.astro` (4), `alojamientos/index.astro` (4), `BaseLayout.astro` (5).

### Phase 3 — Wire `astro check` into the gate (LAST, only at 0 errors)

Only once `astro check` is 0:

1. Update the `typecheck` script in `apps/web/package.json`. Current:
   `astro sync && tsc --noEmit --project ./tsconfig.json`.
   New: `astro sync && astro check && tsc --noEmit --project ./tsconfig.json` (keep `tsc` —
   `astro check` covers `.astro`, `tsc` is the established gate for `.ts`/`.tsx`; keep both
   unless verified redundant).
2. Confirm the monorepo CI typecheck job (turbo `typecheck` pipeline) runs the updated web
   `typecheck` script with no extra wiring. The job calls the package script by name, so
   updating the script is sufficient — verify.
3. Hint policy: `astro check` exits non-zero on **errors only** by default (the 63 hints do
   not fail it). Confirm and document; do not add `--minimumFailingSeverity` to fail on hints.

### Patterns / constraints

- Type-only changes; **zero runtime/behavior change** in Phases 1-2 (except where a ts(2322)/
  ts(2339) turns out to be a real bug — then fix + test).
- No `any`, no suppression directives to hit zero.
- Reuse canonical types (`@repo/i18n` locale, the auth user type, `@repo/schemas` interfaces);
  never re-declare a shape that already exists (Single Source of Truth).

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| A "type-only" fix masks a real runtime bug (the error was correct) | Medium | For each ts(2322)/ts(2339)/ts(2345), confirm the runtime is actually fine; if the shape is genuinely wrong, fix the logic + add a test (the W6-class the gate exists to catch) |
| `env.d.ts` silently dropped from the program again (someone edits `files`/`include`) | Medium | Phase-1 regression guard: a type assertion that fails to compile if `App.Locals` isn't loaded |
| `astro check` slower than `tsc` → CI time grows | Low | Runs in the existing typecheck job; measure delta, acceptable for the coverage gained |
| New `.astro` errors appear between baseline and gate-arming (rebase) | Low | Re-run `astro check` immediately before Phase 3; fix any new ones before arming |
| `files` + `include` interaction surprises | Low | Verified: program = union; all 484 files + env.d.ts present after the change |

## Out of Scope

- Fixing `astro check` **hints** (the 63 hints) — only errors must reach 0. A follow-up may
  address hints.
- Admin or API typecheck (admin uses `tsc` over `.tsx`; this is web-`.astro`-specific).
- Refactoring the web middleware (its locals casts stay; only the augmentation loading is fixed).
- Any new runtime feature.

## Suggested Tasks (phased)

- **Phase 1 (foundation)**: add `"files": ["src/env.d.ts"]` to `apps/web/tsconfig.json`;
  verify env.d.ts in program + 117 `Locals` errors cleared (185→68). 1 task.
- **Phase 1 (guard)**: add the compile-time `App.Locals` regression assertion. 1 task.
- **Phase 2 (cleanup)**: one task per error family / directory bucket — (a) ts(7006) implicit
  any [mechanical], (b) ts(2724)/ts(2353) import + interface gaps, (c) ts(2322) type-assign,
  (d) ts(2339)/ts(2345) wrong-shape reads [check for real bugs], (e) ts(2352)/ts(2358) tail.
  Each verifies its bucket → 0.
- **Phase 3 (verify)**: confirm `astro check` exits 0 on the full tree. 1 task.
- **Phase 3 (gate)**: wire `astro check` into the web `typecheck` script; confirm CI picks it
  up; document hint policy. 1 task — depends on the verify task being green.
- **Docs**: note in `apps/web` CLAUDE.md / docs that `.astro` is now typechecked, why (the
  W6-class bug), and that `env.d.ts` MUST stay in `tsconfig.files`.

## Internal Review Notes

- **Source finding:** engram #4807 (2026-06-11) — measured baseline, then root-caused to the
  tsconfig program-membership bug (not a missing augmentation). The 117 number was right; the
  cause in the original note was corrected.
- **Why its own spec:** too many pre-existing errors to fold into SPEC-213's testing change;
  systemic and autonomous (no product decisions), prevents the W6/W8/W4 bug class.
- **Verified in worktree** `../hospeda-spec-218-astro-check-web-typecheck` (base
  `origin/staging` 2a6292ba6): Astro 6.3.3, TS 5.9.3. Fix validated end-to-end (185→68,
  0 `Locals` errors) before this spec was written.
- **Open question for impl:** whether `tsc --noEmit` stays alongside `astro check` in the
  `typecheck` script (default: keep both) and the exact monorepo CI entry point that calls
  the web `typecheck` script (Phase 3 wiring point).
