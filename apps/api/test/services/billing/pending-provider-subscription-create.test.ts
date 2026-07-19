/**
 * HOS-191 Path C — pending-provider-subscription-create.ts unit tests.
 *
 * Proves `createPendingProviderSubscription`:
 *  - inserts a `status='pending_provider'` row with NO mp_subscription_id and
 *    no promo_code_id, mapping `billingInterval` to the qzpay storage shape
 *    (`'monthly' -> 'month'`, `'annual' -> 'year'`).
 *  - stamps `product_domain` (default `'accommodation'`, override respected)
 *    via a typed UPDATE, mirroring `createCompSubscription`'s two-step stamp.
 *  - inserts the `billing_pending_checkouts` correlation row, INSIDE the same
 *    transaction, carrying `mpPreapprovalPlanId` / `payerEmail` /
 *    `pendingDiscount` (when supplied) / a 32-hex-char `nonce`.
 *  - returns `{ localSubscriptionId, nonce, expiresAt }`, with `expiresAt`
 *    ~30 minutes out.
 *  - propagates a failure from the correlation-row insert (so the whole
 *    transaction rolls back — a `pending_provider` subscription can never
 *    exist without a way to link it).
 *
 * DB + service-core transaction wrapper: `@repo/db` is mocked (a fake `tx`
 * stub records inserts/updates); `withServiceTransaction` from
 * `@repo/service-core` runs FOR REAL against that mocked `@repo/db`, so this
 * test also exercises the actual transaction-wiring contract, not just a
 * mocked pass-through.
 *
 * @module test/services/billing/pending-provider-subscription-create
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
const txExecuteMock = vi.fn().mockResolvedValue(undefined);

/** A fake tx object passed to the withTransaction callback. */
const txStub = {
    insert: vi.fn(() => ({ values: insertValuesMock })),
    update: vi.fn(() => ({ set: updateSetMock })),
    execute: txExecuteMock
};

const withTransactionMock = vi.fn(
    async (cb: (tx: typeof txStub) => Promise<unknown>, _existing?: unknown) => cb(txStub)
);

const pendingCheckoutCreateMock = vi.fn();

vi.mock('@repo/db', () => ({
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    billingPendingCheckoutModel: {
        create: (...args: unknown[]) => pendingCheckoutCreateMock(...args)
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    withTransaction: (...args: unknown[]) =>
        (withTransactionMock as (...a: unknown[]) => unknown)(...args)
}));

// importActual (not a full replace): `withServiceTransaction`'s real module
// graph (via @repo/service-core) transitively needs real @repo/schemas
// exports (e.g. PermissionEnum in permission.ts).
vi.mock('@repo/schemas', async () => {
    const actual = await vi.importActual('@repo/schemas');
    return {
        ...actual,
        ProductDomainEnum: { ACCOMMODATION: 'accommodation', COMMERCE: 'commerce' },
        SubscriptionStatusEnum: { PENDING_PROVIDER: 'pending_provider' }
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// `withServiceTransaction` (from @repo/service-core) is NOT mocked — it runs
// for real against the mocked `@repo/db.withTransaction` above, so this test
// exercises the actual transaction-wrapper contract the production code uses.
import { createPendingProviderSubscription } from '../../../src/services/billing/pending-provider-subscription-create';

const BASE_INPUT = {
    customerId: 'cust-1',
    planId: 'plan-uuid-1',
    priceId: 'price-m',
    billingInterval: 'monthly' as const,
    mpPreapprovalPlanId: 'mp-plan-1',
    payerEmail: 'host@hospeda.test',
    trialGranted: false,
    livemode: false
};

describe('createPendingProviderSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        insertValuesMock.mockResolvedValue(undefined);
        updateWhereMock.mockResolvedValue(undefined);
        pendingCheckoutCreateMock.mockResolvedValue({ id: 'pending-checkout-1' });
    });

    it('inserts a pending_provider row (no mp id, no promo id) + the correlation row atomically', async () => {
        const before = Date.now();
        const result = await createPendingProviderSubscription(BASE_INPUT);
        const after = Date.now();

        // Returns a UUID-shaped localSubscriptionId, a 32-hex-char nonce, and
        // an expiresAt roughly 30 minutes out.
        expect(result.localSubscriptionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(result.nonce).toMatch(/^[0-9a-f]{32}$/);
        const expiresAtMs = new Date(result.expiresAt).getTime();
        const thirtyMin = 30 * 60 * 1000;
        expect(expiresAtMs).toBeGreaterThanOrEqual(before + thirtyMin - 2000);
        expect(expiresAtMs).toBeLessThanOrEqual(after + thirtyMin + 2000);

        // Insert shape: status='pending_provider', no mp_subscription_id, no
        // promo_code_id (a pendingDiscount is not yet REDEEMED).
        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.status).toBe('pending_provider');
        expect(inserted).not.toHaveProperty('mpSubscriptionId');
        expect(inserted).not.toHaveProperty('promoCodeId');
        expect(inserted.customerId).toBe('cust-1');
        expect(inserted.planId).toBe('plan-uuid-1');
        expect(inserted.billingInterval).toBe('month');
        expect(inserted.intervalCount).toBe(1);
        expect(inserted.livemode).toBe(false);
        expect(inserted.id).toBe(result.localSubscriptionId);

        // currentPeriodEnd is a placeholder bounded to the correlation TTL —
        // NOT NULL, and not before currentPeriodStart.
        const periodStart = inserted.currentPeriodStart as Date;
        const periodEnd = inserted.currentPeriodEnd as Date;
        expect(periodEnd.getTime()).toBeGreaterThanOrEqual(periodStart.getTime());

        // metadata carries traceability fields for the pending row.
        const metadata = inserted.metadata as Record<string, unknown>;
        expect(metadata.source).toBe('start-paid-share-link');
        expect(metadata.intendedInterval).toBe('monthly');
        expect(metadata.priceId).toBe('price-m');
        expect(metadata.mpPreapprovalPlanId).toBe('mp-plan-1');
        expect(metadata.trialGranted).toBe('false');

        // product_domain stamped via a typed UPDATE, defaulting to accommodation.
        expect(updateSetMock).toHaveBeenCalledWith({ productDomain: 'accommodation' });
        expect(updateWhereMock).toHaveBeenCalledWith({
            op: 'eq',
            col: 'id',
            val: result.localSubscriptionId
        });

        // Correlation row created INSIDE the same tx.
        expect(pendingCheckoutCreateMock).toHaveBeenCalledOnce();
        const [correlationArg, txArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect(correlationArg).toMatchObject({
            localSubscriptionId: result.localSubscriptionId,
            customerId: 'cust-1',
            planId: 'plan-uuid-1',
            mpPreapprovalPlanId: 'mp-plan-1',
            nonce: result.nonce,
            payerEmail: 'host@hospeda.test',
            status: 'pending'
        });
        expect(txArg).toBe(txStub);
    });

    it('maps annual interval to billingInterval=year', async () => {
        await createPendingProviderSubscription({ ...BASE_INPUT, billingInterval: 'annual' });

        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.billingInterval).toBe('year');
    });

    it('snapshots a pendingDiscount on the correlation row when supplied', async () => {
        await createPendingProviderSubscription({
            ...BASE_INPUT,
            pendingDiscount: { promoCodeId: 'pc-1', finalAmountCentavos: 5000 }
        });

        const [correlationArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect((correlationArg as Record<string, unknown>).pendingDiscount).toEqual({
            promoCodeId: 'pc-1',
            finalAmountCentavos: 5000
        });
    });

    it('omits pendingDiscount from the correlation row when not supplied', async () => {
        await createPendingProviderSubscription(BASE_INPUT);

        const [correlationArg] = pendingCheckoutCreateMock.mock.calls[0] ?? [];
        expect(correlationArg).not.toHaveProperty('pendingDiscount');
    });

    it('respects an explicit productDomain override', async () => {
        await createPendingProviderSubscription({ ...BASE_INPUT, productDomain: 'commerce' });

        expect(updateSetMock).toHaveBeenCalledWith({ productDomain: 'commerce' });
    });

    it('stamps trialGranted=true into metadata when the checkout granted a trial', async () => {
        await createPendingProviderSubscription({ ...BASE_INPUT, trialGranted: true });

        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        const metadata = inserted.metadata as Record<string, unknown>;
        expect(metadata.trialGranted).toBe('true');
    });

    it('generates a fresh nonce on every call (no accidental reuse)', async () => {
        const first = await createPendingProviderSubscription(BASE_INPUT);
        const second = await createPendingProviderSubscription(BASE_INPUT);

        expect(first.nonce).not.toBe(second.nonce);
    });

    it('propagates a failure from the correlation-row insert (rolls back the whole attempt)', async () => {
        pendingCheckoutCreateMock.mockRejectedValueOnce(new Error('unique constraint violation'));

        await expect(createPendingProviderSubscription(BASE_INPUT)).rejects.toThrow(
            'unique constraint violation'
        );
    });
});
