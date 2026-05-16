---
spec-id: SPEC-139
title: Upload API source maps to Sentry on build
type: fix
complexity: small
status: draft
created: 2026-05-16T04:35:00Z
effort_estimate_hours: 1-3
tags: [api, sentry, source-maps, monitoring, tsup, follow-up, spec-111]
extracted_from: SPEC-111 Sentry config audit (2026-05-16)
---

# SPEC-139: API source maps upload to Sentry

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Configure `apps/api` to emit and upload source maps to Sentry on every production build so that exceptions captured by `@sentry/node` arrive at the Sentry dashboard with stack traces pointing to the original TypeScript source paths (`apps/api/src/...`) instead of the bundled output (`dist/index.js:1:1234`).

**Why now:** Discovered during SPEC-111 Sentry config audit (2026-05-16). The API has `@sentry/node@^10.38.0` and `@sentry/profiling-node@^10.38.0` installed and `Sentry.init({...})` wired in `src/lib/sentry.ts`. Errors and messages DO reach Sentry (confirmed via 2 recent OAuth failure events in the dashboard). But the build (`tsup`) doesn't emit or upload source maps, so any future exception with a real stack trace will be partially readable at best — Node retains function names, but the file paths and line numbers point to the bundled `dist/`.

**Scope:** ONLY api. Web was fixed in SPEC-111. Admin is tracked separately in SPEC-138 (different toolchain — Vite).

### 2. Out of Scope

- Admin source maps upload (SPEC-138).
- Web source maps upload (done in SPEC-111).
- Changes to api's runtime Sentry SDK config (DSN, integrations, sampling, profiling).
- Switching api away from tsup to a different bundler.
- Source maps for the worker processes (cron, newsletter dispatch) IF they share the same bundle — they should be automatically covered by the same upload. If they have separate entrypoints with their own tsup output, audit during T-139-01.

### 3. Approach

The api builds with `tsup`, which doesn't have a native Sentry plugin. Two viable paths:

#### Option A — `@sentry/esbuild-plugin` (preferred)

`tsup` is a thin wrapper around `esbuild`. The `@sentry/esbuild-plugin` integrates by adding it to the `esbuildPlugins` array in `tsup.config.ts`. This is the closest analog to what `@sentry/vite-plugin` does for web/admin.

```ts
// apps/api/tsup.config.ts
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';

export default defineConfig({
  entry: ['src/index.ts', /* workers, etc. */],
  format: ['esm'],
  sourcemap: true,            // <-- enable source map generation
  esbuildPlugins: [
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryEsbuildPlugin({
          org: 'qazuor',
          project: 'hospeda-api',
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })]
      : []),
  ],
});
```

#### Option B — `sentry-cli` post-build script

Run `pnpm sentry-cli sourcemaps upload --org qazuor --project hospeda-api ./dist` as a `postbuild` script in `package.json`. More manual, no Vite/esbuild integration but works for any toolchain.

Pick Option A unless we hit unexpected esbuild plugin incompatibilities.

### 4. Reference Implementation

Web's pattern (canonical reference):

```js
sentry({ org: 'qazuor', project: 'hospeda-web', authToken: process.env.SENTRY_AUTH_TOKEN })
```

API's adaptation (Option A):

```ts
import { defineConfig } from 'tsup';
import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';

export default defineConfig({
  // ... existing config
  sourcemap: true,
  esbuildPlugins: [
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryEsbuildPlugin({
          org: 'qazuor',
          project: 'hospeda-api',
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })]
      : []),
  ],
});
```

### 5. Tasks

| Task | Title | Status |
|---|---|---|
| T-139-01 | Audit api tsup config + identify all entrypoints (main server + workers + cron) | pending |
| T-139-02 | Add `@sentry/esbuild-plugin` dev dependency to `apps/api` | pending |
| T-139-03 | Enable `sourcemap: true` in `apps/api/tsup.config.ts` | pending |
| T-139-04 | Wire `sentryEsbuildPlugin` in `tsup.config.ts` (gated on `SENTRY_AUTH_TOKEN`) | pending |
| T-139-05 | Expand `SENTRY_AUTH_TOKEN` registry entry `apps` to include `api` (so the env var doc covers all 3 apps) | pending |
| T-139-06 | Run `pnpm --filter hospeda-api build` locally with token set + confirm upload | pending |
| T-139-07 | Verify Coolify has `SENTRY_AUTH_TOKEN` in `hospeda-api-prod` and `hospeda-api-staging` (add via `hops env-set api SENTRY_AUTH_TOKEN <value>` + `hops redeploy api` if missing) | pending |
| T-139-08 | Audit Sentry node SDK config for `Sentry.RewriteFrames` integration (optional but improves symbolication) | pending |
| T-139-09 | PR to staging; trigger a deliberate exception (or wait for one to occur) and verify symbolicated stack trace | pending |

### 6. Acceptance Criteria

- [ ] `apps/api/tsup.config.ts` includes the Sentry esbuild plugin conditionally on `SENTRY_AUTH_TOKEN`.
- [ ] `apps/api/tsup.config.ts` has `sourcemap: true`.
- [ ] `pnpm --filter hospeda-api build` log shows source maps uploaded to Sentry when the token is set.
- [ ] Build does NOT error when the token is missing (graceful skip).
- [ ] An exception captured by api in staging shows a stack trace with `apps/api/src/...` paths instead of `dist/index.js:1:1234`.
- [ ] `SENTRY_AUTH_TOKEN` registered for `apps: ['admin', 'api', 'web']` in the env registry.
- [ ] `SENTRY_AUTH_TOKEN` set in Coolify for both api environments.

### 7. Risks

| Risk | Mitigation |
|---|---|
| Source maps embedded in shipped `dist/` could leak source code if the dist files were ever exposed | api `dist/` is never served publicly — it's executed by Node inside the container. Dockerfile copies `dist/` to runtime stage; that's expected. Source maps don't appear in any HTTP-served path. |
| Worker entrypoints (newsletter-dispatch, cron jobs) may have separate `dist/` outputs | Audit in T-139-01. If they share the main `dist/`, single upload covers everything; if separate, repeat the plugin config per entrypoint or unify the builds. |
| esbuild plugin API surface different from Vite's | Confirm in dev. Sentry maintains both packages but they have minor signature drift. |
| Profiling integration `@sentry/profiling-node` uses native code; source maps don't apply | Native profiling stack frames already work via debug symbols — source maps are JS-only. No conflict. |

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-111 Sentry config audit (2026-05-16), alongside SPEC-138 (admin). The 2 OAuth failure events captured in `hospeda-api` over the last 7 days were `Sentry.captureMessage` calls — no stack traces visible. The first time an unexpected exception fires in api production, today, the stack trace will be partially readable (Node keeps function names) but file paths will point to `dist/index.js` instead of source TS, making triage harder than it should be.

### Sentry project info

- Org slug: `qazuor`
- Project slug: `hospeda-api`
- Project ID: `4510829690028032`
- Settings URL: https://qazuor.sentry.io/settings/projects/hospeda-api/

### Existing api Sentry usage

The api init lives in `apps/api/src/lib/sentry.ts` and is called from the bootstrap. It already reads `HOSPEDA_SENTRY_DSN`, `HOSPEDA_SENTRY_RELEASE`, `HOSPEDA_SENTRY_PROJECT`, `HOSPEDA_SENTRY_ENVIRONMENT` from env. These are runtime concerns and unchanged by SPEC-139 — the build-time `SENTRY_AUTH_TOKEN` is a separate variable scoped to the bundler plugin.

### Cross-spec dependencies

- **SPEC-111** (closed) — established source maps upload for `apps/web` (Astro integration). Reference pattern.
- **SPEC-138** — same problem in `apps/admin` (Vite). Can run in parallel with this spec.
