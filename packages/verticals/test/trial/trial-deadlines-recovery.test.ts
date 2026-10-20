import { describe, expect, it } from 'vitest';
import { computeRecoveryMilestones } from '../../src/trial/trial-deadlines';

describe('PLAZO:6 recovery milestones', () => {
    it('uses exact elapsed days and leaves the input unchanged', () => {
        const expiredAt = new Date('2026-11-10T12:00:00.000Z');
        const milestones = computeRecoveryMilestones({ expiredAt });
        expect(milestones.map((date) => date.toISOString())).toEqual([
            '2026-11-11T12:00:00.000Z',
            '2026-11-15T12:00:00.000Z',
            '2026-11-25T12:00:00.000Z',
            '2026-12-10T12:00:00.000Z',
            '2027-01-09T12:00:00.000Z'
        ]);
        expect(expiredAt.toISOString()).toBe('2026-11-10T12:00:00.000Z');
        expect(milestones.every((date) => date !== expiredAt)).toBe(true);
    });
});
