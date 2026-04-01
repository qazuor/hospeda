import { describe, expect, it } from 'vitest';
import type { ZodObject, ZodRawShape, ZodTypeAny } from 'zod';
import {
    AccommodationAdminSchema,
    AccommodationProtectedSchema,
    AccommodationPublicSchema,
    AccommodationSchema
} from '../../../src/entities/accommodation/index.js';
import {
    AccommodationReviewAdminSchema,
    AccommodationReviewProtectedSchema,
    AccommodationReviewPublicSchema,
    AccommodationReviewSchema
} from '../../../src/entities/accommodationReview/index.js';
import {
    AmenityAdminSchema,
    AmenityProtectedSchema,
    AmenityPublicSchema,
    AmenitySchema
} from '../../../src/entities/amenity/index.js';
import {
    AttractionAdminSchema,
    AttractionProtectedSchema,
    AttractionPublicSchema,
    AttractionSchema
} from '../../../src/entities/attraction/index.js';
import {
    DestinationAdminSchema,
    DestinationProtectedSchema,
    DestinationPublicSchema,
    DestinationSchema
} from '../../../src/entities/destination/index.js';
import {
    DestinationReviewAdminSchema,
    DestinationReviewProtectedSchema,
    DestinationReviewPublicSchema,
    DestinationReviewSchema
} from '../../../src/entities/destinationReview/index.js';
import {
    EventAdminSchema,
    EventProtectedSchema,
    EventPublicSchema,
    EventSchema
} from '../../../src/entities/event/index.js';
import {
    EventLocationAdminSchema,
    EventLocationProtectedSchema,
    EventLocationPublicSchema,
    EventLocationSchema
} from '../../../src/entities/eventLocation/index.js';
import {
    EventOrganizerAdminSchema,
    EventOrganizerProtectedSchema,
    EventOrganizerPublicSchema,
    EventOrganizerSchema
} from '../../../src/entities/eventOrganizer/index.js';
import {
    ExchangeRateAdminSchema,
    ExchangeRateConfigAdminSchema,
    ExchangeRateConfigProtectedSchema,
    ExchangeRateConfigPublicSchema,
    ExchangeRateConfigSchema,
    ExchangeRateProtectedSchema,
    ExchangeRatePublicSchema,
    ExchangeRateSchema
} from '../../../src/entities/exchangeRate/index.js';
import {
    FeatureAdminSchema,
    FeatureProtectedSchema,
    FeaturePublicSchema,
    FeatureSchema
} from '../../../src/entities/feature/index.js';
import {
    OwnerPromotionAdminSchema,
    OwnerPromotionProtectedSchema,
    OwnerPromotionPublicSchema,
    OwnerPromotionSchema
} from '../../../src/entities/ownerPromotion/index.js';
import {
    PermissionAdminSchema,
    PermissionProtectedSchema,
    PermissionPublicSchema
} from '../../../src/entities/permission/index.js';
import {
    PostAdminSchema,
    PostProtectedSchema,
    PostPublicSchema,
    PostSchema
} from '../../../src/entities/post/index.js';
import {
    PostSponsorAdminSchema,
    PostSponsorProtectedSchema,
    PostSponsorPublicSchema,
    PostSponsorSchema
} from '../../../src/entities/postSponsor/index.js';
import {
    PostSponsorshipAdminSchema,
    PostSponsorshipProtectedSchema,
    PostSponsorshipPublicSchema,
    PostSponsorshipSchema
} from '../../../src/entities/postSponsorship/index.js';
import {
    RevalidationConfigAdminSchema,
    RevalidationConfigProtectedSchema,
    RevalidationConfigPublicSchema,
    RevalidationConfigSchema,
    RevalidationLogAdminSchema,
    RevalidationLogProtectedSchema,
    RevalidationLogPublicSchema,
    RevalidationLogSchema
} from '../../../src/entities/revalidation/index.js';
import {
    SponsorshipAdminSchema,
    SponsorshipProtectedSchema,
    SponsorshipPublicSchema,
    SponsorshipSchema
} from '../../../src/entities/sponsorship/index.js';
import {
    TagAdminSchema,
    TagProtectedSchema,
    TagPublicSchema,
    TagSchema
} from '../../../src/entities/tag/index.js';
import {
    UserAdminSchema,
    UserProtectedSchema,
    UserPublicSchema
} from '../../../src/entities/user/index.js';
import {
    UserBookmarkAdminSchema,
    UserBookmarkProtectedSchema,
    UserBookmarkPublicSchema,
    UserBookmarkSchema
} from '../../../src/entities/userBookmark/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the keys of a Zod schema's shape, supporting both ZodObject and
 * schemas produced by .pick() (which are also ZodObject instances).
 * Returns an empty array for non-ZodObject schemas (e.g. Permission which uses
 * z.object() directly with the same runtime type, but may vary).
 */
function getShapeKeys(schema: ZodTypeAny): readonly string[] {
    const s = schema as ZodObject<ZodRawShape>;
    if (s.shape && typeof s.shape === 'object') {
        return Object.keys(s.shape);
    }
    return [];
}

// ---------------------------------------------------------------------------
// Entity config table
// Each entry drives 3 tests:
//   1. PublicSchema must NOT contain fields listed in publicExclusions
//   2. ProtectedSchema must NOT contain fields listed in protectedExclusions
//   3. AdminSchema shape must include EVERY key in baseSchema.shape
//      (only applicable when baseSchema is provided; skipped for Permission/User
//      whose Admin schema is built differently)
// ---------------------------------------------------------------------------

interface EntityAccessConfig {
    /** Human-readable entity name used in describe labels */
    entityName: string;
    publicSchema: ZodTypeAny;
    protectedSchema: ZodTypeAny;
    adminSchema: ZodTypeAny;
    /**
     * The base entity schema. When provided, Test 3 verifies that every key
     * in baseSchema.shape exists in adminSchema.shape.
     * Set to null for entities whose Admin schema is an extension (not assignment)
     * of the base schema, i.e. when AdminSchema IS the base schema.
     */
    baseSchema: ZodTypeAny | null;
    /** Fields that MUST NOT appear in PublicSchema */
    publicExclusions: readonly string[];
    /** Fields that MUST NOT appear in ProtectedSchema */
    protectedExclusions: readonly string[];
}

// Fields that are considered "admin-only" across almost all standard entities
const STANDARD_ADMIN_ONLY_PUBLIC: readonly string[] = [
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById',
    'adminInfo'
] as const;

// Fields excluded from Protected (subset of public exclusions that are truly admin-only)
const STANDARD_ADMIN_ONLY_PROTECTED: readonly string[] = ['deletedById', 'adminInfo'] as const;

const ENTITY_CONFIGS: readonly EntityAccessConfig[] = [
    // ------------------------------------------------------------------
    // Accommodation
    // ------------------------------------------------------------------
    {
        entityName: 'Accommodation',
        publicSchema: AccommodationPublicSchema,
        protectedSchema: AccommodationProtectedSchema,
        adminSchema: AccommodationAdminSchema,
        baseSchema: AccommodationSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // AccommodationReview
    // ------------------------------------------------------------------
    {
        entityName: 'AccommodationReview',
        publicSchema: AccommodationReviewPublicSchema,
        protectedSchema: AccommodationReviewProtectedSchema,
        adminSchema: AccommodationReviewAdminSchema,
        baseSchema: AccommodationReviewSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // Amenity
    // ------------------------------------------------------------------
    {
        entityName: 'Amenity',
        publicSchema: AmenityPublicSchema,
        protectedSchema: AmenityProtectedSchema,
        adminSchema: AmenityAdminSchema,
        baseSchema: AmenitySchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // Attraction
    // ------------------------------------------------------------------
    {
        entityName: 'Attraction',
        publicSchema: AttractionPublicSchema,
        protectedSchema: AttractionProtectedSchema,
        adminSchema: AttractionAdminSchema,
        baseSchema: AttractionSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // Destination
    // NOTE: DestinationProtectedSchema intentionally includes adminInfo and
    // moderationState for contributor/editor views. The Protected schema for
    // this entity intentionally exposes those fields, so we only exclude
    // the pure soft-delete audit identifiers from Protected.
    // ------------------------------------------------------------------
    {
        entityName: 'Destination',
        publicSchema: DestinationPublicSchema,
        protectedSchema: DestinationProtectedSchema,
        adminSchema: DestinationAdminSchema,
        baseSchema: DestinationSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        // adminInfo and moderationState are intentionally included in Protected
        protectedExclusions: ['deletedById']
    },
    // ------------------------------------------------------------------
    // DestinationReview
    // ------------------------------------------------------------------
    {
        entityName: 'DestinationReview',
        publicSchema: DestinationReviewPublicSchema,
        protectedSchema: DestinationReviewProtectedSchema,
        adminSchema: DestinationReviewAdminSchema,
        baseSchema: DestinationReviewSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // Event
    // ------------------------------------------------------------------
    {
        entityName: 'Event',
        publicSchema: EventPublicSchema,
        protectedSchema: EventProtectedSchema,
        adminSchema: EventAdminSchema,
        baseSchema: EventSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // EventLocation
    // ------------------------------------------------------------------
    {
        entityName: 'EventLocation',
        publicSchema: EventLocationPublicSchema,
        protectedSchema: EventLocationProtectedSchema,
        adminSchema: EventLocationAdminSchema,
        baseSchema: EventLocationSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // EventOrganizer
    // ------------------------------------------------------------------
    {
        entityName: 'EventOrganizer',
        publicSchema: EventOrganizerPublicSchema,
        protectedSchema: EventOrganizerProtectedSchema,
        adminSchema: EventOrganizerAdminSchema,
        baseSchema: EventOrganizerSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // ExchangeRate
    // ExchangeRate has no BaseAdminFields (no adminInfo/deletedById).
    // The public schema excludes: source, expiresAt, createdAt, updatedAt.
    // We test the fields that ARE present in the base but absent from public.
    // ------------------------------------------------------------------
    {
        entityName: 'ExchangeRate',
        publicSchema: ExchangeRatePublicSchema,
        protectedSchema: ExchangeRateProtectedSchema,
        adminSchema: ExchangeRateAdminSchema,
        baseSchema: ExchangeRateSchema,
        // ExchangeRate has no audit/admin fields — but source is internal-only
        publicExclusions: ['source', 'expiresAt', 'createdAt', 'updatedAt'],
        // Protected exposes everything in the base; no true admin-only exclusions
        protectedExclusions: []
    },
    // ------------------------------------------------------------------
    // ExchangeRateConfig
    // ------------------------------------------------------------------
    {
        entityName: 'ExchangeRateConfig',
        publicSchema: ExchangeRateConfigPublicSchema,
        protectedSchema: ExchangeRateConfigProtectedSchema,
        adminSchema: ExchangeRateConfigAdminSchema,
        baseSchema: ExchangeRateConfigSchema,
        // Internal scheduling fields are admin-only
        publicExclusions: [
            'defaultRateType',
            'dolarApiFetchIntervalMinutes',
            'exchangeRateApiFetchIntervalHours',
            'enableAutoFetch',
            'updatedAt',
            'updatedById'
        ],
        protectedExclusions: [
            'dolarApiFetchIntervalMinutes',
            'exchangeRateApiFetchIntervalHours',
            'enableAutoFetch'
        ]
    },
    // ------------------------------------------------------------------
    // Feature
    // ------------------------------------------------------------------
    {
        entityName: 'Feature',
        publicSchema: FeaturePublicSchema,
        protectedSchema: FeatureProtectedSchema,
        adminSchema: FeatureAdminSchema,
        baseSchema: FeatureSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // OwnerPromotion
    // Does NOT include BaseAdminFields — no adminInfo field.
    // Audit fields: createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById.
    // ------------------------------------------------------------------
    {
        entityName: 'OwnerPromotion',
        publicSchema: OwnerPromotionPublicSchema,
        protectedSchema: OwnerPromotionProtectedSchema,
        adminSchema: OwnerPromotionAdminSchema,
        baseSchema: OwnerPromotionSchema,
        publicExclusions: ['createdById', 'updatedById', 'deletedAt', 'deletedById'],
        protectedExclusions: ['deletedById']
    },
    // ------------------------------------------------------------------
    // Permission — non-standard (z.object() based, no pick() from base).
    // baseSchema is null: Test 3 is skipped.
    // Public/Protected both have only { permission }; Admin adds role + userId.
    // We verify that Public and Protected do NOT expose admin-assignment fields.
    // ------------------------------------------------------------------
    {
        entityName: 'Permission',
        publicSchema: PermissionPublicSchema,
        protectedSchema: PermissionProtectedSchema,
        adminSchema: PermissionAdminSchema,
        baseSchema: null,
        publicExclusions: ['role', 'userId'],
        protectedExclusions: ['role', 'userId']
    },
    // ------------------------------------------------------------------
    // Post
    // ------------------------------------------------------------------
    {
        entityName: 'Post',
        publicSchema: PostPublicSchema,
        protectedSchema: PostProtectedSchema,
        adminSchema: PostAdminSchema,
        baseSchema: PostSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // PostSponsor
    // ------------------------------------------------------------------
    {
        entityName: 'PostSponsor',
        publicSchema: PostSponsorPublicSchema,
        protectedSchema: PostSponsorProtectedSchema,
        adminSchema: PostSponsorAdminSchema,
        baseSchema: PostSponsorSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // PostSponsorship
    // ------------------------------------------------------------------
    {
        entityName: 'PostSponsorship',
        publicSchema: PostSponsorshipPublicSchema,
        protectedSchema: PostSponsorshipProtectedSchema,
        adminSchema: PostSponsorshipAdminSchema,
        baseSchema: PostSponsorshipSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // RevalidationLog — no BaseAdminFields; no adminInfo.
    // Public excludes: trigger, triggeredBy, entityId, durationMs, errorMessage, metadata
    // Protected excludes: errorMessage, metadata (admin-only operational details)
    // ------------------------------------------------------------------
    {
        entityName: 'RevalidationLog',
        publicSchema: RevalidationLogPublicSchema,
        protectedSchema: RevalidationLogProtectedSchema,
        adminSchema: RevalidationLogAdminSchema,
        baseSchema: RevalidationLogSchema,
        publicExclusions: [
            'trigger',
            'triggeredBy',
            'entityId',
            'durationMs',
            'errorMessage',
            'metadata'
        ],
        protectedExclusions: ['errorMessage', 'metadata']
    },
    // ------------------------------------------------------------------
    // RevalidationConfig — no BaseAdminFields.
    // Public excludes scheduling/debounce operational fields.
    // Protected excludes debounce + auto-revalidate.
    // ------------------------------------------------------------------
    {
        entityName: 'RevalidationConfig',
        publicSchema: RevalidationConfigPublicSchema,
        protectedSchema: RevalidationConfigProtectedSchema,
        adminSchema: RevalidationConfigAdminSchema,
        baseSchema: RevalidationConfigSchema,
        publicExclusions: [
            'autoRevalidateOnChange',
            'cronIntervalMinutes',
            'debounceSeconds',
            'createdAt',
            'updatedAt'
        ],
        protectedExclusions: ['autoRevalidateOnChange', 'debounceSeconds']
    },
    // ------------------------------------------------------------------
    // Sponsorship — no BaseAdminFields; no adminInfo.
    // Audit fields come from BaseAuditFields (createdAt/updatedAt/createdById/
    // updatedById/deletedAt/deletedById).
    // Public excludes: ownership + audit + internal.
    // ------------------------------------------------------------------
    {
        entityName: 'Sponsorship',
        publicSchema: SponsorshipPublicSchema,
        protectedSchema: SponsorshipProtectedSchema,
        adminSchema: SponsorshipAdminSchema,
        baseSchema: SponsorshipSchema,
        publicExclusions: [
            'sponsorUserId',
            'levelId',
            'packageId',
            'paymentId',
            'analytics',
            'createdAt',
            'updatedAt',
            'createdById',
            'updatedById',
            'deletedAt',
            'deletedById'
        ],
        protectedExclusions: ['deletedById']
    },
    // ------------------------------------------------------------------
    // Tag
    // ------------------------------------------------------------------
    {
        entityName: 'Tag',
        publicSchema: TagPublicSchema,
        protectedSchema: TagProtectedSchema,
        adminSchema: TagAdminSchema,
        baseSchema: TagSchema,
        publicExclusions: STANDARD_ADMIN_ONLY_PUBLIC,
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    },
    // ------------------------------------------------------------------
    // User — non-standard (Admin uses .extend() not assignment of base).
    // Public schema: id, displayName, firstName, lastName, slug, avatarUrl, role.
    // Protected extends Public with personal/contact data.
    // Admin extends Protected with auth + audit fields.
    // We test that sensitive auth/audit fields are absent from Public/Protected.
    // baseSchema is null: skip Test 3 (Admin is a superset extension, not base).
    // ------------------------------------------------------------------
    {
        entityName: 'User',
        publicSchema: UserPublicSchema,
        protectedSchema: UserProtectedSchema,
        adminSchema: UserAdminSchema,
        baseSchema: null,
        publicExclusions: [
            'email',
            'phone',
            'birthDate',
            'authProvider',
            'authProviderUserId',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'createdById',
            'updatedById',
            'notes',
            'internalTags'
        ],
        protectedExclusions: [
            'authProvider',
            'authProviderUserId',
            'deletedAt',
            'createdById',
            'updatedById',
            'notes',
            'internalTags'
        ]
    },
    // ------------------------------------------------------------------
    // UserBookmark — has BaseAdminFields (adminInfo) + BaseAuditFields.
    // Public exposes: id, entityId, entityType, name.
    // Protected adds: userId, description, createdAt, updatedAt.
    // Admin is the full schema.
    // ------------------------------------------------------------------
    {
        entityName: 'UserBookmark',
        publicSchema: UserBookmarkPublicSchema,
        protectedSchema: UserBookmarkProtectedSchema,
        adminSchema: UserBookmarkAdminSchema,
        baseSchema: UserBookmarkSchema,
        publicExclusions: [
            'userId',
            'description',
            'createdAt',
            'updatedAt',
            ...STANDARD_ADMIN_ONLY_PUBLIC
        ],
        protectedExclusions: STANDARD_ADMIN_ONLY_PROTECTED
    }
] as const;

// ---------------------------------------------------------------------------
// Table-driven tests
// ---------------------------------------------------------------------------

describe('Access Schema Boundary Tests', () => {
    for (const config of ENTITY_CONFIGS) {
        const {
            entityName,
            publicSchema,
            protectedSchema,
            adminSchema,
            baseSchema,
            publicExclusions,
            protectedExclusions
        } = config;

        describe(entityName, () => {
            // ---------------------------------------------------------------
            // Test 1 — PublicSchema must NOT expose sensitive fields
            // ---------------------------------------------------------------
            it('PublicSchema should NOT contain sensitive fields', () => {
                // Arrange
                const publicKeys = getShapeKeys(publicSchema);

                // Act & Assert
                for (const field of publicExclusions) {
                    expect(
                        publicKeys,
                        `${entityName}.PublicSchema must not contain field "${field}"`
                    ).not.toContain(field);
                }
            });

            // ---------------------------------------------------------------
            // Test 2 — ProtectedSchema must NOT expose admin-only fields
            // ---------------------------------------------------------------
            it('ProtectedSchema should NOT contain admin-only fields', () => {
                // Arrange
                const protectedKeys = getShapeKeys(protectedSchema);

                // Act & Assert
                for (const field of protectedExclusions) {
                    expect(
                        protectedKeys,
                        `${entityName}.ProtectedSchema must not contain admin-only field "${field}"`
                    ).not.toContain(field);
                }
            });

            // ---------------------------------------------------------------
            // Test 3 — AdminSchema must include ALL base schema fields
            // Skipped for entities where AdminSchema is built via .extend()
            // rather than being a direct reference to the base schema.
            // ---------------------------------------------------------------
            it('AdminSchema should include ALL BaseSchema fields', () => {
                // Arrange
                if (baseSchema === null) {
                    // Entity uses a non-standard Admin schema construction.
                    // We only verify that it has AT LEAST the fields that
                    // Public and Protected expose (a weaker but still useful check).
                    const adminKeys = getShapeKeys(adminSchema);
                    const publicKeys = getShapeKeys(publicSchema);

                    // Act & Assert
                    for (const field of publicKeys) {
                        expect(
                            adminKeys,
                            `${entityName}.AdminSchema must include public field "${field}"`
                        ).toContain(field);
                    }
                    return;
                }

                // Standard case: AdminSchema === BaseSchema (direct reference).
                // Every key in BaseSchema.shape must be present in AdminSchema.shape.
                const baseKeys = getShapeKeys(baseSchema);
                const adminKeys = getShapeKeys(adminSchema);

                // Act & Assert
                for (const field of baseKeys) {
                    expect(
                        adminKeys,
                        `${entityName}.AdminSchema must include base field "${field}"`
                    ).toContain(field);
                }
            });
        });
    }
});
