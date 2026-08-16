/**
 * @file Integration-level test for `cspMiddleware`'s H-170 baseline security
 * headers (Strict-Transport-Security, X-Content-Type-Options,
 * Referrer-Policy).
 *
 * August 2026 smoke (H-170) found `admin.hospeda.com.ar` missing all three
 * headers in production. `apps/api` already emits them via
 * `apps/api/src/middlewares/security.ts`; this test exercises the REAL
 * `cspMiddleware.options.server` handler (the same simulated request-
 * middleware contract as `csp-request-middleware.test.ts`) to prove the
 * fix reaches the actual `Response` object for both `handlerType`s the
 * framework dispatches through this middleware — page loads (`router`) and
 * server function calls (`serverFn`).
 */

import { describe, expect, it } from 'vitest';
import { SECURITY_HEADER_VALUES } from '../../src/lib/security-headers';
import { cspMiddleware } from '../../src/middleware';

/**
 * `RequestServerFn`'s return type is `RequestServerResult | Response`
 * (a middleware may short-circuit with a bare `Response`). `cspMiddleware`
 * always returns the full `next()` result object, but the type doesn't
 * encode that guarantee, so tests narrow explicitly rather than asserting.
 */
function extractResponse(result: { response: Response } | Response): Response {
    return result instanceof Response ? result : result.response;
}

type CspMiddlewareServerFn = NonNullable<(typeof cspMiddleware)['options']['server']>;
type CspMiddlewareNext = Parameters<CspMiddlewareServerFn>[0]['next'];

/** Builds a `next` implementation playing the role of the downstream chain — see csp-request-middleware.test.ts. */
function createDownstreamNext(handlerType: 'router' | 'serverFn') {
    const nextImpl = async (nextOpts?: { context?: { cspNonce?: string } }) => ({
        request: new Request('http://localhost:3000/'),
        pathname: '/',
        context: { ...(nextOpts?.context ?? {}) },
        response: new Response(handlerType === 'router' ? '<html></html>' : '{}', {
            status: 200,
            headers: {
                'content-type': handlerType === 'router' ? 'text/html' : 'application/json'
            }
        })
    });

    return nextImpl as unknown as CspMiddlewareNext;
}

describe('cspMiddleware — H-170 baseline security headers', () => {
    it.each([
        'router',
        'serverFn'
    ] as const)('sets Strict-Transport-Security, X-Content-Type-Options and Referrer-Policy (handlerType=%s)', async (handlerType) => {
        const server = cspMiddleware.options.server;
        if (!server) {
            throw new Error('cspMiddleware.options.server is not defined');
        }

        const result = await server({
            request: new Request('http://localhost:3000/'),
            pathname: '/',
            context: undefined,
            next: createDownstreamNext(handlerType),
            handlerType
        });

        const response = extractResponse(result);
        for (const [name, value] of Object.entries(SECURITY_HEADER_VALUES)) {
            expect(response.headers.get(name)).toBe(value);
        }
    });

    it('keeps the CSP header alongside the new security headers — neither overwrites the other', async () => {
        const server = cspMiddleware.options.server;
        if (!server) {
            throw new Error('cspMiddleware.options.server is not defined');
        }

        const result = await server({
            request: new Request('http://localhost:3000/'),
            pathname: '/',
            context: undefined,
            next: createDownstreamNext('router'),
            handlerType: 'router'
        });

        const response = extractResponse(result);
        expect(response.headers.get('content-security-policy-report-only')).toBeTruthy();
        expect(response.headers.get('strict-transport-security')).toBe(
            SECURITY_HEADER_VALUES['Strict-Transport-Security']
        );
    });
});
