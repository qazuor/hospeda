/**
 * Registry backing `write-input-server-written.guard.test.ts` (HOS-1113).
 *
 * Lives in its own module so the guard file stays readable: this half is data —
 * which write schemas exist, who can reach them, what each accepts today, and
 * which fields are server-written and why. Read the guard's module docstring
 * first; it explains what the data is FOR and how a failure here is resolved.
 */

import {
    AccommodationCreateInputSchema,
    AccommodationUpdateInputSchema
} from '../../src/entities/accommodation/accommodation.crud.schema.js';
import { AccommodationSchema } from '../../src/entities/accommodation/accommodation.schema.js';
import {
    DestinationCreateInputSchema,
    DestinationUpdateInputSchema
} from '../../src/entities/destination/destination.crud.schema.js';
import { DestinationSchema } from '../../src/entities/destination/destination.schema.js';
import {
    EventCreateInputSchema,
    EventUpdateInputSchema
} from '../../src/entities/event/event.crud.schema.js';
import { EventSchema } from '../../src/entities/event/event.schema.js';
import {
    ExperienceAdminCreateInputSchema,
    ExperienceOwnerCreateInputSchema,
    ExperienceOwnerUpdateInputSchema,
    ExperienceUpdateInputSchema
} from '../../src/entities/experience/experience.crud.schema.js';
import { ExperienceSchema } from '../../src/entities/experience/experience.schema.js';
import {
    GastronomyAdminCreateInputSchema,
    GastronomyOwnerCreateInputSchema,
    GastronomyOwnerUpdateInputSchema,
    GastronomyUpdateInputSchema
} from '../../src/entities/gastronomy/gastronomy.crud.schema.js';
import { GastronomySchema } from '../../src/entities/gastronomy/gastronomy.schema.js';

/** The parse surface the guard needs. Avoids depending on Zod's exported types. */
export interface Parseable {
    readonly safeParse: (value: unknown) =>
        | { readonly success: true; readonly data: unknown }
        | {
              readonly success: false;
              readonly error: { readonly issues: ReadonlyArray<{ readonly path: unknown[] }> };
          };
}

/** An object schema whose declared shape can be read for the probe cross-check. */
export interface Shaped {
    readonly shape: Record<string, unknown>;
}

/**
 * Parses a whitespace-separated block of field names into a sorted list.
 *
 * The frozen inventories are written as text blocks rather than array literals
 * so that a forty-field set stays five readable lines instead of forty, while a
 * diff still shows exactly which line moved.
 *
 * @param block - Whitespace-separated field names.
 * @returns The names, sorted.
 */
const fields = (block: string): readonly string[] => block.trim().split(/\s+/).sort();

// ============================================================================
// Registry
// ============================================================================

/** One registered write-input schema and the tier that can reach it. */
export interface WriteSchemaEntry {
    /** Export name, used verbatim in failure messages. */
    readonly name: string;
    readonly schema: Parseable;
    /**
     * `owner` when a signed-in merchant can reach the route declaring this
     * schema as its `requestBody`; `admin` when only staff can.
     */
    readonly tier: 'admin' | 'owner';
    /** Base fields this schema accepts today. Frozen — see the module docstring. */
    readonly accepts: readonly string[];
}

/** One entity base schema plus every write schema derived from it. */
export interface EntityEntry {
    readonly entity: string;
    readonly base: Shaped;
    /** Field the mirror assertion expects EVERY write schema to accept. */
    readonly writableProbe: string;
    /** Never accepted by ANY write schema of this entity, at any tier. */
    readonly neverFromBody: Readonly<Record<string, string>>;
    /** Never accepted by an OWNER-tier write schema. Admin may still seed it. */
    readonly neverFromOwnerBody: Readonly<Record<string, string>>;
    readonly writeSchemas: readonly WriteSchemaEntry[];
}

/** Audit columns. Written by the model or the database, never by a caller. */
const AUDIT_COLUMNS: Readonly<Record<string, string>> = {
    id: 'primary key, generated on insert',
    createdAt: 'set by the model on insert',
    updatedAt: 'set by the model on every write',
    createdById: 'set from the acting actor on insert',
    updatedById: 'set from the acting actor on every write',
    deletedAt: 'set by the soft-delete path only',
    deletedById: 'set by the soft-delete path only'
};

/**
 * Ownership, control and aggregate fields no merchant-reachable schema may take
 * from a body. Shared by the two commerce verticals, which run the same
 * owner-create / owner-patch pair.
 */
const COMMERCE_OWNER_DENIED: Readonly<Record<string, string>> = {
    ownerId: 'the owner-create route forces actor.id (HOS-166 D-3)',
    slug: 'derived server-side from name; a free rename enables slug-squatting',
    lifecycleState: 'control field — the route forces DRAFT on owner create',
    visibility: 'control field — the route forces PRIVATE on owner create',
    isFeatured: 'control field — admin-curated placement',
    moderationState: 'control field — moderation decides it, not the moderated',
    reviewsCount: 'aggregate, written by the review subsystem',
    averageRating: 'aggregate, written by the review subsystem',
    rating: 'aggregate, written by the review subsystem',
    adminInfo:
        'staff-only internal notes, with their own permission-gated write path (setAdminInfo), stripped from public projections',
    translationMeta: 'SPEC-212 curation metadata, written by the AI translation pipeline',
    media: 'the media jsonb column was dropped (HOS-372); photos live in the relational media table'
};

/** Every entity base and the write-input schemas derived from it. */
export const ENTITIES: readonly EntityEntry[] = [
    {
        entity: 'accommodation',
        base: AccommodationSchema as unknown as Shaped,
        writableProbe: 'name',
        neverFromBody: {
            ...AUDIT_COLUMNS,
            isVerified: 'set by the admin verify endpoint',
            verifiedAt: 'set by the admin verify endpoint',
            verifiedById: 'set by the admin verify endpoint',
            ownerSuspended: 'derived from the owner account state',
            planRestricted: 'derived from the owner billing plan',
            showExternalReputation: 'driven by the external-reputation subsystem'
        },
        neverFromOwnerBody: {},
        writeSchemas: [
            {
                name: 'AccommodationCreateInputSchema',
                schema: AccommodationCreateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    adminInfo averageRating contactInfo description descriptionI18n destinationId
                    extraInfo faqs iaData isFeatured lastWarnedAt lifecycleState location media
                    moderationState name nameI18n ownerId price rating reviewsCount richDescription
                    richDescriptionI18n seo slug socialNetworks summary summaryI18n tags
                    translationMeta type videos visibility
                `)
            },
            {
                name: 'AccommodationUpdateInputSchema',
                schema: AccommodationUpdateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    adminInfo averageRating contactInfo description descriptionI18n destinationId
                    extraInfo faqs iaData isFeatured lastWarnedAt lifecycleState location
                    moderationState name nameI18n ownerId price rating reviewsCount richDescription
                    richDescriptionI18n seo slug socialNetworks summary summaryI18n tags
                    translationMeta type videos visibility
                `)
            }
        ]
    },
    {
        entity: 'destination',
        base: DestinationSchema as unknown as Shaped,
        writableProbe: 'name',
        neverFromBody: {
            ...AUDIT_COLUMNS,
            level: 'derived from the parent chain',
            path: 'materialised path, recomputed on every hierarchy move',
            pathIds: 'materialised path, recomputed on every hierarchy move'
        },
        neverFromOwnerBody: {},
        writeSchemas: [
            {
                name: 'DestinationCreateInputSchema',
                schema: DestinationCreateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    accommodationsCount adminInfo attractions averageRating climate description
                    descriptionI18n destinationType faqs isFeatured lifecycleState location media
                    moderationState name nameI18n parentDestinationId pointsOfInterest rating
                    reviews reviewsCount seo slug summary summaryI18n tags translationMeta
                    visibility weatherCurrent
                `)
            },
            {
                name: 'DestinationUpdateInputSchema',
                schema: DestinationUpdateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    accommodationsCount adminInfo attractions averageRating climate description
                    descriptionI18n destinationType faqs isFeatured lifecycleState location media
                    moderationState name nameI18n parentDestinationId pointsOfInterest rating
                    reviews reviewsCount seo slug summary summaryI18n tags translationMeta
                    visibility weatherCurrent
                `)
            }
        ]
    },
    {
        entity: 'event',
        base: EventSchema as unknown as Shaped,
        writableProbe: 'name',
        neverFromBody: { ...AUDIT_COLUMNS },
        neverFromOwnerBody: {},
        writeSchemas: [
            {
                name: 'EventCreateInputSchema',
                schema: EventCreateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    adminInfo authorId category contactInfo date description descriptionI18n
                    isFeatured lifecycleState locationId media moderationState name nameI18n
                    organizerId pricing seo slug summary summaryI18n tags translationMeta visibility
                `)
            },
            {
                name: 'EventUpdateInputSchema',
                schema: EventUpdateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    adminInfo authorId category contactInfo date description descriptionI18n
                    isFeatured locationId media name nameI18n organizerId pricing seo slug summary
                    summaryI18n translationMeta
                `)
            }
        ]
    },
    {
        entity: 'experience',
        base: ExperienceSchema as unknown as Shaped,
        writableProbe: 'name',
        neverFromBody: { ...AUDIT_COLUMNS },
        neverFromOwnerBody: {
            ...COMMERCE_OWNER_DENIED,
            hasActiveSubscription: 'mirrors the billing subscription state; never client input'
        },
        writeSchemas: [
            {
                name: 'ExperienceAdminCreateInputSchema',
                schema: ExperienceAdminCreateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    acceptsPrivateGroups adminInfo averageRating cancellationPolicy contactInfo
                    description descriptionI18n destinationId durationMinutes faqs
                    hasActiveSubscription isFeatured isPriceOnRequest lifecycleState media
                    meetingPoint meetingPointLat meetingPointLong moderationState name nameI18n
                    openingHours ownerId priceFrom priceUnit rating requirements reviewsCount
                    richDescription richDescriptionI18n seo slug socialNetworks summary summaryI18n
                    tags translationMeta type videos visibility whatToBring
                `)
            },
            {
                name: 'ExperienceUpdateInputSchema',
                schema: ExperienceUpdateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    acceptsPrivateGroups adminInfo cancellationPolicy contactInfo description
                    descriptionI18n destinationId durationMinutes faqs isFeatured isPriceOnRequest
                    lifecycleState meetingPoint meetingPointLat meetingPointLong moderationState
                    name nameI18n openingHours priceFrom priceUnit rating requirements
                    richDescription richDescriptionI18n seo slug socialNetworks summary summaryI18n
                    tags translationMeta type videos visibility whatToBring
                `)
            },
            {
                name: 'ExperienceOwnerCreateInputSchema',
                schema: ExperienceOwnerCreateInputSchema as unknown as Parseable,
                tier: 'owner',
                accepts: fields(`
                    acceptsPrivateGroups cancellationPolicy contactInfo description descriptionI18n
                    destinationId durationMinutes faqs isPriceOnRequest meetingPoint
                    meetingPointLat meetingPointLong name nameI18n openingHours priceFrom priceUnit
                    requirements richDescription richDescriptionI18n seo socialNetworks summary
                    summaryI18n tags type videos whatToBring
                `)
            },
            {
                name: 'ExperienceOwnerUpdateInputSchema',
                schema: ExperienceOwnerUpdateInputSchema as unknown as Parseable,
                tier: 'owner',
                accepts: fields(`
                    acceptsPrivateGroups cancellationPolicy contactInfo description descriptionI18n
                    destinationId durationMinutes isPriceOnRequest meetingPoint meetingPointLat
                    meetingPointLong name nameI18n openingHours priceFrom priceUnit requirements
                    richDescription richDescriptionI18n socialNetworks summary summaryI18n type
                    videos whatToBring
                `)
            }
        ]
    },
    {
        entity: 'gastronomy',
        base: GastronomySchema as unknown as Shaped,
        writableProbe: 'name',
        neverFromBody: {
            ...AUDIT_COLUMNS,
            menuFileUrl:
                'written only by POST/DELETE /gastronomies/{id}/menu-file, in the same request that stores or destroys the asset (HOS-895)',
            menuFilePublicId:
                'the provider-side asset handle the delete route destroys — a body-writable value deletes another venue’s file (HOS-895)',
            menuFileKind: 'derived from the uploaded file, alongside menuFileUrl (HOS-895)'
        },
        neverFromOwnerBody: { ...COMMERCE_OWNER_DENIED },
        writeSchemas: [
            {
                name: 'GastronomyAdminCreateInputSchema',
                schema: GastronomyAdminCreateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    adminInfo averageRating contactInfo description descriptionI18n destinationId
                    faqs isFeatured lifecycleState media menuUrl moderationState name nameI18n
                    openingHours ownerId priceRange rating reviewsCount richDescription
                    richDescriptionI18n seo slug socialNetworks summary summaryI18n tags
                    translationMeta type videos visibility
                `)
            },
            {
                name: 'GastronomyUpdateInputSchema',
                schema: GastronomyUpdateInputSchema as unknown as Parseable,
                tier: 'admin',
                accepts: fields(`
                    adminInfo contactInfo description descriptionI18n destinationId faqs isFeatured
                    lifecycleState menuUrl moderationState name nameI18n openingHours priceRange
                    rating richDescription richDescriptionI18n seo slug socialNetworks summary
                    summaryI18n tags translationMeta type videos visibility
                `)
            },
            {
                name: 'GastronomyOwnerCreateInputSchema',
                schema: GastronomyOwnerCreateInputSchema as unknown as Parseable,
                tier: 'owner',
                accepts: fields(`
                    contactInfo description descriptionI18n destinationId faqs menuUrl name
                    nameI18n openingHours priceRange richDescription richDescriptionI18n seo
                    socialNetworks summary summaryI18n tags type videos
                `)
            },
            {
                name: 'GastronomyOwnerUpdateInputSchema',
                schema: GastronomyOwnerUpdateInputSchema as unknown as Parseable,
                tier: 'owner',
                accepts: fields(`
                    contactInfo description descriptionI18n destinationId menuUrl name nameI18n
                    openingHours priceRange richDescription richDescriptionI18n socialNetworks
                    summary summaryI18n type videos
                `)
            }
        ]
    }
];
