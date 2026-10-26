import { AnalyticsEventSchemas } from '@repo/analytics';
import { VerticalEnum } from '@repo/schemas';
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
        const failure = new Error('offline');
        const capture = vi.fn(() => {
            throw failure;
        });
        const sink = createAnalyticsFactSink({ capture });
        expect(() =>
            sink.emit({
                kind: 'TRIAL_STARTED',
                userId: 'u-1',
                vertical: 'accommodation',
                actorKind: 'USER',
                trialId: 't-1',
                activationEvent: 'listing_published',
                occurredAt: new Date('2026-01-01T00:00:00.000Z')
            })
        ).not.toThrow();
        expect(capture).toHaveBeenCalledTimes(1);
        expect(loggerWarn).toHaveBeenCalledWith(
            { kind: 'TRIAL_STARTED', error: failure },
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
            actorKind: 'USER',
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
            actor_kind: 'USER',
            activation_event: 'listing_published',
            trial_days: undefined
        });
        expect(AnalyticsEventSchemas.trial_started.parse(captured?.properties)).toEqual(
            captured?.properties
        );
    });

    it('maps S2 with a predecessor to activation plus an exact plan change (TEST:1878:5)', () => {
        const capture = vi.fn();
        const occurredAt = new Date('2026-01-01T00:00:00.000Z');
        createAnalyticsFactSink({ capture }).emit({
            kind: 'SUBSCRIPTION_ACTIVATED',
            userId: 'u-1',
            vertical: VerticalEnum.ACCOMMODATION,
            subscriptionId: 's-next',
            subscriptionClass: 'PRINCIPAL',
            actorKind: 'SYSTEM',
            planVersionId: 'pv-next',
            billingOptionId: 'bo-next',
            cycle: 'annual',
            amountMinor: 900,
            currency: 'ARS',
            occurredAt,
            predecessor: {
                planVersionId: 'pv-prev',
                cycle: 'monthly',
                amountMinor: 100,
                direction: 'UPGRADE'
            }
        });
        expect(capture.mock.calls.map(([event]) => event)).toEqual([
            {
                distinctId: 'u-1',
                name: 'billing_subscription_activated',
                properties: {
                    vertical: VerticalEnum.ACCOMMODATION,
                    subscription_class: 'PRINCIPAL',
                    actor_kind: 'SYSTEM',
                    subscription_id: 's-next',
                    plan_version_id: 'pv-next',
                    billing_option_id: 'bo-next',
                    cycle: 'annual',
                    amount_minor: 900,
                    currency: 'ARS',
                    trial_active_at_activation: undefined
                },
                uuid: expect.any(String),
                timestamp: occurredAt
            },
            {
                distinctId: 'u-1',
                name: 'billing_plan_changed',
                properties: {
                    vertical: VerticalEnum.ACCOMMODATION,
                    subscription_class: 'PRINCIPAL',
                    actor_kind: 'SYSTEM',
                    subscription_id: 's-next',
                    from_plan_version_id: 'pv-prev',
                    to_plan_version_id: 'pv-next',
                    from_cycle: 'monthly',
                    to_cycle: 'annual',
                    direction: 'UPGRADE',
                    from_amount_minor: 100,
                    to_amount_minor: 900
                },
                uuid: expect.any(String),
                timestamp: occurredAt
            }
        ]);
    });

    it('maps each fact kind to properties accepted by its catalog schema (TEST:1878:16)', () => {
        const occurredAt = new Date('2026-01-01T00:00:00.000Z');
        const common = {
            userId: 'u-1',
            vertical: VerticalEnum.ACCOMMODATION,
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
                actorKind: 'USER' as const,
                trialId: 't-1',
                activationEvent: 'listing_published' as const,
                trialDays: 14,
                occurredAt
            },
            {
                kind: 'TRIAL_CONVERTED' as const,
                userId: 'u-1',
                vertical: 'accommodation',
                actorKind: 'USER' as const,
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
                actorKind: 'SYSTEM' as const,
                trialId: 't-1',
                trialDays: 14,
                hadPaidIntent: false,
                occurredAt
            }
        ];
        const capture = vi.fn(
            (input: {
                distinctId: string;
                name: keyof typeof AnalyticsEventSchemas;
                properties: Record<string, unknown>;
                uuid: string;
                timestamp: Date;
            }) => void input
        );
        const sink = createAnalyticsFactSink({ capture });
        for (const fact of [...billingFacts, ...trialFacts]) sink.emit(fact);
        expect(capture).toHaveBeenCalledTimes(12);
        const commonProperties = {
            vertical: 'accommodation',
            subscription_class: 'PRINCIPAL',
            actor_kind: 'SYSTEM',
            subscription_id: 's-1'
        };
        const expectedByEvent: Record<string, Record<string, unknown>> = {
            billing_checkout_abandoned: {
                ...commonProperties,
                reason: 'WINDOW_EXPIRED',
                seconds_in_pending: 3
            },
            billing_subscription_activated: {
                ...commonProperties,
                plan_version_id: 'pv-1',
                billing_option_id: 'bo-1',
                cycle: 'monthly',
                amount_minor: 100,
                currency: 'ARS',
                trial_active_at_activation: true
            },
            billing_charge_succeeded: {
                ...commonProperties,
                payment_id: 'pay-1',
                amount_minor: 100,
                currency: 'ARS',
                is_first_charge: true,
                cycle: 'monthly',
                plan_version_id: 'pv-1',
                promo_applied: false
            },
            billing_charge_declined: {
                ...commonProperties,
                payment_id: 'pay-1',
                amount_minor: 100,
                currency: 'ARS',
                is_first_charge: false,
                next_state: 'UNCHANGED',
                has_retry_window: true
            },
            billing_grace_entered: {
                ...commonProperties,
                grace_ends_at: occurredAt.toISOString(),
                days_of_grace: 7
            },
            billing_subscription_suspended: {
                ...commonProperties,
                trigger: 'GRACE_EXPIRED',
                days_in_grace: 7
            },
            billing_subscription_recovered: {
                ...commonProperties,
                recovered_from: 'SUSPENDED',
                payment_id: 'pay-1',
                days_in_state: 2
            },
            billing_cancel_scheduled: {
                ...commonProperties,
                service_ends_at: occurredAt.toISOString(),
                basis: 'PAID_PERIOD',
                reason: 'OTHER'
            },
            billing_subscription_cancelled: {
                ...commonProperties,
                cancelled_by: 'SYSTEM',
                path: 'SERVICE_END',
                was_scheduled: true,
                lifetime_days: 10,
                reason: 'OTHER'
            },
            trial_started: {
                vertical: 'accommodation',
                actor_kind: 'USER',
                activation_event: 'listing_published',
                trial_days: 14
            },
            trial_converted: {
                vertical: 'accommodation',
                actor_kind: 'USER',
                transition: 'T2',
                trial_state_before: 'ACTIVE',
                days_into_trial: 3,
                days_since_expiry: undefined
            },
            trial_expired: {
                vertical: 'accommodation',
                actor_kind: 'SYSTEM',
                trial_days: 14,
                had_paid_intent: false
            }
        };
        for (const [distinctId, name, properties] of capture.mock.calls.map(
            ([call]) => [call.distinctId, call.name, call.properties] as const
        )) {
            expect(distinctId).toBe('u-1');
            expect(properties).toEqual(expectedByEvent[name]);
            expect(AnalyticsEventSchemas[name].parse(properties)).toEqual(properties);
        }
    });
});
