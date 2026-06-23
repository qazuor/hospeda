/**
 * Regression tests for SPEC-210 PR4 — sponsorship catalog public schemas.
 *
 * The sponsorship-level / sponsorship-package public route handlers exist but are
 * NOT mounted in the public router (decision: SPEC-210 is a security spec and must
 * not expose new public endpoints). These schemas are added preventively: if the
 * routes are ever mounted, their responseSchema already strips internal data.
 *
 * These are SCHEMA-LEVEL tests (no DB, always run) verifying that
 * SponsorshipLevelPublicSchema / SponsorshipPackagePublicSchema never leak audit
 * fields (createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById)
 * or the internal FK (eventLevelId) when parsing a full raw entity row.
 */

import { SponsorshipLevelPublicSchema, SponsorshipPackagePublicSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Audit fields that must NEVER appear in any public response
// ---------------------------------------------------------------------------

/** Audit fields forbidden from SponsorshipLevel public responses. */
const LEVEL_FORBIDDEN_FIELDS = [
    'createdAt',
    'updatedAt',
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById'
] as const;

/** Audit fields AND internal FK forbidden from SponsorshipPackage public responses. */
const PACKAGE_FORBIDDEN_FIELDS = [
    'createdAt',
    'updatedAt',
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById',
    'eventLevelId'
] as const;

/** Catalog fields that must be present on every public sponsorship level item. */
const LEVEL_REQUIRED_PUBLIC_FIELDS = [
    'id',
    'slug',
    'name',
    'targetType',
    'tier',
    'priceAmount',
    'priceCurrency',
    'isActive'
] as const;

/** Catalog fields that must be present on every public sponsorship package item. */
const PACKAGE_REQUIRED_PUBLIC_FIELDS = [
    'id',
    'slug',
    'name',
    'priceAmount',
    'priceCurrency',
    'includedPosts',
    'includedEvents',
    'isActive'
] as const;

// ---------------------------------------------------------------------------
// Raw fixtures — include all internal fields to test stripping
// ---------------------------------------------------------------------------

/**
 * Full raw SponsorshipLevel row as returned by DB layer.
 * Includes all BaseAuditFields that must be stripped by SponsorshipLevelPublicSchema.
 */
const RAW_LEVEL_WITH_FORBIDDEN_FIELDS = {
    // Public fields (catalog/display)
    id: '123e4567-e89b-12d3-a456-426614174010',
    slug: 'gold-sponsor',
    name: 'Gold Sponsor',
    description: 'Gold tier sponsorship with premium benefits',
    targetType: 'event',
    tier: 'gold',
    priceAmount: 50000,
    priceCurrency: 'ARS',
    benefits: [{ key: 'logo', label: 'Logo placement' }],
    sortOrder: 1,
    isActive: true,
    // BaseAuditFields — must be stripped by SponsorshipLevelPublicSchema
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '123e4567-e89b-12d3-a456-000000000001',
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

/**
 * Full raw SponsorshipPackage row as returned by DB layer.
 * Includes all BaseAuditFields and internal FK (eventLevelId) that must be stripped
 * by SponsorshipPackagePublicSchema.
 */
const RAW_PACKAGE_WITH_FORBIDDEN_FIELDS = {
    // Public fields (catalog/display)
    id: '123e4567-e89b-12d3-a456-426614174020',
    slug: 'starter-pack',
    name: 'Starter Pack',
    description: 'Entry-level sponsorship package',
    priceAmount: 10000,
    priceCurrency: 'ARS',
    includedPosts: 2,
    includedEvents: 1,
    isActive: true,
    sortOrder: 0,
    // Internal FK — must be stripped (no public consumer)
    eventLevelId: '123e4567-e89b-12d3-a456-426614174010',
    // BaseAuditFields — must be stripped by SponsorshipPackagePublicSchema
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '123e4567-e89b-12d3-a456-000000000001',
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

// ---------------------------------------------------------------------------
// SponsorshipLevelPublicSchema unit tests — ALWAYS RUN (no DB required)
// ---------------------------------------------------------------------------

describe('SponsorshipLevelPublicSchema — unit tests (no DB, always run) (SPEC-210)', () => {
    it('strips createdAt, updatedAt, and all audit fields from a full raw row', () => {
        const result = SponsorshipLevelPublicSchema.safeParse(RAW_LEVEL_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of LEVEL_FORBIDDEN_FIELDS) {
                expect(
                    data,
                    `field "${field}" must be absent from public level schema`
                ).not.toHaveProperty(field);
            }
        }
    });

    it('preserves required catalog fields after parse', () => {
        const result = SponsorshipLevelPublicSchema.safeParse(RAW_LEVEL_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of LEVEL_REQUIRED_PUBLIC_FIELDS) {
                expect(
                    data,
                    `field "${field}" must be present in public level schema`
                ).toHaveProperty(field);
            }
        }
    });

    it('parses successfully with only the public field set (no extras)', () => {
        const minimal = {
            id: '123e4567-e89b-12d3-a456-426614174011',
            slug: 'silver',
            name: 'Silver',
            targetType: 'post',
            tier: 'silver',
            priceAmount: 20000,
            priceCurrency: 'ARS',
            benefits: [],
            sortOrder: 2,
            isActive: true
        };
        const result = SponsorshipLevelPublicSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// SponsorshipPackagePublicSchema unit tests — ALWAYS RUN (no DB required)
// ---------------------------------------------------------------------------

describe('SponsorshipPackagePublicSchema — unit tests (no DB, always run) (SPEC-210)', () => {
    it('strips createdAt, updatedAt, all audit fields, and eventLevelId from a full raw row', () => {
        const result = SponsorshipPackagePublicSchema.safeParse(RAW_PACKAGE_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of PACKAGE_FORBIDDEN_FIELDS) {
                expect(
                    data,
                    `field "${field}" must be absent from public package schema`
                ).not.toHaveProperty(field);
            }
        }
    });

    it('preserves required catalog fields after parse', () => {
        const result = SponsorshipPackagePublicSchema.safeParse(RAW_PACKAGE_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of PACKAGE_REQUIRED_PUBLIC_FIELDS) {
                expect(
                    data,
                    `field "${field}" must be present in public package schema`
                ).toHaveProperty(field);
            }
        }
    });

    it('parses successfully with only the public field set (no extras)', () => {
        const minimal = {
            id: '123e4567-e89b-12d3-a456-426614174021',
            slug: 'basic-pack',
            name: 'Basic Pack',
            priceAmount: 5000,
            priceCurrency: 'ARS',
            includedPosts: 1,
            includedEvents: 0,
            isActive: true,
            sortOrder: 1
        };
        const result = SponsorshipPackagePublicSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });

    it('strips eventLevelId even when present in the input row', () => {
        const withEventLevelId = {
            ...RAW_PACKAGE_WITH_FORBIDDEN_FIELDS,
            eventLevelId: '123e4567-e89b-12d3-a456-426614174010'
        };
        const result = SponsorshipPackagePublicSchema.safeParse(withEventLevelId);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(
                result.data,
                'eventLevelId must be stripped by public package schema'
            ).not.toHaveProperty('eventLevelId');
        }
    });
});
