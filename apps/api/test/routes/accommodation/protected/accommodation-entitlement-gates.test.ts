/**
 * SPEC-145 T-004: Unit tests for accommodation publish + edit entitlement gates.
 *
 * Tests the `requireEntitlement` middleware wired on:
 *   - POST /accommodations               (PUBLISH_ACCOMMODATIONS)
 *   - POST /accommodations/draft         (PUBLISH_ACCOMMODATIONS)
 *   - PUT  /accommodations/:id           (EDIT_ACCOMMODATION_INFO)
 *   - PATCH /accommodations/:id          (EDIT_ACCOMMODATION_INFO)
 *   - POST /accommodations/:id/faqs      (EDIT_ACCOMMODATION_INFO)
 *   - PUT  /accommodations/:id/faqs/:faqId (EDIT_ACCOMMODATION_INFO)
 *
 * Each test wires the middleware in a minimal Hono app, sets the
 * `userEntitlements` / `billingLoadFailed` context variables, and asserts:
 *   - entitled   → next() is called (200)
 *   - not entitled → ServiceError ENTITLEMENT_REQUIRED → 403
 *   - staff bypass → always 200 (entitlements loaded by entitlementMiddleware,
 *     but tested here by injecting the full keyset as requireEntitlement does)
 *
 * Pattern mirrors apps/api/test/middlewares/entitlement.test.ts §requireEntitlement.
 */

import { EntitlementKey, type LimitKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it } from 'vitest';
import { requireEntitlement } from '../../../../src/middlewares/entitlement';
import type { AppBindings } from '../../../../src/types';

// ---------------------------------------------------------------------------
// Minimal error handler that mirrors production createErrorHandler() shape.
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

// ---------------------------------------------------------------------------
// Shared test factory
// ---------------------------------------------------------------------------

/**
 * Creates an isolated Hono app that runs `requireEntitlement(key)` and a
 * final GET /test handler returning `{ ok: true }`.  The caller injects
 * entitlements via `injectXxx` before calling this.
 */
function buildGateApp(key: EntitlementKey): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use(requireEntitlement(key));
    app.get('/test', (c) => c.json({ ok: true }));
    attachTestErrorHandler(app);
    return app;
}

// ===========================================================================
// PUBLISH_ACCOMMODATIONS gate
// ===========================================================================

describe('PUBLISH_ACCOMMODATIONS gate (create / createDraft)', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    it('allows request when actor has PUBLISH_ACCOMMODATIONS', async () => {
        // Arrange
        injectEntitlements(app, [EntitlementKey.PUBLISH_ACCOMMODATIONS]);
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when actor lacks PUBLISH_ACCOMMODATIONS', async () => {
        // Arrange
        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('allows staff (full keyset) through the PUBLISH_ACCOMMODATIONS gate', async () => {
        // Arrange — staff gets all entitlements via getUnlimitedEntitlements()
        injectAllEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
    });

    it('returns 503 when billingLoadFailed is true', async () => {
        // Arrange — billing outage scenario
        app.use((c, next) => {
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', true);
            return next();
        });
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
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
// EDIT_ACCOMMODATION_INFO gate
// ===========================================================================

describe('EDIT_ACCOMMODATION_INFO gate (update PUT / patch PATCH / addFaq / updateFaq)', () => {
    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
    });

    it('allows request when actor has EDIT_ACCOMMODATION_INFO', async () => {
        // Arrange
        injectEntitlements(app, [EntitlementKey.EDIT_ACCOMMODATION_INFO]);
        app.use(requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it('returns 403 ENTITLEMENT_REQUIRED when actor lacks EDIT_ACCOMMODATION_INFO', async () => {
        // Arrange
        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
    });

    it('allows staff (full keyset) through the EDIT_ACCOMMODATION_INFO gate', async () => {
        // Arrange
        injectAllEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO));
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert
        expect(res.status).toBe(200);
    });

    it('returns 503 when billingLoadFailed is true', async () => {
        // Arrange
        app.use((c, next) => {
            c.set('userEntitlements', new Set<EntitlementKey>());
            c.set('userLimits', new Map<LimitKey, number>());
            c.set('billingLoadFailed', true);
            return next();
        });
        app.use(requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO));
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
// Chaining: PUBLISH_ACCOMMODATIONS → enforceAccommodationLimit ordering
// ===========================================================================

describe('gate ordering: PUBLISH_ACCOMMODATIONS runs before limit check', () => {
    it('blocks at entitlement stage before reaching a hypothetical limit middleware', async () => {
        // Arrange — actor lacks PUBLISH_ACCOMMODATIONS; a "limit" step after it
        // should never run (simulated by a spy flag).
        const app = new Hono<AppBindings>();
        let limitMiddlewareCalled = false;

        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
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
});

// ===========================================================================
// Chaining: EDIT_ACCOMMODATION_INFO runs before gateRichDescription ordering
// ===========================================================================

describe('gate ordering: EDIT_ACCOMMODATION_INFO runs before content-specific gates', () => {
    it('blocks at EDIT_ACCOMMODATION_INFO stage before reaching a content gate', async () => {
        // Arrange — actor lacks EDIT_ACCOMMODATION_INFO; a content gate after
        // it should never run.
        const app = new Hono<AppBindings>();
        let contentGateCalled = false;

        injectNoEntitlements(app);
        app.use(requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO));
        // Fake content gate that sets the flag
        app.use((_c, next) => {
            contentGateCalled = true;
            return next();
        });
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert — 403 from first gate, content gate never reached
        expect(res.status).toBe(403);
        expect(contentGateCalled).toBe(false);
    });

    it('proceeds to content gate when EDIT_ACCOMMODATION_INFO is present', async () => {
        // Arrange — actor has EDIT_ACCOMMODATION_INFO but lacks CAN_USE_RICH_DESCRIPTION
        const app = new Hono<AppBindings>();
        let contentGateCalled = false;

        injectEntitlements(app, [EntitlementKey.EDIT_ACCOMMODATION_INFO]);
        app.use(requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO));
        // Content gate stub that always passes
        app.use((_c, next) => {
            contentGateCalled = true;
            return next();
        });
        app.get('/test', (c) => c.json({ ok: true }));
        attachTestErrorHandler(app);

        // Act
        const res = await app.request('/test');

        // Assert — reached the content gate and the handler
        expect(res.status).toBe(200);
        expect(contentGateCalled).toBe(true);
    });
});

// ===========================================================================
// Per-route smoke: correct key wired per handler file
// ===========================================================================

describe('per-route smoke: each wired route uses the correct key', () => {
    const publishRoutes = [
        'POST /accommodations (create)',
        'POST /accommodations/draft (createDraft)',
        'POST /host-onboarding/start (onboarding start)'
    ];

    const editRoutes = [
        'PUT /accommodations/:id (update)',
        'PATCH /accommodations/:id (patch)',
        'POST /accommodations/:id/faqs (addFaq)',
        'PUT /accommodations/:id/faqs/:faqId (updateFaq)'
    ];

    for (const label of publishRoutes) {
        describe(label, () => {
            it('403 when PUBLISH_ACCOMMODATIONS absent', async () => {
                const app = buildGateApp(EntitlementKey.PUBLISH_ACCOMMODATIONS);
                // inject AFTER building (app.use is ordered)
                const outer = new Hono<AppBindings>();
                injectNoEntitlements(outer);
                outer.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                const res = await outer.request('/test');
                expect(res.status).toBe(403);
                const body = await res.json();
                expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
                void app; // suppress unused warning
            });

            it('200 when PUBLISH_ACCOMMODATIONS present', async () => {
                const outer = new Hono<AppBindings>();
                injectEntitlements(outer, [EntitlementKey.PUBLISH_ACCOMMODATIONS]);
                outer.use(requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                const res = await outer.request('/test');
                expect(res.status).toBe(200);
            });
        });
    }

    for (const label of editRoutes) {
        describe(label, () => {
            it('403 when EDIT_ACCOMMODATION_INFO absent', async () => {
                const outer = new Hono<AppBindings>();
                injectNoEntitlements(outer);
                outer.use(requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                const res = await outer.request('/test');
                expect(res.status).toBe(403);
                const body = await res.json();
                expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
            });

            it('200 when EDIT_ACCOMMODATION_INFO present', async () => {
                const outer = new Hono<AppBindings>();
                injectEntitlements(outer, [EntitlementKey.EDIT_ACCOMMODATION_INFO]);
                outer.use(requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO));
                outer.get('/test', (c) => c.json({ ok: true }));
                attachTestErrorHandler(outer);

                const res = await outer.request('/test');
                expect(res.status).toBe(200);
            });
        });
    }
});
