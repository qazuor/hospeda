/**
 * Isomorphic CSP nonce reader for the router's `ssr.nonce` option (HOS-33
 * T-006 / GAP-042-18). Extracted from `router.tsx` into its own module so it
 * can be unit-tested without importing the generated route tree (and
 * everything `__root.tsx` initializes at module scope — Sentry, PostHog,
 * env validation).
 *
 * @see ../router.tsx
 */

import { createIsomorphicFn, getGlobalStartContext } from '@tanstack/react-start';

/**
 * Selector for the `<meta property="csp-nonce" content="...">` tag that
 * TanStack Router's `HeadContent` / `useTags` automatically emits whenever
 * `router.options.ssr.nonce` is set.
 *
 * HOS-33 T-006: this meta tag does NOT need to be added by hand. Verified
 * against the installed `@tanstack/react-router` 1.170.17 source
 * (`headContentUtils.tsx`'s `buildTagsFromMatches` / `useTags`): whenever a
 * nonce is present, both functions unconditionally push
 * `{ tag: 'meta', attrs: { property: 'csp-nonce', content: nonce } }` into
 * the rendered head tags. `__root.tsx` already renders `<HeadContent />`, so
 * the tag ships automatically once `ssr.nonce` is wired in `router.tsx` —
 * this corrects the spec's GAP-042-18 description, which assumed the meta
 * tag had to be emitted manually.
 */
export const CSP_NONCE_META_SELECTOR = 'meta[property="csp-nonce"]';

/**
 * Shape of the per-request context `cspMiddleware` (`src/middleware.ts`)
 * attaches via `next({ context: { cspNonce } })`. Declared locally rather
 * than relying on `Register`-based inference through `getGlobalStartContext`
 * because `cspMiddleware` is authored with the un-parameterized top-level
 * `createMiddleware` (required to break the `middleware -> startInstance ->
 * middleware` circular dependency — `cspMiddleware` must exist before
 * `createStart()` can register it), so the generic context-propagation types
 * do not narrow automatically end-to-end.
 */
interface CspRequestContext {
    readonly cspNonce?: string;
}

/**
 * Reads the per-request CSP nonce on the server from the TanStack Start
 * global request context populated by `cspMiddleware`.
 *
 * Exported (rather than kept as an anonymous inline closure) so it can be
 * unit-tested directly — `getGlobalStartContext()` itself is isomorphic and
 * ALWAYS resolves to `undefined` on the client (verified against the
 * installed `@tanstack/start-client-core` 1.170.13 source,
 * `getGlobalStartContext.ts`: `createIsomorphicFn().client(() => undefined)`),
 * so this implementation only ever runs server-side.
 */
export function getCspNonceOnServer(): string | undefined {
    const context = getGlobalStartContext() as CspRequestContext | undefined;
    return context?.cspNonce;
}

/**
 * Reads the per-request CSP nonce on the client from the auto-emitted
 * `<meta property="csp-nonce">` tag (see `CSP_NONCE_META_SELECTOR` above).
 *
 * Exported for direct unit testing for the same reason as
 * `getCspNonceOnServer` — see that function's doc comment. Additionally,
 * `createIsomorphicFn()`'s untransformed runtime fallback (used by Vitest,
 * which does not run the TanStack Start Vite compiler plugin) always
 * dispatches to whichever `.server()` implementation was registered once one
 * exists, so the composed `getCspNonce` below cannot be used to exercise the
 * client path in tests — only the exported functions can.
 */
export function getCspNonceOnClient(): string | undefined {
    if (typeof document === 'undefined') {
        return undefined;
    }
    return document.querySelector(CSP_NONCE_META_SELECTOR)?.getAttribute('content') ?? undefined;
}

/**
 * Isomorphic CSP nonce reader passed to `ssr.nonce` in `router.tsx`. Must be
 * resolved fresh per call (inside `getRouter()`, called once per request on
 * the server and once on client hydration) rather than cached at module
 * scope: on the server, `getGlobalStartContext()` throws if called before
 * the request's global middlewares have run, so it must only be invoked
 * while building the per-request router instance.
 */
export const getCspNonce: () => string | undefined = createIsomorphicFn()
    .server(getCspNonceOnServer)
    .client(getCspNonceOnClient);
