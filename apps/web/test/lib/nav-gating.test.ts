import { PermissionEnum as P } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    hasAccommodationsNavAccess,
    hasEventsNavAccess,
    hasListingNavAccess,
    hasPostsNavAccess,
    isDoorVisible,
    isVisibleByPermissions,
    resolveDoorOptionState
} from '@/lib/nav-gating';

describe('effective navigation evaluation', () => {
    it('keeps ungated nodes public but gated/loading nodes closed', () => {
        expect(isVisibleByPermissions({}, [])).toBe(true);
        expect(isVisibleByPermissions({ requiredPermission: P.POST_CREATE }, [])).toBe(false);
        expect(isVisibleByPermissions({ requiredPermissions: [] }, [])).toBe(false);
        expect(
            isVisibleByPermissions({ requiredPermissions: [P.POST_CREATE, P.POST_UPDATE] }, [
                P.POST_UPDATE
            ])
        ).toBe(true);
    });
    it('supports independent grants, never role-name approximations', () => {
        expect(hasAccommodationsNavAccess({ permissions: ['HOST', 'ADMIN'] })).toBe(false);
        expect(hasAccommodationsNavAccess({ permissions: [P.ACCOMMODATION_CREATE] })).toBe(true);
        expect(hasListingNavAccess({ permissions: [P.VENUE_EDIT_ALL] })).toBe(true);
        expect(hasListingNavAccess({ permissions: [P.EXPERIENCE_EDIT_OWN] })).toBe(true);
        expect(hasPostsNavAccess({ permissions: [P.POST_UPDATE_OWN] })).toBe(true);
        expect(hasEventsNavAccess({ permissions: [P.EVENT_UPDATE] })).toBe(true);
        expect(hasPostsNavAccess({ permissions: [P.EVENT_CREATE] })).toBe(false);
    });
});

describe('hub acquisition state remains separate from door visibility', () => {
    const visibility = (node: Parameters<typeof isVisibleByPermissions>[0]) =>
        isVisibleByPermissions(node, [P.POST_CREATE]);
    it('handles acquired, unacquired and coming-soon options', () => {
        expect(
            resolveDoorOptionState({ option: { acquiredPermission: P.POST_CREATE }, visibility })
        ).toBe('acquired');
        expect(
            resolveDoorOptionState({ option: { acquiredPermission: P.EVENT_CREATE }, visibility })
        ).toBe('unacquired');
        expect(resolveDoorOptionState({ option: {}, visibility })).toBe('unacquired');
        expect(resolveDoorOptionState({ option: { comingSoon: true }, visibility })).toBe(
            'comingSoon'
        );
    });
    it('applies owned-row overrides only to the named option', () => {
        expect(
            resolveDoorOptionState({
                option: { id: 'serviceProvider', comingSoon: true },
                visibility,
                acquiredOptionIds: ['serviceProvider']
            })
        ).toBe('acquired');
        expect(
            resolveDoorOptionState({
                option: { id: 'partner' },
                visibility,
                acquiredOptionIds: ['serviceProvider']
            })
        ).toBe('unacquired');
    });
    it.each([
        { permissions: [], expected: false },
        { permissions: [P.ACCOMMODATION_CREATE], expected: true },
        { permissions: [P.VENUE_EDIT_OWN], expected: true },
        { permissions: [P.EXPERIENCE_EDIT_OWN], expected: true },
        { permissions: [P.POST_CREATE], expected: true },
        { permissions: [], ownsPartner: true, expected: true },
        { permissions: [], ownsHostTradeListing: true, expected: true }
    ])('shows one door for %j', ({ expected, ...facts }) => {
        expect(isDoorVisible({ door: { kind: 'partner' }, ...facts })).toBe(expected);
        expect(isDoorVisible({ door: { kind: 'listing' }, ...facts })).toBe(!expected);
    });
});
