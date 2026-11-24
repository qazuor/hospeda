import { describe, expect, it } from 'vitest';
import {
    isOwnerAudience,
    OWNER_PLANS_FALLBACK_PATH,
    resolveEmptySubscriptionPlansPath
} from '@/lib/account-roles';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';

describe('resolveEmptySubscriptionPlansPath (owner decision 2)', () => {
    it.each([
        [['USER', 'HOST'], PRICING_PAGE_PATH_BY_AUDIENCE.owner],
        [['USER', 'VENUE_OWNER'], PRICING_PAGE_PATH_BY_AUDIENCE.venue],
        [['EXPERIENCE_OWNER'], PRICING_PAGE_PATH_BY_AUDIENCE.experience],
        [['HOST', 'ADMIN'], PRICING_PAGE_PATH_BY_AUDIENCE.owner]
    ])('sends the single owner vertical %j to its public plans page', (roles, expected) => {
        // Arrange + Act
        const path = resolveEmptySubscriptionPlansPath({ roles });
        // Assert
        expect(path).toBe(expected);
    });

    it.each([
        [['HOST', 'VENUE_OWNER']],
        [['VENUE_OWNER', 'EXPERIENCE_OWNER']],
        [['USER']],
        [['ADMIN']],
        [[]]
    ])('sends %j (several verticals or none) to /mi-cuenta/publica', (roles) => {
        expect(resolveEmptySubscriptionPlansPath({ roles })).toBe(OWNER_PLANS_FALLBACK_PATH);
    });

    it('treats a missing role set as no vertical', () => {
        expect(resolveEmptySubscriptionPlansPath({ roles: null })).toBe('mi-cuenta/publica');
    });
});

describe('isOwnerAudience (HOS-2610 F-40)', () => {
    it.each([['HOST'], ['VENUE_OWNER'], ['EXPERIENCE_OWNER']])('is true for %s', (role) => {
        expect(isOwnerAudience({ roles: ['USER', role] })).toBe(true);
    });

    it('is false for a tourist, staff-only roles and no roles', () => {
        expect(isOwnerAudience({ roles: ['USER'] })).toBe(false);
        expect(isOwnerAudience({ roles: ['ADMIN'] })).toBe(false);
        expect(isOwnerAudience({ roles: null })).toBe(false);
    });
});
