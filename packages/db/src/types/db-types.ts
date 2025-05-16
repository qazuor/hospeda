import type { EntityTypeEnum } from '@repo/types';
import type { InferInsertModel } from 'drizzle-orm';
import type {
    events,
    accommodationAmenities,
    accommodationFaqs,
    accommodationFeatures,
    accommodationIaData,
    accommodationReviews,
    accommodations,
    amenities,
    destinationAttractions,
    destinationReviews,
    destinations,
    entityTagRelations,
    eventLocations,
    eventOrganizers,
    features,
    permissions,
    postSponsors,
    postSponsorships,
    posts,
    rolePermissions,
    roles,
    tags,
    userBookmarks,
    userPermissions,
    users
} from '../schema';

/**
 * Common types shared across DB models.
 * Used for pagination, filtering and utility options.
 */

/**
 * Pagination and sorting options for listings.
 */
export interface PaginationParams {
    /**
     * Maximum number of items to return.
     * @default 20
     */
    limit?: number;

    /**
     * Offset index for pagination.
     * @default 0
     */
    offset?: number;

    /**
     * Column to order results by.
     * @default 'createdAt'
     */
    orderBy?: string; // Note: This needs to be a valid column name for the specific table

    /**
     * Sorting direction.
     * @default 'asc' | 'desc'
     */
    order?: 'asc' | 'desc';
}

/**
 * Parameters used for fuzzy search queries.
 */
export interface FindParams extends PaginationParams {
    /**
     * The term to search for (used in LIKE/ILIKE queries).
     */
    query?: string;
}

/**
 * Generic type for update operations:
 * Omit common audit fields and make the rest optional.
 * Useful for tables with standard audit columns.
 *
 * @template T - The insert data type for a table.
 *
 * @example
 * type UpdateUserData = UpdateData<InsertUser>;
 */
export type UpdateData<T extends object> = Partial<
    Omit<
        T,
        | 'id'
        | 'createdAt'
        | 'updatedAt'
        | 'deletedAt'
        | 'createdById'
        | 'updatedById'
        | 'deletedById'
    >
>;

/**
 * Base filter options for listing entities.
 * Includes pagination, optional search term, and soft-delete control.
 */
export interface BaseSelectFilter extends PaginationParams {
    /** Generic fuzzy search term (e.g., name, title, description) */
    query?: string;
    /** Whether to include soft-deleted records */
    includeDeleted?: boolean;
    /** Filter by created user ID */
    createdById?: string;
    /** Filter by updated user ID */
    updatedById?: string;
    /** Filter by deleted user ID */
    deletedById?: string;
    /** Filter by general entity state (e.g., 'active', 'draft', 'archived') */
    state?: string; // Moved state here as a common filter property
}

// --- Specific Select Filters (Moved from Model files) ---

/**
 * Filter options for listing accommodations.
 */
export interface SelectAccommodationFilter extends BaseSelectFilter {
    /** Filter by accommodation type */
    type?: string;
    /** Filter by destination ID */
    destinationId?: string;
    /** Filter by owner ID */
    ownerId?: string;
    /** Filter by featured status */
    isFeatured?: boolean;
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing amenities.
 */
export interface SelectAmenityFilter extends BaseSelectFilter {
    /** Filter by amenity type (CLIMATE_CONTROL, etc) */
    type?: string;
    /** Filter by built-in status */
    isBuiltin?: boolean;
}

/**
 * Filter options for listing accommodation amenities.
 */
export interface SelectAccommodationAmenityFilter extends BaseSelectFilter {
    /** Filter by accommodation ID */
    accommodationId?: string;
    /** Filter by amenity ID */
    amenityId?: string;
    /** Filter by optional status */
    isOptional?: boolean;
}

/**
 * Filter options for listing features.
 */
export interface SelectFeatureFilter extends BaseSelectFilter {
    /** Filter by built-in status */
    isBuiltin?: boolean;
}

/**
 * Filter options for listing accommodation features.
 */
export interface SelectAccommodationFeatureFilter extends BaseSelectFilter {
    /** Filter by accommodation ID */
    accommodationId?: string;
    /** Filter by feature ID */
    featureId?: string;
}

/**
 * Filter options for listing bookmarks.
 */
export interface SelectBookmarkFilter extends BaseSelectFilter {
    /** Filter by owner (user) ID */
    ownerId?: string;
    /** Filter by bookmarked entity type */
    entityType?: EntityTypeEnum;
    /** Filter by bookmarked entity ID */
    entityId?: string;
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing destinations.
 */
export interface SelectDestinationFilter extends BaseSelectFilter {
    /** Filter by featured status */
    isFeatured?: boolean;
    /** Filter by visibility */
    visibility?: string;
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing destination attractions.
 */
export interface SelectDestinationAttractionFilter extends BaseSelectFilter {
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing entity tag relations.
 */
export interface SelectEntityTagRelationFilter extends BaseSelectFilter {
    /** Filter by entity type */
    entityType?: EntityTypeEnum;
    /** Filter by entity ID */
    entityId?: string;
    /** Filter by tag ID */
    tagId?: string;
    // BaseSelectFilter properties like state, query, createdById, etc. may or may not apply meaningfully to join tables.
    // The model implementation decides which inherited filters are actually used.
}

/**
 * Filter options for listing events.
 */
export interface SelectEventFilter extends BaseSelectFilter {
    /** Filter by event category */
    category?: string;
    /** Filter by author ID */
    authorId?: string;
    /** Filter by location ID */
    locationId?: string;
    /** Filter by organizer ID */
    organizerId?: string;
    /** Filter by visibility */
    visibility?: string;
    /** Filter by featured status */
    isFeatured?: boolean;
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing event locations.
 */
export interface SelectEventLocationFilter extends BaseSelectFilter {
    // state filter (geographical state/province) is now inherited from BaseSelectFilter and maps to the 'state' column
    /** Filter by country */
    country?: string;
    // Removed stateCode property as it was redundant with BaseSelectFilter.state and mapped to the same DB column.
    /** Filter by city */
    city?: string;
    /** Filter by zip code */
    zipCode?: string;
}

/**
 * Filter options for listing organizers.
 */
export interface SelectEventOrganizerFilter extends BaseSelectFilter {
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing permissions.
 */
export interface SelectPermissionFilter extends BaseSelectFilter {
    /** Filter by deprecated state */
    isDeprecated?: boolean;
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing posts.
 */
export interface SelectPostFilter extends BaseSelectFilter {
    /** Filter by category */
    category?: string;
    /** Filter by visibility */
    visibility?: string;
    /** Filter by sponsorship ID */
    sponsorshipId?: string;
    /** Filter by related destination ID */
    relatedDestinationId?: string;
    /** Filter by related accommodation ID */
    relatedAccommodationId?: string;
    /** Filter by related event ID */
    relatedEventId?: string;
    /** Filter by featured status */
    isFeatured?: boolean;
    /** Filter by news status */
    isNews?: boolean;
    /** Filter by featured in website status */
    isFeaturedInWebsite?: boolean;
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing post sponsors.
 */
export interface SelectPostSponsorFilter extends BaseSelectFilter {
    /** Filter by client type */
    type?: string;
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing sponsorships.
 */
export interface SelectPostSponsorshipFilter extends BaseSelectFilter {
    /** Filter by post ID */
    postId?: string; // Made optional as BaseSelectFilter handles general queries
    /** Filter by sponsor ID */
    sponsorId?: string;
    /** Filter by highlighted status */
    isHighlighted?: boolean;
    // BaseSelectFilter properties like state, query, createdById, etc. may or may not apply meaningfully to this table.
    // The model implementation decides which inherited filters are actually used.
}

/**
 * Filter options for listing roles.
 */
export interface SelectRoleFilter extends BaseSelectFilter {
    /** Filter by built-in status */
    isBuiltIn?: boolean;
    /** Filter by deprecated status */
    isDeprecated?: boolean;
    /** Filter by default status */
    isDefault?: boolean;
    // state filter is now inherited from BaseSelectFilter
}

/**
 * Filter options for listing tags.
 */
export interface SelectTagFilter extends BaseSelectFilter {
    /** Filter by owner ID */
    ownerId?: string;
    // state filter is now inherited from BaseSelectFilter
    /** Filter by tag color */
    color?: string;
}

/**
 * Filter options for listing users.
 */
export interface SelectUserFilter extends BaseSelectFilter {
    // state filter is now inherited from BaseSelectFilter
    /** Filter by user role ID */
    roleId?: string;
}

// --- Data Transfer Object Types (inferring from schema for inserts) ---

// Define explicit Insert types from schema definitions
// This provides better type safety than just using InferInsertModel directly everywhere
// as it's a single source of truth inferred from your schema.

export type InsertAccommodation = InferInsertModel<typeof accommodations>;
export type InsertAccommodationAmenity = InferInsertModel<typeof accommodationAmenities>;
export type InsertAmenity = InferInsertModel<typeof amenities>;
export type InsertAccommodationFaq = InferInsertModel<typeof accommodationFaqs>;
export type InsertAccommodationFeature = InferInsertModel<typeof accommodationFeatures>;
export type InsertFeature = InferInsertModel<typeof features>;
export type InsertAccommodationIaData = InferInsertModel<typeof accommodationIaData>;
export type InsertAccommodationReview = InferInsertModel<typeof accommodationReviews>;
export type InsertUserBookmark = InferInsertModel<typeof userBookmarks>;
export type InsertDestination = InferInsertModel<typeof destinations>;
export type InsertDestinationAttraction = InferInsertModel<typeof destinationAttractions>;
export type InsertDestinationReview = InferInsertModel<typeof destinationReviews>;
export type InsertEvent = InferInsertModel<typeof events>;
export type InsertEventLocation = InferInsertModel<typeof eventLocations>;
export type InsertEventOrganizer = InferInsertModel<typeof eventOrganizers>;
export type InsertPermission = InferInsertModel<typeof permissions>;
export type InsertPost = InferInsertModel<typeof posts>;
export type InsertPostSponsor = InferInsertModel<typeof postSponsors>;
export type InsertPostSponsorship = InferInsertModel<typeof postSponsorships>;
export type InsertRole = InferInsertModel<typeof roles>;
export type InsertTag = InferInsertModel<typeof tags>;
export type InsertEntityTagRelation = InferInsertModel<typeof entityTagRelations>;
export type InsertRolePermission = InferInsertModel<typeof rolePermissions>;
export type InsertUserPermission = InferInsertModel<typeof userPermissions>;
export type InsertUser = InferInsertModel<typeof users>;

// --- Update Data Types (based on Insert types) ---

// Define explicit Update types using the generic UpdateData helper
// Removed UpdateData types for relation tables as they typically don't have standard update fields

export type UpdateAccommodationData = UpdateData<InsertAccommodation>;
export type UpdateAccommodationAmenityData = UpdateData<InsertAccommodationAmenity>;
export type UpdateAmenityData = UpdateData<InsertAmenity>;
export type UpdateAccommodationFaqData = UpdateData<InsertAccommodationFaq>;
export type UpdateAccommodationFeatureData = UpdateData<InsertAccommodationFeature>;
export type UpdateFeatureData = UpdateData<InsertFeature>;
export type UpdateAccommodationIaData = UpdateData<InsertAccommodationIaData>;
export type UpdateAccommodationReviewData = UpdateData<InsertAccommodationReview>;
export type UpdateUserBookmarkData = UpdateData<InsertUserBookmark>;
export type UpdateDestinationData = UpdateData<InsertDestination>;
export type UpdateDestinationAttractionData = UpdateData<InsertDestinationAttraction>;
export type UpdateDestinationReviewData = UpdateData<InsertDestinationReview>;
export type UpdateEventData = UpdateData<InsertEvent>;
export type UpdateEventLocationData = UpdateData<InsertEventLocation>;
export type UpdateEventOrganizerData = UpdateData<InsertEventOrganizer>;
export type UpdatePermissionData = UpdateData<InsertPermission>;
export type UpdatePostData = UpdateData<InsertPost>;
export type UpdatePostSponsorData = UpdateData<InsertPostSponsor>;
export type UpdatePostSponsorshipData = UpdateData<InsertPostSponsorship>;
export type UpdateRoleData = UpdateData<InsertRole>;
export type UpdateTagData = UpdateData<InsertTag>;
export type UpdateUserData = UpdateData<InsertUser>;

// Note: For relation tables (r_accommodation_amenity, r_entity_tag, etc.), update operations are less common.
// You typically insert or delete relations rather than updating them.
// The UpdateData type is generally not useful for these tables.
