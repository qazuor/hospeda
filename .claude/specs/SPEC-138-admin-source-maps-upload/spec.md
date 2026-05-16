---
spec-id: SPEC-138
title: Upload admin source maps to Sentry on build
type: fix
complexity: small
status: draft
created: 2026-05-16T04:30:00Z
effort_estimate_hours: 1-2
tags: [admin, sentry, source-maps, monitoring, follow-up, spec-111]
extracted_from: SPEC-111 Sentry config audit (2026-05-16)
---

# SPEC-138: Admin source maps upload to Sentry

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Configure `apps/admin` to upload its production source maps to Sentry on every production build, so that browser errors captured by `@sentry/react` arrive at the Sentry dashboard with symbolicated stack traces (real function names + file paths) instead of minified `chunk-XYZ.js:1:5234` references.

**Why now:** Discovered during SPEC-111 Sentry config audit (2026-05-16). The admin app has `@sentry/react@^10.36.0` installed and `Sentry.init({...})` wired in `src/lib/sentry/sentry.config.ts`, so errors DO arrive at Sentry. But `apps/admin/package.json` lacks `@sentry/vite-plugin` and `apps/admin/vite.config.ts` lacks any source map upload step, so production stack traces are minified — useless for triage.

**Scope:** ONLY admin. The web app was fixed in SPEC-111 (uses `@sentry/astro` which bundles the upload plugin). The api app has the same gap but uses a different toolchain (tsup, not Vite) and is tracked separately in SPEC-139.

### 2. Out of Scope

- API source maps upload (SPEC-139).
- Web source maps upload (done in SPEC-111).
- Changes to admin's runtime Sentry SDK config (DSN, integrations, sampling).
- Inbound filter changes in Sentry dashboard.
- Adding tracing/profiling on admin (separate concern).

### 3. Approach

Mirror the canonical Sentry pattern, same as we did for web:

1. **Install** `@sentry/vite-plugin` as a dev dependency in `apps/admin`.
2. **Add the plugin** to `apps/admin/vite.config.ts` inside the `plugins` array, **only when `SENTRY_AUTH_TOKEN` is set** (so local builds without the token still work — the plugin emits a warning, not an error, when the token is missing).
3. **Hardcode** `org: 'qazuor'` and `project: 'hospeda-admin'` (project slug confirmed via Sentry dashboard URL).
4. **Read** `SENTRY_AUTH_TOKEN` from `process.env` (build-time, not runtime).
5. **Enable** source map generation in `build.sourcemap = 'hidden'` (or `true`) in the Vite config — currently admin may have it off in production.
6. **Register** `SENTRY_AUTH_TOKEN` in `packages/config/src/env-registry.hospeda.ts` with `apps: ['admin', 'web']` (the existing web-only entry needs the array expanded) so the env workflow + docs stay coherent.
7. **Set** `SENTRY_AUTH_TOKEN` in Coolify for `hospeda-admin-prod` and `hospeda-admin-staging` (same token reused across the org's projects — Sentry auth tokens are org-scoped, not project-scoped).

### 4. Reference Implementation (web equivalent)

See `apps/web/astro.config.mjs` after the SPEC-111 PR:

```js
import sentry from '@sentry/astro';

integrations: [
  ...(process.env.PUBLIC_SENTRY_DSN
    ? [sentry({ org: 'qazuor', project: 'hospeda-web', authToken: process.env.SENTRY_AUTH_TOKEN })]
    : []),
  // ...
]
```

For admin (Vite + TanStack Start), the shape is:

```ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: 'hidden', // generate source maps but don't reference them in JS
  },
  plugins: [
    // ... existing plugins
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: 'qazuor',
          project: 'hospeda-admin',
          authToken: process.env.SENTRY_AUTH_TOKEN,
          // release auto-detected from VCS; override if needed:
          // release: { name: process.env.HOSPEDA_GIT_SHA }
        })]
      : []),
  ],
});
```

### 5. Tasks

| Task | Title | Status |
|---|---|---|
| T-138-01 | Add `@sentry/vite-plugin` dev dependency to `apps/admin` | pending |
| T-138-02 | Enable `build.sourcemap = 'hidden'` in `apps/admin/vite.config.ts` | pending |
| T-138-03 | Wire `sentryVitePlugin` in `apps/admin/vite.config.ts` (gated on `SENTRY_AUTH_TOKEN`) | pending |
| T-138-04 | Expand `SENTRY_AUTH_TOKEN` registry entry to include `apps: ['admin', 'web']` | pending |
| T-138-05 | Run `pnpm --filter hospeda-admin build` locally with token set + confirm "Successfully uploaded source maps" in log | pending |
| T-138-06 | Verify Coolify has `SENTRY_AUTH_TOKEN` in `hospeda-admin-prod` and `hospeda-admin-staging` (add if missing via `hops env-set admin SENTRY_AUTH_TOKEN <value>` + `hops redeploy admin`) | pending |
| T-138-07 | PR to staging; trigger a deliberate error in admin staging post-deploy and verify symbolicated stack trace in Sentry dashboard | pending |

### 6. Acceptance Criteria

- [ ] `apps/admin/vite.config.ts` includes the Sentry Vite plugin conditionally on `SENTRY_AUTH_TOKEN`.
- [ ] `pnpm --filter hospeda-admin build` log shows `[sentry-vite-plugin] Info: Successfully uploaded source maps to Sentry` when the token is set.
- [ ] `pnpm --filter hospeda-admin build` completes successfully (does NOT error) when the token is absent — just emits a warning.
- [ ] A test error captured by admin in staging shows a stack trace with real source paths (`apps/admin/src/...`) instead of `chunk-abc123.js:1:5234`.
- [ ] `SENTRY_AUTH_TOKEN` registered in the env registry with `apps: ['admin', 'web']`.
- [ ] `SENTRY_AUTH_TOKEN` set in Coolify for both admin environments.

### 7. Risks

| Risk | Mitigation |
|---|---|
| Enabling `sourcemap = 'hidden'` could leak source maps via crafted requests | `'hidden'` mode does NOT serve them publicly — they're emitted to disk but not referenced. The upload plugin uploads them to Sentry then leaves them on disk in `dist/`. Dockerfile already excludes source maps from the final image since they're not in the public output of TanStack Start's build. Audit `apps/admin/Dockerfile` to confirm `.map` files aren't copied to the runtime stage. |
| Token leaked in build logs if `console.log`'d accidentally | Token only used inside `sentryVitePlugin({ authToken: process.env.SENTRY_AUTH_TOKEN })`. Plugin internals don't print it. |
| Per-app token vs org token confusion | `@sentry/cli` accepts org-scoped tokens — same token works for `hospeda-web`, `hospeda-admin`, `hospeda-api`. No need to create separate tokens. |
| Build time increase | Plugin uploads in parallel with build finalization; observed ~5-10s overhead on `apps/web` (acceptable). |

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-111 Sentry config audit (2026-05-16). The audit was driven by the SPEC-111 PR introducing source maps upload for `apps/web`. While verifying that the 3 apps' Sentry setups were coherent, it became clear that admin and api had been silently shipping un-symbolicated stack traces to Sentry since they were first instrumented.

Evidence from Sentry dashboard (qazuor org, last 7 days):
- `hospeda-admin`: 5 events (all CSP violations — no JS stack traces captured recently). Cannot confirm symbolication status until a JS exception arrives, but the pipeline is definitely not set up.
- `hospeda-web` (before SPEC-111): 5 occurrences of `TypeError: manifest.serverIslandMap?.get is not a function` — all with paths like `/repo/apps/web/dist/server/chunks/middleware_NeQFZ5GU.mjs` (un-symbolicated). This is the canonical example of what admin's situation looks like for any real exception.

### Sentry project info

- Org slug: `qazuor`
- Project slug: `hospeda-admin`
- Project ID: `4510829690814464`
- Settings URL: https://qazuor.sentry.io/settings/projects/hospeda-admin/

### Dependency

Use the same `@sentry/vite-plugin` version family that comes with `@sentry/astro@10.40.0` in the web app (currently `^4.x`). Avoid divergent versions across apps where possible.

### Cross-spec dependencies

- **SPEC-111** (closed) — established the pattern in `apps/web`; this spec replicates it in `apps/admin`.
- **SPEC-139** — same problem in `apps/api` but different toolchain (tsup). Can run in parallel with this spec.
