import { AnalyticsEventSchemas } from '@repo/analytics';
import { ADDON_CYCLES } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return { ...actual, ADDON_CYCLES: ['monthly', 'quarterly', 'semiannual', 'annual'] };
});

describe('billing analytics catalog parity (TEST:1878:16)', () => {
    it('matches persisted verticals and billing cycles', () => {
        expect(AnalyticsEventSchemas.billing_checkout_started.shape.vertical.options).toEqual(
            Object.values(VerticalEnum)
        );
        expect(AnalyticsEventSchemas.billing_checkout_started.shape.cycle.options).toEqual(
            ADDON_CYCLES
        );
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
