/**
 * Unit tests for the MercadoPago propagation step in handlePlanChange
 * (SPEC-126 D7).
 *
 * Covers:
 * - The paymentAdapter.subscriptions.update() call fires with the right
 *   transactionAmount (centavos -> ARS conversion) when the active sub has
 *   a MercadoPago preapproval ID.
 * - The propagation is skipped (no error) when the sub has no MP id (trial
 *   sub, or a row predating SPEC-124).
 * - The propagation is skipped (logged warning) when the payment adapter
 *   is not configured.
 * - A failure in the MP update does NOT fail the route; the local change
 *   still succeeds and the failure is audited via
 *   PLAN_CHANGE_MP_PROPAGATION_FAILED.
 *
 * @module test/routes/plan-change-mp-propagation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../src/services/addon-plan-change.service', () => ({
    handlePlanChangeAddonRecalculation: vi.fn().mockResolvedValue(undefined)
}));

const insertValuesMock = vi.fn().mockResolvedValue(undefined);
const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getDb: vi.fn(() => ({ insert: insertMock })),
        // The route imports `billingSubscriptionEvents` directly. importOriginal
        // surfaces it from qzpay-drizzle's re-export chain, but we mirror the
        // symbol explicitly here so vitest's auto-mock detection does not
        // strip it when the test file has its own `vi.mock` for `@repo/db`.
        billingSubscriptionEvents: (actual as Record<string, unknown>)
            .billingSubscriptionEvents ?? {
            _table: 'billing_subscription_events'
        }
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        withServiceTransaction: vi.fn(async (cb: (ctx: { tx: null }) => Promise<void>) => {
            await cb({ tx: null });
        }),
        BILLING_EVENT_TYPES: {
            PLAN_CHANGE_LOCAL_FAILED: 'PLAN_CHANGE_LOCAL_FAILED',
            PLAN_CHANGE_MP_PROPAGATION_FAILED: 'PLAN_CHANGE_MP_PROPAGATION_FAILED'
        }
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../src/middlewares/billing';
import { handlePlanChange } from '../../src/routes/billing/plan-change';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner';
const SUB_ID = 'sub_1';
const MP_PREAPPROVAL_ID = 'mp-preapproval-abc';
// Setup is a DOWNGRADE so the legacy synchronous changePlan + MP
// propagation path is exercised. Upgrades now redirect to a one-time
// MP checkout (SPEC-141 D7) and the MP propagation moved to the
// confirmPlanUpgrade webhook handler — see payment-logic.test.ts.
const CURRENT_PLAN_ID = 'plan_pro';
const TARGET_PLAN_ID = 'plan_basic';
// 100,000 centavos = 1,000 ARS — basic monthly (target is CHEAPER).
const TARGET_UNIT_AMOUNT_CENTAVOS = 100_000;
const TARGET_TRANSACTION_AMOUNT_ARS = 1_000;

interface ContextOpts {
    body?: unknown;
}

function makeContext(opts: ContextOpts = {}) {
    const body = opts.body ?? { newPlanId: TARGET_PLAN_ID, billingInterval: 'monthly' };
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID],
        ['actor', { id: '00000000-0000-4000-8000-000000000002', role: 'USER', permissions: [] }]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        req: { json: vi.fn().mockResolvedValue(body) }
    };
}

interface BillingMockOpts {
    activeSub?: {
        id: string;
        planId: string;
        status: string;
        interval: string;
        providerSubscriptionIds?: Record<string, string>;
    };
    paymentAdapterPresent?: boolean;
    paymentAdapterUpdateThrows?: Error;
}

function makeBillingMock(opts: BillingMockOpts = {}) {
    const activeSub = opts.activeSub ?? {
        id: SUB_ID,
        planId: CURRENT_PLAN_ID,
        status: 'active',
        interval: 'month',
        providerSubscriptionIds: { mercadopago: MP_PREAPPROVAL_ID }
    };

    const paymentAdapterUpdate = opts.paymentAdapterUpdateThrows
        ? vi.fn().mockRejectedValue(opts.paymentAdapterUpdateThrows)
        : vi.fn().mockResolvedValue({ id: MP_PREAPPROVAL_ID });

    const paymentAdapter =
        opts.paymentAdapterPresent === false
            ? null
            : {
                  subscriptions: {
                      update: paymentAdapterUpdate
                  }
              };

    const billing = {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([activeSub]),
            changePlan: vi.fn().mockResolvedValue({
                subscription: { id: SUB_ID },
                proration: {
                    effectiveDate: new Date('2026-05-15T00:00:00.000Z'),
                    chargeAmount: 1000,
                    creditAmount: 0
                }
            })
        },
        plans: {
            get: vi.fn().mockImplementation((planId: string) => {
                if (planId === CURRENT_PLAN_ID) {
                    return Promise.resolve({
                        id: CURRENT_PLAN_ID,
                        prices: [
                            {
                                id: 'price_pro_monthly',
                                billingInterval: 'month',
                                unitAmount: 200_000, // current (pro) — more expensive
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
                            unitAmount: TARGET_UNIT_AMOUNT_CENTAVOS, // target (basic) — cheaper
                            intervalCount: 1
                        }
                    ]
                });
            })
        },
        getPaymentAdapter: vi.fn(() => paymentAdapter)
    };

    return { billing, paymentAdapterUpdate, paymentAdapter };
}

function mockBilling(billing: ReturnType<typeof makeBillingMock>['billing']) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange MercadoPago propagation (SPEC-126 D7)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        insertMock.mockReturnValue({ values: insertValuesMock });
    });

    it('calls paymentAdapter.subscriptions.update with major-unit transactionAmount on success', async () => {
        const { billing, paymentAdapterUpdate } = makeBillingMock();
        mockBilling(billing);

        await handlePlanChange(makeContext() as never);

        expect(paymentAdapterUpdate).toHaveBeenCalledOnce();
        expect(paymentAdapterUpdate).toHaveBeenCalledWith(MP_PREAPPROVAL_ID, {
            planId: TARGET_PLAN_ID,
            transactionAmount: TARGET_TRANSACTION_AMOUNT_ARS
        });
    });

    it('skips MP propagation when the active sub has no mercadopago provider id', async () => {
        const { billing, paymentAdapterUpdate } = makeBillingMock({
            activeSub: {
                id: SUB_ID,
                planId: CURRENT_PLAN_ID,
                status: 'active',
                interval: 'month',
                providerSubscriptionIds: {} // no mercadopago key (trial sub or legacy row)
            }
        });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(paymentAdapterUpdate).not.toHaveBeenCalled();
        // Plan change still succeeded locally.
        expect(result).toMatchObject({ subscriptionId: SUB_ID, newPlanId: TARGET_PLAN_ID });
    });

    it('skips MP propagation when the payment adapter is not configured', async () => {
        const { billing } = makeBillingMock({ paymentAdapterPresent: false });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        // The route succeeds even without MP propagation.
        expect(result).toMatchObject({ subscriptionId: SUB_ID, newPlanId: TARGET_PLAN_ID });
    });

    it('does NOT fail the route when MP update throws; audits PLAN_CHANGE_MP_PROPAGATION_FAILED', async () => {
        const mpError = new Error('MP API timeout');
        const { billing } = makeBillingMock({ paymentAdapterUpdateThrows: mpError });
        mockBilling(billing);

        const result = await handlePlanChange(makeContext() as never);

        expect(result).toMatchObject({ subscriptionId: SUB_ID, newPlanId: TARGET_PLAN_ID });
        // The audit event was logged.
        expect(insertValuesMock).toHaveBeenCalledOnce();
        const auditPayload = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(auditPayload).toMatchObject({
            subscriptionId: SUB_ID,
            eventType: 'PLAN_CHANGE_MP_PROPAGATION_FAILED',
            triggerSource: 'plan-change-route'
        });
        const metadata = auditPayload.metadata as Record<string, unknown>;
        expect(metadata).toMatchObject({
            mpSubscriptionId: MP_PREAPPROVAL_ID,
            oldPlanId: CURRENT_PLAN_ID,
            newPlanId: TARGET_PLAN_ID,
            error: 'MP API timeout'
        });
    });
});
