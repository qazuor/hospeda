import { PermissionEnum as P } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    canAccessPublisherArea,
    guardPublisherArea,
    guardVenueOrExperienceArea,
    PUBLISHER_ACCESS,
    publisherDenyRedirect
} from '@/lib/account/publisher-access';

describe('publisher page admission', () => {
    type GuardContext = Parameters<typeof guardPublisherArea>[0]['astro'];
    function context(user: GuardContext['locals']['user']) {
        return {
            locals: { locale: 'en' as const, user },
            redirect: vi.fn(
                (path: string) => new Response(null, { status: 302, headers: { Location: path } })
            )
        };
    }

    it.each([
        null,
        undefined
    ])('leaves missing sessions (%s) to the existing login redirect', (user) => {
        const astro = context(user);
        expect(guardPublisherArea({ astro, area: 'host' })).toBeNull();
        expect(astro.redirect).not.toHaveBeenCalled();
    });

    it('returns the locale-aware redirect response for a denied user', () => {
        const astro = context({ permissions: [] });
        const response = guardPublisherArea({ astro, area: 'host' });
        expect(response?.headers.get('Location')).toBe('/en/mi-cuenta/');
        expect(response).toBe(astro.redirect.mock.results[0]?.value);
    });

    it('allows effective permissions without redirecting', () => {
        const astro = context({ permissions: [P.ACCOMMODATION_CREATE] });
        expect(guardPublisherArea({ astro, area: 'host' })).toBeNull();
        expect(astro.redirect).not.toHaveBeenCalled();
    });

    it('fails closed when permissions are missing', () => {
        const astro = context({});
        expect(guardPublisherArea({ astro, area: 'host' })?.status).toBe(302);
    });

    it.each([
        'partner',
        'provider'
    ] as const)('requires the session ownership fact for %s', (area) => {
        const ownership = area === 'partner' ? 'ownsPartner' : 'ownsHostTradeListing';
        const otherOwnership = area === 'partner' ? 'ownsHostTradeListing' : 'ownsPartner';
        const allowed = context({ [ownership]: true });
        expect(guardPublisherArea({ astro: allowed, area })).toBeNull();
        expect(allowed.redirect).not.toHaveBeenCalled();
        const denied = context({
            permissions: Object.values(P),
            [ownership]: false,
            [otherOwnership]: true
        });
        expect(guardPublisherArea({ astro: denied, area })?.status).toBe(302);
        expect(guardPublisherArea({ astro: context({}), area })?.status).toBe(302);
    });
});

describe('effective publisher admission', () => {
    it('fails closed and admits grants independently of roles', () => {
        expect(canAccessPublisherArea({ area: 'host', permissions: [] })).toBe(false);
        expect(
            canAccessPublisherArea({ area: 'host', permissions: [P.ACCOMMODATION_CREATE] })
        ).toBe(true);
        expect(
            canAccessPublisherArea({ area: 'inbox', permissions: [P.CONVERSATION_VIEW_OWN] })
        ).toBe(true);
        expect(
            canAccessPublisherArea({ area: 'inbox', permissions: [P.ACCOMMODATION_CREATE] })
        ).toBe(false);
    });
    it('separates creation, editing and verticals with ANY authority', () => {
        expect(
            canAccessPublisherArea({
                area: 'accommodationEdit',
                permissions: [P.ACCOMMODATION_UPDATE_OWN]
            })
        ).toBe(true);
        expect(
            canAccessPublisherArea({
                area: 'accommodationEdit',
                permissions: [P.ACCOMMODATION_CREATE]
            })
        ).toBe(false);
        expect(canAccessPublisherArea({ area: 'venue', permissions: [P.VENUE_EDIT_ALL] })).toBe(
            true
        );
        expect(
            canAccessPublisherArea({ area: 'experience', permissions: [P.VENUE_EDIT_ALL] })
        ).toBe(false);
        expect(canAccessPublisherArea({ area: 'postEdit', permissions: [P.POST_UPDATE_OWN] })).toBe(
            true
        );
        expect(canAccessPublisherArea({ area: 'postCreate', permissions: [P.POST_UPDATE] })).toBe(
            false
        );
        expect(canAccessPublisherArea({ area: 'eventEdit', permissions: [P.EVENT_UPDATE] })).toBe(
            true
        );
        expect(
            canAccessPublisherArea({ area: 'eventCreate', permissions: [P.EVENT_UPDATE_OWN] })
        ).toBe(false);
        expect(
            canAccessPublisherArea({
                area: 'promotionEdit',
                permissions: [P.OWNER_PROMOTION_VIEW_OWN]
            })
        ).toBe(false);
        expect(
            canAccessPublisherArea({
                area: 'promotionEdit',
                permissions: [P.OWNER_PROMOTION_UPDATE_OWN]
            })
        ).toBe(true);
        expect(PUBLISHER_ACCESS.venue.requiredPermissions).toContain(P.VENUE_EDIT_ALL);
    });
    it('uses ownership facts only for ownership pages', () => {
        expect(
            canAccessPublisherArea({ area: 'partner', permissions: [P.ACCOMMODATION_CREATE] })
        ).toBe(false);
        expect(
            canAccessPublisherArea({ area: 'partner', permissions: [], ownsPartner: true })
        ).toBe(true);
        expect(
            canAccessPublisherArea({
                area: 'provider',
                permissions: [],
                ownsHostTradeListing: true
            })
        ).toBe(true);
        expect(
            canAccessPublisherArea({ area: 'provider', permissions: [], ownsPartner: true })
        ).toBe(false);
    });
    it.each([
        ['es', '/es/mi-cuenta/'],
        ['en', '/en/mi-cuenta/'],
        ['pt', '/pt/mi-cuenta/']
    ] as const)('redirects denied %s publishers to exact account home %s', (locale, expected) => {
        expect(publisherDenyRedirect({ locale })).toBe(expected);
    });
});

describe('comercio listing editor admission', () => {
    function context({
        vertical,
        permissions
    }: {
        readonly vertical: string | undefined;
        readonly permissions: readonly string[];
    }) {
        return {
            params: { vertical },
            locals: { locale: 'es' as const, user: { permissions } },
            redirect: vi.fn(
                (path: string) => new Response(null, { status: 302, headers: { Location: path } })
            )
        };
    }

    it('answers 404 for a vertical that is not a comercio vertical', () => {
        // Arrange
        const astro = context({ vertical: 'accommodation', permissions: [P.VENUE_EDIT_OWN] });
        // Act
        const response = guardVenueOrExperienceArea({ astro });
        // Assert
        expect(response?.status).toBe(404);
        expect(astro.redirect).not.toHaveBeenCalled();
    });

    it('admits a venue owner on the venue editor', () => {
        const astro = context({ vertical: 'venue', permissions: [P.VENUE_EDIT_OWN] });
        expect(guardVenueOrExperienceArea({ astro })).toBeNull();
    });

    it('sends an account without the vertical permission back to the account home', () => {
        const astro = context({ vertical: 'experience', permissions: [P.VENUE_EDIT_OWN] });
        const response = guardVenueOrExperienceArea({ astro });
        expect(response?.status).toBe(302);
        expect(response?.headers.get('Location')).toBe('/es/mi-cuenta/');
    });
});
