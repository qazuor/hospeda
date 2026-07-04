/**
 * @file start.test.ts
 * @description Unit tests for `src/start.ts` (HOS-33 T-005/T-006 — TanStack
 * Start >= 1.132.0 `createStart()` migration, replacing
 * `registerGlobalMiddleware`).
 *
 * These tests exercise the REAL (non-mocked) `@tanstack/react-start`
 * `createStart` runtime, not a stub — the whole point is to pin behaviors
 * that a naive migration gets wrong:
 *
 *   1. `createStart()`'s options key is `functionMiddleware`, not
 *      `serverFnMiddleware` (a name that does not exist on the real type).
 *   2. `createStart()` takes a THUNK (`() => options`), not a plain object.
 *      Passing a plain object crashes with `TypeError: getOptions is not a
 *      function` the first time the framework resolves the start config
 *      (i.e. on the first real request) — `vitest.config.ts` does not run
 *      the TanStack Start Vite compiler plugin, so this suite exercises the
 *      exact same untransformed runtime a request-time crash would hit.
 *   3. (T-006) `cspMiddleware` is wired into `requestMiddleware`, not
 *      `functionMiddleware` — it was converted to `type: 'request'` (see
 *      `src/middleware.ts`) specifically so ONE middleware covers both SSR
 *      page loads and server function calls (GAP-042-13). No
 *      `functionMiddleware` is registered anymore.
 */

import { describe, expect, it } from 'vitest';
import { cspMiddleware } from '../src/middleware';
import { startInstance } from '../src/start';

describe('startInstance (HOS-33 T-005/T-006 — createStart migration)', () => {
    it('resolves getOptions() without throwing (createStart received a thunk, not a plain object)', async () => {
        // Act — this is the load-bearing regression check: a plain object
        // argument to createStart() throws "getOptions is not a function"
        // when this resolves, since the runtime unconditionally does
        // `await getOptions()` on whatever it was given.
        const options = await startInstance.getOptions();

        // Assert
        expect(options).toBeDefined();
    });

    it('wires cspMiddleware into requestMiddleware (GAP-042-13/21 — full SSR + server-fn CSP coverage)', async () => {
        // Act
        const options = await startInstance.getOptions();

        // Assert
        expect(options.requestMiddleware).toEqual([cspMiddleware]);
    });

    it('does not register any functionMiddleware (cspMiddleware fully migrated off type: function)', async () => {
        // Act
        const options = await startInstance.getOptions();

        // Assert
        expect(options.functionMiddleware).toBeUndefined();
    });

    it('exposes a createMiddleware factory on the start instance', () => {
        expect(typeof startInstance.createMiddleware).toBe('function');
    });
});
