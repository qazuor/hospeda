import { describe, expect, it } from 'vitest';
import { cycleLabel, planLabel, resolvePlanChangePreview } from '../plan-change-preview';

describe('plan change preview', () => {
    it.each([
        ['DOWN', 'monthly', 'monthly', 'AT_CYCLE_END'],
        ['UP', 'monthly', 'monthly', 'NEEDS_CHECKOUT'],
        ['CYCLE', 'monthly', 'quarterly', 'NEEDS_CHECKOUT'],
        ['NONE', 'monthly', 'monthly', 'NEEDS_CHECKOUT']
    ] as const)('resolves %s from %s to %s as %s', (direction, currentCycle, targetCycle, mode) => {
        expect(
            resolvePlanChangePreview({
                direction,
                currentCycle,
                targetCycle,
                nextChargeAt: '2026-12-01T00:00:00.000Z'
            })
        ).toEqual({
            mode,
            date: mode === 'AT_CYCLE_END' ? '2026-12-01T00:00:00.000Z' : null
        });
    });

    it('uses the raw name when a plan translation is missing', () => {
        expect(
            planLabel({
                slug: 'unknown-plan',
                name: 'Internal name',
                t: (key) => `[MISSING: ${key}]`
            })
        ).toBe('Internal name');
    });

    it('translates cycle labels', () => {
        expect(
            cycleLabel({
                cycle: 'monthly',
                t: (key) => (key.endsWith('.monthly') ? 'Mensual' : key)
            })
        ).toBe('Mensual');
    });
});
