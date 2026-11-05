/**
 * @file venue-jsonld.test.ts
 * @description Unit tests for the venue JSON-LD builder (HOS-1787 leaf 6.1).
 *
 * Covers the exhaustive `@type` mapping (TEST:6.1:1) and AC:6:5: a BOLICHE is
 * a `NightClub` and never carries `hasMenu` when the public payload has no
 * available menu content (TEST:6.1:2).
 */

import { VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildVenueStructuredData,
    resolveVenueSchemaType,
    VENUE_SCHEMA_ORG_TYPE
} from '../../../src/lib/seo/venue-jsonld';
import { buildRestaurantHasMenu } from '../../../src/lib/venue/menu-jsonld';

const SITE_ORIGIN = 'https://hospeda.example';

describe('VENUE_SCHEMA_ORG_TYPE / resolveVenueSchemaType (TEST:6.1:1)', () => {
    it('maps every venue type to its schema.org subtype', () => {
        const expected: Record<VenueTypeEnum, string> = {
            [VenueTypeEnum.RESTAURANT]: 'Restaurant',
            [VenueTypeEnum.BAR]: 'BarOrPub',
            [VenueTypeEnum.CAFE]: 'CafeOrCoffeeShop',
            [VenueTypeEnum.PARRILLA]: 'Restaurant',
            [VenueTypeEnum.CERVECERIA]: 'BarOrPub',
            [VenueTypeEnum.HELADERIA]: 'IceCreamShop',
            [VenueTypeEnum.PANADERIA]: 'Bakery',
            [VenueTypeEnum.ROTISERIA]: 'Restaurant',
            [VenueTypeEnum.FOOD_TRUCK]: 'Restaurant',
            [VenueTypeEnum.PUB]: 'BarOrPub',
            [VenueTypeEnum.BOLICHE]: 'NightClub'
        };

        const actual = Object.fromEntries(
            Object.values(VenueTypeEnum).map((type) => [type, resolveVenueSchemaType({ type })])
        );

        expect(actual).toEqual(expected);
        expect(Object.keys(VENUE_SCHEMA_ORG_TYPE)).toHaveLength(
            Object.values(VenueTypeEnum).length
        );
    });

    it('falls back to Restaurant for a value outside the enum', () => {
        expect(resolveVenueSchemaType({ type: 'NOT_A_VENUE_TYPE' })).toBe('Restaurant');
        expect(resolveVenueSchemaType({ type: '' })).toBe('Restaurant');
    });
});

describe('buildVenueStructuredData (TEST:6.1:2 / AC:6:5)', () => {
    const base = { slug: 'el-boliche' };
    const jsonLdOptions = { locale: 'es' as const, siteOrigin: SITE_ORIGIN };

    it('emits a NightClub without hasMenu for a BOLICHE whose menu is not available', () => {
        // The public projector removes `menuSections`, `menuFileUrl` and
        // `menuUrl` when the section is not `available`; this is that payload.
        const projectedVenue = { ...base };
        const hasMenu = buildRestaurantHasMenu({ ...jsonLdOptions, venue: projectedVenue });

        const data = buildVenueStructuredData({
            name: 'El Boliche',
            description: 'Boliche de la noche entrerriana.',
            url: 'https://hospeda.example/es/comer-y-salir/el-boliche/',
            type: VenueTypeEnum.BOLICHE,
            hasMenu
        });

        expect(data['@type']).toBe('NightClub');
        expect('hasMenu' in data).toBe(false);
    });

    it('emits Restaurant and the carta URL for a RESTAURANT with structured menu content', () => {
        const hasMenu = buildRestaurantHasMenu({
            ...jsonLdOptions,
            venue: { slug: 'la-parrilla', menuSections: [{}] }
        });

        const data = buildVenueStructuredData({
            name: 'La Parrilla',
            description: 'Parrilla clásica.',
            url: 'https://hospeda.example/es/comer-y-salir/la-parrilla/',
            type: VenueTypeEnum.RESTAURANT,
            hasMenu
        });

        expect(data['@type']).toBe('Restaurant');
        expect(data.hasMenu).toBe('https://hospeda.example/es/comer-y-salir/la-parrilla/carta/');
    });

    it('emits BarOrPub and the external link for a BAR whose only menu content is menuUrl', () => {
        const hasMenu = buildRestaurantHasMenu({
            ...jsonLdOptions,
            venue: { slug: 'el-bar', menuUrl: 'https://bar.example/carta' }
        });

        const data = buildVenueStructuredData({
            name: 'El Bar',
            description: 'Bar de copas.',
            url: 'https://hospeda.example/es/comer-y-salir/el-bar/',
            type: VenueTypeEnum.BAR,
            hasMenu
        });

        expect(data['@type']).toBe('BarOrPub');
        expect(data.hasMenu).toBe('https://bar.example/carta');
    });

    it('omits hasMenu instead of emitting null or an empty string', () => {
        const data = buildVenueStructuredData({
            name: 'Sin carta',
            description: 'Sin contenido de carta.',
            url: 'https://hospeda.example/es/comer-y-salir/sin-carta/',
            type: VenueTypeEnum.RESTAURANT,
            hasMenu: undefined
        });

        expect('hasMenu' in data).toBe(false);
    });
});
