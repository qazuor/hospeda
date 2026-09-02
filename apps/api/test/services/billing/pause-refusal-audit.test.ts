/**
 * Unit tests for the pause-refusal audit seat (HOS-995).
 *
 * The seat exists because every flow that pauses a MercadoPago preapproval is
 * fail-closed: when the provider refuses, nothing is written to the
 * subscription, so a refusal leaves no trace at all beyond a log line. HOS-995
 * retired the guard that blocked pausing ANNUAL subscriptions (its premise died
 * with HOS-171's card-first unification), and whether MercadoPago's pause
 * endpoint behaves the same on a twelve-month preapproval is a manual sandbox
 * observation no test can make. This row is the standing tripwire until it is.
 *
 * Two things are asserted, and both are load-bearing:
 *
 * 1. The row carries `billingInterval` and the provider's message — without the
 *    interval the seat cannot answer the one question it was created for.
 * 2. A failure to WRITE the seat never escapes. Every caller is already on a
 *    failure path; if this threw, the audit would replace MercadoPago's error
 *    with a database one and the caller would report the wrong cause.
 *
 * @module test/services/billing/pause-refusal-audit
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { insertValues, insertSpy } = vi.hoisted(() => ({
    insertValues: vi.fn().mockResolvedValue(undefined),
    insertSpy: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        insert: insertSpy.mockReturnValue({ values: insertValues })
    }),
    billingSubscriptionEvents: { _: 'billingSubscriptionEvents' }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { recordPauseProviderRefusal } from '../../../src/services/billing/pause-refusal-audit';
import { apiLogger } from '../../../src/utils/logger';

beforeEach(() => {
    vi.clearAllMocks();
    insertSpy.mockReturnValue({ values: insertValues });
    insertValues.mockResolvedValue(undefined);
});

describe('recordPauseProviderRefusal', () => {
    it('writes an operational event carrying the interval and the provider message', async () => {
        // Act
        const written = await recordPauseProviderRefusal({
            subscriptionId: 'sub-annual-1',
            triggerSource: 'host-pause',
            billingInterval: 'annual',
            error: new Error('MP: preapproval cannot be paused')
        });

        // Assert
        expect(written).toBe(true);
        expect(insertValues).toHaveBeenCalledTimes(1);
        const row = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(row).toMatchObject({
            subscriptionId: 'sub-annual-1',
            eventType: BILLING_EVENT_TYPES.SUBSCRIPTION_PAUSE_PROVIDER_REFUSED,
            triggerSource: 'host-pause'
        });
        // The interval is the whole point of the seat — see the module docblock.
        expect(row.metadata).toEqual({
            billingInterval: 'annual',
            providerMessage: 'MP: preapproval cannot be paused'
        });
    });

    it('records no status transition, because nothing transitioned', async () => {
        // A refused pause leaves the subscription exactly where it was. Writing
        // a `newStatus` here would make the audit trail claim a pause happened.
        await recordPauseProviderRefusal({
            subscriptionId: 'sub-1',
            triggerSource: 'admin-courtesy-grant',
            billingInterval: 'monthly',
            error: new Error('nope')
        });

        const row = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(row.newStatus).toBeUndefined();
        expect(row.previousStatus).toBeUndefined();
    });

    it('stringifies a non-Error rejection instead of dropping it', async () => {
        await recordPauseProviderRefusal({
            subscriptionId: 'sub-1',
            triggerSource: 'host-pause',
            billingInterval: null,
            error: 'plain string rejection'
        });

        const row = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(row.metadata).toEqual({
            billingInterval: null,
            providerMessage: 'plain string rejection'
        });
    });

    it('swallows its own write failure and reports it, rather than throwing', async () => {
        // Arrange — the audit insert itself fails.
        insertValues.mockRejectedValue(new Error('events table unavailable'));

        // Act — must NOT reject: the caller is mid-way through handling
        // MercadoPago's refusal and has to surface THAT, not this.
        const written = await recordPauseProviderRefusal({
            subscriptionId: 'sub-1',
            triggerSource: 'host-pause',
            billingInterval: 'annual',
            error: new Error('MP: preapproval cannot be paused')
        });

        // Assert
        expect(written).toBe(false);
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        const [logContext] = vi.mocked(apiLogger.error).mock.calls[0] ?? [];
        // The log line is the last resort, so it must still carry everything the
        // row would have: losing the provider message here loses it entirely.
        expect(logContext).toMatchObject({
            subscriptionId: 'sub-1',
            billingInterval: 'annual',
            providerMessage: 'MP: preapproval cannot be paused',
            auditError: 'events table unavailable'
        });
    });
});
