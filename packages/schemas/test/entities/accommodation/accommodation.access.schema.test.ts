/**
 * Tests for accommodation access schemas (public / protected / admin).
 *
 * Pins the SPEC-167 invariant: `archivedGallery` MUST be stripped from
 * the public and protected response schemas and MUST be present on the
 * admin schema (which uses the full entity type).
 *
 * @module test/entities/accommodation/accommodation.access.schema
 */
import { describe, expect, it } from 'vitest';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema
} from '../../../src/entities/accommodation/accommodation.access.schema.js';

// ---------------------------------------------------------------------------
// Minimal entity fixture that includes archivedGallery in media
// ---------------------------------------------------------------------------

const archivedPhoto = {
    url: 'https://cdn.example.com/archived-1.jpg',
    moderationState: 'APPROVED' as const
};

const activePhoto = {
    url: 'https://cdn.example.com/active-1.jpg',
    moderationState: 'APPROVED' as const
};

/** Minimal accommodation payload that a service would return. */
const entityPayload = {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    slug: 'test-accommodation',
    name: 'Test Accommodation',
    type: 'HOTEL' as const,
    summary: 'A test summary for this accommodation.',
    description:
        'A sufficiently long description for this test accommodation to satisfy min length.',
    isFeatured: false,
    destinationId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    media: {
        gallery: [activePhoto],
        archivedGallery: [archivedPhoto]
    },
    location: {
        street: 'Test St',
        number: '1'
    },
    averageRating: 0,
    reviewsCount: 0,
    visibility: 'PUBLIC' as const,
    seo: null,
    price: null,
    tags: [],
    extraInfo: null,
    // Additional fields needed for protected / admin schemas
    ownerId: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    contactInfo: { mobilePhone: '+15550123456' },
    lifecycleState: 'ACTIVE' as const,
    faqs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    // Admin / full entity fields
    moderationState: 'APPROVED' as const,
    ownerSuspended: false,
    planRestricted: false,
    createdById: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    updatedById: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    deletedAt: null,
    deletedById: null
};

// ---------------------------------------------------------------------------
// SPEC-167 PIN: archivedGallery must not leak to public / protected consumers
// ---------------------------------------------------------------------------

describe('AccommodationPublicSchema — archivedGallery strip (SPEC-167)', () => {
    it('strips archivedGallery from media when parsing an entity payload', () => {
        const result = AccommodationPublicSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(
                (result.data.media as Record<string, unknown> | null | undefined)?.archivedGallery
            ).toBeUndefined();
        }
    });

    it('preserves active gallery photos after stripping archivedGallery', () => {
        const result = AccommodationPublicSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.media?.gallery).toHaveLength(1);
            expect(result.data.media?.gallery?.[0]?.url).toBe(activePhoto.url);
        }
    });
});

describe('AccommodationProtectedSchema — archivedGallery strip (SPEC-167)', () => {
    it('strips archivedGallery from media when parsing an entity payload', () => {
        const result = AccommodationProtectedSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(
                (result.data.media as Record<string, unknown> | null | undefined)?.archivedGallery
            ).toBeUndefined();
        }
    });

    it('preserves active gallery photos after stripping archivedGallery', () => {
        const result = AccommodationProtectedSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.media?.gallery).toHaveLength(1);
            expect(result.data.media?.gallery?.[0]?.url).toBe(activePhoto.url);
        }
    });
});

describe('AccommodationAdminSchema — archivedGallery preserved (SPEC-167)', () => {
    it('retains archivedGallery in media (admin consumers may need it for restore ops)', () => {
        const result = AccommodationAdminSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(
                (result.data.media as Record<string, unknown> | null | undefined)?.archivedGallery
            ).toBeDefined();
            expect(
                (result.data.media as { archivedGallery?: Array<unknown> } | null | undefined)
                    ?.archivedGallery
            ).toHaveLength(1);
        }
    });
});

// ---------------------------------------------------------------------------
// socialNetworks inclusion in access schemas
// ---------------------------------------------------------------------------

const entityWithSocialNetworks = {
    ...entityPayload,
    socialNetworks: {
        facebook: 'https://facebook.com/test',
        instagram: 'https://instagram.com/test'
    }
};

describe('socialNetworks in access schemas', () => {
    it('includes socialNetworks in AccommodationPublicSchema', () => {
        const result = AccommodationPublicSchema.safeParse(entityWithSocialNetworks);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.socialNetworks).toEqual({
                facebook: 'https://facebook.com/test',
                instagram: 'https://instagram.com/test'
            });
        }
    });

    it('includes socialNetworks in AccommodationProtectedSchema', () => {
        const result = AccommodationProtectedSchema.safeParse(entityWithSocialNetworks);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.socialNetworks).toEqual({
                facebook: 'https://facebook.com/test',
                instagram: 'https://instagram.com/test'
            });
        }
    });

    it('includes socialNetworks in AccommodationAdminSchema', () => {
        const result = AccommodationAdminSchema.safeParse(entityWithSocialNetworks);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.socialNetworks).toEqual({
                facebook: 'https://facebook.com/test',
                instagram: 'https://instagram.com/test'
            });
        }
    });

    it('handles undefined socialNetworks gracefully in public schema', () => {
        const result = AccommodationPublicSchema.safeParse(entityPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.socialNetworks).toBeUndefined();
        }
    });
});

// ---------------------------------------------------------------------------
// extraInfo tolerance for incomplete DRAFT data (HOS-152)
// ---------------------------------------------------------------------------
//
// A host-onboarding DRAFT can legitimately have a PARTIAL (or entirely
// absent) `extraInfo` — the onboarding form lets the host fill in capacity
// data incrementally across multiple PATCHes. Before the fix, `extraInfo`
// required `capacity`/`minNights`/`bedrooms`/`bathrooms`, so GET/PATCH on
// such a draft 500'd with "Response payload does not match declared schema".
// Completeness is now enforced only at publish time
// (`AccommodationExtraInfoRequiredForPublishSchema`, exercised in
// `packages/service-core/test/services/accommodation/publish.test.ts`).

const draftEntityPayload = {
    ...entityPayload,
    lifecycleState: 'DRAFT' as const,
    visibility: 'PRIVATE' as const
};

describe('AccommodationProtectedSchema — extraInfo tolerance for DRAFT data (HOS-152)', () => {
    it('accepts extraInfo missing minNights/bedrooms/bathrooms (only capacity provided)', () => {
        const payload = { ...draftEntityPayload, extraInfo: { capacity: 4 } };
        const result = AccommodationProtectedSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.extraInfo?.capacity).toBe(4);
            expect(result.data.extraInfo?.minNights).toBeUndefined();
            expect(result.data.extraInfo?.bedrooms).toBeUndefined();
            expect(result.data.extraInfo?.bathrooms).toBeUndefined();
        }
    });

    it('accepts an entirely absent extraInfo (brand-new draft)', () => {
        const payload = { ...draftEntityPayload, extraInfo: undefined };
        const result = AccommodationProtectedSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// mobilePhone tolerance for legacy records (HOS-190)
// ---------------------------------------------------------------------------
//
// `ContactInfoSchema.mobilePhone` used to be the only required field on an
// otherwise fully-optional schema. A legacy accommodation persisted before
// `mobilePhone` collection was mandatory (or one edited to remove it) failed
// the read schema with a 500 ("Response payload does not match declared
// schema"), fail-closed-locking the host out of both viewing AND editing the
// listing (PATCH parses the same response schema on the way back out).
// `mobilePhone` is now `.optional()` end-to-end (product decision: it is not
// required for any accommodation to function), which is exactly the case
// this test pins.

describe('AccommodationProtectedSchema — mobilePhone tolerance for legacy records (HOS-190)', () => {
    it('accepts a contactInfo missing mobilePhone entirely', () => {
        const payload = { ...entityPayload, contactInfo: { personalEmail: 'legacy@example.com' } };
        const result = AccommodationProtectedSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.contactInfo?.mobilePhone).toBeUndefined();
            expect(result.data.contactInfo?.personalEmail).toBe('legacy@example.com');
        }
    });

    it('accepts an entirely absent contactInfo', () => {
        const payload = { ...entityPayload, contactInfo: undefined };
        const result = AccommodationProtectedSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// slug tolerance for long onboarding-generated slugs (BETA-172)
// ---------------------------------------------------------------------------
//
// Before the fix, `AccommodationService.generateSlug` could produce slugs
// longer than the write schema's `max(50)` for accommodations onboarded via
// `/publicar` with a long imported name. Once persisted, that slug value
// failed to parse against the read schemas (`path=[slug] code=too_big`),
// causing "Mis propiedades" to 500. The root cause is now fixed at
// generation time (slug is truncated to 50 chars), but the read schemas
// must still tolerate any slug already persisted before the fix.

describe('AccommodationProtectedSchema / AccommodationAdminSchema — slug tolerance (BETA-172)', () => {
    const longSlugPayload = {
        ...entityPayload,
        slug: 'a-very-long-slug-that-exceeds-the-fifty-character-limit-abc'
    };

    it('the fixture slug is longer than the write schema max(50), confirming the regression scenario', () => {
        expect(longSlugPayload.slug.length).toBeGreaterThan(50);
    });

    it('AccommodationProtectedSchema accepts a 60-char slug', () => {
        const result = AccommodationProtectedSchema.safeParse(longSlugPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe(longSlugPayload.slug);
        }
    });

    it('AccommodationAdminSchema accepts a 60-char slug', () => {
        const result = AccommodationAdminSchema.safeParse(longSlugPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe(longSlugPayload.slug);
        }
    });

    it('AccommodationPublicSchema accepts a 60-char slug', () => {
        const result = AccommodationPublicSchema.safeParse(longSlugPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe(longSlugPayload.slug);
        }
    });
});

describe('AccommodationAdminSchema — extraInfo tolerance for DRAFT data (HOS-152)', () => {
    it('accepts extraInfo missing minNights/bedrooms/bathrooms (only capacity provided)', () => {
        const payload = { ...draftEntityPayload, extraInfo: { capacity: 4 } };
        const result = AccommodationAdminSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.extraInfo?.capacity).toBe(4);
            expect(result.data.extraInfo?.minNights).toBeUndefined();
            expect(result.data.extraInfo?.bedrooms).toBeUndefined();
            expect(result.data.extraInfo?.bathrooms).toBeUndefined();
        }
    });

    it('accepts an entirely absent extraInfo (brand-new draft)', () => {
        const payload = { ...draftEntityPayload, extraInfo: undefined };
        const result = AccommodationAdminSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// HOS-190: read⊇write — the response schema must never 500 on a legacy/imported
// value the write path no longer allows (stripWithSchema fail-closes to HTTP
// 500, which locks the owner out of editing the ENTIRE accommodation).
// ---------------------------------------------------------------------------

describe('Accommodation read⊇write (HOS-190)', () => {
    it('Protected: parses a legacy SEO block below the write min bounds (host cannot self-heal SEO)', () => {
        const payload = { ...entityPayload, seo: { title: 'Short', description: 'Too short' } };
        expect(AccommodationProtectedSchema.safeParse(payload).success).toBe(true);
    });

    it('Protected: parses an AR local-format phone lacking the international "+" prefix', () => {
        const payload = { ...entityPayload, contactInfo: { mobilePhone: '0223-155-1234' } };
        expect(AccommodationProtectedSchema.safeParse(payload).success).toBe(true);
    });

    it('Protected: parses a legacy/"consultar" price of 0 (write requires positive)', () => {
        const payload = { ...entityPayload, price: { price: 0, currency: 'ARS' as const } };
        expect(AccommodationProtectedSchema.safeParse(payload).success).toBe(true);
    });

    it('Protected: parses a NESTED fee/discount price of 0 (same bug class one level deeper)', () => {
        const payload = {
            ...entityPayload,
            price: {
                price: 120,
                currency: 'ARS' as const,
                additionalFees: { cleaning: { price: 0, isIncluded: true } },
                discounts: { weekly: { price: 0, isPercent: true } }
            }
        };
        expect(AccommodationProtectedSchema.safeParse(payload).success).toBe(true);
    });

    it('Protected: parses a legacy custom "others" fee with a 1-char name (price + name relaxed)', () => {
        const payload = {
            ...entityPayload,
            price: {
                price: 120,
                currency: 'ARS' as const,
                additionalFees: { others: [{ name: 'x', price: 0 }] }
            }
        };
        expect(AccommodationProtectedSchema.safeParse(payload).success).toBe(true);
    });

    it('Protected: parses a 1-char name and a very short summary/description (legacy/import)', () => {
        const payload = { ...entityPayload, name: 'A', summary: 'hi', description: 'x' };
        expect(AccommodationProtectedSchema.safeParse(payload).success).toBe(true);
    });

    it('Protected: parses a non-canonical social URL that fails the platform regex', () => {
        const payload = {
            ...entityPayload,
            socialNetworks: { facebook: 'https://m.facebook.com/x' }
        };
        expect(AccommodationProtectedSchema.safeParse(payload).success).toBe(true);
    });

    it('Public: parses the same legacy SEO/price/name so the public page never 500s', () => {
        const payload = {
            ...entityPayload,
            seo: { title: 'Short', description: 'Too short' },
            price: { price: 0, currency: 'ARS' as const },
            name: 'A'
        };
        expect(AccommodationPublicSchema.safeParse(payload).success).toBe(true);
    });

    it('Admin: parses a legacy local-format phone and short SEO', () => {
        const payload = {
            ...entityPayload,
            seo: { title: 'x', description: 'y' },
            contactInfo: { mobilePhone: '0223-155-1234' }
        };
        expect(AccommodationAdminSchema.safeParse(payload).success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// BETA-186: the OWNER's editor reads *I18n translations off the protected
// schema to drive the TranslationPanel. Before the fix the protected schema
// omitted them, so stripWithSchema deleted the DB auto-translations and the
// panel showed "—" for en/pt even when the DB had them. name/summary/description
// I18n are the SAME translations the public schema already exposes ungated;
// richDescriptionI18n stays out (premium, protected route lacks the strip).
// ---------------------------------------------------------------------------

describe('AccommodationProtectedSchema — i18n translation fields for the editor (BETA-186)', () => {
    const i18nPayload = {
        ...entityPayload,
        nameI18n: { es: 'Hotel', en: 'Hotel', pt: 'Hotel' },
        summaryI18n: { es: 'Resumen', en: 'Summary', pt: 'Resumo' },
        descriptionI18n: { es: 'Descripción', en: 'Description', pt: 'Descrição' },
        richDescriptionI18n: { es: 'Rico', en: 'Rich', pt: 'Rico' }
    };

    it('preserves nameI18n/summaryI18n/descriptionI18n (so the panel shows en/pt as present)', () => {
        const result = AccommodationProtectedSchema.safeParse(i18nPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            expect(data.nameI18n).toEqual({ es: 'Hotel', en: 'Hotel', pt: 'Hotel' });
            expect(data.summaryI18n).toEqual({ es: 'Resumen', en: 'Summary', pt: 'Resumo' });
            expect(data.descriptionI18n).toEqual({
                es: 'Descripción',
                en: 'Description',
                pt: 'Descrição'
            });
        }
    });

    it('does NOT expose richDescriptionI18n (premium; protected route lacks the entitlement strip)', () => {
        const result = AccommodationProtectedSchema.safeParse(i18nPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).richDescriptionI18n).toBeUndefined();
        }
    });

    it('the public schema exposes the same three ungated I18n fields (parity — safe to surface to the owner)', () => {
        const result = AccommodationPublicSchema.safeParse(i18nPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            expect(data.nameI18n).toBeDefined();
            expect(data.summaryI18n).toBeDefined();
            expect(data.descriptionI18n).toBeDefined();
        }
    });

    it('read⊇write (HOS-190): a PARTIAL i18n value (only es) must NOT fail-close the owner GET to 500', () => {
        // The strict I18nTextSchema requires a complete {es,en,pt} triple. A
        // legacy/imported/partial value must parse (stripWithSchema fail-closes to
        // 500 otherwise, locking the owner out of editing every accommodation).
        const partialPayload = {
            ...entityPayload,
            summaryI18n: { es: 'Solo español' },
            nameI18n: { es: 'Nombre', en: null },
            descriptionI18n: null
        };
        const result = AccommodationProtectedSchema.safeParse(partialPayload);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            expect((data.summaryI18n as Record<string, unknown>).es).toBe('Solo español');
            expect((data.summaryI18n as Record<string, unknown>).en).toBeUndefined();
        }
    });
});
