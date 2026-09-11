/**
 * What the printable ficha is allowed to say (HOS-1058).
 *
 * ---
 * The first describe below is the one that matters. A PDF is the only artifact
 * this platform produces that leaves it completely: it gets photocopied, left on
 * a counter, and can never be unpublished. So the invariant is not "the brochure
 * looks right", it is **the brochure cannot carry a field the public ficha does
 * not already publish** — and that is asserted structurally, against the real
 * public schemas, rather than by reading the output and hoping.
 *
 * @module test/services/commerce-brochure
 */

import { ExperiencePublicSchema, GastronomyPublicSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildExperienceBrochureContent,
    buildGastronomyBrochureContent,
    buildPublicListingUrl
} from '../../src/services/commerce-brochure/brochure-content.js';
import {
    ExperienceBrochureSourceSchema,
    GastronomyBrochureSourceSchema
} from '../../src/services/commerce-brochure/brochure-source.js';

/** A gastronomy row as the owner-tier read returns it — private fields included. */
const GASTRONOMY_ROW = {
    id: '22222222-2222-4222-8222-222222222222',
    slug: 'la-parrilla-del-puerto',
    name: 'La Parrilla del Puerto',
    type: 'PARRILLA',
    summary: 'Parrilla a la vista sobre el río Uruguay.',
    description: 'Una descripción más larga que no debería ganarle al resumen.',
    priceRange: 'MID',
    menuUrl: 'https://ejemplo.com/menu',
    openingHours: {
        days: {
            mon: { closed: true, shifts: [] },
            tue: { closed: false, shifts: [{ open: '12:00', close: '15:30' }] }
        }
    },
    socialNetworks: { instagram: 'https://instagram.com/parrilla' },
    media: {
        featuredImage: { url: 'https://cdn.test/portada.jpg', moderationState: 'APPROVED' }
    },
    destination: { name: 'Concepción del Uruguay' },
    amenities: [{ slug: 'wifi' }],
    features: [{ slug: 'river_front', hostReWriteName: null }],
    // Owner-private, present on the protected projection this route reads.
    ownerId: '11111111-1111-4111-8111-111111111111',
    lifecycleState: 'ACTIVE',
    contactInfo: { workPhone: '+54 9 3442 000000', personalEmail: 'dueno@privado.test' },
    adminInfo: { notes: 'internal note' }
};

/** An experience row, same shape of trap: a whatsapp number sitting in contactInfo. */
const EXPERIENCE_ROW = {
    id: '33333333-3333-4333-8333-333333333333',
    slug: 'kayak-al-atardecer',
    name: 'Kayak al atardecer',
    type: 'KAYAK_RENTAL',
    summary: 'Salida guiada de dos horas por el río.',
    description: 'Una descripción larga.',
    isPriceOnRequest: false,
    priceFrom: 15000,
    priceUnit: 'per_person',
    meetingPoint: 'Muelle municipal, junto a la rampa.',
    openingHours: { days: { sat: { closed: false, shifts: [{ open: '17:00', close: '20:00' }] } } },
    contactInfo: {
        workPhone: '+54 9 3442 111111',
        workEmail: 'hola@kayak.test',
        website: 'https://kayak.test',
        whatsapp: '+54 9 3442 999999',
        personalEmail: 'dueno@privado.test'
    },
    media: { featuredImage: { url: 'https://cdn.test/kayak.jpg', moderationState: 'APPROVED' } },
    destination: { name: 'Colón' },
    ownerId: '11111111-1111-4111-8111-111111111111',
    lifecycleState: 'ACTIVE'
};

describe('the brochure cannot outrun the public ficha (HOS-1058)', () => {
    const CASES = [
        {
            label: 'gastronomy',
            source: GastronomyBrochureSourceSchema,
            publicSchema: GastronomyPublicSchema
        },
        {
            label: 'experience',
            source: ExperienceBrochureSourceSchema,
            publicSchema: ExperiencePublicSchema
        }
    ] as const;

    for (const testCase of CASES) {
        it(`reads only fields the ${testCase.label} PUBLIC schema publishes`, () => {
            const publicKeys = new Set(Object.keys(testCase.publicSchema.shape));
            const brochureKeys = Object.keys(testCase.source.shape);

            expect(brochureKeys.length).toBeGreaterThan(0);
            const outside = brochureKeys.filter((key) => !publicKeys.has(key));
            expect(outside).toEqual([]);
        });
    }

    it('does not read contactInfo for gastronomy, because the public ficha has none', () => {
        // The single most tempting field to add to a printed restaurant sheet,
        // and the one `GastronomyPublicSchema` deliberately does not pick.
        expect(Object.keys(GastronomyBrochureSourceSchema.shape)).not.toContain('contactInfo');
        expect(Object.keys(GastronomyPublicSchema.shape)).not.toContain('contactInfo');
    });

    it('strips a phone number the owner-tier row carried into the gastronomy brochure', () => {
        const parsed = GastronomyBrochureSourceSchema.parse(GASTRONOMY_ROW);
        expect(parsed).not.toHaveProperty('contactInfo');
        expect(parsed).not.toHaveProperty('ownerId');
        expect(parsed).not.toHaveProperty('adminInfo');

        const content = buildGastronomyBrochureContent({
            listing: parsed,
            locale: 'es',
            siteUrl: 'https://hospeda.com.ar'
        });
        expect(JSON.stringify(content)).not.toContain('3442 000000');
        expect(JSON.stringify(content)).not.toContain('dueno@privado.test');
    });

    it('keeps whatsapp out of the experience brochure, where HOS-19 keeps it gated', () => {
        const parsed = ExperienceBrochureSourceSchema.parse(EXPERIENCE_ROW);
        const content = buildExperienceBrochureContent({
            listing: parsed,
            locale: 'es',
            siteUrl: 'https://hospeda.com.ar'
        });

        const printed = JSON.stringify(content);
        // The four published contact fields are there…
        expect(printed).toContain('hola@kayak.test');
        expect(printed).toContain('3442 111111');
        // …and the two that are not on the public ficha are not.
        expect(printed).not.toContain('3442 999999');
        expect(printed).not.toContain('dueno@privado.test');
    });
});

describe('the QR target (HOS-1058)', () => {
    it('builds the gastronomy ficha URL the web app actually serves', () => {
        expect(
            buildPublicListingUrl({
                vertical: 'gastronomy',
                slug: 'la-parrilla-del-puerto',
                locale: 'es',
                siteUrl: 'https://hospeda.com.ar'
            })
        ).toBe('https://hospeda.com.ar/es/gastronomia/la-parrilla-del-puerto/');
    });

    it('builds the experience ficha URL, whose segment differs from the vertical name', () => {
        expect(
            buildPublicListingUrl({
                vertical: 'experience',
                slug: 'kayak-al-atardecer',
                locale: 'en',
                siteUrl: 'https://hospeda.com.ar'
            })
        ).toBe('https://hospeda.com.ar/en/experiencias/kayak-al-atardecer/');
    });

    it('tolerates a trailing slash on the configured site URL', () => {
        expect(
            buildPublicListingUrl({
                vertical: 'gastronomy',
                slug: 'x',
                locale: 'pt',
                siteUrl: 'https://hospeda.com.ar/'
            })
        ).toBe('https://hospeda.com.ar/pt/gastronomia/x/');
    });
});

describe('brochure content (HOS-1058)', () => {
    /** Content of the sample gastronomy listing in one locale. */
    function gastronomy(locale: 'es' | 'en' | 'pt') {
        return buildGastronomyBrochureContent({
            listing: GastronomyBrochureSourceSchema.parse(GASTRONOMY_ROW),
            locale,
            siteUrl: 'https://hospeda.com.ar'
        });
    }

    it('prints the type and the destination as the subtitle', () => {
        expect(gastronomy('es').subtitle).toBe('Parrilla · Concepción del Uruguay');
    });

    it('prints a sheet for an /en/ page in English, headings included', () => {
        const content = gastronomy('en');
        expect(content.subtitle).toContain('Grill');
        expect(content.sections.map((section) => section.heading)).toContain('Opening hours');
        expect(content.url).toContain('/en/');
    });

    it('prints a closed day as closed instead of omitting it', () => {
        // On paper an absent Monday reads as an oversight, and the reader is
        // standing at the door with no way to ask.
        const hours = gastronomy('es').sections.find((s) => s.heading.includes('Horarios'));
        expect(hours?.lines).toContain('Lunes: Cerrado');
        expect(hours?.lines).toContain('Martes: 12:00 - 15:30');
    });

    it('joins both catalogue lists into one line, resolving labels by slug', () => {
        const services = gastronomy('es').sections.at(-1);
        expect(services?.lines[0]).toBe('WiFi · Frente al río');
    });

    it('prefers the summary over the description, as the ficha does', () => {
        expect(gastronomy('es').intro).toBe('Parrilla a la vista sobre el río Uruguay.');
    });

    it('prints the experience price with its unit', () => {
        const content = buildExperienceBrochureContent({
            listing: ExperienceBrochureSourceSchema.parse(EXPERIENCE_ROW),
            locale: 'es',
            siteUrl: 'https://hospeda.com.ar'
        });
        expect(content.price).toBe('Desde $15000 por persona');
    });

    it('prints the meeting point, which is public by owner decision (HOS-1048)', () => {
        const content = buildExperienceBrochureContent({
            listing: ExperienceBrochureSourceSchema.parse(EXPERIENCE_ROW),
            locale: 'es',
            siteUrl: 'https://hospeda.com.ar'
        });
        expect(content.sections[0]?.lines).toEqual(['Muelle municipal, junto a la rampa.']);
    });
});

describe('cover photo selection (HOS-1058)', () => {
    /** The row with a specific media block. */
    function withMedia(media: unknown) {
        return GastronomyBrochureSourceSchema.parse({ ...GASTRONOMY_ROW, media });
    }

    /** Cover URL chosen for a media block. */
    function coverOf(media: unknown): string | null {
        return buildGastronomyBrochureContent({
            listing: withMedia(media),
            locale: 'es',
            siteUrl: 'https://hospeda.com.ar'
        }).coverImageUrl;
    }

    it('uses the featured image when it is approved', () => {
        expect(
            coverOf({
                featuredImage: { url: 'https://cdn.test/a.jpg', moderationState: 'APPROVED' }
            })
        ).toBe('https://cdn.test/a.jpg');
    });

    it('skips a featured image awaiting moderation and falls back to an approved one', () => {
        // Print has no takedown: a photo a moderator later rejects is already
        // on the counter.
        expect(
            coverOf({
                featuredImage: { url: 'https://cdn.test/pending.jpg', moderationState: 'PENDING' },
                gallery: [
                    { url: 'https://cdn.test/rejected.jpg', moderationState: 'REJECTED' },
                    { url: 'https://cdn.test/ok.jpg', moderationState: 'APPROVED' }
                ]
            })
        ).toBe('https://cdn.test/ok.jpg');
    });

    it('prints without a photo when nothing is approved', () => {
        expect(
            coverOf({
                featuredImage: { url: 'https://cdn.test/pending.jpg', moderationState: 'PENDING' }
            })
        ).toBeNull();
    });

    it('prints without a photo when the listing has no media at all', () => {
        expect(coverOf(null)).toBeNull();
    });
});
