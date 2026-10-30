/**
 * HOS-1967 — the backend alone decides whether a vertical's pricing promises a
 * free trial: a real trial path AND a trial plan with `trial_days > 0`.
 */
import { PublicPlanCatalogVerticalSchema, resolveVerticalTrialPath } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveTrialOffer } from '../../../src/routes/plan-catalog/public/resolve-trial-offer';

describe('HOS-1967 resolveTrialOffer', () => {
    it.each([
        'accommodation',
        'venue',
        'experience'
    ] as const)('offers the trial plan days for the publication vertical %s', (vertical) => {
        // Arrange
        const trialPlanTrialDays = 21;

        // Act
        const result = resolveTrialOffer({ vertical, trialPlanTrialDays });

        // Assert
        expect(result).toEqual({ trialOffer: { trialDays: 21 } });
    });

    it.each([
        'accommodation',
        'venue',
        'experience'
    ] as const)('offers nothing for %s when its trial plan has zero days', (vertical) => {
        expect(resolveTrialOffer({ vertical, trialPlanTrialDays: 0 })).toEqual({
            trialOffer: null
        });
    });

    it('never offers tourist a trial, even when its trial plan carries days', () => {
        // Arrange: production today carries trial_days = 30 on the tourist trial plan.
        const trialPlanTrialDays = 30;

        // Act
        const result = resolveTrialOffer({ vertical: 'tourist', trialPlanTrialDays });

        // Assert
        expect(result).toEqual({ trialOffer: null });
    });

    it('offers nothing when the trial plan could not be read', () => {
        expect(resolveTrialOffer({ vertical: 'accommodation', trialPlanTrialDays: null })).toEqual({
            trialOffer: null
        });
    });

    it('offers nothing for a negative or fractional value', () => {
        expect(resolveTrialOffer({ vertical: 'venue', trialPlanTrialDays: -3 }).trialOffer).toBe(
            null
        );
        expect(resolveTrialOffer({ vertical: 'venue', trialPlanTrialDays: 1.5 }).trialOffer).toBe(
            null
        );
    });

    it('follows the trial plan: a different day count changes the offer', () => {
        expect(resolveTrialOffer({ vertical: 'experience', trialPlanTrialDays: 14 })).toEqual({
            trialOffer: { trialDays: 14 }
        });
        expect(resolveTrialOffer({ vertical: 'experience', trialPlanTrialDays: 45 })).toEqual({
            trialOffer: { trialDays: 45 }
        });
    });

    it('derives the trial path from the produced activation events, for every public vertical', () => {
        const paths = Object.fromEntries(
            PublicPlanCatalogVerticalSchema.options.map((vertical) => [
                vertical,
                resolveVerticalTrialPath({ vertical }).hasTrialPath
            ])
        );
        expect(paths).toEqual({
            accommodation: true,
            venue: true,
            experience: true,
            tourist: false
        });
        expect(resolveVerticalTrialPath({ vertical: 'partner' }).hasTrialPath).toBe(false);
    });
});
