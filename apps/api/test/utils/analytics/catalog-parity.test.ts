import {
    ANALYTICS_ENTITY_TYPES,
    ANALYTICS_LISTING_ENTITY_TYPES,
    AnalyticsEventSchemas
} from '@repo/analytics';
import {
    BILLING_CYCLES,
    CancellationReasonEnum,
    LISTING_TRAFFIC_STATS_ENTITY_TYPES,
    TRACKABLE_ENTITY_TYPES,
    VerticalEnum
} from '@repo/schemas';
import { SUSPEND_FOR_ARREARS_EVENTS } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';

describe('billing analytics catalog parity (TEST:1878:16)', () => {
    it('matches persisted verticals and billing cycles', async () => {
        // test/setup.ts mocks `@repo/db` and `@repo/db/schemas` globally, and a
        // parity check must compare against the real persisted values.
        const { SUBSCRIPTION_CANCELLATION_REASONS } =
            await vi.importActual<typeof import('@repo/db/schemas')>('@repo/db/schemas');
        expect(AnalyticsEventSchemas.billing_checkout_started.shape.vertical.options).toEqual(
            Object.values(VerticalEnum)
        );
        // `billing_checkout_started.cycle` is `billing_option.cycle`, whose CHECK
        // lists exactly `BILLING_CYCLES`.
        expect(AnalyticsEventSchemas.billing_checkout_started.shape.cycle.options).toEqual([
            ...BILLING_CYCLES
        ]);
        expect(AnalyticsEventSchemas.billing_subscription_suspended.shape.trigger.options).toEqual(
            SUSPEND_FOR_ARREARS_EVENTS
        );
        expect(
            AnalyticsEventSchemas.billing_cancel_scheduled.shape.reason.unwrap().options
        ).toEqual(Object.values(CancellationReasonEnum));
        expect(SUBSCRIPTION_CANCELLATION_REASONS).toEqual(Object.values(CancellationReasonEnum));
    });
    it('keeps analytics entity types in parity with TRACKABLE_ENTITY_TYPES (HOS-2119)', () => {
        expect([...ANALYTICS_ENTITY_TYPES]).toEqual([...TRACKABLE_ENTITY_TYPES]);
    });
    it('keeps listing analytics entity types in parity with the owner traffic-stats types (HOS-2119)', () => {
        expect([...ANALYTICS_LISTING_ENTITY_TYPES]).toEqual([
            ...LISTING_TRAFFIC_STATS_ENTITY_TYPES
        ]);
    });
    it('keeps the addon_* closed enums in parity with the persisted values (HOS-1883 AC-14)', () => {
        for (const name of [
            'addon_checkout_started',
            'addon_checkout_abandoned',
            'addon_activated',
            'addon_charge_succeeded',
            'addon_charge_declined',
            'addon_cancelled',
            'addon_granted_free'
        ] as const) {
            expect(AnalyticsEventSchemas[name].shape.vertical.unwrap().options).toEqual(
                Object.values(VerticalEnum)
            );
        }
        expect(AnalyticsEventSchemas.addon_activated.shape.cycle.unwrap().options).toEqual([
            ...BILLING_CYCLES
        ]);
    });
    it('rejects forbidden analytics property names', () => {
        const forbidden =
            /(^|_)(email|phone|tel|message|password|token|secret|address|full_name|guest_name|guest_email|guest_phone|card)(_|$)/i;
        for (const schema of Object.entries(AnalyticsEventSchemas)
            .filter(([name]) => /^(billing|trial|addon)_/.test(name))
            .map(([, schema]) => schema)) {
            expect(Object.keys(schema.shape).some((key) => forbidden.test(key))).toBe(false);
        }
    });
});
