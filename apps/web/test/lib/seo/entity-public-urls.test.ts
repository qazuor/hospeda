/**
 * @file entity-public-urls.test.ts
 * @description Tests for the canonical entity → public URL map (HOS-585 G-1).
 *
 * The map's whole reason to exist is that the sitemap and the IndexNow emitter
 * must describe the SAME site. So besides the ordinary behavior tests there is
 * an anti-drift guard asserting the sitemap actually consumes this module —
 * without it, someone re-inlining a path template would reintroduce the second
 * copy and every test here would still pass.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildEntityLocaleUrls,
    ENTITY_PUBLIC_PATHS,
    isNotifiableEntityType,
    NOTIFIABLE_ENTITY_TYPES
} from '../../../src/lib/seo/entity-public-urls';

const SITE = 'https://hospeda.com.ar';

describe('NOTIFIABLE_ENTITY_TYPES', () => {
    it('covers exactly the four entity types with a detail page', () => {
        expect([...NOTIFIABLE_ENTITY_TYPES]).toEqual([
            'accommodation',
            'destination',
            'event',
            'post'
        ]);
    });

    it('has a path builder for every declared type, and no extras', () => {
        expect(Object.keys(ENTITY_PUBLIC_PATHS).sort()).toEqual(
            [...NOTIFIABLE_ENTITY_TYPES].sort()
        );
    });
});

describe('isNotifiableEntityType', () => {
    it.each([...NOTIFIABLE_ENTITY_TYPES])('accepts %s', (type) => {
        expect(isNotifiableEntityType(type)).toBe(true);
    });

    /**
     * Reviews change their PARENT's page and tags/amenities have no page at
     * all. They are real members of the revalidation event union, so letting
     * one through here would build a URL that 404s and earn a protocol
     * rejection.
     */
    it.each([
        'accommodation_review',
        'destination_review',
        'tag',
        'amenity'
    ])('rejects %s, which has no page of its own', (type) => {
        expect(isNotifiableEntityType(type)).toBe(false);
    });

    it.each([undefined, null, 42, {}, '', 'Accommodation'])('rejects %p', (value) => {
        expect(isNotifiableEntityType(value)).toBe(false);
    });
});

describe('buildEntityLocaleUrls', () => {
    it('returns one absolute URL per locale, in es/en/pt order', () => {
        const urls = buildEntityLocaleUrls({
            entityType: 'accommodation',
            slug: 'hotel-x',
            siteUrl: SITE
        });

        expect(urls).toEqual([
            `${SITE}/es/alojamientos/hotel-x/`,
            `${SITE}/en/alojamientos/hotel-x/`,
            `${SITE}/pt/alojamientos/hotel-x/`
        ]);
    });

    /**
     * The site serves Spanish path segments in every locale. An emitter that
     * "helpfully" translated them would submit URLs that 404.
     */
    it('keeps the Spanish segment in the English and Portuguese URLs', () => {
        const urls = buildEntityLocaleUrls({
            entityType: 'post',
            slug: 'guia',
            siteUrl: SITE
        });

        for (const url of urls) {
            expect(url).toContain('/publicaciones/');
        }
        expect(urls.join(' ')).not.toContain('/posts/');
    });

    it.each([
        ['accommodation', 'alojamientos'],
        ['destination', 'destinos'],
        ['event', 'eventos'],
        ['post', 'publicaciones']
    ] as const)('maps %s to /%s/', (entityType, segment) => {
        const [first] = buildEntityLocaleUrls({ entityType, slug: 's', siteUrl: SITE });

        expect(first).toBe(`${SITE}/es/${segment}/s/`);
    });

    it('tolerates a trailing slash on the site URL without doubling it', () => {
        const urls = buildEntityLocaleUrls({
            entityType: 'event',
            slug: 'fiesta',
            siteUrl: `${SITE}/`
        });

        expect(urls[0]).toBe(`${SITE}/es/eventos/fiesta/`);
        for (const url of urls) {
            expect(url).not.toContain('//es/');
        }
    });

    it('ends every URL with a trailing slash, matching the site canonical', () => {
        const urls = buildEntityLocaleUrls({
            entityType: 'destination',
            slug: 'colon',
            siteUrl: SITE
        });

        for (const url of urls) {
            expect(url.endsWith('/')).toBe(true);
        }
    });
});

describe('anti-drift: the sitemap consumes this map', () => {
    const sitemapSrc = readFileSync(
        resolve(__dirname, '../../../src/pages/sitemap-dynamic.xml.ts'),
        'utf8'
    );

    it('imports ENTITY_PUBLIC_PATHS', () => {
        expect(sitemapSrc).toContain('ENTITY_PUBLIC_PATHS');
    });

    /**
     * The actual guard. If any of the four detail-page paths is re-inlined as a
     * template literal, the sitemap and the emitter can disagree again — which
     * is exactly the failure this module was created to prevent, and it would
     * otherwise fail silently.
     */
    it.each([
        'alojamientos',
        'destinos',
        'eventos',
        'publicaciones'
    ])('does not re-inline the /%s/{slug}/ detail path', (segment) => {
        expect(sitemapSrc).not.toContain(`\`/${segment}/\${slug}/\``);
    });
});
