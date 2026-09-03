/**
 * Unit tests for `handleCommerceChangePlan` (HOS-1119) — the commerce tier
 * change.
 *
 * Mocking style mirrors `start-subscription.test.ts` next door: the handler is
 * exported standalone and exercised against a mocked `Context`, with billing,
 * the domain-scoped subscription finder and the two upgrade services mocked at
 * their module boundaries. `resolveCommercePlanSlug` is deliberately NOT mocked
 * — `utils/env` is, so the REAL resolver runs and the cross-vertical refusal
 * below is the real one rather than a stub agreeing with itself.
 *
 * The three assertions that carry weight:
 *
 * 1. **The subscription is chosen by DOMAIN.** `billing/plan-change.ts` picks
 *    the first live subscription with no domain predicate at all, which is why
 *    this route exists; a version of it that reused that selection would send an
 *    owner's gastronomy tier change to their accommodation subscription.
 * 2. **A cheaper or equal target is REFUSED.** Not a UI nicety — the
 *    scheduled-downgrade path it would otherwise take runs
 *    `applyDowngradeRestrictions` against the target plan's slug, i.e.
 *    accommodation and promotion caps a commerce tier does not declare.
 * 3. **The upgrade is initiated against the TARGET plan**, not the vertical's
 *    default. A mutation that dropped the requested slug would still produce a
 *    200 with a MercadoPago URL.
 *
 * @module test/routes/commerce/protected/change-plan
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
// `importOriginal` so `SubscriptionCheckoutError` and `findMonthlyPrice` stay
// REAL. Replacing the module wholesale would leave the error class `undefined`,
// and the handler's `instanceof` checks would then silently never match.
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

const { mockApplyTrialingPlanUpgrade } = vi.hoisted(() => ({
    mockApplyTrialingPlanUpgrade: vi.fn()
}));
vi.mock('../../../../src/services/billing/trialing-plan-upgrade.service', () => ({
    applyTrialingPlanUpgrade: mockApplyTrialingPlanUpgrade
}));

// ──────────────────────────────────────────────────────────────────────────
// Imports (after mocks).
// ──────────────────────────────────────────────────────────────────────────

import { GASTRONOMY_BASICO_PLAN, GASTRONOMY_PRO_PLAN } from '@repo/billing';
import { handleCommerceChangePlan } from '../../../../src/routes/commerce/protected/change-plan';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'cust_owner';
const SUB_ID = 'sub-gastro-1';
const BASICO_PLAN_ID = 'plan-uuid-basico';
const PRO_PLAN_ID = 'plan-uuid-pro';

/** Monthly price row shaped as `findMonthlyPrice` (the REAL one) matches on. */
function monthlyPrice(id: string, unitAmount: number) {
    return { id, billingInterval: 'month', intervalCount: 1, active: true, unitAmount };
}

const BASICO_PLAN_ROW = {
    id: BASICO_PLAN_ID,
    name: GASTRONOMY_BASICO_PLAN.slug,
    active: true,
    prices: [monthlyPrice('price-basico', 1_500_000)]
};

const PRO_PLAN_ROW = {
    id: PRO_PLAN_ID,
    name: GASTRONOMY_PRO_PLAN.slug,
    active: true,
    prices: [monthlyPrice('price-pro', 4_500_000)]
};

/** A subscription record as `billing.subscriptions.get` returns it. */
function makeSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: SUB_ID,
        customerId: CUSTOMER_ID,
        planId: BASICO_PLAN_ID,
        status: 'active',
        cancelAtPeriodEnd: false,
        interval: 'month',
        intervalCount: 1,
        providerSubscriptionIds: { mercadopago: 'mp-preapproval-1' },
        ...overrides
    };
}

const BILLING = {
    plans: { get: vi.fn() },
    subscriptions: { get: vi.fn() }
};

/** Minimal Hono `Context` stand-in: a body, plus `actor`/`billingCustomerId`. */
function makeCtx(body: unknown, contextValues: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
        actor: { id: OWNER_ID, email: 'owner@local.test' },
        billingCustomerId: CUSTOMER_ID,
        ...contextValues
    };
    return {
        get: (key: string) => values[key],
        req: { json: () => Promise.resolve(body) }
    } as never;
}

/** Runs the handler and reduces whatever it refuses with to `{status, message}`. */
async function captureRefusal(body: unknown, contextValues?: Record<string, unknown>) {
    try {
        await handleCommerceChangePlan(makeCtx(body, contextValues), {
            entityType: 'gastronomy'
        });
    } catch (error) {
        const err = error as { status?: number; message?: string };
        return { status: err.status ?? 0, message: err.message ?? '' };
    }
    return { status: 200, message: 'did not refuse' };
}

describe('handleCommerceChangePlan (HOS-1119)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;
        mockGetQZPayBilling.mockReturnValue(BILLING);
        mockFindOwnerVerticalSubscription.mockResolvedValue({
            id: SUB_ID,
            status: 'active',
            planId: BASICO_PLAN_ID
        });
        BILLING.subscriptions.get.mockResolvedValue(makeSubscription());
        BILLING.plans.get.mockResolvedValue(BASICO_PLAN_ROW);
        mockResolvePlanBySlug.mockResolvedValue(PRO_PLAN_ROW);
        mockInitiatePaidPlanUpgrade.mockResolvedValue({
            checkoutUrl: 'https://mp.test/upgrade',
            localSubscriptionId: SUB_ID,
            expiresAt: new Date().toISOString(),
            newPlanId: PRO_PLAN_ID,
            deltaCentavos: 3_000_000
        });
    });

    // ── The happy path ────────────────────────────────────────────────────

    it('initiates a prorated upgrade and returns pending_payment', async () => {
        const result = (await handleCommerceChangePlan(
            makeCtx({ planSlug: GASTRONOMY_PRO_PLAN.slug }),
            { entityType: 'gastronomy' }
        )) as { status: string; checkoutUrl: string; deltaCentavos: number };

        expect(result.status).toBe('pending_payment');
        expect(result.checkoutUrl).toBe('https://mp.test/upgrade');
        expect(result.deltaCentavos).toBe(3_000_000);
    });

    it('upgrades to the REQUESTED plan, not the vertical default', async () => {
        // The mutation this pins: dropping `requestedPlanSlug` on the way to the
        // resolver still yields a 200 with a MercadoPago URL, so asserting the
        // status alone proves nothing about which tier was bought.
        await handleCommerceChangePlan(makeCtx({ planSlug: GASTRONOMY_PRO_PLAN.slug }), {
            entityType: 'gastronomy'
        });

        expect(mockResolvePlanBySlug).toHaveBeenCalledWith(BILLING, GASTRONOMY_PRO_PLAN.slug);
        expect(mockResolvePlanBySlug).not.toHaveBeenCalledWith(
            BILLING,
            GASTRONOMY_BASICO_PLAN.slug
        );
        expect(mockInitiatePaidPlanUpgrade).toHaveBeenCalledWith(
            expect.objectContaining({
                currentSubscriptionId: SUB_ID,
                newPlanId: PRO_PLAN_ID,
                billingInterval: 'month',
                intervalCount: 1
            })
        );
    });

    it('selects the subscription by DOMAIN, never by "first live subscription"', async () => {
        // The reason this route is not `billing/plan-change.ts`. That handler
        // scans `getByCustomerId` for the first active/trialing subscription
        // with no domain predicate, so an owner who both hosts and runs a
        // restaurant would have this land on a coin flip.
        await handleCommerceChangePlan(makeCtx({ planSlug: GASTRONOMY_PRO_PLAN.slug }), {
            entityType: 'gastronomy'
        });

        expect(mockFindOwnerVerticalSubscription).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: CUSTOMER_ID, vertical: 'gastronomy' })
        );
    });

    // ── Trialing: apply now, charge nothing ───────────────────────────────

    it('applies the tier at once and opens no checkout while trialing', async () => {
        BILLING.subscriptions.get.mockResolvedValue(makeSubscription({ status: 'trialing' }));
        mockApplyTrialingPlanUpgrade.mockResolvedValue({
            subscriptionId: SUB_ID,
            previousPlanId: BASICO_PLAN_ID,
            newPlanId: PRO_PLAN_ID
        });

        const result = (await handleCommerceChangePlan(
            makeCtx({ planSlug: GASTRONOMY_PRO_PLAN.slug }),
            { entityType: 'gastronomy' }
        )) as { status: string; newPlanId: string };

        expect(result.status).toBe('active');
        expect(result.newPlanId).toBe(PRO_PLAN_ID);
        // There is no paid period yet, so there is nothing to prorate — and a
        // checkout here would charge for one.
        expect(mockInitiatePaidPlanUpgrade).not.toHaveBeenCalled();
        expect(mockApplyTrialingPlanUpgrade).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: SUB_ID,
                newPlanId: PRO_PLAN_ID,
                // centavos → major units, the unit MP's transaction_amount uses.
                targetTransactionAmountMajor: 45_000
            })
        );
    });

    // ── Refusals, in error-contract order ─────────────────────────────────

    it('refuses a malformed body with 400', async () => {
        expect((await captureRefusal({ planSlug: 'Gastronomy Pro' })).status).toBe(400);
        expect((await captureRefusal({})).status).toBe(400);
        expect((await captureRefusal(undefined)).status).toBe(400);
    });

    it('refuses the OTHER vertical’s plan with 400', async () => {
        // Through the real resolver: this is the cross-vertical leak AC-35's
        // guard describes — two verticals on one MercadoPago preapproval plan,
        // the second trial silently not happening.
        const refusal = await captureRefusal({ planSlug: 'experience-basico' });

        expect(refusal.status).toBe(400);
        expect(refusal.message).toMatch(/gastronomy/);
        expect(mockInitiatePaidPlanUpgrade).not.toHaveBeenCalled();
    });

    it('refuses with 404 when the owner holds no subscription for this vertical', async () => {
        mockFindOwnerVerticalSubscription.mockResolvedValue(null);

        expect((await captureRefusal({ planSlug: GASTRONOMY_PRO_PLAN.slug })).status).toBe(404);
    });

    it('answers the same 404 when the caller has no billing customer at all', async () => {
        // Describing the resource asked about, not the caller's account.
        const refusal = await captureRefusal(
            { planSlug: GASTRONOMY_PRO_PLAN.slug },
            { billingCustomerId: undefined }
        );

        expect(refusal.status).toBe(404);
    });

    it('refuses with 409 while a cancellation is pending', async () => {
        BILLING.subscriptions.get.mockResolvedValue(makeSubscription({ cancelAtPeriodEnd: true }));

        expect((await captureRefusal({ planSlug: GASTRONOMY_PRO_PLAN.slug })).status).toBe(409);
    });

    it('refuses a retired target plan with 410', async () => {
        mockResolvePlanBySlug.mockResolvedValue({ ...PRO_PLAN_ROW, active: false });

        expect((await captureRefusal({ planSlug: GASTRONOMY_PRO_PLAN.slug })).status).toBe(410);
    });

    it('refuses the plan the subscription is already on with 422', async () => {
        BILLING.subscriptions.get.mockResolvedValue(makeSubscription({ planId: PRO_PLAN_ID }));

        expect((await captureRefusal({ planSlug: GASTRONOMY_PRO_PLAN.slug })).status).toBe(422);
    });

    it('refuses a CHEAPER target with 422 and touches no upgrade service', async () => {
        // The load-bearing refusal. Scheduling it instead would hand the
        // apply-scheduled-plan-changes cron a commerce plan slug, against which
        // it runs accommodation and promotion restriction logic.
        BILLING.subscriptions.get.mockResolvedValue(makeSubscription({ planId: PRO_PLAN_ID }));
        BILLING.plans.get.mockResolvedValue(PRO_PLAN_ROW);
        mockResolvePlanBySlug.mockResolvedValue(BASICO_PLAN_ROW);

        const refusal = await captureRefusal({ planSlug: GASTRONOMY_BASICO_PLAN.slug });

        expect(refusal.status).toBe(422);
        expect(mockInitiatePaidPlanUpgrade).not.toHaveBeenCalled();
        expect(mockApplyTrialingPlanUpgrade).not.toHaveBeenCalled();
    });

    it('refuses an EQUALLY priced target with 422', async () => {
        // Equal, not just cheaper: a same-price tier swap has no delta to
        // charge, so the upgrade service would throw NOT_AN_UPGRADE anyway —
        // this refuses it before MercadoPago is involved at all.
        mockResolvePlanBySlug.mockResolvedValue({
            ...PRO_PLAN_ROW,
            prices: [monthlyPrice('price-pro', 1_500_000)]
        });

        expect((await captureRefusal({ planSlug: GASTRONOMY_PRO_PLAN.slug })).status).toBe(422);
        expect(mockInitiatePaidPlanUpgrade).not.toHaveBeenCalled();
    });

    it('refuses with 503 when billing is unavailable', async () => {
        mockGetQZPayBilling.mockReturnValue(null);

        expect((await captureRefusal({ planSlug: GASTRONOMY_PRO_PLAN.slug })).status).toBe(503);
    });

    it('refuses with 503 when the vertical mapping is malformed', async () => {
        // An operator mistake, distinct from the caller mistake above — and
        // never confused with it, because the two answer different statuses.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = 'gastronomy=oops';

        expect((await captureRefusal({ planSlug: GASTRONOMY_PRO_PLAN.slug })).status).toBe(503);
    });
});
