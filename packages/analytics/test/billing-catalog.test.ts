import { describe, expect, it } from 'vitest';
import { AnalyticsEventSchemas, AnalyticsEvents } from '../src/catalog.js';
import { prepareAnalyticsEvent } from '../src/shared.js';

const examples: Record<string, Record<string, unknown>> = {
    billing_checkout_started: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'USER',
        subscription_id: 's1',
        plan_version_id: 'p1',
        billing_option_id: 'b1',
        cycle: 'monthly',
        amount_minor: 0,
        currency: 'ARS'
    },
    billing_checkout_abandoned: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's1',
        reason: 'WINDOW_EXPIRED'
    },
    billing_subscription_activated: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's1',
        plan_version_id: 'p1',
        billing_option_id: 'b1',
        cycle: 'annual',
        amount_minor: 10,
        currency: 'ARS'
    },
    billing_plan_changed: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's2',
        from_plan_version_id: 'p1',
        to_plan_version_id: 'p2',
        from_cycle: 'monthly',
        to_cycle: 'annual',
        direction: 'UPGRADE'
    },
    billing_charge_succeeded: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's1',
        payment_id: 'p1',
        amount_minor: 1,
        currency: 'ARS',
        is_first_charge: true,
        cycle: 'monthly'
    },
    billing_charge_declined: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's1',
        payment_id: 'p1',
        amount_minor: 1,
        currency: 'ARS',
        is_first_charge: false,
        next_state: 'UNCHANGED'
    },
    billing_grace_entered: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's1',
        grace_ends_at: '2026-01-01T00:00:00.000Z'
    },
    billing_subscription_suspended: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's1',
        trigger: 'GRACE_EXPIRED'
    },
    billing_subscription_recovered: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's1',
        recovered_from: 'SUSPENDED',
        payment_id: 'p1'
    },
    billing_cancel_scheduled: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'USER',
        subscription_id: 's1',
        service_ends_at: '2026-01-01T00:00:00.000Z',
        basis: 'PAID_PERIOD'
    },
    billing_subscription_cancelled: {
        vertical: 'accommodation',
        subscription_class: 'PRINCIPAL',
        actor_kind: 'SYSTEM',
        subscription_id: 's1',
        cancelled_by: 'SYSTEM',
        path: 'SERVICE_END',
        was_scheduled: true
    },
    trial_started: {
        vertical: 'accommodation',
        actor_kind: 'SYSTEM',
        activation_event: 'listing_published'
    },
    trial_converted: {
        vertical: 'accommodation',
        actor_kind: 'SYSTEM',
        transition: 'T2',
        trial_state_before: 'ACTIVE'
    },
    trial_expired: { vertical: 'accommodation', actor_kind: 'SYSTEM', trial_days: 14 }
};

describe('billing analytics event schemas (TEST:1878:16)', () => {
    it('keeps retired event names out of the active catalog (TEST:1878:18)', () => {
        const retired = [
            'subscription_checkout_started',
            'subscription_created',
            'subscription_payment_succeeded',
            'subscription_payment_failed',
            'trial_converted_to_paid'
        ];
        expect(Object.values(AnalyticsEvents).filter((event) => retired.includes(event))).toEqual(
            []
        );
    });
    it('parses the complete required example for every new event', () => {
        for (const [name, properties] of Object.entries(examples)) {
            expect(
                prepareAnalyticsEvent({
                    name: name as keyof typeof AnalyticsEventSchemas,
                    properties
                } as never)
            ).toEqual(properties);
        }
    });
    it('rejects invalid closed enum values and forbidden property keys', () => {
        expect(
            AnalyticsEventSchemas.billing_checkout_started.safeParse({
                ...examples.billing_checkout_started,
                vertical: 'unknown'
            }).success
        ).toBe(false);
        expect(() =>
            prepareAnalyticsEvent({
                name: 'billing_checkout_started',
                properties: { ...examples.billing_checkout_started, email: 'a@b.c' }
            } as never)
        ).toThrow(/Forbidden analytics property key/);
        for (const schema of Object.entries(AnalyticsEventSchemas)
            .filter(([name]) => name.startsWith('billing_') || name.startsWith('trial_'))
            .map(([, schema]) => schema)) {
            for (const key of Object.keys(schema.shape))
                expect(
                    /(^|_)(email|phone|tel|message|password|token|secret|address|full_name|guest_name|guest_email|guest_phone|card)(_|$)/i.test(
                        key
                    )
                ).toBe(false);
        }
    });
});
