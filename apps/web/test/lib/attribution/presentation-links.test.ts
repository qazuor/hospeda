/**
 * @file presentation-links.test.ts
 * @description HOS-2359 §6.D.2 (OD-5): the `/go/<slug>` short links that hand out
 * the commercial presentations with campaign UTMs. 6 presentations x 5 channels.
 */
import { PRESENTATION_AUDIENCES } from '@repo/analytics';
import { describe, expect, it } from 'vitest';
import {
    buildPresentationShortLinkResponse,
    buildPresentationShortUrl,
    PRESENTATION_CHANNELS,
    PRESENTATION_SHORT_LINKS,
    PRESENTATIONS,
    resolvePresentationShortLink
} from '../../../src/lib/attribution/presentation-links';

/** Every slug, its audience and its channel, written out by hand (AC-17). */
const EXPECTED: readonly (readonly [string, string, string])[] = [
    ['aloj-wa', 'alojamientos', 'whatsapp'],
    ['aloj-fb', 'alojamientos', 'facebook'],
    ['aloj-x', 'alojamientos', 'x'],
    ['aloj-tg', 'alojamientos', 'telegram'],
    ['aloj-link', 'alojamientos', 'copy'],
    ['comer-wa', 'comer-y-salir', 'whatsapp'],
    ['comer-fb', 'comer-y-salir', 'facebook'],
    ['comer-x', 'comer-y-salir', 'x'],
    ['comer-tg', 'comer-y-salir', 'telegram'],
    ['comer-link', 'comer-y-salir', 'copy'],
    ['exp-wa', 'experiencias', 'whatsapp'],
    ['exp-fb', 'experiencias', 'facebook'],
    ['exp-x', 'experiencias', 'x'],
    ['exp-tg', 'experiencias', 'telegram'],
    ['exp-link', 'experiencias', 'copy'],
    ['prov-wa', 'proveedores', 'whatsapp'],
    ['prov-fb', 'proveedores', 'facebook'],
    ['prov-x', 'proveedores', 'x'],
    ['prov-tg', 'proveedores', 'telegram'],
    ['prov-link', 'proveedores', 'copy'],
    ['aliados-wa', 'aliados', 'whatsapp'],
    ['aliados-fb', 'aliados', 'facebook'],
    ['aliados-x', 'aliados', 'x'],
    ['aliados-tg', 'aliados', 'telegram'],
    ['aliados-link', 'aliados', 'copy'],
    ['edit-wa', 'editores', 'whatsapp'],
    ['edit-fb', 'editores', 'facebook'],
    ['edit-x', 'editores', 'x'],
    ['edit-tg', 'editores', 'telegram'],
    ['edit-link', 'editores', 'copy']
];

describe('PRESENTATION_SHORT_LINKS', () => {
    it('is the full product of 6 presentations x 5 channels, with unique slugs', () => {
        // Assert
        expect(PRESENTATION_CHANNELS).toEqual(['whatsapp', 'facebook', 'x', 'telegram', 'copy']);
        expect(PRESENTATION_SHORT_LINKS).toHaveLength(30);
        expect(new Set(PRESENTATION_SHORT_LINKS.map((link) => link.slug)).size).toBe(30);
        expect(
            PRESENTATION_SHORT_LINKS.map((link) => [link.slug, link.audience, link.channel])
        ).toEqual(expect.arrayContaining(EXPECTED.map((row) => [...row])));
    });

    it('covers every presentation listed on the index, and only those', () => {
        expect(PRESENTATIONS.map((entry) => entry.slug).sort()).toEqual(
            [...PRESENTATION_AUDIENCES].sort()
        );
    });
});

describe('resolvePresentationShortLink', () => {
    it.each(
        EXPECTED
    )('%s resolves to the %s presentation tagged source=%s', (slug, audience, channel) => {
        // Act
        const location = resolvePresentationShortLink({ slug });

        // Assert
        expect(location).toBe(
            `/es/presentacion/${audience}/?utm_source=${channel}&utm_medium=direct-outreach&utm_campaign=presentacion-${audience}`
        );
    });

    it.each([
        '',
        'aloj',
        'aloj-ig',
        'ALOJ-WA',
        'alojamientos-wa',
        '../aloj-wa',
        'aloj-wa/'
    ])('answers null for the unknown slug %j', (slug) => {
        expect(resolvePresentationShortLink({ slug })).toBeNull();
    });
});

describe('buildPresentationShortUrl', () => {
    it('builds the absolute short URL on the site origin, with a trailing slash', () => {
        expect(
            buildPresentationShortUrl({ siteUrl: 'https://hospeda.com.ar/', slug: 'aloj-link' })
        ).toBe('https://hospeda.com.ar/go/aloj-link/');
        expect(
            buildPresentationShortUrl({
                siteUrl: 'https://staging.hospeda.com.ar',
                slug: 'edit-wa'
            })
        ).toBe('https://staging.hospeda.com.ar/go/edit-wa/');
    });
});

describe('buildPresentationShortLinkResponse (the /go/<slug>/ route)', () => {
    it('answers 302 to the presentation with UTMs and Cache-Control: no-store', () => {
        // Arrange: the page's own headers (the cache demotion) must survive.
        const baseHeaders = new Headers({ 'Cache-Control': 'private, no-cache', 'X-Keep': '1' });

        // Act
        const response = buildPresentationShortLinkResponse({ slug: 'aloj-wa', baseHeaders });

        // Assert
        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(
            '/es/presentacion/alojamientos/?utm_source=whatsapp&utm_medium=direct-outreach&utm_campaign=presentacion-alojamientos'
        );
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('x-keep')).toBe('1');
    });

    it('answers a bare 404 for an unknown slug, so the middleware renders the site 404 page', () => {
        const response = buildPresentationShortLinkResponse({
            slug: 'nope',
            baseHeaders: new Headers()
        });

        expect(response.status).toBe(404);
        expect(response.headers.get('location')).toBeNull();
    });
});
