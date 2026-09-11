/**
 * @file commerce-amenities-render.test.ts
 * @description HOS-1072 — the two commerce detail surfaces actually MOUNT the
 * amenity/feature grids, and the two vertical presentation pages say the owner
 * can publish them.
 *
 * ## What this suite can and cannot prove
 *
 * Vitest cannot render `.astro` in this repo (no Astro vite plugin in the test
 * pipeline), so these assertions read the SOURCE — the documented pattern here,
 * with its documented blind spot: a source test cannot tell a branch that is
 * DECLARED from one that is REACHED.
 *
 * The blind spot is narrow for this change, and deliberately so. The behaviour
 * that has real branching — what the grid receives, and what it does with a
 * missing slug or a stray `additionalCost` — is pinned where it executes, in
 * `test/lib/api/transforms-commerce-catalog.test.ts` (mutation-verified), and
 * the wire contract is pinned in `packages/schemas/src/common/__tests__/
 * commerce-catalog.schema.test.ts`. What is left for this file is the one thing
 * neither of those can see and the one that was actually missing before
 * HOS-1072: whether any component is mounted at all, and whether it is bound to
 * the listing's OWN amenities. Every assertion below reads comment-stripped
 * markup, so the docstrings that explain the mount cannot stand in for it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Strips comments so an assertion reads MARKUP, not the prose about it.
 *
 * Line comments go FIRST: a `//` comment mentioning a path glob like `/es/*`
 * ends in what a block-comment regex reads as an opening delimiter, which then
 * swallows the rest of the file and leaves a source that "contains" nothing.
 * HTML comments are stripped last because the `.astro` markup half uses them
 * to explain each mount, and one of those explanations names the component.
 */
function withoutComments(source: string): string {
    return source
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '');
}

const read = (relativePath: string): string =>
    withoutComments(readFileSync(resolve(__dirname, '../../src', relativePath), 'utf8'));

const GASTRONOMY_PAGE = read('pages/[lang]/gastronomia/[slug].astro');
const EXPERIENCE_INFO = read('components/experience/ExperienceInfo.astro');
const GASTRONOMY_PRESENTATION = read('pages/[lang]/presentacion/gastronomia/index.astro');
const EXPERIENCE_PRESENTATION = read('pages/[lang]/presentacion/experiencias/index.astro');

describe('gastronomia/[slug].astro — mounts the catalog grids (HOS-1072)', () => {
    it('imports the shared grids instead of declaring commerce copies', () => {
        expect(GASTRONOMY_PRESENTATION).not.toContain('AmenitiesGrid');
        expect(GASTRONOMY_PAGE).toContain(
            "import AmenitiesGrid from '@/components/accommodation/AmenitiesGrid.astro'"
        );
        expect(GASTRONOMY_PAGE).toContain(
            "import FeaturesGrid from '@/components/accommodation/FeaturesGrid.astro'"
        );
    });

    it("binds AmenitiesGrid to the LISTING's own amenities", () => {
        // HOS-1055: `amenitiesForGrid` is `gastronomy.amenities` with
        // `private_events` excluded ONLY when the dedicated events CTA renders
        // in its place (see `apps/web/test/pages/gastronomy-events-cta.test.ts`)
        // — still the listing's own amenities, not a different source.
        expect(GASTRONOMY_PAGE).toContain(
            '<AmenitiesGrid amenities={amenitiesForGrid} lang={locale} />'
        );
    });

    it("binds FeaturesGrid to the listing's features, with no accommodation-only smoking flag", () => {
        expect(GASTRONOMY_PAGE).toContain(
            '<FeaturesGrid features={gastronomy.features} smokingAllowed={null} lang={locale} />'
        );
    });
});

describe('ExperienceInfo.astro — keeps the promise its own JSDoc made (HOS-1072)', () => {
    it('mounts both grids, which the file previously only claimed to', () => {
        expect(EXPERIENCE_INFO).toContain(
            '<AmenitiesGrid amenities={experience.amenities} lang={locale} />'
        );
        expect(EXPERIENCE_INFO).toContain(
            '<FeaturesGrid features={experience.features} smokingAllowed={null} lang={locale} />'
        );
    });

    it('imports the shared grids rather than duplicating them for experiences', () => {
        expect(EXPERIENCE_INFO).toContain(
            "import AmenitiesGrid from '@/components/accommodation/AmenitiesGrid.astro'"
        );
        expect(EXPERIENCE_INFO).toContain(
            "import FeaturesGrid from '@/components/accommodation/FeaturesGrid.astro'"
        );
    });

    it('no longer claims to render contact info, which ExperienceContactBlock owns', () => {
        // The docstring is the subject here, so this one assertion reads the
        // RAW file — the stripper would remove exactly what is under test.
        const raw = readFileSync(
            resolve(__dirname, '../../src/components/experience/ExperienceInfo.astro'),
            'utf8'
        );
        const header = raw.slice(0, raw.indexOf('*/'));
        expect(header).toContain('amenities/features');
        expect(header).not.toContain('and contact info');
    });
});

describe('vertical presentation pages — the third surface (HOS-1071 rule)', () => {
    it('gastronomia tells the owner the venue traits are publishable', () => {
        expect(GASTRONOMY_PRESENTATION).toContain('Lo que ofrece el local');
        expect(GASTRONOMY_PRESENTATION).toContain('delivery o take away');
    });

    it('gastronomia lists those traits among what the owner edits alone', () => {
        expect(GASTRONOMY_PRESENTATION).toContain(
            'lo que ofrece el local, contacto y redes</td><td><strong>Vos, cuando quieras</strong>'
        );
    });

    it('experiencias tells the provider that "qué incluye" is publishable', () => {
        expect(EXPERIENCE_PRESENTATION).toContain('Qué incluye');
        expect(EXPERIENCE_PRESENTATION).toContain('transporte, guía, comida, equipo, seguro');
    });

    it('experiencias lists it among what the provider edits alone', () => {
        expect(EXPERIENCE_PRESENTATION).toContain(
            'qué incluye, contacto y redes</td><td><strong>Vos, cuando quieras</strong>'
        );
    });
});
