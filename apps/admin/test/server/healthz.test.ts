/**
 * @file Healthcheck handler unit tests — SPEC-209 T-005
 *
 * Tests the pure `healthcheckResponse` function extracted from server.ts.
 * No Nitro/H3 server or TanStack router is started; the function is exercised
 * directly with Web API Request objects.
 *
 * Covers:
 *   - AC-1.1: GET /healthz returns 200 application/json {"status":"ok"}
 *   - Robustness: query strings do not affect the pathname match
 *   - AC-1.2 proxy: non-healthz paths return null (fall through to SSR, so no
 *     React tree or QZPayBilling instance is constructed for those requests)
 *
 * Module mocks:
 *   - `./router` is mocked to prevent TanStack Router's routeTree.gen.ts from
 *     executing in a jsdom environment (Route.update is not available without a
 *     full framework boot). healthcheckResponse has zero dependency on the
 *     router — the mock proves that isolation.
 *   - `@tanstack/react-start/server` is mocked so the module-level
 *     `createStartHandler({ createRouter })` call in server.ts does not
 *     attempt to boot the SSR framework.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock the router module before importing server.ts so that the module-level
// `createStartHandler({ createRouter })` call never exercises routeTree.gen.ts.
vi.mock('../../src/router', () => ({
    createRouter: vi.fn()
}));

// Mock @tanstack/react-start/server so createStartHandler and
// defineHandlerCallback do not attempt framework initialisation in jsdom.
vi.mock('@tanstack/react-start/server', () => ({
    createStartHandler: vi.fn(() => vi.fn()),
    defaultStreamHandler: vi.fn(),
    defineHandlerCallback: vi.fn((cb: unknown) => cb)
}));

import { healthcheckResponse } from '../../src/server';

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
