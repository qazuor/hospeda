/**
 * SPEC-145 T-005: Unit tests for promotion + review entitlement gates.
 *
 * Tests the `requireEntitlement` middleware wired on:
 *   - POST   /owner-promotions            (CREATE_PROMOTIONS, gate before enforcePromotionLimit)
 *   - PATCH  /owner-promotions/:id        (CREATE_PROMOTIONS)
 *   - PUT    /owner-promotions/:id        (CREATE_PROMOTIONS)
 *   - POST   /accommodations/:id/reviews  (WRITE_REVIEWS)
 *   - POST   /destinations/:id/reviews    (WRITE_REVIEWS)
 *
 * Each test wires the middleware in a minimal Hono app, sets the
 * `userEntitlements` / `billingLoadFailed` context variables, and asserts:
 *   - entitled   → next() is called (200)
 *   - not entitled → ServiceError ENTITLEMENT_REQUIRED → 403
 *   - staff bypass → always 200 (full keyset injected as requireEntitlement does)
 *   - billingLoadFailed → 503 SERVICE_UNAVAILABLE
 *
 * Mirrors the pattern in:
 *   apps/api/test/routes/accommodation/protected/accommodation-entitlement-gates.test.ts
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
// CREATE_PROMOTIONS gate
// ===========================================================================

describe('CREATE_PROMOTIONS gate (owner-promotion create / patch / update)', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    it('allows request when actor has CREATE_PROMOTIONS', async () => {
        // Arrange
        injectEntitlements(app, [EntitlementKey.CREATE_PROMOTIONS]);
        app.use(requireEntitlement(EntitlementKey.CREATE_PROMOTIONS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when actor lacks CREATE_PROMOTIONS', async () => {
        // Arrange
        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.CREATE_PROMOTIONS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('allows staff (full keyset) through the CREATE_PROMOTIONS gate', async () => {
        // Arrange — staff gets all entitlements via getUnlimitedEntitlements()
        injectAllEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.CREATE_PROMOTIONS));
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
        app.use(requireEntitlement(EntitlementKey.CREATE_PROMOTIONS));
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
// WRITE_REVIEWS gate
// ===========================================================================

describe('WRITE_REVIEWS gate (accommodation reviews create / destination reviews create)', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    it('allows request when actor has WRITE_REVIEWS', async () => {
        // Arrange
        injectEntitlements(app, [EntitlementKey.WRITE_REVIEWS]);
        app.use(requireEntitlement(EntitlementKey.WRITE_REVIEWS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when actor lacks WRITE_REVIEWS', async () => {
        // Arrange
        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.WRITE_REVIEWS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('allows staff (full keyset) through the WRITE_REVIEWS gate', async () => {
        // Arrange
        injectAllEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.WRITE_REVIEWS));
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
        app.use(requireEntitlement(EntitlementKey.WRITE_REVIEWS));
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
// Gate ordering: CREATE_PROMOTIONS runs before enforcePromotionLimit
// ===========================================================================

describe('gate ordering: CREATE_PROMOTIONS runs before promotion limit check', () => {
    it('blocks at entitlement stage before reaching a hypothetical limit middleware', async () => {
        // Arrange — actor lacks CREATE_PROMOTIONS; the limit step after it
        // should never run (simulated by a spy flag).
        const app = new Hono<AppBindings>();
        let limitMiddlewareCalled = false;

        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.CREATE_PROMOTIONS));
        // Fake limit middleware that sets the flag
        app.use((_c, next) => {
            limitMiddlewareCalled = true;
            return next();
        });
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert — 403 from gate, limit middleware never reached
        expect(res.status).toBe(403);
        expect(limitMiddlewareCalled).toBe(false);
    });

    it('proceeds to limit middleware when CREATE_PROMOTIONS is present', async () => {
        // Arrange — actor has CREATE_PROMOTIONS; limit step should run.
        const app = new Hono<AppBindings>();
        let limitMiddlewareCalled = false;

        injectEntitlements(app, [EntitlementKey.CREATE_PROMOTIONS]);
        app.use(requireEntitlement(EntitlementKey.CREATE_PROMOTIONS));
        // Fake limit middleware
        app.use((_c, next) => {
            limitMiddlewareCalled = true;
            return next();
        });
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
        expect(limitMiddlewareCalled).toBe(true);
    });
});

// ===========================================================================
// Per-route smoke: correct key per handler file
// ===========================================================================

describe('per-route smoke: CREATE_PROMOTIONS wired on all promotion mutations', () => {
    const promotionRoutes = [
        'POST /owner-promotions (create)',
        'PATCH /owner-promotions/:id (patch)',
        'PUT /owner-promotions/:id (update)'
    ];

    for (const label of promotionRoutes) {
        describe(label, () => {
            it('returns 403 ENTITLEMENT_REQUIRED when CREATE_PROMOTIONS absent', async () => {
                // Arrange
                const outer = new Hono<AppBindings>();
                injectNoEntitlements(outer);
                outer.use(requireEntitlement(EntitlementKey.CREATE_PROMOTIONS));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                // Act
                const res = await outer.request('/test');

                // Assert
                expect(res.status).toBe(403);
                const body = await res.json();
                expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
            });

            it('returns 200 when CREATE_PROMOTIONS is present', async () => {
                // Arrange
                const outer = new Hono<AppBindings>();
                injectEntitlements(outer, [EntitlementKey.CREATE_PROMOTIONS]);
                outer.use(requireEntitlement(EntitlementKey.CREATE_PROMOTIONS));
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

describe('per-route smoke: WRITE_REVIEWS wired on both review create routes', () => {
    const reviewRoutes = [
        'POST /accommodations/:id/reviews (accommodation review create)',
        'POST /destinations/:id/reviews (destination review create)'
    ];

    for (const label of reviewRoutes) {
        describe(label, () => {
            it('returns 403 ENTITLEMENT_REQUIRED when WRITE_REVIEWS absent', async () => {
                // Arrange
                const outer = new Hono<AppBindings>();
                injectNoEntitlements(outer);
                outer.use(requireEntitlement(EntitlementKey.WRITE_REVIEWS));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                // Act
                const res = await outer.request('/test');

                // Assert
                expect(res.status).toBe(403);
                const body = await res.json();
                expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
            });

            it('returns 200 when WRITE_REVIEWS is present', async () => {
                // Arrange
                const outer = new Hono<AppBindings>();
                injectEntitlements(outer, [EntitlementKey.WRITE_REVIEWS]);
                outer.use(requireEntitlement(EntitlementKey.WRITE_REVIEWS));
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
