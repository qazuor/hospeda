import { describe, expect, it } from 'vitest';
import { UserStatsResponseSchema } from '../../../src/api/billing/account-stats-response.schema';

const base = { bookmarkCount: 0, reviewCount: 0, activeSubscriptionsCount: 0 };

describe('TEST:1756:8 user stats response schema', () => {
    it('accepts a free account and a valid plan', () => {
        expect(UserStatsResponseSchema.safeParse({ ...base, plan: null }).success).toBe(true);
        expect(
            UserStatsResponseSchema.safeParse({
                ...base,
                activeSubscriptionsCount: 1,
                plan: {
                    slug: 'owner-basico',
                    name: 'Basic',
                    status: 'ACTIVE',
                    vertical: 'accommodation'
                }
            }).success
        ).toBe(true);
    });

    it.each([
        { bookmarkCount: 0, reviewCount: 0 },
        { bookmarkCount: 0, reviewCount: 0, plan: null },
        {
            ...base,
            activeSubscriptionsCount: 1,
            plan: { slug: 'x', name: 'X', status: 'PAUSED', vertical: 'accommodation' }
        },
        { ...base, plan: null, activeSubscriptionsCount: -1 },
        { ...base, plan: null, activeSubscriptionsCount: 1.5 }
    ])('rejects invalid response shape %#', (value) => {
        expect(UserStatsResponseSchema.safeParse(value).success).toBe(false);
    });
});
