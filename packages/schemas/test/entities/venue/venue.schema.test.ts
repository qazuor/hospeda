import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { BaseLifecycleFields } from '../../../src/common/lifecycle.schema.js';
import { BaseModerationFields } from '../../../src/common/moderation.schema.js';
import { BaseVisibilityFields } from '../../../src/common/visibility.schema.js';
import {
    VenueAdminSchema,
    VenueProtectedSchema,
    VenuePublicSchema
} from '../../../src/entities/venue/venue.access.schema.js';
import { VenueAdminSearchSchema } from '../../../src/entities/venue/venue.admin-search.schema.js';
import {
    VenueAdminCreateInputSchema,
    VenueOwnerCreateInputSchema,
    VenueOwnerUpdateInputSchema,
    VenueUpdateInputSchema
} from '../../../src/entities/venue/venue.crud.schema.js';
import { VenueSchema } from '../../../src/entities/venue/venue.schema.js';
import { PublicationStatusEnum } from '../../../src/enums/publication-status.enum.js';
import {
    createInvalidVenue,
    createMinimalVenue,
    createValidVenue
} from '../../fixtures/venue.fixtures.js';

describe('VenueSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid venue listing', () => {
            const data = createValidVenue();
            expect(() => VenueSchema.parse(data)).not.toThrow();

            const result = VenueSchema.parse(data);
            expect(result.id).toBe(data.id);
            expect(result.name).toBe(data.name);
            expect(result.type).toBe(data.type);
        });

        it('should validate minimal required venue data', () => {
            const data = createMinimalVenue();
            expect(() => VenueSchema.parse(data)).not.toThrow();
        });

        it('should accept nullish priceRange', () => {
            const data = { ...createMinimalVenue(), priceRange: null };
            expect(() => VenueSchema.parse(data)).not.toThrow();
        });

        it('should accept openingHours: null (M-2 regression — .nullish() fix)', () => {
            // OpeningHoursFields uses .nullish() so Drizzle/pg can return null for
            // unset JSONB columns. A bare .optional() would reject null here.
            const data = { ...createMinimalVenue(), openingHours: null };
            expect(() => VenueSchema.parse(data)).not.toThrow();
        });

        it('should accept a valid HTTPS menuUrl', () => {
            const data = { ...createMinimalVenue(), menuUrl: 'https://example.com/menu' };
            expect(() => VenueSchema.parse(data)).not.toThrow();
        });

        it('should accept all valid VenueTypeEnum values', () => {
            const types = [
                'RESTAURANT',
                'BAR',
                'CAFE',
                'PARRILLA',
                'CERVECERIA',
                'HELADERIA',
                'PANADERIA',
                'ROTISERIA',
                'FOOD_TRUCK'
            ];
            for (const type of types) {
                const data = { ...createMinimalVenue(), type };
                expect(() => VenueSchema.parse(data), `should accept type ${type}`).not.toThrow();
            }
        });

        it('should accept all valid PriceRangeEnum values', () => {
            for (const pr of ['BUDGET', 'MID', 'HIGH', 'PREMIUM']) {
                const data = { ...createMinimalVenue(), priceRange: pr };
                expect(() => VenueSchema.parse(data), `should accept ${pr}`).not.toThrow();
            }
        });
    });

    describe('Invalid Data', () => {
        it('should reject venue with invalid data', () => {
            const data = createInvalidVenue();
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject when type is missing', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { type: _t, ...data } = createMinimalVenue() as any;
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject when destinationId is missing', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { destinationId: _d, ...data } = createMinimalVenue() as any;
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject non-HTTPS menuUrl', () => {
            const data = { ...createMinimalVenue(), menuUrl: 'http://insecure.com/menu' };
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject an invalid type value (enum validation on entity schema)', () => {
            // venueSchema.type is venueTypeEnumSchema — invalid values are rejected.
            const data = { ...createMinimalVenue(), type: 'PIZZERIA' };
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject invalid id format', () => {
            const data = { ...createMinimalVenue(), id: 'not-a-uuid' };
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject name shorter than 2 characters', () => {
            const data = { ...createMinimalVenue(), name: 'A' };
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject summary shorter than 10 characters', () => {
            const data = { ...createMinimalVenue(), summary: 'Too short' };
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject description shorter than 20 characters', () => {
            const data = { ...createMinimalVenue(), description: 'Too short' };
            expect(() => VenueSchema.parse(data)).toThrow(ZodError);
        });
    });
});

// ============================================================================
// HOS-1641 (AC:V6:32) — publicationStatus replaces the old state trio
// ============================================================================

/** The old lifecycle/visibility/moderation trio, read from the base field groups. */
const OLD_STATE_FIELDS: readonly string[] = [
    ...Object.keys(BaseLifecycleFields),
    ...Object.keys(BaseVisibilityFields),
    ...Object.keys(BaseModerationFields)
];

describe('VenueSchema.publicationStatus (HOS-1641)', () => {
    it.each(Object.values(PublicationStatusEnum))('accepts the %s state', (state) => {
        // Arrange
        const data = { ...createMinimalVenue(), publicationStatus: state };

        // Act
        const result = VenueSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.publicationStatus).toBe(state);
        }
    });

    it('rejects a value outside the six states (the old ACTIVE)', () => {
        const result = VenueSchema.safeParse({
            ...createMinimalVenue(),
            publicationStatus: 'ACTIVE'
        });
        expect(result.success).toBe(false);
    });

    it('no longer declares the old state trio', () => {
        expect(OLD_STATE_FIELDS).toHaveLength(3);
        const keys = Object.keys(VenueSchema.shape);
        for (const field of OLD_STATE_FIELDS) {
            expect(keys).not.toContain(field);
        }
    });
});

describe('Venue write inputs never take publicationStatus (R3)', () => {
    const INPUTS = [
        { name: 'VenueOwnerCreateInputSchema', schema: VenueOwnerCreateInputSchema },
        { name: 'VenueAdminCreateInputSchema', schema: VenueAdminCreateInputSchema },
        { name: 'VenueOwnerUpdateInputSchema', schema: VenueOwnerUpdateInputSchema },
        { name: 'VenueUpdateInputSchema', schema: VenueUpdateInputSchema }
    ] as const;

    for (const { name, schema } of INPUTS) {
        it(`${name} does not declare publicationStatus`, () => {
            expect(Object.keys(schema.shape)).not.toContain('publicationStatus');
        });
    }
});

describe('Venue read tiers (H3)', () => {
    it('the PUBLIC tier exposes neither visibility nor publicationStatus', () => {
        const keys = Object.keys(VenuePublicSchema.shape);
        for (const field of Object.keys(BaseVisibilityFields)) {
            expect(keys).not.toContain(field);
        }
        expect(keys).not.toContain('publicationStatus');
    });

    it.each([
        ['VenueProtectedSchema', VenueProtectedSchema],
        ['VenueAdminSchema', VenueAdminSchema]
    ] as const)('%s exposes publicationStatus and none of the old trio', (_name, schema) => {
        const keys = Object.keys(schema.shape);
        expect(keys).toContain('publicationStatus');
        for (const field of OLD_STATE_FIELDS) {
            expect(keys).not.toContain(field);
        }
    });
});

describe('VenueAdminSearchSchema.status filters by publicationStatus (H7)', () => {
    it.each(Object.values(PublicationStatusEnum))('accepts %s', (state) => {
        expect(VenueAdminSearchSchema.safeParse({ status: state }).success).toBe(true);
    });

    it('accepts all and defaults to it', () => {
        expect(VenueAdminSearchSchema.parse({ status: 'all' }).status).toBe('all');
        expect(VenueAdminSearchSchema.parse({}).status).toBe('all');
    });

    it('rejects the old lifecycle value ACTIVE', () => {
        expect(VenueAdminSearchSchema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
    });
});
