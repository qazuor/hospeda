/**
 * @file gastronomy-events-cta.test.ts
 * @description Source-read tests for the "accepts events" CTA (HOS-1055).
 *
 * Same pattern and same caveat as its HOS-1072 sibling
 * (`commerce-amenities-render.test.ts`): Vitest cannot render `.astro` here
 * (no Astro vite plugin in the test pipeline), so these assertions read the
 * comment-stripped SOURCE — accurate for "is this branch declared", blind to
 * "is this branch reached".
 *
 * ## Why the CTA has no external href (design note, not a hedge)
 *
 * A first version of this CTA linked to `socialNetworks.whatsapp`. HOS-1076
 * (merged the same week) found that field never carried real data — it was
 * never part of `SocialNetworkSchema` — and removed it from
 * `GastronomySocialNetworks` entirely: gastronomy has no public phone/WhatsApp
 * channel by design (HOS-1088 tracks the open question). What remains is a
 * handful of owner-optional social links plus a menu URL, and picking "the
 * first one that resolves" would sometimes point an "accepts events" CTA at a
 * restaurant's YouTube channel. So the CTA is an in-page anchor
 * (`#gastro-contact`) to `GastronomyContactBlock` instead: no channel to pick,
 * and no outbound href for the HOS-592/F-02 sanitization guard to apply to.
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
const CONTACT_BLOCK = read('components/gastronomy/GastronomyContactBlock.astro');

describe('gastronomia/[slug].astro — accepts-events CTA (HOS-1055)', () => {
    it('imports the dedicated CTA component', () => {
        expect(GASTRONOMY_PAGE).toContain(
            "import GastronomyEventsCta from '@/components/gastronomy/GastronomyEventsCta.astro'"
        );
    });

    it('never reads socialNetworks.whatsapp (HOS-1076: the field is gone, it never carried real data) or contactInfo', () => {
        expect(GASTRONOMY_PAGE).not.toContain('.whatsapp');
        // `contactInfo` is not part of GastronomyPublicSchema (see
        // GastronomyContactBlock's header) — reaching for it would repeat the
        // HOS-363/HOS-924 bug.
        expect(GASTRONOMY_PAGE).not.toContain('gastronomy.contactInfo');
    });

    it('requires BOTH the private_events amenity and an actual contact channel before showing the CTA', () => {
        expect(GASTRONOMY_PAGE).toContain(
            "gastronomy.amenities.find((amenity) => amenity.name === 'private_events')"
        );
        // Mirrors GastronomyContactBlock's own render gate, duplicated on
        // purpose rather than imported (see the frontmatter comment) — a CTA
        // anchored to an empty contact block would be worse than no CTA.
        expect(GASTRONOMY_PAGE).toContain('resolveSafeExternalUrl(gastronomy.menuUrl)');
        expect(GASTRONOMY_PAGE).toContain(
            'const showEventsCta = Boolean(acceptsEventsAmenity) && hasGastronomyContact;'
        );
    });

    it('excludes the private_events chip from the generic grid ONLY when the CTA renders in its place', () => {
        expect(GASTRONOMY_PAGE).toContain('const amenitiesForGrid = showEventsCta');
        expect(GASTRONOMY_PAGE).toContain(
            "gastronomy.amenities.filter((amenity) => amenity.name !== 'private_events')"
        );
        // The else branch is the un-filtered listing amenities — the chip
        // survives when there is no contact channel to show a CTA with instead.
        expect(GASTRONOMY_PAGE).toContain(': gastronomy.amenities;');
    });

    it('mounts the CTA guarded by showEventsCta, with no href passed in', () => {
        expect(GASTRONOMY_PAGE).toContain(
            '{showEventsCta && <GastronomyEventsCta locale={locale} />}'
        );
    });

    it('mounts the CTA after the amenity grids and before the contact block it anchors into', () => {
        const amenitiesIdx = GASTRONOMY_PAGE.indexOf('<AmenitiesGrid');
        const ctaIdx = GASTRONOMY_PAGE.indexOf('<GastronomyEventsCta');
        const contactIdx = GASTRONOMY_PAGE.indexOf('<GastronomyContactBlock');

        expect(amenitiesIdx).toBeGreaterThan(-1);
        expect(ctaIdx).toBeGreaterThan(amenitiesIdx);
        expect(contactIdx).toBeGreaterThan(ctaIdx);
    });
});

describe('GastronomyEventsCta.astro (HOS-1055)', () => {
    it('is a same-page anchor to the contact block, not an external link', () => {
        expect(EVENTS_CTA).toContain('href="#gastro-contact"');
        // No outbound markers — this is not an outbound link, so the
        // HOS-592/F-02 sanitization guard has nothing to check here.
        expect(EVENTS_CTA).not.toContain('target="_blank"');
        expect(EVENTS_CTA).not.toContain('noopener');
    });

    it('never resolves or accepts an external URL — there is no channel to pick', () => {
        expect(EVENTS_CTA).not.toContain('resolveSafeExternalUrl');
        expect(EVENTS_CTA).not.toContain('readonly href');
    });

    it('renders through the gastronomy.detail.eventsCta i18n namespace, with fallbacks', () => {
        expect(EVENTS_CTA).toContain('gastronomy.detail.eventsCta.title');
        expect(EVENTS_CTA).toContain('gastronomy.detail.eventsCta.description');
        expect(EVENTS_CTA).toContain('gastronomy.detail.eventsCta.button');
    });

    it('does not promise a specific channel (e.g. WhatsApp) that gastronomy cannot deliver', () => {
        expect(EVENTS_CTA.toLowerCase()).not.toContain('whatsapp');
    });
});

describe('GastronomyContactBlock.astro — the CTA anchor target (HOS-1055)', () => {
    it('carries the stable id the events CTA anchors into', () => {
        expect(CONTACT_BLOCK).toContain('id="gastro-contact"');
    });
});
