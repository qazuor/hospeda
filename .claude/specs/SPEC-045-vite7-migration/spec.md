# SPEC-045: Vite 7 Migration for TanStack Start

## Problem Statement

The admin app (`apps/admin`) runs TanStack Start 1.131.26 on Vite 6.4.1. Upgrading to TanStack Start >= 1.132.0 is required to unlock `ssr.nonce` support (needed by SPEC-042 for CSP enforcement) and `createStart()` for HTTP-level request middleware. TanStack Start 1.132.0+ drops Vite 6 support and requires Vite >= 7.0.0.

This is a prerequisite for SPEC-042 (CSP Nonce/Hash Integration) to move from report-only to enforcement mode.

## Current State

| Package | Current Version |
|---|---|
| `vite` | 6.4.1 (devDependencies) |
| `@vitejs/plugin-react` | 4.7.0 (deps) + 4.3.4 (devDeps) |
| `@tanstack/react-start` | 1.131.26 |
| `@tanstack/react-router` | 1.131.26 |
| `@tanstack/react-router-devtools` | 1.131.26 |
| `@tanstack/react-router-ssr-query` | 1.131.26 |
| `@tanstack/router-plugin` | 1.131.26 |
| `@tanstack/react-query` | 5.59.20 |
| `@tailwindcss/vite` | 4.1.12 |
| `tailwindcss` | 4.1.12 |

## Breaking Changes Summary

### 1. Vite Plugin: `@vitejs/plugin-react` removed

TanStack Start >= 1.132.0 internalizes the React plugin. The `react()` plugin call and `customViteReactPlugin: true` flag must both be removed from `vite.config.ts`.

**Before:**
```ts
tanstackStart({ customViteReactPlugin: true }),
react(),
```

**After:**
```ts
tanstackStart(),
```

### 2. `createStartHandler` API change

The curried pattern is replaced with a direct callback.

**Before (`server.ts`):**
```ts
const handler = createStartHandler({ createRouter });
export default defineHandlerCallback(async (event) => {
    const startHandler = await handler(defaultStreamHandler);
    return startHandler(event);
});
```

**After:**
```ts
export default createStartHandler(({ request }) => {
    const router = createRouter();
    return defaultStreamHandler({ request, router });
});
```

### 3. `getWebRequest()` renamed to `getRequest()`

Simple rename across all call sites.

### 4. `registerGlobalMiddleware` replaced by `createStart()`

Server function middleware registration moves from `registerGlobalMiddleware` to the `createStart()` API which also supports HTTP request middleware.

**Before (`start.ts`):**
```ts
import { registerGlobalMiddleware } from '@tanstack/react-start';
registerGlobalMiddleware({ middleware: [cspMiddleware] });
```

**After:**
```ts
import { createStart } from '@tanstack/react-start';
export const start = createStart({
    serverFnMiddleware: [cspMiddleware],
    // requestMiddleware can be added here for SPEC-042 Phase 2
});
```

### 5. `ssr.nonce` support (new)

TanStack Start >= 1.132.0 accepts an `ssr.nonce` option in the router config via `createIsomorphicFn`. This is the SPEC-042 enabler but is NOT part of this spec's scope (listed here for context only).

## Files to Modify

| File | Change |
|---|---|
| `apps/admin/package.json` | Bump vite to ^7.0.0, bump all @tanstack/* to >= 1.132.x, remove `@vitejs/plugin-react` from both deps and devDeps. Check @tanstack/react-query peer dep (may need >= 5.90.0). |
| `apps/admin/vite.config.ts` | Remove `import react from '@vitejs/plugin-react'`, remove `react()` plugin call, remove `customViteReactPlugin: true` from `tanstackStart()`. |
| `apps/admin/src/server.ts` | Rewrite to new `createStartHandler` direct API (non-curried). Remove `defineHandlerCallback`. |
| `apps/admin/src/start.ts` | Replace `registerGlobalMiddleware` with `createStart()`. **CSP Phase 2**: Add `requestMiddleware: [cspMiddleware]` to cover SSR responses (GAP-042-13/21). <!-- Added: CSP Phase 2 requirements from GAP-042 audit, 2026-03-17 --> |
| `apps/admin/src/middleware.ts` | No API changes expected (still uses `createMiddleware`). Verify compatibility. |
| `apps/admin/src/lib/auth-session.ts` | Rename `getWebRequest()` to `getRequest()`. Update import. |
| `apps/admin/src/router.tsx` | Remove `import './start'` side-effect (if `createStart` replaces it). Verify middleware registration path. **CSP Phase 2**: Add `getCspNonce` via `createIsomorphicFn()`, pass `ssr: { nonce }` to router config, emit nonce `<meta>` tag via `HeadContent`. <!-- Added: CSP Phase 2 requirements from GAP-042 audit, 2026-03-17 --> |

## Dependency Compatibility

| Package | Concern | Mitigation |
|---|---|---|
| `@tailwindcss/vite` 4.1.12 | Must support Vite 7 | Check release notes. Tailwind CSS v4 actively tracks Vite. Likely compatible. |
| `vite-tsconfig-paths` 5.1.4 | Must support Vite 7 | Check. May need bump. |
| `vitest` ^3.1.3 | Uses Vite internally | Vitest 3.x should support Vite 7. Verify. |
| `better-auth` | Custom Vite plugin workaround in vite.config.ts | The `fix-better-auth-ssr-optimize` plugin accesses internal Vite config. May break with Vite 7 internals. Test carefully. |
| `@sentry/react` | No Vite dependency | No impact. |
| Astro (`apps/web`) | Uses its own bundled Vite. No direct Vite dep in web package.json. | No impact. Web app is isolated. |

## Risks and Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| `better-auth` Vite plugin workaround breaks | HIGH | The `fix-better-auth-ssr-optimize` plugin patches Vite internals (`config.environments`). Test auth flow end-to-end after migration. May need rewrite or removal if Vite 7 fixes the underlying issue. |
| `manualChunks` Rollup config incompatible | MEDIUM | Vite 7 may change Rollup version or chunking behavior. Verify build output sizes and chunk names. |
| TanStack Start 1.132.x has additional undocumented breaking changes | MEDIUM | Pin to exact version (not range). Read full changelog between 1.131.26 and target version. Run full test suite + manual smoke test. |
| `vite-tsconfig-paths` incompatible with Vite 7 | LOW | Check compatibility. Alternative: use Vite's native `resolve.alias` (already configured). Could drop plugin if needed. |
| pnpm-lock.yaml conflicts with other in-flight branches | LOW | Coordinate merge timing. Rebase and regenerate lockfile. |
| `getCspNonce` API differs between TanStack versions | MEDIUM | The `createIsomorphicFn` + `getGlobalStartContext` pattern is documented in SPEC-042 but may have changed across versions. Pin to a specific TanStack version and verify the actual API surface before implementing nonce injection. <!-- Added: CSP Phase 2 requirements from GAP-042 audit, 2026-03-17 --> |
| SSR nonce injection breaks hydration | MEDIUM | If the server-rendered nonce and client-read nonce mismatch, React hydration errors will occur. Test with `NODE_ENV=production` build and verify no hydration warnings in browser console. <!-- Added: CSP Phase 2 requirements from GAP-042 audit, 2026-03-17 --> |

## Implementation Strategy

1. **Create a feature branch** from main
2. **Bump versions** in `apps/admin/package.json` (Vite 7, TanStack >= 1.132.x, remove @vitejs/plugin-react)
3. **Run `pnpm install`** to regenerate lockfile
4. **Apply code changes** to the 5-6 files listed above
5. **Verify dev server starts** (`pnpm dev:admin`)
6. **Verify build succeeds** (`pnpm build` from root)
7. **Run existing tests** (`pnpm test` from root)
8. **Manual smoke test**: Login flow, page navigation, server functions, CSP headers still present in report-only mode
<!-- Added: CSP Phase 2 requirements from GAP-042 audit, 2026-03-17 -->
9. **Wire CSP nonce** (separate commit): Implement `getCspNonce` in `router.tsx`, add `requestMiddleware` in `start.ts`
10. **Write CSP tests**: Nonce injection on server and client paths, SSR response headers
11. **Verify CSP on SSR**: `curl -I localhost:3000/` must return CSP header with valid nonce
12. **Verify Vercel deployment** (preview deploy)

<!-- Added: CSP Phase 2 requirements from GAP-042 audit, 2026-03-17 -->
## CSP Phase 2 Enablers (Post-Migration)

Once the Vite 7 + TanStack Start upgrade lands, the following CSP items from GAP-042 become **unblocked**. These MUST be implemented as part of this spec (they are tightly coupled to the migration changes and cannot be deferred without leaving the admin app in a broken CSP state).

### GAP-042-19: TanStack Start Version Requirements

- **Current**: 1.131.26
- **Minimum required**: >= 1.133.12 (contains the `ssr.nonce` fix from PR #5522)
- **Recommended**: >= 1.166.0 (includes `setResponseHeaders` workaround for Issue #5407)
- The TanStack version bump MUST be a **separate commit** from the Vite 7 bump for rollback independence.

### GAP-042-18: Implement `getCspNonce` in `router.tsx`

After upgrading TanStack Start, wire up the nonce pipeline:

1. Create `getCspNonce` using `createIsomorphicFn()`:
   - **Server side**: read nonce from `getGlobalStartContext()`.
   - **Client side**: read nonce from `<meta property="csp-nonce" content="{nonce}">`.
2. Pass `ssr: { nonce: getCspNonce() }` to `createRouter()`.
3. Ensure `HeadContent` emits `<meta property="csp-nonce" content="{nonce}">` so the client can hydrate it.

**File**: `apps/admin/src/router.tsx`

### GAP-042-21: Migrate from `registerGlobalMiddleware` to `createStart`

Replace the current side-effect registration:

```ts
// BEFORE (start.ts)
registerGlobalMiddleware({ middleware: [cspMiddleware] });
```

With the new API that supports **both** server function and HTTP request middleware:

```ts
// AFTER (start.ts)
export const start = createStart({
    serverFnMiddleware: [cspMiddleware],
    requestMiddleware: [cspMiddleware],
});
```

Adding `requestMiddleware` is what enables GAP-042-13 below.

**File**: `apps/admin/src/start.ts`

### GAP-042-13: Admin SSR CSP Coverage (CRITICAL)

**Problem**: Currently the CSP middleware only covers server function responses. The initial SSR page load (HTML document) has **ZERO CSP headers**. This means the very first response a browser receives is unprotected.

**Solution**: After migrating to `createStart({ requestMiddleware })`, the CSP middleware will intercept ALL responses including SSR-rendered HTML. No additional code beyond GAP-042-21 is needed.. the middleware itself already generates the correct headers.

**Verification**: `curl -I https://admin.hospeda.com/` must return `Content-Security-Policy` (or `Content-Security-Policy-Report-Only`) header.

## Acceptance Criteria

- [ ] `apps/admin` runs on Vite >= 7.0.0 and TanStack Start >= 1.132.0
- [ ] `@vitejs/plugin-react` is fully removed (not in deps or devDeps)
- [ ] `pnpm dev:admin` starts without errors
- [ ] `pnpm build` completes without errors (admin app builds successfully)
- [ ] All existing tests pass (`pnpm test`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (biome)
- [ ] Auth flow works (login, session validation, protected routes)
- [ ] Server functions work (data loading, mutations)
- [ ] CSP Report-Only headers still present on server function responses
- [ ] No regressions in chunk sizes (build output within 20% of current)
- [ ] `apps/web` and `apps/api` are unaffected (no changes needed)
<!-- Added: CSP Phase 2 requirements from GAP-042 audit, 2026-03-17 -->
- [ ] CSP middleware covers SSR initial page loads (not just server functions)
- [ ] CSP header present on ALL admin responses (verify with `curl -I` to root URL)
- [ ] `ssr.nonce` is passed to `createRouter()` and nonce appears in rendered `<script>` tags
- [ ] `getCspNonce()` returns correct nonce on both server and client
- [ ] All existing CSP tests still pass
- [ ] New tests cover nonce injection via `getCspNonce` (server and client paths)
- [ ] TanStack Start version bump is in a separate commit from the Vite 7 bump

## Out of Scope

- ~~**CSP enforcement mode** (SPEC-042 Phase 2). This spec only migrates the infrastructure. Adding `ssr.nonce` to the router and switching to enforcement is SPEC-042's job.~~ **MOVED IN SCOPE** (2026-03-17): `ssr.nonce` wiring, `getCspNonce`, and `requestMiddleware` are now part of this spec. See "CSP Phase 2 Enablers" section. Switching from Report-Only to full enforcement remains in SPEC-042.
- ~~**HTTP request middleware for CSP**. The `createStart({ requestMiddleware })` capability is enabled by this migration but actually wiring it up belongs to SPEC-042.~~ **MOVED IN SCOPE** (2026-03-17): See GAP-042-21 above.
- **Astro/web app Vite changes**. The web app uses Astro's bundled Vite and has no direct Vite dependency. Not affected.
- **API app changes**. Hono-based, no Vite dependency. Not affected.
- **Vitest major version upgrade**. Only bump if required for Vite 7 compat.
- **TanStack Query major version upgrade**. Only bump the minor/patch if needed to satisfy peer deps.

<!-- Added: Cross-reference execution order, 2026-03-17 -->
## CSP Phase 2 Execution Chain

SPEC-045 is Phase B2 in the CSP enforcement chain. It runs in PARALLEL with SPEC-047 (Phase B1).

### Execution Order

| Phase | Spec | Scope | Depends On | Status |
|-------|------|-------|------------|--------|
| **A** | **SPEC-042** | CSP Phase 1 Report-Only for web + admin | None | Completed |
| **B1** | **SPEC-047** | Remove `'unsafe-inline'` from web `script-src` | SPEC-042 | Draft |
| **B2** | **SPEC-045** (this spec) | Vite 7 migration + admin nonce wiring | SPEC-042 | Draft |
| **C** | **SPEC-046 §1B** | Apply 8 quick-win CSP directive fixes | SPEC-045 | Draft |
| **D** | **SPEC-046** | 14-day observation period on staging | SPEC-045 + SPEC-047 + quick wins | Draft |
| **E** | Phase 2 switch | Change Report-Only to enforcement | SPEC-046 passing | — |

> **This spec is on the CRITICAL PATH.** SPEC-046 cannot begin its observation period until SPEC-045 is complete, because admin CSP headers on SSR page loads (GAP-042-13) depend on the `createStart({ requestMiddleware })` API only available after this migration.

### What This Spec Unblocks

Once SPEC-045 is complete, these previously blocked items become available:
- **GAP-042-13**: Admin SSR initial page load gets CSP headers (CRITICAL)
- **GAP-042-18**: `getCspNonce()` functional in router.tsx
- **GAP-042-19**: TanStack Start >= 1.133.12 with `ssr.nonce` support
- **GAP-042-21**: `createStart({ requestMiddleware })` replaces `registerGlobalMiddleware`
- **SPEC-046 §1B**: Quick-win fixes for admin CSP directives

### Parallel Track

SPEC-047 (web unsafe-inline removal) can execute simultaneously with this spec. They affect different apps:
- **SPEC-045**: `apps/admin/` only
- **SPEC-047**: `apps/web/` only

No merge conflicts expected.

### References

- Origin spec: `.claude/specs/SPEC-042-csp-nonce-integration/spec.md`
- Gap analysis: `.claude/specs/specs-gaps-042.md` (38 gaps, 3 audits)
- Next in chain: `.claude/specs/SPEC-046-csp-post-deploy-verification/spec.md`
- Parallel track: `.claude/specs/SPEC-047-csp-unsafe-inline-removal/spec.md`
