import { AnalyticsEventSchemas } from '@repo/analytics';
import { BILLING_CYCLES, CancellationReasonEnum, VerticalEnum } from '@repo/schemas';
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
    it('rejects forbidden analytics property names', () => {
        const forbidden =
            /(^|_)(email|phone|tel|message|password|token|secret|address|full_name|guest_name|guest_email|guest_phone|card)(_|$)/i;
        for (const schema of Object.entries(AnalyticsEventSchemas)
            .filter(([name]) => name.startsWith('billing_') || name.startsWith('trial_'))
            .map(([, schema]) => schema)) {
            expect(Object.keys(schema.shape).some((key) => forbidden.test(key))).toBe(false);
        }
    });
});
