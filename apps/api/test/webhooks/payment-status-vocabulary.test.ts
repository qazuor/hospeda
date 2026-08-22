/**
 * End-to-end status-vocabulary tests for the MercadoPago payment webhook
 * (HOS-757).
 *
 * ## Why this file exists
 *
 * The bug it guards survived for months with three suites green, because not
 * one of them ever traversed the real vocabulary:
 *
 * - `test/routes/webhooks/payment-logic.test.ts` mocks `extractPaymentInfo`, so
 *   it hands `processPaymentUpdated` whatever status the test author typed —
 *   it can never disagree with the producer.
 * - `test/webhooks/mercadopago.test.ts` stubs `payments.retrieve` with a
 *   hand-written `'approved'`, which is the value the adapter would have
 *   REWRITTEN. The stub reproduced the code's assumption instead of the
 *   provider's behaviour.
 * - `test/webhooks/payment-handler.test.ts` mocks `processPaymentUpdated`
 *   entirely, so the status never reaches a predicate at all.
 *
 * Each of the three is blind on its own; together they left the whole chain
 * unverified. These tests run it end to end —
 * `payments.retrieve` → `payment-handler` → the REAL `extractPaymentInfo` →
 * `processPaymentUpdated`'s dispatch gates — and they take the status from the
 * adapter package's own mapping table rather than retyping it, so a change in
 * how qzpay normalizes MercadoPago statuses breaks these tests instead of
 * silently re-opening the gap.
 *
 * @module test/webhooks/payment-status-vocabulary
 */

import { MERCADOPAGO_PAYMENT_STATUS, mapMPPaymentStatus } from '@qazuor/qzpay-mercadopago';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks. Only the LEAVES are mocked — the status has to travel the real
// path from the adapter response to the dispatch predicate, so neither
// `extractPaymentInfo` nor `processPaymentUpdated` may be stubbed here.
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/lib/sentry', () => ({
    captureWebhookError: vi.fn(),
    captureBillingError: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/event-handler', () => ({
    cleanupRequestProviderEventId: vi.fn()
}));

// The success double RECORDS the delivery into `deliveredReceipts`, because
// that is what the real notification service does (it writes the
// `billing_notification_log` row carrying the idempotency key). A double that
// only counted calls would let the exactly-once tests pass with the guard
// removed: nothing would ever be written, so the second pass would always find
// an empty table and send again — the test would be asserting the mock, not the
// mechanism.
vi.mock('../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendPaymentSuccessNotification: vi
        .fn()
        .mockImplementation(
            async (
                _customerId: string,
                _amount: number,
                _currency: string,
                _paymentMethod: string | null,
                _billing: unknown,
                idempotencyKey?: string
            ) => {
                const paymentId = idempotencyKey?.split(':').at(-1);
                if (paymentId) {
                    dbState.deliveredReceipts.add(paymentId);
                }
            }
        ),
    sendPaymentFailureNotifications: vi.fn().mockResolvedValue(undefined)
}));

const { mockPostHogCapture } = vi.hoisted(() => ({ mockPostHogCapture: vi.fn() }));

vi.mock('../../src/lib/posthog', () => ({
    getPostHogClient: () => ({ capture: mockPostHogCapture }),
    captureServerAnalyticsEvent: (input: {
        distinctId: string;
        name: string;
        properties: Record<string, unknown>;
    }) => {
        mockPostHogCapture({
            distinctId: input.distinctId,
            event: input.name,
            properties: input.properties
        });
    },
    isPostHogEnabled: () => true,
    shutdownPostHog: vi.fn(),
    _resetPostHogClientForTests: vi.fn()
}));

/**
 * State the mocked Drizzle client answers from.
 *
 * `deliveredReceipts` models `billing_notification_log`: the provider payment
 * ids whose PAYMENT_SUCCESS receipt has already been DELIVERED. It is what
 * `wasPaymentSuccessAlreadyDispatched` reads, so it is what makes the
 * exactly-once cases below exercise the real mechanism rather than a stand-in.
 *
 * A successful send appends to it, exactly as the notification service writes
 * the row — otherwise the second delivery in a sequence would find an empty
 * table and the test would pass with the guard doing nothing.
 */
const dbState: {
    deliveredReceipts: Set<string>;
    subRows: Array<Record<string, unknown>>;
    updateCalls: Array<{ values: unknown }>;
} = { deliveredReceipts: new Set(), subRows: [], updateCalls: [] };

vi.mock('@repo/db', () => {
    let selectIndex = 0;
    function makeSelectChain<T>(rows: T[]) {
        const chain = {
            from: () => chain,
            where: () => chain,
            limit: async () => rows
        };
        return chain;
    }
    /**
     * The `billing_notification_log` lookup. Reads the idempotency key back out
     * of the `where` clause the production code built, and answers from
     * `deliveredReceipts`.
     */
    function makeReceiptChain() {
        let key: string | null = null;
        const chain = {
            from: () => chain,
            where: (cond: unknown) => {
                const found = JSON.stringify(cond ?? {}).match(
                    /payment-success:mercadopago:([\w-]+)/
                );
                key = found?.[1] ?? null;
                return chain;
            },
            limit: async () =>
                key !== null && dbState.deliveredReceipts.has(key) ? [{ id: 'log-row-1' }] : []
        };
        return chain;
    }
    return {
        AccommodationModel: vi.fn(function () {
            return { findIdsByOwnerId: vi.fn(async () => []) };
        }),
        entityViewModel: {
            insertView: vi.fn(),
            getStatsForEntities: vi.fn(async () => []),
            purgeOlderThan: vi.fn(async () => 0)
        },
        getDb: vi.fn(() => {
            selectIndex = 0;
            return {
                // The notification-log lookup is routed by the COLUMN SENTINELS
                // in its projection, not by call order: it runs before every
                // other select in the flow, so an index-based stub would shift
                // each time the dispatch order changed and would silently start
                // answering a different query.
                select: vi.fn((cols?: Record<string, unknown>) => {
                    if (cols && Object.values(cols).includes('NOTIFICATION_LOG_ID')) {
                        return makeReceiptChain();
                    }
                    const i = selectIndex;
                    selectIndex += 1;
                    return makeSelectChain(i === 0 ? dbState.subRows : []);
                }),
                update: vi.fn(() => ({
                    set: (values: unknown) => ({
                        where: () => {
                            dbState.updateCalls.push({ values });
                            return Promise.resolve(undefined);
                        }
                    })
                }))
            };
        }),
        billingSubscriptions: {
            id: 'ID',
            customerId: 'CUSTOMER_ID',
            status: 'STATUS',
            deletedAt: 'DELETED_AT'
        },
        billingPayments: { id: 'PAYMENT_ID', providerPaymentIds: 'PROVIDER_PAYMENT_IDS' },
        billingAddonPurchases: { id: 'ADDON_PURCHASE_ID', paymentId: 'PAYMENT_ID_COL' },
        billingNotificationLog: {
            id: 'NOTIFICATION_LOG_ID',
            type: 'NOTIFICATION_LOG_TYPE',
            customerId: 'NOTIFICATION_LOG_CUSTOMER_ID',
            status: 'NOTIFICATION_LOG_STATUS',
            metadata: 'NOTIFICATION_LOG_METADATA'
        },
        and: (...args: unknown[]) => ({ _and: args }),
        eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
        isNull: (a: unknown) => ({ _isNull: a }),
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })
    };
});

// The add-on idempotency lookup imports this path dynamically; it is a separate
// module specifier from '@repo/db' and needs its own mock.
vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: { id: 'ADDON_PURCHASE_ID', paymentId: 'PAYMENT_ID_COL' }
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    resolveOwnerPlanGrantsFeatured: vi.fn().mockResolvedValue(false),
    syncFeaturedByEntitlementForOwner: vi.fn().mockResolvedValue(undefined),
    getPromoCodeById: vi.fn(),
    resolveFullPlanPriceCentavos: vi.fn()
}));

vi.mock('../../src/services/subscription-pause.service', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    resolveOwnerUserId: vi.fn().mockResolvedValue('usr-1')
}));

vi.mock('../../src/middlewares/entitlement', () => ({ clearEntitlementCache: vi.fn() }));

vi.mock('../../src/services/refund-lifecycle.service', () => ({
    applyRefundLifecycle: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/billing/orphan-payment-queue.service', () => ({
    recordOrphanPayment: vi
        .fn()
        .mockResolvedValue({ queued: true, alreadyQueued: false, failed: false })
}));

vi.mock('../../src/services/addon.service', () => {
    const confirmPurchase = vi.fn().mockResolvedValue({ success: true, data: undefined });
    const MockAddonService = vi.fn().mockImplementation(function () {
        return { confirmPurchase };
    });
    (MockAddonService as unknown as Record<string, unknown>).__mockConfirmPurchase =
        confirmPurchase;
    return { AddonService: MockAddonService };
});

vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    createMercadoPagoAdapter: vi.fn().mockReturnValue({})
}));

const mockMarkEventProcessed = vi.hoisted(() => vi.fn());
const mockMarkEventFailed = vi.hoisted(() => vi.fn());
const mockGetWebhookDependencies = vi.hoisted(() => vi.fn());

// Partial mock: `extractPaymentInfo` and the metadata extractors stay REAL —
// they are the translation step under test.
vi.mock('../../src/routes/webhooks/mercadopago/utils', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    getWebhookDependencies: mockGetWebhookDependencies,
    markEventProcessedByProviderId: mockMarkEventProcessed,
    markEventFailedByProviderId: mockMarkEventFailed
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import type { QZPayBilling, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import {
    sendPaymentFailureNotifications,
    sendPaymentSuccessNotification
} from '../../src/routes/webhooks/mercadopago/notifications';
import { handlePaymentUpdated } from '../../src/routes/webhooks/mercadopago/payment-handler';
import { processPaymentUpdated } from '../../src/routes/webhooks/mercadopago/payment-logic';
import { AddonService } from '../../src/services/addon.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MP_PAYMENT_ID = '174625958196';
const CUSTOMER_ID = 'cust-1';

/** Amount as the adapter reports it: CENTAVOS. 500_000 centavos = $5.000,00. */
const AMOUNT_CENTAVOS = 500_000;
/** The same amount in the MAJOR units `extractPaymentInfo` reads. */
const AMOUNT_MAJOR = 5000;

function getMockConfirmPurchase(): ReturnType<typeof vi.fn> {
    return (AddonService as unknown as Record<string, unknown>).__mockConfirmPurchase as ReturnType<
        typeof vi.fn
    >;
}

const mockBilling = {
    customers: { get: vi.fn().mockResolvedValue({ id: CUSTOMER_ID, email: 'u@test.com' }) },
    subscriptions: { getByCustomerId: vi.fn().mockResolvedValue([]) },
    payments: { record: vi.fn().mockResolvedValue({ id: 'pay-row-1' }) },
    getStorage: vi.fn(() => ({ subscriptionPollingJobs: null }))
} as unknown as QZPayBilling;

/**
 * A payment as the qzpay MercadoPago adapter returns it — the ONLY shape
 * `payment-handler.ts` ever sees.
 *
 * `status` is produced by the adapter package's own `mapMPPaymentStatus`, given
 * the RAW MercadoPago status. Nothing here retypes the normalized word, so if
 * the adapter's table changes these tests change with it.
 */
function providerPaymentFor(rawMpStatus: string, metadata: Record<string, unknown> = {}) {
    return {
        id: MP_PAYMENT_ID,
        status: mapMPPaymentStatus(rawMpStatus),
        amount: AMOUNT_CENTAVOS,
        currency: 'ARS',
        metadata
    };
}

function makeEvent(eventId = 'mp-event-1'): QZPayWebhookEvent {
    return {
        id: eventId,
        type: 'payment.updated',
        data: { id: MP_PAYMENT_ID },
        created: Date.now(),
        raw: {}
    } as unknown as QZPayWebhookEvent;
}

function makeContext() {
    return { get: vi.fn(() => 'req-1') } as never;
}

/**
 * Wire `payments.retrieve` to answer with the given raw MP status, normalized
 * by the real adapter mapping, and run the live webhook handler.
 */
async function deliverWebhook(
    rawMpStatus: string,
    metadata: Record<string, unknown> = {},
    eventId = 'mp-event-1'
) {
    const retrieve = vi.fn().mockResolvedValue(providerPaymentFor(rawMpStatus, metadata));
    mockGetWebhookDependencies.mockReturnValue({
        billing: mockBilling,
        paymentAdapter: { payments: { retrieve } }
    });
    // `eventId` is the NOTIFICATION id, distinct from `MP_PAYMENT_ID`. Two
    // deliveries with different event ids model exactly what MercadoPago does
    // when it notifies twice about one charge — and what the upstream
    // `billing_webhook_events` guard cannot catch, because it dedupes on this
    // value rather than on the payment.
    await handlePaymentUpdated(makeContext(), makeEvent(eventId));
    return { retrieve };
}

beforeEach(() => {
    vi.clearAllMocks();
    dbState.deliveredReceipts.clear();
    dbState.subRows = [];
    dbState.updateCalls.length = 0;
    getMockConfirmPurchase().mockResolvedValue({ success: true, data: undefined });
});

// ---------------------------------------------------------------------------

describe('MercadoPago payment status vocabulary (HOS-757)', () => {
    describe('the adapter contract this module is written against', () => {
        // Freezes the two facts the whole fix rests on, read from the adapter
        // package rather than restated. If qzpay ever stops normalizing, or
        // starts emitting `accredited` as a status, this fails first and names
        // the reason — instead of four dispatches going quiet again.
        it('normalizes MercadoPago approved to succeeded', () => {
            expect(MERCADOPAGO_PAYMENT_STATUS.approved).toBe('succeeded');
            expect(mapMPPaymentStatus('approved')).toBe('succeeded');
        });

        it('has no `accredited` payment status in any direction', () => {
            expect(Object.keys(MERCADOPAGO_PAYMENT_STATUS)).not.toContain('accredited');
            expect(Object.values(MERCADOPAGO_PAYMENT_STATUS)).not.toContain('accredited');
            // Unknown values pass through verbatim, which is precisely why an
            // `accredited` in the allowlist could never have matched anything:
            // it is a status_detail, and a status_detail never lands in
            // `status`.
            expect(mapMPPaymentStatus('accredited')).toBe('accredited');
        });

        it('maps the failure statuses this module dispatches on', () => {
            expect(mapMPPaymentStatus('rejected')).toBe('failed');
            expect(mapMPPaymentStatus('cancelled')).toBe('canceled');
            expect(mapMPPaymentStatus('refunded')).toBe('refunded');
        });
    });

    describe('live webhook: retrieve -> handler -> extractPaymentInfo -> dispatch', () => {
        it('an approved MercadoPago charge reaches the success dispatch', async () => {
            await deliverWebhook('approved', { customerId: CUSTOMER_ID });

            // The whole point: the notification fires. Before HOS-757 the
            // predicate compared the adapter's `succeeded` against MP's raw
            // `approved` and this call count was zero on every real payment.
            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);
            expect(sendPaymentSuccessNotification).toHaveBeenCalledWith(
                CUSTOMER_ID,
                AMOUNT_MAJOR,
                'ARS',
                null,
                mockBilling,
                `payment-success:mercadopago:${MP_PAYMENT_ID}`
            );
            expect(sendPaymentFailureNotifications).not.toHaveBeenCalled();
            expect(mockMarkEventProcessed).toHaveBeenCalledTimes(1);
        });

        it('an approved MercadoPago charge captures the success analytics event', async () => {
            await deliverWebhook('approved', { customerId: CUSTOMER_ID });

            expect(mockPostHogCapture).toHaveBeenCalledTimes(1);
            expect(mockPostHogCapture).toHaveBeenCalledWith({
                distinctId: 'usr-1',
                event: 'subscription_payment_succeeded',
                properties: {
                    amount: AMOUNT_MAJOR,
                    currency: 'ARS',
                    payment_provider: 'mercadopago',
                    payment_method: null,
                    payment_kind: 'subscription_renewal',
                    source: 'webhook',
                    $set: { plan_status: 'active' }
                }
            });
        });

        it('a rejected MercadoPago charge reaches the failure dispatch', async () => {
            await deliverWebhook('rejected', { customerId: CUSTOMER_ID });

            expect(sendPaymentFailureNotifications).toHaveBeenCalledTimes(1);
            expect(sendPaymentFailureNotifications).toHaveBeenCalledWith(
                CUSTOMER_ID,
                AMOUNT_MAJOR,
                'ARS',
                'failed',
                mockBilling
            );
            expect(sendPaymentSuccessNotification).not.toHaveBeenCalled();
        });

        // The fail-closed half. `authorized` normalizes to `requires_capture`:
        // the card was authorized and NOT captured, so no money has moved and
        // nothing may be dispatched, notified or booked.
        it.each([
            'authorized',
            'in_process',
            'pending',
            'charged_back'
        ])('does not dispatch a success for a %s charge', async (rawMpStatus) => {
            await deliverWebhook(rawMpStatus, { customerId: CUSTOMER_ID });

            expect(sendPaymentSuccessNotification).not.toHaveBeenCalled();
            expect(mockPostHogCapture).not.toHaveBeenCalled();
        });

        it('activates the annual subscription an approved charge paid for', async () => {
            dbState.subRows = [
                { id: 'sub-annual-1', customerId: CUSTOMER_ID, status: 'pending_provider' }
            ];

            await deliverWebhook('approved', {
                customerId: CUSTOMER_ID,
                annualSubscriptionId: 'sub-annual-1'
            });

            expect(dbState.updateCalls).toHaveLength(1);
            expect(dbState.updateCalls[0]?.values).toMatchObject({ status: 'active' });
            expect(mockBilling.payments.record).toHaveBeenCalledTimes(1);
        });

        it('books the ledger figures for an approved add-on charge', async () => {
            await deliverWebhook('approved', {
                customerId: CUSTOMER_ID,
                addonSlug: 'visibility-boost-7d'
            });

            // Exact shape, not `objectContaining`: the defect was a MISSING
            // pair of fields, and `objectContaining` cannot see one.
            expect(getMockConfirmPurchase()).toHaveBeenCalledWith({
                customerId: CUSTOMER_ID,
                addonSlug: 'visibility-boost-7d',
                paymentId: MP_PAYMENT_ID,
                amountInCents: AMOUNT_CENTAVOS,
                currency: 'ARS'
            });
        });

        it('confirms no add-on purchase for a rejected charge', async () => {
            await deliverWebhook('rejected', {
                customerId: CUSTOMER_ID,
                addonSlug: 'visibility-boost-7d'
            });

            expect(getMockConfirmPurchase()).not.toHaveBeenCalled();
        });
    });

    // ── The double-effect this change had to avoid ──────────────────────────
    //
    // HOS-763 turned the payment-success receipt ON. One settled charge can
    // reach that dispatch more than once, from two producers that do not
    // coordinate, and NEITHER is stopped by the webhook-event idempotency
    // upstream:
    //
    //   1. Two provider notifications about the same payment. That guard dedupes
    //      on `providerEventId`, and the adapter sets the event id from the
    //      NOTIFICATION (`mapToQZPayEvent`: `id: String(mpEvent.id)`), not from
    //      the payment. Two notifications carry two ids and both get through.
    //   2. The polling cron, which writes no webhook-event row at all.
    //
    // The add-on flow has a second, narrower defence downstream (the
    // `billing_addon_purchases.paymentId` lookup). A SUBSCRIPTION charge has
    // none — which is why the subscription cases below are the ones that matter
    // most here.
    describe('exactly-once payment-success dispatch (HOS-757)', () => {
        /** The payload the polling cron builds: adapter-normalized status. */
        function pollingPayload(metadata: Record<string, unknown>) {
            return {
                id: MP_PAYMENT_ID,
                status: mapMPPaymentStatus('approved'),
                transaction_amount: AMOUNT_MAJOR,
                currency_id: 'ARS',
                metadata,
                external_reference: 'cs-uuid-1'
            };
        }

        const ADDON_META = { customerId: CUSTOMER_ID, addonSlug: 'visibility-boost-7d' };
        /** A plain subscription charge: no add-on metadata, so no second defence. */
        const SUBSCRIPTION_META = { customerId: CUSTOMER_ID };

        it('sends one receipt when the webhook lands first and the cron follows', async () => {
            await deliverWebhook('approved', ADDON_META);
            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);

            // A minute later the cron polls, finds the same settled payment and
            // re-enters with its own payload.
            await processPaymentUpdated({
                data: pollingPayload(ADDON_META),
                billing: mockBilling,
                source: 'polling'
            });

            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);
            expect(mockPostHogCapture).toHaveBeenCalledTimes(1);
        });

        it('sends one receipt when the cron lands first and the webhook follows', async () => {
            await processPaymentUpdated({
                data: pollingPayload(ADDON_META),
                billing: mockBilling,
                source: 'polling'
            });
            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);

            await deliverWebhook('approved', ADDON_META);

            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);
            expect(mockPostHogCapture).toHaveBeenCalledTimes(1);
        });

        // THE SUBSCRIPTION HOLE. Two distinct provider notifications about one
        // settled subscription charge — two `providerEventId`s, so the
        // webhook-event guard passes both — and no add-on metadata, so nothing
        // downstream would have suppressed the repeat either. Before HOS-757
        // this sent two receipts and captured two analytics events.
        it('sends one receipt for two provider notifications about one subscription charge', async () => {
            await deliverWebhook('approved', SUBSCRIPTION_META, 'mp-event-1');
            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);

            await deliverWebhook('approved', SUBSCRIPTION_META, 'mp-event-2');

            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);
            expect(mockPostHogCapture).toHaveBeenCalledTimes(1);
        });

        it('captures the succeeded analytics event exactly once for a subscription charge', async () => {
            await deliverWebhook('approved', SUBSCRIPTION_META, 'mp-event-1');
            await deliverWebhook('approved', SUBSCRIPTION_META, 'mp-event-2');

            const captures = mockPostHogCapture.mock.calls.filter(
                ([arg]) => (arg as { event?: string }).event === 'subscription_payment_succeeded'
            );
            expect(captures).toHaveLength(1);
        });

        // A DIFFERENT payment must still be notified. Without this, a guard that
        // suppressed everything after the first send would pass every case above
        // and silently stop every receipt in production.
        it('still sends for a different payment id', async () => {
            await deliverWebhook('approved', SUBSCRIPTION_META);
            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);

            dbState.deliveredReceipts.add('some-unrelated-payment');
            await processPaymentUpdated({
                data: {
                    ...pollingPayload(SUBSCRIPTION_META),
                    id: 'a-different-payment-id'
                },
                billing: mockBilling,
                source: 'polling'
            });

            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(2);
        });

        // The guard reads only DELIVERED rows. A logged `failed` row means the
        // customer never got the email, so a retry must go out — treating it as
        // "already sent" would turn a delivery failure into a permanently
        // missing receipt.
        it('still sends when the earlier attempt was not delivered', async () => {
            // Nothing in `deliveredReceipts`: the previous attempt logged
            // `failed`, which this lookup deliberately does not match.
            await deliverWebhook('approved', SUBSCRIPTION_META);

            expect(sendPaymentSuccessNotification).toHaveBeenCalledTimes(1);
        });
    });
});
