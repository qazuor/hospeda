/**
 * Unit tests for the SPEC-141 D7 downgrade branch of `handlePlanChange`.
 *
 * Covers:
 * - Happy path: route delegates to `scheduleSubscriptionDowngrade` and
 *   returns the `status: 'scheduled'` response shape with effectiveAt
 *   set to the schedule's applyAt.
 * - `billing.subscriptions.changePlan` is NOT called (the mutation
 *   happens later via the apply-scheduled-plan-changes cron).
 * - Service errors map to 404/422 via mapDowngradeErrorToHttp.
 * - Audit log is emitted at request-time with the right resourceId.
 * - The actor id is forwarded as `requestedBy` for audit linkage.
 * - Common short-circuits (503 billingEnabled, 400 customer) are
 *   covered by `plan-change.test.ts` and `plan-change-upgrade.test.ts`
 *   — this file only exercises the downgrade branch.
 * - SPEC-167 T-016: restrictionPreview included in scheduled response
 *   (over-cap host), present with hasExcess=false (under-cap), absent
 *   on soft-fail (computeDowngradeExcess throws), absent on upgrade path.
 *
 * @module test/routes/billing/plan-change-downgrade
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

const { auditLogMock } = vi.hoisted(() => ({ auditLogMock: vi.fn() }));
vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: auditLogMock,
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

// Mock the downgrade service so the route test stays focused on
// branch-dispatch / response-shape / error-mapping concerns. The
// service itself has its own unit tests
// (`subscription-downgrade.service.test.ts`).
vi.mock('../../../src/services/subscription-downgrade.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        scheduleSubscriptionDowngrade: vi.fn()
    };
});

// SPEC-167 T-016: mock computeDowngradeExcess so route tests stay focused on
// response-shape / soft-fail semantics. The service has its own test suite.
vi.mock('../../../src/services/subscription-downgrade-excess.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        computeDowngradeExcess: vi.fn(),
        defaultExcessDeps: {}
    };
});

// Stub upgrade service for the "upgrade path: no preview" regression test.
vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        initiatePaidPlanUpgrade: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import type { DowngradePreview } from '@repo/schemas';
import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';
import { computeDowngradeExcess } from '../../../src/services/subscription-downgrade-excess.service';
import {
    SubscriptionDowngradeError,
    scheduleSubscriptionDowngrade
} from '../../../src/services/subscription-downgrade.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const ACTOR_ID = '00000000-0000-4000-8000-000000000002';
const SUB_ID = 'sub_downgrade_1';
const CURRENT_PLAN_ID = 'plan_pro';
const TARGET_PLAN_ID = 'plan_basic';
const APPLY_AT_ISO = '2026-07-01T00:00:00.000Z';

function makeContext(body: unknown = { newPlanId: TARGET_PLAN_ID, billingInterval: 'monthly' }) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID],
        ['actor', { id: ACTOR_ID, role: 'USER', permissions: [] }]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        req: { json: vi.fn().mockResolvedValue(body) }
    };
}

function makeDowngradeBillingMock() {
    // Setup represents a DOWNGRADE: pro (15k centavos) → basic (5k).
    // The route determines isUpgrade=false, falls through to the
    // downgrade branch, and calls `scheduleSubscriptionDowngrade`
    // (which we mock above) to write the queued change.
    // plan.name == TARGET_PLAN_ID: used as targetPlanSlug in T-016 preview call.
    const activeSub = {
        id: SUB_ID,
        planId: CURRENT_PLAN_ID,
        status: 'active',
        interval: 'month'
    };
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([activeSub]),
            changePlan: vi.fn(), // must NOT be called — the cron does it
            update: vi.fn() // also not called from the route, the service mock owns this
        },
        plans: {
            get: vi.fn().mockImplementation((id: string) => {
                if (id === CURRENT_PLAN_ID) {
                    return Promise.resolve({
                        id: CURRENT_PLAN_ID,
                        name: CURRENT_PLAN_ID,
                        prices: [
                            {
                                id: 'price_pro_monthly',
                                billingInterval: 'month',
                                unitAmount: 15_000,
                                intervalCount: 1
                            }
                        ]
                    });
                }
                return Promise.resolve({
                    id: TARGET_PLAN_ID,
                    // name is used as targetPlanSlug for computeDowngradeExcess (T-016)
                    name: TARGET_PLAN_ID,
                    prices: [
                        {
                            id: 'price_basic_monthly',
                            billingInterval: 'month',
                            unitAmount: 5_000,
                            intervalCount: 1
                        }
                    ]
                });
            })
        }
    };
}

function mockBilling(billing: ReturnType<typeof makeDowngradeBillingMock>) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange — SPEC-141 D7 downgrade branch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('delegates to scheduleSubscriptionDowngrade and returns scheduled response', async () => {
        const billing = makeDowngradeBillingMock();
        mockBilling(billing);
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        });

        const ctx = makeContext();
        const result = await handlePlanChange(ctx as never);

        expect(result).toEqual({
            status: 'scheduled',
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            effectiveAt: APPLY_AT_ISO
        });
        // The legacy synchronous changePlan path must NOT run.
        expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
    });

    it('passes billingInterval, intervalCount and actor.id (requestedBy) to the service', async () => {
        const billing = makeDowngradeBillingMock();
        mockBilling(billing);
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        });

        const ctx = makeContext();
        await handlePlanChange(ctx as never);

        const call = vi.mocked(scheduleSubscriptionDowngrade).mock.calls[0]?.[0];
        expect(call?.currentSubscriptionId).toBe(SUB_ID);
        expect(call?.newPlanId).toBe(TARGET_PLAN_ID);
        expect(call?.billingInterval).toBe('month');
        expect(call?.intervalCount).toBe(1);
        expect(call?.requestedBy).toBe(ACTOR_ID);
    });

    it('emits an audit log entry at request-time with the right resourceId', async () => {
        const billing = makeDowngradeBillingMock();
        mockBilling(billing);
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        });

        const ctx = makeContext();
        await handlePlanChange(ctx as never);

        expect(auditLogMock).toHaveBeenCalledOnce();
        expect(auditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: ACTOR_ID,
                action: 'update',
                resourceType: 'subscription_plan',
                resourceId: SUB_ID
            })
        );
    });

    it('returns 404 when service throws SUBSCRIPTION_NOT_FOUND', async () => {
        mockBilling(makeDowngradeBillingMock());
        vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(
            new SubscriptionDowngradeError('SUBSCRIPTION_NOT_FOUND', 'gone')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 404 });
    });

    it('returns 404 when service throws PLAN_NOT_FOUND', async () => {
        mockBilling(makeDowngradeBillingMock());
        vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(
            new SubscriptionDowngradeError('PLAN_NOT_FOUND', 'no plan')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 404 });
    });

    it('returns 404 when service throws NO_MATCHING_PRICE', async () => {
        mockBilling(makeDowngradeBillingMock());
        vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(
            new SubscriptionDowngradeError('NO_MATCHING_PRICE', 'no price')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 404 });
    });

    it('returns 422 when service throws SAME_PLAN', async () => {
        mockBilling(makeDowngradeBillingMock());
        vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(
            new SubscriptionDowngradeError('SAME_PLAN', 'same')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 422 });
    });

    it('returns 422 when service throws NOT_A_DOWNGRADE', async () => {
        mockBilling(makeDowngradeBillingMock());
        vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(
            new SubscriptionDowngradeError('NOT_A_DOWNGRADE', 'target >= current')
        );

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 422 });
    });

    it('non-SubscriptionDowngradeError from the service surfaces as 500', async () => {
        mockBilling(makeDowngradeBillingMock());
        vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(new Error('Network down'));

        const ctx = makeContext();
        await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 500 });
    });
});

// ---------------------------------------------------------------------------
// SPEC-167 T-016: restrictionPreview in downgrade response
// ---------------------------------------------------------------------------

/** Minimal DowngradePreview with excess (over-cap scenario). */
function makeExcessPreview(): DowngradePreview {
    return {
        accommodations: {
            cap: 1,
            activeCount: 3,
            excessCount: 2,
            items: [
                {
                    id: '00000000-0000-4000-8000-000000000011',
                    name: 'Accom A',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: '00000000-0000-4000-8000-000000000012',
                    name: 'Accom B',
                    updatedAt: '2025-12-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                },
                {
                    id: '00000000-0000-4000-8000-000000000013',
                    name: 'Accom C',
                    updatedAt: '2025-11-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ]
        },
        promotions: { cap: 0, activeCount: 0, excessCount: 0, items: [] },
        photos: [],
        grandfatherFlags: [],
        hasExcess: true
    };
}

/** Minimal DowngradePreview with no excess (under-cap scenario). */
function makeNoExcessPreview(): DowngradePreview {
    return {
        accommodations: { cap: 3, activeCount: 1, excessCount: 0, items: [] },
        promotions: { cap: 0, activeCount: 0, excessCount: 0, items: [] },
        photos: [],
        grandfatherFlags: [],
        hasExcess: false
    };
}

describe('handlePlanChange — SPEC-167 T-016: restrictionPreview in downgrade response', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: computeDowngradeExcess returns an excess preview.
        vi.mocked(computeDowngradeExcess).mockResolvedValue(makeExcessPreview());
    });

    it('includes restrictionPreview in the scheduled response when host is over-cap', async () => {
        const billing = makeDowngradeBillingMock();
        mockBilling(billing);
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        });

        const ctx = makeContext();
        const result = await handlePlanChange(ctx as never);

        expect(result).toMatchObject({
            status: 'scheduled',
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            effectiveAt: APPLY_AT_ISO,
            restrictionPreview: expect.objectContaining({ hasExcess: true })
        });
        expect(vi.mocked(computeDowngradeExcess)).toHaveBeenCalledOnce();
    });

    it('includes restrictionPreview with hasExcess=false when host is under-cap', async () => {
        vi.mocked(computeDowngradeExcess).mockResolvedValue(makeNoExcessPreview());
        const billing = makeDowngradeBillingMock();
        mockBilling(billing);
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        });

        const ctx = makeContext();
        const result = (await handlePlanChange(ctx as never)) as Record<string, unknown>;

        expect(result).toHaveProperty('restrictionPreview');
        const preview = result.restrictionPreview as DowngradePreview;
        expect(preview.hasExcess).toBe(false);
    });

    it('soft-fail: returns 200 response WITHOUT restrictionPreview when computeDowngradeExcess throws', async () => {
        vi.mocked(computeDowngradeExcess).mockRejectedValue(
            new Error('plan slug not found in catalog')
        );
        const billing = makeDowngradeBillingMock();
        mockBilling(billing);
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        });

        const ctx = makeContext();
        const result = (await handlePlanChange(ctx as never)) as Record<string, unknown>;

        // Scheduling succeeded — must not throw.
        expect(result).toMatchObject({
            status: 'scheduled',
            subscriptionId: SUB_ID
        });
        // Preview was unavailable — field must be absent.
        expect(result).not.toHaveProperty('restrictionPreview');
    });

    it('soft-fail: warns when preview computation throws (not error log)', async () => {
        const { apiLogger } = await import('../../../src/utils/logger');
        vi.mocked(computeDowngradeExcess).mockRejectedValue(new Error('catalog miss'));
        mockBilling(makeDowngradeBillingMock());
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        });

        const ctx = makeContext();
        await handlePlanChange(ctx as never);

        expect(vi.mocked(apiLogger.warn)).toHaveBeenCalledOnce();
        expect(vi.mocked(apiLogger.error)).not.toHaveBeenCalled();
    });

    it('computeDowngradeExcess is called with actor userId and target plan slug (= plan.name)', async () => {
        const billing = makeDowngradeBillingMock();
        mockBilling(billing);
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        });

        const ctx = makeContext();
        await handlePlanChange(ctx as never);

        const call = vi.mocked(computeDowngradeExcess).mock.calls[0];
        // First arg is the input object.
        expect(call?.[0]).toMatchObject({
            userId: ACTOR_ID,
            targetPlanSlug: TARGET_PLAN_ID // plan.name === plan id in our mock
        });
    });

    it('preview computation runs AFTER scheduling (schedule-first order)', async () => {
        const callOrder: string[] = [];
        vi.mocked(scheduleSubscriptionDowngrade).mockImplementation(async () => {
            callOrder.push('schedule');
            return {
                subscriptionId: SUB_ID,
                previousPlanId: CURRENT_PLAN_ID,
                newPlanId: TARGET_PLAN_ID,
                applyAt: APPLY_AT_ISO,
                replacedPriorSchedule: false
            };
        });
        vi.mocked(computeDowngradeExcess).mockImplementation(async () => {
            callOrder.push('preview');
            return makeExcessPreview();
        });

        mockBilling(makeDowngradeBillingMock());
        const ctx = makeContext();
        await handlePlanChange(ctx as never);

        expect(callOrder).toEqual(['schedule', 'preview']);
    });

    it('upgrade path: restrictionPreview is NOT included in the response', async () => {
        // Upgrade: target price > current price → isUpgrade branch, no preview.
        const upgradeBilling = {
            subscriptions: {
                getByCustomerId: vi.fn().mockResolvedValue([
                    {
                        id: 'sub_upgrade',
                        planId: 'plan_basic',
                        status: 'active',
                        interval: 'month',
                        intervalCount: 1
                    }
                ]),
                changePlan: vi.fn()
            },
            plans: {
                get: vi.fn().mockImplementation((id: string) => {
                    if (id === 'plan_basic') {
                        return Promise.resolve({
                            id: 'plan_basic',
                            name: 'owner-basico',
                            prices: [
                                {
                                    billingInterval: 'month',
                                    unitAmount: 5_000,
                                    intervalCount: 1
                                }
                            ]
                        });
                    }
                    return Promise.resolve({
                        id: 'plan_pro',
                        name: 'owner-pro',
                        prices: [{ billingInterval: 'month', unitAmount: 15_000, intervalCount: 1 }]
                    });
                })
            }
        };
        vi.mocked(getQZPayBilling).mockReturnValue(
            upgradeBilling as unknown as ReturnType<typeof getQZPayBilling>
        );

        // initiatePaidPlanUpgrade is not mocked here — it will throw. The important
        // thing is that computeDowngradeExcess is NOT called before the upgrade branch
        // short-circuits.
        const { initiatePaidPlanUpgrade } = await import(
            '../../../src/services/subscription-checkout.service'
        );
        vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(new Error('upgrade fail'));

        const ctx = makeContext({ newPlanId: 'plan_pro', billingInterval: 'monthly' });
        await handlePlanChange(ctx as never).catch(() => undefined);

        expect(vi.mocked(computeDowngradeExcess)).not.toHaveBeenCalled();
    });
});
