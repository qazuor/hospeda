/**
 * @file gastronomy-events-cta.test.ts
 * @description Source-read tests for the "accepts events" CTA (HOS-1055).
 *
 * Same pattern and same caveat as its HOS-1072 sibling
 * (`commerce-amenities-render.test.ts`): Vitest cannot render `.astro` here
 * (no Astro vite plugin in the test pipeline), so these assertions read the
 * comment-stripped SOURCE — accurate for "is this branch declared", blind to
 * "is this branch reached". The behaviour that actually branches at runtime —
 * `resolveSafeExternalUrl`'s scheme allow-list — is pinned separately in
 * `apps/web/test/lib/safe-external-url.test.ts` (mutation-verified); this
 * file only has to prove the page WIRES that primitive in, and does not
 * re-derive the "no private_events column" decision documented in
 * `apps/web/test/components/commerce/editor/AmenitiesSection.test.tsx`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Strips comments so an assertion reads MARKUP, not the prose about it. */
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
const EVENTS_CTA = read('components/gastronomy/GastronomyEventsCta.astro');

describe('gastronomia/[slug].astro — accepts-events CTA (HOS-1055)', () => {
    it('imports the dedicated CTA component and the safe-URL resolver', () => {
        expect(GASTRONOMY_PAGE).toContain(
            "import GastronomyEventsCta from '@/components/gastronomy/GastronomyEventsCta.astro'"
        );
        expect(GASTRONOMY_PAGE).toContain(
            "import { resolveSafeExternalUrl } from '@/lib/safe-external-url'"
        );
    });

    it('resolves the CTA link from socialNetworks.whatsapp — the same public channel GastronomyContactBlock uses, never contactInfo', () => {
        expect(GASTRONOMY_PAGE).toContain(
            'resolveSafeExternalUrl(gastronomy.socialNetworks?.whatsapp)'
        );
        // No `gastronomy.contactInfo` access anywhere on the page: that field
        // is not part of GastronomyPublicSchema (see GastronomyContactBlock's
        // header) — reaching for it would repeat the HOS-363/HOS-924 bug.
        expect(GASTRONOMY_PAGE).not.toContain('gastronomy.contactInfo');
    });

    it('requires BOTH the private_events amenity and a resolvable link before showing the CTA', () => {
        expect(GASTRONOMY_PAGE).toContain(
            "gastronomy.amenities.find((amenity) => amenity.name === 'private_events')"
        );
        expect(GASTRONOMY_PAGE).toContain(
            'const showEventsCta = Boolean(acceptsEventsAmenity) && Boolean(eventsCtaHref);'
        );
    });

    it('excludes the private_events chip from the generic grid ONLY when the CTA renders in its place', () => {
        expect(GASTRONOMY_PAGE).toContain('const amenitiesForGrid = showEventsCta');
        expect(GASTRONOMY_PAGE).toContain(
            "gastronomy.amenities.filter((amenity) => amenity.name !== 'private_events')"
        );
        // The else branch is the un-filtered listing amenities — the chip
        // survives when there is no link to show a CTA with instead of it.
        expect(GASTRONOMY_PAGE).toContain(': gastronomy.amenities;');
    });

    it('mounts the CTA guarded by showEventsCta, passing the resolved href', () => {
        expect(GASTRONOMY_PAGE).toContain('{showEventsCta && eventsCtaHref && (');
        expect(GASTRONOMY_PAGE).toContain(
            '<GastronomyEventsCta href={eventsCtaHref} locale={locale} />'
        );
    });

    it('mounts the CTA after the amenity grids and before the contact block', () => {
        const amenitiesIdx = GASTRONOMY_PAGE.indexOf('<AmenitiesGrid');
        const ctaIdx = GASTRONOMY_PAGE.indexOf('<GastronomyEventsCta');
        const contactIdx = GASTRONOMY_PAGE.indexOf('<GastronomyContactBlock');

        expect(amenitiesIdx).toBeGreaterThan(-1);
        expect(ctaIdx).toBeGreaterThan(amenitiesIdx);
        expect(contactIdx).toBeGreaterThan(ctaIdx);
    });
});

describe('GastronomyEventsCta.astro (HOS-1055)', () => {
    it('links the button to the href prop, opened in a new tab safely', () => {
        expect(EVENTS_CTA).toContain('href={href}');
        expect(EVENTS_CTA).toContain('target="_blank"');
        expect(EVENTS_CTA).toContain('rel="noopener noreferrer"');
    });

    it('renders through the gastronomy.detail.eventsCta i18n namespace, with fallbacks', () => {
        expect(EVENTS_CTA).toContain('gastronomy.detail.eventsCta.title');
        expect(EVENTS_CTA).toContain('gastronomy.detail.eventsCta.description');
        expect(EVENTS_CTA).toContain('gastronomy.detail.eventsCta.button');
    });

    it('does not re-validate the href — the page is the single resolver (no double scheme-check drift)', () => {
        expect(EVENTS_CTA).not.toContain('resolveSafeExternalUrl');
    });
});
