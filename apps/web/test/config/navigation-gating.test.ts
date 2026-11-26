import { PermissionEnum as P } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getNavForSurface } from '@/config/navigation';
import { isVisibleByPermissions } from '@/lib/nav-gating';

const nav = (
    permissions: readonly string[],
    surface: 'sidebar' | 'mobile' | 'avatar' = 'sidebar'
) =>
    getNavForSurface({ surface, visibility: (node) => isVisibleByPermissions(node, permissions) })
        .groups;
const ids = (permissions: readonly string[]) =>
    nav(permissions).flatMap((group) => group.items.map((item) => item.id));

describe('shared navigation selector', () => {
    it('keeps public account/tourist groups and drops empty gated groups', () => {
        expect(nav([]).map((group) => group.id)).toEqual(['cuenta', 'turista']);
        expect(ids([])).toContain('help');
        expect(ids([])).toContain('dashboard');
    });
    it.each([
        [P.CONVERSATION_VIEW_OWN, 'ownerMessages'],
        [P.OWNER_PROMOTION_VIEW_OWN, 'promotions'],
        [P.HOST_TRADE_VIEW, 'providerDirectory']
    ] as const)('admits independently granted %s without create', (permission, id) => {
        const host = nav([permission]).find((group) => group.id === 'anfitrion');
        expect(host?.items.map((item) => item.id)).toEqual([id]);
    });
    it('does not infer inbox/directory/promotions authority from host eligibility', () => {
        expect(
            nav([P.ACCOMMODATION_CREATE])
                .find((group) => group.id === 'anfitrion')
                ?.items.map((item) => item.id)
        ).toEqual(['hostDashboard', 'properties', 'receivedReviews', 'benefitUsages']);
    });
    it.each([
        P.VENUE_EDIT_OWN,
        P.VENUE_EDIT_ALL
    ])('admits only the venue group for %s', (permission) => {
        const groups = nav([permission]);
        expect(
            groups.find((group) => group.id === 'comercio-venue')?.items.map((item) => item.id)
        ).toEqual(['venueDashboard', 'venue-listings']);
        expect(groups.some((group) => group.id === 'comercio-experience')).toBe(false);
    });
    it.each([
        P.EXPERIENCE_EDIT_OWN,
        P.EXPERIENCE_EDIT_ALL
    ])('admits only the experience group for %s', (permission) => {
        expect(nav([permission]).some((group) => group.id === 'comercio-experience')).toBe(true);
        expect(nav([permission]).some((group) => group.id === 'comercio-venue')).toBe(false);
    });
    it('independently exposes editorial create/update grants', () => {
        expect(ids([P.POST_UPDATE_OWN])).toContain('myPosts');
        expect(ids([P.POST_UPDATE_OWN])).not.toContain('myEvents');
        expect(ids([P.EVENT_UPDATE])).toContain('myEvents');
        expect(ids([P.EVENT_UPDATE])).not.toContain('myPosts');
    });
    it('preserves curated avatar membership and mobile management', () => {
        const all = Object.values(P);
        expect(nav(all, 'avatar').flatMap((group) => group.items.map((item) => item.id))).toEqual([
            'dashboard',
            'subscription',
            'favorites'
        ]);
        expect(nav(all, 'mobile').some((group) => group.id === 'anfitrion')).toBe(true);
        expect(nav(all).at(-1)?.id).toBe('turista');
    });
});
