/**
 * HOS-1883 AC-14, AC-23: the `addon_*` schemas parse a complete example, are closed on their
 * enums, bounded below Umami's numeric ceiling, never `.strict()` (an additive key such as
 * HOS-2355's `reason` must not break a consumer), and carry no PII key.
 */
import { describe, expect, it } from 'vitest';
import { AnalyticsEventSchemas, AnalyticsEvents } from '../src/catalog.js';
import { prepareAnalyticsEvent } from '../src/shared.js';

const common = {
    addon_instance_id: 'i1',
    addon_id: 'a1',
    addon_version_id: 'v1',
    addon_product_id: 'p1',
    charge_kind: 'PERIODICO',
    scope_type: 'LISTING',
    actor_kind: 'SYSTEM'
} as const;

const examples = {
    addon_checkout_started: {
        ...common,
        actor_kind: 'USER',
        vertical: 'accommodation',
        subscription_id: 's1',
        amount_minor: 150000,
        currency: 'ARS',
        cycle: 'monthly'
    },
    addon_checkout_abandoned: { ...common, reason: 'WINDOW_EXPIRED', seconds_in_pending: 10 },
    addon_activated: { ...common, amount_minor: 150000, currency: 'ARS' },
    addon_charge_succeeded: { ...common, payment_id: 'pay1', amount_minor: 1, currency: 'ARS' },
    addon_charge_declined: {
        ...common,
        payment_id: 'pay2',
        amount_minor: 1,
        currency: 'ARS',
        is_first_charge: true
    },
    addon_cancelled: { ...common, path: 'GRANT_REVOKED', was_scheduled: false },
    addon_granted_free: { ...common, actor_kind: 'ADMIN', source: 'FREE_CHOICE' }
} as const;

describe('addon analytics event schemas (HOS-1883 AC-14, AC-23)', () => {
    it('registers the seven addon_* events in the catalog', () => {
        expect(
            Object.values(AnalyticsEvents)
                .filter((name) => name.startsWith('addon_'))
                .sort()
        ).toEqual(Object.keys(examples).sort());
    });

    it('parses the example of every addon_* event unchanged', () => {
        for (const [name, properties] of Object.entries(examples))
            expect(
                prepareAnalyticsEvent({
                    name: name as keyof typeof AnalyticsEventSchemas,
                    properties
                } as never)
            ).toEqual(properties);
    });

    it('rejects values outside the closed enums', () => {
        expect(
            AnalyticsEventSchemas.addon_cancelled.safeParse({
                ...examples.addon_cancelled,
                path: 'NATURAL_EXPIRY'
            }).success
        ).toBe(false);
        expect(
            AnalyticsEventSchemas.addon_checkout_abandoned.safeParse({
                ...examples.addon_checkout_abandoned,
                reason: 'ORDER_DECLINED'
            }).success
        ).toBe(false);
        expect(
            AnalyticsEventSchemas.addon_activated.safeParse({
                ...examples.addon_activated,
                vertical: 'unknown'
            }).success
        ).toBe(false);
    });

    it('rejects an amount at or above Umami numeric ceiling (1e15)', () => {
        expect(
            AnalyticsEventSchemas.addon_charge_succeeded.safeParse({
                ...examples.addon_charge_succeeded,
                amount_minor: 1e15
            }).success
        ).toBe(false);
    });

    it('accepts an additive key, because no addon_* schema is strict (P-11)', () => {
        const parsed = AnalyticsEventSchemas.addon_cancelled.safeParse({
            ...examples.addon_cancelled,
            reason: 'TOO_EXPENSIVE'
        });
        expect(parsed.success).toBe(true);
    });

    it('declares no PII-shaped property key', () => {
        const forbidden =
            /(^|_)(email|phone|tel|message|password|token|secret|address|full_name|guest_name|guest_email|guest_phone|card)(_|$)/i;
        for (const [name, schema] of Object.entries(AnalyticsEventSchemas))
            if (name.startsWith('addon_'))
                for (const key of Object.keys(schema.shape))
                    expect(forbidden.test(key)).toBe(false);
    });
});
