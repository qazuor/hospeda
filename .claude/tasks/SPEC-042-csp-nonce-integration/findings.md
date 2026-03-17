# SPEC-042: CSP Implementation Findings

## Date: 2026-03-16

## Web App (Astro) - Phase 1

### CSP Meta Tag Generation

- Build generates `<meta http-equiv="content-security-policy">` with 16 SHA-256 script hashes
- `'strict-dynamic'` is present in `script-src`
- All custom directives (connect-src, worker-src, child-src, etc.) are correctly included
- CSP is only emitted in build+preview mode, NOT in dev mode (as expected)

### Style Hashes Risk (Confirmed)

Astro emits 5 SHA-256 style hashes in the meta tag's `style-src` even though `styleDirective` is NOT configured. This is Astro Issue #14798 (open, no ETA).

**Impact**: CSP2+ browsers will ignore `'unsafe-inline'` in `style-src` when hashes are present. This means Sentry Session Replay (rrweb) inline styles may be blocked by the meta tag policy, even though the HTTP header includes `'unsafe-inline'`.

**Status**: Accepted risk for Phase 1. Session Replay impact needs verification in staging with Sentry configured. Error reporting and performance monitoring are NOT affected.

**Mitigation options** (if Session Replay breaks):

1. Disable Session Replay until Astro Issue #14798 is resolved
2. Remove `experimental.csp` entirely and rely on HTTP-header-only CSP (weaker for scripts but functional for styles)

### MercadoPago Antifraud Script

The `@qazuor/qzpay-core` and `@qazuor/qzpay-react` packages are NOT installed in node_modules (not yet integrated). No `security.js` antifraud script is loaded. The `'unsafe-eval'` in admin CSP is precautionary and can be removed if verified unnecessary after QZPay integration.

## Admin App (TanStack Start) - Phase 1

### TanStack Start 1.131.26 Limitations

- `ssr.nonce` does NOT exist in this version (requires >= 1.132.0 + Vite 7)
- `createStart()` does NOT exist (replaced with `registerGlobalMiddleware`)
- Middleware runs on server function calls only, NOT on initial SSR page loads
- Full HTTP-level CSP coverage requires TanStack Start >= 1.132.0 (Vite 7 migration)

### API Adaptations for v1.131.26

| Spec original | Actual implementation |
|---|---|
| `createStart({ requestMiddleware })` | `registerGlobalMiddleware({ middleware })` |
| `getResponseHeaders/setResponseHeaders` | `setResponseHeader` (single header) |
| `createMiddleware()` | `createMiddleware({ type: 'function' })` |
| `ssr: { nonce: getCspNonce() }` | Skipped (not available) |
| `getCspNonce` via `createIsomorphicFn` | Skipped (not available) |

### Phase 2 Blockers

1. **Vite 7 migration** required for TanStack Start >= 1.132.0
2. Vite 7 migration affects entire monorepo (new spec needed)
3. After Vite 7: add `ssr.nonce`, `createStart`, request-level middleware
4. Only then can Phase 2 (enforcement) be enabled for admin

## Build Issues (Pre-existing, Unrelated)

- Web: Vercel adapter NFT step fails (missing `minimatch` dependency)
- Admin: Build fails on env validation (`VITE_API_URL` not set)
- Both are pre-existing issues, not caused by CSP changes

## Next Steps

1. Deploy to staging and verify in browser (both apps)
2. Check Sentry Session Replay behavior with CSP enabled
3. Create new spec for Vite 7 migration (prerequisite for Phase 2)
4. Monitor CSP violation reports in Sentry after deployment
5. After 14+ days with zero unexpected violations, proceed to Phase 2
