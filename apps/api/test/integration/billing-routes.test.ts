/**
 * Integration tests for the shape of the billing HTTP surface.
 *
 * The legacy QZPay-era surface (plans, add-ons, trial, customers, invoices,
 * payments, entitlements, checkout, promo-code CRUD) was removed together with
 * its middleware, webhooks and services (e9c30e7163). This file used to assert
 * that every one of those paths answered 503 "billing not configured"; with the
 * routes gone it asserted nothing, and 63 of its 71 cases answered 404 instead.
 *
 * It now pins the two facts that remain true of that surface:
 * 1. The retired paths stay retired: they answer 404, so nothing quietly
 *    re-mounts an unauthenticated billing endpoint.
 * 2. The routes that replaced them sit behind authentication: an anonymous
 *    caller gets 401 before any validation or lookup. Their behaviour is covered
 *    in depth under `test/integration/billing-subscription/` and
 *    `test/integration/billing-promo/`.
 */

import { describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { validateApiEnv } from '../../src/utils/env';

const SOME_UUID = '550e8400-e29b-41d4-a716-446655440000';

interface RouteCase {
    readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    readonly path: string;
}

const RETIRED_ROUTES: readonly RouteCase[] = [
    { method: 'GET', path: '/api/v1/protected/billing/plans' },
    { method: 'GET', path: '/api/v1/protected/billing/addons' },
    { method: 'GET', path: '/api/v1/protected/billing/addons/featured-listing' },
    { method: 'POST', path: '/api/v1/protected/billing/addons/featured-listing/purchase' },
    { method: 'GET', path: '/api/v1/protected/billing/addons/my' },
    { method: 'POST', path: `/api/v1/protected/billing/addons/${SOME_UUID}/cancel` },
    { method: 'GET', path: '/api/v1/protected/billing/trial/status' },
    { method: 'POST', path: '/api/v1/protected/billing/trial/start' },
    { method: 'POST', path: '/api/v1/protected/billing/trial/check-expiry' },
    { method: 'POST', path: '/api/v1/protected/billing/promo-codes/validate' },
    { method: 'POST', path: '/api/v1/protected/billing/promo-codes/apply' },
    { method: 'POST', path: '/api/v1/protected/billing/promo-codes' },
    { method: 'GET', path: '/api/v1/protected/billing/promo-codes' },
    { method: 'GET', path: `/api/v1/protected/billing/promo-codes/${SOME_UUID}` },
    { method: 'PUT', path: `/api/v1/protected/billing/promo-codes/${SOME_UUID}` },
    { method: 'DELETE', path: `/api/v1/protected/billing/promo-codes/${SOME_UUID}` },
    { method: 'GET', path: '/api/v1/protected/billing/customers' },
    { method: 'GET', path: '/api/v1/protected/billing/invoices' },
    { method: 'GET', path: '/api/v1/protected/billing/payments' },
    { method: 'GET', path: `/api/v1/protected/billing/payments/${SOME_UUID}` },
    { method: 'GET', path: '/api/v1/protected/billing/entitlements' },
    { method: 'POST', path: '/api/v1/protected/billing/checkout' },
    { method: 'GET', path: `/api/v1/protected/billing/checkout/${SOME_UUID}` },
    { method: 'GET', path: `/api/v1/protected/billing/subscriptions/${SOME_UUID}` },
    { method: 'PATCH', path: `/api/v1/protected/billing/subscriptions/${SOME_UUID}` },
    { method: 'DELETE', path: `/api/v1/protected/billing/subscriptions/${SOME_UUID}` },
    // Only POST is mounted on this path; a GET used to answer 401 only because
    // the POST's gates leaked to every method (HOS-1908).
    { method: 'GET', path: '/api/v1/protected/billing/subscriptions' }
];

const AUTHENTICATED_ROUTES: readonly RouteCase[] = [
    { method: 'POST', path: '/api/v1/protected/billing/subscriptions' },
    { method: 'GET', path: `/api/v1/protected/billing-subscription/${SOME_UUID}` },
    {
        method: 'GET',
        path: `/api/v1/protected/billing-subscription/${SOME_UUID}/cancellation-preview`
    },
    { method: 'POST', path: `/api/v1/protected/billing-subscription/${SOME_UUID}/cancellation` },
    { method: 'POST', path: '/api/v1/protected/billing/promo-codes/redeem' }
];

const request = async ({ method, path }: RouteCase): Promise<Response> => {
    const app = initApp();
    return app.request(path, {
        method,
        headers: {
            'user-agent': 'test-agent',
            accept: 'application/json',
            'content-type': 'application/json'
        },
        body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({})
    });
};

describe('Billing Routes Integration', () => {
    validateApiEnv();

    describe('Retired legacy billing surface', () => {
        it.each(RETIRED_ROUTES)('answers 404 for $method $path', async (route) => {
            clearCache();

            const res = await request(route);

            expect(res.status).toBe(404);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });
    });

    describe('Authenticated billing routes', () => {
        it.each(
            AUTHENTICATED_ROUTES
        )('answers 401 to an anonymous $method $path', async (route) => {
            clearCache();

            const res = await request(route);

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });
    });

    describe('Request Validation', () => {
        it('should reject requests without user-agent header', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/protected/billing/subscriptions', {
                headers: { accept: 'application/json' }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
        });

        it('should reject POST requests without content-type header', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/protected/billing/promo-codes/redeem', {
                method: 'POST',
                headers: { 'user-agent': 'test-agent', accept: 'application/json' },
                body: JSON.stringify({})
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error.code).toBe('INVALID_CONTENT_TYPE');
        });
    });
});
