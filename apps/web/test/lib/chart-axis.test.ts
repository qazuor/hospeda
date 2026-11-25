import { describe, expect, it } from 'vitest';
import { buildLinearAxis } from '@/lib/chart-axis';

/** Every gap between consecutive ticks is the same. */
function isLinear(ticks: readonly number[]): boolean {
    return ticks.every((tick, i) => i === 0 || tick - (ticks[i - 1] as number) === ticks[1]);
}

describe('buildLinearAxis', () => {
    it('replaces the irregular 0, 3, 6, 12 with even steps', () => {
        const axis = buildLinearAxis({ max: 12 });
        expect(axis.ticks).toEqual([0, 5, 10, 15]);
        expect(axis.domain).toEqual([0, 15]);
    });

    it('uses a step of 1, 2 or 5 times a power of ten', () => {
        for (const max of [1, 2, 3, 4, 6, 7, 12, 23, 47, 99, 130, 1001]) {
            const { ticks } = buildLinearAxis({ max });
            const step = ticks[1] as number;
            const magnitude = 10 ** Math.floor(Math.log10(step));
            expect([1, 2, 5]).toContain(step / magnitude);
            expect(isLinear(ticks)).toBe(true);
        }
    });

    it('starts at 0, covers the max and only holds integers', () => {
        const { ticks, domain } = buildLinearAxis({ max: 7 });
        expect(ticks[0]).toBe(0);
        expect(domain[1]).toBe(ticks.at(-1));
        expect(domain[1]).toBeGreaterThanOrEqual(7);
        expect(ticks.every(Number.isInteger)).toBe(true);
    });

    it('draws a usable axis when there is no data', () => {
        expect(buildLinearAxis({ max: 0 }).ticks).toEqual([0, 1]);
        expect(buildLinearAxis({ max: Number.NaN }).domain).toEqual([0, 1]);
    });
});
