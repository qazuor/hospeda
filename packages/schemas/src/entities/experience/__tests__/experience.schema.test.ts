import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { BaseLifecycleFields } from '../../../common/lifecycle.schema.js';
import { BaseModerationFields } from '../../../common/moderation.schema.js';
import { BaseVisibilityFields } from '../../../common/visibility.schema.js';
import { ExperiencePriceUnitEnum } from '../../../enums/experience-price-unit.enum.js';
import { ExperienceTypeEnum } from '../../../enums/experience-type.enum.js';
import { PublicationStatusEnum } from '../../../enums/publication-status.enum.js';
import {
    ExperienceAdminSchema,
    ExperienceProtectedSchema,
    ExperiencePublicSchema
} from '../experience.access.schema.js';
import { ExperienceAdminSearchSchema } from '../experience.admin-search.schema.js';
import {
    ExperienceAdminCreateInputSchema,
    ExperienceOwnerCreateInputSchema,
    ExperienceOwnerUpdateInputSchema,
    ExperienceUpdateInputSchema
} from '../experience.crud.schema.js';
import { ExperienceIdSchema, ExperienceSchema } from '../experience.schema.js';

// ============================================================================
// Helpers
// ============================================================================

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const ANOTHER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/** Builds a minimal valid Experience object for testing. */
const buildValidExperience = (
    overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
    id: VALID_UUID,
    name: 'Alquiler de Kayak Rio Uruguay',
    slug: 'alquiler-kayak-rio-uruguay',
    summary: 'Explorá el río Uruguay en kayak con equipo incluido.',
    description:
        'Servicio de alquiler de kayaks para explorar el río Uruguay. Incluye chaleco y remo. Duración mínima 2 horas.',
    type: ExperienceTypeEnum.KAYAK_RENTAL,
    priceFrom: 500000, // 5000 ARS in centavos
    priceUnit: ExperiencePriceUnitEnum.PER_HOUR,
    isPriceOnRequest: false,
    hasActiveSubscription: true,
    destinationId: ANOTHER_UUID,
    ownerId: ANOTHER_UUID,
    isFeatured: false,
    publicationStatus: 'PUBLISHED',
    reviewsCount: 0,
    averageRating: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    // BaseAuditFields: nullable (not optional) — must be explicitly null when absent
    createdById: null,
    updatedById: null,
    ...overrides
});

// ============================================================================
// ExperienceIdSchema
// ============================================================================

describe('ExperienceIdSchema', () => {
    it('should accept a valid UUID', () => {
        const result = ExperienceIdSchema.safeParse(VALID_UUID);
        expect(result.success).toBe(true);
    });

    it('should reject a non-UUID string', () => {
        const result = ExperienceIdSchema.safeParse('not-a-uuid');
        expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
        const result = ExperienceIdSchema.safeParse('');
        expect(result.success).toBe(false);
    });

    it('should reject null', () => {
        const result = ExperienceIdSchema.safeParse(null);
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// ExperienceSchema — valid object
// ============================================================================

describe('ExperienceSchema', () => {
    describe('valid object parsing', () => {
        it('should parse a minimal valid experience object', () => {
            // Arrange
            const raw = buildValidExperience();

            // Act
            const result = ExperienceSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should default isPriceOnRequest to false when absent', () => {
            // Arrange
            const raw = buildValidExperience({ isPriceOnRequest: undefined });

            // Act
            const result = ExperienceSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isPriceOnRequest).toBe(false);
            }
        });

        it('should accept priceFrom = 0 (free / on_request)', () => {
            const raw = buildValidExperience({ priceFrom: 0, isPriceOnRequest: true });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should accept all ExperienceTypeEnum values', () => {
            for (const type of Object.values(ExperienceTypeEnum)) {
                const raw = buildValidExperience({ type });
                const result = ExperienceSchema.safeParse(raw);
                expect(result.success).toBe(true);
            }
        });

        it('should accept all ExperiencePriceUnitEnum values', () => {
            for (const priceUnit of Object.values(ExperiencePriceUnitEnum)) {
                const raw = buildValidExperience({ priceUnit });
                const result = ExperienceSchema.safeParse(raw);
                expect(result.success).toBe(true);
            }
        });

        it('should accept optional faqs array', () => {
            const raw = buildValidExperience({
                faqs: [
                    {
                        id: VALID_UUID,
                        question: '¿Qué incluye el alquiler de kayak?',
                        answer: 'El alquiler incluye kayak, chaleco salvavidas y remo. No se requiere experiencia previa.',
                        category: 'general',
                        displayOrder: 1,
                        lifecycleState: 'ACTIVE',
                        createdAt: new Date('2024-01-01'),
                        updatedAt: new Date('2024-01-01'),
                        // BaseFaqSchema spreads BaseAuditFields — nullable, not optional
                        createdById: null,
                        updatedById: null
                    }
                ]
            });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });
    });

    describe('invalid type field', () => {
        it('should reject an unknown experience type', () => {
            // Arrange
            const raw = buildValidExperience({ type: 'SCUBA_DIVING' });

            // Act
            const result = ExperienceSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase type value', () => {
            const raw = buildValidExperience({ type: 'excursion' });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });
    });

    describe('invalid priceFrom field', () => {
        it('should reject negative priceFrom', () => {
            // Arrange
            const raw = buildValidExperience({ priceFrom: -100 });

            // Act
            const result = ExperienceSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject non-integer priceFrom (float)', () => {
            // Arrange
            const raw = buildValidExperience({ priceFrom: 100.5 });

            // Act
            const result = ExperienceSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject string priceFrom', () => {
            const raw = buildValidExperience({ priceFrom: '100' });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });
    });

    describe('invalid priceUnit field', () => {
        it('should reject an unknown priceUnit', () => {
            // Arrange
            const raw = buildValidExperience({ priceUnit: 'per_week' });

            // Act
            const result = ExperienceSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject uppercase priceUnit (values are lowercase)', () => {
            const raw = buildValidExperience({ priceUnit: 'PER_DAY' });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });
    });

    describe('required fields', () => {
        it('should reject when name is missing', () => {
            const raw = buildValidExperience({ name: undefined });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });

        it('should reject when type is missing', () => {
            const raw = buildValidExperience({ type: undefined });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });

        // H-156 inverted this: it used to assert that a missing `priceUnit` was
        // rejected. `experiences.price_unit` is nullable now — an experience
        // with `isPriceOnRequest` has no price, so it has no unit to bill it in
        // — and this base schema also describes rows READ back from the
        // database, where a null is a legitimate value rather than a defect.
        //
        // The rule "a unit IS required when there is a real price" did not
        // disappear; it moved to `ExperienceAdminCreateInputCheckedSchema` /
        // `ExperienceOwnerCreateInputCheckedSchema`, where both fields are
        // present and can be compared. See `experience.crud.schema.test.ts`.
        it('accepts a missing priceUnit — the rule lives on the create schemas (H-156)', () => {
            const raw = buildValidExperience({ priceUnit: undefined });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('accepts an explicit null priceUnit (H-156)', () => {
            const raw = buildValidExperience({ priceUnit: null });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('still rejects a priceUnit outside the enum', () => {
            const raw = buildValidExperience({ priceUnit: 'per_decade' });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(false);
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

describe('ExperienceSchema.publicationStatus (HOS-1641)', () => {
    it.each(Object.values(PublicationStatusEnum))('accepts the %s state', (state) => {
        // Arrange
        const data = { ...buildValidExperience(), publicationStatus: state };

        // Act
        const result = ExperienceSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.publicationStatus).toBe(state);
        }
    });

    it('rejects a value outside the six states (the old ACTIVE)', () => {
        const result = ExperienceSchema.safeParse({
            ...buildValidExperience(),
            publicationStatus: 'ACTIVE'
        });
        expect(result.success).toBe(false);
    });

    it('no longer declares the old state trio', () => {
        expect(OLD_STATE_FIELDS).toHaveLength(3);
        const keys = Object.keys(ExperienceSchema.shape);
        for (const field of OLD_STATE_FIELDS) {
            expect(keys).not.toContain(field);
        }
    });
});

describe('Experience write inputs never take publicationStatus (R3)', () => {
    const INPUTS = [
        { name: 'ExperienceOwnerCreateInputSchema', schema: ExperienceOwnerCreateInputSchema },
        { name: 'ExperienceAdminCreateInputSchema', schema: ExperienceAdminCreateInputSchema },
        { name: 'ExperienceOwnerUpdateInputSchema', schema: ExperienceOwnerUpdateInputSchema },
        { name: 'ExperienceUpdateInputSchema', schema: ExperienceUpdateInputSchema }
    ] as const;

    for (const { name, schema } of INPUTS) {
        it(`${name} does not declare publicationStatus`, () => {
            expect(Object.keys(schema.shape)).not.toContain('publicationStatus');
        });
    }
});

describe('Experience read tiers (H3)', () => {
    it('the PUBLIC tier exposes neither visibility nor publicationStatus', () => {
        const keys = Object.keys(ExperiencePublicSchema.shape);
        for (const field of Object.keys(BaseVisibilityFields)) {
            expect(keys).not.toContain(field);
        }
        expect(keys).not.toContain('publicationStatus');
    });

    it.each([
        ['ExperienceProtectedSchema', ExperienceProtectedSchema],
        ['ExperienceAdminSchema', ExperienceAdminSchema]
    ] as const)('%s exposes publicationStatus and none of the old trio', (_name, schema) => {
        const keys = Object.keys(schema.shape);
        expect(keys).toContain('publicationStatus');
        for (const field of OLD_STATE_FIELDS) {
            expect(keys).not.toContain(field);
        }
    });
});

describe('ExperienceAdminSearchSchema.status filters by publicationStatus (H7)', () => {
    it.each(Object.values(PublicationStatusEnum))('accepts %s', (state) => {
        expect(ExperienceAdminSearchSchema.safeParse({ status: state }).success).toBe(true);
    });

    it('accepts all and defaults to it', () => {
        expect(ExperienceAdminSearchSchema.parse({ status: 'all' }).status).toBe('all');
        expect(ExperienceAdminSearchSchema.parse({}).status).toBe('all');
    });

    it('rejects the old lifecycle value ACTIVE', () => {
        expect(ExperienceAdminSearchSchema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
    });
});
