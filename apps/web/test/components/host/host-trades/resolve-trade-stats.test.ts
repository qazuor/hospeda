/**
 * @file resolve-trade-stats.test.ts
 * @description The threshold rule of the directory card (HOS-376 T-052, AC-25/AC-26).
 *
 * These assertions live against the pure resolver rather than the rendered
 * card on purpose: "the average is absent" is a claim about a value, and a
 * rendered assertion for an absence passes just as happily when the branch
 * that produces it was never reached.
 */

import { HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveTradeStats } from '@/components/host/host-trades/resolve-trade-stats';

describe('resolveTradeStats', () => {
    describe('the average threshold (AC-25)', () => {
        it('should withhold the average below the threshold', () => {
            const stats = resolveTradeStats({
                trade: { reviewsCount: 2, averageRating: 4.6 }
            });

            expect(stats.average).toBeNull();
            expect(stats.reviewsCount).toBe(2);
        });

        it('should show the average at the threshold', () => {
            const stats = resolveTradeStats({
                trade: { reviewsCount: HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE, averageRating: 4.6 }
            });

            expect(stats.average).toBe(4.6);
        });

        it('should show the average above the threshold', () => {
            const stats = resolveTradeStats({
                trade: { reviewsCount: 12, averageRating: 4.6 }
            });

            expect(stats.average).toBe(4.6);
        });

        it('should withhold an average the aggregates never computed', () => {
            // Enough reviews, but no rating on the row. Printing "★ 0" would
            // read as a unanimous worst score rather than as missing data.
            const stats = resolveTradeStats({
                trade: { reviewsCount: 12, averageRating: undefined }
            });

            expect(stats.average).toBeNull();
            expect(stats.reviewsCount).toBe(12);
        });

        it('should withhold a zero average that enough reviews contradict', () => {
            // Unreachable if the aggregates are correct — the lowest rating a
            // review can carry is 1, so three of them cannot average to 0. It
            // is reachable when they are STALE: `recalculateHostTradeAggregates`
            // writes the count and the rating on hooks (T-023), and a partial
            // write leaves exactly this shape. "★ 0,0" over a real person's
            // trade is the worst possible thing to print from a bookkeeping gap.
            const stats = resolveTradeStats({
                trade: { reviewsCount: 12, averageRating: 0 }
            });

            expect(stats.average).toBeNull();
            expect(stats.reviewsCount).toBe(12);
        });

        it('should withhold an average that no review backs', () => {
            // A rating with no reviews behind it is stale aggregate state, not
            // a score. The count is what the threshold is measured against.
            const stats = resolveTradeStats({
                trade: { reviewsCount: 0, averageRating: 5 }
            });

            expect(stats.average).toBeNull();
        });
    });

    describe('the usage pair (AC-26)', () => {
        it('should carry both numbers of the anti-collusion pair', () => {
            const stats = resolveTradeStats({
                trade: { confirmedUsesCount: 34, distinctHostsCount: 21 }
            });

            expect(stats.confirmedUsesCount).toBe(34);
            expect(stats.distinctHostsCount).toBe(21);
            expect(stats.isEmpty).toBe(false);
        });

        it('should read a missing aggregate as zero', () => {
            const stats = resolveTradeStats({ trade: {} });

            expect(stats.confirmedUsesCount).toBe(0);
            expect(stats.distinctHostsCount).toBe(0);
            expect(stats.reviewsCount).toBe(0);
            expect(stats.average).toBeNull();
        });
    });

    describe('what is not worth a line', () => {
        it('should call a provider with no activity empty', () => {
            const stats = resolveTradeStats({
                trade: {
                    reviewsCount: 0,
                    averageRating: 0,
                    confirmedUsesCount: 0,
                    distinctHostsCount: 0
                }
            });

            expect(stats.isEmpty).toBe(true);
        });

        it('should not call a reviewed provider empty', () => {
            const stats = resolveTradeStats({ trade: { reviewsCount: 1 } });

            expect(stats.isEmpty).toBe(false);
        });

        it('should not call a used provider empty', () => {
            const stats = resolveTradeStats({ trade: { confirmedUsesCount: 1 } });

            expect(stats.isEmpty).toBe(false);
        });
    });
});
