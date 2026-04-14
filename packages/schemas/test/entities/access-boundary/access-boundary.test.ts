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
// Runtime safeParse stripping config
// ---------------------------------------------------------------------------

/**
 * Describes which sensitive fields should be stripped per access tier.
 * `true` means the field MUST be absent from that tier's parsed output.
 */
interface SensitiveFieldConfig {
    /** Field name */
    field: string;
    /** Whether it must be absent from Public tier */
    absentFromPublic: boolean;
    /** Whether it must be absent from Protected tier */
    absentFromProtected: boolean;
    /**
     * Whether it must be present in Admin tier.
     * Set to false for fields that don't exist on the entity at all.
     */
    presentInAdmin: boolean;
}

interface ParseStripConfig {
    entityName: string;
    publicSchema: ZodTypeAny;
    protectedSchema: ZodTypeAny;
    adminSchema: ZodTypeAny;
    /** A flat mock object containing all sensitive fields plus the required base fields. */
    mockData: Record<string, any>;
    sensitiveFields: readonly SensitiveFieldConfig[];
}

// ---------------------------------------------------------------------------
// Shared sensitive-field descriptor builders
// ---------------------------------------------------------------------------

/** Standard audit fields stripped from Public (not Protected). */
const STANDARD_PUBLIC_ONLY_AUDIT: readonly SensitiveFieldConfig[] = [
    {
        field: 'createdById',
        absentFromPublic: true,
        absentFromProtected: false,
        presentInAdmin: true
    },
    {
        field: 'updatedById',
        absentFromPublic: true,
        absentFromProtected: false,
        presentInAdmin: true
    }
] as const;

/** Soft-delete audit fields stripped from both Public and Protected. */
const STANDARD_SOFT_DELETE: readonly SensitiveFieldConfig[] = [
    {
        field: 'deletedAt',
        absentFromPublic: true,
        absentFromProtected: false,
        presentInAdmin: true
    },
    {
        field: 'deletedById',
        absentFromPublic: true,
        absentFromProtected: true,
        presentInAdmin: true
    }
] as const;

/** adminInfo stripped from both Public and Protected. */
const STANDARD_ADMIN_INFO: SensitiveFieldConfig = {
    field: 'adminInfo',
    absentFromPublic: true,
    absentFromProtected: true,
    presentInAdmin: true
};

/** Combined set for entities with BaseAuditFields + BaseAdminFields (most entities). */
const STANDARD_SENSITIVE_FIELDS: readonly SensitiveFieldConfig[] = [
    ...STANDARD_PUBLIC_ONLY_AUDIT,
    ...STANDARD_SOFT_DELETE,
    STANDARD_ADMIN_INFO
] as const;

// ---------------------------------------------------------------------------
// Common UUID and date constants for mock data
// ---------------------------------------------------------------------------
// UUID v4 values that pass the strict uuid() validation in id.schema.ts
const UUID1 = '12345678-1234-4234-8234-123456789001';
const UUID2 = '12345678-1234-4234-8234-123456789002';
const UUID3 = '12345678-1234-4234-8234-123456789003';
const NOW = new Date('2024-01-01T00:00:00Z');

/**
 * Shared audit fields to inject into every mock that has BaseAuditFields.
 * All sensitive audit fields included so safeParse can strip them.
 */
const AUDIT_MOCK = {
    createdAt: NOW,
    updatedAt: NOW,
    createdById: UUID1,
    updatedById: UUID2,
    deletedAt: null,
    deletedById: null
} as const;

/**
 * adminInfo mock object for entities with BaseAdminFields.
 */
const ADMIN_INFO_MOCK = { notes: 'admin note', favorite: false } as const;

/**
 * lifecycleState mock value (used by most entities with BaseLifecycleFields).
 */
const LIFECYCLE_MOCK = 'ACTIVE' as const;

// ---------------------------------------------------------------------------
// Per-entity parse strip configs
// ---------------------------------------------------------------------------

const PARSE_STRIP_CONFIGS: readonly ParseStripConfig[] = [
    // ------------------------------------------------------------------
    // Accommodation
    // NOTE: AccommodationPublicSchema.extend() overrides createdAt to z.string().optional()
    // so the mock must pass createdAt as an ISO string to be accepted by PublicSchema,
    // while ProtectedSchema and AdminSchema use z.coerce.date() via BaseAuditFields.
    // We provide createdAt as a Date (coercible) for Protected/Admin compatibility.
    // The safeParse call on PublicSchema will strip createdAt from the mock because
    // the mock's Date value fails the string check — we handle this by providing
    // a separate mock variant via string for the PublicSchema only. However, the
    // simpler approach is to omit createdAt from the base mock and rely on the
    // PublicSchema's .extend() having createdAt: z.string().optional() — meaning
    // the field is optional and simply absent from plain mock input.
    // ------------------------------------------------------------------
    {
        entityName: 'Accommodation',
        publicSchema: AccommodationPublicSchema,
        protectedSchema: AccommodationProtectedSchema,
        adminSchema: AccommodationAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            // createdAt overridden as string for AccommodationPublicSchema compatibility
            // (PublicSchema uses z.string().optional() for createdAt via .extend())
            createdAt: '2024-01-01T00:00:00Z',
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-accommodation',
            name: 'Test Accommodation',
            summary: 'A test summary that is long enough',
            description:
                'A detailed description for the accommodation that is long enough to pass validation.',
            isFeatured: false,
            type: 'APARTMENT',
            destinationId: UUID2,
            ownerId: UUID3,
            moderationState: 'PENDING',
            visibility: 'PUBLIC',
            averageRating: 0,
            reviewsCount: 0
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // AccommodationReview
    // ------------------------------------------------------------------
    {
        entityName: 'AccommodationReview',
        publicSchema: AccommodationReviewPublicSchema,
        protectedSchema: AccommodationReviewProtectedSchema,
        adminSchema: AccommodationReviewAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            userId: UUID2,
            accommodationId: UUID3,
            rating: {
                cleanliness: 5,
                hospitality: 5,
                services: 5,
                accuracy: 5,
                communication: 5,
                location: 5
            },
            averageRating: 5
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // Amenity
    // ------------------------------------------------------------------
    {
        entityName: 'Amenity',
        publicSchema: AmenityPublicSchema,
        protectedSchema: AmenityProtectedSchema,
        adminSchema: AmenityAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            name: 'WiFi',
            type: 'CONNECTIVITY',
            isBuiltin: true,
            isFeatured: false,
            displayWeight: 50
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // Attraction
    // ------------------------------------------------------------------
    {
        entityName: 'Attraction',
        publicSchema: AttractionPublicSchema,
        protectedSchema: AttractionProtectedSchema,
        adminSchema: AttractionAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            name: 'Test Attraction',
            description: 'A detailed description for the attraction that is long enough.',
            icon: 'map-pin',
            isFeatured: false,
            isBuiltin: false,
            displayWeight: 50
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // Destination
    // NOTE: DestinationProtectedSchema intentionally includes adminInfo.
    // So adminInfo is NOT stripped from Protected for this entity.
    // ------------------------------------------------------------------
    {
        entityName: 'Destination',
        publicSchema: DestinationPublicSchema,
        protectedSchema: DestinationProtectedSchema,
        adminSchema: DestinationAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-destination',
            name: 'Test Destination',
            summary: 'A test summary that is long enough',
            description: 'A description long enough for destination validation purposes.',
            isFeatured: false,
            destinationType: 'CITY',
            level: 5,
            path: '/argentina/litoral/test',
            pathIds: UUID1,
            parentDestinationId: null,
            moderationState: 'PENDING',
            visibility: 'PUBLIC',
            averageRating: 0,
            reviewsCount: 0,
            accommodationsCount: 0
        },
        sensitiveFields: [
            {
                field: 'createdById',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'updatedById',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            // deletedAt is absent from Public but NOT from Protected (Protected picks it NOT explicitly — check actual schema)
            {
                field: 'deletedById',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            // adminInfo is explicitly picked by DestinationProtectedSchema
            {
                field: 'adminInfo',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // DestinationReview
    // NOTE: lifecycleState is only on the AdminSchema (SPEC-063 preemptive field).
    // The base schema has no lifecycleState column, so it is absent from
    // Public and Protected tiers.
    // ------------------------------------------------------------------
    {
        entityName: 'DestinationReview',
        publicSchema: DestinationReviewPublicSchema,
        protectedSchema: DestinationReviewProtectedSchema,
        adminSchema: DestinationReviewAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            userId: UUID2,
            destinationId: UUID3,
            rating: {
                landscape: 5,
                attractions: 5,
                accessibility: 5,
                safety: 5,
                cleanliness: 5,
                hospitality: 5,
                culturalOffer: 5,
                gastronomy: 5,
                affordability: 5,
                nightlife: 5,
                infrastructure: 5,
                environmentalCare: 5,
                wifiAvailability: 5,
                shopping: 5,
                beaches: 5,
                greenSpaces: 5,
                localEvents: 5,
                weatherSatisfaction: 5
            },
            averageRating: 5,
            isVerified: false,
            isPublished: true,
            isRecommended: true,
            wouldVisitAgain: true,
            helpfulVotes: 0,
            totalVotes: 0,
            hasOwnerResponse: false,
            isBusinessTravel: false
        },
        sensitiveFields: [
            ...STANDARD_SENSITIVE_FIELDS,
            {
                field: 'lifecycleState',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // Event
    // ------------------------------------------------------------------
    {
        entityName: 'Event',
        publicSchema: EventPublicSchema,
        protectedSchema: EventProtectedSchema,
        adminSchema: EventAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-event',
            name: 'Test Event',
            summary: 'A test event summary long enough',
            category: 'MUSIC',
            isFeatured: false,
            authorId: UUID2,
            moderationState: 'PENDING',
            visibility: 'PUBLIC',
            date: {
                start: NOW,
                recurrence: 'NONE'
            }
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // EventLocation
    // ------------------------------------------------------------------
    {
        entityName: 'EventLocation',
        publicSchema: EventLocationPublicSchema,
        protectedSchema: EventLocationProtectedSchema,
        adminSchema: EventLocationAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-location',
            city: 'Concepcion del Uruguay'
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // EventOrganizer
    // ------------------------------------------------------------------
    {
        entityName: 'EventOrganizer',
        publicSchema: EventOrganizerPublicSchema,
        protectedSchema: EventOrganizerProtectedSchema,
        adminSchema: EventOrganizerAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-organizer',
            name: 'Test Organizer'
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // ExchangeRate
    // No BaseAdminFields (no adminInfo), no BaseAuditFields audit fields with createdById.
    // Public excludes: source, expiresAt, createdAt, updatedAt.
    // ------------------------------------------------------------------
    {
        entityName: 'ExchangeRate',
        publicSchema: ExchangeRatePublicSchema,
        protectedSchema: ExchangeRateProtectedSchema,
        adminSchema: ExchangeRateAdminSchema,
        mockData: {
            id: UUID1,
            fromCurrency: 'ARS',
            toCurrency: 'USD',
            rate: 1000,
            inverseRate: 0.001,
            rateType: 'oficial',
            source: 'dolarapi',
            isManualOverride: false,
            fetchedAt: NOW,
            createdAt: NOW,
            updatedAt: NOW,
            expiresAt: null
        },
        sensitiveFields: [
            // source and expiresAt absent from Public, present in Protected+Admin
            {
                field: 'source',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'expiresAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            // createdAt/updatedAt absent from Public, present in Protected+Admin
            {
                field: 'createdAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'updatedAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // ExchangeRateConfig
    // ------------------------------------------------------------------
    {
        entityName: 'ExchangeRateConfig',
        publicSchema: ExchangeRateConfigPublicSchema,
        protectedSchema: ExchangeRateConfigProtectedSchema,
        adminSchema: ExchangeRateConfigAdminSchema,
        mockData: {
            id: UUID1,
            defaultRateType: 'oficial',
            dolarApiFetchIntervalMinutes: 15,
            exchangeRateApiFetchIntervalHours: 6,
            showConversionDisclaimer: true,
            disclaimerText: null,
            enableAutoFetch: true,
            updatedAt: NOW,
            updatedById: UUID1
        },
        sensitiveFields: [
            {
                field: 'defaultRateType',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'dolarApiFetchIntervalMinutes',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'exchangeRateApiFetchIntervalHours',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'enableAutoFetch',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'updatedAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'updatedById',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            }
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
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-feature',
            name: 'Test Feature',
            isBuiltin: false,
            isFeatured: false,
            displayWeight: 50
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // OwnerPromotion
    // No BaseAdminFields (no adminInfo). Has BaseAuditFields.
    // NOTE: lifecycleState is only on the AdminSchema (SPEC-063 preemptive field).
    // Absent from Public and Protected tiers.
    // ------------------------------------------------------------------
    {
        entityName: 'OwnerPromotion',
        publicSchema: OwnerPromotionPublicSchema,
        protectedSchema: OwnerPromotionProtectedSchema,
        adminSchema: OwnerPromotionAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-promotion',
            ownerId: UUID2,
            title: 'Test Promotion Title',
            discountType: 'percentage',
            discountValue: 10,
            validFrom: NOW,
            isActive: true,
            currentRedemptions: 0
        },
        sensitiveFields: [
            {
                field: 'createdById',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'updatedById',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'deletedAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'deletedById',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'lifecycleState',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // Permission
    // No entity base schema. Public/Protected only have { permission }.
    // Admin adds role + userId.
    // ------------------------------------------------------------------
    {
        entityName: 'Permission',
        publicSchema: PermissionPublicSchema,
        protectedSchema: PermissionProtectedSchema,
        adminSchema: PermissionAdminSchema,
        mockData: {
            permission: 'accommodation.create',
            role: 'ADMIN',
            userId: UUID1
        },
        sensitiveFields: [
            // role and userId are admin-only
            {
                field: 'role',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'userId',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // Post
    // ------------------------------------------------------------------
    {
        entityName: 'Post',
        publicSchema: PostPublicSchema,
        protectedSchema: PostProtectedSchema,
        adminSchema: PostAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-post',
            title: 'Test Post Title',
            summary: 'A test post summary that is long enough to pass.',
            content: 'A'.repeat(100),
            category: 'EVENTS',
            isFeatured: false,
            isFeaturedInWebsite: false,
            isNews: false,
            likes: 0,
            comments: 0,
            shares: 0,
            readingTimeMinutes: 5,
            authorId: UUID2,
            moderationState: 'PENDING',
            visibility: 'PUBLIC'
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // PostSponsor
    // ------------------------------------------------------------------
    {
        entityName: 'PostSponsor',
        publicSchema: PostSponsorPublicSchema,
        protectedSchema: PostSponsorProtectedSchema,
        adminSchema: PostSponsorAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            name: 'Test Sponsor',
            type: 'POST_SPONSOR',
            description: 'A detailed description of the test post sponsor.'
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // PostSponsorship
    // ------------------------------------------------------------------
    {
        entityName: 'PostSponsorship',
        publicSchema: PostSponsorshipPublicSchema,
        protectedSchema: PostSponsorshipProtectedSchema,
        adminSchema: PostSponsorshipAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            sponsorId: UUID2,
            postId: UUID3,
            description: 'A detailed description of the post sponsorship arrangement.',
            paid: { price: 100, currency: 'ARS' },
            isHighlighted: false
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
    },
    // ------------------------------------------------------------------
    // RevalidationLog
    // No BaseAdminFields, no BaseAuditFields audit-by fields (only createdAt).
    // Public excludes: trigger, triggeredBy, entityId, durationMs, errorMessage, metadata.
    // Protected additionally excludes: errorMessage, metadata.
    // ------------------------------------------------------------------
    {
        entityName: 'RevalidationLog',
        publicSchema: RevalidationLogPublicSchema,
        protectedSchema: RevalidationLogProtectedSchema,
        adminSchema: RevalidationLogAdminSchema,
        mockData: {
            id: UUID1,
            path: '/en/accommodations/test',
            entityType: 'accommodation',
            entityId: UUID2,
            trigger: 'manual',
            triggeredBy: UUID3,
            status: 'success',
            durationMs: 42,
            errorMessage: null,
            metadata: null,
            createdAt: NOW
        },
        sensitiveFields: [
            {
                field: 'trigger',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'triggeredBy',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'entityId',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'durationMs',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'errorMessage',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'metadata',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // RevalidationConfig
    // No BaseAdminFields, no full BaseAuditFields (only createdAt, updatedAt).
    // Public excludes: autoRevalidateOnChange, cronIntervalMinutes, debounceSeconds, createdAt, updatedAt.
    // Protected additionally excludes: autoRevalidateOnChange, debounceSeconds.
    // ------------------------------------------------------------------
    {
        entityName: 'RevalidationConfig',
        publicSchema: RevalidationConfigPublicSchema,
        protectedSchema: RevalidationConfigProtectedSchema,
        adminSchema: RevalidationConfigAdminSchema,
        mockData: {
            id: UUID1,
            entityType: 'accommodation',
            autoRevalidateOnChange: true,
            cronIntervalMinutes: 60,
            debounceSeconds: 5,
            enabled: true,
            createdAt: NOW,
            updatedAt: NOW
        },
        sensitiveFields: [
            {
                field: 'autoRevalidateOnChange',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'cronIntervalMinutes',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'debounceSeconds',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'createdAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'updatedAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // Sponsorship
    // No BaseAdminFields (no adminInfo). Has BaseAuditFields.
    // Public excludes: sponsorUserId, levelId, packageId, paymentId, analytics, createdAt/updatedAt, createdById/updatedById, deletedAt/deletedById.
    // Protected additionally excludes: deletedById.
    // NOTE: lifecycleState is only on the AdminSchema (SPEC-063 preemptive field).
    // Absent from Public and Protected tiers.
    // ------------------------------------------------------------------
    {
        entityName: 'Sponsorship',
        publicSchema: SponsorshipPublicSchema,
        protectedSchema: SponsorshipProtectedSchema,
        adminSchema: SponsorshipAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            slug: 'test-sponsorship',
            sponsorUserId: UUID2,
            targetType: 'post',
            targetId: UUID3,
            levelId: UUID1,
            packageId: null,
            status: 'pending',
            startsAt: NOW,
            endsAt: null,
            paymentId: null,
            logoUrl: null,
            linkUrl: null,
            couponCode: null,
            couponDiscountPercent: null,
            analytics: { impressions: 0, clicks: 0, couponsUsed: 0 }
        },
        sensitiveFields: [
            {
                field: 'sponsorUserId',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'levelId',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'packageId',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'paymentId',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'analytics',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'createdAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'updatedAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'createdById',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'updatedById',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'deletedAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'deletedById',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'lifecycleState',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // Tag
    // Has flat inline audit fields (no BaseAdminFields — notes is a direct field).
    // Public excludes: createdById, updatedById, deletedAt, deletedById, lifecycleState, notes.
    // Protected includes: lifecycleState, notes, createdAt, updatedAt — but excludes createdById/updatedById/deletedAt/deletedById.
    // Admin is the full TagSchema.
    // ------------------------------------------------------------------
    {
        entityName: 'Tag',
        publicSchema: TagPublicSchema,
        protectedSchema: TagProtectedSchema,
        adminSchema: TagAdminSchema,
        mockData: {
            id: UUID1,
            name: 'Test Tag',
            slug: 'test-tag',
            color: 'BLUE',
            icon: null,
            notes: null,
            lifecycleState: LIFECYCLE_MOCK,
            createdAt: NOW,
            updatedAt: NOW,
            createdById: UUID2,
            updatedById: UUID3,
            deletedAt: undefined,
            deletedById: undefined
        },
        sensitiveFields: [
            {
                field: 'createdById',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'updatedById',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'deletedById',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // User
    // Non-standard: Public/Protected/Admin are distinct schemas (not pick from base).
    // Public excludes: email, phone, birthDate, authProvider, authProviderUserId,
    //   createdAt, updatedAt, deletedAt, createdById, updatedById, notes, internalTags.
    // Protected excludes: authProvider, authProviderUserId, deletedAt, createdById, updatedById, notes, internalTags.
    // Admin includes all.
    // ------------------------------------------------------------------
    {
        entityName: 'User',
        publicSchema: UserPublicSchema,
        protectedSchema: UserProtectedSchema,
        adminSchema: UserAdminSchema,
        mockData: {
            id: UUID1,
            slug: 'test-user',
            role: 'ADMIN',
            displayName: 'Test User',
            firstName: 'Test',
            lastName: 'User',
            avatarUrl: undefined,
            email: 'test@example.com',
            phone: undefined,
            birthDate: undefined,
            permissions: [],
            authProvider: 'BETTER_AUTH',
            authProviderUserId: 'auth-id-123',
            lifecycleState: LIFECYCLE_MOCK,
            visibility: 'PUBLIC',
            createdAt: NOW,
            updatedAt: NOW,
            deletedAt: null,
            createdById: UUID2,
            updatedById: UUID3,
            notes: 'admin note',
            internalTags: []
        },
        sensitiveFields: [
            {
                field: 'email',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'authProvider',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'authProviderUserId',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'createdAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'updatedAt',
                absentFromPublic: true,
                absentFromProtected: false,
                presentInAdmin: true
            },
            {
                field: 'deletedAt',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'createdById',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'updatedById',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'notes',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            },
            {
                field: 'internalTags',
                absentFromPublic: true,
                absentFromProtected: true,
                presentInAdmin: true
            }
        ]
    },
    // ------------------------------------------------------------------
    // UserBookmark
    // Has BaseAuditFields + BaseAdminFields + BaseLifecycleFields.
    // Public exposes: id, entityId, entityType, name.
    // Protected adds: userId, description, createdAt, updatedAt.
    // Admin is the full schema.
    // ------------------------------------------------------------------
    {
        entityName: 'UserBookmark',
        publicSchema: UserBookmarkPublicSchema,
        protectedSchema: UserBookmarkProtectedSchema,
        adminSchema: UserBookmarkAdminSchema,
        mockData: {
            ...AUDIT_MOCK,
            adminInfo: ADMIN_INFO_MOCK,
            lifecycleState: LIFECYCLE_MOCK,
            id: UUID1,
            userId: UUID2,
            entityId: UUID3,
            entityType: 'ACCOMMODATION',
            name: 'My Bookmark'
        },
        sensitiveFields: STANDARD_SENSITIVE_FIELDS
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

// ---------------------------------------------------------------------------
// Runtime safeParse stripping tests
// ---------------------------------------------------------------------------

/**
 * Verifies that Zod's default strip behaviour removes sensitive fields from
 * the parsed output when data passes through Public, Protected, or Admin schemas.
 *
 * These tests exercise SCHEMA DEFINITION behaviour (what Zod keeps/strips),
 * NOT API runtime behaviour.  They prove that callers cannot "leak" sensitive
 * data by passing raw DB rows through the access-tier schemas.
 *
 * Phase 0 state: schemas are defined; Phase 1 (middleware safeParse) not yet wired.
 */
describe('Runtime safeParse stripping', () => {
    for (const config of PARSE_STRIP_CONFIGS) {
        const {
            entityName,
            publicSchema,
            protectedSchema,
            adminSchema,
            mockData,
            sensitiveFields
        } = config;

        describe(entityName, () => {
            // ---------------------------------------------------------------
            // Public tier — verify absent fields are stripped
            // ---------------------------------------------------------------
            for (const { field, absentFromPublic } of sensitiveFields) {
                if (absentFromPublic) {
                    it(`PublicSchema.safeParse() should strip ${field} for ${entityName}`, () => {
                        // Arrange + Act
                        const result = (publicSchema as ZodObject<ZodRawShape>).safeParse(mockData);

                        if (!result.success) {
                            // Schema parse failure means the mock data is wrong, not a stripping issue.
                            // We still want to surface the error clearly.
                            expect(
                                result.success,
                                `${entityName}.PublicSchema failed to parse mock data: ${JSON.stringify(result.error.issues)}`
                            ).toBe(true);
                            return;
                        }

                        // Assert: field must be stripped (undefined)
                        expect(
                            (result.data as Record<string, unknown>)[field],
                            `${entityName}.PublicSchema.safeParse() must strip field "${field}"`
                        ).toBeUndefined();
                    });
                }
            }

            // ---------------------------------------------------------------
            // Protected tier — verify absent fields are stripped
            // ---------------------------------------------------------------
            for (const { field, absentFromProtected } of sensitiveFields) {
                if (absentFromProtected) {
                    it(`ProtectedSchema.safeParse() should strip ${field} for ${entityName}`, () => {
                        // Arrange + Act
                        const result = (protectedSchema as ZodObject<ZodRawShape>).safeParse(
                            mockData
                        );

                        if (!result.success) {
                            expect(
                                result.success,
                                `${entityName}.ProtectedSchema failed to parse mock data: ${JSON.stringify(result.error.issues)}`
                            ).toBe(true);
                            return;
                        }

                        // Assert: field must be stripped (undefined)
                        expect(
                            (result.data as Record<string, unknown>)[field],
                            `${entityName}.ProtectedSchema.safeParse() must strip field "${field}"`
                        ).toBeUndefined();
                    });
                }
            }

            // ---------------------------------------------------------------
            // Admin tier — verify sensitive fields ARE present (not stripped)
            // ---------------------------------------------------------------
            for (const { field, presentInAdmin } of sensitiveFields) {
                if (presentInAdmin) {
                    it(`AdminSchema.safeParse() should preserve ${field} for ${entityName}`, () => {
                        // Arrange + Act
                        const result = (adminSchema as ZodObject<ZodRawShape>).safeParse(mockData);

                        if (!result.success) {
                            expect(
                                result.success,
                                `${entityName}.AdminSchema failed to parse mock data: ${JSON.stringify(result.error.issues)}`
                            ).toBe(true);
                            return;
                        }

                        const parsed = result.data as Record<string, unknown>;

                        // Field is either present with a defined value OR is allowed to be
                        // undefined/null (nullable/optional fields like deletedAt, deletedById).
                        // We only check that the key is NOT completely absent due to stripping.
                        // Optional fields that were not in the mock may legitimately be undefined.
                        // We verify the field is in the schema shape (not stripped), not necessarily
                        // that the specific value was roundtripped (since defaults may apply).
                        const adminKeys = getShapeKeys(adminSchema);
                        expect(
                            adminKeys,
                            `${entityName}.AdminSchema must declare field "${field}" in its shape`
                        ).toContain(field);

                        // If the mock provides a non-null value for the field, verify it passes through.
                        const mockValue = mockData[field];
                        if (mockValue !== undefined && mockValue !== null) {
                            expect(
                                parsed[field],
                                `${entityName}.AdminSchema.safeParse() must not strip field "${field}" when provided`
                            ).toBeDefined();
                        }
                    });
                }
            }
        });
    }
});
