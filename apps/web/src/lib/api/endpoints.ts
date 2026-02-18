/**
 * Pre-configured endpoint functions for consuming public API routes.
 * Each entity has a namespace with typed methods for its endpoints.
 */
import type {
    AccommodationPublic,
    AccommodationReviewListItem,
    AccommodationSummary,
    DestinationPublic,
    DestinationReviewListItem,
    EventPublic,
    EventSummary,
    PostListItem,
    PostPublic,
    PostSummary,
    UserBookmark,
    UserProtected,
    UserPublic
} from '@repo/schemas';
import { apiClient } from './client';
import type { ApiResult, PaginatedResponse } from './types';

const BASE = '/api/v1/public';

// ─── Accommodations ───────────────────────────────────────────────────────────

/** Public accommodation API endpoints */
export const accommodationsApi = {
    /** List accommodations with pagination and filters */
    list(params?: {
        page?: number;
        pageSize?: number;
        q?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        type?: string;
        isFeatured?: boolean;
        destinationId?: string;
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

// ─── Destinations ─────────────────────────────────────────────────────────────

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

// ─── Events ───────────────────────────────────────────────────────────────────

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

// ─── Posts ─────────────────────────────────────────────────────────────────────

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

// ─── Contact ──────────────────────────────────────────────────────────────────

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
    }
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Auth-related public endpoints */
export const authApi = {
    /** Get current authenticated user info */
    me(): Promise<ApiResult<{ actor: UserPublic; isAuthenticated: boolean }>> {
        return apiClient.get({ path: `${BASE}/auth/me` });
    }
};

// ─── Protected Endpoints (require authentication) ────────────────────────────

const PROTECTED = '/api/v1/protected';

/** Protected user bookmark API endpoints */
export const userBookmarksApi = {
    /** List bookmarks for the authenticated user */
    list(params?: {
        page?: number;
        pageSize?: number;
        entityType?: 'ACCOMMODATION' | 'DESTINATION' | 'ATTRACTION' | 'EVENT' | 'POST';
    }): Promise<ApiResult<{ bookmarks: UserBookmark[]; total: number }>> {
        return apiClient.getProtected({ path: `${PROTECTED}/user-bookmarks`, params });
    },

    /** Get bookmark count for the authenticated user */
    count(params?: {
        entityType?: 'ACCOMMODATION' | 'DESTINATION' | 'ATTRACTION' | 'EVENT' | 'POST';
    }): Promise<ApiResult<{ count: number }>> {
        return apiClient.getProtected({ path: `${PROTECTED}/user-bookmarks/count`, params });
    },

    /** Check if an entity is bookmarked by the authenticated user */
    checkStatus(params: {
        entityId: string;
        entityType: 'ACCOMMODATION' | 'DESTINATION' | 'ATTRACTION' | 'EVENT' | 'POST';
    }): Promise<ApiResult<{ isFavorited: boolean; bookmarkId: string | null }>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/user-bookmarks/check`,
            params
        });
    },

    /** Toggle a bookmark (create if not exists, delete if exists) */
    toggle(body: {
        entityId: string;
        entityType: 'ACCOMMODATION' | 'DESTINATION' | 'ATTRACTION' | 'EVENT' | 'POST';
        name?: string;
    }): Promise<ApiResult<{ toggled: boolean; bookmark: UserBookmark | null }>> {
        return apiClient.postProtected({ path: `${PROTECTED}/user-bookmarks`, body });
    },

    /** Create a new bookmark (alias for toggle) */
    create(body: {
        entityId: string;
        entityType: 'ACCOMMODATION' | 'DESTINATION' | 'ATTRACTION' | 'EVENT' | 'POST';
        name?: string;
    }): Promise<ApiResult<{ toggled: boolean; bookmark: UserBookmark | null }>> {
        return apiClient.postProtected({ path: `${PROTECTED}/user-bookmarks`, body });
    },

    /** Delete a bookmark */
    delete({ id }: { id: string }): Promise<ApiResult<{ success: boolean }>> {
        return apiClient.delete({ path: `${PROTECTED}/user-bookmarks/${id}` });
    }
};

/** Subscription data returned by the protected subscription endpoint */
export interface SubscriptionData {
    readonly planSlug: string;
    readonly planName: string;
    readonly status: 'active' | 'trial' | 'cancelled' | 'expired' | 'pending';
    readonly currentPeriodStart: string | null;
    readonly currentPeriodEnd: string | null;
    readonly cancelAtPeriodEnd: boolean;
    readonly trialEndsAt: string | null;
    readonly monthlyPriceArs: number;
}

/** Protected user API endpoints */
export const userApi = {
    /** Get user profile by ID */
    getProfile({ id }: { id: string }): Promise<ApiResult<UserProtected>> {
        return apiClient.getProtected({ path: `${PROTECTED}/users/${id}` });
    },

    /** Update user profile (partial) */
    patchProfile({
        id,
        data
    }: { id: string; data: Record<string, unknown> }): Promise<ApiResult<UserProtected>> {
        return apiClient.patch({ path: `${PROTECTED}/users/${id}`, body: data });
    },

    /** Get user statistics (bookmark count, review count, plan info) */
    getStats(): Promise<
        ApiResult<{
            bookmarkCount: number;
            reviewCount: number;
            plan: { name: string; status: string } | null;
        }>
    > {
        return apiClient.getProtected({ path: `${PROTECTED}/users/me/stats` });
    },

    /** Get user reviews (accommodation + destination) */
    getReviews(params?: {
        page?: number;
        pageSize?: number;
        type?: 'accommodation' | 'destination' | 'all';
    }): Promise<
        ApiResult<{
            accommodationReviews: AccommodationReviewListItem[];
            destinationReviews: DestinationReviewListItem[];
            totals: { accommodationReviews: number; destinationReviews: number; total: number };
        }>
    > {
        return apiClient.getProtected({ path: `${PROTECTED}/users/me/reviews`, params });
    },

    /** Get the authenticated user's current subscription */
    getSubscription(): Promise<ApiResult<{ subscription: SubscriptionData | null }>> {
        return apiClient.getProtected({ path: `${PROTECTED}/users/me/subscription` });
    }
};

// ─── Tags ────────────────────────────────────────────────────────────────────

/** Public tag response (subset of full Tag) */
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

// ─── Plans (Billing) ─────────────────────────────────────────────────────────

/** Public billing plan API endpoints */
export const plansApi = {
    /** List all available plans */
    list(params?: {
        page?: number;
        pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<Record<string, unknown>>>> {
        return apiClient.getList({ path: `${BASE}/plans`, params });
    }
};

// ─── Exchange Rates ───────────────────────────────────────────────────────────

/**
 * Exchange rate item returned by the public exchange-rates endpoint.
 * `rate` is the conversion factor: 1 unit of `fromCurrency` in `toCurrency`.
 */
export interface ExchangeRateItem {
    readonly id: string;
    readonly fromCurrency: string;
    readonly toCurrency: string;
    readonly rate: number;
    readonly inverseRate: number;
    readonly rateType: string;
    readonly source: string;
    readonly isManualOverride: boolean;
    readonly fetchedAt: string;
}

/** Public exchange rate API endpoints */
export const exchangeRatesApi = {
    /**
     * List current exchange rates with optional currency filters.
     * Results are cached server-side for 5 minutes.
     */
    list(params?: {
        fromCurrency?: string;
        toCurrency?: string;
        page?: number;
        pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<ExchangeRateItem>>> {
        return apiClient.getList({ path: `${BASE}/exchange-rates`, params });
    }
};
