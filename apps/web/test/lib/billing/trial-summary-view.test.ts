/** @file Tests for the pure trial summary presentation resolver. */
import { TrialStatusEnum, type TrialSummaryResponse } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveTrialSummaryView } from '@/lib/billing/trial-summary-view';

const activeSummary: TrialSummaryResponse = {
    status: TrialStatusEnum.TRIAL_ACTIVE,
    startedAt: '2026-10-20T03:00:00.000Z',
    endsAt: '2026-11-19T03:00:00.000Z',
    totalDays: 30,
    origins: { base: 20, promo: 5, support: 5 }
};

function summaryFor(
    status: TrialStatusEnum,
    overrides: Partial<Exclude<TrialSummaryResponse, { status: 'NONE' }>> = {}
): TrialSummaryResponse {
    return { ...activeSummary, ...overrides, status };
}

describe('resolveTrialSummaryView', () => {
    it('TEST:1727:1 — preserves a running trial and hides NONE and rows born consumed', () => {
        expect(resolveTrialSummaryView({ summary: activeSummary })).toEqual({
            kind: 'running',
            totalDays: 30,
            origins: { base: 20, promo: 5, support: 5 },
            startedAt: activeSummary.startedAt,
            endsAt: activeSummary.endsAt
        });
        expect(resolveTrialSummaryView({ summary: { status: 'NONE' } })).toEqual({
            kind: 'hidden'
        });
        expect(
            resolveTrialSummaryView({
                summary: summaryFor(TrialStatusEnum.TRIAL_CONVERTED, {
                    totalDays: 0,
                    startedAt: null,
                    endsAt: null,
                    origins: { base: 0, promo: 0, support: 0 }
                })
            })
        ).toEqual({ kind: 'hidden' });
    });

    it('TEST:1727:2 — does not present a converted trial as running or expose its dates/days', () => {
        expect(
            resolveTrialSummaryView({
                summary: summaryFor(TrialStatusEnum.TRIAL_CONVERTED)
            })
        ).toEqual({ kind: 'ended_converted' });
    });

    it('TEST:1727:3 — an expired trial exposes only its actual end instant', () => {
        expect(
            resolveTrialSummaryView({
                summary: summaryFor(TrialStatusEnum.TRIAL_EXPIRED)
            })
        ).toEqual({ kind: 'ended_expired', endsAt: activeSummary.endsAt });
        expect(
            resolveTrialSummaryView({
                summary: summaryFor(TrialStatusEnum.TRIAL_EXPIRED, { endsAt: null })
            })
        ).toEqual({ kind: 'ended_expired', endsAt: null });
    });

    it('TEST:1727:4 — resolves every declared status', () => {
        for (const status of Object.values(TrialStatusEnum)) {
            const view = resolveTrialSummaryView({ summary: summaryFor(status) });
            expect(view).toBeDefined();
            expect(view.kind).not.toBe('hidden');
        }
    });
});
