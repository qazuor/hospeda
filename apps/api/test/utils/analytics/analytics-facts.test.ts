import { AnalyticsEventSchemas } from '@repo/analytics';
import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsFactSink } from '../../../src/utils/analytics/analytics-facts.js';

const loggerWarn = vi.hoisted(() => vi.fn());
vi.mock('@repo/logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/logger')>();
    return {
        ...actual,
        createLogger: () => ({ debug: vi.fn(), warn: loggerWarn, error: vi.fn() })
    };
});

describe('analytics facts (TEST:1878:15, TEST:1878:16)', () => {
    it('does not propagate a failed capture', () => {
        const capture = vi.fn(() => {
            throw new Error('offline');
        });
        const sink = createAnalyticsFactSink({ capture });
        expect(() =>
            sink.emit({
                kind: 'TRIAL_STARTED',
                userId: 'u-1',
                vertical: 'accommodation',
                trialId: 't-1',
                activationEvent: 'listing_published',
                occurredAt: new Date('2026-01-01T00:00:00.000Z')
            })
        ).not.toThrow();
        expect(capture).toHaveBeenCalledTimes(1);
        expect(loggerWarn).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'TRIAL_STARTED' }),
            'Analytics fact capture failed (non-blocking)'
        );
    });
    it('maps a trial fact to an idempotent event with its timestamp', () => {
        const capture = vi.fn();
        const occurredAt = new Date('2026-01-01T00:00:00.000Z');
        const sink = createAnalyticsFactSink({ capture });
        sink.emit({
            kind: 'TRIAL_STARTED',
            userId: 'u-1',
            vertical: 'accommodation',
            trialId: 't-1',
            activationEvent: 'listing_published',
            occurredAt
        });
        const captured = capture.mock.calls[0]?.[0];
        expect(captured?.distinctId).toBe('u-1');
        expect(captured?.name).toBe('trial_started');
        expect(captured?.timestamp).toBe(occurredAt);
        expect(captured?.uuid).toMatch(/^[0-9a-f-]{36}$/);
        expect(captured?.properties).toEqual({
            vertical: 'accommodation',
            actor_kind: 'SYSTEM',
            activation_event: 'listing_published',
            trial_days: undefined
        });
        expect(AnalyticsEventSchemas.trial_started.parse(captured?.properties)).toEqual(
            captured?.properties
        );
    });

    it('maps each fact kind to properties accepted by its catalog schema (TEST:1878:16)', () => {
        const occurredAt = new Date('2026-01-01T00:00:00.000Z');
        const common = {
            userId: 'u-1',
            vertical: 'accommodation' as const,
            subscriptionId: 's-1',
            subscriptionClass: 'PRINCIPAL' as const,
            actorKind: 'SYSTEM' as const,
            occurredAt
        };
        const billingFacts = [
            {
                ...common,
                kind: 'CHECKOUT_ABANDONED' as const,
                reason: 'WINDOW_EXPIRED' as const,
                secondsInPending: 3
            },
            {
                ...common,
                kind: 'SUBSCRIPTION_ACTIVATED' as const,
                planVersionId: 'pv-1',
                billingOptionId: 'bo-1',
                cycle: 'monthly' as const,
                amountMinor: 100,
                currency: 'ARS' as const,
                trialActiveAtActivation: true
            },
            {
                ...common,
                kind: 'CHARGE_CREDITED' as const,
                paymentId: 'pay-1',
                amountMinor: 100,
                currency: 'ARS' as const,
                isFirstCharge: true,
                cycle: 'monthly' as const,
                planVersionId: 'pv-1',
                promoApplied: false
            },
            {
                ...common,
                kind: 'CHARGE_REJECTED' as const,
                paymentId: 'pay-1',
                amountMinor: 100,
                currency: 'ARS' as const,
                isFirstCharge: false,
                nextState: 'UNCHANGED' as const,
                hasRetryWindow: true
            },
            {
                ...common,
                kind: 'GRACE_STARTED' as const,
                graceEndsAt: occurredAt,
                graceStartedAt: occurredAt,
                daysOfGrace: 7
            },
            {
                ...common,
                kind: 'SUSPENDED_FOR_ARREARS' as const,
                trigger: 'GRACE_EXPIRED' as const,
                daysInGrace: 7,
                occurrenceId: 'occ-1'
            },
            {
                ...common,
                kind: 'RECOVERED' as const,
                recoveredFrom: 'SUSPENDED' as const,
                paymentId: 'pay-1',
                daysInState: 2
            },
            {
                ...common,
                kind: 'CANCEL_SCHEDULED' as const,
                serviceEndsAt: occurredAt,
                basis: 'PAID_PERIOD' as const,
                reason: 'OTHER' as const
            },
            {
                ...common,
                kind: 'SUBSCRIPTION_CANCELLED' as const,
                cancelledBy: 'SYSTEM' as const,
                path: 'SERVICE_END' as const,
                wasScheduled: true,
                lifetimeDays: 10,
                reason: 'OTHER' as const
            }
        ];
        const trialFacts = [
            {
                kind: 'TRIAL_STARTED' as const,
                userId: 'u-1',
                vertical: 'accommodation',
                trialId: 't-1',
                activationEvent: 'listing_published' as const,
                trialDays: 14,
                occurredAt
            },
            {
                kind: 'TRIAL_CONVERTED' as const,
                userId: 'u-1',
                vertical: 'accommodation',
                trialId: 't-1',
                transition: 'T2' as const,
                trialStateBefore: 'ACTIVE' as const,
                daysIntoTrial: 3,
                occurredAt
            },
            {
                kind: 'TRIAL_EXPIRED' as const,
                userId: 'u-1',
                vertical: 'accommodation',
                trialId: 't-1',
                trialDays: 14,
                hadPaidIntent: false,
                occurredAt
            }
        ];
        const capture = vi.fn();
        const sink = createAnalyticsFactSink({ capture });
        for (const fact of [...billingFacts, ...trialFacts]) sink.emit(fact);
        expect(capture).toHaveBeenCalledTimes(12);
        for (const [distinctId, name, properties] of capture.mock.calls.map(
            ([call]) => [call.distinctId, call.name, call.properties] as const
        )) {
            expect(distinctId).toBe('u-1');
            expect(AnalyticsEventSchemas[name].parse(properties)).toEqual(properties);
        }
    });
});
