/**
 * @file profile-page-json-ld.test.ts
 * @description Tests for the `ProfilePage` JSON-LD builder behind
 * `ProfilePageJsonLd.astro` (HOS-375 T-019, spec §6.8).
 *
 * Asserts on the EMITTED object, full profile and minimal profile, with the
 * central invariant being that absent fields are OMITTED rather than emitted as
 * `null` — a `"description": null` is not "no description" to a consumer, it is
 * a malformed one.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildProfilePageJsonLd } from '../../../src/lib/seo/profile-page-json-ld';

const AUTHOR_URL = 'https://hospeda.com.ar/es/autores/equipo-hospeda/';

describe('buildProfilePageJsonLd', () => {
    it('emits every field for a full profile', () => {
        const data = buildProfilePageJsonLd({
            name: 'Equipo Hospeda',
            url: AUTHOR_URL,
            image: 'https://cdn.example.test/equipo-hospeda.jpg',
            description: 'Somos el equipo editorial de Hospeda.',
            sameAs: ['https://instagram.com/hospeda', 'https://x.com/hospeda']
        });

        expect(data).toEqual({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: {
                '@type': 'Person',
                name: 'Equipo Hospeda',
                url: AUTHOR_URL,
                image: 'https://cdn.example.test/equipo-hospeda.jpg',
                description: 'Somos el equipo editorial de Hospeda.',
                sameAs: ['https://instagram.com/hospeda', 'https://x.com/hospeda']
            }
        });
    });

    it('emits only name and url for a minimal profile', () => {
        const data = buildProfilePageJsonLd({ name: 'Laura Vega', url: AUTHOR_URL });

        // toEqual on the whole node, not per-key checks: this is what pins that
        // nothing extra leaked in.
        expect(data).toEqual({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: {
                '@type': 'Person',
                name: 'Laura Vega',
                url: AUTHOR_URL
            }
        });
    });

    it('omits absent optional keys rather than emitting them as null', () => {
        const data = buildProfilePageJsonLd({
            name: 'Laura Vega',
            url: AUTHOR_URL,
            image: null,
            description: null,
            sameAs: null
        });

        // `toEqual` ignores undefined-valued keys, so assert on the real key
        // set — that is where a `"description": null` would show up.
        expect(Object.keys(data.mainEntity).sort()).toEqual(['@type', 'name', 'url']);
        expect(JSON.stringify(data)).not.toContain('null');
    });

    it('treats whitespace-only image and description as absent', () => {
        const data = buildProfilePageJsonLd({
            name: 'Laura Vega',
            url: AUTHOR_URL,
            image: '   ',
            description: '\n\t '
        });

        expect(Object.keys(data.mainEntity).sort()).toEqual(['@type', 'name', 'url']);
    });

    it('drops blank sameAs entries and omits the key when none survive', () => {
        const someBlank = buildProfilePageJsonLd({
            name: 'Laura Vega',
            url: AUTHOR_URL,
            sameAs: ['https://instagram.com/laura', '', null, undefined, '  ']
        });
        const allBlank = buildProfilePageJsonLd({
            name: 'Laura Vega',
            url: AUTHOR_URL,
            sameAs: ['', null, '   ']
        });

        expect(someBlank.mainEntity.sameAs).toEqual(['https://instagram.com/laura']);
        expect(allBlank.mainEntity).not.toHaveProperty('sameAs');
    });

    it('trims surrounding whitespace off the values it does emit', () => {
        const data = buildProfilePageJsonLd({
            name: 'Equipo Hospeda',
            url: AUTHOR_URL,
            image: '  https://cdn.example.test/a.jpg  ',
            description: '  Una bio.  ',
            sameAs: ['  https://instagram.com/hospeda  ']
        });

        expect(data.mainEntity.image).toBe('https://cdn.example.test/a.jpg');
        expect(data.mainEntity.description).toBe('Una bio.');
        expect(data.mainEntity.sameAs).toEqual(['https://instagram.com/hospeda']);
    });
});

describe('ProfilePageJsonLd.astro', () => {
    const src = readFileSync(
        resolve(__dirname, '../../../src/components/seo/ProfilePageJsonLd.astro'),
        'utf8'
    );

    /**
     * The markup half only — everything after the frontmatter fence. The
     * invariant is about what the component RENDERS, and the frontmatter
     * docblock legitimately names the tag it is telling you not to write.
     */
    const template = src.slice(src.lastIndexOf('\n---') + '\n---'.length);

    it('delegates to the shared JsonLd wrapper instead of hand-rolling the script tag', () => {
        // The escaping that prevents `</script>` injection lives in JsonLd.astro
        // and must stay the single canonical path (SPEC-157 D-1).
        expect(src).toContain("import JsonLd from '@/components/seo/JsonLd.astro'");
        expect(template).toContain('<JsonLd data={data} />');
        expect(template).not.toContain('<script');
    });

    it('builds its node with the tested helper rather than inline', () => {
        expect(src).toContain("from '@/lib/seo/profile-page-json-ld'");
        expect(src).toContain('buildProfilePageJsonLd(');
    });
});
