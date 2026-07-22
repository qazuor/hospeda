/**
 * Unit tests for the subscription_authorized_payment webhook handler
 * (SPEC-141 D4 — full payment recording).
 *
 * Coverage:
 * - extractAuthorizedPaymentId: malformed payload defenses
 * - mapMpStatusToQZPayStatus: every MP → QZPay status branch
 * - happy path: fetch + sub lookup + dedupe negative + record + ACK
 * - idempotency: dedupe positive → no record, ACK
 * - paymentId null → no record, ACK
 * - subscription not found → no record, ACK
 * - fetchAuthorizedPaymentDetails returns not-found / unauthorized / error → ACK
 * - missing env access token → error log, ACK
 * - billing instance unavailable → error log, ACK
 * - malformed payload → ACK without crashing
 * - record() throws → event marked FAILED (T-007 fix — no longer swallowed)
 * - findLocalSubscription throws → event marked FAILED (T-007 fix)
 * - markEventProcessedByProviderId failure is swallowed
 * - amount conversion (major units → centavos) and currency fallback
 *
 * @module test/webhooks/subscription-payment-handler
 */

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared before imports of the handler file).
// ---------------------------------------------------------------------------

vi.mock('../../src/routes/webhooks/mercadopago/utils', () => ({
    markEventProcessedByProviderId: vi.fn(),
    markEventFailedByProviderId: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/event-handler', () => ({
    cleanupRequestProviderEventId: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token' }
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/mp-authorized-payment', () => ({
    fetchAuthorizedPaymentDetails: vi.fn()
}));

// SPEC-262 T-007: renewal promo effect decision (service-core) + MP restore
// executor (apps/api). Mocked so the handler's renewal wiring is exercised
// without a real DB or MercadoPago.
vi.mock('@repo/service-core', () => ({
    resolveRenewalPromoEffect: vi.fn(),
    // HOS-171: the handler now also converts a card-first trial on its first
    // settled charge, which pulls in these. The whole module is replaced here
    // (not spread over the real one) to keep the handler free of a real DB, so
    // every symbol it imports must be listed — a missing one resolves to
    // undefined and the conversion fails silently inside its own catch.
    // Their own logic is unit-tested in @repo/service-core.
    BILLING_EVENT_TYPES: { TRIAL_RECONCILED: 'TRIAL_RECONCILED' },
    checkSubscriptionStatusTransition: vi.fn(() => ({ valid: true })),
    detectExternalChargeInterference: vi.fn(() => null),
    resolveFullPlanPriceCentavos: vi.fn(async () => null),
    withServiceTransaction: vi.fn(async (cb: (ctx: { tx: unknown }) => Promise<unknown>) =>
        cb({ tx: mockTx })
    )
}));

vi.mock('../../src/services/promo-renewal-mp.service', () => ({
    restoreFullPriceMutation: vi.fn()
}));

// The handler drops the entitlement cache when it converts a trial (HOS-171,
// INV-1). Mocked because the real module pulls in PlanService from the
// (module-level mocked) @repo/service-core and would fail to construct it.
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

// `@repo/db` is mocked at the module level so the handler can call
// `getDb()` and we can drive the row results per-test.
const subLookupResult: {
    rows: Array<{
        id: string;
        customerId: string;
        planId?: string | null;
        status?: string;
        trialEnd?: Date | null;
    }>;
} = { rows: [] };
const dedupeResult: { rows: Array<{ id: string }> } = { rows: [] };
// HOS-225 #4: third `db.select()` performed by `backfillMpCustomerId` to read
// the customer's current `mp_customer_id` before deciding whether to write.
// Default: a found customer with the column still unset, so most existing
// happy-path tests exercise the write branch without needing to opt in.
const customerLookupResult: { rows: Array<{ mpCustomerId: string | null }> } = {
    rows: [{ mpCustomerId: null }]
};
let nextSelectCall = 0;

// The transaction the trial conversion writes through (HOS-171). Hoisted so the
// `@repo/service-core` mock's `withServiceTransaction` can hand it to callbacks.
const { mockTx, mockTxUpdateChain, mockTxInsertChain } = vi.hoisted(() => {
    const txUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
    };
    const txInsertChain = { values: vi.fn().mockResolvedValue(undefined) };
    return {
        mockTx: {
            update: vi.fn(() => txUpdateChain),
            insert: vi.fn(() => txInsertChain)
        },
        mockTxUpdateChain: txUpdateChain,
        mockTxInsertChain: txInsertChain
    };
});

// HOS-225 #4: the plain `db.update(billingCustomers)` chain used by
// `backfillMpCustomerId` — a separate, non-transactional write from the
// trial-conversion transaction above. Hoisted so the `@repo/db` mock factory
// below can reference it.
const { mockDbUpdateChain } = vi.hoisted(() => {
    const chain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
    };
    return { mockDbUpdateChain: chain };
});

function makeQueryBuilder<T>(rows: T[]) {
    const builder = {
        from: vi.fn(() => builder),
        where: vi.fn(() => builder),
        limit: vi.fn(() => Promise.resolve(rows))
    };
    return builder;
}

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: vi.fn(() => {
            // Per-handler invocation: first select is the subscription
            // lookup; second select is the payments dedupe lookup; third
            // (HOS-225 #4) is backfillMpCustomerId's mp_customer_id read.
            const i = nextSelectCall;
            nextSelectCall += 1;
            if (i === 0) {
                return makeQueryBuilder(subLookupResult.rows);
            }
            if (i === 1) {
                return makeQueryBuilder(dedupeResult.rows);
            }
            return makeQueryBuilder(customerLookupResult.rows);
        }),
        update: vi.fn(() => mockDbUpdateChain)
    })),
    billingPayments: {
        providerPaymentIds: 'PROVIDER_PAYMENT_IDS_COL',
        deletedAt: 'DELETED_AT_COL'
    },
    billingSubscriptions: {
        id: 'ID_COL',
        customerId: 'CUSTOMER_ID_COL',
        planId: 'PLAN_ID_COL',
        status: 'STATUS_COL',
        trialEnd: 'TRIAL_END_COL',
        mpSubscriptionId: 'MP_SUB_ID_COL',
        deletedAt: 'DELETED_AT_COL'
    },
    billingSubscriptionEvents: {
        id: 'EVENT_ID_COL',
        subscriptionId: 'EVENT_SUB_ID_COL',
        eventType: 'EVENT_TYPE_COL'
    },
    billingCustomers: {
        id: 'BC_ID_COL',
        mpCustomerId: 'BC_MP_CUSTOMER_ID_COL',
        deletedAt: 'BC_DELETED_AT_COL'
    },
    and: (...args: unknown[]) => ({ _and: args }),
    eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
    isNull: (a: unknown) => ({ _isNull: a }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: { strings, values } })
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { resolveRenewalPromoEffect } from '@repo/service-core';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { cleanupRequestProviderEventId } from '../../src/routes/webhooks/mercadopago/event-handler';
import {
    _internals,
    handleSubscriptionAuthorizedPayment
} from '../../src/routes/webhooks/mercadopago/subscription-payment-handler';
import {
    markEventFailedByProviderId,
    markEventProcessedByProviderId
} from '../../src/routes/webhooks/mercadopago/utils';
import { restoreFullPriceMutation } from '../../src/services/promo-renewal-mp.service';
import { apiLogger } from '../../src/utils/logger';
import {
    fetchAuthorizedPaymentDetails,
    type MPAuthorizedPaymentDetails,
    type MPAuthorizedPaymentResult
} from '../../src/utils/mp-authorized-payment';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<QZPayWebhookEvent> = {}): QZPayWebhookEvent {
    return {
        id: 'mp-event-auth-pay-1',
        type: 'subscription_authorized_payment.created',
        data: { id: 'authorized-payment-abc' },
        created: new Date('2026-05-15T10:00:00.000Z'),
        ...overrides
    };
}

function makeMockContext() {
    const store: Record<string, unknown> = { requestId: 'req-1' };
    return {
        get: vi.fn((key: string) => store[key]),
        set: vi.fn((key: string, value: unknown) => {
            store[key] = value;
        })
    };
}

function makeDetails(
    overrides: Partial<MPAuthorizedPaymentDetails> = {}
): MPAuthorizedPaymentDetails {
    return {
        authorizedPaymentId: 'authorized-payment-abc',
        preapprovalId: 'pa-1',
        transactionAmount: 999.5,
        currencyId: 'ARS',
        paymentId: 'mp-pay-99',
        status: 'processed',
        paymentStatus: 'approved',
        debitDate: '2026-06-15T10:00:00.000Z',
        // A clean charge: MercadoPago's own discount-campaign engine did not
        // touch it. Non-null here is what the §7.5 accounting defense alerts on.
        couponAmount: null,
        campaignId: null,
        // HOS-225 #4: the subscriber's MP user id, as MercadoPago reports it on
        // the authorized-payment resource. Default non-null so the mp_customer_id
        // back-fill path is exercised by default; individual tests override it.
        mpPayerId: 'mp-payer-99',
        ...overrides
    };
}

function fetchOk(details: MPAuthorizedPaymentDetails): MPAuthorizedPaymentResult {
    return { kind: 'ok', details };
}

function resetState() {
    subLookupResult.rows = [];
    dedupeResult.rows = [];
    customerLookupResult.rows = [{ mpCustomerId: null }];
    nextSelectCall = 0;
    // Default: renewal decision is a no-op so existing happy-path tests are
    // unaffected; individual SPEC-262 tests override this.
    vi.mocked(resolveRenewalPromoEffect).mockResolvedValue({
        success: true,
        data: { action: 'noop', subscriptionId: 'sub-1' }
    });
    vi.mocked(restoreFullPriceMutation).mockResolvedValue({ success: true });
}

const RECORD_OK = { id: 'billing-payment-uuid' };

function setupBillingMock(): { record: ReturnType<typeof vi.fn> } {
    const record = vi.fn().mockResolvedValue(RECORD_OK);
    vi.mocked(getQZPayBilling).mockReturnValue({
        payments: { record }
    } as unknown as ReturnType<typeof getQZPayBilling>);
    return { record };
}

// ---------------------------------------------------------------------------
// extractAuthorizedPaymentId
// ---------------------------------------------------------------------------

describe('extractAuthorizedPaymentId', () => {
    it('returns the data.id string when present', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: { id: 'pay_123' } })).toBe('pay_123');
    });

    it('returns null when data is missing', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: null })).toBeNull();
    });

    it('returns null when data is not an object', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: 'pay_123' })).toBeNull();
    });

    it('returns null when data.id is missing', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: {} })).toBeNull();
    });

    it('returns null when data.id is empty string', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: { id: '' } })).toBeNull();
    });

    it('returns null when data.id is not a string', () => {
        expect(_internals.extractAuthorizedPaymentId({ data: { id: 123 } })).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// mapMpStatusToQZPayStatus
// ---------------------------------------------------------------------------

describe('mapMpStatusToQZPayStatus', () => {
    const cases: Array<{ input: Partial<MPAuthorizedPaymentDetails>; expected: string }> = [
        { input: { paymentStatus: 'approved' }, expected: 'succeeded' },
        { input: { paymentStatus: 'processed' }, expected: 'succeeded' },
        { input: { paymentStatus: 'rejected' }, expected: 'failed' },
        { input: { paymentStatus: 'cancelled' }, expected: 'canceled' },
        { input: { paymentStatus: 'canceled' }, expected: 'canceled' },
        { input: { paymentStatus: 'refunded' }, expected: 'refunded' },
        { input: { paymentStatus: 'in_process' }, expected: 'processing' },
        { input: { paymentStatus: 'in_mediation' }, expected: 'processing' },
        { input: { paymentStatus: 'pending' }, expected: 'pending' },
        { input: { paymentStatus: 'unknown_value_xyz' }, expected: 'pending' }
    ];

    for (const { input, expected } of cases) {
        it(`maps paymentStatus="${input.paymentStatus}" → "${expected}"`, () => {
            expect(_internals.mapMpStatusToQZPayStatus(makeDetails(input))).toBe(expected);
        });
    }

    it('falls back to outer status when paymentStatus is null', () => {
        expect(
            _internals.mapMpStatusToQZPayStatus(
                makeDetails({ paymentStatus: null, status: 'cancelled' })
            )
        ).toBe('canceled');
    });

    it('returns pending when both paymentStatus and outer status are unknown', () => {
        expect(
            _internals.mapMpStatusToQZPayStatus(
                makeDetails({ paymentStatus: null, status: 'scheduled' })
            )
        ).toBe('pending');
    });
});

// ---------------------------------------------------------------------------
// handleSubscriptionAuthorizedPayment — orchestration
// ---------------------------------------------------------------------------

describe('handleSubscriptionAuthorizedPayment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetState();
        vi.mocked(markEventProcessedByProviderId).mockResolvedValue(undefined);
        vi.mocked(markEventFailedByProviderId).mockResolvedValue(undefined);
    });

    it('happy path: records the payment with mapped status and centavo amount', async () => {
        subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
        dedupeResult.rows = [];
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
        const { record } = setupBillingMock();

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(record).toHaveBeenCalledOnce();
        const arg = record.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(arg.customerId).toBe('cust-1');
        expect(arg.subscriptionId).toBe('local-sub-1');
        expect(arg.amount).toBe(99950); // 999.50 → 99950 centavos
        expect(arg.currency).toBe('ARS');
        expect(arg.status).toBe('succeeded');
        expect(arg.provider).toBe('mercadopago');
        expect(arg.providerPaymentId).toBe('mp-pay-99');
        expect(typeof arg.id).toBe('string');
        expect((arg.metadata as Record<string, unknown>).mpAuthorizedPaymentId).toBe(
            'authorized-payment-abc'
        );
        expect((arg.metadata as Record<string, unknown>).mpDebitDate).toBe(
            '2026-06-15T10:00:00.000Z'
        );
        expect(markEventProcessedByProviderId).toHaveBeenCalledWith({
            providerEventId: 'mp-event-auth-pay-1'
        });
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    it('idempotent skip when the MP payment id is already recorded', async () => {
        subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
        dedupeResult.rows = [{ id: 'existing-payment-row' }];
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
        const { record } = setupBillingMock();

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(record).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    it('skips recording when paymentId is null (pre-settlement)', async () => {
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
            fetchOk(makeDetails({ paymentId: null, status: 'scheduled' }))
        );
        const { record } = setupBillingMock();

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(record).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
    });

    it('does not record when no local subscription matches the preapproval id', async () => {
        subLookupResult.rows = []; // no match
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
        const { record } = setupBillingMock();

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(record).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
    });

    it('acknowledges when fetchAuthorizedPaymentDetails returns not-found', async () => {
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue({
            kind: 'not-found',
            authorizedPaymentId: 'gone'
        });
        const { record } = setupBillingMock();

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(record).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
    });

    it('acknowledges when fetchAuthorizedPaymentDetails returns unauthorized', async () => {
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue({
            kind: 'unauthorized',
            authorizedPaymentId: 'x'
        });
        const { record } = setupBillingMock();

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(record).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
    });

    it('acknowledges when fetchAuthorizedPaymentDetails returns error', async () => {
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue({
            kind: 'error',
            authorizedPaymentId: 'x',
            message: 'boom'
        });
        const { record } = setupBillingMock();

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(record).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
    });

    it('acknowledges malformed payloads (no data.id) without crashing', async () => {
        const { record } = setupBillingMock();

        await expect(
            handleSubscriptionAuthorizedPayment(
                makeMockContext() as never,
                makeEvent({ data: null })
            )
        ).resolves.toBeUndefined();

        expect(fetchAuthorizedPaymentDetails).not.toHaveBeenCalled();
        expect(record).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
    });

    it('acknowledges when billing instance is unavailable', async () => {
        vi.mocked(getQZPayBilling).mockReturnValue(
            undefined as unknown as ReturnType<typeof getQZPayBilling>
        );

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(fetchAuthorizedPaymentDetails).not.toHaveBeenCalled();
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
    });

    it('[T-007 RED] record() throws → event marked FAILED, NOT marked processed', async () => {
        subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
        dedupeResult.rows = [];
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
        const record = vi.fn().mockRejectedValue(new Error('storage offline'));
        vi.mocked(getQZPayBilling).mockReturnValue({
            payments: { record }
        } as unknown as ReturnType<typeof getQZPayBilling>);

        await expect(
            handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
        ).resolves.toBeUndefined();

        expect(record).toHaveBeenCalledOnce();
        // SHOULD mark FAILED — today the handler swallows and marks processed instead
        expect(markEventFailedByProviderId).toHaveBeenCalledWith(
            expect.objectContaining({ providerEventId: 'mp-event-auth-pay-1' })
        );
        expect(markEventProcessedByProviderId).not.toHaveBeenCalled();
        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    it('does NOT throw when markEventProcessedByProviderId fails', async () => {
        subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
        setupBillingMock();
        vi.mocked(markEventProcessedByProviderId).mockRejectedValue(new Error('db down'));

        await expect(
            handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
        ).resolves.toBeUndefined();

        expect(cleanupRequestProviderEventId).toHaveBeenCalledOnce();
    });

    it('[T-007 RED] DB throws in findLocalSubscription → event marked FAILED', async () => {
        // The inner try block wraps findLocalSubscriptionByPreapprovalId.
        // A DB failure there is a transient error — must mark failed, not processed.
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
        setupBillingMock();
        // Override the module-level getDb mock to throw on select (DB down scenario).
        // We intercept via the select counter: make the first select throw synchronously.
        // Use a flag so subsequent tests still get the normal counter-based mock.
        const originalNextSelectCall = nextSelectCall;
        const throwingDb = {
            select: vi.fn(() => {
                throw new Error('DB connection refused');
            })
        };
        const { getDb } = await import('@repo/db');
        vi.mocked(getDb).mockReturnValueOnce(throwingDb as never);
        nextSelectCall = originalNextSelectCall; // reset after override

        await expect(
            handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
        ).resolves.toBeUndefined();

        // SHOULD mark FAILED — today the handler swallows and marks processed instead
        expect(markEventFailedByProviderId).toHaveBeenCalledWith(
            expect.objectContaining({ providerEventId: 'mp-event-auth-pay-1' })
        );
        expect(markEventProcessedByProviderId).not.toHaveBeenCalled();
    });

    it('handler never throws even when mark-failed itself fails', async () => {
        subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
        dedupeResult.rows = [];
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
        const record = vi.fn().mockRejectedValue(new Error('storage offline'));
        vi.mocked(getQZPayBilling).mockReturnValue({
            payments: { record }
        } as unknown as ReturnType<typeof getQZPayBilling>);
        vi.mocked(markEventFailedByProviderId).mockRejectedValue(new Error('mark-failed down'));

        await expect(
            handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
        ).resolves.toBeUndefined();
    });

    it('rounds half-cent transaction amounts correctly (999.555 → 99956 centavos)', async () => {
        subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
        vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
            fetchOk(makeDetails({ transactionAmount: 999.555 }))
        );
        const { record } = setupBillingMock();

        await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

        expect(record).toHaveBeenCalledOnce();
        const arg = record.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(arg.amount).toBe(99956);
    });

    // ---------------------------------------------------------------------------
    // SPEC-262 T-007: multi-cycle discount renewal wiring (AC-1.5)
    // ---------------------------------------------------------------------------

    describe('SPEC-262 renewal promo effect wiring', () => {
        it('restore-full decision: calls restoreFullPriceMutation with the target amount', async () => {
            // Arrange
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();
            vi.mocked(resolveRenewalPromoEffect).mockResolvedValue({
                success: true,
                data: {
                    action: 'restore-full',
                    targetTransactionAmountMajor: 100,
                    targetTransactionAmountCentavos: 10000,
                    remainingCyclesAfter: 0,
                    subscriptionId: 'local-sub-1',
                    promoCodeId: 'pc-1'
                }
            });

            // Act
            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            // Assert
            expect(resolveRenewalPromoEffect).toHaveBeenCalledWith({
                subscriptionId: 'local-sub-1'
            });
            expect(restoreFullPriceMutation).toHaveBeenCalledOnce();
            const arg = vi.mocked(restoreFullPriceMutation).mock.calls[0]?.[0];
            expect(arg?.targetTransactionAmountMajor).toBe(100);
            // preapprovalId from the authorized-payment details is the MP sub id
            expect(arg?.mpSubscriptionId).toBe('pa-1');
        });

        it('apply-discount decision: does NOT call the MP restore mutation', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();
            vi.mocked(resolveRenewalPromoEffect).mockResolvedValue({
                success: true,
                data: {
                    action: 'apply-discount',
                    targetTransactionAmountMajor: 50,
                    targetTransactionAmountCentavos: 5000,
                    remainingCyclesAfter: 1,
                    subscriptionId: 'local-sub-1'
                }
            });

            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            expect(restoreFullPriceMutation).not.toHaveBeenCalled();
        });

        it('comp decision: no MP restore mutation', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();
            vi.mocked(resolveRenewalPromoEffect).mockResolvedValue({
                success: true,
                data: { action: 'comp', subscriptionId: 'local-sub-1' }
            });

            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            expect(restoreFullPriceMutation).not.toHaveBeenCalled();
        });

        it('renewal resolver failure does not break the webhook (still ACKs)', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();
            vi.mocked(resolveRenewalPromoEffect).mockResolvedValue({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'boom' }
            });

            await expect(
                handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
            ).resolves.toBeUndefined();
            expect(restoreFullPriceMutation).not.toHaveBeenCalled();
            expect(markEventProcessedByProviderId).toHaveBeenCalled();
        });

        it('B2: rejected charge (status=failed) does NOT decrement the cycle counter', async () => {
            // A rejected charge must not consume a discounted cycle — the MP retry
            // (different paymentId, passes per-paymentId dedup) would decrement again
            // and end the discount one cycle early.
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ paymentStatus: 'rejected', status: 'rejected' }))
            );
            setupBillingMock();

            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            // The charge failed → renewal promo effect must NOT be called.
            expect(resolveRenewalPromoEffect).not.toHaveBeenCalled();
            expect(restoreFullPriceMutation).not.toHaveBeenCalled();
            expect(markEventProcessedByProviderId).toHaveBeenCalled();
        });

        it('B2: in_process charge does NOT decrement the cycle counter (non-terminal)', async () => {
            // An in_process charge (paymentStatus='in_process', maps to qzpay 'processing')
            // is NON-TERMINAL — the payment may still succeed or fail on the next attempt.
            // Decrementing here would consume a discounted cycle prematurely, before a final
            // settlement event confirms the charge. Only 'succeeded' (approved/processed) may
            // consume a cycle. This locks in that the B2 fix is `status === 'succeeded'` ONLY
            // (not `|| status === 'processing'`).
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ paymentStatus: 'in_process', status: 'in_process' }))
            );
            setupBillingMock();

            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            // Non-terminal charge → renewal promo effect must NOT be called.
            expect(resolveRenewalPromoEffect).not.toHaveBeenCalled();
            expect(restoreFullPriceMutation).not.toHaveBeenCalled();
            // The event is still acknowledged (processed) — we don't fail it.
            expect(markEventProcessedByProviderId).toHaveBeenCalled();
        });

        it('restore mutation failure (best-effort) does not break the webhook', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();
            vi.mocked(resolveRenewalPromoEffect).mockResolvedValue({
                success: true,
                data: {
                    action: 'restore-full',
                    targetTransactionAmountMajor: 100,
                    targetTransactionAmountCentavos: 10000,
                    remainingCyclesAfter: 0,
                    subscriptionId: 'local-sub-1'
                }
            });
            vi.mocked(restoreFullPriceMutation).mockResolvedValue({
                success: false,
                error: { code: 'MP_RESTORE_FAILED', message: 'mp down' }
            });

            await expect(
                handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
            ).resolves.toBeUndefined();
            expect(markEventProcessedByProviderId).toHaveBeenCalled();
        });
    });

    // ── HOS-171: card-first trial conversion ────────────────────────────────
    //
    // This is the PRIMARY conversion path. MercadoPago charges a card-first
    // trial at day N without changing the preapproval's status, so this event
    // is the only signal that the charge happened. If the conversion waited for
    // the daily reconcile cron, a customer MP just charged would sit at
    // `trialing` with an elapsed trial_end — and the trial middleware answers
    // that state with HTTP 402 on every write, for up to 24h, right after they
    // paid.
    describe('card-first trial conversion (HOS-171)', () => {
        /** A local row mid-trial, whose day-N charge is what this event reports. */
        const trialingRow = {
            id: 'local-sub-1',
            customerId: 'cust-1',
            planId: 'plan-1',
            status: 'trialing',
            trialEnd: new Date('2026-05-15T00:00:00.000Z')
        };

        it('flips a trialing subscription to active when the charge settles', async () => {
            // Arrange
            subLookupResult.rows = [trialingRow];
            dedupeResult.rows = [];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();

            // Act
            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            // Assert — converted, and stamped as a conversion rather than an expiry
            expect(mockTxUpdateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'active', trialConverted: true })
            );
        });

        it('records a TRIAL_RECONCILED event attributed to the webhook', async () => {
            // Arrange
            subLookupResult.rows = [trialingRow];
            dedupeResult.rows = [];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();

            // Act
            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            // Assert — same fact the cron would record, different discoverer.
            // This is also what makes the cron's dedup guard skip this sub.
            expect(mockTxInsertChain.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'TRIAL_RECONCILED',
                    previousStatus: 'trialing',
                    newStatus: 'active',
                    triggerSource: 'subscription-authorized-payment-webhook'
                })
            );
        });

        it('drops the entitlement cache so the customer can use what they paid for', async () => {
            // Arrange
            subLookupResult.rows = [trialingRow];
            dedupeResult.rows = [];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();

            // Act
            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            // Assert — INV-1: never make them wait out the 5-minute cache
            expect(clearEntitlementCache).toHaveBeenCalledWith('cust-1');
        });

        it('leaves an already-active subscription alone (idempotent on retry)', async () => {
            // Arrange — a webhook redelivery, or the cron got there first
            subLookupResult.rows = [{ ...trialingRow, status: 'active' }];
            dedupeResult.rows = [];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();

            // Act
            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            // Assert — only a trialing row is ever converted
            expect(mockTxUpdateChain.set).not.toHaveBeenCalled();
        });

        it('does NOT convert when the charge did not succeed', async () => {
            // Arrange — a rejected day-N charge is past_due territory, and the
            // reconciler/dunning own it. Converting here would mark someone paid
            // who is not.
            subLookupResult.rows = [trialingRow];
            dedupeResult.rows = [];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ paymentStatus: 'rejected' }))
            );
            setupBillingMock();

            // Act
            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            // Assert
            expect(mockTxUpdateChain.set).not.toHaveBeenCalled();
        });

        it('still acknowledges the event when the conversion write fails', async () => {
            // Arrange — the charge already settled and is already recorded; a
            // failed status flip must not turn into a webhook retry storm. The
            // reconcile cron is the backstop.
            subLookupResult.rows = [trialingRow];
            dedupeResult.rows = [];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(fetchOk(makeDetails()));
            setupBillingMock();
            mockTxUpdateChain.where.mockRejectedValueOnce(new Error('db down'));

            // Act & Assert
            await expect(
                handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
            ).resolves.toBeUndefined();
            expect(markEventProcessedByProviderId).toHaveBeenCalled();
        });
    });

    // ── HOS-225 defect #4: mp_customer_id back-fill ─────────────────────────
    //
    // billing_customers.mp_customer_id is never populated after a real MP
    // charge. This handler is the first reliable signal of the subscriber's
    // MP payer id, so it back-fills the column — idempotently (only when
    // unset) and soft-fail (never breaks payment recording).
    describe('mp_customer_id back-fill (HOS-225 #4)', () => {
        it('writes mp_customer_id when it is currently unset', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            dedupeResult.rows = [];
            customerLookupResult.rows = [{ mpCustomerId: null }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ mpPayerId: 'mp-payer-abc' }))
            );
            setupBillingMock();

            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            expect(mockDbUpdateChain.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    mpCustomerId: 'mp-payer-abc',
                    updatedAt: expect.any(Date)
                })
            );
            expect(mockDbUpdateChain.where).toHaveBeenCalled();
        });

        it('does NOT overwrite an already-set mp_customer_id', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            dedupeResult.rows = [];
            customerLookupResult.rows = [{ mpCustomerId: 'already-set-mp-cus' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ mpPayerId: 'mp-payer-abc' }))
            );
            setupBillingMock();

            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            expect(mockDbUpdateChain.set).not.toHaveBeenCalled();
        });

        it('does not overwrite even when the observed payer id differs from the stored one', async () => {
            // Divergence is a reconciliation question, not something the
            // webhook should resolve unilaterally — the idempotency contract
            // is "only write when unset", full stop.
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            dedupeResult.rows = [];
            customerLookupResult.rows = [{ mpCustomerId: 'different-mp-cus' }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ mpPayerId: 'mp-payer-abc' }))
            );
            setupBillingMock();

            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            expect(mockDbUpdateChain.set).not.toHaveBeenCalled();
        });

        it('skips the back-fill entirely AND warns when no payer id was parsed (HOS-234)', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            dedupeResult.rows = [];
            vi.mocked(apiLogger.warn).mockClear();
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ mpPayerId: null }))
            );
            setupBillingMock();

            await handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent());

            expect(mockDbUpdateChain.set).not.toHaveBeenCalled();
            // HOS-234: the (previously silent) early-return now logs at WARN so a
            // NULL mp_customer_id in prod is attributable to an absent payer_id.
            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({ customerId: 'cust-1' }),
                expect.stringContaining('no payer_id')
            );
        });

        it('is a no-op (warns, does not throw) when the local customer row is not found', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            dedupeResult.rows = [];
            customerLookupResult.rows = [];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ mpPayerId: 'mp-payer-abc' }))
            );
            setupBillingMock();

            await expect(
                handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
            ).resolves.toBeUndefined();

            expect(mockDbUpdateChain.set).not.toHaveBeenCalled();
            expect(markEventProcessedByProviderId).toHaveBeenCalled();
        });

        it('soft-fails (does not break the webhook) when the customer lookup throws', async () => {
            // The handler resolves `getDb()` freshly in each of its three
            // helpers (subscription lookup, dedupe lookup, mp_customer_id
            // back-fill). Let the first two calls behave normally via the
            // default mock implementation, and intercept only the third
            // (backfillMpCustomerId's) to throw — isolating the soft-fail to
            // that single step, mirroring the "DB throws" test pattern above.
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            dedupeResult.rows = [];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ mpPayerId: 'mp-payer-abc' }))
            );
            setupBillingMock();

            const { getDb } = await import('@repo/db');
            const defaultImpl = vi.mocked(getDb).getMockImplementation();
            if (!defaultImpl) throw new Error('getDb has no default mock implementation');
            vi.mocked(getDb).mockReturnValueOnce(defaultImpl());
            vi.mocked(getDb).mockReturnValueOnce(defaultImpl());
            vi.mocked(getDb).mockReturnValueOnce({
                select: vi.fn(() => {
                    throw new Error('customer lookup DB down');
                }),
                update: vi.fn(() => mockDbUpdateChain)
            } as never);

            await expect(
                handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
            ).resolves.toBeUndefined();

            expect(mockDbUpdateChain.set).not.toHaveBeenCalled();
            // The payment itself still recorded and the event is still ACKed —
            // a back-fill failure must never turn into a retry storm.
            expect(markEventProcessedByProviderId).toHaveBeenCalled();
        });

        it('soft-fails (does not break the webhook) when the update itself throws', async () => {
            subLookupResult.rows = [{ id: 'local-sub-1', customerId: 'cust-1' }];
            dedupeResult.rows = [];
            customerLookupResult.rows = [{ mpCustomerId: null }];
            vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue(
                fetchOk(makeDetails({ mpPayerId: 'mp-payer-abc' }))
            );
            setupBillingMock();
            mockDbUpdateChain.where.mockRejectedValueOnce(new Error('update failed'));

            await expect(
                handleSubscriptionAuthorizedPayment(makeMockContext() as never, makeEvent())
            ).resolves.toBeUndefined();

            expect(markEventProcessedByProviderId).toHaveBeenCalled();
        });
    });
});
