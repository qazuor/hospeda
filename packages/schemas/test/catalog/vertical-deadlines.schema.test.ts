import { describe, expect, it } from 'vitest';
import { VerticalDeadlineValuesSchema } from '../../src/catalog/vertical-deadlines.schema.js';

// OWNER-PENDING (HOS-1479, D-1): keys 3, 4, 7, 8 and 9 are placeholders.
const versionOne = {
    '1': { days: 90 },
    '2': { days: 180 },
    '3': { months: 3 },
    '4': { beforeArchiveDays: 15, beforeDeletionDays: 15 },
    '5': { daysBefore: [10, 5, 2, 0] },
    '6': { daysAfter: [1, 5, 15, 30, 60] },
    '7': { days: 90 },
    '8': { days: 7 },
    '9': { days: 30 }
};

describe('vertical deadline values (TEST:V6:20)', () => {
    it('accepts the version 1 values', () => {
        expect(VerticalDeadlineValuesSchema.safeParse(versionOne).success).toBe(true);
    });

    it.each([
        [{ '1': { days: 200 } }, ['1', 'days']],
        [{ '3': { months: 6 } }, ['3', 'months']],
        [{ '4': { beforeArchiveDays: 95, beforeDeletionDays: 15 } }, ['4', 'beforeArchiveDays']],
        [{ '4': { beforeArchiveDays: 15, beforeDeletionDays: 91 } }, ['4', 'beforeDeletionDays']],
        [{ '5': { daysBefore: [10, 5, 5, 0] } }, ['5', 'daysBefore']],
        [{ '6': { daysAfter: [1, 5, 5, 30, 60] } }, ['6', 'daysAfter']]
    ] as const)('rejects a contradictory deadline at %j', (replacement, path) => {
        const result = VerticalDeadlineValuesSchema.safeParse({ ...versionOne, ...replacement });
        expect(result.success).toBe(false);
        if (!result.success)
            expect(
                result.error.issues.some((issue) => issue.path.join('.') === path.join('.'))
            ).toBe(true);
    });

    it('rejects missing and additional keys', () => {
        const { '9': omitted, ...withoutNine } = versionOne;
        expect(omitted).toBeDefined();
        expect(VerticalDeadlineValuesSchema.safeParse(withoutNine).success).toBe(false);
        expect(
            VerticalDeadlineValuesSchema.safeParse({ ...versionOne, '10': { days: 1 } }).success
        ).toBe(false);
    });
});
