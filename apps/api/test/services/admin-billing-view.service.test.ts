/**
 * Admin billing VIEW service — query + mapping tests
 *
 * Two things this suite exists to catch, neither of which the pure status tests
 * can see:
 *
 * 1. **The widening reaching the SQL.** `widenSubscriptionStatusFilter` can be
 *    perfectly correct while the service still calls `eq(status, 'cancelled')`
 *    at the call site. These tests assert the emitted condition is an `IN` over
 *    BOTH spellings — the actual shape of the "2 of 8 cancelled" defect.
 * 2. **The row → DTO mapping honouring the contract**, including the fields the
 *    qzpay tier could never supply (user, plan) and the ones it must not
 *    fabricate (`recurringAmountInCents` stays null, never 0).
 *
 * @module test/services/admin-billing-view.service.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks — must precede all imports ──────────────────────────────────

vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    safeIlike: vi.fn((col: unknown, term: string) => ({ type: 'safeIlike', col, term })),
    billingPayments: {
        id: 'payments.id',
        customerId: 'payments.customer_id',
        subscriptionId: 'payments.subscription_id',
        invoiceId: 'payments.invoice_id',
        amount: 'payments.amount',
        currency: 'payments.currency',
        refundedAmount: 'payments.refunded_amount',
        status: 'payments.status',
        provider: 'payments.provider',
        providerPaymentIds: 'payments.provider_payment_ids',
        createdAt: 'payments.created_at',
        deletedAt: 'payments.deleted_at'
    },
    billingSubscriptions: {
        id: 'subscriptions.id',
        customerId: 'subscriptions.customer_id',
        planId: 'subscriptions.plan_id',
        status: 'subscriptions.status',
        billingInterval: 'subscriptions.billing_interval',
        currentPeriodStart: 'subscriptions.current_period_start',
        currentPeriodEnd: 'subscriptions.current_period_end',
        trialEnd: 'subscriptions.trial_end',
        cancelAtPeriodEnd: 'subscriptions.cancel_at_period_end',
        createdAt: 'subscriptions.created_at',
        productDomain: 'subscriptions.product_domain',
        deletedAt: 'subscriptions.deleted_at'
    },
    billingCustomers: {
        id: 'customers.id',
        externalId: 'customers.external_id',
        email: 'customers.email',
        name: 'customers.name'
    },
    billingPlans: {
        id: 'plans.id',
        name: 'plans.name',
        displayName: 'plans.display_name',
        monthlyPriceArs: 'plans.monthly_price_ars',
        annualPriceArs: 'plans.annual_price_ars',
        productDomain: 'plans.product_domain'
    },
    users: {
        id: 'users.id',
        email: 'users.email',
        displayName: 'users.display_name',
        firstName: 'users.first_name',
        lastName: 'users.last_name'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    or: vi.fn((...args: unknown[]) => ({ type: 'or', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    gte: vi.fn((col: unknown, val: unknown) => ({ type: 'gte', col, val })),
    lte: vi.fn((col: unknown, val: unknown) => ({ type: 'lte', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
    inArray: vi.fn((col: unknown, values: unknown) => ({ type: 'inArray', col, values })),
    desc: vi.fn((col: unknown) => ({ type: 'desc', col })),
    count: vi.fn(() => ({ type: 'count' })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        type: 'sql',
        strings,
        values
    }))
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

// ─── Imports — after mocks ─────────────────────────────────────────────────────

import { getDb } from '@repo/db';
import { AdminPaymentViewSchema, AdminSubscriptionViewSchema } from '@repo/schemas';
import { inArray } from 'drizzle-orm';
import { listPayments, listSubscriptions } from '../../src/services/admin-billing-view.service';

const mockGetDb = vi.mocked(getDb);
const mockInArray = vi.mocked(inArray);

/**
 * Build a Drizzle chain stub that answers the count query first and the rows
 * query second, in the order the service issues them.
 */
function mockDbReturning(params: { total: number; rows: readonly unknown[] }): void {
    let call = 0;

    const chain = {
        select: vi.fn(() => chain),
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        offset: vi.fn(() => Promise.resolve([...params.rows])),
        where: vi.fn(() => {
            call += 1;
            // First `.where()` terminates the count query; the second continues
            // into orderBy/limit/offset for the rows query.
            return call === 1 ? Promise.resolve([{ total: params.total }]) : chain;
        })
    };

    // biome-ignore lint/suspicious/noExplicitAny: minimal Drizzle chain stub
    mockGetDb.mockReturnValue(chain as any);
}

const SUBSCRIPTION_ROW = {
    id: '11111111-1111-4111-8111-111111111111',
    rawStatus: 'canceled',
    billingInterval: 'month',
    currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    trialEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    productDomain: 'accommodation',
    customerEmail: 'julieta@local.test',
    customerName: 'Julieta F.',
    userId: '22222222-2222-4222-8222-222222222222',
    userDisplayName: 'Julieta Ferreyra',
    userFirstName: 'Julieta',
    userLastName: 'Ferreyra',
    userEmail: 'julieta@local.test',
    planId: '33333333-3333-4333-8333-333333333333',
    planSlug: 'owner-basico',
    planDisplayName: 'Basic',
    planMonthlyPriceInCents: 1_500_000,
    planAnnualPriceInCents: 15_000_000,
    planProductDomain: 'accommodation'
};

/** Only the joined user/plan/customer columns, shared by both row fixtures. */
const {
    id: _subId,
    rawStatus: _subRawStatus,
    createdAt: _subCreatedAt,
    ...JOINED_REF_ROW
} = SUBSCRIPTION_ROW;

const PAYMENT_ROW = {
    ...JOINED_REF_ROW,
    id: '44444444-4444-4444-8444-444444444444',
    amountInCents: 1_500_000,
    currency: 'ARS',
    refundedAmountInCents: 0,
    rawStatus: 'succeeded',
    createdAt: new Date('2026-08-10T12:00:00.000Z'),
    subscriptionId: '11111111-1111-4111-8111-111111111111',
    invoiceId: null,
    provider: 'mercadopago',
    providerPaymentIds: { mercadopago: 'MP-TEST-0001' }
};

beforeEach(() => {
    vi.clearAllMocks();
});

/**
 * The `@repo/db` mock above represents each Drizzle column as a plain string, so
 * a captured `inArray(col, ...)` argument can be matched by name. TypeScript
 * still types that argument with the REAL signature (`SQLWrapper`), hence the
 * `unknown` hop — without it `tsc` rejects the comparison as having no overlap.
 */
const isColumn = (col: unknown, name: string): boolean => col === name;

describe('listSubscriptions — status filter widening reaches the SQL', () => {
    it('emits an IN over BOTH spellings when filtering by cancelled', async () => {
        // Arrange
        mockDbReturning({ total: 1, rows: [SUBSCRIPTION_ROW] });

        // Act
        await listSubscriptions({ status: 'cancelled', page: 1, pageSize: 20 });

        // Assert — an `eq(status, 'cancelled')` here is the shipped defect.
        const statusCall = mockInArray.mock.calls.find(([col]) =>
            isColumn(col, 'subscriptions.status')
        );
        expect(statusCall).toBeDefined();
        const values = statusCall?.[1] as string[];
        expect(values).toContain('cancelled');
        expect(values).toContain('canceled');
    });

    it('does not filter by status at all when none is requested', async () => {
        mockDbReturning({ total: 1, rows: [SUBSCRIPTION_ROW] });

        await listSubscriptions({ page: 1, pageSize: 20 });

        expect(mockInArray.mock.calls.some(([col]) => isColumn(col, 'subscriptions.status'))).toBe(
            false
        );
    });
});

describe('listSubscriptions — row mapping', () => {
    it('serves a row stored as qzpay `canceled` with both the normalised and raw status', async () => {
        mockDbReturning({ total: 1, rows: [SUBSCRIPTION_ROW] });

        const { items } = await listSubscriptions({ page: 1, pageSize: 20 });

        expect(items[0]?.status).toBe('cancelled');
        expect(items[0]?.rawStatus).toBe('canceled');
    });

    it('produces a payload the published contract accepts', async () => {
        mockDbReturning({ total: 1, rows: [SUBSCRIPTION_ROW] });

        const { items } = await listSubscriptions({ page: 1, pageSize: 20 });

        expect(AdminSubscriptionViewSchema.safeParse(items[0]).success).toBe(true);
    });

    it('carries the user and plan the qzpay row could not supply', async () => {
        mockDbReturning({ total: 1, rows: [SUBSCRIPTION_ROW] });

        const { items } = await listSubscriptions({ page: 1, pageSize: 20 });

        expect(items[0]?.user?.displayName).toBe('Julieta Ferreyra');
        expect(items[0]?.plan?.slug).toBe('owner-basico');
        expect(items[0]?.recurringAmountInCents).toBe(1_500_000);
    });

    it('leaves recurringAmountInCents null — not 0 — when the plan is gone', async () => {
        mockDbReturning({
            total: 1,
            rows: [
                {
                    ...SUBSCRIPTION_ROW,
                    planId: null,
                    planSlug: null,
                    planDisplayName: null,
                    planMonthlyPriceInCents: null,
                    planAnnualPriceInCents: null,
                    planProductDomain: null
                }
            ]
        });

        const { items } = await listSubscriptions({ page: 1, pageSize: 20 });

        expect(items[0]?.plan).toBeNull();
        expect(items[0]?.recurringAmountInCents).toBeNull();
    });

    it('serves a null user rather than an empty cell when the user row is gone', async () => {
        mockDbReturning({
            total: 1,
            rows: [{ ...SUBSCRIPTION_ROW, userId: null, userDisplayName: null, userEmail: null }]
        });

        const { items } = await listSubscriptions({ page: 1, pageSize: 20 });

        expect(items[0]?.user).toBeNull();
    });

    it('throws on an unknown stored status instead of coercing it', async () => {
        mockDbReturning({ total: 1, rows: [{ ...SUBSCRIPTION_ROW, rawStatus: 'weird' }] });

        await expect(listSubscriptions({ page: 1, pageSize: 20 })).rejects.toThrow(/weird/);
    });

    it('returns page/pageSize pagination — never limit/offset', async () => {
        mockDbReturning({ total: 45, rows: [SUBSCRIPTION_ROW] });

        const { pagination } = await listSubscriptions({ page: 2, pageSize: 20 });

        expect(pagination).toEqual({
            page: 2,
            pageSize: 20,
            total: 45,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: true
        });
        expect(pagination).not.toHaveProperty('limit');
        expect(pagination).not.toHaveProperty('offset');
    });
});

describe('listPayments — row mapping', () => {
    it('produces a payload the published contract accepts', async () => {
        mockDbReturning({ total: 1, rows: [{ ...PAYMENT_ROW, id: PAYMENT_ROW.id }] });

        const { items } = await listPayments({ page: 1, pageSize: 20 });

        expect(AdminPaymentViewSchema.safeParse(items[0]).success).toBe(true);
    });

    it('marks a succeeded payment refundable and exposes the provider payment id', async () => {
        mockDbReturning({ total: 1, rows: [{ ...PAYMENT_ROW, id: PAYMENT_ROW.id }] });

        const { items } = await listPayments({ page: 1, pageSize: 20 });

        expect(items[0]?.status).toBe('succeeded');
        expect(items[0]?.isRefundable).toBe(true);
        expect(items[0]?.providerPaymentId).toBe('MP-TEST-0001');
    });

    it('marks a fully refunded payment non-refundable', async () => {
        mockDbReturning({
            total: 1,
            rows: [
                {
                    ...PAYMENT_ROW,
                    id: PAYMENT_ROW.id,
                    rawStatus: 'refunded',
                    refundedAmountInCents: 1_500_000
                }
            ]
        });

        const { items } = await listPayments({ page: 1, pageSize: 20 });

        expect(items[0]?.status).toBe('refunded');
        expect(items[0]?.isRefundable).toBe(false);
    });

    it('treats a null refunded_amount as zero refunded', async () => {
        mockDbReturning({
            total: 1,
            rows: [{ ...PAYMENT_ROW, id: PAYMENT_ROW.id, refundedAmountInCents: null }]
        });

        const { items } = await listPayments({ page: 1, pageSize: 20 });

        expect(items[0]?.refundedAmountInCents).toBe(0);
        expect(items[0]?.isRefundable).toBe(true);
    });

    it('widens a canceled status filter to both spellings', async () => {
        mockDbReturning({ total: 0, rows: [] });

        await listPayments({ status: 'canceled', page: 1, pageSize: 20 });

        const statusCall = mockInArray.mock.calls.find(([col]) => isColumn(col, 'payments.status'));
        const values = statusCall?.[1] as string[];
        expect(values).toContain('canceled');
        expect(values).toContain('cancelled');
    });
});
