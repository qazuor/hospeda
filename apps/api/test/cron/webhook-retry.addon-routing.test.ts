/**
 * HOS-847 PR 5 — the dead-letter retry cron does not guess "plan" either.
 *
 * ## Why this file exists separately from `webhook-retry.job.test.ts`
 *
 * `webhook-retry.job.ts` carries a SECOND implementation of
 * `handleSubscriptionAuthorizedPayment`: it fetches the authorized payment,
 * resolves the local subscription from the preapproval id, and records the
 * charge itself. PR 5's first pass intercepted add-ons in the live handler and
 * left this one untouched, because the coverage argument enumerated the callers
 * of `processSubscriptionUpdated` rather than the places that handle the EVENT.
 *
 * That gap is not academic — it is the door the live handler's own failure
 * policy opens. The routing lookup there fails CLOSED: its catch marks the
 * event failed and still answers 2xx, so MercadoPago never redelivers and this
 * cron is the only retry there is. Unrouted, it resolved the add-on's own
 * `billing_subscriptions` row as if it were the customer's plan and recorded
 * the charge with a hardcoded `status: 'succeeded'`, no `flow`, no `addonSlug`
 * and no `purchaseId` — after which the payment id is burnt and a legitimate
 * later delivery hits the ledger's dedupe forever.
 *
 * So the routing and the add-on renewal are left REAL here; only the database,
 * the MercadoPago fetch and the activation service are faked. The CONTROL at
 * the end runs the identical fixture with no add-on row and asserts the plan
 * path DOES take over — without it, every assertion here would pass against a
 * cron that had stopped doing anything at all.
 *
 * @module test/cron/webhook-retry.addon-routing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const PREAPPROVAL_ID = 'preapproval-addon-cron-1';

/** `billing_addon_purchases` rows the HOS-847 routing lookup answers with. */
const addonPurchaseRows: { rows: Array<Record<string, unknown>> } = { rows: [] };
/** `billing_payments` dedupe rows. */
const dedupeRows: { rows: Array<{ id: string; status: string }> } = { rows: [] };
/** `billing_webhook_dead_letter` batch rows. */
const deadLetterRows: { rows: Array<Record<string, unknown>> } = { rows: [] };

const { mockUpdateSet, mockFindLocalSub, mockPaymentAlreadyRecorded, mockActivate } = vi.hoisted(
    () => ({
        mockUpdateSet: vi.fn(),
        mockFindLocalSub: vi.fn(),
        mockPaymentAlreadyRecorded: vi.fn(),
        mockActivate: vi.fn()
    })
);

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'test-token' }
}));

vi.mock('@sentry/node', () => ({ captureMessage: vi.fn() }));

// Partial, not a whole-module replacement: an object literal here leaves every
// other export undefined, and an export missing inside a try/catch fails
// SILENTLY — the phase does nothing while every assertion still passes
// (HOS-702). `check` guard: billing-mock-must-be-partial.
vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    asMajor: (value: number) => value,
    toMajor: (value: number) => value / 100,
    asCentavos: (value: number) => value,
    createMercadoPagoAdapter: vi.fn(),
    getAddonBySlug: vi.fn()
}));

vi.mock('../../src/middlewares/billing', () => ({ getQZPayBilling: vi.fn() }));
vi.mock('../../src/lib/qzpay-logger', () => ({ qzpayLogger: {} }));
vi.mock('../../src/lib/sentry', () => ({ captureBillingError: vi.fn() }));

vi.mock('../../src/routes/webhooks/mercadopago/dispute-logic', () => ({
    processDisputeEvent: vi.fn()
}));
vi.mock('../../src/routes/webhooks/mercadopago/payment-logic', () => ({
    processPaymentUpdated: vi.fn()
}));
vi.mock('../../src/routes/webhooks/mercadopago/subscription-logic', () => ({
    processSubscriptionUpdated: vi.fn()
}));

// The plan-side lookup, mocked so "was it consulted at all?" is observable.
vi.mock('../../src/routes/webhooks/mercadopago/subscription-payment-handler', () => ({
    findLocalSubscriptionByPreapprovalId: mockFindLocalSub,
    paymentAlreadyRecorded: mockPaymentAlreadyRecorded
}));

vi.mock('../../src/services/billing/link-preapproval.service', () => ({
    linkPreapprovalToLocalSub: vi.fn(async () => ({ outcome: 'not_found' }))
}));

vi.mock('../../src/services/billing/orphan-payment-queue.service', () => ({
    recordOrphanPayment: vi.fn(async () => ({ queued: true }))
}));

// Real: the routing module and the add-on renewal service. Faked: only the
// activation, whose own contract is covered next door.
vi.mock('../../src/services/addon-recurring-activation.service', () => ({
    activateRecurringAddonPurchase: mockActivate
}));

vi.mock('../../src/utils/mp-authorized-payment', () => ({
    fetchAuthorizedPaymentDetails: vi.fn()
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        mpSubscriptionId: 'mp_subscription_id',
        billingInterval: 'billing_interval',
        currentPeriodStart: 'current_period_start',
        currentPeriodEnd: 'current_period_end',
        purchasedAt: 'purchased_at',
        metadata: 'metadata',
        deletedAt: 'deleted_at',
        updatedAt: 'updated_at'
    }
}));

vi.mock('@repo/db', () => {
    const chainOver = (rows: unknown[]) => {
        const chain = {
            from: vi.fn(() => chain),
            where: vi.fn(() => chain),
            orderBy: vi.fn(() => chain),
            limit: vi.fn(() => Promise.resolve(rows))
        };
        return chain;
    };

    // Dispatch by PROJECTION, never by call order — the subject of this file is
    // WHICH lookup runs, so an order-indexed mock would encode the answer.
    const select = vi.fn((projection?: Record<string, unknown>) => {
        if (projection === undefined) {
            return chainOver(deadLetterRows.rows);
        }
        if ('addonSlug' in projection) {
            return chainOver(addonPurchaseRows.rows);
        }
        if ('id' in projection) {
            return chainOver(dedupeRows.rows);
        }
        return chainOver([{ status: 'pending' }]);
    });

    const db = {
        execute: vi.fn(async () => ({ rows: [{ acquired: true }] })),
        select,
        update: vi.fn(() => ({
            set: vi.fn((payload: Record<string, unknown>) => {
                mockUpdateSet(payload);
                return { where: vi.fn(async () => undefined) };
            })
        }))
    };

    return {
        getDb: vi.fn(() => db),
        withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(db)),
        billingWebhookEvents: {
            providerEventId: 'provider_event_id',
            status: 'status',
            processedAt: 'processed_at',
            error: 'error'
        },
        billingWebhookDeadLetter: {
            id: 'id',
            resolvedAt: 'resolved_at',
            attempts: 'attempts',
            createdAt: 'created_at'
        },
        billingPayments: {
            id: 'id',
            status: 'status',
            updatedAt: 'updated_at',
            providerPaymentIds: 'provider_payment_ids'
        },
        and: vi.fn((...args: unknown[]) => ({ and: args })),
        or: vi.fn((...args: unknown[]) => ({ or: args })),
        eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
        isNull: vi.fn((a: unknown) => ({ isNull: a })),
        lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
        sql: Object.assign(
            (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
            {}
        )
    };
});

import { webhookRetryJob } from '../../src/cron/jobs/webhook-retry.job';
import type { CronJobContext } from '../../src/cron/types';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { fetchAuthorizedPaymentDetails } from '../../src/utils/mp-authorized-payment';

const mockPaymentsRecord = vi.fn();

function makeContext(): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        dryRun: false
    } as unknown as CronJobContext;
}

function deadLetterEvent() {
    return {
        id: 'dl-1',
        providerEventId: 'mp-event-cron-1',
        provider: 'mercadopago',
        type: 'subscription_authorized_payment.created',
        payload: { data: { id: 'authorized-payment-1' } },
        attempts: 0,
        resolvedAt: null
    };
}

function addonPurchaseRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'purchase-1',
        customerId: 'cust-1',
        subscriptionId: 'plan-sub-1',
        addonSlug: 'extra-accommodations-5',
        status: 'active',
        mpSubscriptionId: PREAPPROVAL_ID,
        billingInterval: 'monthly',
        // In the past, so a correctly-routed charge advances the period and the
        // write is observable.
        currentPeriodEnd: new Date(Date.now() - 60_000),
        purchasedAt: new Date('2026-05-10T12:00:00.000Z'),
        metadata: {},
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    addonPurchaseRows.rows = [];
    dedupeRows.rows = [];
    deadLetterRows.rows = [deadLetterEvent()];
    mockPaymentsRecord.mockResolvedValue({ id: 'billing-payment-1' });
    mockFindLocalSub.mockResolvedValue(null);
    mockPaymentAlreadyRecorded.mockResolvedValue(false);
    mockActivate.mockResolvedValue({ activated: false, reason: 'already-settled' });
    vi.mocked(getQZPayBilling).mockReturnValue({
        payments: { record: mockPaymentsRecord }
    } as unknown as ReturnType<typeof getQZPayBilling>);
    vi.mocked(fetchAuthorizedPaymentDetails).mockResolvedValue({
        kind: 'ok',
        details: {
            authorizedPaymentId: 'authorized-payment-1',
            preapprovalId: PREAPPROVAL_ID,
            transactionAmount: 5000,
            currencyId: 'ARS',
            paymentId: 'mp-pay-cron-1',
            status: 'processed',
            paymentStatus: 'approved',
            debitDate: null,
            couponAmount: null,
            campaignId: null
        }
    } as unknown as Awaited<ReturnType<typeof fetchAuthorizedPaymentDetails>>);
});

describe('the dead-letter retry cron routes an add-on charge away from the plan path', () => {
    it('never consults the plan-subscription lookup', async () => {
        // Arrange
        addonPurchaseRows.rows = [addonPurchaseRow()];

        // Act
        const result = await webhookRetryJob.handler(makeContext());

        // Assert: this is the whole finding. Unrouted, the cron resolved the
        // add-on's OWN billing_subscriptions row here and treated it as a plan.
        expect(mockFindLocalSub).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
    });

    it('books the charge as an add-on renewal, not as a plan charge', async () => {
        // Arrange
        addonPurchaseRows.rows = [addonPurchaseRow()];

        // Act
        await webhookRetryJob.handler(makeContext());

        // Assert: the cron's own plan-side write hardcodes `status: 'succeeded'`
        // and carries no flow, no addonSlug and no purchaseId. Asserting those
        // fields ARE present is what tells the two writers apart.
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(mockPaymentsRecord.mock.calls[0]?.[0]).toMatchObject({
            customerId: 'cust-1',
            subscriptionId: 'plan-sub-1',
            providerPaymentId: 'mp-pay-cron-1',
            metadata: {
                flow: 'addon-recurring',
                addonSlug: 'extra-accommodations-5',
                purchaseId: 'purchase-1'
            }
        });
    });

    it('advances the add-on billing period', async () => {
        // Arrange
        addonPurchaseRows.rows = [addonPurchaseRow()];

        // Act
        await webhookRetryJob.handler(makeContext());

        // Assert
        const periodWrite = mockUpdateSet.mock.calls
            .map((call) => call[0] as Record<string, unknown>)
            .find((payload) => 'currentPeriodEnd' in payload);
        expect(periodWrite).toBeDefined();
    });
});

describe('CONTROL: the identical fixture with no add-on row runs the plan path', () => {
    it('consults the plan-subscription lookup and books nothing as an add-on', async () => {
        // Arrange: same dead-letter event, same charge, same everything — the
        // ONLY difference is that no billing_addon_purchases row claims this
        // preapproval.
        addonPurchaseRows.rows = [];
        mockFindLocalSub.mockResolvedValue({
            id: 'plan-sub-1',
            customerId: 'cust-1',
            planId: 'plan-1',
            status: 'active',
            trialEnd: null,
            billingInterval: 'month'
        });

        // Act
        const result = await webhookRetryJob.handler(makeContext());

        // Assert
        expect(mockFindLocalSub).toHaveBeenCalledWith(PREAPPROVAL_ID);
        expect(mockPaymentsRecord).toHaveBeenCalledTimes(1);
        expect(mockPaymentsRecord.mock.calls[0]?.[0]?.metadata).not.toHaveProperty('flow');
        expect(result.success).toBe(true);
    });
});
