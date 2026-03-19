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

    /** Get top-rated accommodations for a destination */
    getTopRatedByDestination({
        destinationId
    }: {
        destinationId: string;
    }): Promise<ApiResult<PaginatedResponse<AccommodationPublic>>> {
        return apiClient.getList({
            path: `${BASE}/accommodations/destination/${destinationId}/top-rated`
        });
    },

    /** Get accommodation summary */
    getSummary({ id }: { id: string }): Promise<ApiResult<AccommodationSummary>> {
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

    /** Get destination by hierarchical path (e.g., /argentina/litoral/entre-rios) */
    getByPath({ path }: { path: string }): Promise<ApiResult<DestinationPublic>> {
        return apiClient.get({ path: `${BASE}/destinations/by-path`, params: { path } });
    },

    /** Get direct children of a destination */
    getChildren({
        id
    }: { id: string }): Promise<ApiResult<{ children: readonly DestinationPublic[] }>> {
        return apiClient.get({ path: `${BASE}/destinations/${id}/children` });
    },

    /** Get all descendants of a destination */
    getDescendants({
        id,
        maxDepth,
        destinationType
    }: {
        id: string;
        maxDepth?: number;
        destinationType?: string;
    }): Promise<ApiResult<DestinationPublic[]>> {
        return apiClient.get({
            path: `${BASE}/destinations/${id}/descendants`,
            params: { maxDepth, destinationType }
        });
    },

    /** Get ancestor chain of a destination */
    getAncestors({ id }: { id: string }): Promise<ApiResult<DestinationPublic[]>> {
        return apiClient.get({ path: `${BASE}/destinations/${id}/ancestors` });
    },

    /** Get breadcrumb navigation for a destination */
    getBreadcrumb({
        id
    }: {
        id: string;
    }): Promise<
        ApiResult<{
            breadcrumb: readonly {
                id: string;
                slug: string;
                name: string;
                level: number;
                destinationType: string;
                path: string;
            }[];
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

    /** Get event summary */
    getSummary({ id }: { id: string }): Promise<ApiResult<EventSummary>> {
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

    /** Get post summary */
    getSummary({ id }: { id: string }): Promise<ApiResult<PostSummary>> {
        return apiClient.get({ path: `${BASE}/posts/${id}/summary` });
    }
};

// --- Tags ---

/** Public tag response (subset of full Tag model) */
interface TagPublicResponse {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
}

/** Public tag API endpoints */
export const tagsApi = {
    /** Get tag by slug */
    getBySlug({ slug }: { slug: string }): Promise<ApiResult<TagPublicResponse>> {
        return apiClient.get({ path: `${BASE}/tags/by-slug/${slug}` });
    }
};

// --- Contact ---

/** Contact form API */
export const contactApi = {
    /** Submit contact form */
    submit({
        firstName,
        lastName,
        email,
        message,
        accommodationId,
        type
    }: {
        firstName: string;
        lastName: string;
        email: string;
        message: string;
        accommodationId?: string;
        type?: string;
    }): Promise<ApiResult<{ success: boolean; message: string }>> {
        return apiClient.post({
            path: `${BASE}/contact`,
            body: { firstName, lastName, email, message, accommodationId, type }
        });
    },

    /**
     * Send a contact form message from the web contact page.
     *
     * Maps the web form shape `{ name, email, subject, message }` to the API's
     * `{ firstName, lastName, email, message, type }` envelope. The `name` field
     * is split on the first space; `subject` is not forwarded by the API schema
     * but is included for logging purposes.
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
    }): Promise<ApiResult<{ success: boolean; message: string }>> {
        const spaceIdx = name.indexOf(' ');
        const firstName = spaceIdx === -1 ? name : name.slice(0, spaceIdx);
        const lastName = spaceIdx === -1 ? '' : name.slice(spaceIdx + 1);
        return apiClient.post({
            path: `${BASE}/contact`,
            body: { firstName, lastName: lastName || firstName, email, message, type: 'general' }
        });
    }
};
