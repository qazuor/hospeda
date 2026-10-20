import { describe, expect, it } from 'vitest';
import {
    computePreExpiryMilestones,
    PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS,
    TRIAL_DEADLINES_VERSION
} from '../../src/trial/trial-deadlines';

describe('trial-deadlines', () => {
    describe('TRIAL_DEADLINES_VERSION', () => {
        it('is 1', () => {
            expect(TRIAL_DEADLINES_VERSION).toBe(1);
        });
    });

    describe('PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS', () => {
        it('is [10, 5, 2, 0] as const', () => {
            expect(PRE_EXPIRY_CAMPAIGN_OFFSETS_DAYS).toEqual([10, 5, 2, 0]);
        });
    });

    describe('computePreExpiryMilestones', () => {
        const endsAt = new Date('2026-11-10T12:00:00.000Z');
        // Remember: endsAt is NOT mutated

        const beforeEndsAt = endsAt.getTime();

        const milestones = computePreExpiryMilestones({ endsAt });

        // Verify the exact dates
        it('returns 4 milestones in order', () => {
            expect(milestones).toHaveLength(4);
        });

        it('milestone 0: endsAt - 10 days', () => {
            expect(milestones[0]).toEqual(new Date('2026-10-31T12:00:00.000Z'));
        });

        it('milestone 1: endsAt - 5 days', () => {
            expect(milestones[1]).toEqual(new Date('2026-11-05T12:00:00.000Z'));
        });

        it('milestone 2: endsAt - 2 days', () => {
            expect(milestones[2]).toEqual(new Date('2026-11-08T12:00:00.000Z'));
        });

        it('milestone 3: endsAt - 0 days === endsAt', () => {
            expect(milestones[3]).toEqual(new Date('2026-11-10T12:00:00.000Z'));
        });

        it('returns new Date objects (not the same reference as endsAt)', () => {
            for (const m of milestones) {
                expect(m).not.toBe(endsAt);
            }
        });

        it('does not mutate the argument', () => {
            const afterTime = endsAt.getTime();
            expect(afterTime).toBe(beforeEndsAt);
        });
    });
});
