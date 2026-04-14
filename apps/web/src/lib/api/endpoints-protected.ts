/**
 * Protected and auxiliary endpoint functions for consuming API routes.
 * Auth, user bookmarks, user profile, billing, tags, plans, exchange rates, and reviews.
 *
 * All protected endpoints require an authenticated session (credentials: 'include').
 * The apiClient methods `getProtected` and `postProtected` handle this automatically.
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
const PROTECTED = '/api/v1/protected';

// --- Auth ---

/** Auth-related public endpoints */
export const authApi = {
    /**
     * Get the current authenticated user and their auth status.
     *
     * @returns The authenticated user's public profile and a flag indicating if they are signed in.
     *
     * @example
     * ```ts
     * const result = await authApi.me();
     * if (result.ok && result.data.isAuthenticated) {
     *   console.log(result.data.actor.name);
     * }
     * ```
     */
    me(): Promise<ApiResult<{ readonly actor: UserPublic; readonly isAuthenticated: boolean }>> {
        return apiClient.get({ path: `${BASE}/auth/me` });
    }
};

// --- User Bookmarks (Protected) ---

/** Entity type allowed for bookmarks */
type BookmarkEntityType = 'ACCOMMODATION' | 'DESTINATION' | 'ATTRACTION' | 'EVENT' | 'POST';

/** Protected user bookmark API endpoints */
export const userBookmarksApi = {
    /**
     * List bookmarks for the authenticated user.
     *
     * @param params - Optional pagination and entity type filter
     * @returns List of bookmarks and total count
     *
     * @example
     * ```ts
     * const result = await userBookmarksApi.list({ pageSize: 10 });
     * ```
     */
    list(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly entityType?: BookmarkEntityType;
    }): Promise<
        ApiResult<{ readonly bookmarks: readonly UserBookmark[]; readonly total: number }>
    > {
        return apiClient.getProtected({ path: `${PROTECTED}/user-bookmarks`, params });
    },

    /**
     * Check if an entity is bookmarked by the authenticated user.
     *
     * @param params - Entity ID and type to check
     * @returns Whether the entity is bookmarked and the bookmark ID if it exists
     *
     * @example
     * ```ts
     * const result = await userBookmarksApi.checkStatus({ entityId: '...', entityType: 'ACCOMMODATION' });
     * if (result.ok && result.data.isFavorited) { ... }
     * ```
     */
    checkStatus(params: {
        readonly entityId: string;
        readonly entityType: BookmarkEntityType;
    }): Promise<ApiResult<{ readonly isFavorited: boolean; readonly bookmarkId: string | null }>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/user-bookmarks/check`,
            params
        });
    },

    /**
     * Toggle a bookmark for an entity.
     * Creates the bookmark if it does not exist, deletes it if it does.
     *
     * @param body - Entity to toggle and optional display name
     * @returns Whether the bookmark was created (true) or removed (false)
     *
     * @example
     * ```ts
     * const result = await userBookmarksApi.toggle({ entityId: '...', entityType: 'ACCOMMODATION' });
     * ```
     */
    toggle(body: {
        readonly entityId: string;
        readonly entityType: BookmarkEntityType;
        readonly name?: string;
    }): Promise<ApiResult<{ readonly toggled: boolean; readonly bookmark: UserBookmark | null }>> {
        return apiClient.postProtected({ path: `${PROTECTED}/user-bookmarks`, body });
    },

    /**
     * Delete a bookmark by ID.
     *
     * @param params - Bookmark ID to delete
     * @returns Whether the deletion succeeded
     *
     * @example
     * ```ts
     * const result = await userBookmarksApi.delete({ id: 'bookmark-uuid' });
     * ```
     */
    delete({ id }: { readonly id: string }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.delete({ path: `${PROTECTED}/user-bookmarks/${id}` });
    }
};

// --- User (Protected) ---

/** Subscription status values */
type SubscriptionStatus = 'active' | 'trial' | 'cancelled' | 'expired' | 'past_due' | 'pending';

/** Subscription data returned by the protected subscription endpoint */
export interface SubscriptionData {
    readonly planSlug: string;
    readonly planName: string;
    readonly status: SubscriptionStatus;
    readonly currentPeriodStart: string | null;
    readonly currentPeriodEnd: string | null;
    readonly cancelAtPeriodEnd: boolean;
    readonly trialEndsAt: string | null;
    readonly monthlyPriceArs: number;
    readonly paymentMethod?: {
        readonly brand: string;
        readonly last4: string;
        readonly expMonth: number;
        readonly expYear: number;
    } | null;
    readonly gracePeriodDaysRemaining?: number | null;
    readonly gracePeriodExpiresAt?: string | null;
}

/** Protected user API endpoints */
export const userApi = {
    /**
     * Get the authenticated user's profile by ID.
     *
     * @param params - User ID to fetch
     * @returns The full protected user profile
     *
     * @example
     * ```ts
     * const result = await userApi.getProfile({ id: 'user-uuid' });
     * ```
     */
    getProfile({ id }: { readonly id: string }): Promise<ApiResult<UserProtected>> {
        return apiClient.getProtected({ path: `${PROTECTED}/users/${id}` });
    },

    /**
     * Get statistics for the authenticated user.
     *
     * @returns Bookmark count, review count, and current plan info
     *
     * @example
     * ```ts
     * const result = await userApi.getStats();
     * if (result.ok) console.log(result.data.bookmarkCount);
     * ```
     */
    getStats(): Promise<
        ApiResult<{
            readonly bookmarkCount: number;
            readonly reviewCount: number;
            readonly plan: { readonly name: string; readonly status: string } | null;
        }>
    > {
        return apiClient.getProtected({ path: `${PROTECTED}/users/me/stats` });
    },

    /**
     * Get the authenticated user's current subscription details.
     *
     * @returns Current subscription data or null if no active subscription
     *
     * @example
     * ```ts
     * const result = await userApi.getSubscription();
     * if (result.ok && result.data.subscription) { ... }
     * ```
     */
    getSubscription(): Promise<ApiResult<{ readonly subscription: SubscriptionData | null }>> {
        return apiClient.getProtected({ path: `${PROTECTED}/users/me/subscription` });
    },

    /**
     * Get reviews submitted by the authenticated user.
     *
     * @param params - Optional pagination and type filter
     * @returns Accommodation reviews, destination reviews, and totals
     *
     * @example
     * ```ts
     * const result = await userApi.getReviews({ type: 'accommodation' });
     * ```
     */
    getReviews(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly type?: 'accommodation' | 'destination' | 'all';
    }): Promise<
        ApiResult<{
            readonly accommodationReviews: readonly AccommodationReviewListItem[];
            readonly destinationReviews: readonly DestinationReviewListItem[];
            readonly totals: {
                readonly accommodationReviews: number;
                readonly destinationReviews: number;
                readonly total: number;
            };
        }>
    > {
        return apiClient.getProtected({ path: `${PROTECTED}/users/me/reviews`, params });
    },

    /**
     * Update the authenticated user's profile with partial data.
     *
     * @param params - User ID and data fields to update
     * @returns The updated user profile
     *
     * @example
     * ```ts
     * const result = await userApi.updateProfile({ id: 'user-uuid', data: { name: 'New Name' } });
     * ```
     */
    updateProfile({
        id,
        data
    }: {
        readonly id: string;
        readonly data: Record<string, unknown>;
    }): Promise<ApiResult<UserProtected>> {
        return apiClient.patch({ path: `${PROTECTED}/users/${id}`, body: data });
    },

    /**
     * Change the authenticated user's password.
     *
     * @param params - Current password and new password
     * @returns Whether the password change succeeded
     *
     * @example
     * ```ts
     * const result = await userApi.changePassword({ currentPassword: '...', newPassword: '...' });
     * ```
     */
    changePassword(params: {
        readonly currentPassword: string;
        readonly newPassword: string;
    }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/users/me/change-password`,
            body: params
        });
    }
};

// --- Billing (Protected) ---

/** Invoice status values */
type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'void';

/** Invoice item returned by the billing invoices endpoint */
export interface InvoiceItem {
    readonly id: string;
    readonly date: string;
    readonly description: string;
    readonly amount: number;
    readonly currency: string;
    readonly status: InvoiceStatus;
    readonly pdfUrl?: string;
}

/** Payment item returned by the billing payments endpoint */
export interface PaymentItem {
    readonly id: string;
    readonly date: string;
    readonly amount: number;
    readonly currency: string;
    readonly method: string;
    readonly status: string;
}

/** Usage summary for plan limits */
export interface UsageSummary {
    readonly limits: ReadonlyArray<{
        readonly key: string;
        readonly label: string;
        readonly current: number;
        readonly max: number | null;
    }>;
}

/** User addon item */
export interface UserAddon {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly status: 'active' | 'expiring_soon' | 'expired';
    readonly expiresAt?: string;
    readonly price: number;
    readonly currency: string;
}

/** Plan item for plan listing and selection */
export interface PlanItem {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly prices: ReadonlyArray<{
        readonly billingInterval: string;
        readonly unitAmount: number;
        readonly currency: string;
    }>;
    readonly features: readonly string[];
    readonly isCurrent?: boolean;
}

/** Protected billing API endpoints for the user dashboard */
export const billingApi = {
    /**
     * Request a plan change for the authenticated user's subscription.
     *
     * @param params - Target plan ID and billing interval
     * @returns Whether the plan change was accepted
     *
     * @example
     * ```ts
     * const result = await billingApi.changePlan({ planId: 'plan-uuid', billingInterval: 'monthly' });
     * ```
     */
    changePlan({
        planId,
        billingInterval
    }: {
        readonly planId: string;
        readonly billingInterval: string;
    }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/subscriptions/change-plan`,
            body: { planId, billingInterval }
        });
    },

    /**
     * Cancel the authenticated user's current subscription.
     *
     * @param params - Subscription ID to cancel
     * @returns Whether the cancellation succeeded
     *
     * @example
     * ```ts
     * const result = await billingApi.cancelSubscription({ subscriptionId: 'sub-uuid' });
     * ```
     */
    cancelSubscription({
        subscriptionId
    }: {
        readonly subscriptionId: string;
    }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.delete({
            path: `${PROTECTED}/billing/subscriptions/${subscriptionId}`
        });
    },

    /**
     * Reactivate a cancelled or expired subscription.
     *
     * @param params - Plan ID to reactivate with
     * @returns Whether the reactivation succeeded
     *
     * @example
     * ```ts
     * const result = await billingApi.reactivateSubscription({ planId: 'plan-uuid' });
     * ```
     */
    reactivateSubscription({
        planId
    }: {
        readonly planId: string;
    }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/trial/reactivate-subscription`,
            body: { planId }
        });
    },

    /**
     * Create a checkout session to purchase a plan.
     *
     * @param params - Plan ID and billing interval
     * @returns The checkout URL to redirect the user to
     *
     * @example
     * ```ts
     * const result = await billingApi.createCheckout({ planId: 'plan-uuid', billingInterval: 'yearly' });
     * if (result.ok) window.location.href = result.data.checkoutUrl;
     * ```
     */
    createCheckout({
        planId,
        billingInterval
    }: {
        readonly planId: string;
        readonly billingInterval: string;
    }): Promise<ApiResult<{ readonly checkoutUrl: string }>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/checkout`,
            body: { planId, billingInterval }
        });
    },

    /**
     * List the authenticated user's invoices with optional pagination.
     *
     * @param params - Optional pagination parameters
     * @returns Paginated list of invoices
     *
     * @example
     * ```ts
     * const result = await billingApi.listInvoices({ page: 1, pageSize: 10 });
     * ```
     */
    listInvoices(params?: {
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<InvoiceItem>>> {
        return apiClient.getList({
            path: `${PROTECTED}/billing/invoices`,
            params
        });
    },

    /**
     * List the authenticated user's payment history with optional pagination.
     *
     * @param params - Optional pagination parameters
     * @returns Paginated list of payments
     *
     * @example
     * ```ts
     * const result = await billingApi.listPayments({ page: 1 });
     * ```
     */
    listPayments(params?: {
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<PaymentItem>>> {
        return apiClient.getList({
            path: `${PROTECTED}/billing/payments`,
            params
        });
    },

    /**
     * Get the authenticated user's active addons.
     *
     * @returns List of active addons for the current user
     *
     * @example
     * ```ts
     * const result = await billingApi.getAddons();
     * if (result.ok) console.log(result.data.addons);
     * ```
     */
    getAddons(): Promise<ApiResult<{ readonly addons: readonly UserAddon[] }>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/billing/addons/my`
        });
    }
};

// --- Plans (Public) ---

/** Public billing plan API endpoints */
export const plansApi = {
    /**
     * List all available billing plans.
     *
     * @param params - Optional pagination parameters
     * @returns Paginated list of available plans
     *
     * @example
     * ```ts
     * const result = await plansApi.list();
     * ```
     */
    list(params?: {
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<Record<string, unknown>>>> {
        return apiClient.getList({ path: `${BASE}/plans`, params });
    },

    /**
     * Get a billing plan by its ID.
     *
     * @param params - Plan ID to fetch
     * @returns The plan record
     *
     * @example
     * ```ts
     * const result = await plansApi.getById({ id: 'plan-uuid' });
     * ```
     */
    getById({ id }: { readonly id: string }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.get({ path: `${BASE}/plans/${id}` });
    }
};

// --- Reviews (Protected) ---

/** Rating aspects required for an accommodation review */
export interface AccommodationReviewRating {
    readonly cleanliness: number;
    readonly hospitality: number;
    readonly services: number;
    readonly accuracy: number;
    readonly communication: number;
    readonly location: number;
}

/** Data sent when creating an accommodation review */
export interface CreateAccommodationReviewBody {
    readonly rating: AccommodationReviewRating;
    readonly title?: string;
    readonly content?: string;
}

/** Protected review API endpoints */
export const reviewsApi = {
    /**
     * Create a new review for an accommodation.
     *
     * @param params - Accommodation ID and review data
     * @returns The created review record
     *
     * @example
     * ```ts
     * const result = await reviewsApi.create({
     *   accommodationId: 'acc-uuid',
     *   body: { rating: { cleanliness: 5, hospitality: 5, services: 5, accuracy: 5, communication: 5, location: 5 } }
     * });
     * ```
     */
    create({
        accommodationId,
        body
    }: {
        readonly accommodationId: string;
        readonly body: CreateAccommodationReviewBody;
    }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/accommodations/${accommodationId}/reviews`,
            body
        });
    },

    /**
     * Update an existing review.
     *
     * @param params - Review ID and updated data
     * @returns The updated review record
     *
     * @example
     * ```ts
     * const result = await reviewsApi.update({ reviewId: 'rev-uuid', body: { content: 'Updated review' } });
     * ```
     */
    update({
        reviewId,
        body
    }: {
        readonly reviewId: string;
        readonly body: Partial<CreateAccommodationReviewBody>;
    }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.patch({
            path: `${PROTECTED}/reviews/${reviewId}`,
            body
        });
    },

    /**
     * Delete a review by ID.
     *
     * @param params - Review ID to delete
     * @returns Whether the deletion succeeded
     *
     * @example
     * ```ts
     * const result = await reviewsApi.delete({ reviewId: 'rev-uuid' });
     * ```
     */
    delete({
        reviewId
    }: { readonly reviewId: string }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.delete({ path: `${PROTECTED}/reviews/${reviewId}` });
    }
};

// --- Exchange Rates (Public) ---

/**
 * Exchange rate item returned by the public exchange-rates endpoint.
 * `rate` is the conversion factor: 1 unit of `fromCurrency` expressed in `toCurrency`.
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

/** Exchange rate configuration returned by the config endpoint */
export interface ExchangeRateConfig {
    readonly defaultFromCurrency: string;
    readonly defaultToCurrency: string;
    readonly updateIntervalMinutes: number;
}

/** Public exchange rate API endpoints */
export const exchangeRatesApi = {
    /**
     * List current exchange rates with optional currency filters.
     * Results are cached server-side for 5 minutes.
     *
     * @param params - Optional currency filters and pagination
     * @returns Paginated list of exchange rate records
     *
     * @example
     * ```ts
     * const result = await exchangeRatesApi.list({ fromCurrency: 'USD', toCurrency: 'ARS' });
     * ```
     */
    list(params?: {
        readonly fromCurrency?: string;
        readonly toCurrency?: string;
        readonly page?: number;
        readonly pageSize?: number;
    }): Promise<ApiResult<PaginatedResponse<ExchangeRateItem>>> {
        return apiClient.getList({ path: `${BASE}/exchange-rates`, params });
    },

    /**
     * Get the exchange rate configuration (default currencies and update interval).
     *
     * @returns Exchange rate configuration record
     *
     * @example
     * ```ts
     * const result = await exchangeRatesApi.getConfig();
     * ```
     */
    getConfig(): Promise<ApiResult<ExchangeRateConfig>> {
        return apiClient.get({ path: `${BASE}/exchange-rates/config` });
    }
};

// --- Tags (Public) ---

/** Public tag response (subset of full Tag model) */
export interface TagPublicResponse {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
}

/** Public tag API endpoints */
export const tagsApi = {
    /**
     * Get a tag by its slug.
     *
     * @param params - Tag slug to look up
     * @returns The matching tag record
     *
     * @example
     * ```ts
     * const result = await tagsApi.getBySlug({ slug: 'nature' });
     * ```
     */
    getBySlug({ slug }: { readonly slug: string }): Promise<ApiResult<TagPublicResponse>> {
        return apiClient.get({ path: `${BASE}/tags/by-slug/${slug}` });
    }
};

// --- Accommodation Contact (Protected) ---

/** Contact info returned by the protected endpoint. */
interface AccommodationContactResponse {
    readonly email?: string;
    readonly phone?: string;
    readonly website?: string;
}

/** Protected accommodation API endpoints (require auth). */
export const protectedAccommodationsApi = {
    /**
     * Get resolved contact info for an accommodation.
     * Only available to authenticated users.
     *
     * @param params - Accommodation ID
     * @returns Resolved email, phone, and/or website (fields omitted when not available)
     */
    getContactInfo({
        id
    }: {
        readonly id: string;
    }): Promise<ApiResult<AccommodationContactResponse>> {
        return apiClient.getProtected({ path: `${PROTECTED}/accommodations/${id}/contact` });
    }
};
