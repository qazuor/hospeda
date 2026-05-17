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

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';
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
