/**
 * Protected and auxiliary endpoint functions for consuming API routes.
 * Auth, user bookmarks, user profile, tags, plans, and exchange rates.
 */
import type {
    AccommodationReviewListItem,
    DestinationReviewListItem,
    UserBookmark,
    UserProtected,
    UserPublic
} from '@repo/schemas';
import { apiClient } from './client';
import type { ApiResult, PaginatedResponse } from './types';

const BASE = '/api/v1/public';

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
