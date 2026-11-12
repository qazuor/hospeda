/**
 * Tests for the venue/experience amenities block of the chat context (HOS-2100).
 *
 * Before HOS-2100 neither assembler read its amenity junction table, so the
 * model could not answer «¿tiene aire acondicionado?» on a venue or an
 * experience. These tests pin the pure builder (labels, ordering, cap, empty
 * case), its wiring into both pure context builders, and the loader's table
 * choice and graceful failure.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetDb, mockApiLogger, tables } = vi.hoisted(() => {
    const table = (name: string) => ({
        __table: name,
        slug: `${name}.slug`,
        isFeatured: `${name}.isFeatured`,
        displayWeight: `${name}.displayWeight`,
        id: `${name}.id`,
        amenityId: `${name}.amenityId`,
        venueId: `${name}.venueId`,
        experienceId: `${name}.experienceId`,
        deletedAt: `${name}.deletedAt`,
        lifecycleState: `${name}.lifecycleState`,
        isOptional: `${name}.isOptional`,
        additionalCost: `${name}.additionalCost`,
        additionalCostPercent: `${name}.additionalCostPercent`,
        scope: `${name}.scope`,
        availability: `${name}.availability`
    });
    return {
        mockGetDb: vi.fn(),
        mockApiLogger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
        tables: {
            amenities: table('amenities'),
            rVenueAmenity: table('rVenueAmenity'),
            rExperienceAmenity: table('rExperienceAmenity'),
            venues: table('venues'),
            venueFaqs: table('venueFaqs'),
            venueMenuItems: table('venueMenuItems'),
            venueMenuSections: table('venueMenuSections'),
            experiences: table('experiences'),
            experienceFaqs: table('experienceFaqs')
        }
    };
});

vi.mock('@repo/db', () => ({ getDb: mockGetDb, ...tables }));
// Readable predicates, so a test can assert which filters the loader applies.
vi.mock('drizzle-orm', async (importOriginal) => ({
    ...(await importOriginal<typeof import('drizzle-orm')>()),
    eq: (column: unknown, value: unknown) => `${String(column)} = ${String(value)}`,
    isNull: (column: unknown) => `${String(column)} IS NULL`,
    and: (...parts: unknown[]) => `(${parts.map(String).join(' AND ')})`
}));
vi.mock('../../../src/utils/logger.js', () => ({ apiLogger: mockApiLogger }));

import { buildExperienceMarkdownContext } from '../../../src/services/ai-context/experience-ai-context.js';
import {
    buildListingAmenityLines,
    LISTING_CONTEXT_AMENITY_MAX,
    safeLoadListingAmenities
} from '../../../src/services/ai-context/listing-amenities-context.js';
import { buildVenueMarkdownContext } from '../../../src/services/ai-context/venue-ai-context.js';

const VENUE_ROW = {
    id: 'venue-1',
    name: 'La Esquina',
    summary: 'Bodegón',
    description: 'Cocina casera.',
    type: 'RESTAURANT',
    priceRange: null,
    menuUrl: null,
    openingHours: null,
    averageRating: null,
    reviewsCount: null
};

const EXPERIENCE_ROW = {
    id: 'exp-1',
    name: 'Paseo en lancha',
    summary: 'Paseo por el río',
    description: 'Una hora de navegación.',
    type: 'BOAT_TOUR',
    durationMinutes: 60,
    priceFrom: null,
    priceUnit: null,
    isPriceOnRequest: false,
    meetingPoint: null,
    meetingPointDirections: null,
    whatToBring: null,
    requirements: null,
    policies: null,
    averageRating: null,
    reviewsCount: null,
    openingHours: null
};

describe('buildListingAmenityLines', () => {
    it('renders a Comodidades heading with localized labels, never the raw slug', () => {
        // Arrange
        const amenities = [{ slug: 'air_conditioning' }, { slug: 'wifi' }];

        // Act
        const { lines } = buildListingAmenityLines({ amenities, locale: 'es' });

        // Assert
        expect(lines).toEqual(['', '### Comodidades', '- Aire acondicionado', '- WiFi']);
        expect(lines.join('\n')).not.toContain('air_conditioning');
    });

    it('renders nothing when the listing has no amenity (or only blank slugs)', () => {
        expect(buildListingAmenityLines({ amenities: [], locale: 'es' }).lines).toEqual([]);
        expect(
            buildListingAmenityLines({ amenities: [{ slug: '  ' }], locale: 'es' }).lines
        ).toEqual([]);
    });

    it('lists featured first, then higher displayWeight, keeping input order among ties', () => {
        // Arrange
        const amenities = [
            { slug: 'wifi', isFeatured: false, displayWeight: 50 },
            { slug: 'heating', isFeatured: false, displayWeight: 90 },
            { slug: 'microwave', isFeatured: true, displayWeight: 10 },
            { slug: 'coffee_maker', isFeatured: false, displayWeight: 50 }
        ];

        // Act
        const { lines } = buildListingAmenityLines({ amenities, locale: 'es' });

        // Assert
        expect(lines.slice(2)).toEqual(['- Microondas', '- Calefacción', '- WiFi', '- Cafetera']);
    });

    it('appends the owner-declared attributes; undeclared ones render nothing (HOS-2100)', () => {
        // Arrange
        const amenities = [
            { slug: 'parking', extraCharge: true, scope: 'shared' as const, availability: null },
            { slug: 'wifi', extraCharge: false, scope: null, availability: 'seasonal' as const },
            { slug: 'heating' }
        ];

        // Act
        const { lines } = buildListingAmenityLines({ amenities, locale: 'es' });

        // Assert
        expect(lines.slice(2)).toEqual([
            '- Estacionamiento (con cargo extra, compartido)',
            '- WiFi (de temporada)',
            '- Calefacción'
        ]);
    });

    it(`caps the block at ${LISTING_CONTEXT_AMENITY_MAX} amenities`, () => {
        // Arrange
        const amenities = Array.from({ length: LISTING_CONTEXT_AMENITY_MAX + 5 }, (_, i) => ({
            slug: `custom_${i}`
        }));

        // Act
        const { lines } = buildListingAmenityLines({ amenities, locale: 'es' });

        // Assert: blank + heading + capped items
        expect(lines).toHaveLength(LISTING_CONTEXT_AMENITY_MAX + 2);
    });
});

describe('context builders carry the amenities block (HOS-2100)', () => {
    it('venue: lists the amenities when given, omits the block otherwise', () => {
        const withAmenities = buildVenueMarkdownContext(VENUE_ROW, [], [], false, null, 'es', [
            { slug: 'air_conditioning' }
        ]);
        const without = buildVenueMarkdownContext(VENUE_ROW, [], [], false, null, 'es');

        expect(withAmenities).toContain('### Comodidades\n- Aire acondicionado');
        expect(without).not.toContain('### Comodidades');
    });

    it('experience: lists the amenities when given, omits the block otherwise', () => {
        const withAmenities = buildExperienceMarkdownContext(EXPERIENCE_ROW, [], false, 'es', [
            { slug: 'wifi' }
        ]);
        const without = buildExperienceMarkdownContext(EXPERIENCE_ROW, [], false, 'es');

        expect(withAmenities).toContain('### Comodidades\n- WiFi');
        expect(without).not.toContain('### Comodidades');
    });
});

describe('safeLoadListingAmenities', () => {
    /** Installs a select chain that records the junction table it reads from. */
    function installDb(rows: ReadonlyArray<unknown>): {
        readonly fromTables: unknown[];
        readonly wheres: unknown[];
    } {
        const fromTables: unknown[] = [];
        const wheres: unknown[] = [];
        const limit = vi.fn().mockResolvedValue(rows);
        const where = vi.fn((predicate: unknown) => {
            wheres.push(predicate);
            return { limit };
        });
        const innerJoin = vi.fn(() => ({ where }));
        const from = vi.fn((table: unknown) => {
            fromTables.push(table);
            return { innerJoin };
        });
        mockGetDb.mockReturnValue({ select: vi.fn(() => ({ from })) });
        return { fromTables, wheres };
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads r_venue_amenity for a venue and maps the curation columns', async () => {
        // Arrange
        const { fromTables } = installDb([{ slug: 'wifi', isFeatured: null, displayWeight: null }]);

        // Act
        const result = await safeLoadListingAmenities({ vertical: 'venue', listingId: 'v1' });

        // Assert
        expect(fromTables).toEqual([tables.rVenueAmenity]);
        expect(result).toEqual([
            {
                slug: 'wifi',
                isFeatured: false,
                displayWeight: 50,
                extraCharge: false,
                scope: null,
                availability: null
            }
        ]);
    });

    it.each([
        { label: 'is_optional', row: { isOptional: true } },
        { label: 'additional_cost', row: { isOptional: false, additionalCost: { price: 500 } } },
        { label: 'additional_cost_percent', row: { isOptional: false, additionalCostPercent: 10 } }
    ])('maps $label to extraCharge and carries scope/availability', async ({ row }) => {
        // Arrange
        installDb([{ slug: 'parking', scope: 'private', availability: 'year_round', ...row }]);

        // Act
        const [result] = await safeLoadListingAmenities({ vertical: 'venue', listingId: 'v1' });

        // Assert
        expect(result).toMatchObject({
            extraCharge: true,
            scope: 'private',
            availability: 'year_round'
        });
    });

    it.each([
        'venue',
        'experience'
    ] as const)('%s: reads only active, non-deleted catalog amenities', async (vertical) => {
        // Arrange
        const { wheres } = installDb([]);

        // Act
        await safeLoadListingAmenities({ vertical, listingId: 'x1' });

        // Assert
        expect(wheres).toHaveLength(1);
        expect(String(wheres[0])).toContain('amenities.deletedAt IS NULL');
        expect(String(wheres[0])).toContain('amenities.lifecycleState = ACTIVE');
    });

    it('reads r_experience_amenity for an experience', async () => {
        const { fromTables } = installDb([]);

        await safeLoadListingAmenities({ vertical: 'experience', listingId: 'e1' });

        expect(fromTables).toEqual([tables.rExperienceAmenity]);
    });

    it('returns [] and warns when the read fails (a chat must not fail on a relation)', async () => {
        // Arrange
        mockGetDb.mockImplementation(() => {
            throw new Error('db down');
        });

        // Act
        const result = await safeLoadListingAmenities({ vertical: 'venue', listingId: 'v1' });

        // Assert
        expect(result).toEqual([]);
        expect(mockApiLogger.warn).toHaveBeenCalledTimes(1);
    });
});
