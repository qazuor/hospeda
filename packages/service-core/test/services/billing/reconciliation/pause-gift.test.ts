import { describe, expect, it } from 'vitest';
import { computePauseGift } from '../../../../src/services/billing/reconciliation/sweep/pause-gift.js';

const date = (value: string) => new Date(value);

describe('computePauseGift (TEST:1607:5)', () => {
    it('computes Juan’s 29 net gift days', () => {
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-10-31T12:00:00Z'),
                pauseEndedAt: date('2026-12-02T12:00:00Z'),
                anchorChargeAt: date('2026-11-01T12:00:00Z'),
                cycleMonths: 1
            })
        ).toEqual({
            firstSkippedChargeAt: date('2026-11-01T12:00:00Z'),
            nextChargeAfterReturnAt: date('2027-01-01T12:00:00Z'),
            giftDays: 29
        });
    });
    it('does not count a return on the charge date or a pause crossing no charge', () => {
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-10-31T12:00:00Z'),
                pauseEndedAt: date('2026-12-01T12:00:00Z'),
                anchorChargeAt: date('2026-11-01T12:00:00Z'),
                cycleMonths: 1
            })
        ).toBeNull();
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-10-30T12:00:00Z'),
                pauseEndedAt: date('2026-10-31T12:00:00Z'),
                anchorChargeAt: date('2026-11-01T12:00:00Z'),
                cycleMonths: 1
            })
        ).toBeNull();
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-10-01T12:00:00Z'),
                pauseEndedAt: date('2026-11-01T12:00:00Z'),
                anchorChargeAt: date('2026-10-15T12:00:00Z'),
                cycleMonths: 1
            })
        ).toBeNull();
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-10-02T12:00:00Z'),
                pauseEndedAt: date('2026-10-30T12:00:00Z'),
                anchorChargeAt: date('2026-11-01T12:00:00Z'),
                cycleMonths: 1
            })
        ).toBeNull();
    });
    it('counts multi-cycle pauses and clamps from the original day-31 anchor', () => {
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-01-31T12:00:00Z'),
                pauseEndedAt: date('2026-04-02T12:00:00Z'),
                anchorChargeAt: date('2026-02-01T12:00:00Z'),
                cycleMonths: 1
            })
        ).not.toBeNull();
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-01-31T12:00:00Z'),
                pauseEndedAt: date('2026-03-01T12:00:00Z'),
                anchorChargeAt: date('2026-01-31T12:00:00Z'),
                cycleMonths: 1
            })
        ).toEqual({
            firstSkippedChargeAt: date('2026-02-28T12:00:00Z'),
            nextChargeAfterReturnAt: date('2026-03-31T12:00:00Z'),
            giftDays: 2
        });
    });
    it.each([3, 6, 12])('supports cycle length %i months', (cycleMonths) => {
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-01-02T12:00:00Z'),
                pauseEndedAt: date('2026-02-02T12:00:00Z'),
                anchorChargeAt: date('2026-01-15T12:00:00Z'),
                cycleMonths
            })
        ).not.toBeNull();
    });
    it('uses market-local calendar dates across UTC midnight', () => {
        expect(
            computePauseGift({
                pauseStartedAt: date('2026-10-31T02:00:00Z'),
                pauseEndedAt: date('2026-12-02T02:00:00Z'),
                anchorChargeAt: date('2026-11-01T02:00:00Z'),
                cycleMonths: 1
            })?.giftDays
        ).toBe(29);
    });
});
