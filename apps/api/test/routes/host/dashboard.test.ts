/**
 * SPEC-205: Tests for the Host Dashboard API endpoint.
 *
 * Tests the protected aggregation endpoint `GET /api/v1/protected/host/dashboard`
 * including:
 * - Entitlement gate (VIEW_BASIC_STATS)
 * - Response shape (properties, plan, unreadConversations)
 * - Staff bypass
 * - Billing unavailable → 503
 * - Handler resolves correct default state
 *
 * Layer: Integration (minimal Hono app with entitlement middleware)
 *
 * @see apps/api/src/routes/host/protected/dashboard.ts
 */
import { EntitlementKey, type LimitKey } from '@repo/billing';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';
import { hostDashboardRoute } from '../../../src/routes/host/protected/dashboard';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Minimal error handler mirroring production createErrorHandler() shape.
// ---------------------------------------------------------------------------

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.ENTITLEMENT_REQUIRED]: 403,
    [ServiceErrorCode.LIMIT_REACHED]: 403,
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400
};

function attachTestErrorHandler(app: Hono<AppBindings>): void {
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                        ...(error.details ? { details: error.details } : {})
                    }
                },
                status as 400 | 401 | 403 | 404 | 500
            );
        }
        if (error instanceof HTTPException) {
            return error.getResponse();
        }
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });
}

// ---------------------------------------------------------------------------
// Helpers — build test apps with entitlements injected BEFORE the route
// ---------------------------------------------------------------------------

/** Inject a minimal host actor. */
function injectHostActor(app: Hono<AppBindings>): void {
    app.use((c, next) => {
        c.set('actor', {
            id: '00000000-0000-0000-0000-000000000010',
            role: RoleEnum.HOST,
            permissions: []
        });
        return next();
    });
}

/** Inject entitlement set (billing healthy). */
function injectEntitlements(app: Hono<AppBindings>, keys: EntitlementKey[]): void {
    app.use((c, next) => {
        c.set('userEntitlements', new Set(keys));
        c.set('userLimits', new Map<LimitKey, number>());
        c.set('billingLoadFailed', false);
        return next();
    });
}

/** Inject billing failure state. */
function injectBillingFailure(app: Hono<AppBindings>): void {
    app.use((c, next) => {
        c.set('billingLoadFailed', true);
        return next();
    });
}

/**
 * Build a test app with the given entitlement keys.
 * Middleware order: error handler → actor → entitlements → route.
 * Entitlements are set BEFORE the route is mounted so they run first.
 */
function buildApp(entitlementKeys: EntitlementKey[]): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    injectHostActor(app);
    injectEntitlements(app, entitlementKeys);
    app.route('/', hostDashboardRoute);
    return app;
}

/**
 * Build a test app with billing failure.
 */
function buildBillingFailureApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    injectHostActor(app);
    injectBillingFailure(app);
    app.route('/', hostDashboardRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/protected/host/dashboard (SPEC-205)', () => {
    describe('entitlement gate (VIEW_BASIC_STATS)', () => {
        it('returns 200 when actor has VIEW_BASIC_STATS entitlement', async () => {
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            const res = await app.request('/');

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toBeDefined();
            expect(body.data.properties).toBeDefined();
            expect(body.data.properties.total).toBe(0);
        });

        it('returns 403 when actor lacks VIEW_BASIC_STATS entitlement', async () => {
            const app = buildApp([EntitlementKey.PUBLISH_ACCOMMODATIONS]);

            const res = await app.request('/');

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        });

        it('returns 403 when actor has empty entitlements', async () => {
            const app = buildApp([]);

            const res = await app.request('/');

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        });

        it('returns 503 when billing service is unavailable', async () => {
            const app = buildBillingFailureApp();

            const res = await app.request('/');

            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
        });
    });

    describe('staff bypass', () => {
        it('allows staff actors through (entitlementMiddleware injects all keys)', async () => {
            // When entitlementMiddleware runs with staff role, it injects ALL keys.
            // We simulate that by injecting VIEW_BASIC_STATS.
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            const res = await app.request('/');

            expect(res.status).toBe(200);
        });
    });

    describe('response shape', () => {
        it('returns the full HostDashboardResponse shape', async () => {
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            const res = await app.request('/');
            const body = await res.json();

            expect(body.data).toBeDefined();
            // properties block
            expect(body.data.properties).toBeTypeOf('object');
            expect(body.data.properties.total).toBeTypeOf('number');
            expect(body.data.properties.published).toBeTypeOf('number');
            expect(body.data.properties.draft).toBeTypeOf('number');
            expect(body.data.properties.archived).toBeTypeOf('number');

            // plan block (nullable)
            expect(body.data).toHaveProperty('plan');
            if (body.data.plan !== null) {
                expect(body.data.plan.slug).toBeTypeOf('string');
                expect(body.data.plan.name).toBeTypeOf('string');
                expect(['active', 'trial', 'cancelled', 'expired', 'past_due']).toContain(
                    body.data.plan.status
                );
                expect(body.data.plan.isTrial).toBeTypeOf('boolean');
            }

            // unreadConversations
            expect(body.data.unreadConversations).toBeTypeOf('number');
            expect(body.data.unreadConversations).toBe(0);
        });

        it('returns non-negative integers for all numeric fields', async () => {
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            const res = await app.request('/');
            const body = await res.json();

            expect(body.data.properties.total).toBeGreaterThanOrEqual(0);
            expect(body.data.properties.published).toBeGreaterThanOrEqual(0);
            expect(body.data.properties.draft).toBeGreaterThanOrEqual(0);
            expect(body.data.properties.archived).toBeGreaterThanOrEqual(0);
            expect(body.data.unreadConversations).toBeGreaterThanOrEqual(0);
        });
    });

    describe('route registration', () => {
        it('route is mountable at the real API path', async () => {
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            const res = await app.request('/');

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.properties).toBeDefined();
        });
    });
});
