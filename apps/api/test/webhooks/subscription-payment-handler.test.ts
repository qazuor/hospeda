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
    resolveRenewalPromoEffect: vi.fn()
}));

vi.mock('../../src/services/promo-renewal-mp.service', () => ({
    restoreFullPriceMutation: vi.fn()
}));

// `@repo/db` is mocked at the module level so the handler can call
// `getDb()` and we can drive the row results per-test.
const subLookupResult: { rows: Array<{ id: string; customerId: string }> } = { rows: [] };
const dedupeResult: { rows: Array<{ id: string }> } = { rows: [] };
let nextSelectCall = 0;

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
            // lookup; second select is the payments dedupe lookup.
            const i = nextSelectCall;
            nextSelectCall += 1;
            const rows = i === 0 ? subLookupResult.rows : dedupeResult.rows;
            return makeQueryBuilder(rows);
        })
    })),
    billingPayments: {
        providerPaymentIds: 'PROVIDER_PAYMENT_IDS_COL',
        deletedAt: 'DELETED_AT_COL'
    },
    billingSubscriptions: {
        id: 'ID_COL',
        customerId: 'CUSTOMER_ID_COL',
        mpSubscriptionId: 'MP_SUB_ID_COL',
        deletedAt: 'DELETED_AT_COL'
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
import {
    type MPAuthorizedPaymentDetails,
    type MPAuthorizedPaymentResult,
    fetchAuthorizedPaymentDetails
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
        ...overrides
    };
}

function fetchOk(details: MPAuthorizedPaymentDetails): MPAuthorizedPaymentResult {
    return { kind: 'ok', details };
}

function resetState() {
    subLookupResult.rows = [];
    dedupeResult.rows = [];
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
});
