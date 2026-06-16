/**
 * @file billing-plan-change-flow.integration.test.ts
 * @description Integration tests for the billingApi web client (SPEC-203 T-011).
 *
 * Covers the full self-serve plan-management flow by mocking HTTP responses and
 * asserting that:
 *   1. `previewDowngrade` hits the correct URL with the `targetPlan` query param
 *      and surfaces a valid DowngradePreview on success.
 *   2. `changePlan` correctly surfaces every branch of the PlanChangeResponse
 *      discriminated union: 'active', 'scheduled' (with restrictionPreview), and
 *      'pending_payment' (with checkoutUrl + localSubscriptionId).
 *   3. `cancelSubscription` calls the soft-cancel POST endpoint (not DELETE) and
 *      returns the expected confirmation shape.
 *   4. Non-2xx responses return the ApiResult error shape (ok: false) without
 *      throwing.
 *
 * Fetch is mocked globally via `global.fetch = vi.fn()`. The `@/lib/env` module
 * is module-mocked to bypass `validateWebEnv()` which reads `import.meta.env`
 * and is unavailable in the Vitest jsdom context (same pattern as
 * apps/web/test/lib/billing/fetch-plans.test.ts).
 */

import type {
    DowngradePreview,
    PlanChangeResponse,
    UserCancelSubscriptionResponse
} from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { billingApi } from '../../../src/lib/api/endpoints-protected';
import type { ApiResult } from '../../../src/lib/api/types';

// ---------------------------------------------------------------------------
// Module mock — bypass validateWebEnv() which needs import.meta.env
// ---------------------------------------------------------------------------

vi.mock('@/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test')
}));

// ---------------------------------------------------------------------------
// Helpers — fetch mock factories
// ---------------------------------------------------------------------------

/**
 * Wraps `data` in the standard ResponseFactory envelope `{ success: true, data }`
 * and returns it as a 200 ok Response mock.
 */
function mockFetchOk(data: unknown): void {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data })
    } as Response);
}

/**
 * Returns a non-OK Response mock with the given HTTP status and an error body
 * that matches the ApiErrorResponse shape expected by `parseError`.
 */
function mockFetchHttpError(status: number, message = 'Request failed'): void {
    global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status,
        json: () => Promise.resolve({ error: { code: 'INTERNAL_ERROR', message } })
    } as Response);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal valid DowngradePreview fixture (SPEC-203 UI contract).
 * `hasExcess: true` with one accommodation over the cap.
 */
const PREVIEW_FIXTURE: DowngradePreview = {
    accommodations: {
        cap: 1,
        activeCount: 3,
        excessCount: 2,
        items: [
            {
                id: '00000000-0000-0000-0000-000000000001',
                name: 'Hostal del Sur',
                updatedAt: '2026-01-15T10:00:00.000Z',
                viewCount: 120,
                keepByDefault: true
            },
            {
                id: '00000000-0000-0000-0000-000000000002',
                name: 'Cabaña del Norte',
                updatedAt: '2026-01-10T08:00:00.000Z',
                viewCount: 80,
                keepByDefault: false
            },
            {
                id: '00000000-0000-0000-0000-000000000003',
                name: 'Posada del Centro',
                updatedAt: '2026-01-05T06:00:00.000Z',
                viewCount: 40,
                keepByDefault: false
            }
        ]
    },
    promotions: {
        cap: 0,
        activeCount: 1,
        excessCount: 1,
        items: [
            {
                id: '00000000-0000-0000-0000-000000000010',
                name: 'Promo Verano',
                updatedAt: '2026-01-20T12:00:00.000Z',
                viewCount: null,
                keepByDefault: false
            }
        ]
    },
    photos: [
        {
            accommodationId: '00000000-0000-0000-0000-000000000002',
            accommodationName: 'Cabaña del Norte',
            cap: 5,
            totalCount: 8,
            excessCount: 3,
            hasFeaturedImage: true,
            overflowPhotoUrls: [
                'https://cdn.example.com/img6.jpg',
                'https://cdn.example.com/img7.jpg',
                'https://cdn.example.com/img8.jpg'
            ]
        }
    ],
    grandfatherFlags: [
        {
            accommodationId: '00000000-0000-0000-0000-000000000001',
            accommodationName: 'Hostal del Sur',
            hasRichDescription: true,
            hasVideoEmbed: false
        }
    ],
    hasExcess: true
};

/**
 * Fixture for the 'active' branch: plan change applied immediately.
 */
const PLAN_CHANGE_ACTIVE_FIXTURE: PlanChangeResponse = {
    status: 'active',
    subscriptionId: 'sub-00000000-0000-0000-0000-000000000001',
    previousPlanId: 'plan-00000000-0000-0000-0000-000000000001',
    newPlanId: 'plan-00000000-0000-0000-0000-000000000002',
    effectiveAt: '2026-01-16T00:00:00.000Z'
};

/**
 * Fixture for the 'scheduled' branch: downgrade scheduled for period end.
 * Carries `restrictionPreview` so the UI can warn the host.
 */
const PLAN_CHANGE_SCHEDULED_FIXTURE: PlanChangeResponse = {
    status: 'scheduled',
    subscriptionId: 'sub-00000000-0000-0000-0000-000000000001',
    previousPlanId: 'plan-00000000-0000-0000-0000-000000000002',
    newPlanId: 'plan-00000000-0000-0000-0000-000000000001',
    effectiveAt: '2026-02-01T00:00:00.000Z',
    restrictionPreview: PREVIEW_FIXTURE
};

/**
 * Fixture for the 'pending_payment' branch: upgrade requires MP checkout.
 * The UI must redirect to `checkoutUrl` and poll on return.
 */
const PLAN_CHANGE_PENDING_PAYMENT_FIXTURE: PlanChangeResponse = {
    status: 'pending_payment',
    checkoutUrl:
        'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=plan_abc',
    localSubscriptionId: 'sub-00000000-0000-0000-0000-000000000001',
    expiresAt: '2026-01-16T01:00:00.000Z',
    newPlanId: 'plan-00000000-0000-0000-0000-000000000003',
    deltaCentavos: 2000000
};

// ---------------------------------------------------------------------------
// Tests — previewDowngrade
// ---------------------------------------------------------------------------

describe('billingApi.previewDowngrade', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('successful response', () => {
        it('should return ok:true with the DowngradePreview data on a 200 response', async () => {
            // Arrange
            mockFetchOk(PREVIEW_FIXTURE);

            // Act
            const result: ApiResult<DowngradePreview> = await billingApi.previewDowngrade({
                targetPlan: 'owner-basico'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.data.hasExcess).toBe(true);
            expect(result.data.accommodations.excessCount).toBe(2);
            expect(result.data.accommodations.cap).toBe(1);
        });

        it('should call the correct downgrade-preview URL', async () => {
            // Arrange
            mockFetchOk(PREVIEW_FIXTURE);

            // Act
            await billingApi.previewDowngrade({ targetPlan: 'owner-basico' });

            // Assert
            expect(global.fetch).toHaveBeenCalledOnce();
            const [calledUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(calledUrl).toContain(
                '/api/v1/protected/billing/subscriptions/downgrade-preview'
            );
        });

        it('should include the targetPlan query parameter in the request URL', async () => {
            // Arrange
            mockFetchOk(PREVIEW_FIXTURE);

            // Act
            await billingApi.previewDowngrade({ targetPlan: 'owner-pro' });

            // Assert
            const [calledUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(calledUrl).toContain('targetPlan=owner-pro');
        });

        it('should surface promotions excess data correctly', async () => {
            // Arrange
            mockFetchOk(PREVIEW_FIXTURE);

            // Act
            const result = await billingApi.previewDowngrade({ targetPlan: 'owner-basico' });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.data.promotions.excessCount).toBe(1);
            expect(result.data.promotions.items[0]?.name).toBe('Promo Verano');
        });

        it('should surface photo overflow data correctly', async () => {
            // Arrange
            mockFetchOk(PREVIEW_FIXTURE);

            // Act
            const result = await billingApi.previewDowngrade({ targetPlan: 'owner-basico' });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.data.photos).toHaveLength(1);
            expect(result.data.photos[0]?.excessCount).toBe(3);
            expect(result.data.photos[0]?.overflowPhotoUrls).toHaveLength(3);
        });

        it('should surface grandfatherFlags correctly', async () => {
            // Arrange
            mockFetchOk(PREVIEW_FIXTURE);

            // Act
            const result = await billingApi.previewDowngrade({ targetPlan: 'owner-basico' });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.data.grandfatherFlags).toHaveLength(1);
            expect(result.data.grandfatherFlags[0]?.hasRichDescription).toBe(true);
        });
    });

    describe('error cases', () => {
        it('should return ok:false with an error object on HTTP 401', async () => {
            // Arrange
            mockFetchHttpError(401, 'Unauthorized');

            // Act
            const result = await billingApi.previewDowngrade({ targetPlan: 'owner-basico' });

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error.status).toBe(401);
            expect(result.error.message).toBe('Unauthorized');
        });

        it('should return ok:false with an error object on HTTP 422 (invalid targetPlan)', async () => {
            // Arrange
            mockFetchHttpError(422, 'targetPlan not found in billing catalog');

            // Act
            const result = await billingApi.previewDowngrade({ targetPlan: 'nonexistent-plan' });

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error.status).toBe(422);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — changePlan (three union branches)
// ---------------------------------------------------------------------------

describe('billingApi.changePlan', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("status: 'active' branch (immediate apply)", () => {
        it('should return ok:true with the applied result carrying effectiveAt', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_ACTIVE_FIXTURE);

            // Act
            const result: ApiResult<PlanChangeResponse> = await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000002',
                billingInterval: 'monthly'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.data.status).toBe('active');
            // Narrow to the applied branch for effectiveAt
            if (result.data.status !== 'active' && result.data.status !== 'scheduled') {
                throw new Error('Expected active or scheduled status');
            }
            expect(result.data.effectiveAt).toBe('2026-01-16T00:00:00.000Z');
            expect(result.data.subscriptionId).toBe('sub-00000000-0000-0000-0000-000000000001');
            expect(result.data.newPlanId).toBe('plan-00000000-0000-0000-0000-000000000002');
        });

        it('should send a POST request to the change-plan endpoint', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_ACTIVE_FIXTURE);

            // Act
            await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000002',
                billingInterval: 'monthly'
            });

            // Assert
            expect(global.fetch).toHaveBeenCalledOnce();
            const [calledUrl, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(calledUrl).toContain('/api/v1/protected/billing/subscriptions/change-plan');
            expect(init?.method).toBe('POST');
        });

        it('should include the X-Idempotency-Key header on the POST request', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_ACTIVE_FIXTURE);

            // Act
            await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000002',
                billingInterval: 'monthly'
            });

            // Assert
            const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            const headers = init?.headers as Record<string, string> | undefined;
            expect(headers?.['X-Idempotency-Key']).toBeDefined();
            // Must be a UUID v4 format
            expect(headers?.['X-Idempotency-Key']).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
        });
    });

    describe("status: 'scheduled' branch (downgrade scheduled for period end)", () => {
        it('should return ok:true with scheduled status and restrictionPreview', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_SCHEDULED_FIXTURE);

            // Act
            const result: ApiResult<PlanChangeResponse> = await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000001',
                billingInterval: 'monthly'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.data.status).toBe('scheduled');
            if (result.data.status !== 'scheduled') {
                throw new Error('Expected scheduled status');
            }
            expect(result.data.effectiveAt).toBe('2026-02-01T00:00:00.000Z');
        });

        it('should surface the restrictionPreview nested inside the scheduled response', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_SCHEDULED_FIXTURE);

            // Act
            const result: ApiResult<PlanChangeResponse> = await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000001',
                billingInterval: 'monthly'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            if (result.data.status !== 'active' && result.data.status !== 'scheduled') {
                throw new Error('Expected applied branch');
            }
            const preview = result.data.restrictionPreview;
            expect(preview).toBeDefined();
            expect(preview?.hasExcess).toBe(true);
            expect(preview?.accommodations.excessCount).toBe(2);
        });

        it('should send keepSelections in the request body when provided', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_SCHEDULED_FIXTURE);
            const keepSelections = {
                accommodationIds: ['00000000-0000-0000-0000-000000000001']
            };

            // Act
            await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000001',
                billingInterval: 'monthly',
                keepSelections
            });

            // Assert
            const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            const body = JSON.parse(init?.body as string) as unknown;
            expect(body).toMatchObject({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000001',
                billingInterval: 'monthly',
                keepSelections: { accommodationIds: ['00000000-0000-0000-0000-000000000001'] }
            });
        });
    });

    describe("status: 'pending_payment' branch (upgrade requires MP checkout)", () => {
        it('should return ok:true and surface the checkoutUrl for the MP redirect', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_PENDING_PAYMENT_FIXTURE);

            // Act
            const result: ApiResult<PlanChangeResponse> = await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000003',
                billingInterval: 'monthly'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.data.status).toBe('pending_payment');
            if (result.data.status !== 'pending_payment') {
                throw new Error('Expected pending_payment status');
            }
            expect(result.data.checkoutUrl).toContain('mercadopago.com.ar');
        });

        it('should surface the localSubscriptionId in the pending_payment response', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_PENDING_PAYMENT_FIXTURE);

            // Act
            const result: ApiResult<PlanChangeResponse> = await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000003',
                billingInterval: 'monthly'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            if (result.data.status !== 'pending_payment') {
                throw new Error('Expected pending_payment status');
            }
            expect(result.data.localSubscriptionId).toBe(
                'sub-00000000-0000-0000-0000-000000000001'
            );
        });

        it('should surface deltaCentavos and expiresAt in the pending_payment response', async () => {
            // Arrange
            mockFetchOk(PLAN_CHANGE_PENDING_PAYMENT_FIXTURE);

            // Act
            const result: ApiResult<PlanChangeResponse> = await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000003',
                billingInterval: 'monthly'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            if (result.data.status !== 'pending_payment') {
                throw new Error('Expected pending_payment status');
            }
            expect(result.data.deltaCentavos).toBe(2000000);
            expect(result.data.expiresAt).toBe('2026-01-16T01:00:00.000Z');
        });
    });

    describe('error cases', () => {
        it('should return ok:false on HTTP 422 (invalid plan transition)', async () => {
            // Arrange
            mockFetchHttpError(422, 'Invalid plan transition: cannot downgrade to a higher tier');

            // Act
            const result = await billingApi.changePlan({
                newPlanId: 'nonexistent-plan',
                billingInterval: 'monthly'
            });

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error.status).toBe(422);
        });

        it('should return ok:false on HTTP 409 (concurrent change already in progress)', async () => {
            // Arrange
            mockFetchHttpError(409, 'A plan change is already in progress for this subscription');

            // Act
            const result = await billingApi.changePlan({
                newPlanId: 'plan-00000000-0000-0000-0000-000000000001',
                billingInterval: 'monthly'
            });

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error.status).toBe(409);
            expect(result.error.message).toContain('already in progress');
        });
    });
});

// ---------------------------------------------------------------------------
// Tests — cancelSubscription
// ---------------------------------------------------------------------------

describe('billingApi.cancelSubscription', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    // The response shape returned by the API uses ISO strings for dates.
    // The client passes them through as-is (no coercion at the client layer).
    const CANCEL_RESPONSE = {
        subscriptionId: 'sub-00000000-0000-0000-0000-000000000001',
        cancelAtPeriodEnd: true as const,
        canceledAt: '2026-01-15T12:00:00.000Z',
        accessUntil: '2026-02-01T23:59:59.000Z'
    };

    describe('successful soft-cancel', () => {
        it('should return ok:true with the cancelAtPeriodEnd flag set to true', async () => {
            // Arrange
            mockFetchOk(CANCEL_RESPONSE);

            // Act
            const result: ApiResult<UserCancelSubscriptionResponse> =
                await billingApi.cancelSubscription({
                    subscriptionId: 'sub-00000000-0000-0000-0000-000000000001'
                });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            // cancelAtPeriodEnd is a Date after coerce.date() in the schema,
            // but the client returns raw API data — the schema coercion only
            // runs server-side. Here the client passes the value through as-is.
            expect(result.data.cancelAtPeriodEnd).toBe(true);
        });

        it('should return the subscription ID in the response', async () => {
            // Arrange
            mockFetchOk(CANCEL_RESPONSE);

            // Act
            const result = await billingApi.cancelSubscription({
                subscriptionId: 'sub-00000000-0000-0000-0000-000000000001'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            expect(result.data.subscriptionId).toBe('sub-00000000-0000-0000-0000-000000000001');
        });

        it('should call the soft-cancel POST endpoint (not DELETE)', async () => {
            // Arrange
            mockFetchOk(CANCEL_RESPONSE);

            // Act
            await billingApi.cancelSubscription({
                subscriptionId: 'sub-00000000-0000-0000-0000-000000000001'
            });

            // Assert — must be a POST, not DELETE
            expect(global.fetch).toHaveBeenCalledOnce();
            const [calledUrl, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(init?.method).toBe('POST');
            expect(calledUrl).toContain(
                '/api/v1/protected/billing/subscriptions/sub-00000000-0000-0000-0000-000000000001/cancel'
            );
        });

        it('should include the subscriptionId in the URL path (not the body)', async () => {
            // Arrange
            mockFetchOk(CANCEL_RESPONSE);

            // Act
            await billingApi.cancelSubscription({
                subscriptionId: 'sub-abc-123'
            });

            // Assert
            const [calledUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            expect(calledUrl).toContain('/sub-abc-123/cancel');
        });

        it('should send the optional reason in the request body', async () => {
            // Arrange
            mockFetchOk(CANCEL_RESPONSE);

            // Act
            await billingApi.cancelSubscription({
                subscriptionId: 'sub-00000000-0000-0000-0000-000000000001',
                reason: 'Too expensive for my current usage'
            });

            // Assert
            const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            const body = JSON.parse(init?.body as string) as unknown;
            expect(body).toMatchObject({
                reason: 'Too expensive for my current usage'
            });
        });

        it('should surface the accessUntil date from the response', async () => {
            // Arrange
            mockFetchOk(CANCEL_RESPONSE);

            // Act
            const result = await billingApi.cancelSubscription({
                subscriptionId: 'sub-00000000-0000-0000-0000-000000000001'
            });

            // Assert
            expect(result.ok).toBe(true);
            if (!result.ok) throw new Error('Expected ok:true');
            // The client passes the raw ISO string through (no coercion at client layer)
            expect(result.data.accessUntil).toBe('2026-02-01T23:59:59.000Z');
        });
    });

    describe('error cases', () => {
        it('should return ok:false (not throw) on HTTP 404 (subscription not found)', async () => {
            // Arrange
            mockFetchHttpError(404, 'Subscription not found');

            // Act
            const result = await billingApi.cancelSubscription({
                subscriptionId: 'sub-nonexistent'
            });

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error.status).toBe(404);
            expect(result.error.message).toBe('Subscription not found');
        });

        it('should return ok:false (not throw) on HTTP 500', async () => {
            // Arrange
            mockFetchHttpError(500, 'Internal server error');

            // Act
            const result = await billingApi.cancelSubscription({
                subscriptionId: 'sub-00000000-0000-0000-0000-000000000001'
            });

            // Assert
            expect(result.ok).toBe(false);
            if (result.ok) throw new Error('Expected ok:false');
            expect(result.error.status).toBe(500);
        });
    });
});
