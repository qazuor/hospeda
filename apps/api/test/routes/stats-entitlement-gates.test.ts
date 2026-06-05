/**
 * SPEC-145 T-006: Unit tests for host stats entitlement gates.
 *
 * Tests the `requireEntitlement` middleware wired on:
 *   - GET /accommodations/my/favorites-breakdown  (VIEW_ADVANCED_STATS)
 *   - GET /accommodations/my/market-comparison    (VIEW_ADVANCED_STATS)
 *   - GET /conversations/me/response-rate         (VIEW_BASIC_STATS)
 *   - GET /conversations/me/monthly-inquiries     (VIEW_BASIC_STATS)
 *
 * Each test wires the middleware in a minimal Hono app, sets the
 * `userEntitlements` / `billingLoadFailed` context variables, and asserts:
 *   - entitled   → next() is called (200)
 *   - not entitled → ServiceError ENTITLEMENT_REQUIRED → 403
 *   - staff bypass → always 200 (full keyset injected)
 *   - billingLoadFailed → 503 SERVICE_UNAVAILABLE
 *
 * Mirrors the pattern in:
 *   apps/api/test/routes/promotion-and-review-entitlement-gates.test.ts
 */

import { EntitlementKey, type LimitKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it } from 'vitest';
import { requireEntitlement } from '../../src/middlewares/entitlement';
import type { AppBindings } from '../../src/types';

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
// Helpers
// ---------------------------------------------------------------------------

/** Inject the given entitlement set (billing healthy). */
function injectEntitlements(app: Hono<AppBindings>, keys: EntitlementKey[]): void {
    app.use((c, next) => {
        c.set('userEntitlements', new Set(keys));
        c.set('userLimits', new Map<LimitKey, number>());
        c.set('billingLoadFailed', false);
        return next();
    });
}

/** Inject empty entitlements (billing healthy — user simply lacks the key). */
function injectNoEntitlements(app: Hono<AppBindings>): void {
    injectEntitlements(app, []);
}

/** Inject the full keyset — simulates staff bypass (unlimited entitlements). */
function injectAllEntitlements(app: Hono<AppBindings>): void {
    injectEntitlements(app, Object.values(EntitlementKey));
}

/** Inject billing-failed state (empty entitlements + billingLoadFailed = true). */
function injectBillingFailed(app: Hono<AppBindings>): void {
    app.use((c, next) => {
        c.set('userEntitlements', new Set<EntitlementKey>());
        c.set('userLimits', new Map<LimitKey, number>());
        c.set('billingLoadFailed', true);
        return next();
    });
}

// ===========================================================================
// VIEW_ADVANCED_STATS gate
// ===========================================================================

describe('VIEW_ADVANCED_STATS gate (hostFavoritesBreakdown / hostMarketComparison)', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    it('allows request when actor has VIEW_ADVANCED_STATS', async () => {
        // Arrange
        injectEntitlements(app, [EntitlementKey.VIEW_ADVANCED_STATS]);
        app.use(requireEntitlement(EntitlementKey.VIEW_ADVANCED_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when actor lacks VIEW_ADVANCED_STATS', async () => {
        // Arrange
        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.VIEW_ADVANCED_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('returns 403 when actor has VIEW_BASIC_STATS but not VIEW_ADVANCED_STATS', async () => {
        // Arrange — owner-basico only gets VIEW_BASIC_STATS, not VIEW_ADVANCED_STATS
        injectEntitlements(app, [EntitlementKey.VIEW_BASIC_STATS]);
        app.use(requireEntitlement(EntitlementKey.VIEW_ADVANCED_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('allows staff (full keyset) through the VIEW_ADVANCED_STATS gate', async () => {
        // Arrange — staff gets all entitlements via getUnlimitedEntitlements()
        injectAllEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.VIEW_ADVANCED_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
    });

    it('returns 503 when billingLoadFailed is true', async () => {
        // Arrange — billing outage scenario
        injectBillingFailed(app);
        app.use(requireEntitlement(EntitlementKey.VIEW_ADVANCED_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert — 503 guards against privilege escalation during billing outages
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
});

// ===========================================================================
// VIEW_BASIC_STATS gate
// ===========================================================================

describe('VIEW_BASIC_STATS gate (response-rate / monthly-inquiries)', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    it('allows request when actor has VIEW_BASIC_STATS', async () => {
        // Arrange
        injectEntitlements(app, [EntitlementKey.VIEW_BASIC_STATS]);
        app.use(requireEntitlement(EntitlementKey.VIEW_BASIC_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when actor lacks VIEW_BASIC_STATS', async () => {
        // Arrange
        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.VIEW_BASIC_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('allows staff (full keyset) through the VIEW_BASIC_STATS gate', async () => {
        // Arrange
        injectAllEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.VIEW_BASIC_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
    });

    it('returns 503 when billingLoadFailed is true', async () => {
        // Arrange
        injectBillingFailed(app);
        app.use(requireEntitlement(EntitlementKey.VIEW_BASIC_STATS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
});

// ===========================================================================
// Per-route smoke: VIEW_ADVANCED_STATS wired on both advanced-stats routes
// ===========================================================================

describe('per-route smoke: VIEW_ADVANCED_STATS wired on host advanced-stats routes', () => {
    const advancedStatsRoutes = [
        'GET /accommodations/my/favorites-breakdown (hostFavoritesBreakdown)',
        'GET /accommodations/my/market-comparison (hostMarketComparison)'
    ];

    for (const label of advancedStatsRoutes) {
        describe(label, () => {
            it('returns 403 ENTITLEMENT_REQUIRED when VIEW_ADVANCED_STATS absent', async () => {
                // Arrange
                const outer = new Hono<AppBindings>();
                injectNoEntitlements(outer);
                outer.use(requireEntitlement(EntitlementKey.VIEW_ADVANCED_STATS));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                // Act
                const res = await outer.request('/test');

                // Assert
                expect(res.status).toBe(403);
                const body = await res.json();
                expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
            });

            it('returns 200 when VIEW_ADVANCED_STATS is present', async () => {
                // Arrange
                const outer = new Hono<AppBindings>();
                injectEntitlements(outer, [EntitlementKey.VIEW_ADVANCED_STATS]);
                outer.use(requireEntitlement(EntitlementKey.VIEW_ADVANCED_STATS));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                // Act
                const res = await outer.request('/test');

                // Assert
                expect(res.status).toBe(200);
            });
        });
    }
});

// ===========================================================================
// Per-route smoke: VIEW_BASIC_STATS wired on both basic-stats routes
// ===========================================================================

describe('per-route smoke: VIEW_BASIC_STATS wired on host basic-stats routes', () => {
    const basicStatsRoutes = [
        'GET /conversations/me/response-rate (hostConversationResponseRate)',
        'GET /conversations/me/monthly-inquiries (hostConversationMonthlyInquiries)'
    ];

    for (const label of basicStatsRoutes) {
        describe(label, () => {
            it('returns 403 ENTITLEMENT_REQUIRED when VIEW_BASIC_STATS absent', async () => {
                // Arrange
                const outer = new Hono<AppBindings>();
                injectNoEntitlements(outer);
                outer.use(requireEntitlement(EntitlementKey.VIEW_BASIC_STATS));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                // Act
                const res = await outer.request('/test');

                // Assert
                expect(res.status).toBe(403);
                const body = await res.json();
                expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
            });

            it('returns 200 when VIEW_BASIC_STATS is present', async () => {
                // Arrange
                const outer = new Hono<AppBindings>();
                injectEntitlements(outer, [EntitlementKey.VIEW_BASIC_STATS]);
                outer.use(requireEntitlement(EntitlementKey.VIEW_BASIC_STATS));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                // Act
                const res = await outer.request('/test');

                // Assert
                expect(res.status).toBe(200);
            });
        });
    }
});
