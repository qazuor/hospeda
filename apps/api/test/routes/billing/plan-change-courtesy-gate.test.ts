/**
 * Gate test: plan-change refuses a `courtesy` subscription (HOS-180 AC-14 / OQ-2).
 *
 * A `courtesy` subscription is deliberately excluded from
 * `handlePlanChange`'s active-subscription find, which only accepts
 * `'active' | 'trialing'` (`plan-change.ts:231-233`). No new gate was added
 * for HOS-180 — the block "costs no code" by omission, per spec §11 OQ-2.
 * This test is the regression guard for that omission: it fails the moment
 * `courtesy` is ever added to the find's status check.
 *
 * @module test/routes/billing/plan-change-courtesy-gate
 */

import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared BEFORE imports of the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/sentry')>();
    return { ...actual, captureBillingError: vi.fn() };
});

vi.mock('../../../src/lib/billing-provider-error', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/billing-provider-error')>();
    return { ...actual };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

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

vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, initiatePaidPlanUpgrade: vi.fn() };
});

vi.mock('../../../src/services/subscription-downgrade.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, scheduleSubscriptionDowngrade: vi.fn() };
});

vi.mock('../../../src/services/subscription-downgrade-excess.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, computeDowngradeExcess: vi.fn() };
});

vi.mock('../../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_courtesy_gate_test';
const ACTOR_ID = '00000000-0000-4000-8000-000000000099';
const TARGET_PLAN_ID = 'plan_pro';

function makeContext(body: unknown = { newPlanId: TARGET_PLAN_ID, billingInterval: 'monthly' }) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID],
        ['actor', { id: ACTOR_ID, roles: ['USER'], permissions: [] }]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        req: { json: vi.fn().mockResolvedValue(body) }
    };
}

/** A billing mock whose only subscription is `courtesy` (HOS-180). */
function makeCourtesyBillingMock() {
    const courtesySub = {
        id: 'sub_courtesy_001',
        planId: 'plan_basic',
        status: 'courtesy',
        interval: 'month',
        intervalCount: 1,
        cancelAtPeriodEnd: false
    };

    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([courtesySub]),
            changePlan: vi.fn()
        },
        plans: {
            get: vi.fn()
        }
    };
}

function mockBillingWith(billing: ReturnType<typeof makeCourtesyBillingMock>) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange — courtesy gate (HOS-180 AC-14 / OQ-2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects with 404 "No active subscription found" when the only sub is courtesy', async () => {
        mockBillingWith(makeCourtesyBillingMock());

        const ctx = makeContext();
        try {
            await handlePlanChange(ctx as never);
            throw new Error('expected handlePlanChange to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(HTTPException);
            const httpErr = err as HTTPException;
            expect(httpErr.status).toBe(404);
            expect(httpErr.message).toBe('No active subscription found');
        }
    });

    it('never calls plans.get or subscriptions.changePlan for a courtesy-only customer', async () => {
        const billing = makeCourtesyBillingMock();
        mockBillingWith(billing);

        const ctx = makeContext();
        await handlePlanChange(ctx as never).catch(() => undefined);

        expect(billing.plans.get).not.toHaveBeenCalled();
        expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
    });
});
