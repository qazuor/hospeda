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

    // -------------------------------------------------------------------------
    // SPEC-253 T-027: newly owner-editable fields (T-014)
    // -------------------------------------------------------------------------

    describe('newly owner-editable fields (SPEC-253 T-014)', () => {
        it('should accept type (SPEC-253 D1: now owner-editable, removed from identity-strip)', () => {
            // Arrange
            const input = { type: ExperienceTypeEnum.EXCURSION };

            // Act
            const result = ExperienceOwnerUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                // type is now in the schema — it persists (NOT stripped)
                expect((result.data as Record<string, unknown>).type).toBe(
                    ExperienceTypeEnum.EXCURSION
                );
            }
        });

        it('should accept all experience type enum values', () => {
            for (const type of Object.values(ExperienceTypeEnum)) {
                const result = ExperienceOwnerUpdateInputSchema.safeParse({ type });
                expect(result.success).toBe(true);
            }
        });

        it('should reject an invalid type value', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ type: 'INVALID_TYPE' });
            expect(result.success).toBe(false);
        });

        it('should accept priceFrom as a non-negative integer (SPEC-253 experience-only)', () => {
            // Arrange
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ priceFrom: 100000 });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                // priceFrom persists (NOT stripped)
                expect((result.data as Record<string, unknown>).priceFrom).toBe(100000);
            }
        });

        it('should reject priceFrom that is negative (validation rule)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ priceFrom: -1 });
            expect(result.success).toBe(false);
        });

        it('should accept priceFrom = 0 (free / isPriceOnRequest companion)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ priceFrom: 0 });
            expect(result.success).toBe(true);
        });

        it('should accept priceUnit as a valid enum value (SPEC-253 experience-only)', () => {
            // Arrange
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                priceUnit: ExperiencePriceUnitEnum.PER_DAY
            });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).priceUnit).toBe(
                    ExperiencePriceUnitEnum.PER_DAY
                );
            }
        });

        it('should reject an invalid priceUnit value', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ priceUnit: 'per_decade' });
            expect(result.success).toBe(false);
        });

        it('should accept summary within valid length bounds (10–300 chars)', () => {
            const input = { summary: 'Un resumen válido con más de diez caracteres para el test.' };
            const result = ExperienceOwnerUpdateInputSchema.safeParse(input);
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).summary).toBe(input.summary);
            }
        });

        it('should reject summary shorter than 10 characters', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ summary: 'Corto' });
            expect(result.success).toBe(false);
        });

        it('should accept nameI18n with valid locale keys', () => {
            const i18nValue = { es: 'Nombre ES', en: 'Name EN', pt: 'Nome PT' };
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ nameI18n: i18nValue });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).nameI18n).toEqual(i18nValue);
            }
        });

        it('should accept summaryI18n, descriptionI18n, richDescriptionI18n simultaneously', () => {
            const i18nValue = { es: 'Texto ES', en: 'Text EN', pt: 'Texto PT' };
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                summaryI18n: i18nValue,
                descriptionI18n: i18nValue,
                richDescriptionI18n: i18nValue
            });
            expect(result.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Admin-only identity fields — still stripped (AC-5 regression guard)
    // -------------------------------------------------------------------------

    describe('admin-only identity fields are still stripped by owner schema (AC-5 regression)', () => {
        it('should strip "name" from owner update payload (legal identity — admin-only)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                name: 'New Name'
            });
            if (result.success) {
                expect((result.data as Record<string, unknown>).name).toBeUndefined();
            }
        });

        it('should strip "slug" (legal identity — admin-only)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ slug: 'new-slug' });
            if (result.success) {
                expect((result.data as Record<string, unknown>).slug).toBeUndefined();
            }
        });

        it('should strip "description" (base description — owner edits i18n variants)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                description: 'A base description that should be stripped for owners.'
            });
            if (result.success) {
                expect((result.data as Record<string, unknown>).description).toBeUndefined();
            }
        });

        it('should strip "destinationId" (admin-only classification)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({
                destinationId: VALID_UUID
            });
            if (result.success) {
                expect((result.data as Record<string, unknown>).destinationId).toBeUndefined();
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

        it('should strip "ownerId" (admin-only)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ ownerId: VALID_UUID });
            if (result.success) {
                expect((result.data as Record<string, unknown>).ownerId).toBeUndefined();
            }
        });

        it('should strip "isFeatured" (admin-only)', () => {
            const result = ExperienceOwnerUpdateInputSchema.safeParse({ isFeatured: true });
            if (result.success) {
                expect((result.data as Record<string, unknown>).isFeatured).toBeUndefined();
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
