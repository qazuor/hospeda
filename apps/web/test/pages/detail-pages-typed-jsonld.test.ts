/**
 * @file detail-pages-typed-jsonld.test.ts
 * @description Source-based tests asserting that the four entity detail pages
 * import and use their typed JSON-LD components instead of building inline
 * JSON-LD objects and passing them to the generic JsonLd.astro.
 *
 * SPEC-157 REQ-7: adopt the 4 typed JSON-LD components.
 *
 * Strategy: .astro cannot be rendered in Vitest — we assert on source text,
 * consistent with the project-wide convention (see apps/web/CLAUDE.md and
 * existing tests like homepage-jsonld.test.ts).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_BASE = resolve(__dirname, '../../src/pages/[lang]');
const SEO_BASE = resolve(__dirname, '../../src/components/seo');

const alojamientoSrc = readFileSync(resolve(PAGES_BASE, 'alojamientos/[slug].astro'), 'utf8');
const publicacionesSrc = readFileSync(resolve(PAGES_BASE, 'publicaciones/[slug].astro'), 'utf8');
const eventosSrc = readFileSync(resolve(PAGES_BASE, 'eventos/[slug].astro'), 'utf8');
const destinosSrc = readFileSync(resolve(PAGES_BASE, 'destinos/[...path].astro'), 'utf8');

const lodgingComponentSrc = readFileSync(resolve(SEO_BASE, 'LodgingBusinessJsonLd.astro'), 'utf8');
const articleComponentSrc = readFileSync(resolve(SEO_BASE, 'ArticleJsonLd.astro'), 'utf8');
const eventComponentSrc = readFileSync(resolve(SEO_BASE, 'EventJsonLd.astro'), 'utf8');
const placeComponentSrc = readFileSync(resolve(SEO_BASE, 'PlaceJsonLd.astro'), 'utf8');

// ---------------------------------------------------------------------------
// alojamientos/[slug].astro — LodgingBusinessJsonLd
// ---------------------------------------------------------------------------
describe('alojamientos/[slug].astro — typed JSON-LD (SPEC-157 REQ-7)', () => {
    it('imports LodgingBusinessJsonLd', () => {
        expect(alojamientoSrc).toMatch(
            /import LodgingBusinessJsonLd from ['"]@\/components\/seo\/LodgingBusinessJsonLd\.astro['"]/
        );
    });

    it('mounts <LodgingBusinessJsonLd /> in the head-extra slot', () => {
        // Accept either self-closing or open+close form
        expect(alojamientoSrc).toMatch(/<LodgingBusinessJsonLd\b/);
    });

    it('does NOT build an inline LodgingBusiness JSON-LD object', () => {
        // The inline pattern built the schema with a raw '@type': 'LodgingBusiness' (or
        // Hotel/Hostel/etc.) literal inside a jsonLd object. After migration the typed
        // component is responsible for that, so the literal must be gone.
        expect(alojamientoSrc).not.toContain("'@type': schemaType");
        expect(alojamientoSrc).not.toContain("'@type': 'LodgingBusiness'");
        expect(alojamientoSrc).not.toContain('"@type": "LodgingBusiness"');
    });

    it('no longer passes inline jsonLd to the generic JsonLd component for lodging', () => {
        // The page should no longer define a const jsonLd containing '@context': 'https://schema.org'
        // for a LodgingBusiness schema (the BreadcrumbJsonLd/FAQPageJsonLd are fine).
        // We detect the removal by checking that schemaType variable is gone.
        expect(alojamientoSrc).not.toContain('schemaType');
    });
});

// ---------------------------------------------------------------------------
// publicaciones/[slug].astro — ArticleJsonLd
// ---------------------------------------------------------------------------
describe('publicaciones/[slug].astro — typed JSON-LD (SPEC-157 REQ-7)', () => {
    it('imports ArticleJsonLd', () => {
        expect(publicacionesSrc).toMatch(
            /import ArticleJsonLd from ['"]@\/components\/seo\/ArticleJsonLd\.astro['"]/
        );
    });

    it('mounts <ArticleJsonLd /> in the head-extra slot', () => {
        expect(publicacionesSrc).toMatch(/<ArticleJsonLd\b/);
    });

    it('does NOT build an inline BlogPosting / Article JSON-LD object', () => {
        // After migration the inline `const jsonLd = { '@context': ..., '@type': 'BlogPosting' }` must be gone.
        expect(publicacionesSrc).not.toContain("'@type': 'BlogPosting'");
        expect(publicacionesSrc).not.toContain('"@type": "BlogPosting"');
    });
});

// ---------------------------------------------------------------------------
// eventos/[slug].astro — EventJsonLd
// ---------------------------------------------------------------------------
describe('eventos/[slug].astro — typed JSON-LD (SPEC-157 REQ-7)', () => {
    it('imports EventJsonLd', () => {
        expect(eventosSrc).toMatch(
            /import EventJsonLd from ['"]@\/components\/seo\/EventJsonLd\.astro['"]/
        );
    });

    it('mounts <EventJsonLd /> in the head-extra slot', () => {
        expect(eventosSrc).toMatch(/<EventJsonLd\b/);
    });

    it('does NOT build an inline Event JSON-LD object', () => {
        // The inline pattern used `'@type': 'Event'` inside a jsonLd const.
        // After migration, the typed component owns that, so the literal must be gone.
        expect(eventosSrc).not.toContain("'@type': 'Event'");
        expect(eventosSrc).not.toContain('"@type": "Event"');
    });
});

// ---------------------------------------------------------------------------
// destinos/[...path].astro — PlaceJsonLd
// ---------------------------------------------------------------------------
describe('destinos/[...path].astro — typed JSON-LD (SPEC-157 REQ-7)', () => {
    it('imports PlaceJsonLd', () => {
        expect(destinosSrc).toMatch(
            /import PlaceJsonLd from ['"]@\/components\/seo\/PlaceJsonLd\.astro['"]/
        );
    });

    it('mounts <PlaceJsonLd /> in the head-extra slot', () => {
        expect(destinosSrc).toMatch(/<PlaceJsonLd\b/);
    });

    it('does NOT build an inline TouristDestination JSON-LD object', () => {
        // The inline const jsonLd used '@type': 'TouristDestination'.
        // After migration this must be gone.
        expect(destinosSrc).not.toContain("'@type': 'TouristDestination'");
        expect(destinosSrc).not.toContain('"@type": "TouristDestination"');
    });
});

// ---------------------------------------------------------------------------
// LodgingBusinessJsonLd.astro — schema parity: geo + aggregateRating + numberOfRooms + accommodationType
// ---------------------------------------------------------------------------
describe('LodgingBusinessJsonLd.astro — schema parity fields (SPEC-157 REQ-7)', () => {
    it('emits the correct @type value', () => {
        expect(lodgingComponentSrc).toContain("'@type'");
    });

    it('accepts and emits geo coordinates when provided', () => {
        // Must handle optional geo prop
        expect(lodgingComponentSrc).toContain('geo');
        expect(lodgingComponentSrc).toContain('GeoCoordinates');
    });

    it('accepts and emits aggregateRating when provided', () => {
        expect(lodgingComponentSrc).toContain('aggregateRating');
        expect(lodgingComponentSrc).toContain('AggregateRating');
    });

    it('accepts and emits numberOfRooms when provided', () => {
        expect(lodgingComponentSrc).toContain('numberOfRooms');
    });

    it('accepts a custom accommodationType prop to set the @type dynamically', () => {
        // The inline page used TYPE_MAP to emit Hotel, Hostel, etc.
        expect(lodgingComponentSrc).toContain('accommodationType');
    });
});

// ---------------------------------------------------------------------------
// ArticleJsonLd.astro — TLD fix + BlogPosting subtype
// ---------------------------------------------------------------------------
describe('ArticleJsonLd.astro — TLD fix (SPEC-157 REQ-7)', () => {
    it('publisher URL contains hospeda.com.ar and NOT bare hospeda.com/', () => {
        // The bug: publisher.url was 'https://hospeda.com' (missing .ar TLD).
        // Fix: derive from getSiteUrl() or hardcode the correct .ar domain.
        // We assert absence of the wrong literal.
        // Note: 'hospeda.com.ar' contains 'hospeda.com' as substring, so we
        // check that the bare form 'hospeda.com/' (with a trailing slash) OR
        // the quoted form "hospeda.com'" (with closing quote) is NOT present.
        expect(articleComponentSrc).not.toMatch(/['"]https:\/\/hospeda\.com['"]/);
        expect(articleComponentSrc).not.toContain("https://hospeda.com'");
        expect(articleComponentSrc).not.toContain('https://hospeda.com"');
    });

    it('publisher URL is derived from getSiteUrl() or contains hospeda.com.ar', () => {
        const hasSiteUrl = articleComponentSrc.includes('getSiteUrl');
        const hasCorrectDomain = articleComponentSrc.includes('hospeda.com.ar');
        expect(hasSiteUrl || hasCorrectDomain).toBe(true);
    });

    it('accepts an articleType prop to support BlogPosting subtype', () => {
        // The inline page used '@type': 'BlogPosting'. The component must support this.
        expect(articleComponentSrc).toContain('articleType');
    });

    it('emits BlogPosting type when articleType is set', () => {
        // Either via interpolation or conditional — the source must reference BlogPosting
        expect(articleComponentSrc).toContain('BlogPosting');
    });
});

// ---------------------------------------------------------------------------
// EventJsonLd.astro — schema parity: eventStatus + offers
// ---------------------------------------------------------------------------
describe('EventJsonLd.astro — schema parity fields (SPEC-157 REQ-7)', () => {
    it('accepts and emits eventStatus when provided', () => {
        expect(eventComponentSrc).toContain('eventStatus');
    });

    it('accepts and emits offers when provided', () => {
        expect(eventComponentSrc).toContain('offers');
    });
});

// ---------------------------------------------------------------------------
// PlaceJsonLd.astro — schema parity: geo coordinates
// ---------------------------------------------------------------------------
describe('PlaceJsonLd.astro — schema parity fields (SPEC-157 REQ-7)', () => {
    it('accepts and emits geo coordinates when provided', () => {
        expect(placeComponentSrc).toContain('geo');
        expect(placeComponentSrc).toContain('GeoCoordinates');
    });
});
