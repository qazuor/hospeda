import { describe, expect, it } from 'vitest';
import { PLAN_CHANGE_UNAVAILABLE } from '../../../src/lib/billing/my-subscription-notices';

describe('PLAN_CHANGE_UNAVAILABLE', () => {
    it.each([
        { status: 'ACTIVE', expected: true },
        { status: 'GRACE_PERIOD', expected: false },
        { status: 'SUSPENDED', expected: false },
        { status: 'CANCEL_SCHEDULED', expected: false }
    ] as const)('returns $expected for $status', ({ status, expected }) => {
        expect(PLAN_CHANGE_UNAVAILABLE[status]).toBe(expected);
    });
});
