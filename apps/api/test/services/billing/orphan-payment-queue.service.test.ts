/**
 * Tests for the orphan payment queue (HOS-714).
 *
 * The queue is the policy for a payment MercadoPago confirmed and Hospeda
 * could not apply. Two things must hold and are asserted here:
 *
 *  1. The payment is PERSISTED — with its reason, its amount in centavos, and
 *     enough context for a human to resolve it.
 *  2. The event is ALERTED as an incident (`error` + `capture: true`), never
 *     as the routine `warn` it used to be.
 *
 * The `@repo/db` mock in this file is LOCAL (it overrides the global stub in
 * `test/setup.ts`, which has no `insert`). Assertions target what THIS code
 * hands to the insert — the values object and the conflict target — not
 * Drizzle's own SQL behaviour, which the stub cannot model.
 *
 * @module test/services/billing/orphan-payment-queue.service
 */
import { asMajor } from '@repo/billing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoggerError, mockLoggerInfo, dbState, envState } = vi.hoisted(() => ({
    mockLoggerError: vi.fn(),
    mockLoggerInfo: vi.fn(),
    /** Mutable stand-in for `env.HOSPEDA_MERCADO_PAGO_SANDBOX`. */
    envState: { sandbox: true },
    dbState: {
        /** Rows the `.returning()` call resolves with. Empty = ON CONFLICT hit. */
        returningRows: [] as Array<{ id: string }>,
        /** When set, the insert chain throws it. */
        throwOnInsert: null as Error | null,
        /** Captured `insert()` / `values()` / `onConflictDoNothing()` arguments. */
        calls: [] as Array<{
            table: unknown;
            values: Record<string, unknown>;
            conflict: unknown;
        }>
    }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        get HOSPEDA_MERCADO_PAGO_SANDBOX() {
            return envState.sandbox;
        }
    }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        error: mockLoggerError,
        info: mockLoggerInfo,
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@repo/db', () => ({
    billingOrphanPayments: {
        id: 'ID',
        provider: 'PROVIDER',
        providerPaymentId: 'PROVIDER_PAYMENT_ID'
    },
    getDb: () => ({
        insert: (table: unknown) => ({
            values: (values: Record<string, unknown>) => ({
                onConflictDoNothing: (conflict: unknown) => ({
                    returning: async () => {
                        dbState.calls.push({ table, values, conflict });
                        if (dbState.throwOnInsert) throw dbState.throwOnInsert;
                        return dbState.returningRows;
                    }
                })
            })
        })
    })
}));

import {
    buildOrphanPaymentRow,
    recordOrphanPayment
} from '../../../src/services/billing/orphan-payment-queue.service';

const BASE_INPUT = {
    providerPaymentId: 'mp-payment-42',
    flow: 'plan-change-upgrade' as const,
    reason: 'subscription-status-not-applicable' as const,
    amountMajor: asMajor(123.45),
    currency: 'ARS',
    subscriptionId: 'sub-1',
    customerId: 'cust-1',
    observedStatus: 'past_due',
    source: 'webhook'
};

beforeEach(() => {
    vi.clearAllMocks();
    dbState.returningRows = [{ id: 'orphan-row-1' }];
    dbState.throwOnInsert = null;
    dbState.calls.length = 0;
    envState.sandbox = true;
});

describe('buildOrphanPaymentRow', () => {
    it('converts the major-unit amount to integer centavos', () => {
        // Arrange / Act
        const row = buildOrphanPaymentRow({ ...BASE_INPUT, amountMajor: asMajor(123.45) });

        // Assert
        expect(row.amount).toBe(12_345);
        expect(Number.isInteger(row.amount)).toBe(true);
    });

    it('rounds a float amount rather than truncating it', () => {
        expect(buildOrphanPaymentRow({ ...BASE_INPUT, amountMajor: asMajor(0.005) }).amount).toBe(
            1
        );
        expect(buildOrphanPaymentRow({ ...BASE_INPUT, amountMajor: asMajor(19.999) }).amount).toBe(
            2000
        );
    });

    it('defaults the provider to mercadopago and the status to unresolved', () => {
        const row = buildOrphanPaymentRow(BASE_INPUT);

        expect(row.provider).toBe('mercadopago');
        expect(row.status).toBe('unresolved');
    });

    it('normalises absent optional context to null / empty metadata', () => {
        const row = buildOrphanPaymentRow({
            providerPaymentId: 'mp-1',
            flow: 'annual-upfront',
            reason: 'subscription-not-found',
            amountMajor: asMajor(10),
            currency: 'ARS',
            source: 'webhook'
        });

        expect(row.subscriptionId).toBeNull();
        expect(row.customerId).toBeNull();
        expect(row.observedStatus).toBeNull();
        expect(row.metadata).toEqual({});
    });

    it('derives livemode=false from a SANDBOX environment', () => {
        // Arrange
        envState.sandbox = true;

        // Act / Assert — HOS-708 / HOS-719: a sandbox charge must never be
        // stored as production money. This is what lets whoever triages the
        // queue tell a staging test from a real stranded payment.
        expect(buildOrphanPaymentRow(BASE_INPUT).livemode).toBe(false);
    });

    it('derives livemode=true from a NON-sandbox environment', () => {
        // Arrange
        envState.sandbox = false;

        // Act / Assert — the other half of the derivation. Asserting only the
        // sandbox case would stay green against a hard-coded `false`.
        expect(buildOrphanPaymentRow(BASE_INPUT).livemode).toBe(true);
    });

    it('carries flow, reason and the observed status through verbatim', () => {
        const row = buildOrphanPaymentRow(BASE_INPUT);

        expect(row.flow).toBe('plan-change-upgrade');
        expect(row.reason).toBe('subscription-status-not-applicable');
        expect(row.observedStatus).toBe('past_due');
        expect(row.currency).toBe('ARS');
        expect(row.source).toBe('webhook');
    });
});

describe('recordOrphanPayment', () => {
    it('persists the row and reports it as newly queued', async () => {
        // Act
        const result = await recordOrphanPayment(BASE_INPUT);

        // Assert
        expect(result).toEqual({ queued: true, alreadyQueued: false, failed: false });
        expect(dbState.calls).toHaveLength(1);
        expect(dbState.calls[0]?.values).toMatchObject({
            providerPaymentId: 'mp-payment-42',
            flow: 'plan-change-upgrade',
            reason: 'subscription-status-not-applicable',
            amount: 12_345,
            currency: 'ARS',
            observedStatus: 'past_due',
            status: 'unresolved',
            livemode: false
        });
    });

    it('writes the environment-derived livemode through to the insert', async () => {
        // Arrange
        envState.sandbox = false;

        // Act
        await recordOrphanPayment(BASE_INPUT);

        // Assert — the derivation must survive the whole path, not just the
        // builder: a row that reaches the table mislabelled is the failure mode.
        expect(dbState.calls[0]?.values).toMatchObject({ livemode: true });
    });

    it('deduplicates on (provider, providerPaymentId) so MP redeliveries cannot double-queue', async () => {
        await recordOrphanPayment(BASE_INPUT);

        expect(dbState.calls[0]?.conflict).toEqual({
            target: ['PROVIDER', 'PROVIDER_PAYMENT_ID']
        });
    });

    it('alerts the discard as an incident: error level WITH capture, never warn', async () => {
        // Act
        await recordOrphanPayment(BASE_INPUT);

        // Assert — HOS-714 point 3. A charged payment that cannot be applied is
        // an incident, so it must reach Sentry via `{ capture: true }` on an
        // `error` entry (the logger only forwards ERROR + capture).
        expect(mockLoggerError).toHaveBeenCalledTimes(1);
        const [payload, message, options] = mockLoggerError.mock.calls[0] as [
            Record<string, unknown>,
            string,
            Record<string, unknown>
        ];
        expect(options).toEqual({ capture: true });
        expect(message).toContain('could not be applied');
        expect(payload).toMatchObject({
            providerPaymentId: 'mp-payment-42',
            reason: 'subscription-status-not-applicable',
            amount: 12_345,
            observedStatus: 'past_due'
        });
    });

    it('does not re-alert when the payment is already on the queue', async () => {
        // Arrange — ON CONFLICT DO NOTHING returns no row.
        dbState.returningRows = [];

        // Act
        const result = await recordOrphanPayment(BASE_INPUT);

        // Assert
        expect(result).toEqual({ queued: false, alreadyQueued: true, failed: false });
        expect(mockLoggerError).not.toHaveBeenCalled();
        expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    });

    it('never throws when the queue write fails, and keeps the payload in the log', async () => {
        // Arrange
        dbState.throwOnInsert = new Error('relation does not exist');

        // Act
        const result = await recordOrphanPayment(BASE_INPUT);

        // Assert — the last line of defence: the caller's webhook disposition
        // must not change because bookkeeping broke, but the payment has to
        // survive somewhere a human can find it.
        expect(result).toEqual({ queued: false, alreadyQueued: false, failed: true });
        expect(mockLoggerError).toHaveBeenCalledTimes(1);
        const [payload, , options] = mockLoggerError.mock.calls[0] as [
            Record<string, unknown>,
            string,
            Record<string, unknown>
        ];
        expect(options).toEqual({ capture: true });
        expect(payload).toMatchObject({
            providerPaymentId: 'mp-payment-42',
            amount: 12_345,
            error: 'relation does not exist'
        });
    });
});
