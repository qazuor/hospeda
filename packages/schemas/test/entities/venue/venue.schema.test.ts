import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { BaseLifecycleFields } from '../../../src/common/lifecycle.schema.js';
import { BaseModerationFields } from '../../../src/common/moderation.schema.js';
import { BaseVisibilityFields } from '../../../src/common/visibility.schema.js';
import {
    GastronomyAdminSchema,
    GastronomyProtectedSchema,
    GastronomyPublicSchema
} from '../../../src/entities/venue/venue.access.schema.js';
import { GastronomyAdminSearchSchema } from '../../../src/entities/venue/venue.admin-search.schema.js';
import {
    GastronomyAdminCreateInputSchema,
    GastronomyOwnerCreateInputSchema,
    GastronomyOwnerUpdateInputSchema,
    GastronomyUpdateInputSchema
} from '../../../src/entities/venue/venue.crud.schema.js';
import { GastronomySchema } from '../../../src/entities/venue/venue.schema.js';
import { PublicationStatusEnum } from '../../../src/enums/publication-status.enum.js';
import {
    createInvalidGastronomy,
    createMinimalGastronomy,
    createValidGastronomy
} from '../../fixtures/venue.fixtures.js';

describe('GastronomySchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid gastronomy listing', () => {
            const data = createValidGastronomy();
            expect(() => GastronomySchema.parse(data)).not.toThrow();

            const result = GastronomySchema.parse(data);
            expect(result.id).toBe(data.id);
            expect(result.name).toBe(data.name);
            expect(result.type).toBe(data.type);
        });

        it('should validate minimal required gastronomy data', () => {
            const data = createMinimalGastronomy();
            expect(() => GastronomySchema.parse(data)).not.toThrow();
        });

        it('should accept nullish priceRange', () => {
            const data = { ...createMinimalGastronomy(), priceRange: null };
            expect(() => GastronomySchema.parse(data)).not.toThrow();
        });

        it('should accept openingHours: null (M-2 regression — .nullish() fix)', () => {
            // OpeningHoursFields uses .nullish() so Drizzle/pg can return null for
            // unset JSONB columns. A bare .optional() would reject null here.
            const data = { ...createMinimalGastronomy(), openingHours: null };
            expect(() => GastronomySchema.parse(data)).not.toThrow();
        });

        it('should accept a valid HTTPS menuUrl', () => {
            const data = { ...createMinimalGastronomy(), menuUrl: 'https://example.com/menu' };
            expect(() => GastronomySchema.parse(data)).not.toThrow();
        });

        it('should accept all valid GastronomyTypeEnum values', () => {
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
                const data = { ...createMinimalGastronomy(), type };
                expect(
                    () => GastronomySchema.parse(data),
                    `should accept type ${type}`
                ).not.toThrow();
            }
        });

        it('should accept all valid PriceRangeEnum values', () => {
            for (const pr of ['BUDGET', 'MID', 'HIGH', 'PREMIUM']) {
                const data = { ...createMinimalGastronomy(), priceRange: pr };
                expect(() => GastronomySchema.parse(data), `should accept ${pr}`).not.toThrow();
            }
        });
    });

    describe('Invalid Data', () => {
        it('should reject gastronomy with invalid data', () => {
            const data = createInvalidGastronomy();
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject when type is missing', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { type: _t, ...data } = createMinimalGastronomy() as any;
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject when destinationId is missing', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { destinationId: _d, ...data } = createMinimalGastronomy() as any;
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject non-HTTPS menuUrl', () => {
            const data = { ...createMinimalGastronomy(), menuUrl: 'http://insecure.com/menu' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject an invalid type value (enum validation on entity schema)', () => {
            // GastronomySchema.type is GastronomyTypeEnumSchema — invalid values are rejected.
            const data = { ...createMinimalGastronomy(), type: 'PIZZERIA' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject invalid id format', () => {
            const data = { ...createMinimalGastronomy(), id: 'not-a-uuid' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject name shorter than 2 characters', () => {
            const data = { ...createMinimalGastronomy(), name: 'A' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject summary shorter than 10 characters', () => {
            const data = { ...createMinimalGastronomy(), summary: 'Too short' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
        });

        it('should reject description shorter than 20 characters', () => {
            const data = { ...createMinimalGastronomy(), description: 'Too short' };
            expect(() => GastronomySchema.parse(data)).toThrow(ZodError);
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

describe('GastronomySchema.publicationStatus (HOS-1641)', () => {
    it.each(Object.values(PublicationStatusEnum))('accepts the %s state', (state) => {
        // Arrange
        const data = { ...createMinimalGastronomy(), publicationStatus: state };

        // Act
        const result = GastronomySchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.publicationStatus).toBe(state);
        }
    });

    it('rejects a value outside the six states (the old ACTIVE)', () => {
        const result = GastronomySchema.safeParse({
            ...createMinimalGastronomy(),
            publicationStatus: 'ACTIVE'
        });
        expect(result.success).toBe(false);
    });

    it('no longer declares the old state trio', () => {
        expect(OLD_STATE_FIELDS).toHaveLength(3);
        const keys = Object.keys(GastronomySchema.shape);
        for (const field of OLD_STATE_FIELDS) {
            expect(keys).not.toContain(field);
        }
    });
});

describe('Gastronomy write inputs never take publicationStatus (R3)', () => {
    const INPUTS = [
        { name: 'GastronomyOwnerCreateInputSchema', schema: GastronomyOwnerCreateInputSchema },
        { name: 'GastronomyAdminCreateInputSchema', schema: GastronomyAdminCreateInputSchema },
        { name: 'GastronomyOwnerUpdateInputSchema', schema: GastronomyOwnerUpdateInputSchema },
        { name: 'GastronomyUpdateInputSchema', schema: GastronomyUpdateInputSchema }
    ] as const;

    for (const { name, schema } of INPUTS) {
        it(`${name} does not declare publicationStatus`, () => {
            expect(Object.keys(schema.shape)).not.toContain('publicationStatus');
        });
    }
});

describe('Gastronomy read tiers (H3)', () => {
    it('the PUBLIC tier exposes neither visibility nor publicationStatus', () => {
        const keys = Object.keys(GastronomyPublicSchema.shape);
        for (const field of Object.keys(BaseVisibilityFields)) {
            expect(keys).not.toContain(field);
        }
        expect(keys).not.toContain('publicationStatus');
    });

    it.each([
        ['GastronomyProtectedSchema', GastronomyProtectedSchema],
        ['GastronomyAdminSchema', GastronomyAdminSchema]
    ] as const)('%s exposes publicationStatus and none of the old trio', (_name, schema) => {
        const keys = Object.keys(schema.shape);
        expect(keys).toContain('publicationStatus');
        for (const field of OLD_STATE_FIELDS) {
            expect(keys).not.toContain(field);
        }
    });
});

describe('GastronomyAdminSearchSchema.status filters by publicationStatus (H7)', () => {
    it.each(Object.values(PublicationStatusEnum))('accepts %s', (state) => {
        expect(GastronomyAdminSearchSchema.safeParse({ status: state }).success).toBe(true);
    });

    it('accepts all and defaults to it', () => {
        expect(GastronomyAdminSearchSchema.parse({ status: 'all' }).status).toBe('all');
        expect(GastronomyAdminSearchSchema.parse({}).status).toBe('all');
    });

    it('rejects the old lifecycle value ACTIVE', () => {
        expect(GastronomyAdminSearchSchema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
    });
});
