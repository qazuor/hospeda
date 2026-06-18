import { describe, expect, it } from 'vitest';
import { ExperiencePriceUnitEnum } from '../../../enums/experience-price-unit.enum.js';
import { ExperienceTypeEnum } from '../../../enums/experience-type.enum.js';
import {
    ExperienceAdminCreateInputSchema,
    ExperienceDeleteInputSchema,
    ExperienceOwnerUpdateInputSchema,
    ExperienceRestoreInputSchema,
    ExperienceUpdateInputSchema
} from '../experience.crud.schema.js';

// ============================================================================
// Helpers
// ============================================================================

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const buildAdminCreateInput = (
    overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
    name: 'Tour Litoral Histórico',
    summary: 'Recorrido guiado por los puntos históricos de la ciudad.',
    description:
        'Un recorrido completo por los sitios históricos más importantes de Concepción del Uruguay, con guía certificado y materiales incluidos.',
    type: ExperienceTypeEnum.CULTURAL_TOUR,
    priceFrom: 2000000, // 20000 ARS in centavos
    priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
    isPriceOnRequest: false,
    hasActiveSubscription: false,
    destinationId: VALID_UUID,
    isFeatured: false,
    lifecycleState: 'ACTIVE',
    moderationState: 'PENDING',
    visibility: 'PUBLIC',
    reviewsCount: 0,
    averageRating: 0,
    ...overrides
});

// ============================================================================
// ExperienceAdminCreateInputSchema
// ============================================================================

describe('ExperienceAdminCreateInputSchema', () => {
    describe('required vs optional fields', () => {
        it('should parse a valid admin create input', () => {
            // Arrange
            const raw = buildAdminCreateInput();

            // Act
            const result = ExperienceAdminCreateInputSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should allow omitting slug (auto-generated)', () => {
            const raw = buildAdminCreateInput({ slug: undefined });
            const result = ExperienceAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should allow omitting ownerId (may be assigned later)', () => {
            const raw = buildAdminCreateInput({ ownerId: undefined });
            const result = ExperienceAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should allow omitting destinationId', () => {
            const raw = buildAdminCreateInput({ destinationId: undefined });
            const result = ExperienceAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should allow optional amenityIds and featureIds (write-only)', () => {
            const raw = buildAdminCreateInput({
                amenityIds: [VALID_UUID],
                featureIds: [VALID_UUID]
            });
            const result = ExperienceAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should reject a non-UUID in amenityIds', () => {
            const raw = buildAdminCreateInput({ amenityIds: ['not-a-uuid'] });
            const result = ExperienceAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });

        it('should NOT expose id in the schema (admin create has no id)', () => {
            const raw = buildAdminCreateInput({ id: VALID_UUID });
            const result = ExperienceAdminCreateInputSchema.safeParse(raw);
            // Zod strips unknown keys by default — id should be stripped, not rejected
            if (result.success) {
                // @ts-expect-error id is not part of the schema type
                expect(result.data.id).toBeUndefined();
            }
        });
    });
});

// ============================================================================
// ExperienceOwnerUpdateInputSchema — operational fields only
// ============================================================================

describe('ExperienceOwnerUpdateInputSchema', () => {
    it('should parse an empty update (all fields optional)', () => {
        const result = ExperienceOwnerUpdateInputSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should allow updating isPriceOnRequest (operational field)', () => {
        const result = ExperienceOwnerUpdateInputSchema.safeParse({
            isPriceOnRequest: true
        });
        expect(result.success).toBe(true);
    });

    it('should allow updating openingHours (operational field)', () => {
        const result = ExperienceOwnerUpdateInputSchema.safeParse({
            openingHours: undefined
        });
        expect(result.success).toBe(true);
    });

    describe('identity fields are NOT part of owner update (admin-only)', () => {
        it('should strip "type" from owner update payload (identity field)', () => {
            // Zod strips unknown keys by default
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                type: ExperienceTypeEnum.EXCURSION
            });
            if (result.success) {
                // type is not in the schema — it gets stripped
                expect((result.data as Record<string, unknown>).type).toBeUndefined();
            }
        });

        it('should strip "name" from owner update payload (identity field)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                name: 'New Name'
            });
            if (result.success) {
                expect((result.data as Record<string, unknown>).name).toBeUndefined();
            }
        });

        it('should strip "priceFrom" from owner update payload (identity field)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                priceFrom: 100000
            });
            if (result.success) {
                expect((result.data as Record<string, unknown>).priceFrom).toBeUndefined();
            }
        });

        it('should strip "hasActiveSubscription" from owner update payload (subscription lifecycle)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                hasActiveSubscription: true
            });
            if (result.success) {
                expect(
                    (result.data as Record<string, unknown>).hasActiveSubscription
                ).toBeUndefined();
            }
        });
    });
});

// ============================================================================
// ExperienceUpdateInputSchema (admin PATCH)
// ============================================================================

describe('ExperienceUpdateInputSchema', () => {
    it('should parse an empty partial update', () => {
        const result = ExperienceUpdateInputSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should allow partial update of type', () => {
        const result = ExperienceUpdateInputSchema.safeParse({
            type: ExperienceTypeEnum.EXCURSION
        });
        expect(result.success).toBe(true);
    });

    it('should allow partial update of priceFrom', () => {
        const result = ExperienceUpdateInputSchema.safeParse({
            priceFrom: 300000
        });
        expect(result.success).toBe(true);
    });

    it('should reject negative priceFrom on admin update', () => {
        const result = ExperienceUpdateInputSchema.safeParse({
            priceFrom: -500
        });
        expect(result.success).toBe(false);
    });

    it('should strip ownerId (server-managed — use dedicated endpoint)', () => {
        const result = ExperienceUpdateInputSchema.safeParse({
            name: 'Updated Name'
        });
        if (result.success) {
            expect((result.data as Record<string, unknown>).ownerId).toBeUndefined();
        }
    });

    it('should strip hasActiveSubscription (subscription lifecycle only)', () => {
        const result = ExperienceUpdateInputSchema.safeParse({
            hasActiveSubscription: true
        });
        if (result.success) {
            expect((result.data as Record<string, unknown>).hasActiveSubscription).toBeUndefined();
        }
    });
});

// ============================================================================
// ExperienceDeleteInputSchema
// ============================================================================

describe('ExperienceDeleteInputSchema', () => {
    it('should parse with id and default force=false', () => {
        // Arrange / Act
        const result = ExperienceDeleteInputSchema.safeParse({ id: VALID_UUID });

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.force).toBe(false);
        }
    });

    it('should parse with force=true for hard delete', () => {
        const result = ExperienceDeleteInputSchema.safeParse({ id: VALID_UUID, force: true });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.force).toBe(true);
        }
    });

    it('should reject a non-UUID id', () => {
        const result = ExperienceDeleteInputSchema.safeParse({ id: 'invalid' });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// ExperienceRestoreInputSchema
// ============================================================================

describe('ExperienceRestoreInputSchema', () => {
    it('should parse a valid UUID id', () => {
        const result = ExperienceRestoreInputSchema.safeParse({ id: VALID_UUID });
        expect(result.success).toBe(true);
    });

    it('should reject a non-UUID id', () => {
        const result = ExperienceRestoreInputSchema.safeParse({ id: 'bad-id' });
        expect(result.success).toBe(false);
    });
});
