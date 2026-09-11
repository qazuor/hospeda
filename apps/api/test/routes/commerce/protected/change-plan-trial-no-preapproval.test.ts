/**
 * HOS-1236 — the COMMERCE half of the three-vertical fix.
 *
 * `applyTrialingPlanUpgrade` is shared: `billing/plan-change.ts` drives it for
 * accommodation, `commerce/protected/change-plan.ts` for gastronomy and
 * experience. All three therefore answered 502 to a trial with no MercadoPago
 * preapproval — which, since HOS-1012, is EVERY trial on the platform.
 *
 * The refusal is now `ServiceError(ALREADY_EXISTS, reason:
 * 'TRIAL_REQUIRES_CHECKOUT')` / HTTP 409, thrown at the one shared site. This
 * suite exists because "shared" is a claim about the code, not about what the
 * caller receives: `mapCommerceUpgradeErrorToHttp` is a deliberate NEAR-COPY of
 * the accommodation mapper, and the commerce handler's catch chain is its own.
 * Either could swallow the reason or re-wrap the error into a 5xx without a
 * single line of the accommodation path changing — which is exactly how a fix
 * for one vertical reopens the gap in the other two.
 *
 * Unlike the sibling `change-plan.test.ts`, this file leaves
 * `trialing-plan-upgrade.service` REAL. That module is what decides; mocking it
 * would leave this suite asserting against its own stub.
 *
 * @module test/routes/commerce/protected/change-plan-trial-no-preapproval
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mocks (declared BEFORE the import of the route under test).
// ──────────────────────────────────────────────────────────────────────────

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const mockEnv = vi.hoisted<{
    HOSPEDA_COMMERCE_PLAN_SLUGS?: string;
    HOSPEDA_SITE_URL: string;
    HOSPEDA_API_URL: string;
    HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR?: string;
}>(() => ({
    HOSPEDA_COMMERCE_PLAN_SLUGS: undefined,
    HOSPEDA_SITE_URL: 'https://hospeda.test',
    HOSPEDA_API_URL: 'https://api.hospeda.test',
    HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
}));
vi.mock('../../../../src/utils/env', () => ({
    env: mockEnv,
    validateApiEnv: vi.fn()
}));

vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ use: vi.fn(), route: vi.fn() }))
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../../src/middlewares/authorization', () => ({
    protectedAuthMiddleware: vi.fn(() => (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../../src/middlewares/idempotency-key', () => ({
    idempotencyKeyMiddleware: vi.fn(() => (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: (ctx: { get: (key: string) => unknown }) => ctx.get('actor')
}));

vi.mock('../../../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing_mutation' }
}));

const { mockGetQZPayBilling } = vi.hoisted(() => ({ mockGetQZPayBilling: vi.fn() }));
vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

const { mockFindOwnerVerticalSubscription } = vi.hoisted(() => ({
    mockFindOwnerVerticalSubscription: vi.fn()
}));
vi.mock('../../../../src/services/commerce-subscription-attach.service', () => ({
    findOwnerVerticalSubscription: mockFindOwnerVerticalSubscription
}));

const { mockResolvePlanBySlug, mockInitiatePaidPlanUpgrade } = vi.hoisted(() => ({
    mockResolvePlanBySlug: vi.fn(),
    mockInitiatePaidPlanUpgrade: vi.fn()
}));
// `importOriginal` so `SubscriptionCheckoutError` stays the REAL class — the
// handler's `instanceof` checks are what route an error to the 502 mapper, and a
// stubbed class would make them silently never match, which is the outcome this
// suite is trying to distinguish from the fix working.
vi.mock('../../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../../../src/services/subscription-checkout.service')
        >();
    return {
        ...actual,
        resolvePlanBySlug: mockResolvePlanBySlug,
        initiatePaidPlanUpgrade: mockInitiatePaidPlanUpgrade
    };
});

// NOTE the deliberate absence of a `trialing-plan-upgrade.service` mock.

const { mockScheduleSubscriptionDowngrade } = vi.hoisted(() => ({
    mockScheduleSubscriptionDowngrade: vi.fn()
}));
vi.mock('../../../../src/services/subscription-downgrade.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../../../src/services/subscription-downgrade.service')
        >();
    return { ...actual, scheduleSubscriptionDowngrade: mockScheduleSubscriptionDowngrade };
});

const { mockComputeCommerceDowngradeExcess } = vi.hoisted(() => ({
    mockComputeCommerceDowngradeExcess: vi.fn()
}));
vi.mock('../../../../src/services/commerce-downgrade-remediation.service', () => ({
    computeCommerceDowngradeExcess: mockComputeCommerceDowngradeExcess,
    restoreCommerceListingsForUpgrade: vi.fn().mockResolvedValue(undefined)
}));

const { mockSendNotification } = vi.hoisted(() => ({ mockSendNotification: vi.fn() }));
vi.mock('../../../../src/utils/notification-helper', () => ({
    sendNotification: mockSendNotification
}));

// ──────────────────────────────────────────────────────────────────────────
// Imports (after mocks).
// ──────────────────────────────────────────────────────────────────────────

import {
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PRO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PRO_PLAN
} from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { handleCommerceChangePlan } from '../../../../src/routes/commerce/protected/change-plan';
import { TRIAL_REQUIRES_CHECKOUT_REASON } from '../../../../src/services/billing/trialing-plan-upgrade.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'cust_owner';
const SUB_ID = 'sub-commerce-trial';
const BASICO_PLAN_ID = 'plan-uuid-basico';
const PRO_PLAN_ID = 'plan-uuid-pro';

function monthlyPrice(id: string, unitAmount: number) {
    return { id, billingInterval: 'month', intervalCount: 1, active: true, unitAmount };
}

/** The two verticals `commerce/change-plan` serves, with their tier slugs. */
const VERTICALS = [
    {
        entityType: 'gastronomy' as const,
        currentSlug: GASTRONOMY_BASICO_PLAN.slug,
        targetSlug: GASTRONOMY_PRO_PLAN.slug
    },
    {
        entityType: 'experience' as const,
        currentSlug: EXPERIENCE_BASICO_PLAN.slug,
        targetSlug: EXPERIENCE_PRO_PLAN.slug
    }
];

const BILLING = {
    plans: { get: vi.fn() },
    subscriptions: { get: vi.fn(), changePlan: vi.fn() },
    getPaymentAdapter: vi.fn(() => ({ subscriptions: { update: vi.fn() } }))
};

function makeCtx(body: unknown) {
    const values: Record<string, unknown> = {
        actor: { id: OWNER_ID, email: 'owner@local.test' },
        billingCustomerId: CUSTOMER_ID
    };
    return {
        get: (key: string) => values[key],
        req: { json: () => Promise.resolve(body) }
    } as never;
}

/**
 * Arms the whole read path for ONE vertical: a `trialing` subscription on the
 * básico tier moving to pro. `mpSubscriptionId` decides whether the row is a
 * Hospeda-owned trial (absent) or a legacy card-first one (present).
 */
function armTrialingUpgrade(params: {
    readonly currentSlug: string;
    readonly targetSlug: string;
    readonly mpSubscriptionId?: string;
}) {
    const basicoRow = {
        id: BASICO_PLAN_ID,
        name: params.currentSlug,
        active: true,
        prices: [monthlyPrice('price-basico', 1_500_000)]
    };
    const proRow = {
        id: PRO_PLAN_ID,
        name: params.targetSlug,
        active: true,
        prices: [monthlyPrice('price-pro', 4_500_000)]
    };

    mockGetQZPayBilling.mockReturnValue(BILLING);
    mockFindOwnerVerticalSubscription.mockResolvedValue({
        id: SUB_ID,
        status: 'trialing',
        planId: BASICO_PLAN_ID
    });
    BILLING.subscriptions.get.mockResolvedValue({
        id: SUB_ID,
        customerId: CUSTOMER_ID,
        planId: BASICO_PLAN_ID,
        status: 'trialing',
        cancelAtPeriodEnd: false,
        interval: 'month',
        intervalCount: 1,
        // The HOS-1012 shape when no id is supplied: MercadoPago knows nothing
        // about this subscription.
        providerSubscriptionIds:
            params.mpSubscriptionId === undefined ? {} : { mercadopago: params.mpSubscriptionId }
    });
    mockResolvePlanBySlug.mockImplementation(async (_billing: unknown, slug: string) =>
        slug === params.targetSlug ? proRow : basicoRow
    );
    BILLING.plans.get.mockImplementation(async (id: string) =>
        id === PRO_PLAN_ID ? proRow : basicoRow
    );
}

// ──────────────────────────────────────────────────────────────────────────

describe('handleCommerceChangePlan — HOS-1236 a trial with no preapproval is 409, not 502', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;
    });

    for (const { entityType, currentSlug, targetSlug } of VERTICALS) {
        it(`${entityType.toUpperCase()}: refuses with TRIAL_REQUIRES_CHECKOUT and never calls MercadoPago`, async () => {
            armTrialingUpgrade({ currentSlug, targetSlug });
            const mpUpdate = vi.fn();
            BILLING.getPaymentAdapter.mockReturnValue({ subscriptions: { update: mpUpdate } });

            const err = await handleCommerceChangePlan(makeCtx({ planSlug: targetSlug }), {
                entityType
            }).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect((err as ServiceError).reason).toBe(TRIAL_REQUIRES_CHECKOUT_REASON);
            // The whole point: no provider call happened, so calling it a
            // provider failure was never true.
            expect(mpUpdate).not.toHaveBeenCalled();
            expect(BILLING.subscriptions.changePlan).not.toHaveBeenCalled();
        });

        it(`${entityType.toUpperCase()}: the refusal is NOT an HTTPException carrying a 5xx`, async () => {
            // The assertion the old behaviour would fail. `mapCommerceUpgradeErrorToHttp`
            // sends `MP_PREAPPROVAL_MUTATION_FAILED` to 502; if this route ever
            // routes the refusal back through that mapper, the error arrives as an
            // `HTTPException` with a `status` and the `reason` disappears — the web
            // then renders an infrastructure apology with a useless retry.
            armTrialingUpgrade({ currentSlug, targetSlug });

            const err = await handleCommerceChangePlan(makeCtx({ planSlug: targetSlug }), {
                entityType
            }).catch((e: unknown) => e);

            expect((err as { status?: number }).status).toBeUndefined();
        });

        it(`${entityType.toUpperCase()}: a trial WITH a preapproval still takes the mutate path`, async () => {
            // The pair that keeps the two assertions above honest. Refusing every
            // trialing upgrade would satisfy them just as well, and would break the
            // legacy card-first rows this flow was built for (HOS-211).
            armTrialingUpgrade({ currentSlug, targetSlug, mpSubscriptionId: 'mp-preapproval-1' });
            const mpUpdate = vi.fn().mockResolvedValue(undefined);
            BILLING.getPaymentAdapter.mockReturnValue({ subscriptions: { update: mpUpdate } });
            BILLING.subscriptions.changePlan.mockResolvedValue({
                subscription: { id: SUB_ID, customerId: CUSTOMER_ID, planId: PRO_PLAN_ID },
                proration: null
            });

            const err = await handleCommerceChangePlan(makeCtx({ planSlug: targetSlug }), {
                entityType
            }).catch((e: unknown) => e);

            expect((err as ServiceError)?.reason).not.toBe(TRIAL_REQUIRES_CHECKOUT_REASON);
            expect(mpUpdate).toHaveBeenCalledWith(
                'mp-preapproval-1',
                expect.objectContaining({ planId: PRO_PLAN_ID })
            );
        });
    }
});
