import { describe, expect, it } from 'vitest';
import {
    AdminTrialSummaryQuerySchema,
    AdminTrialSummaryResponseSchema
} from '../../../src/api/billing/admin-trial-summary.schema.js';

describe('TEST:V8a:7 (panel, fila 4) admin trial summary schema', () => {
    it.each(['accommodation', 'gastronomy', 'experience'])('accepts %s', (vertical) => {
        expect(AdminTrialSummaryQuerySchema.safeParse({ vertical }).success).toBe(true);
    });
    it.each(['tourist', 'partner', 'unknown'])('rejects %s', (vertical) => {
        expect(AdminTrialSummaryQuerySchema.safeParse({ vertical }).success).toBe(false);
    });
    it('rejects a missing vertical', () => {
        expect(AdminTrialSummaryQuerySchema.safeParse({}).success).toBe(false);
    });
    it('accepts NONE with no ceiling', () => {
        expect(
            AdminTrialSummaryResponseSchema.safeParse({
                summary: { status: 'NONE' },
                ceilingDays: null
            }).success
        ).toBe(true);
    });
    it('accepts a trial and positive integer ceiling', () => {
        expect(
            AdminTrialSummaryResponseSchema.safeParse({
                summary: {
                    status: 'TRIAL_ACTIVE',
                    startedAt: '2026-01-01T00:00:00.000Z',
                    endsAt: '2026-01-31T00:00:00.000Z',
                    totalDays: 30,
                    origins: { base: 30, promo: 0, support: 0 }
                },
                ceilingDays: 90
            }).success
        ).toBe(true);
    });
    it.each([0, -1, 1.5])('rejects invalid ceiling %s', (ceilingDays) => {
        expect(
            AdminTrialSummaryResponseSchema.safeParse({ summary: { status: 'NONE' }, ceilingDays })
                .success
        ).toBe(false);
    });
});
