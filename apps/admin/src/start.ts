/**
 * Global middleware registration for TanStack Start.
 *
 * TanStack Start >= 1.132.0 replaces `registerGlobalMiddleware` with
 * `createStart()`. The actual `createStart()` option keys (verified against
 * the installed `@tanstack/start-client-core` 1.170.13 type declarations,
 * `createStart.d.ts`) are:
 *   - `functionMiddleware`: runs on every `createServerFn` invocation.
 *     Accepts middleware created via `createMiddleware({ type: 'function' })`
 *     (`AnyFunctionMiddleware`).
 *   - `requestMiddleware`: runs on every HTTP request handled by the
 *     framework, for BOTH `handlerType: 'router'` (page loads, including the
 *     initial SSR HTML document) and `handlerType: 'serverFn'` (server
 *     function calls) — verified by reading `createStartHandler.js`'s
 *     `startRequestResolver`, which prepends
 *     `flattenedRequestMiddlewares.map((d) => d.options.server)` onto BOTH
 *     the server-fn dispatch chain and the router dispatch chain. It only
 *     accepts middleware created via `createMiddleware({ type: 'request' })`
 *     (`AnyRequestMiddleware`), a structurally different, non-interchangeable
 *     shape (different `.server()` handler signature — `{ request, pathname,
 *     context, next, handlerType }` vs the function middleware's `{ data,
 *     context, next, method, serverFnMeta, signal }`).
 *
 * HOS-33 T-006: `cspMiddleware` was converted from `type: 'function'` to
 * `type: 'request'` (see `middleware.ts`) specifically so ONE middleware can
 * cover both server functions and SSR page loads via `requestMiddleware` —
 * closing the SSR CSP coverage gap (GAP-042-13) that `functionMiddleware`
 * alone could never close (it never ran for the initial HTML response).
 * `functionMiddleware` is intentionally omitted now: there is no longer a
 * `type: 'function'` middleware to register, and the key is optional on
 * `StartInstanceOptions` (verified against `createStart.ts`'s
 * `StartInstanceOptions` interface — both `requestMiddleware?` and
 * `functionMiddleware?` are optional).
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
 * This file is auto-discovered by the TanStack Start Vite plugin via the
 * virtual `#tanstack-start-entry` import (resolved independently of
 * `router.tsx` — confirmed by reading `hydrateStart.ts` in
 * `@tanstack/start-client-core`, which imports `startInstance` from
 * `#tanstack-start-entry` directly, with no dependency on a side-effect
 * import from the router entry). No other file needs to import this module
 * for its `startInstance` export to take effect.
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
    requestMiddleware: [cspMiddleware]
}));
