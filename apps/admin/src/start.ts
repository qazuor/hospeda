/**
 * Global middleware registration for TanStack Start.
 *
 * TanStack Start >= 1.132.0 replaces `registerGlobalMiddleware` with
 * `createStart()`. The actual `createStart()` option keys (verified against
 * the installed `@tanstack/start-client-core` 1.170.13 type declarations,
 * `createStart.d.ts`) are:
 *   - `functionMiddleware`: runs on every `createServerFn` invocation
 *     (equivalent to the old `registerGlobalMiddleware` behavior). Accepts
 *     middleware created via `createMiddleware({ type: 'function' })`
 *     (`AnyFunctionMiddleware`), which is what `cspMiddleware` is today.
 *   - `requestMiddleware`: runs on every HTTP request handled by the
 *     framework, including the initial SSR page load (HTML document) — this
 *     is what would close the CSP coverage gap (GAP-042-13): today the CSP
 *     header is only set on server function responses, never on the first
 *     HTML response a browser receives. It only accepts middleware created
 *     via `createMiddleware({ type: 'request' })` (`AnyRequestMiddleware`),
 *     a structurally different, non-interchangeable shape (different
 *     `.server()` handler signature — `{ request, pathname, context, next,
 *     handlerType }` vs the function middleware's `{ data, context, next,
 *     method, serverFnMeta, signal }`).
 *
 * NOTE (HOS-33 scope boundary): `cspMiddleware` is currently `type:
 * 'function'`, so it can only be wired into `functionMiddleware` here.
 * Wiring `requestMiddleware` for full SSR-wide CSP coverage (GAP-042-13,
 * GAP-042-21) requires either converting `cspMiddleware` to `type:
 * 'request'` or adding a parallel request-level middleware, plus the
 * `getCspNonce` / `ssr.nonce` plumbing in `router.tsx` (GAP-042-18). That is
 * out of scope for this task (T-005) — left for the follow-up task that
 * owns SSR nonce wiring.
 *
 * IMPORTANT — `createStart()` takes a THUNK, not a plain object.
 * `createStart({ ... })` (a plain object literal, as shown in some
 * migration examples) crashes at request time with `TypeError: getOptions
 * is not a function` — verified by running the installed
 * `@tanstack/start-client-core` 1.170.13 runtime directly: `createStart`'s
 * implementation unconditionally does `await getOptions()` on whatever it
 * receives, so a non-function argument throws the first time the framework
 * resolves the start config (on every request, via
 * `entries.startEntry.startInstance.getOptions()` inside
 * `createStartHandler`). The correct form is `createStart(() => ({ ... }))`.
 *
 * This file must be imported early in the application lifecycle (e.g., from
 * the root route or router setup) so the `startInstance` is created before
 * any server functions or requests are handled.
 *
 * IMPORTANT — the export MUST be named `startInstance`, not `start`. The
 * TanStack Start Vite plugin auto-discovers this file as the "start entry"
 * by convention and the generated `routeTree.gen.ts` footer imports the
 * export by that exact name (`import type { startInstance } from
 * './start.ts'`) to type `Register.config`. The production client bundle
 * ALSO imports `{ startInstance }` from this file by name (from
 * `@tanstack/start-client-core`'s `hydrateStart.js`) — both verified via a
 * real `vite build` run, which fails with `[MISSING_EXPORT] "startInstance"
 * is not exported by "src/start.ts"` when this export is named anything
 * else (e.g. `start`).
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/middleware
 */

import { createStart } from '@tanstack/react-start';
import { cspMiddleware } from './middleware';

export const startInstance = createStart(() => ({
    functionMiddleware: [cspMiddleware]
}));
