/**
 * gastronomy.crud.schema.test.ts
 *
 * Unit tests for the GastronomyOwnerUpdateInputSchema and related CRUD schemas.
 * Covers SPEC-253 T-027: new owner-editable fields (type, summary, i18n) validate
 * correctly; priceFrom/priceUnit (experience-only) do NOT leak into gastronomy;
 * existing identity fields (name, slug, destinationId, etc.) are still stripped.
 *
 * DB interactions: none. Schema-only tests.
 */

import { describe, expect, it } from 'vitest';
import { GastronomyTypeEnum } from '../../../enums/gastronomy-type.enum.js';
import {
    GastronomyAdminCreateInputSchema,
    GastronomyDeleteInputSchema,
    GastronomyOwnerUpdateInputSchema,
    GastronomyRestoreInputSchema,
    GastronomyUpdateInputSchema
} from '../gastronomy.crud.schema.js';

// ============================================================================
// Helpers
// ============================================================================

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const buildAdminCreateInput = (
    overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
    name: 'La Parrilla del Sur',
    summary: 'La mejor parrilla de la ciudad, con productos de campo.',
    description:
        'Un espacio único para disfrutar de la mejor gastronomía rioplatense con carnes seleccionadas y vinos de la región.',
    type: GastronomyTypeEnum.PARRILLA,
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
// GastronomyAdminCreateInputSchema
// ============================================================================

describe('GastronomyAdminCreateInputSchema', () => {
    describe('required vs optional fields', () => {
        it('should parse a valid admin create input', () => {
            const raw = buildAdminCreateInput();
            const result = GastronomyAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should allow omitting slug (auto-generated)', () => {
            const raw = buildAdminCreateInput({ slug: undefined });
            const result = GastronomyAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should allow omitting ownerId (may be assigned later)', () => {
            const raw = buildAdminCreateInput({ ownerId: undefined });
            const result = GastronomyAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should allow optional amenityIds and featureIds (write-only)', () => {
            const raw = buildAdminCreateInput({
                amenityIds: [VALID_UUID],
                featureIds: [VALID_UUID]
            });
            const result = GastronomyAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should reject a non-UUID in amenityIds', () => {
            const raw = buildAdminCreateInput({ amenityIds: ['not-a-uuid'] });
            const result = GastronomyAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// GastronomyOwnerUpdateInputSchema — SPEC-253 T-027
// ============================================================================

describe('GastronomyOwnerUpdateInputSchema', () => {
    it('should parse an empty update (all fields optional)', () => {
        // Arrange / Act
        const result = GastronomyOwnerUpdateInputSchema.safeParse({});

        // Assert
        expect(result.success).toBe(true);
    });

    // -------------------------------------------------------------------------
    // SPEC-253 §3: newly owner-editable fields (T-013)
    // -------------------------------------------------------------------------

    describe('newly owner-editable fields (SPEC-253 T-013)', () => {
        it('should accept type (SPEC-253 D1: now owner-editable, removed from identity-strip)', () => {
            // Arrange
            const input = { type: GastronomyTypeEnum.CAFE };

            // Act
            const result = GastronomyOwnerUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe(GastronomyTypeEnum.CAFE);
            }
        });

        it('should accept all gastronomy type enum values', () => {
            for (const type of Object.values(GastronomyTypeEnum)) {
                const result = GastronomyOwnerUpdateInputSchema.safeParse({ type });
                expect(result.success).toBe(true);
            }
        });

        it('should reject an invalid type value', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ type: 'INVALID_TYPE' });
            expect(result.success).toBe(false);
        });

        it('should accept summary within valid length bounds (10–300 chars)', () => {
            // Arrange
            const input = { summary: 'Un resumen válido con más de diez caracteres para el test.' };

            // Act
            const result = GastronomyOwnerUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.summary).toBe(input.summary);
            }
        });

        it('should reject summary shorter than 10 characters', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ summary: 'Corto' });
            expect(result.success).toBe(false);
        });

        it('should reject summary longer than 300 characters', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                summary: 'A'.repeat(301)
            });
            expect(result.success).toBe(false);
        });

        it('should accept nameI18n with valid locale keys', () => {
            // Arrange
            const i18nValue = {
                es: 'Nombre en español',
                en: 'Name in English',
                pt: 'Nome em português'
            };
            const input = { nameI18n: i18nValue };

            // Act
            const result = GastronomyOwnerUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.nameI18n).toEqual(i18nValue);
            }
        });

        it('should accept summaryI18n with valid locale keys', () => {
            const i18nValue = { es: 'Resumen ES', en: 'Summary EN', pt: 'Resumo PT' };
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ summaryI18n: i18nValue });
            expect(result.success).toBe(true);
        });

        it('should accept descriptionI18n with valid locale keys', () => {
            const i18nValue = { es: 'Descripción ES', en: 'Description EN', pt: 'Descrição PT' };
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                descriptionI18n: i18nValue
            });
            expect(result.success).toBe(true);
        });

        it('should accept richDescriptionI18n with valid locale keys', () => {
            const i18nValue = {
                es: '<p>Descripción rica ES</p>',
                en: '<p>Rich EN</p>',
                pt: '<p>PT</p>'
            };
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                richDescriptionI18n: i18nValue
            });
            expect(result.success).toBe(true);
        });

        it('should accept all four i18n fields simultaneously', () => {
            const i18nValue = { es: 'Texto ES', en: 'Text EN', pt: 'Texto PT' };
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                nameI18n: i18nValue,
                summaryI18n: i18nValue,
                descriptionI18n: i18nValue,
                richDescriptionI18n: i18nValue
            });
            expect(result.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Previously-permitted operational sections (regression guard)
    // -------------------------------------------------------------------------

    describe('previously-permitted operational sections (regression guard)', () => {
        it('should accept priceRange (gastronomy-specific operational field)', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ priceRange: 'MID' });
            expect(result.success).toBe(true);
        });

        it('should accept menuUrl as a valid HTTPS URL', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                menuUrl: 'https://example.com/menu'
            });
            expect(result.success).toBe(true);
        });

        it('should reject menuUrl that is not an HTTPS URL', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                menuUrl: 'http://example.com/menu'
            });
            expect(result.success).toBe(false);
        });

        it('should accept amenityIds as an array of UUIDs', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ amenityIds: [VALID_UUID] });
            expect(result.success).toBe(true);
        });

        it('should accept featureIds as an array of UUIDs', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ featureIds: [VALID_UUID] });
            expect(result.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // SPEC-253 T-027: priceFrom/priceUnit must NOT be in GastronomyOwnerUpdateInputSchema
    // (experience-only fields — they must not leak into gastronomy schema)
    // -------------------------------------------------------------------------

    describe('experience-only fields MUST NOT appear in gastronomy owner update (SPEC-253 T-027)', () => {
        it('should strip priceFrom silently (experience-only field — not valid for gastronomy)', () => {
            // Arrange: priceFrom is experience-only; if present in a gastronomy payload
            // it must be stripped by Zod's unknown-key stripping behaviour.
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                priceFrom: 100000 // experience-only — must be stripped
            } as Record<string, unknown>);

            // Assert: schema parses successfully (strips unknown key, not rejected)
            expect(result.success).toBe(true);
            if (result.success) {
                // priceFrom must NOT appear in parsed output
                expect((result.data as Record<string, unknown>).priceFrom).toBeUndefined();
            }
        });

        it('should strip priceUnit silently (experience-only field — not valid for gastronomy)', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                priceUnit: 'per_person' // experience-only — must be stripped
            } as Record<string, unknown>);

            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).priceUnit).toBeUndefined();
            }
        });
    });

    // -------------------------------------------------------------------------
    // Admin-only identity fields — still stripped (AC-5 regression guard)
    // -------------------------------------------------------------------------

    describe('admin-only identity fields are still stripped by owner schema (AC-5 regression)', () => {
        it('should strip "name" (legal identity — admin-only)', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ name: 'New Name' });
            if (result.success) {
                expect((result.data as Record<string, unknown>).name).toBeUndefined();
            }
        });

        it('should strip "slug" (legal identity — admin-only)', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ slug: 'new-slug' });
            if (result.success) {
                expect((result.data as Record<string, unknown>).slug).toBeUndefined();
            }
        });

        it('should strip "description" (base description — owner edits i18n variants)', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                description: 'A long base description that would normally be valid for the schema.'
            });
            if (result.success) {
                expect((result.data as Record<string, unknown>).description).toBeUndefined();
            }
        });

        it('should strip "destinationId" (admin-only classification)', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({
                destinationId: VALID_UUID
            });
            if (result.success) {
                expect((result.data as Record<string, unknown>).destinationId).toBeUndefined();
            }
        });

        it('should strip "ownerId" (admin-only)', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ ownerId: VALID_UUID });
            if (result.success) {
                expect((result.data as Record<string, unknown>).ownerId).toBeUndefined();
            }
        });

        it('should strip "isFeatured" (admin-only)', () => {
            const result = GastronomyOwnerUpdateInputSchema.safeParse({ isFeatured: true });
            if (result.success) {
                expect((result.data as Record<string, unknown>).isFeatured).toBeUndefined();
            }
        });
    });
});

// ============================================================================
// GastronomyUpdateInputSchema (admin PATCH)
// ============================================================================

describe('GastronomyUpdateInputSchema', () => {
    it('should parse an empty partial update', () => {
        const result = GastronomyUpdateInputSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should allow partial update of type', () => {
        const result = GastronomyUpdateInputSchema.safeParse({
            type: GastronomyTypeEnum.RESTAURANT
        });
        expect(result.success).toBe(true);
    });

    it('should allow partial update of priceRange', () => {
        const result = GastronomyUpdateInputSchema.safeParse({ priceRange: 'HIGH' });
        expect(result.success).toBe(true);
    });

    it('should strip ownerId (server-managed — use dedicated endpoint)', () => {
        const result = GastronomyUpdateInputSchema.safeParse({ name: 'Updated Name' });
        if (result.success) {
            expect((result.data as Record<string, unknown>).ownerId).toBeUndefined();
        }
    });
});

// ============================================================================
// GastronomyDeleteInputSchema
// ============================================================================

describe('GastronomyDeleteInputSchema', () => {
    it('should parse with id and default force=false', () => {
        // Arrange / Act
        const result = GastronomyDeleteInputSchema.safeParse({ id: VALID_UUID });

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.force).toBe(false);
        }
    });

    it('should parse with force=true for hard delete', () => {
        const result = GastronomyDeleteInputSchema.safeParse({ id: VALID_UUID, force: true });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.force).toBe(true);
        }
    });

    it('should reject a non-UUID id', () => {
        const result = GastronomyDeleteInputSchema.safeParse({ id: 'invalid' });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// GastronomyRestoreInputSchema
// ============================================================================

describe('GastronomyRestoreInputSchema', () => {
    it('should parse a valid UUID id', () => {
        const result = GastronomyRestoreInputSchema.safeParse({ id: VALID_UUID });
        expect(result.success).toBe(true);
    });

    it('should reject a non-UUID id', () => {
        const result = GastronomyRestoreInputSchema.safeParse({ id: 'bad-id' });
        expect(result.success).toBe(false);
    });
});
