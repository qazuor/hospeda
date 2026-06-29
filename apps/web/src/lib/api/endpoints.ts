/**
 * Pre-configured endpoint functions for consuming public API routes.
 * Each entity has a namespace with typed methods for its endpoints.
 */
import type {
    AccommodationPublic,
    AccommodationSummary,
    AmenityPublic,
    AnnouncementItem,
    CommerceLeadCreateInput,
    DestinationPublic,
    EventPublic,
    EventSummary,
    ExternalReputationBlock,
    FeaturePublic,
    GastronomyPublic,
    PartnerPublic,
    PostListItem,
    PostPublic,
    PostSummary
} from '@repo/schemas';
import { apiClient } from './client';
import type { ApiResult, PaginatedResponse } from './types';

/** Review item with user info (from GET /accommodations/:id/reviews). */
interface AccommodationReviewPublicItem {
    readonly id: string;
    readonly title?: string;
    readonly content?: string;
    readonly averageRating?: number;
    readonly rating?: Record<string, number>;
    readonly user?: { readonly name: string | null; readonly image: string | null };
    readonly createdAt?: string;
}

/**
 * Review item with user info (from GET /destinations/:id/reviews).
 * Mirrors the public destination review schema; the rating object holds the
 * 16-dimension breakdown that the destination review entity supports.
 */
interface DestinationReviewPublicItem {
    readonly id: string;
    readonly title?: string;
    readonly content?: string;
    readonly averageRating?: number;
    readonly rating?: Record<string, number>;
    readonly user?: { readonly name: string | null; readonly image: string | null };
    readonly createdAt?: string;
}

/** Aggregated stats for a destination (from GET /destinations/:id/stats). */
interface DestinationStatsItem {
    readonly accommodationsCount: number;
    readonly reviewsCount: number;
    readonly averageRating: number;
    readonly attractionsCount: number;
    readonly eventsCount: number;
}

const BASE = '/api/v1/public';

// --- Testimonials ---

/** Testimonial type from API */
interface TestimonialItem {
    id: string;
    type: 'accommodation' | 'destination';
    entityId: string;
    entityName: string;
    userName: string;
    avatarUrl?: string;
    rating: number;
    comment: string;
    date: string;
}

/** Public testimonials API endpoints */
export const testimonialsApi = {
    /** List testimonials (mixed accommodation + destination reviews) */
    list(params?: {
        page?: number;
        pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<TestimonialItem>>> {
        return apiClient.getList({ path: `${BASE}/testimonials`, params });
    }
};

// --- Global announcements (SPEC-156) ---

/**
 * Public global announcements API. Reads the currently-active items from
 * the public, cacheable endpoint shipped in SPEC-156 PR-1 (T-010). The API
 * filters by [startsAt, endsAt] server-side so this method returns a flat
 * array — no pagination envelope.
 */
export const announcementsApi = {
    /** List currently active global announcements (server-side date filtered). */
    list(): Promise<ApiResult<ReadonlyArray<AnnouncementItem>>> {
        return apiClient.get({ path: `${BASE}/announcements` });
    }
};

// --- Accommodations ---

/** Public accommodation API endpoints */
export const accommodationsApi = {
    /** List accommodations with pagination, search, sorting, and filters */
    list(params?: {
        page?: number;
        pageSize?: number;
        q?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        type?: string;
        types?: string;
        isFeatured?: boolean;
        destinationId?: string;
        destinationIds?: string;
        includeAmenities?: boolean;
        includeFeatures?: boolean;
        minPrice?: number;
        maxPrice?: number;
        currency?: string;
        minGuests?: number;
        maxGuests?: number;
        minBedrooms?: number;
        maxBedrooms?: number;
        minBathrooms?: number;
        maxBathrooms?: number;
        minRating?: number;
        hasPool?: boolean;
        hasWifi?: boolean;
        allowsPets?: boolean;
        hasParking?: boolean;
        amenities?: string;
        /** Comma-separated feature IDs to filter by. */
        features?: string;
        /** Include accommodations without a listed price. */
        includeNoPrice?: boolean;
        /** Include accommodations without any reviews/rating. */
        includeNoReviews?: boolean;
        /** SPEC-097 — viewport bbox (top edge latitude). */
        bboxNorth?: number;
        /** SPEC-097 — viewport bbox (bottom edge latitude). */
        bboxSouth?: number;
        /** SPEC-097 — viewport bbox (right edge longitude). */
        bboxEast?: number;
        /** SPEC-097 — viewport bbox (left edge longitude). */
        bboxWest?: number;
        /** Geo radius — latitude of the search center (decimal degrees). */
        latitude?: number;
        /** Geo radius — longitude of the search center (decimal degrees). */
        longitude?: number;
        /** Geo radius — radius in kilometers around (latitude, longitude). */
        radius?: number;
    }): Promise<ApiResult<PaginatedResponse<AccommodationPublic>>> {
        return apiClient.getList({ path: `${BASE}/accommodations`, params });
    },

    /**
     * List accommodations owned by a specific user.
     *
     * Hits GET /api/v1/public/users/:userId/accommodations.
     * The `ownerId` filter is applied server-side — the client only provides
     * the user UUID via the URL path, not as a query param.
     * A non-existent user returns an empty paginated list (HTTP 200).
     *
     * @param params - User ID and optional pagination
     * @returns Paginated list of the owner's active accommodations
     *
     * @example
     * ```ts
     * const result = await accommodationsApi.listByOwner({
     *   userId: 'user-uuid',
     *   pageSize: 4
     * });
     * ```
     */
    listByOwner({
        userId,
        page,
        pageSize
    }: {
        readonly userId: string;
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<AccommodationPublic>>> {
        return apiClient.getList({
            path: `${BASE}/users/${userId}/accommodations`,
            params: { page, pageSize }
        });
    },

    /** Get accommodation by slug */
    getBySlug({ slug }: { slug: string }): Promise<ApiResult<AccommodationPublic>> {
        return apiClient.get({ path: `${BASE}/accommodations/slug/${slug}` });
    },

    /** Get accommodation by ID */
    getById({ id }: { id: string }): Promise<ApiResult<AccommodationPublic>> {
        return apiClient.get({ path: `${BASE}/accommodations/${id}` });
    },

    /**
     * Get all accommodations for a destination.
     *
     * NOTE: This endpoint (`GET /public/accommodations/destination/:id`) returns
     * `{ accommodations: AccommodationPublic[] }` — NOT a paginated envelope.
     * It ignores page/pageSize and returns ALL accommodations for the destination.
     * Do NOT assume `.items` or `.pagination` fields exist on the response data.
     */
    getByDestination({
        destinationId
    }: {
        destinationId: string;
    }): Promise<ApiResult<{ readonly accommodations: readonly AccommodationPublic[] }>> {
        return apiClient.get({
            path: `${BASE}/accommodations/destination/${destinationId}`
        });
    },

    /**
     * Get top-rated accommodations for a destination.
     *
     * @param params - Destination ID to filter by
     * @returns Paginated list of top-rated accommodations
     *
     * @example
     * ```ts
     * const result = await accommodationsApi.getTopRatedByDestination({ destinationId: 'dest-uuid' });
     * ```
     */
    getTopRatedByDestination({
        destinationId
    }: {
        readonly destinationId: string;
    }): Promise<ApiResult<PaginatedResponse<AccommodationPublic>>> {
        return apiClient.getList({
            path: `${BASE}/accommodations/destination/${destinationId}/top-rated`
        });
    },

    /**
     * Get a lightweight summary for an accommodation.
     *
     * @param params - Accommodation ID to summarize
     * @returns Summary record with key fields only
     *
     * @example
     * ```ts
     * const result = await accommodationsApi.getSummary({ id: 'acc-uuid' });
     * ```
     */
    getSummary({ id }: { readonly id: string }): Promise<ApiResult<AccommodationSummary>> {
        return apiClient.get({ path: `${BASE}/accommodations/${id}/summary` });
    },

    /** Get similar accommodations (by type or destination). */
    getSimilar({
        id,
        limit
    }: {
        readonly id: string;
        readonly limit?: number;
    }): Promise<ApiResult<AccommodationPublic[]>> {
        return apiClient.get({
            path: `${BASE}/accommodations/${id}/similar`,
            params: limit != null ? { limit } : undefined
        });
    },

    /** Get paginated reviews for an accommodation (with user info). */
    getReviews({
        id,
        page,
        pageSize
    }: {
        readonly id: string;
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<AccommodationReviewPublicItem>>> {
        return apiClient.getList({
            path: `${BASE}/accommodations/${id}/reviews`,
            params: { page, pageSize }
        });
    },

    /**
     * Get the external reputation block for an accommodation.
     *
     * Hits GET /api/v1/public/accommodations/:id/external-reputation.
     * Returns a validated {@link ExternalReputationBlock} with per-platform
     * items (links, aggregate rating, Google snippets when TTL valid).
     * Gracefully returns an empty block on non-2xx responses.
     *
     * @param params - Accommodation ID
     * @returns External reputation block
     *
     * @example
     * ```ts
     * const result = await accommodationsApi.getExternalReputation({ id: 'acc-uuid' });
     * ```
     */
    getExternalReputation({
        id
    }: { readonly id: string }): Promise<ApiResult<ExternalReputationBlock>> {
        return apiClient.get({ path: `${BASE}/accommodations/${id}/external-reputation` });
    }
};

// --- Amenities ---

/** Public amenity API endpoints */
export const amenitiesApi = {
    /** List amenities with pagination and filters */
    list(params?: {
        page?: number;
        pageSize?: number;
        isActive?: boolean;
        isFeatured?: boolean;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<ApiResult<PaginatedResponse<AmenityPublic>>> {
        return apiClient.getList({ path: `${BASE}/amenities`, params });
    }
};

// --- Features ---

/** Public feature API endpoints */
export const featuresApi = {
    /** List features with pagination and filters */
    list(params?: {
        page?: number;
        pageSize?: number;
        isFeatured?: boolean;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<ApiResult<PaginatedResponse<FeaturePublic>>> {
        return apiClient.getList({ path: `${BASE}/features`, params });
    }
};

// --- Attractions ---

/** Public attraction API endpoints */
export const attractionsApi = {
    /** Get attraction by slug */
    getBySlug({ slug }: { readonly slug: string }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.get({ path: `${BASE}/attractions/by-slug/${slug}` });
    }
};

// --- Event Locations ---

/** Public event location API endpoints */
export const eventLocationsApi = {
    /** Get event location by slug */
    getBySlug({ slug }: { readonly slug: string }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.get({ path: `${BASE}/event-locations/slug/${slug}` });
    }
};

// --- Tags (user-tags: internal/system/user taxonomy) ---

/** Public tag API endpoints */
export const tagsApi = {
    /** Get tag by slug */
    getBySlug({ slug }: { readonly slug: string }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.get({ path: `${BASE}/tags/by-slug/${slug}` });
    }
};

// --- PostTags (public SEO taxonomy for blog posts — SPEC-086) ---

/**
 * Public PostTag item returned by GET /api/v1/public/posts/tags.
 * PostTags are the public SEO taxonomy for blog posts.
 * Completely separate from the user-tag subsystem (no slug on user-tags).
 */
export interface PostTagPublicItem {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly color: string;
    readonly icon: string | null | undefined;
    readonly lifecycleState: string;
    readonly description?: string | null;
    /** Only present when ?withCounts=true */
    readonly usageCount?: number;
}

/**
 * Public PostTag API endpoints (SPEC-086 — SEO taxonomy for blog posts).
 * These tags are completely separate from the user-tag subsystem.
 * Tags are managed by admins and linked to posts via r_post_post_tag.
 */
export const postTagsApi = {
    /**
     * List all ACTIVE PostTags.
     * Cache-Control: public, max-age=600 (set by the API).
     *
     * @param params - Optional params including withCounts flag
     * @returns Array of active PostTag items (with optional usageCount)
     *
     * @example
     * ```ts
     * const result = await postTagsApi.list({ withCounts: true });
     * if (result.ok) {
     *   const tagSlugs = result.data.map(t => t.slug);
     * }
     * ```
     */
    list(params?: {
        readonly withCounts?: boolean;
    }): Promise<ApiResult<readonly PostTagPublicItem[]>> {
        return apiClient.get({
            path: `${BASE}/posts/tags`,
            params: params?.withCounts ? { withCounts: 'true' } : undefined
        });
    }
};

// --- Destinations ---

/** Public destination API endpoints */
export const destinationsApi = {
    /** List destinations with pagination and hierarchy filters */
    list(params?: {
        page?: number;
        pageSize?: number;
        q?: string;
        /**
         * Restricts the columns the `q` text search runs against. 'name'
         * matches only the destination name; 'all' (default) matches name +
         * description. The city autocomplete picker uses 'name'.
         */
        searchScope?: 'all' | 'name';
        isFeatured?: boolean;
        country?: string;
        state?: string;
        city?: string;
        parentDestinationId?: string;
        destinationType?: string;
        level?: number;
        ancestorId?: string;
        includeEventCount?: boolean;
        // SPEC-098 T-052c: public sort whitelist is enforced server-side.
        // Allowed values: 'name', 'createdAt', 'mostSaved'.
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }): Promise<ApiResult<PaginatedResponse<DestinationPublic>>> {
        return apiClient.getList({ path: `${BASE}/destinations`, params });
    },

    /** Get destination by slug */
    getBySlug({ slug }: { slug: string }): Promise<ApiResult<DestinationPublic>> {
        return apiClient.get({ path: `${BASE}/destinations/slug/${slug}` });
    },

    /** Get destination by ID */
    getById({ id }: { id: string }): Promise<ApiResult<DestinationPublic>> {
        return apiClient.get({ path: `${BASE}/destinations/${id}` });
    },

    /** Get direct children of a destination */
    getChildren({
        id
    }: { id: string }): Promise<ApiResult<{ children: readonly DestinationPublic[] }>> {
        return apiClient.get({ path: `${BASE}/destinations/${id}/children` });
    },

    /**
     * Get a destination by its hierarchical path.
     *
     * @param params - Hierarchical path string (e.g. `/argentina/litoral/entre-rios`)
     * @returns The matching destination record
     *
     * @example
     * ```ts
     * const result = await destinationsApi.getByPath({ path: '/argentina/litoral' });
     * ```
     */
    getByPath({ path }: { readonly path: string }): Promise<ApiResult<DestinationPublic>> {
        return apiClient.get({ path: `${BASE}/destinations/by-path`, params: { path } });
    },

    /**
     * Get all descendant destinations of a given destination.
     *
     * @param params - Destination ID, optional max depth, and optional type filter
     * @returns Flat list of all descendant destinations
     *
     * @example
     * ```ts
     * const result = await destinationsApi.getDescendants({ id: 'dest-uuid', maxDepth: 2 });
     * ```
     */
    getDescendants({
        id,
        maxDepth,
        destinationType
    }: {
        readonly id: string;
        readonly maxDepth?: number;
        readonly destinationType?: string;
    }): Promise<ApiResult<readonly DestinationPublic[]>> {
        return apiClient.get({
            path: `${BASE}/destinations/${id}/descendants`,
            params: { maxDepth, destinationType }
        });
    },

    /**
     * Get the ancestor chain of a destination (from root to direct parent).
     *
     * @param params - Destination ID
     * @returns Ordered list of ancestor destinations from root to parent
     *
     * @example
     * ```ts
     * const result = await destinationsApi.getAncestors({ id: 'dest-uuid' });
     * ```
     */
    getAncestors({
        id
    }: { readonly id: string }): Promise<ApiResult<readonly DestinationPublic[]>> {
        return apiClient.get({ path: `${BASE}/destinations/${id}/ancestors` });
    },

    /**
     * Get breadcrumb navigation data for a destination.
     *
     * @param params - Destination ID
     * @returns Ordered breadcrumb items from root to current destination
     *
     * @example
     * ```ts
     * const result = await destinationsApi.getBreadcrumb({ id: 'dest-uuid' });
     * ```
     */
    getBreadcrumb({ id }: { readonly id: string }): Promise<
        ApiResult<{
            readonly breadcrumb: ReadonlyArray<{
                readonly id: string;
                readonly slug: string;
                readonly name: string;
                readonly level: number;
                readonly destinationType: string;
                readonly path: string;
            }>;
        }>
    > {
        return apiClient.get({ path: `${BASE}/destinations/${id}/breadcrumb` });
    },

    /** Get accommodations associated with a destination */
    getAccommodations({
        id,
        page,
        pageSize
    }: {
        id: string;
        page?: number;
        pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<AccommodationPublic>>> {
        return apiClient.getList({
            path: `${BASE}/destinations/${id}/accommodations`,
            params: { page, pageSize }
        });
    },

    /** Get paginated reviews for a destination (with user info). */
    getReviews({
        id,
        page,
        pageSize
    }: {
        readonly id: string;
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<DestinationReviewPublicItem>>> {
        return apiClient.getList({
            path: `${BASE}/destinations/${id}/reviews`,
            params: { page, pageSize }
        });
    },

    /** Get aggregated stats for a destination (counts + averageRating). */
    getStats({ id }: { readonly id: string }): Promise<ApiResult<DestinationStatsItem>> {
        return apiClient.get({ path: `${BASE}/destinations/${id}/stats` });
    }
};

// --- Events ---

/** Public event API endpoints */
export const eventsApi = {
    /** List events with pagination and filters */
    list(params?: {
        page?: number;
        pageSize?: number;
        q?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        isFeatured?: boolean;
        category?: string;
        /** Filter events by destination UUID (resolved via event_locations.destination_id). */
        destinationId?: string;
        /** ISO date string — only return events starting on or after this date. */
        startDateAfter?: string;
        /** ISO date string — only return events starting on or before this date. */
        startDateBefore?: string;
        /** Minimum event price (inclusive). */
        minPrice?: number;
        /** Maximum event price (inclusive). */
        maxPrice?: number;
        /** When true, only return free events (price === 0 or isFree flag). */
        isFree?: boolean;
        /**
         * When true and any price filter is active, also include events whose
         * `pricing` is NULL (events without an established price).
         */
        includeUnpriced?: boolean;
    }): Promise<ApiResult<PaginatedResponse<EventPublic>>> {
        return apiClient.getList({ path: `${BASE}/events`, params });
    },

    /** Get event by slug */
    getBySlug({ slug }: { slug: string }): Promise<ApiResult<EventPublic>> {
        return apiClient.get({ path: `${BASE}/events/slug/${slug}` });
    },

    /** Get event by ID */
    getById({ id }: { id: string }): Promise<ApiResult<EventPublic>> {
        return apiClient.get({ path: `${BASE}/events/${id}` });
    },

    /**
     * Get upcoming events. SPEC-095 removed the legacy `city` filter — the
     * geographic dimension now lives on `eventLocation.destinationId`.
     */
    getUpcoming(params?: {
        daysAhead?: number;
        page?: number;
        pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<EventPublic>>> {
        return apiClient.getList({ path: `${BASE}/events/upcoming`, params });
    },

    /**
     * Get a lightweight summary for an event.
     *
     * @param params - Event ID to summarize
     * @returns Summary record with key fields only
     *
     * @example
     * ```ts
     * const result = await eventsApi.getSummary({ id: 'event-uuid' });
     * ```
     */
    getSummary({ id }: { readonly id: string }): Promise<ApiResult<EventSummary>> {
        return apiClient.get({ path: `${BASE}/events/${id}/summary` });
    }
};

// --- Posts ---

/** Public post/blog API endpoints */
export const postsApi = {
    /** List posts with pagination and filters */
    list(params?: {
        page?: number;
        pageSize?: number;
        q?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        category?: string;
        /** Filter posts by author UUID */
        authorId?: string;
        /** Filter posts by destination UUID (mapped server-side to `relatedDestinationId`). */
        destinationId?: string;
        /** Filter to featured posts only. */
        isFeatured?: boolean;
        /** Lower bound on `publishedAt` (ISO datetime). */
        publishedAfter?: string;
        /** Upper bound on `publishedAt` (ISO datetime). */
        publishedBefore?: string;
        /**
         * Filter posts by PostTag UUID(s).
         * Pass a single UUID or a comma-separated list.
         * Use postTagsApi.list() to resolve a slug → ID before calling this.
         *
         * @see SPEC-086 D-001, AC-F13
         */
        tags?: string;
    }): Promise<ApiResult<PaginatedResponse<PostPublic>>> {
        return apiClient.getList({ path: `${BASE}/posts`, params });
    },

    /** Get post by slug */
    getBySlug({ slug }: { slug: string }): Promise<ApiResult<PostPublic>> {
        return apiClient.get({ path: `${BASE}/posts/slug/${slug}` });
    },

    /** Get post by ID */
    getById({ id }: { id: string }): Promise<ApiResult<PostPublic>> {
        return apiClient.get({ path: `${BASE}/posts/${id}` });
    },

    /** Get featured posts */
    getFeatured(params?: {
        fromDate?: string;
        toDate?: string;
    }): Promise<ApiResult<PaginatedResponse<PostListItem>>> {
        return apiClient.getList({ path: `${BASE}/posts/featured`, params });
    },

    /** Get posts by category */
    getByCategory({
        category
    }: { category: string }): Promise<ApiResult<PaginatedResponse<PostListItem>>> {
        return apiClient.getList({ path: `${BASE}/posts/category/${category}` });
    },

    /**
     * Get a lightweight summary for a post.
     *
     * @param params - Post ID to summarize
     * @returns Summary record with key fields only
     *
     * @example
     * ```ts
     * const result = await postsApi.getSummary({ id: 'post-uuid' });
     * ```
     */
    getSummary({ id }: { readonly id: string }): Promise<ApiResult<PostSummary>> {
        return apiClient.get({ path: `${BASE}/posts/${id}/summary` });
    },

    /**
     * Get posts related to a destination via the dedicated public endpoint.
     * The general `list({ destinationId })` filter does NOT do the same thing —
     * the related endpoint applies the relation graph rather than a flat filter.
     */
    getByRelatedDestination({
        destinationId
    }: { readonly destinationId: string }): Promise<ApiResult<PaginatedResponse<PostListItem>>> {
        return apiClient.getList({
            path: `${BASE}/posts/related/destination/${destinationId}`
        });
    }
};

// --- Platform Stats ---

/** Shape returned by the platform stats endpoint */
interface PlatformStats {
    readonly accommodations: number;
    readonly destinations: number;
    readonly events: number;
    readonly posts: number;
    readonly reviews: number;
    /** Global accommodation rating average on a 0-5 scale (rounded to 2 decimals). */
    readonly averageRating: number;
    /** Recent reviewer avatar URLs for the public hero "social proof" overlay. */
    readonly recentReviewerAvatars: readonly string[];
}

/** Public platform stats API endpoints */
export const statsApi = {
    /** Get platform-wide aggregate counts */
    getPlatformStats(): Promise<ApiResult<PlatformStats>> {
        return apiClient.get({ path: `${BASE}/stats` });
    }
};

// --- Plans ---

/**
 * Public plan item returned by GET /api/v1/public/plans.
 * Monetary values are in ARS cents (integer). Divide by 100 to get pesos.
 */
export interface PlanPublicItem {
    readonly slug: string;
    readonly name: string;
    readonly description: string;
    readonly category: 'owner' | 'complex' | 'tourist';
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number | null;
    readonly monthlyPriceUsdRef: number;
    readonly hasTrial: boolean;
    readonly trialDays: number;
    readonly isDefault: boolean;
    readonly sortOrder: number;
    readonly isActive: boolean;
    readonly entitlements: readonly string[];
    readonly limits: ReadonlyArray<{
        readonly key: string;
        readonly value: number;
        readonly name: string;
        readonly description: string;
    }>;
}

/** Public plans API endpoints */
export const plansApi = {
    /**
     * List all active billing plans.
     * Returns pricing in ARS cents, trial info, entitlements, and limits.
     * Data is sourced from billing configuration (canonical source of truth).
     *
     * @returns Array of active plan definitions
     *
     * @example
     * ```ts
     * const result = await plansApi.list();
     * if (result.ok) {
     *   const ownerPlans = result.data.filter(p => p.category === 'owner');
     * }
     * ```
     */
    list(): Promise<ApiResult<readonly PlanPublicItem[]>> {
        return apiClient.get({ path: `${BASE}/plans` });
    }
};

// --- Conversations (Public) ---

/** Message item returned by guest thread endpoint */
export interface GuestMessageItem {
    readonly id: string;
    readonly body: string;
    readonly senderType: 'guest' | 'owner' | 'system';
    readonly createdAt: string;
}

/** Conversation data returned by guest thread endpoint */
export interface GuestConversationData {
    readonly id: string;
    readonly status: string;
    readonly accommodationName: string | null;
    readonly ownerName: string | null;
    readonly lastReadAtByOwner: string | null;
    readonly createdAt: string;
}

/** Response shape for GET /public/conversations/guest/:token */
export interface GuestThreadResponse {
    readonly conversation: GuestConversationData;
    readonly messages: readonly GuestMessageItem[];
    readonly hasMore: boolean;
}

/** Public conversations API endpoints (anonymous guest flows) */
export const publicConversationsApi = {
    /**
     * Initiate a new conversation as an anonymous guest.
     *
     * @param params - Guest info and accommodation ID + message
     * @returns Status of the initiation (pending_verification | resent | conflict)
     */
    initiate(params: {
        readonly accommodationId: string;
        readonly guestName: string;
        readonly guestEmail: string;
        readonly guestPhone?: string;
        readonly message: string;
    }): Promise<
        ApiResult<{
            readonly status: 'pending_verification' | 'resent' | 'conflict';
            readonly conversationId?: string;
        }>
    > {
        return apiClient.post({ path: `${BASE}/conversations/initiate`, body: params });
    },

    /**
     * Request an access link to an existing conversation by email.
     * Always returns 200 with sent_if_exists (anti-enumeration).
     *
     * @param params - Email address to send the link to
     */
    requestAccess(params: {
        readonly email: string;
    }): Promise<ApiResult<{ readonly status: 'sent_if_exists' }>> {
        return apiClient.post({ path: `${BASE}/conversations/request-access`, body: params });
    },

    /**
     * Fetch an anonymous guest's conversation thread using a secure token.
     *
     * @param params - Token string and optional cursor/limit for pagination
     */
    getGuestThread(params: {
        readonly token: string;
        readonly cursor?: string;
        readonly limit?: number;
    }): Promise<ApiResult<GuestThreadResponse>> {
        const { token, ...rest } = params;
        return apiClient.get({
            path: `${BASE}/conversations/guest/${token}`,
            params: rest as Record<string, unknown>
        });
    },

    /**
     * Send a reply message as an anonymous guest.
     *
     * @param params - Token, message body
     * @returns The created message
     */
    sendGuestMessage(params: {
        readonly token: string;
        readonly body: string;
    }): Promise<ApiResult<GuestMessageItem>> {
        const { token, body } = params;
        return apiClient.post({
            path: `${BASE}/conversations/guest/${token}/messages`,
            body: { body }
        });
    }
};

// --- Users ---

/** Minimal public profile returned by the user-by-slug endpoint. */
export interface UserAuthorPublic {
    readonly id: string;
    readonly displayName: string | null;
    readonly slug: string;
    readonly avatar: string | null;
    readonly bio: string | null;
}

/** Public user API endpoints */
export const usersApi = {
    /**
     * Get a minimal public profile for a user by their URL slug.
     * Used by the author page (/publicaciones/autor/{slug}/).
     *
     * @param params - User URL slug
     * @returns Minimal public profile (id, displayName, slug, avatar, bio)
     *
     * @example
     * ```ts
     * const result = await usersApi.getBySlug({ slug: 'maria-garcia' });
     * if (result.ok) {
     *   console.log(result.data.displayName);
     * }
     * ```
     */
    getBySlug({ slug }: { readonly slug: string }): Promise<ApiResult<UserAuthorPublic>> {
        return apiClient.get({ path: `${BASE}/users/by-slug/${slug}` });
    }
};

// --- Search ---

/** Single search result item across entity groups. */
export interface PublicSearchResultItem {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly coverImage?: string;
    readonly type?: string;
    readonly category?: string;
}

/** A group of search results with count. */
export interface PublicSearchGroup {
    readonly items: readonly PublicSearchResultItem[];
    readonly total: number;
}

/** Full unified search response. */
export interface PublicSearchResponse {
    readonly accommodations: PublicSearchGroup;
    readonly destinations: PublicSearchGroup;
    readonly events: PublicSearchGroup;
    readonly posts: PublicSearchGroup;
}

/** Public unified search API endpoints */
export const searchApi = {
    /**
     * Unified cross-entity search across accommodations, destinations, events, and posts.
     * Requires q.length >= 2. Rate-limited at 30 req/min per IP.
     *
     * @param params - Search query and optional item limit per group
     * @returns Groups of matching items per entity type with total counts
     *
     * @example
     * ```ts
     * const result = await searchApi.search({ q: 'cabaña', limit: 5 });
     * if (result.ok) {
     *   console.log(result.data.accommodations.items);
     * }
     * ```
     */
    search({
        q,
        limit
    }: {
        readonly q: string;
        readonly limit?: number;
    }): Promise<ApiResult<PublicSearchResponse>> {
        return apiClient.get({
            path: `${BASE}/search`,
            params: limit != null ? { q, limit } : { q }
        });
    }
};

// --- Comments (Public — SPEC-165) ---

/**
 * A single approved comment returned by the public comment thread endpoint.
 * `createdAt` is a Date (parsed by the API client) — convert to ISO string
 * before passing to React islands via props.
 */
export interface CommentPublicItem {
    readonly id: string;
    /** Display name of the comment author. '[Usuario eliminado]' when account was deleted. */
    readonly authorName: string;
    readonly content: string;
    /** ISO 8601 date string as returned by the server. */
    readonly createdAt: string;
}

/**
 * Public comment API endpoints (no authentication required).
 * Supports both POST and EVENT entity types to enable re-use in T-015.
 */
export const commentsApi = {
    /**
     * List APPROVED comments for a post or event, oldest-first.
     *
     * Maps to:
     *   GET /api/v1/public/posts/:postId/comments   (entityType === 'POST')
     *   GET /api/v1/public/events/:eventId/comments (entityType === 'EVENT')
     *
     * Returns a paginated list; pass `page` / `pageSize` for subsequent pages.
     * The initial SSR load uses the defaults (page 1, pageSize 20).
     *
     * @param params - entity type, entity ID, pagination, and optional SSR cookie
     * @returns Paginated list of approved comments
     *
     * @example
     * ```ts
     * const result = await commentsApi.listByEntity({
     *   entityType: 'POST',
     *   entityId: post.id
     * });
     * if (result.ok) {
     *   const comments = result.data.items;
     * }
     * ```
     */
    listByEntity({
        entityType,
        entityId,
        page,
        pageSize
    }: {
        readonly entityType: 'POST' | 'EVENT';
        readonly entityId: string;
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<CommentPublicItem>>> {
        const segment = entityType === 'EVENT' ? 'events' : 'posts';
        const params: Record<string, unknown> = {};
        if (page !== undefined) params.page = page;
        if (pageSize !== undefined) params.pageSize = pageSize;
        return apiClient.getList({
            path: `${BASE}/${segment}/${entityId}/comments`,
            params: Object.keys(params).length > 0 ? params : undefined
        });
    }
};

// --- User Bookmarks (Public count — no auth required) ---

/** Public user bookmarks API endpoints (no auth required) */
export const userBookmarksPublicApi = {
    /**
     * Get the total number of users who have bookmarked a specific entity.
     * Results are cached server-side for 60 seconds.
     *
     * @param params - Entity type and entity UUID
     * @returns The public bookmark count for the entity
     *
     * @example
     * ```ts
     * const result = await userBookmarksPublicApi.count({
     *   entityType: 'ACCOMMODATION',
     *   entityId: 'acc-uuid'
     * });
     * if (result.ok) console.log(result.data.count);
     * ```
     */
    count({
        entityType,
        entityId
    }: {
        readonly entityType: 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST' | 'ATTRACTION';
        readonly entityId: string;
    }): Promise<ApiResult<{ readonly count: number }>> {
        return apiClient.get({
            path: `${BASE}/user-bookmarks/count`,
            params: { entityType, entityId }
        });
    }
};

// --- Contact ---

/** Contact form API endpoints */
export const contactApi = {
    /**
     * Submit a contact form with structured fields.
     *
     * @param params - Contact form fields including name, email, and message
     * @returns Whether the submission succeeded and a confirmation message
     *
     * @example
     * ```ts
     * const result = await contactApi.submit({
     *   firstName: 'Ana',
     *   lastName: 'García',
     *   email: 'ana@example.com',
     *   message: 'Hello!'
     * });
     * ```
     */
    submit({
        firstName,
        lastName,
        email,
        message,
        accommodationId,
        type
    }: {
        readonly firstName: string;
        readonly lastName: string;
        readonly email: string;
        readonly message: string;
        readonly accommodationId?: string;
        readonly type?: string;
    }): Promise<ApiResult<{ readonly success: boolean; readonly message: string }>> {
        return apiClient.post({
            path: `${BASE}/contact`,
            body: { firstName, lastName, email, message, accommodationId, type }
        });
    },

    /**
     * Send a contact message from the web contact page.
     *
     * Splits `name` on the first space into `firstName` / `lastName`.
     * The `subject` field is not forwarded to the API (included for logging only).
     *
     * @param params - Web contact form fields
     * @returns Whether the submission succeeded and a confirmation message
     *
     * @example
     * ```ts
     * const result = await contactApi.sendContactMessage({
     *   name: 'Ana García',
     *   email: 'ana@example.com',
     *   subject: 'Consulta',
     *   message: 'Hola, quería preguntar...'
     * });
     * ```
     */
    sendContactMessage({
        name,
        email,
        subject: _subject,
        message
    }: {
        readonly name: string;
        readonly email: string;
        readonly subject: string;
        readonly message: string;
    }): Promise<ApiResult<{ readonly success: boolean; readonly message: string }>> {
        const spaceIdx = name.indexOf(' ');
        const firstName = spaceIdx === -1 ? name : name.slice(0, spaceIdx);
        const lastName = spaceIdx === -1 ? '' : name.slice(spaceIdx + 1);
        return apiClient.post({
            path: `${BASE}/contact`,
            body: {
                firstName,
                lastName: lastName || firstName,
                email,
                message,
                type: 'general'
            }
        });
    }
};

/**
 * Response payload for the reset-password check endpoint (SPEC-118).
 *
 * Mirrors `ResetPasswordCheckResponse` exposed by `@repo/schemas` without
 * importing it directly here — the web app's `endpoints.ts` keeps types
 * local to avoid coupling pages to server-side schema modules.
 */
export type ResetPasswordCheckResult =
    | { readonly valid: true }
    | { readonly valid: false; readonly reason: 'expired' | 'invalid' };

/**
 * Authentication helper endpoints (public tier — no session required).
 *
 * Currently only the reset-password token check (SPEC-118). The bulk of the
 * auth surface is consumed via `@/lib/auth-client` (Better Auth client SDK);
 * this namespace covers the small set of Hospeda-specific auth helpers that
 * live on `/api/v1/public/auth/*`.
 */
export const authApi = {
    /**
     * Check whether a reset-password token is still usable, without consuming
     * it. Used by the SSR reset-password page to render an error state
     * instead of an empty form when the link is dead.
     *
     * @param params.token - The opaque reset-password token from the URL.
     * @returns `{ valid: true }` or `{ valid: false, reason }` on success;
     *   the result is wrapped in `ApiResult` for network/HTTP errors.
     */
    checkResetPasswordToken({
        token
    }: {
        readonly token: string;
    }): Promise<ApiResult<ResetPasswordCheckResult>> {
        return apiClient.get<ResetPasswordCheckResult>({
            path: `${BASE}/auth/reset-password/check`,
            params: { token }
        });
    }
};

// --- Gastronomy (SPEC-239) ---

/**
 * Review item shape returned by GET /gastronomies/:id/reviews.
 * The full shape is defined server-side (GastronomyReviewPublicSchema pick);
 * the web client only needs the fields actually rendered in the review list.
 */
export interface GastronomyReviewPublicItem {
    readonly id: string;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly averageRating?: number | null;
    readonly rating?: Record<string, number> | null;
    /** Reviewer's public profile from the user relation (Bug B7b fix). */
    readonly user?: {
        readonly id: string;
        readonly name?: string | null;
        readonly displayName?: string | null;
        readonly firstName?: string | null;
        readonly image?: string | null;
    } | null;
    readonly createdAt?: string | null;
}

/** Public gastronomy API endpoints (SPEC-239 T-042..T-044). */
export const gastronomyApi = {
    /**
     * List gastronomy listings with pagination, search, sorting, and filters.
     *
     * GET /api/v1/public/gastronomies
     */
    list(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly q?: string;
        readonly destinationId?: string;
        readonly type?: string;
        readonly priceRange?: string;
        readonly isFeatured?: boolean;
        readonly minRating?: number;
        readonly maxRating?: number;
        readonly sortBy?: string;
        readonly sortOrder?: 'asc' | 'desc';
        readonly includeAmenities?: boolean;
        readonly includeFeatures?: boolean;
    }): Promise<ApiResult<PaginatedResponse<GastronomyPublic>>> {
        return apiClient.getList({ path: `${BASE}/gastronomies`, params });
    },

    /**
     * Get a single gastronomy listing by its URL slug.
     *
     * GET /api/v1/public/gastronomies/slug/:slug
     */
    getBySlug({ slug }: { readonly slug: string }): Promise<ApiResult<GastronomyPublic>> {
        return apiClient.get({ path: `${BASE}/gastronomies/slug/${slug}` });
    },

    /**
     * Get paginated reviews for a gastronomy listing (with user info).
     *
     * GET /api/v1/public/gastronomies/:id/reviews
     */
    getReviews({
        id,
        page,
        pageSize
    }: {
        readonly id: string;
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<GastronomyReviewPublicItem>>> {
        return apiClient.getList({
            path: `${BASE}/gastronomies/${id}/reviews`,
            params: { page, pageSize }
        });
    },

    /**
     * Get the FAQ list for a gastronomy listing.
     *
     * GET /api/v1/public/gastronomies/:id/faqs
     */
    getFaqs({ id }: { readonly id: string }): Promise<ApiResult<ReadonlyArray<unknown>>> {
        return apiClient.get({ path: `${BASE}/gastronomies/${id}/faqs` });
    }
};

// --- Experiences (SPEC-240) ---

/**
 * Review item shape returned by GET /experiences/:id/reviews.
 * The web client only needs the fields actually rendered in the review list.
 */
export interface ExperienceReviewPublicItem {
    readonly id: string;
    readonly title?: string | null;
    readonly content?: string | null;
    readonly averageRating?: number | null;
    readonly rating?: Record<string, number> | null;
    readonly user?: { readonly name: string | null; readonly image: string | null } | null;
    readonly createdAt?: string | null;
}

/** Public experience API endpoints (SPEC-240 T-019). */
export const experiencesApi = {
    /**
     * List experience listings with pagination, search, sorting, and filters.
     *
     * GET /api/v1/public/experiences
     */
    list(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly q?: string;
        readonly destinationId?: string;
        readonly type?: string;
        readonly isFeatured?: boolean;
        readonly minRating?: number;
        readonly maxRating?: number;
        readonly sortBy?: string;
        readonly sortOrder?: 'asc' | 'desc';
        readonly includeAmenities?: boolean;
        readonly includeFeatures?: boolean;
    }): Promise<ApiResult<PaginatedResponse<Record<string, unknown>>>> {
        return apiClient.getList({ path: `${BASE}/experiences`, params });
    },

    /**
     * Get a single experience listing by its URL slug.
     *
     * GET /api/v1/public/experiences/slug/:slug
     */
    getBySlug({ slug }: { readonly slug: string }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.get({ path: `${BASE}/experiences/slug/${slug}` });
    },

    /**
     * Get paginated reviews for an experience listing (with user info).
     *
     * GET /api/v1/public/experiences/:id/reviews
     */
    getReviews({
        id,
        page,
        pageSize
    }: {
        readonly id: string;
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<ExperienceReviewPublicItem>>> {
        return apiClient.getList({
            path: `${BASE}/experiences/${id}/reviews`,
            params: { page, pageSize }
        });
    },

    /**
     * Get the FAQ list for an experience listing.
     *
     * GET /api/v1/public/experiences/:id/faqs
     */
    getFaqs({ id }: { readonly id: string }): Promise<ApiResult<ReadonlyArray<unknown>>> {
        return apiClient.get({ path: `${BASE}/experiences/${id}/faqs` });
    }
};

// --- Commerce lead (SPEC-239 T-047) ---

/**
 * Commerce lead submission — wraps the honeypot field so the
 * caller does not need to know the field name.
 *
 * The server silently returns 200 on honeypot rejection, so the
 * success path is indistinguishable from a real submission to bots.
 */
export type CommerceLeadSubmitBody = CommerceLeadCreateInput & {
    /** Honeypot field — must be sent as empty string by real users. */
    readonly _hp?: string;
};

/** Public commerce lead API endpoints (SPEC-239 T-047). */
export const commerceLeadApi = {
    /**
     * Submit a pre-onboarding commerce lead.
     *
     * POST /api/v1/public/commerce/leads
     *
     * Always include `_hp: ''` in the body — the server silently drops
     * submissions where `_hp` is non-empty (honeypot spam guard).
     */
    submit(body: CommerceLeadSubmitBody): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.post({ path: `${BASE}/commerce/leads`, body });
    }
};

// --- Owner Promotions (SPEC-285) ---

/**
 * Public shape for a single owner promotion returned by the list endpoint.
 *
 * `discountValue` semantics by type:
 *  - `percentage`: plain integer (e.g. 20 → 20 %)
 *  - `fixed`: integer in ARS centavos (e.g. 5000 → $50)
 *  - `free_night`: integer count of free nights
 */
export interface OwnerPromotionPublicItem {
    readonly id: string;
    readonly slug: string;
    /** Null when the promotion applies to all of the owner's accommodations. */
    readonly accommodationId: string | null | undefined;
    readonly title: string;
    readonly description?: string | null;
    readonly discountType: 'percentage' | 'fixed' | 'free_night';
    readonly discountValue: number;
    readonly minNights?: number | null;
    readonly validFrom: string;
    readonly validUntil?: string | null;
}

/**
 * Public owner-promotions API endpoints (SPEC-285).
 *
 * The API resolves owner-wide promotions (accommodationId=null) server-side
 * when an accommodationId is provided — the client only passes one param.
 */
export const ownerPromotionsApi = {
    /**
     * List active promotions for an accommodation, including owner-wide
     * (accommodationId=null) promotions resolved via the accommodation's owner.
     *
     * Maps to: GET /api/v1/public/owner-promotions?accommodationId=:id
     *
     * Graceful degradation: returns an empty list on any fetch / HTTP error.
     *
     * @param params - The accommodation UUID
     * @returns Paginated list of active public promotions
     *
     * @example
     * ```ts
     * const result = await ownerPromotionsApi.listByAccommodation({ accommodationId: 'acc-uuid' });
     * if (result.ok) {
     *   const promos = result.data.items;
     * }
     * ```
     */
    listByAccommodation({
        accommodationId
    }: {
        readonly accommodationId: string;
    }): Promise<ApiResult<PaginatedResponse<OwnerPromotionPublicItem>>> {
        return apiClient.getList({
            path: `${BASE}/owner-promotions`,
            params: { accommodationId }
        });
    }
};

/**
 * Partner public API endpoints.
 */
export const partnerApi = {
    /**
     * List active partners with pagination.
     *
     * GET /api/v1/public/partners
     */
    list(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly q?: string;
        readonly type?: string;
        readonly tier?: string;
    }): Promise<ApiResult<PaginatedResponse<PartnerPublic>>> {
        return apiClient.getList({ path: `${BASE}/partners`, params });
    }
};
