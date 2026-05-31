---
spec-id: SPEC-133
title: Evaluate migrating apps/web from custom Zod env layer to astro:env
type: evaluation
complexity: medium
status: draft
created: 2026-05-15T22:00:00Z
effort_estimate_hours: 2-4 (eval) / 8-16 (implementation if approved)
tags: [evaluation, astro, env, schema, architecture, follow-up, spec-111]
extracted_from: SPEC-111 Astro 6 impact analysis section 4.1
---

# SPEC-133: Evaluate `astro:env` adoption for `apps/web`

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Decide whether `apps/web` should migrate from its current custom Zod-based env validation (`apps/web/src/env.ts` + `apps/web/src/lib/env.ts`) to Astro 6's stable `astro:env` system. Output: a written recommendation (proceed, defer, decline) with concrete reasoning and cost estimate.

**Why now:** Astro 6 promoted `astro:env` from experimental to stable. SPEC-111 brought us to Astro 6, so the option is open for the first time. Before doing more work on the env layer (e.g. SPEC-132 cross-package Zod 4 migration), we want a clear ADR-style decision on whether to keep the custom layer or move to the framework-native one.

**Why a separate spec:** The decision has architectural implications for `@repo/config` (the monorepo env registry SSOT). The eval is light (2-4h) but the implementation is heavy (8-16h). Splitting eval from implementation lets the user kill it early if the trade-offs aren't favorable.

### 2. Out of Scope

- Migration of `apps/api` or `apps/admin` — those are NOT Astro and would need a different solution.
- Replacing `@repo/config` env registry entirely (a registry of metadata for ops + CI gates is still useful even if validation moves to `astro:env`).
- Implementing the migration (only the evaluation; implementation is a follow-up if approved).

### 3. What `astro:env` provides

```ts
// astro.config.mjs
import { defineConfig, envField } from 'astro/config';

export default defineConfig({
  env: {
    schema: {
      HOSPEDA_API_URL: envField.string({ context: 'server', access: 'secret' }),
      PUBLIC_API_URL: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_FEEDBACK_ENABLED: envField.boolean({
        context: 'client',
        access: 'public',
        default: false
      })
    }
  }
});
```

```ts
// In a server-side file (.astro / middleware / API route)
import { HOSPEDA_API_URL } from 'astro:env/server';

// In a React island or browser-side file
import { PUBLIC_API_URL } from 'astro:env/client';
```

Features:
- IDE autocomplete from the schema definitions.
- Build-time validation (build fails before deploy if a required var is missing).
- Automatic context separation (server vars cannot be imported from client modules — compile error).
- Native types (no `as string | undefined` casts).
- Default values and type coercion (boolean, number) built in.

### 4. Trade-off Analysis

#### Wins if we adopt

1. **One fewer abstraction:** delete `apps/web/src/env.ts` (`serverEnvBaseSchema`, `validateWebEnv`, `collectEnv`) and `apps/web/src/lib/env.ts` (`getApiUrl`, `getSiteUrl`, `getAdminUrl`, `getRevalidationSecret`, `getNoindexHosts`, `isLoggingEnabled`, etc.). Replace with direct imports from `astro:env/server` and `astro:env/client`.
2. **No more dual `HOSPEDA_*` / `PUBLIC_*` parallel keys:** the `envField` schema declares context once; the framework handles the split.
3. **Compile-time enforcement of public-vs-server boundary:** the current Biome `noRestrictedImports` rule that prevents `import.meta.env.HOSPEDA_*` from islands becomes redundant.
4. **Build-time validation:** today's `validateWebEnv()` runs at module import time (startup). `astro:env` validates at build time, catching missing prod vars in CI before deploy.
5. **Better DX:** named imports beat `getApiUrl()` function calls and IDE autocompletion is instant.

#### Costs if we adopt

1. **`@repo/config` env registry SSOT becomes a second SSOT.** Today `env-registry.hospeda.ts` is the canonical metadata source (description, secret flag, apps, defaultValue, exampleValue, etc.) and the env-registry CI gate cross-validates against the Zod schema. With `astro:env`, the `envField` declarations duplicate metadata. Three options to resolve:
   - **(a) Single registry generates `astro:env` schema** via a script at build time. Adds tooling complexity.
   - **(b) Keep both in sync manually.** Drift risk; CI gate would need to be rewritten to cross-validate `envField` vs registry.
   - **(c) Deprecate `@repo/config` env-registry entirely for `apps/web`.** Easier but creates per-app asymmetry: api/admin still use the registry, web does not.
2. **`apps/api` and `apps/admin` cannot use `astro:env`.** They are not Astro apps. They will keep using their own Zod schemas + the `@repo/config` registry. The monorepo's "one way to do env" becomes "one way for web, another for everyone else".
3. **Migration touches every file that calls `getApiUrl()` / `getSiteUrl()`** etc. After SPEC-111 batch 3 there are ~25 call sites. All would need rewrites to named imports from `astro:env/*`.
4. **Vendor lock-in:** the custom Zod layer is portable. If we ever migrate `apps/web` to a non-Astro framework, we'd need to rewrite the env layer back. Probability of that happening in next 2 years: low, but non-zero.

### 5. Evaluation Tasks

| Task | Title | Status |
|---|---|---|
| T-133-01 | Build a working POC: define one server-only and one public env var via `astro:env`, consume them, run `pnpm build` | pending |
| T-133-02 | Investigate option (a): script that generates `astro:env` schema from `@repo/config` registry | pending |
| T-133-03 | Score the three SSOT-resolution options (a/b/c) on: maintainability, drift risk, async-with-api/admin asymmetry, build performance | pending |
| T-133-04 | Estimate total migration LOC delta + risk in `apps/web` (delete X lines, modify Y files) | pending |
| T-133-05 | Write the decision: proceed / defer / decline. If proceed, open SPEC-134 for implementation | pending |

### 6. Acceptance Criteria

- [ ] POC builds cleanly with `astro:env` for at least one server + one client var.
- [ ] Each SSOT option (a/b/c) has a one-paragraph evaluation in the spec.
- [ ] Final recommendation is committed with reasoning.
- [ ] If recommendation is "proceed", SPEC-134 follow-up exists with a phased migration plan.

### 7. Risks

| Risk | Mitigation |
|---|---|
| `astro:env` has Astro-internal limitations not covered in docs (e.g. doesn't work with our HOSPEDA_NOINDEX_HOSTS comma-separated string parsing) | The POC will exercise the actual patterns; if a blocker is hit, the recommendation will be "decline" with concrete evidence |
| Underestimating the registry-sync work | Phase 0 the POC should include the script that bridges registry and `astro:env` |

---

## Part 2 — Implementation Notes

### Source

SPEC-111 §4.1 impact report flagged `astro:env` as a "new capability" with cost `L`. User chose to spawn a dedicated evaluation rather than discard or attempt migration in-line.

### Reference

- Astro 6 `astro:env` docs: https://docs.astro.build/en/guides/environment-variables/
- `envField` reference: https://docs.astro.build/en/reference/configuration-reference/#env-options
- Current custom env layer: `apps/web/src/env.ts`, `apps/web/src/lib/env.ts`, `packages/config/src/env-registry.hospeda.ts`

### Cross-spec dependencies

- SPEC-111 (Astro 6 bump) — closed; enabled this option.
- SPEC-132 (Zod 4 cross-package migration) — parallel; if `astro:env` adopted for web, web is no longer in scope for SPEC-132. Other packages still are.
