/**
 * @file Healthcheck handler unit tests — SPEC-209 T-005 / HOS-33 T-003
 *
 * Tests the pure `healthcheckResponse` function extracted from server.ts,
 * plus a smoke test for the default-exported request handler (HOS-33 T-003
 * — TanStack Start >= 1.132.0 direct-callback `createStartHandler` API).
 * No Nitro/H3 server or TanStack router is started; the function is exercised
 * directly with Web API Request objects.
 *
 * Covers:
 *   - AC-1.1: GET /healthz returns 200 application/json {"status":"ok"}
 *   - Robustness: query strings do not affect the pathname match
 *   - AC-1.2 proxy: non-healthz paths return null (fall through to SSR, so no
 *     React tree or QZPayBilling instance is constructed for those requests)
 *   - HOS-33 T-003: the default export is callable with a raw `Request` and
 *     returns a `Response`, both for the intercepted `/healthz` path and for
 *     a path that falls through to the (mocked) TanStack Start handler.
 *
 * Module mocks:
 *   - `@tanstack/react-start/server` is mocked so the module-level
 *     `createStartHandler(defaultStreamHandler)` call in server.ts does not
 *     attempt to boot the SSR framework. `createStartHandler` returns a mock
 *     resolver so the fall-through path can assert a `Response` comes back
 *     without exercising React SSR.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock @tanstack/react-start/server so createStartHandler does not attempt
// framework initialisation in jsdom. The mocked resolver returns a plain
// Response so the fall-through smoke test can assert the default export
// delegates to it correctly.
vi.mock('@tanstack/react-start/server', () => ({
    createStartHandler: vi.fn(() =>
        vi.fn(async () => new Response('ssr-fallback', { status: 200 }))
    ),
    defaultStreamHandler: vi.fn()
}));

import { default as handler, healthcheckResponse } from '../../src/server';

describe('healthcheckResponse (SPEC-209 AC-1.1 / T-005)', () => {
    it('returns 200 application/json {"status":"ok"} for GET /healthz', async () => {
        // Arrange
        const request = new Request('http://localhost/healthz');

        // Act
        const response = healthcheckResponse(request);

        // Assert
        expect(response).not.toBeNull();
        const res = response as Response;
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/json');
        const body = await res.json();
        expect(body).toEqual({ status: 'ok' });
    });

    it('returns 200 for /healthz with a query string (pathname still matches)', async () => {
        // Arrange — probe URLs sometimes carry query params (e.g. Kubernetes liveness)
        const request = new Request('http://localhost/healthz?x=1');

        // Act
        const response = healthcheckResponse(request);

        // Assert
        expect(response).not.toBeNull();
        const res = response as Response;
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({ status: 'ok' });
    });

    it('returns null for /dashboard — non-healthz paths fall through to SSR', () => {
        // Arrange
        const request = new Request('http://localhost/dashboard');

        // Act
        const response = healthcheckResponse(request);

        // Assert: null means the caller proceeds to createStartHandler / React SSR,
        // which is the correct behavior and prevents healthcheck traffic from ever
        // reaching the React render path (AC-1.2 proxy).
        expect(response).toBeNull();
    });

    it('returns null for / (root path)', () => {
        // Arrange
        const request = new Request('http://localhost/');

        // Act
        const response = healthcheckResponse(request);

        // Assert
        expect(response).toBeNull();
    });

    it('returns null for /healthz-extended (prefix-only path should not match)', () => {
        // Arrange — guard against loose prefix matching
        const request = new Request('http://localhost/healthz-extended');

        // Act
        const response = healthcheckResponse(request);

        // Assert
        expect(response).toBeNull();
    });
});

describe('default export request handler (HOS-33 T-003)', () => {
    it('is callable with a raw Request and returns the healthz Response for /healthz', async () => {
        // Arrange
        const request = new Request('http://localhost/healthz');

        // Act
        const response = await handler(request);

        // Assert
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ status: 'ok' });
    });

    it('is callable with a raw Request and delegates non-healthz paths to the TanStack Start handler', async () => {
        // Arrange
        const request = new Request('http://localhost/dashboard');

        // Act
        const response = await handler(request);

        // Assert: falls through to the (mocked) createStartHandler resolver,
        // proving the direct-callback API is wired without the removed
        // defineHandlerCallback wrapper.
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('ssr-fallback');
    });
});
