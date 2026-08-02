/**
 * Tests for the SPEC-187 richDescription field across accommodation schemas.
 *
 * Pins two invariants:
 *
 * 1. `AccommodationPublicSchema.safeParse()` RETAINS richDescription in the
 *    parsed output. Before the SPEC-187 fix the field was absent from the
 *    `.extend()` block, so Zod's unknown-key stripping silently dropped it from
 *    every public API response regardless of entitlement — making the feature
 *    dead end-to-end.
 *
 * 2. The base `AccommodationSchema` accepts both `null` (Drizzle's default for
 *    un-filled `text` columns) and `undefined` (produced by the entitlement gate
 *    when stripping the field for non-entitled owners). `.optional()` only
 *    accepts `undefined`; `.nullish()` is the correct declaration.
 *
 * @module test/entities/accommodation/accommodation.rich-description.schema
 */
import { describe, expect, it } from 'vitest';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema
} from '../../../src/entities/accommodation/accommodation.access.schema.js';
import { AccommodationSchema } from '../../../src/entities/accommodation/accommodation.schema.js';

// ---------------------------------------------------------------------------
// Shared minimal fixture — enough fields to pass every required validator
// ---------------------------------------------------------------------------

/** Complete minimal accommodation object returned by the service layer. */
const basePayload = {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    slug: 'test-accommodation',
    name: 'Test Accommodation',
    type: 'HOTEL' as const,
    summary: 'A test summary for this accommodation.',
    description:
        'A sufficiently long description for this test accommodation to satisfy min length.',
    isFeatured: false,
    destinationId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    media: null,
    location: { street: 'Test St', number: '1' },
    averageRating: 0,
    reviewsCount: 0,
    visibility: 'PUBLIC' as const,
    seo: null,
    price: null,
    tags: [],
    extraInfo: null,
    // Fields required by protected / admin schemas
    ownerId: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    contactInfo: { mobilePhone: '+15550123456' },
    lifecycleState: 'ACTIVE' as const,
    faqs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    // Admin-only fields
    moderationState: 'APPROVED' as const,
    ownerSuspended: false,
    planRestricted: false,
    createdById: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    updatedById: 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f',
    deletedAt: null,
    deletedById: null
};

const RICH_MD = '## Bienvenidos\n\nEste alojamiento cuenta con vistas increíbles.';

// ---------------------------------------------------------------------------
// 1. SPEC-187 PIN — richDescription must survive public schema serialization
// ---------------------------------------------------------------------------

describe('AccommodationPublicSchema — richDescription survival (SPEC-187)', () => {
    it('retains richDescription in the parsed output when the field is present', () => {
        const payload = { ...basePayload, richDescription: RICH_MD };

        const result = AccommodationPublicSchema.safeParse(payload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.richDescription).toBe(RICH_MD);
        }
    });

    it('retains richDescription as null when the DB value is null', () => {
        const payload = { ...basePayload, richDescription: null };

        const result = AccommodationPublicSchema.safeParse(payload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.richDescription).toBeNull();
        }
    });

    it('retains richDescription as undefined when the entitlement gate strips it', () => {
        // The entitlement gate deletes the property from the object for
        // non-entitled owners, producing undefined on the parsed result.
        const payload = { ...basePayload };

        const result = AccommodationPublicSchema.safeParse(payload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.richDescription).toBeUndefined();
        }
    });

    it('rejects richDescription values that exceed the 5000-char max', () => {
        const payload = { ...basePayload, richDescription: 'x'.repeat(5001) };

        const result = AccommodationPublicSchema.safeParse(payload);

        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('richDescription');
        }
    });
});

// ---------------------------------------------------------------------------
// 2. Base AccommodationSchema — nullish semantics for richDescription
// ---------------------------------------------------------------------------

describe('AccommodationSchema — richDescription accepts null and undefined (SPEC-187)', () => {
    it('accepts null (Drizzle default for an un-filled text column)', () => {
        const payload = { ...basePayload, richDescription: null };

        const result = AccommodationSchema.safeParse(payload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.richDescription).toBeNull();
        }
    });

    it('accepts undefined (entitlement gate strips the field to undefined)', () => {
        const payload = { ...basePayload };

        const result = AccommodationSchema.safeParse(payload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.richDescription).toBeUndefined();
        }
    });

    it('accepts a valid markdown string', () => {
        const payload = { ...basePayload, richDescription: RICH_MD };

        const result = AccommodationSchema.safeParse(payload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.richDescription).toBe(RICH_MD);
        }
    });
});

// ---------------------------------------------------------------------------
// 3. Higher-tier schemas — richDescription must also be present there
// ---------------------------------------------------------------------------

describe('AccommodationProtectedSchema — richDescription (SPEC-187)', () => {
    it('retains richDescription when present', () => {
        const payload = { ...basePayload, richDescription: RICH_MD };

        const result = AccommodationProtectedSchema.safeParse(payload);

        // BETA-199 inverted this. The note that used to sit here said the field was
        // "NOT in its output by design", which was true while `protected/getById`
        // ran no entitlement strip — declaring it would have handed premium content
        // to a non-entitled owner. That route resolves the OWNING host's
        // entitlements now, so the schema declares the field and the ROUTE gates it.
        //
        // Asserting the value, not just `success`: the previous version asserted
        // only that parsing succeeded, so it stayed green through the whole
        // inversion while its comment documented the opposite of the shipped
        // behaviour — which is how it survived the first sweep of this change.
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).richDescription).toBe(RICH_MD);
        }
    });
});

describe('AccommodationAdminSchema — richDescription (SPEC-187)', () => {
    it('retains richDescription because admin schema extends the full base schema', () => {
        const payload = { ...basePayload, richDescription: RICH_MD };

        const result = AccommodationAdminSchema.safeParse(payload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.richDescription).toBe(RICH_MD);
        }
    });

    it('accepts null from the DB layer', () => {
        const payload = { ...basePayload, richDescription: null };

        const result = AccommodationAdminSchema.safeParse(payload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.richDescription).toBeNull();
        }
    });
});
