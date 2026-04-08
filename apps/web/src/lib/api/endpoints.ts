/**
 * Pre-configured endpoint functions for consuming public API routes.
 * Each entity has a namespace with typed methods for its endpoints.
 */
import type {
    AccommodationPublic,
    AccommodationSummary,
    DestinationPublic,
    EventPublic,
    EventSummary,
    PostListItem,
    PostPublic,
    PostSummary
} from '@repo/schemas';
import { apiClient } from './client';
import type { ApiResult, PaginatedResponse } from './types';

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
        isFeatured?: boolean;
        destinationId?: string;
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
    }): Promise<ApiResult<PaginatedResponse<AccommodationPublic>>> {
        return apiClient.getList({ path: `${BASE}/accommodations`, params });
    },

    /** Get accommodation by slug */
    getBySlug({ slug }: { slug: string }): Promise<ApiResult<AccommodationPublic>> {
        return apiClient.get({ path: `${BASE}/accommodations/slug/${slug}` });
    },

    /** Get accommodation by ID */
    getById({ id }: { id: string }): Promise<ApiResult<AccommodationPublic>> {
        return apiClient.get({ path: `${BASE}/accommodations/${id}` });
    },

    /** Get accommodations for a destination */
    getByDestination({
        destinationId,
        page,
        pageSize
    }: {
        destinationId: string;
        page?: number;
        pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<AccommodationPublic>>> {
        return apiClient.getList({
            path: `${BASE}/accommodations/destination/${destinationId}`,
            params: { page, pageSize }
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
        isFeatured?: boolean;
        country?: string;
        state?: string;
        city?: string;
        parentDestinationId?: string;
        destinationType?: string;
        level?: number;
        ancestorId?: string;
        includeEventCount?: boolean;
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

    /** Get upcoming events */
    getUpcoming(params?: {
        daysAhead?: number;
        city?: string;
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
}

/** Public platform stats API endpoints */
export const statsApi = {
    /** Get platform-wide aggregate counts */
    getPlatformStats(): Promise<ApiResult<PlatformStats>> {
        return apiClient.get({ path: `${BASE}/stats` });
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
