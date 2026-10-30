import { describe, expect, it } from 'vitest';
import {
    PLAN_CHANGE_UNAVAILABLE,
    PLAN_CHANGE_UNAVAILABLE_KEY
} from '../../../src/lib/billing/my-subscription-notices';

describe('PLAN_CHANGE_UNAVAILABLE', () => {
    it('uses the exact shared translation key for the unavailable plan-change notice', () => {
        expect(PLAN_CHANGE_UNAVAILABLE_KEY).toBe('account.subscription.mine.planChangeUnavailable');
    });

    it.each([
        { status: 'ACTIVE', expected: true },
        { status: 'GRACE_PERIOD', expected: false },
        { status: 'SUSPENDED', expected: false },
        { status: 'CANCEL_SCHEDULED', expected: false }
    ] as const)('returns $expected for $status', ({ status, expected }) => {
        expect(PLAN_CHANGE_UNAVAILABLE[status]).toBe(expected);
    });
});
