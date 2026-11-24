/**
 * The one declarative map of Mi Cuenta pages the notices link to (HOS-2565 §7.5).
 */
import { describe, expect, it } from 'vitest';
import {
    ACCOUNT_LISTINGS_PATH,
    isListingNoticeVertical,
    resolveAccountListingsUrl,
    SUBSCRIPTION_PATH
} from '../../../src/services/outbox/account-listing-paths';

describe('account listing paths', () => {
    it.each([
        ['accommodation', 'https://hospeda.com.ar/es/mi-cuenta/propiedades/'],
        ['venue', 'https://hospeda.com.ar/es/mi-cuenta/comercio/'],
        ['experience', 'https://hospeda.com.ar/es/mi-cuenta/comercio/']
    ] as const)('links the %s listing page', (vertical, url) => {
        expect(resolveAccountListingsUrl({ siteUrl: 'https://hospeda.com.ar', vertical })).toBe(
            url
        );
    });

    it('accepts a site URL with a trailing slash', () => {
        expect(
            resolveAccountListingsUrl({
                siteUrl: 'https://staging.hospeda.com.ar/',
                vertical: 'venue'
            })
        ).toBe('https://staging.hospeda.com.ar/es/mi-cuenta/comercio/');
    });

    it('recognizes exactly the verticals of the map, and no inherited key', () => {
        expect(Object.keys(ACCOUNT_LISTINGS_PATH).sort()).toEqual([
            'accommodation',
            'experience',
            'venue'
        ]);
        expect(isListingNoticeVertical('venue')).toBe(true);
        expect(isListingNoticeVertical('tourist')).toBe(false);
        expect(isListingNoticeVertical('constructor')).toBe(false);
        expect(isListingNoticeVertical(undefined)).toBe(false);
    });

    it('keeps the subscription page path in one place', () => {
        expect(SUBSCRIPTION_PATH).toBe('/es/mi-cuenta/suscripcion/');
    });
});
