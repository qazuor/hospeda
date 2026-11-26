import { describe, expect, it } from 'vitest';
import {
    capAddonHref,
    findCapAddonOffer,
    PUBLISH_CAP_LIMIT_KEY
} from '../../../src/lib/billing/addon-cap-offer';

const offer = (over: Record<string, unknown> = {}) => ({
    productId: '11111111-1111-4111-8111-111111111111',
    addonVersionId: '22222222-2222-4222-8222-222222222222',
    slug: 'a',
    name: 'A',
    description: null,
    chargeKind: 'PERIODICO' as const,
    cycle: 'monthly' as const,
    price: 1000,
    currency: 'ARS' as const,
    compatibleVerticals: ['venue'],
    grantedKeys: ['max_venues'],
    scopeType: 'VERTICAL_SUBSCRIPTION' as const,
    validity: 'WHILE_SUBSCRIPTION_ALIVE' as const,
    validityDays: null,
    freeUnderGrantVerticals: [],
    ...over
});

describe('findCapAddonOffer', () => {
    it('returns the offer compatible with the vertical that grants its cap limit key', () => {
        expect(findCapAddonOffer({ offers: [offer()], vertical: 'venue' })).toEqual({
            slug: 'a',
            name: 'A',
            price: 1000,
            currency: 'ARS'
        });
    });

    it('returns null when no offer is compatible with the vertical', () => {
        expect(
            findCapAddonOffer({
                offers: [offer({ compatibleVerticals: ['accommodation'] })],
                vertical: 'venue'
            })
        ).toBeNull();
    });

    it('returns null when the compatible offer grants another limit (photos, not the cap)', () => {
        expect(
            findCapAddonOffer({
                offers: [offer({ grantedKeys: ['max_photos_per_accommodation'] })],
                vertical: 'venue'
            })
        ).toBeNull();
    });

    it('does not mix up the cap keys of two verticals', () => {
        const venueOffer = offer({
            compatibleVerticals: ['venue', 'experience'],
            grantedKeys: ['max_venues']
        });
        expect(findCapAddonOffer({ offers: [venueOffer], vertical: 'experience' })).toBeNull();
    });

    it('leads with the cheapest, and breaks a tie by slug', () => {
        const picked = findCapAddonOffer({
            offers: [
                offer({ slug: 'z', name: 'Z', price: 500 }),
                offer({ slug: 'b', name: 'B', price: 500 }),
                offer({ slug: 'c', name: 'C', price: 900 })
            ],
            vertical: 'venue'
        });
        expect(picked?.slug).toBe('b');
    });

    it('returns null for an empty catalog', () => {
        expect(findCapAddonOffer({ offers: [], vertical: 'accommodation' })).toBeNull();
    });
});

describe('cap constants', () => {
    it('maps each vertical to its catalog cap key', () => {
        expect(PUBLISH_CAP_LIMIT_KEY).toEqual({
            accommodation: 'max_accommodations',
            venue: 'max_venues',
            experience: 'max_experiences'
        });
    });

    it('anchors on the vertical add-ons section of the subscription page', () => {
        expect(
            capAddonHref({ subscriptionUrl: '/es/mi-cuenta/suscripcion/', vertical: 'venue' })
        ).toBe('/es/mi-cuenta/suscripcion/#addons-venue');
    });
});
