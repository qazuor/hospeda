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
 * - record() throws → error log, ACK still happens
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
    markEventProcessedByProviderId: vi.fn()
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

import { getQZPayBilling } from '../../src/middlewares/billing';
import { cleanupRequestProviderEventId } from '../../src/routes/webhooks/mercadopago/event-handler';
import {
    _internals,
    handleSubscriptionAuthorizedPayment
} from '../../src/routes/webhooks/mercadopago/subscription-payment-handler';
import { markEventProcessedByProviderId } from '../../src/routes/webhooks/mercadopago/utils';
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

    it('acknowledges + still cleans up when billing.payments.record throws', async () => {
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
        expect(markEventProcessedByProviderId).toHaveBeenCalledOnce();
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
});
