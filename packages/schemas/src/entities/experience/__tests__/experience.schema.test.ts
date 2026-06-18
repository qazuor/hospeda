import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ExperiencePriceUnitEnum } from '../../../enums/experience-price-unit.enum.js';
import { ExperienceTypeEnum } from '../../../enums/experience-type.enum.js';
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
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
    visibility: 'PUBLIC',
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

        it('should default hasActiveSubscription to false when absent', () => {
            // Arrange
            const raw = buildValidExperience({ hasActiveSubscription: undefined });

            // Act
            const result = ExperienceSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.hasActiveSubscription).toBe(false);
            }
        });

        it('should default isFeatured to false when absent', () => {
            // Arrange
            const raw = buildValidExperience({ isFeatured: undefined });

            // Act
            const result = ExperienceSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isFeatured).toBe(false);
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

        it('should reject when priceUnit is missing', () => {
            const raw = buildValidExperience({ priceUnit: undefined });
            const result = ExperienceSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });
    });
});
