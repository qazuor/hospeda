/**
 * venue.crud.schema.test.ts
 *
 * Unit tests for the GastronomyOwnerUpdateInputSchema and related CRUD schemas.
 * Covers SPEC-253 T-027: new owner-editable fields (type, summary, i18n) validate
 * correctly; priceFrom/priceUnit (experience-only) do NOT leak into gastronomy;
 * existing identity fields (name, slug, destinationId, etc.) are still stripped.
 *
 * DB interactions: none. Schema-only tests.
 */

import { describe, expect, it } from 'vitest';
import { VenueTypeEnum } from '../../../enums/venue-type.enum.js';
import {
    VenueAdminCreateInputSchema,
    VenueDeleteInputSchema,
    VenueOwnerCreateInputSchema,
    VenueOwnerUpdateInputSchema,
    VenueRestoreInputSchema,
    VenueUpdateInputSchema
} from '../venue.crud.schema.js';

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
    type: VenueTypeEnum.PARRILLA,
    destinationId: VALID_UUID,
    // H-88: `owner_id` is NOT NULL with no default on `gastronomies`, so a
    // create input without it is not a valid create — it is the payload that
    // reached Postgres and came back as a bare 500.
    ownerId: VALID_UUID,
    isFeatured: false,
    reviewsCount: 0,
    averageRating: 0,
    ...overrides
});

// ============================================================================
// GastronomyAdminCreateInputSchema
// ============================================================================

describe('VenueAdminCreateInputSchema', () => {
    describe('required vs optional fields', () => {
        it('should parse a valid admin create input', () => {
            const raw = buildAdminCreateInput();
            const result = VenueAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should allow omitting slug (auto-generated)', () => {
            const raw = buildAdminCreateInput({ slug: undefined });
            const result = VenueAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        // H-88. This used to assert the opposite — "should allow omitting
        // ownerId (may be assigned later)". Nothing assigns it later: the row is
        // inserted on this very call and `gastronomies.owner_id` is NOT NULL, so
        // accepting the payload here only moved the failure to Postgres, where
        // it surfaced as 500 "A database error occurred" naming no field.
        it('should REJECT omitting ownerId, naming the field (H-88)', () => {
            const raw = buildAdminCreateInput({ ownerId: undefined });
            const result = VenueAdminCreateInputSchema.safeParse(raw);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.map((i) => i.path.join('.'))).toContain('ownerId');
            }
        });

        it('should REJECT omitting destinationId, naming the field (H-88)', () => {
            const raw = buildAdminCreateInput({ destinationId: undefined });
            const result = VenueAdminCreateInputSchema.safeParse(raw);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.map((i) => i.path.join('.'))).toContain('destinationId');
            }
        });

        it('should allow optional amenityIds and featureIds (write-only)', () => {
            const raw = buildAdminCreateInput({
                amenityIds: [VALID_UUID],
                featureIds: [VALID_UUID]
            });
            const result = VenueAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(true);
        });

        it('should reject a non-UUID in amenityIds', () => {
            const raw = buildAdminCreateInput({ amenityIds: ['not-a-uuid'] });
            const result = VenueAdminCreateInputSchema.safeParse(raw);
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// GastronomyOwnerUpdateInputSchema — SPEC-253 T-027
// ============================================================================

describe('VenueOwnerUpdateInputSchema', () => {
    it('should parse an empty update (all fields optional)', () => {
        // Arrange / Act
        const result = VenueOwnerUpdateInputSchema.safeParse({});

        // Assert
        expect(result.success).toBe(true);
    });

    // -------------------------------------------------------------------------
    // SPEC-253 §3: newly owner-editable fields (T-013)
    // -------------------------------------------------------------------------

    describe('newly owner-editable fields (SPEC-253 T-013)', () => {
        it('should accept type (SPEC-253 D1: now owner-editable, removed from identity-strip)', () => {
            // Arrange
            const input = { type: VenueTypeEnum.CAFE };

            // Act
            const result = VenueOwnerUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe(VenueTypeEnum.CAFE);
            }
        });

        it('should accept all venue type enum values', () => {
            for (const type of Object.values(VenueTypeEnum)) {
                const result = VenueOwnerUpdateInputSchema.safeParse({ type });
                expect(result.success).toBe(true);
            }
        });

        it('should reject an invalid type value', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ type: 'INVALID_TYPE' });
            expect(result.success).toBe(false);
        });

        it('should accept summary within valid length bounds (10–300 chars)', () => {
            // Arrange
            const input = { summary: 'Un resumen válido con más de diez caracteres para el test.' };

            // Act
            const result = VenueOwnerUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.summary).toBe(input.summary);
            }
        });

        it('should reject summary shorter than 10 characters', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ summary: 'Corto' });
            expect(result.success).toBe(false);
        });

        it('should reject summary longer than 300 characters', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({
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
            const result = VenueOwnerUpdateInputSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.nameI18n).toEqual(i18nValue);
            }
        });

        it('should accept summaryI18n with valid locale keys', () => {
            const i18nValue = { es: 'Resumen ES', en: 'Summary EN', pt: 'Resumo PT' };
            const result = VenueOwnerUpdateInputSchema.safeParse({ summaryI18n: i18nValue });
            expect(result.success).toBe(true);
        });

        it('should accept descriptionI18n with valid locale keys', () => {
            const i18nValue = { es: 'Descripción ES', en: 'Description EN', pt: 'Descrição PT' };
            const result = VenueOwnerUpdateInputSchema.safeParse({
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
            const result = VenueOwnerUpdateInputSchema.safeParse({
                richDescriptionI18n: i18nValue
            });
            expect(result.success).toBe(true);
        });

        it('should accept all four i18n fields simultaneously', () => {
            const i18nValue = { es: 'Texto ES', en: 'Text EN', pt: 'Texto PT' };
            const result = VenueOwnerUpdateInputSchema.safeParse({
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
        it('should accept priceRange (venue-specific operational field)', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ priceRange: 'MID' });
            expect(result.success).toBe(true);
        });

        it('should accept menuUrl as a valid HTTPS URL', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({
                menuUrl: 'https://example.com/menu'
            });
            expect(result.success).toBe(true);
        });

        it('should reject menuUrl that is not an HTTPS URL', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({
                menuUrl: 'http://example.com/menu'
            });
            expect(result.success).toBe(false);
        });

        it('should accept amenityIds as an array of UUIDs', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ amenityIds: [VALID_UUID] });
            expect(result.success).toBe(true);
        });

        it('should accept featureIds as an array of UUIDs', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ featureIds: [VALID_UUID] });
            expect(result.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // SPEC-253 T-027: priceFrom/priceUnit must NOT be in GastronomyOwnerUpdateInputSchema
    // (experience-only fields — they must not leak into gastronomy schema)
    // -------------------------------------------------------------------------

    describe('experience-only fields MUST NOT appear in venue owner update (SPEC-253 T-027)', () => {
        it('should strip priceFrom silently (experience-only field — not valid for venue)', () => {
            // Arrange: priceFrom is experience-only; if present in a gastronomy payload
            // it must be stripped by Zod's unknown-key stripping behaviour.
            const result = VenueOwnerUpdateInputSchema.safeParse({
                priceFrom: 100000 // experience-only — must be stripped
            } as Record<string, unknown>);

            // Assert: schema parses successfully (strips unknown key, not rejected)
            expect(result.success).toBe(true);
            if (result.success) {
                // priceFrom must NOT appear in parsed output
                expect((result.data as Record<string, unknown>).priceFrom).toBeUndefined();
            }
        });

        it('should strip priceUnit silently (experience-only field — not valid for venue)', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({
                priceUnit: 'per_person' // experience-only — must be stripped
            } as Record<string, unknown>);

            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).priceUnit).toBeUndefined();
            }
        });
    });

    // -------------------------------------------------------------------------
    // HOS-166 D-1: identity fields are now owner-editable (reverses SPEC-239 #5)
    // -------------------------------------------------------------------------

    describe('owner-editable identity fields (HOS-166 D-1)', () => {
        it('should accept and persist "name" (owner now controls identity)', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ name: 'New Name' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('New Name');
            }
        });

        it('should accept and persist "description" (owner now controls identity)', () => {
            const description =
                'A long base description that is now valid for an owner-submitted payload.';
            const result = VenueOwnerUpdateInputSchema.safeParse({ description });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.description).toBe(description);
            }
        });

        it('should accept and persist "destinationId" (owner now controls identity)', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({
                destinationId: VALID_UUID
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBe(VALID_UUID);
            }
        });
    });

    // -------------------------------------------------------------------------
    // Admin-only fields — still stripped (AC-19 regression guard)
    // -------------------------------------------------------------------------

    describe('admin-only control + immutable-identity fields are still stripped (AC-19)', () => {
        it('should strip "slug" (immutable post-create — HOS-166 OQ-3)', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ slug: 'new-slug' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).slug).toBeUndefined();
            }
        });

        it('should strip "ownerId" (admin-only)', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ ownerId: VALID_UUID });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).ownerId).toBeUndefined();
            }
        });

        it('should strip "isFeatured" (admin-only)', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({ isFeatured: true });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).isFeatured).toBeUndefined();
            }
        });

        it('should strip "publicationStatus" (control field — only the PB transitions write it)', () => {
            const result = VenueOwnerUpdateInputSchema.safeParse({
                publicationStatus: 'PUBLISHED'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).publicationStatus).toBeUndefined();
            }
        });
    });
});

// ============================================================================
// GastronomyOwnerCreateInputSchema — HOS-166 §7.2
// ============================================================================

describe('VenueOwnerCreateInputSchema', () => {
    const buildOwnerCreateInput = (
        overrides: Record<string, unknown> = {}
    ): Record<string, unknown> => ({
        name: 'La Parrilla del Sur',
        summary: 'La mejor parrilla de la ciudad, con productos de campo.',
        description:
            'Un espacio único para disfrutar de la mejor gastronomía rioplatense con carnes seleccionadas y vinos de la región.',
        type: VenueTypeEnum.PARRILLA,
        ...overrides
    });

    it('should parse a valid owner create input', () => {
        const result = VenueOwnerCreateInputSchema.safeParse(buildOwnerCreateInput());
        expect(result.success).toBe(true);
    });

    it('should allow omitting destinationId (checked at publish time, not create — §6.6)', () => {
        const result = VenueOwnerCreateInputSchema.safeParse(
            buildOwnerCreateInput({ destinationId: undefined })
        );
        expect(result.success).toBe(true);
    });

    it('should strip "ownerId" even if supplied — the route forces actor.id (D-3)', () => {
        const result = VenueOwnerCreateInputSchema.safeParse(
            buildOwnerCreateInput({ ownerId: VALID_UUID })
        );
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).ownerId).toBeUndefined();
        }
    });

    it('should strip "slug" even if supplied — derived server-side from name (OQ-3)', () => {
        const result = VenueOwnerCreateInputSchema.safeParse(
            buildOwnerCreateInput({ slug: 'owner-chosen-slug' })
        );
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).slug).toBeUndefined();
        }
    });

    it('should strip "publicationStatus" even if supplied — a listing is born DRAFT (D-3, HOS-1641)', () => {
        const result = VenueOwnerCreateInputSchema.safeParse(
            buildOwnerCreateInput({ publicationStatus: 'PUBLISHED' })
        );
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).publicationStatus).toBeUndefined();
        }
    });

    it('should strip "isFeatured" even if supplied (control field)', () => {
        const result = VenueOwnerCreateInputSchema.safeParse(
            buildOwnerCreateInput({ isFeatured: true })
        );
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).isFeatured).toBeUndefined();
        }
    });

    it('should accept optional amenityIds and featureIds (write-only)', () => {
        const result = VenueOwnerCreateInputSchema.safeParse(
            buildOwnerCreateInput({ amenityIds: [VALID_UUID], featureIds: [VALID_UUID] })
        );
        expect(result.success).toBe(true);
    });
});

// ============================================================================
// GastronomyUpdateInputSchema (admin PATCH)
// ============================================================================

describe('VenueUpdateInputSchema', () => {
    it('should parse an empty partial update', () => {
        const result = VenueUpdateInputSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should allow partial update of type', () => {
        const result = VenueUpdateInputSchema.safeParse({
            type: VenueTypeEnum.RESTAURANT
        });
        expect(result.success).toBe(true);
    });

    it('should allow partial update of priceRange', () => {
        const result = VenueUpdateInputSchema.safeParse({ priceRange: 'HIGH' });
        expect(result.success).toBe(true);
    });

    it('should strip ownerId (server-managed — use dedicated endpoint)', () => {
        const result = VenueUpdateInputSchema.safeParse({ name: 'Updated Name' });
        if (result.success) {
            expect((result.data as Record<string, unknown>).ownerId).toBeUndefined();
        }
    });

    it('HOS-382 regression: silently strips a `media` object instead of rejecting it', () => {
        // The admin panel used to submit `media.featuredImage` / `media.gallery`
        // as a nested `media` object on PATCH. The `media` JSONB column was
        // dropped from the `gastronomies` table (HOS-372), so this schema omits
        // `media` from its shape entirely — but since the schema is NOT `.strict()`,
        // Zod's default object mode ('strip') drops the unknown `media` key rather
        // than failing validation. That silent-strip behaviour is exactly what let
        // uploaded photos vanish: the binary reached Cloudinary but the DB write
        // never happened, and neither the client nor the server ever saw an error.
        const result = VenueUpdateInputSchema.safeParse({
            name: 'Updated Name',
            media: {
                featuredImage: { url: 'https://example.com/photo.jpg' },
                gallery: [{ url: 'https://example.com/photo2.jpg' }]
            }
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).media).toBeUndefined();
        }
    });
});

// ============================================================================
// GastronomyDeleteInputSchema
// ============================================================================

describe('VenueDeleteInputSchema', () => {
    it('should parse with id and default force=false', () => {
        // Arrange / Act
        const result = VenueDeleteInputSchema.safeParse({ id: VALID_UUID });

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.force).toBe(false);
        }
    });

    it('should parse with force=true for hard delete', () => {
        const result = VenueDeleteInputSchema.safeParse({ id: VALID_UUID, force: true });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.force).toBe(true);
        }
    });

    it('should reject a non-UUID id', () => {
        const result = VenueDeleteInputSchema.safeParse({ id: 'invalid' });
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// GastronomyRestoreInputSchema
// ============================================================================

describe('VenueRestoreInputSchema', () => {
    it('should parse a valid UUID id', () => {
        const result = VenueRestoreInputSchema.safeParse({ id: VALID_UUID });
        expect(result.success).toBe(true);
    });

    it('should reject a non-UUID id', () => {
        const result = VenueRestoreInputSchema.safeParse({ id: 'bad-id' });
        expect(result.success).toBe(false);
    });
});
