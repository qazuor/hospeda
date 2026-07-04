/**
 * @file Integration-level test for `cspMiddleware` (HOS-33 T-006 —
 * GAP-042-13 SSR CSP coverage, GAP-042-21 request-middleware migration).
 *
 * This simulates the REAL request-middleware execution contract from the
 * installed `@tanstack/start-server-core` 1.169.16 source
 * (`createStartHandler.js`'s `executeMiddleware`):
 *
 *   - `next({ context })` does not return until the ENTIRE downstream chain
 *     (here, a stand-in for the SSR render / server-fn handler) has fully
 *     resolved, so `await next(...)` yields a fully-populated `response`.
 *   - The context passed into `next()` is what the downstream code reads
 *     back via `getGlobalStartContext()` — in this codebase, that's
 *     `router.tsx`'s `ssr.nonce` (via `getCspNonceOnServer` in
 *     `src/lib/csp-nonce.ts`), invoked DURING the SSR render itself.
 *
 * The load-bearing assertion is the nonce ROUND TRIP: the nonce embedded in
 * the `Content-Security-Policy-Report-Only` header's `'nonce-XXXX'`
 * directive must be the exact same nonce `getCspNonceOnServer()` reads
 * while the (simulated) render is in flight. A mismatch here is a silent
 * CSP break that would only surface once Phase 2 (enforcement) ships.
 */

import { describe, expect, it, vi } from 'vitest';

const globalStartContextMock = vi.fn<() => { cspNonce?: string } | undefined>();

vi.mock('@tanstack/react-start', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-start')>();
    return {
        ...actual,
        getGlobalStartContext: () => globalStartContextMock()
    };
});

import { getCspNonceOnServer } from '../../src/lib/csp-nonce';
import { cspMiddleware } from '../../src/middleware';

const CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';

/**
 * `RequestServerFn`'s return type is `RequestServerResult | Response`
 * (a middleware may short-circuit with a bare `Response`). `cspMiddleware`
 * always returns the full `next()` result object, but the type doesn't
 * encode that guarantee, so tests narrow explicitly rather than asserting.
 */
function extractResponse(result: { response: Response } | Response): Response {
    return result instanceof Response ? result : result.response;
}

/**
 * `cspMiddleware.options.server`'s real parameter type declares `next` as a
 * generic function (`<TServerContext>(options?: { context?: TServerContext
 * }) => ...`) so it can thread an arbitrary context shape through an
 * arbitrary middleware chain. A concrete mock can only ever accept ONE
 * concrete context shape, which TypeScript correctly refuses to widen to
 * "works for any TServerContext" — this alias captures the real parameter
 * type once so the cast below stays in a single, documented place instead
 * of being repeated (and silently drifting) at every call site.
 */
type CspMiddlewareServerFn = NonNullable<(typeof cspMiddleware)['options']['server']>;
type CspMiddlewareNext = Parameters<CspMiddlewareServerFn>[0]['next'];

/**
 * Builds a `next` implementation matching `RequestServerNextFn`. It plays
 * the role of the downstream middleware chain: it threads the context
 * `cspMiddleware` hands it into the mocked `getGlobalStartContext()` (so
 * `getCspNonceOnServer()` reads exactly what a real SSR render would see),
 * captures the nonce it observed, and returns a plain `Response` — mirroring
 * `renderRouterToStream.tsx`'s `new Response(stream, { status, headers })`.
 */
function createDownstreamNext(handlerType: 'router' | 'serverFn') {
    let nonceSeenDuringRender: string | undefined;

    const nextImpl = vi.fn(async (nextOpts?: { context?: { cspNonce?: string } }) => {
        const mergedContext = { ...(nextOpts?.context ?? {}) };
        globalStartContextMock.mockReturnValue(mergedContext);

        // Simulate the downstream handler (SSR render for 'router', the
        // server-fn dispatcher for 'serverFn') reading the nonce back out —
        // exactly what router.tsx's getCspNonce() does for a real request.
        nonceSeenDuringRender = getCspNonceOnServer();

        return {
            request: new Request('http://localhost:3000/'),
            pathname: '/',
            context: mergedContext,
            response: new Response(handlerType === 'router' ? '<html></html>' : '{}', {
                status: 200,
                headers: {
                    'content-type': handlerType === 'router' ? 'text/html' : 'application/json'
                }
            })
        };
    });

    // See CspMiddlewareNext's doc comment above for why this cast exists.
    const next = nextImpl as unknown as CspMiddlewareNext;

    return { next, nextImpl, getNonceSeenDuringRender: () => nonceSeenDuringRender };
}

describe('cspMiddleware (HOS-33 T-006 — request-type middleware)', () => {
    it('is registered as a request-type middleware (options.server is the handler)', () => {
        expect(typeof cspMiddleware.options.server).toBe('function');
    });

    it.each(['router', 'serverFn'] as const)(
        'sets the CSP header AND the header nonce matches the nonce visible via getGlobalStartContext() during the render (handlerType=%s)',
        async (handlerType) => {
            // Arrange
            const server = cspMiddleware.options.server;
            if (!server) {
                throw new Error('cspMiddleware.options.server is not defined');
            }
            const { next, nextImpl, getNonceSeenDuringRender } = createDownstreamNext(handlerType);

            // Act
            const result = await server({
                request: new Request('http://localhost:3000/'),
                pathname: '/',
                context: undefined,
                next,
                handlerType
            });

            // Assert — next() was called (downstream chain actually ran)
            expect(nextImpl).toHaveBeenCalledTimes(1);

            // Assert — the CSP header made it onto the final response
            const response = extractResponse(result);
            const cspHeader = response.headers.get(CSP_HEADER_NAME);
            expect(cspHeader).toBeTruthy();

            // Assert — the render observed a nonce via getGlobalStartContext()
            const nonceSeenDuringRender = getNonceSeenDuringRender();
            expect(nonceSeenDuringRender).toBeDefined();

            // Assert (load-bearing): the nonce in the CSP header's
            // 'script-src' directive is the SAME nonce the render saw. A
            // mismatch here means the browser would block scripts carrying
            // the render's nonce once CSP moves from Report-Only to
            // enforcement (SPEC-046), even though nothing here would fail
            // in Report-Only mode.
            expect(cspHeader).toContain(`'nonce-${nonceSeenDuringRender}'`);
        }
    );

    it('produces a different nonce (and header) on each invocation', async () => {
        // Arrange
        const server = cspMiddleware.options.server;
        if (!server) {
            throw new Error('cspMiddleware.options.server is not defined');
        }

        const runOnce = async () => {
            const { next, getNonceSeenDuringRender } = createDownstreamNext('router');
            const result = await server({
                request: new Request('http://localhost:3000/'),
                pathname: '/',
                context: undefined,
                next,
                handlerType: 'router'
            });
            return {
                header: extractResponse(result).headers.get(CSP_HEADER_NAME),
                nonce: getNonceSeenDuringRender()
            };
        };

        // Act
        const first = await runOnce();
        const second = await runOnce();

        // Assert
        expect(first.nonce).not.toBe(second.nonce);
        expect(first.header).not.toBe(second.header);
    });

    it('preserves the downstream response body and content-type while adding the CSP header', async () => {
        // Arrange
        const server = cspMiddleware.options.server;
        if (!server) {
            throw new Error('cspMiddleware.options.server is not defined');
        }
        const { next } = createDownstreamNext('router');

        // Act
        const result = await server({
            request: new Request('http://localhost:3000/'),
            pathname: '/',
            context: undefined,
            next,
            handlerType: 'router'
        });

        // Assert
        const response = extractResponse(result);
        expect(response.headers.get('content-type')).toBe('text/html');
        await expect(response.text()).resolves.toBe('<html></html>');
    });
});
