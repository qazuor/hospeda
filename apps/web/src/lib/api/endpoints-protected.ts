/**
 * Protected and auxiliary endpoint functions for consuming API routes.
 * Auth, user bookmarks, user profile, billing, tags, plans, exchange rates, and reviews.
 *
 * All protected endpoints require an authenticated session (credentials: 'include').
 * The apiClient methods `getProtected` and `postProtected` handle this automatically.
 */
import type {
    AccommodationImportResponse,
    AccommodationReviewListItem,
    DestinationReviewListItem,
    DowngradePreview,
    KeepSelections,
    PlanChangeResponse,
    UserBookmark,
    UserCancelSubscriptionResponse,
    UserProtected,
    UserPublic,
    ValidationResult
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
     * Bulk-check bookmark status for many entities of the same type in a single request.
     * Used by listing pages to pre-hydrate FavoriteButton state without
     * issuing one /check call per card (SPEC-098 T-041).
     *
     * @param body - The shared `entityType` and the list of `entityIds` to check (max 100)
     * @returns A map keyed by entityId with `{ isBookmarked, bookmarkId }` per entry.
     *
     * @example
     * ```ts
     * const result = await userBookmarksApi.checkBulk({
     *   entityType: 'ACCOMMODATION',
     *   entityIds: ['uuid-1', 'uuid-2']
     * });
     * if (result.ok) console.log(result.data.checks['uuid-1'].isBookmarked);
     * ```
     */
    checkBulk(body: {
        readonly entityType: BookmarkEntityType;
        readonly entityIds: readonly string[];
    }): Promise<
        ApiResult<{
            readonly checks: Readonly<
                Record<
                    string,
                    { readonly isBookmarked: boolean; readonly bookmarkId: string | null }
                >
            >;
        }>
    > {
        return apiClient.postProtected({
            path: `${PROTECTED}/user-bookmarks/check-bulk`,
            body
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
    },

    /**
     * Update the name and/or description notes on an existing bookmark.
     * Only the bookmark owner can call this endpoint.
     *
     * @param params - Bookmark ID and the fields to update
     * @returns The updated bookmark entity
     *
     * @example
     * ```ts
     * const result = await userBookmarksApi.update({
     *   id: 'bookmark-uuid',
     *   input: { name: 'Must revisit', description: 'Great place for summer' }
     * });
     * if (result.ok) console.log(result.data.name);
     * ```
     */
    update({
        id,
        input
    }: {
        readonly id: string;
        readonly input: { readonly name?: string; readonly description?: string };
    }): Promise<ApiResult<UserBookmark>> {
        return apiClient.patch({ path: `${PROTECTED}/user-bookmarks/${id}`, body: input });
    }
};

// --- User (Protected) ---

/** Subscription status values */
type SubscriptionStatus = 'active' | 'trial' | 'cancelled' | 'expired' | 'past_due' | 'pending';

/** Subscription data returned by the protected subscription endpoint */
export interface SubscriptionData {
    /** Subscription id — required to call the cancel/plan-change endpoints. */
    readonly id: string;
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
    /**
     * Pending scheduled plan change (downgrade), if any.
     *
     * Present when the host scheduled a downgrade via `billingApi.changePlan` and
     * it has not yet been applied. The backend (`GET /protected/users/me/subscription`)
     * returns this field (null when no pending change). The UI treats a null/absent
     * value as "no scheduled change" and skips the banner render.
     *
     * Field names match the `QZPayScheduledPlanChange` shape stored by QZPay:
     * `newPlanId` is the target plan ID and `effectiveAt` is an ISO 8601 datetime
     * for when the change will be applied (typically `currentPeriodEnd`).
     */
    readonly scheduledPlanChange?: {
        readonly newPlanId: string;
        readonly effectiveAt: string;
    } | null;
    /**
     * Restriction preview computed at downgrade-schedule time (SPEC-167 / SPEC-203).
     *
     * Populated by `billingApi.changePlan` in the `status === 'scheduled'` response
     * branch (`PlanChangeAppliedResponse.restrictionPreview`). The UI should persist
     * this alongside the scheduled-change state so the dashboard can render the
     * "here is what gets restricted" notice without an extra API call.
     *
     * The backend does not return this on the subscription endpoint — this field
     * exists so the UI layer can attach the preview after a changePlan call and
     * display it in the downgrade-scheduled banner.
     */
    readonly restrictionPreview?: DowngradePreview | null;
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
     * For upgrades, the response may have `status === 'pending_payment'` with a
     * `checkoutUrl` the client must redirect to (SPEC-141 D7).
     * For downgrades, the response will have `status === 'scheduled'` and may
     * include a `restrictionPreview` so the UI can render a "what gets restricted"
     * notice (SPEC-167 / SPEC-203).
     *
     * An idempotency key is sent automatically on every call so that network-level
     * retries are safe (the server deduplicates by key). Each logical user action
     * should result in a fresh `changePlan` call (a new UUID is generated per call).
     *
     * @param params - Target plan ID, billing interval, and optional keep selections
     * @returns Discriminated-union response: active | scheduled | pending_payment
     *
     * @example
     * ```ts
     * const result = await billingApi.changePlan({ newPlanId: 'plan-uuid', billingInterval: 'monthly' });
     * if (result.ok && result.data.status === 'scheduled') {
     *   console.log(result.data.restrictionPreview);
     * }
     * ```
     */
    changePlan({
        newPlanId,
        billingInterval,
        keepSelections
    }: {
        readonly newPlanId: string;
        readonly billingInterval: string;
        readonly keepSelections?: KeepSelections;
    }): Promise<ApiResult<PlanChangeResponse>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/subscriptions/change-plan`,
            body:
                keepSelections !== undefined
                    ? { newPlanId, billingInterval, keepSelections }
                    : { newPlanId, billingInterval },
            headers: { 'X-Idempotency-Key': crypto.randomUUID() }
        });
    },

    /**
     * Soft-cancel the authenticated user's current subscription (SPEC-147).
     *
     * Sets `cancelAtPeriodEnd = true` on the subscription. The user retains
     * full access to their plan entitlements until `accessUntil` (the current
     * period end). The subscription status remains `active`; the finalization
     * cron flips it to `cancelled` after the period ends.
     *
     * This calls `POST /subscriptions/:id/cancel` (the SPEC-147 soft-cancel
     * endpoint), NOT `DELETE /subscriptions/:id` (the hard-cancel / QZPay
     * internal endpoint that is not exposed to end users).
     *
     * @param params - Subscription ID and optional free-text cancellation reason
     * @returns Soft-cancel confirmation with accessUntil date
     *
     * @example
     * ```ts
     * const result = await billingApi.cancelSubscription({ subscriptionId: 'sub-uuid', reason: 'Too expensive' });
     * if (result.ok) console.log('Access until:', result.data.accessUntil);
     * ```
     */
    cancelSubscription({
        subscriptionId,
        reason
    }: {
        readonly subscriptionId: string;
        readonly reason?: string;
    }): Promise<ApiResult<UserCancelSubscriptionResponse>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/subscriptions/${subscriptionId}/cancel`,
            body: { reason }
        });
    },

    /**
     * Preview the restrictions that would apply if the host downgrades to a given plan.
     *
     * Returns a structured excess report covering:
     * - `accommodations` — active accommodations over the target plan cap.
     * - `promotions` — active promotions over the target plan cap.
     * - `photos` — per-accommodation gallery overflow entries.
     * - `grandfatherFlags` — informational flags for rich/video content that
     *   becomes read-only under the target plan (no data is removed).
     * - `hasExcess` — convenience flag; `true` when any dimension has excess.
     *
     * The host can use this preview to decide which items to keep active by
     * passing explicit `keepSelections` to `billingApi.changePlan`.
     *
     * @param params - Billing catalog slug of the plan to preview downgrading to
     * @returns Structured excess preview for the given target plan
     *
     * @example
     * ```ts
     * const result = await billingApi.previewDowngrade({ targetPlan: 'owner-basico' });
     * if (result.ok && result.data.hasExcess) {
     *   console.log('Accommodations to restrict:', result.data.accommodations.excessCount);
     * }
     * ```
     */
    previewDowngrade({
        targetPlan
    }: {
        readonly targetPlan: string;
    }): Promise<ApiResult<DowngradePreview>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/billing/subscriptions/downgrade-preview`,
            params: { targetPlan }
        });
    },

    /**
     * Pause the authenticated user's own subscription (SPEC-143 #29).
     *
     * A host self-pause is always "full": it stops billing AND hides/edit-locks
     * the owner's accommodations until resume. No body — it targets the caller's
     * own active subscription.
     */
    pauseSubscription(): Promise<
        ApiResult<{
            readonly success: boolean;
            readonly subscriptionId: string;
            readonly status: string;
            readonly accommodationsUpdated: number;
        }>
    > {
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/me/subscription-pause`,
            body: {}
        });
    },

    /**
     * Resume the authenticated user's own paused subscription (SPEC-143 #29).
     * Restarts billing and restores the owner's accommodations.
     */
    resumeSubscription(): Promise<
        ApiResult<{
            readonly success: boolean;
            readonly subscriptionId: string;
            readonly status: string;
            readonly accommodationsUpdated: number;
        }>
    > {
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/me/subscription-resume`,
            body: {}
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
     * Uses the Hospeda-custom `start-paid` route which handles the full paid
     * subscription bootstrap: customer creation, MercadoPago preapproval,
     * trial-to-paid transitions, and idempotency. The legacy `/checkout`
     * endpoint was deprecated in SPEC-126.
     *
     * When a `promoCode` is supplied and the server resolves it to a `comp`
     * (free-forever) effect, `appliedEffect` in the response is `'comp'` and
     * `checkoutUrl` is an **in-app success sentinel URL** — NOT a MercadoPago
     * redirect. The caller should still follow `checkoutUrl` via
     * `window.location.href`; the sentinel page handles the success flow
     * without touching the payment provider (SPEC-262 T-012).
     *
     * @param params - Plan slug, billing interval, and optional promo code
     * @returns The checkout URL to redirect the user to, plus metadata
     *
     * @example
     * ```ts
     * const result = await billingApi.createCheckout({ planSlug: 'owner-pro', billingInterval: 'annual', promoCode: 'WELCOME50' });
     * if (result.ok) window.location.href = result.data.checkoutUrl;
     * ```
     */
    createCheckout({
        planSlug,
        billingInterval,
        promoCode
    }: {
        readonly planSlug: string;
        readonly billingInterval: 'monthly' | 'annual';
        readonly promoCode?: string;
    }): Promise<
        ApiResult<{
            readonly checkoutUrl: string;
            readonly appliedEffect?: 'comp' | 'discount';
        }>
    > {
        const body: Record<string, unknown> = { planSlug, billingInterval };
        if (promoCode) {
            body.promoCode = promoCode;
        }
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/subscriptions/start-paid`,
            body,
            // `/start-paid` is wrapped by `idempotencyKeyMiddleware` (SPEC-143
            // T-143-60). A fresh UUID v4 per click means double-click retries
            // get the cached response (no duplicate MP preference + sub row)
            // while two distinct user actions remain independent. The
            // disabled-while-loading guard on the button covers the simultaneous
            // double-click case; the middleware covers the network-level retry
            // case (slow network → user reloads, etc.).
            headers: { 'X-Idempotency-Key': crypto.randomUUID() }
        });
    },

    /**
     * Validate a promo code before checkout and preview its effect.
     *
     * Rate-limited to 5 requests/minute server-side. Always call on an
     * explicit user action ("Aplicar"), NOT on every keystroke.
     *
     * The `userId` MUST equal the session user's id; the route returns 403
     * otherwise. `amount` (in centavos) is forwarded so the server can
     * calculate and return `effectPreview.finalAmount` for discount codes.
     * The web only has `planSlug`, not `planId`, so `planId` is intentionally
     * omitted from this call.
     *
     * @param params.code - Promo code string entered by the user
     * @param params.userId - Authenticated user's UUID (from session)
     * @param params.amount - Base price in centavos for discount preview (optional)
     * @returns Validation result including `effectPreview` when the code is valid
     *
     * @example
     * ```ts
     * const result = await billingApi.validatePromoCode({ code: 'PROMO20', userId: 'uuid-...', amount: 120000 });
     * if (result.ok && result.data.valid) console.log(result.data.effectPreview);
     * ```
     */
    validatePromoCode({
        code,
        userId,
        amount
    }: {
        readonly code: string;
        readonly userId: string;
        readonly amount?: number;
    }): Promise<ApiResult<ValidationResult>> {
        const body: { code: string; userId: string; amount?: number } = { code, userId };
        if (amount !== undefined) {
            body.amount = amount;
        }
        return apiClient.postProtected({
            path: `${PROTECTED}/billing/promo-codes/validate`,
            body
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
        return apiClient.getListProtected({
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
        return apiClient.getListProtected({
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
    },

    /**
     * Get the trial status for the authenticated user.
     *
     * Returns `isExpired: true` with populated `startedAt`, `expiresAt`, and
     * `planSlug` for users whose trial expired and subscription was cancelled.
     * Returns `isOnTrial: true` with `daysRemaining` for active trial users.
     *
     * @returns Trial status information for the current user.
     *
     * @example
     * ```ts
     * const result = await billingApi.getTrialStatus();
     * if (result.ok && result.data.isExpired) { ... }
     * ```
     */
    getTrialStatus(): Promise<
        ApiResult<{
            readonly isOnTrial: boolean;
            readonly isExpired: boolean;
            readonly daysRemaining: number | null;
            readonly startedAt: string | null;
            readonly expiresAt: string | null;
            readonly planSlug: string | null;
        }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/billing/trial/status`
        });
    },

    /**
     * Get the entitlements for the authenticated user.
     *
     * Returns the user's current feature flags (entitlements array), plan
     * limits map, and active plan context. Mirrors the response shape of
     * `GET /api/v1/protected/users/me/entitlements`.
     *
     * - `entitlements`: sorted array of feature-flag keys (e.g. `["can_use_rich_description"]`)
     * - `limits`: object map of limit keys to numeric values (e.g. `{ max_accommodations: 1 }`).
     *   A value of `-1` means unlimited.
     * - `plan`: active plan summary or `null` if the user has no active paid plan.
     * - `asOf`: ISO timestamp of when the values were resolved.
     *
     * @returns Entitlement data for the current user.
     *
     * @example
     * ```ts
     * const result = await billingApi.getEntitlements();
     * if (result.ok) {
     *   const maxAccommodations = result.data.limits.max_accommodations; // -1 = unlimited
     * }
     * ```
     */
    getEntitlements(): Promise<
        ApiResult<{
            readonly entitlements: ReadonlyArray<string>;
            readonly limits: Readonly<Record<string, number>>;
            readonly plan: {
                readonly slug: string;
                readonly name: string;
                readonly status: string;
            } | null;
            readonly asOf: string;
        }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/users/me/entitlements`
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

// --- Destination Reviews (Protected) ---

/** Rating dimensions required for a destination review (18 aspects) */
export interface DestinationReviewRating {
    readonly landscape: number;
    readonly attractions: number;
    readonly accessibility: number;
    readonly safety: number;
    readonly cleanliness: number;
    readonly hospitality: number;
    readonly culturalOffer: number;
    readonly gastronomy: number;
    readonly affordability: number;
    readonly nightlife: number;
    readonly infrastructure: number;
    readonly environmentalCare: number;
    readonly wifiAvailability: number;
    readonly shopping: number;
    readonly beaches: number;
    readonly greenSpaces: number;
    readonly localEvents: number;
    readonly weatherSatisfaction: number;
}

/** Data sent when creating a destination review. userId and destinationId are NOT included. */
export interface CreateDestinationReviewBody {
    readonly rating: DestinationReviewRating;
    readonly title?: string;
    readonly content?: string;
}

/** Protected destination review API endpoints */
export const destinationReviewsApi = {
    /**
     * Create a new review for a destination.
     *
     * The authenticated user's id is injected server-side; do NOT include
     * `userId` in the body — the endpoint will reject it with a 400.
     *
     * @param params - Destination ID and review data
     * @returns The created review record (moderationState will be PENDING)
     *
     * @example
     * ```ts
     * const result = await destinationReviewsApi.create({
     *   destinationId: 'dest-uuid',
     *   body: {
     *     rating: { landscape: 5, attractions: 4, accessibility: 4, safety: 5,
     *               cleanliness: 5, hospitality: 5, culturalOffer: 4, gastronomy: 5,
     *               affordability: 4, nightlife: 3, infrastructure: 4, environmentalCare: 4,
     *               wifiAvailability: 3, shopping: 3, beaches: 5, greenSpaces: 4,
     *               localEvents: 4, weatherSatisfaction: 5 },
     *     title: 'Hermoso lugar',
     *     content: 'Pasamos un finde excelente, mucha naturaleza.'
     *   }
     * });
     * ```
     */
    create({
        destinationId,
        body
    }: {
        readonly destinationId: string;
        readonly body: CreateDestinationReviewBody;
    }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/destinations/${destinationId}/reviews`,
            body
        });
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

// --- Conversations (Protected) ---

/** Message item in a protected conversation thread */
export interface ConversationMessageItem {
    readonly id: string;
    readonly body: string;
    readonly senderType: 'guest' | 'owner' | 'system';
    readonly createdAt: string;
}

/** Conversation summary for inbox list */
export interface ConversationInboxItem {
    readonly id: string;
    readonly accommodationId: string;
    readonly accommodationName: string;
    readonly lastMessageExcerpt: string | null;
    readonly unreadCount: number;
    readonly lastActivityAt: string;
    readonly status: string;
    readonly archivedByGuest: boolean;
}

/** Full conversation detail for thread view */
export interface ConversationDetail {
    readonly id: string;
    readonly accommodationId: string;
    readonly accommodationName: string;
    readonly ownerName: string;
    readonly status: string;
    readonly lastReadAtByOwner: string | null;
    readonly archivedByGuest: boolean;
    readonly createdAt: string;
}

/** Thread response for protected conversation detail */
export interface ConversationThreadResponse {
    readonly conversation: ConversationDetail;
    readonly messages: readonly ConversationMessageItem[];
    /** Cursor (oldest message's createdAt) for loading the previous page, or
     * null when there are no older messages. Matches the API response shape;
     * mirrors OwnerConversationThreadResponse. */
    readonly nextCursor: string | null;
}

/** Protected conversations API endpoints (require auth session) */
export const protectedConversationsApi = {
    /**
     * Initiate a new conversation as an authenticated user.
     *
     * @param params - Accommodation ID and initial message
     * @returns Conversation ID, new flag, and message ID
     */
    initiate(params: {
        readonly accommodationId: string;
        readonly message: string;
    }): Promise<
        ApiResult<{
            readonly conversationId: string;
            readonly isNew: boolean;
            readonly messageId: string;
        }>
    > {
        return apiClient.postProtected({
            path: `${PROTECTED}/conversations/initiate`,
            body: params
        });
    },

    /**
     * List all conversations in the authenticated user's inbox.
     *
     * @param params - Optional pagination, archive filter, and SSR cookie header
     */
    list(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly archivedByGuest?: boolean;
        /**
         * Filter the inbox by a single accommodation. Useful to answer
         * "has the visitor already contacted the host of this property?"
         * — the accommodation detail page uses this to gate the review form.
         */
        readonly accommodationId?: string;
        /**
         * SSR-only: raw `Cookie` header forwarded to the API so the request
         * carries the user's session. Browser callers should omit this.
         */
        readonly cookieHeader?: string;
    }): Promise<
        ApiResult<{
            readonly items: readonly ConversationInboxItem[];
            readonly pagination: {
                readonly page: number;
                readonly pageSize: number;
                readonly total: number;
                readonly totalPages: number;
            };
        }>
    > {
        const { cookieHeader, ...rest } = params ?? {};
        return apiClient.getProtected({
            path: `${PROTECTED}/conversations`,
            params: rest as Record<string, unknown>,
            cookieHeader
        });
    },

    /**
     * Get a conversation thread by ID.
     *
     * @param params - Conversation ID, optional cursor/limit, and SSR cookie header
     */
    getThread(params: {
        readonly id: string;
        readonly cursor?: string;
        readonly limit?: number;
        /**
         * SSR-only: raw `Cookie` header forwarded to the API so the request
         * carries the user's session. Browser callers should omit this.
         */
        readonly cookieHeader?: string;
    }): Promise<ApiResult<ConversationThreadResponse>> {
        const { id, cookieHeader, ...rest } = params;
        return apiClient.getProtected({
            path: `${PROTECTED}/conversations/${id}`,
            params: rest as Record<string, unknown>,
            cookieHeader
        });
    },

    /**
     * Send a reply to a conversation.
     *
     * @param params - Conversation ID and message body
     * @returns The created message
     */
    sendMessage(params: {
        readonly id: string;
        readonly body: string;
    }): Promise<ApiResult<ConversationMessageItem>> {
        const { id, body } = params;
        return apiClient.postProtected({
            path: `${PROTECTED}/conversations/${id}/messages`,
            body: { body }
        });
    },

    /**
     * Archive or unarchive a conversation.
     *
     * @param params - Conversation ID and archived flag
     */
    setArchived(params: {
        readonly id: string;
        readonly archived: boolean;
    }): Promise<ApiResult<{ readonly success: boolean }>> {
        const { id, archived } = params;
        return apiClient.patch({
            path: `${PROTECTED}/conversations/${id}/archive`,
            body: { archived }
        });
    },

    /**
     * Get the count of unread messages for the authenticated user.
     *
     * @returns Unread message count
     */
    getUnreadCount(): Promise<ApiResult<{ readonly count: number }>> {
        return apiClient.getProtected({ path: `${PROTECTED}/conversations/unread-count` });
    }
};

// --- Owner Conversations (Protected — SPEC-206) ---

/** Conversation summary item in the owner inbox */
export interface OwnerConversationInboxItem {
    readonly id: string;
    readonly accommodationId: string;
    readonly accommodationName: string;
    readonly guestName: string;
    readonly guestId: string | null;
    readonly lastMessageExcerpt: string | null;
    readonly unreadCount: number;
    readonly lastActivityAt: string;
    readonly status: string;
}

/** Conversation detail for the owner thread view */
export interface OwnerConversationDetail {
    readonly id: string;
    readonly accommodationId: string;
    readonly accommodationName: string;
    readonly guestName: string;
    readonly guestId: string | null;
    readonly status: string;
    readonly lastReadAtByOwner: string | null;
    readonly createdAt: string;
}

/** Thread response for the owner conversation detail */
export interface OwnerConversationThreadResponse {
    readonly conversation: OwnerConversationDetail;
    readonly messages: readonly ConversationMessageItem[];
    readonly nextCursor: string | null;
}

/** Protected owner conversations API endpoints (require auth + host role) */
export const ownerConversationsApi = {
    /**
     * List conversations for the authenticated owner's accommodations.
     *
     * @param params - Optional pagination, status filter, search, and SSR cookie header
     *
     * @example
     * ```ts
     * const result = await ownerConversationsApi.list({ pageSize: 20 });
     * if (result.ok) console.log(result.data.items);
     * ```
     */
    list(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly status?: string;
        readonly search?: string;
        readonly cookieHeader?: string;
    }): Promise<
        ApiResult<{
            readonly items: readonly OwnerConversationInboxItem[];
            readonly pagination: {
                readonly page: number;
                readonly pageSize: number;
                readonly total: number;
                readonly totalPages: number;
            };
        }>
    > {
        const { cookieHeader, ...rest } = params ?? {};
        return apiClient.getProtected({
            path: `${PROTECTED}/conversations/owner`,
            params: rest as Record<string, unknown>,
            cookieHeader
        });
    },

    /**
     * Get a conversation thread by ID (owner side).
     *
     * @param params - Conversation ID, optional cursor/limit, and SSR cookie header
     *
     * @example
     * ```ts
     * const result = await ownerConversationsApi.getById({ id: 'conv-uuid' });
     * if (result.ok) console.log(result.data.messages);
     * ```
     */
    getById(params: {
        readonly id: string;
        readonly cursor?: string;
        readonly limit?: number;
        readonly cookieHeader?: string;
    }): Promise<ApiResult<OwnerConversationThreadResponse>> {
        const { id, cookieHeader, ...rest } = params;
        return apiClient.getProtected({
            path: `${PROTECTED}/conversations/owner/${id}`,
            params: rest as Record<string, unknown>,
            cookieHeader
        });
    },

    /**
     * Get the count of unread conversations for the authenticated owner.
     *
     * @returns Unread conversation count
     *
     * @example
     * ```ts
     * const result = await ownerConversationsApi.getUnreadCount();
     * if (result.ok) console.log(result.data.count);
     * ```
     */
    getUnreadCount(): Promise<ApiResult<{ readonly count: number }>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/conversations/owner/unread-count`
        });
    },

    /**
     * Send a reply to a conversation (owner side).
     *
     * @param params - Conversation ID and message body
     * @returns The created message
     *
     * @example
     * ```ts
     * const result = await ownerConversationsApi.reply({
     *   id: 'conv-uuid',
     *   message: 'Gracias por tu consulta!'
     * });
     * ```
     */
    reply(params: {
        readonly id: string;
        readonly message: string;
    }): Promise<ApiResult<ConversationMessageItem>> {
        const { id, message } = params;
        return apiClient.postProtected({
            path: `${PROTECTED}/conversations/owner/${id}/messages`,
            body: { body: message }
        });
    }
};

// --- Host Dashboard (Protected) ---

/** Plan info returned by the host dashboard endpoint */
export interface HostDashboardPlanInfo {
    readonly slug: string;
    readonly name: string;
    readonly status: 'active' | 'trial' | 'cancelled' | 'expired' | 'past_due';
    readonly isTrial: boolean;
}

/** Property counts returned by the host dashboard endpoint */
export interface HostDashboardProperties {
    readonly total: number;
    readonly published: number;
    readonly draft: number;
    readonly archived: number;
}

/** Host dashboard aggregated response from the API */
export interface HostDashboardApiResponse {
    readonly properties: HostDashboardProperties;
    readonly plan: HostDashboardPlanInfo | null;
    readonly unreadConversations: number;
}

/**
 * Protected host dashboard API endpoints.
 * Returns aggregated dashboard data for the authenticated host user.
 * Gated by VIEW_BASIC_STATS entitlement (SPEC-205).
 */
export const hostDashboardApi = {
    /**
     * Get the host dashboard aggregated data.
     *
     * @returns Property counts, plan info, and unread conversation count
     *
     * @example
     * ```ts
     * const result = await hostDashboardApi.get();
     * if (result.ok) console.log(result.data.properties.published);
     * ```
     */
    get(): Promise<ApiResult<HostDashboardApiResponse>> {
        return apiClient.getProtected({ path: `${PROTECTED}/host/dashboard` });
    }
};

// --- Host Analytics (Protected — SPEC-207) ---

/** Analytics window type for time-range queries */
type AnalyticsWindow = '7d' | '30d';

/** Protected host analytics API endpoints. All require auth + VIEW_BASIC_STATS entitlement. */
export const hostAnalyticsApi = {
    /**
     * Get accommodation views (cumulative) over a time window.
     *
     * Returns one row per owned accommodation with cumulative view counts
     * for the requested window. Use this for the per-property ranked list
     * in the ViewsWidget.
     *
     * @remarks
     * The daily-series variant (date-bucketed chart data) is implemented in
     * `getViewsDailySeries` — wired as part of SPEC-207 Fase A.
     *
     * @param params - Time window: '7d' or '30d'
     * @returns Cumulative per-accommodation view counts for the window
     */
    getViews({ window: windowParam }: { readonly window: AnalyticsWindow }): Promise<
        ApiResult<
            readonly {
                readonly entityId: string;
                readonly unique: number;
                readonly total: number;
            }[]
        >
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/views/accommodations/me`,
            params: { window: windowParam }
        });
    },

    /**
     * Get the gap-filled daily view-count series for all accommodations owned by
     * the authenticated host over a rolling window.
     *
     * Returns exactly `windowDays` items (7 or 30), one per calendar day ordered
     * oldest → newest. Days with no views have `total: 0` (gap-filled by the
     * server). Gated by the same `view_basic_stats` entitlement as `getViews`.
     *
     * Use this to feed the line chart in the ViewsWidget (SPEC-207 Fase A).
     *
     * @param params - Time window: '7d' or '30d'
     * @returns Daily series `{ window, items: { date, total }[] }`
     */
    getViewsDailySeries({ window: windowParam }: { readonly window: AnalyticsWindow }): Promise<
        ApiResult<{
            readonly window: '7d' | '30d';
            readonly items: readonly { readonly date: string; readonly total: number }[];
        }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/views/accommodations/me/daily-series`,
            params: { window: windowParam }
        });
    },

    /**
     * List the authenticated host's own accommodations (id + name only needed
     * for cross-referencing analytics by accommodation). Server-side filtered
     * by actor.id.
     */
    listOwnAccommodations(): Promise<
        ApiResult<{ readonly items: readonly { readonly id: string; readonly name: string }[] }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/accommodations`,
            params: { pageSize: 50, sortBy: 'createdAt', sortOrder: 'desc' }
        });
    },

    /**
     * Get favorites breakdown per accommodation.
     *
     * @remarks
     * SPEC-207: wired to the real backend endpoint. Returns a raw array of
     * `{accommodationId, slug, bookmarkCount}` items. The caller is responsible
     * for crossing this with the accommodation names map and calling
     * `transformFavoritesBreakdown`. Gated by the `view_advanced_stats`
     * entitlement server-side.
     *
     * @returns Raw per-accommodation bookmark counts array
     *
     * @example
     * ```ts
     * const result = await hostAnalyticsApi.getFavoritesBreakdown();
     * if (result.ok) console.log(result.data[0].bookmarkCount);
     * ```
     */
    getFavoritesBreakdown(): Promise<
        ApiResult<
            readonly {
                readonly accommodationId: string;
                readonly slug: string;
                readonly bookmarkCount: number;
            }[]
        >
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/accommodations/my/favorites-breakdown`
        });
    },

    /**
     * Get response rate and average response time.
     *
     * @returns Response rate percentage and average response time in minutes
     *
     * @example
     * ```ts
     * const result = await hostAnalyticsApi.getResponseRate();
     * if (result.ok) console.log(result.data.responseRatePct);
     * ```
     */
    getResponseRate(): Promise<
        ApiResult<{
            readonly responseRatePct: number;
            readonly avgResponseTimeMinutes: number | null;
        }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/conversations/me/response-rate`
        });
    },

    /**
     * Get monthly inquiry trend over the specified number of months.
     *
     * @param params - Number of months to look back (default: 6)
     * @returns Monthly inquiry counts for the host's accommodations
     *
     * @example
     * ```ts
     * const result = await hostAnalyticsApi.getInquiryTrend({ months: 6 });
     * if (result.ok) console.log(result.data.months);
     * ```
     */
    getInquiryTrend({
        months = 6
    }: {
        readonly months?: number;
    } = {}): Promise<
        ApiResult<{
            readonly months: readonly { readonly month: string; readonly count: number }[];
        }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/conversations/me/monthly-inquiries`,
            params: { months }
        });
    },

    /**
     * Get market comparison data for the host's accommodations.
     *
     * @returns Market comparison items with ratings, reviews, and prices
     *
     * @example
     * ```ts
     * const result = await hostAnalyticsApi.getMarketComparison();
     * if (result.ok) console.log(result.data.items);
     * ```
     */
    getMarketComparison(): Promise<
        ApiResult<{
            readonly comparisons: readonly {
                readonly accommodationId: string;
                readonly accommodationName: string;
                readonly accommodationType: string;
                readonly destinationId: string;
                readonly destinationName: string | null;
                readonly yourRating: number | null;
                readonly yourReviews: number;
                readonly destinationAvgRating: number | null;
                readonly destinationReviewsTotal: number;
                readonly yourPrice: number | null;
                readonly destinationAvgPrice: number | null;
            }[];
        }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/accommodations/my/market-comparison`
        });
    }
};

// --- Accommodation Contact (Protected) ---

/** Contact info returned by the protected endpoint. */
interface AccommodationContactResponse {
    readonly email?: string;
    readonly phone?: string;
    readonly website?: string;
}

/** Accommodation lifecycle state values used as query filter */
type AccommodationLifecycleState = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

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
    },

    /**
     * List accommodations owned by the authenticated user.
     * Results are filtered server-side to only include accommodations where ownerId === actor.id.
     *
     * @param params - Optional pagination and lifecycle state filter
     * @returns Paginated list of the user's accommodations
     *
     * @example
     * ```ts
     * const result = await protectedAccommodationsApi.listOwn({ pageSize: 50 });
     * if (result.ok) console.log(result.data.items);
     * ```
     */
    listOwn(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly lifecycleState?: AccommodationLifecycleState;
    }): Promise<ApiResult<PaginatedResponse<Record<string, unknown>>>> {
        return apiClient.getListProtected({ path: `${PROTECTED}/accommodations`, params });
    },

    /**
     * Get a single accommodation owned by the authenticated user.
     * Returns the accommodation only if ownerId === actor.id.
     * Returns a non-ok result if not found or not owned.
     *
     * @param params - Accommodation ID
     * @returns The accommodation record or null
     *
     * @example
     * ```ts
     * const result = await protectedAccommodationsApi.getOwnById({ id: 'acc-uuid' });
     * if (result.ok && result.data) { ... }
     * ```
     */
    getOwnById({
        id
    }: { readonly id: string }): Promise<ApiResult<Record<string, unknown> | null>> {
        return apiClient.getProtected({ path: `${PROTECTED}/accommodations/${id}` });
    }
};

// --- Media (Protected) ---

/**
 * Protected media API endpoints (require auth session).
 */
export const protectedMediaApi = {
    /**
     * Delete a Cloudinary media asset for an entity owned by the authenticated user.
     *
     * The server verifies that the publicId encodes an entity owned by the actor.
     * Returns { deleted: true, publicId, wasPresent } on success.
     * Best-effort: callers should not block UI on failure.
     *
     * @param params - The Cloudinary publicId of the asset to delete
     * @returns Whether the asset was deleted and whether it was present
     *
     * @example
     * ```ts
     * const result = await protectedMediaApi.deleteMedia({
     *   publicId: 'hospeda/dev/accommodations/uuid/gallery/abc123'
     * });
     * if (result.ok) console.log(result.data.wasPresent);
     * ```
     */
    deleteMedia({
        publicId
    }: {
        readonly publicId: string;
    }): Promise<
        ApiResult<{
            readonly deleted: true;
            readonly publicId: string;
            readonly wasPresent?: boolean;
        }>
    > {
        const encoded = encodeURIComponent(publicId);
        return apiClient.delete({
            path: `${PROTECTED}/media/delete-entity?publicId=${encoded}`
        });
    }
};

// --- Accommodation Editor (SPEC-208) ---

/**
 * Protected geocoding API endpoints (SPEC-208, Phase C PR2).
 * Wraps the protected geocoding proxy for the web accommodation editor.
 */
export const geocodingApi = {
    /**
     * Search for address suggestions via the geocoding proxy.
     *
     * @param params - Query string and optional locale
     * @returns Array of geocoding suggestions with label, lat, lng, and structured fields
     *
     * @example
     * ```ts
     * const result = await geocodingApi.search({ q: 'Belgrano 123' });
     * if (result.ok) console.log(result.data.suggestions);
     * ```
     */
    search({
        q,
        locale = 'es'
    }: {
        readonly q: string;
        readonly locale?: 'es' | 'en' | 'pt';
    }): Promise<
        ApiResult<{
            readonly suggestions: ReadonlyArray<{
                readonly label: string;
                readonly lat: number;
                readonly lng: number;
                readonly street?: string;
                readonly number?: string;
                readonly city?: string;
                readonly state?: string;
                readonly country?: string;
            }>;
        }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/geocoding/autocomplete`,
            params: { q, locale }
        });
    },

    /**
     * Reverse geocode coordinates to a structured address.
     *
     * @param params - Latitude and longitude
     * @returns A single geocoding suggestion or null
     *
     * @example
     * ```ts
     * const result = await geocodingApi.reverse({ lat: -32.4825, lng: -58.2372 });
     * if (result.ok && result.data.suggestion) console.log(result.data.suggestion.label);
     * ```
     */
    reverse({
        lat,
        lng
    }: {
        readonly lat: number;
        readonly lng: number;
    }): Promise<
        ApiResult<{
            readonly suggestion: {
                readonly label: string;
                readonly lat: number;
                readonly lng: number;
                readonly street?: string;
                readonly number?: string;
                readonly city?: string;
                readonly state?: string;
                readonly country?: string;
            } | null;
        }>
    > {
        return apiClient.getProtected({
            path: `${PROTECTED}/geocoding/reverse`,
            params: { lat, lng }
        });
    }
};

/**
 * Protected accommodation edit API endpoints.
 * Wraps the protected accommodation GET/PATCH and public amenities/destinations
 * endpoints used by the web editor form.
 */
export const accommodationEditApi = {
    /**
     * Get a single accommodation by ID for editing.
     * Uses the protected endpoint which enforces ownership (ownerId === actor.id).
     *
     * @param params - Accommodation ID and optional SSR cookie header
     * @returns The accommodation record or null
     */
    getById({
        id,
        cookieHeader
    }: {
        readonly id: string;
        readonly cookieHeader?: string;
    }): Promise<ApiResult<Record<string, unknown> | null>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/accommodations/${id}`,
            cookieHeader
        });
    },

    /**
     * Update an accommodation via PATCH.
     * Only sends the fields provided in `data` (partial update).
     *
     * @param params - Accommodation ID and partial update data
     * @returns The update result
     */
    update({
        id,
        data
    }: {
        readonly id: string;
        readonly data: Record<string, unknown>;
    }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.patch({
            path: `${PROTECTED}/accommodations/${id}`,
            body: data
        });
    },

    /**
     * Unpublish an accommodation (ACTIVE → INACTIVE).
     * The accommodation will stop appearing on the public site immediately.
     * Only the owner or a user with ACCOMMODATION_UPDATE_ANY can call this.
     *
     * @param params - Accommodation ID to unpublish
     * @returns The updated accommodation record
     *
     * @example
     * ```ts
     * const result = await accommodationEditApi.unpublish({ id: 'acc-uuid' });
     * if (result.ok) console.log('Accommodation is now paused');
     * ```
     */
    unpublish({ id }: { readonly id: string }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/accommodations/${id}/unpublish`
        });
    },

    /**
     * Soft-delete an accommodation.
     * Calls `DELETE /protected/accommodations/:id`, which enforces ownership
     * (or `ACCOMMODATION_DELETE_ANY`). The accommodation is soft-deleted, so it
     * disappears from the owner's listings and the public site (SPEC-230 filters
     * soft-deleted rows out of every protected list).
     *
     * @param params - Accommodation ID to delete
     * @returns The delete result
     *
     * @example
     * ```ts
     * const result = await accommodationEditApi.softDelete({ id: 'acc-uuid' });
     * if (result.ok) console.log('Accommodation deleted');
     * ```
     */
    softDelete({ id }: { readonly id: string }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.delete({ path: `${PROTECTED}/accommodations/${id}` });
    },

    /**
     * Fetch all active amenities for the editor's checkbox group.
     * Uses the public amenities endpoint (no auth required).
     *
     * @returns Paginated list of amenity records
     */
    getAmenities(): Promise<
        ApiResult<import('./types').PaginatedResponse<Record<string, unknown>>>
    > {
        return apiClient.getList({
            path: `${BASE}/amenities`,
            params: { pageSize: 200 }
        });
    },

    /**
     * Fetch all destinations for the editor's destination select.
     * Uses the public destinations endpoint (no auth required).
     *
     * @returns Paginated list of destination records
     */
    getDestinations(): Promise<
        ApiResult<import('./types').PaginatedResponse<Record<string, unknown>>>
    > {
        return apiClient.getList({
            path: `${BASE}/destinations`,
            params: { pageSize: 200 }
        });
    }
};

// --- Comments (Protected — SPEC-165) ---

/**
 * Comment entity returned by the protected create endpoint.
 * This is the full comment schema (includes moderation state, author object, etc.).
 * Only a subset is used by the web frontend.
 */
export interface CommentProtectedItem {
    readonly id: string;
    readonly content: string;
    readonly createdAt: string;
    readonly author: {
        readonly id: string;
        readonly displayName: string | null;
    } | null;
}

/**
 * Protected comment API endpoints (require an authenticated session).
 */
export const protectedCommentsApi = {
    /**
     * Post a new comment on a post or event.
     *
     * Maps to:
     *   POST /api/v1/protected/posts/:postId/comments   (entityType === 'POST')
     *   POST /api/v1/protected/events/:eventId/comments (entityType === 'EVENT')
     *
     * Rate-limited to 5 requests/minute per user. Returns 429 with a
     * `Retry-After` header when the limit is exceeded.
     *
     * @param params - Entity type, entity ID, and comment content
     * @returns The created comment record
     *
     * @example
     * ```ts
     * const result = await protectedCommentsApi.create({
     *   entityType: 'POST',
     *   entityId: post.id,
     *   content: 'Great article!'
     * });
     * if (result.ok) console.log(result.data.id);
     * ```
     */
    create({
        entityType,
        entityId,
        content
    }: {
        readonly entityType: 'POST' | 'EVENT';
        readonly entityId: string;
        readonly content: string;
    }): Promise<ApiResult<CommentProtectedItem>> {
        const segment = entityType === 'EVENT' ? 'events' : 'posts';
        return apiClient.postProtected({
            path: `${PROTECTED}/${segment}/${entityId}/comments`,
            body: { content }
        });
    },

    /**
     * Soft-delete a comment owned by the authenticated user.
     *
     * Maps to: DELETE /api/v1/protected/comments/:commentId
     *
     * Only the comment author can delete their own comment.
     * Returns 204/200 on success, 403 if not the owner.
     *
     * @param params - Comment ID to delete
     * @returns Whether the deletion succeeded
     *
     * @example
     * ```ts
     * const result = await protectedCommentsApi.deleteOwn({ commentId: 'comment-uuid' });
     * if (result.ok) console.log('Deleted');
     * ```
     */
    deleteOwn({
        commentId
    }: {
        readonly commentId: string;
    }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.delete({ path: `${PROTECTED}/comments/${commentId}` });
    }
};

// --- User Bookmark Collections (Protected) ---

/** Usage counters for bookmark collections returned by the list endpoint */
export interface BookmarkCollectionUsage {
    readonly current: number;
    readonly max: number;
}

/** Single bookmark collection item */
export interface BookmarkCollectionItem {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly color: string | null;
    readonly icon: string | null;
    readonly bookmarkCount: number;
    readonly createdAt: string;
    readonly updatedAt: string;
}

/** Input for creating a new bookmark collection */
export interface CreateBookmarkCollectionInput {
    readonly name: string;
    readonly description?: string;
    readonly color?: string;
    readonly icon?: string;
}

/** Input for updating an existing bookmark collection */
export interface UpdateBookmarkCollectionInput {
    readonly name?: string;
    readonly description?: string;
    readonly color?: string;
    readonly icon?: string;
}

/** Response shape from the user-bookmark-collections list endpoint */
export interface BookmarkCollectionListResponse {
    readonly items: readonly BookmarkCollectionItem[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly usage: BookmarkCollectionUsage;
}

/** Entity type filter allowed when fetching bookmarks inside a collection */
type CollectionBookmarkEntityType =
    | 'ACCOMMODATION'
    | 'DESTINATION'
    | 'ATTRACTION'
    | 'EVENT'
    | 'POST';

/** Single bookmark row returned inside a collection detail response */
export interface CollectionBookmarkRow {
    readonly id: string;
    readonly entityId: string;
    readonly entityType: CollectionBookmarkEntityType;
    readonly name: string | null;
    readonly description: string | null;
    readonly createdAt: string;
    /** Server-enriched display fields resolved from the referenced entity. */
    readonly entityName?: string | null;
    readonly entitySlug?: string | null;
    readonly entityImage?: string | null;
}

/**
 * Response shape from the user-bookmark-collections/:id endpoint.
 *
 * The server inlines the collection fields at the top level (no `collection`
 * wrapper) and the bookmarks are paginated using the standard `{ data, pagination }`
 * envelope from `PaginationResultSchema`. Mirrors `UserBookmarkCollectionDetailResponseSchema`.
 */
export interface BookmarkCollectionDetailResponse extends BookmarkCollectionItem {
    readonly bookmarks?: {
        readonly data: readonly CollectionBookmarkRow[];
        readonly pagination: {
            readonly page: number;
            readonly pageSize: number;
            readonly total: number;
            readonly totalPages: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
        };
    };
}

/** Protected user bookmark collections API endpoints */
export const userBookmarkCollectionsApi = {
    /**
     * Get a single bookmark collection by ID with its paginated bookmarks.
     *
     * @param params - Collection ID, optional bookmarks pagination and entity type filter
     * @returns The collection metadata and a paginated list of bookmark rows
     *
     * @example
     * ```ts
     * const result = await userBookmarkCollectionsApi.getById({
     *   id: 'col-uuid',
     *   bookmarksPage: 1,
     *   bookmarksPageSize: 12
     * });
     * if (result.ok) {
     *   const { collection, bookmarks } = result.data;
     *   console.log(collection.name, bookmarks.total);
     * }
     * ```
     */
    getById({
        id,
        bookmarksPage,
        bookmarksPageSize,
        entityType,
        cookieHeader
    }: {
        readonly id: string;
        readonly bookmarksPage?: number;
        readonly bookmarksPageSize?: number;
        readonly entityType?: CollectionBookmarkEntityType;
        /**
         * SSR-only: raw `Cookie` header forwarded to the API so the request
         * carries the user's session. Browser callers should omit this.
         */
        readonly cookieHeader?: string;
    }): Promise<ApiResult<BookmarkCollectionDetailResponse>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/user-bookmark-collections/${id}`,
            params: {
                bookmarksPage,
                bookmarksPageSize,
                entityType
            } as Record<string, unknown>,
            cookieHeader
        });
    },

    /**
     * List the authenticated user's bookmark collections.
     * Includes a `usage` field with `{ current, max }` indicating how many
     * collections the user has and the plan-level maximum allowed.
     *
     * @param params - Optional pagination and bookmark count inclusion
     * @returns Paginated list of collections with usage counters
     *
     * @example
     * ```ts
     * const result = await userBookmarkCollectionsApi.list({ page: 1, pageSize: 20 });
     * if (result.ok) {
     *   const { usage } = result.data;
     *   console.log(`${usage.current} / ${usage.max} collections used`);
     * }
     * ```
     */
    list(params?: {
        readonly page?: number;
        readonly pageSize?: number;
        readonly includeBookmarkCount?: boolean;
    }): Promise<ApiResult<BookmarkCollectionListResponse>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/user-bookmark-collections`,
            params: params as Record<string, unknown> | undefined
        });
    },

    /**
     * Create a new bookmark collection for the authenticated user.
     *
     * @param input - Collection fields: name (required), plus optional description, color, icon
     * @returns The newly created collection
     *
     * @example
     * ```ts
     * const result = await userBookmarkCollectionsApi.create({ name: 'Mi lista' });
     * if (result.ok) console.log(result.data.id);
     * ```
     */
    create(input: CreateBookmarkCollectionInput): Promise<ApiResult<BookmarkCollectionItem>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/user-bookmark-collections`,
            body: input
        });
    },

    /**
     * Update an existing bookmark collection.
     * Only the collection owner can call this endpoint.
     *
     * @param params - Collection ID and the fields to update (all optional)
     * @returns The updated collection
     *
     * @example
     * ```ts
     * const result = await userBookmarkCollectionsApi.update({
     *   id: 'col-uuid',
     *   input: { name: 'Nuevo nombre' }
     * });
     * if (result.ok) console.log(result.data.name);
     * ```
     */
    update({
        id,
        input
    }: {
        readonly id: string;
        readonly input: UpdateBookmarkCollectionInput;
    }): Promise<ApiResult<BookmarkCollectionItem>> {
        return apiClient.patch({
            path: `${PROTECTED}/user-bookmark-collections/${id}`,
            body: input
        });
    },

    /**
     * Assign a bookmark to a collection.
     * Corresponds to POST /api/v1/protected/user-bookmark-collections/:collectionId/bookmarks/:bookmarkId
     *
     * @param params - Collection ID and bookmark ID to assign
     * @returns The updated bookmark record wrapped in a `data` key
     *
     * @example
     * ```ts
     * const result = await userBookmarkCollectionsApi.addBookmark({
     *   collectionId: 'col-uuid',
     *   bookmarkId: 'bk-uuid'
     * });
     * if (result.ok) console.log(result.data.data.id);
     * ```
     */
    addBookmark({
        collectionId,
        bookmarkId
    }: {
        readonly collectionId: string;
        readonly bookmarkId: string;
    }): Promise<ApiResult<{ readonly data: UserBookmark }>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`
        });
    },

    /**
     * Remove a bookmark from a collection.
     * Corresponds to DELETE /api/v1/protected/user-bookmark-collections/:collectionId/bookmarks/:bookmarkId
     *
     * @param params - Collection ID and bookmark ID to remove
     * @returns Whether the removal succeeded
     *
     * @example
     * ```ts
     * const result = await userBookmarkCollectionsApi.removeBookmark({
     *   collectionId: 'col-uuid',
     *   bookmarkId: 'bk-uuid'
     * });
     * if (result.ok) console.log(result.data.success);
     * ```
     */
    removeBookmark({
        collectionId,
        bookmarkId
    }: {
        readonly collectionId: string;
        readonly bookmarkId: string;
    }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.delete({
            path: `${PROTECTED}/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`
        });
    },

    /**
     * Delete a bookmark collection by ID.
     * Only the collection owner can call this endpoint.
     *
     * @param params - Collection ID to delete
     * @returns Whether the deletion succeeded
     *
     * @example
     * ```ts
     * const result = await userBookmarkCollectionsApi.delete({ id: 'col-uuid' });
     * if (result.ok) console.log(result.data.success);
     * ```
     */
    delete({ id }: { readonly id: string }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.delete({
            path: `${PROTECTED}/user-bookmark-collections/${id}`
        });
    }
};

// --- Owner Promotions (Protected — SPEC-205) ---

/** Lifecycle state filter for owner promotion list queries */
type OwnerPromotionLifecycleState = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

/**
 * Protected owner-promotions API endpoints.
 * All operations are scoped to the authenticated owner (server enforces ownerId === actor.id).
 */
export const ownerPromotionApi = {
    /**
     * List the authenticated owner's promotions with optional filters.
     *
     * @param params - Optional lifecycle state filter and pagination
     * @returns Paginated list of the owner's promotions
     *
     * @example
     * ```ts
     * const result = await ownerPromotionApi.list({ lifecycleState: 'ACTIVE', pageSize: 20 });
     * if (result.ok) console.log(result.data.items);
     * ```
     */
    list(params?: {
        readonly lifecycleState?: OwnerPromotionLifecycleState;
        readonly page?: number;
        readonly pageSize?: number;
        readonly sortBy?: string;
        readonly sortOrder?: 'asc' | 'desc';
    }): Promise<ApiResult<PaginatedResponse<Record<string, unknown>>>> {
        return apiClient.getListProtected({
            path: `${PROTECTED}/owner-promotions`,
            params
        });
    },

    /**
     * Get a single owner promotion by ID.
     * Returns non-ok if not found (404) or not owned by the actor (403).
     *
     * @param params - Promotion ID
     * @returns The promotion record or an error result
     *
     * @example
     * ```ts
     * const result = await ownerPromotionApi.getById({ id: 'promo-uuid' });
     * if (result.ok) console.log(result.data.title);
     * ```
     */
    getById({
        id
    }: {
        readonly id: string;
    }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.getProtected({ path: `${PROTECTED}/owner-promotions/${id}` });
    },

    /**
     * Create a new owner promotion.
     *
     * @param params - Promotion creation payload
     * @returns The newly created promotion record
     *
     * @example
     * ```ts
     * const result = await ownerPromotionApi.create({
     *   body: { title: 'Summer deal', discountType: 'percentage', discountValue: 10, validFrom: '2026-07-01' }
     * });
     * if (result.ok) console.log(result.data.id);
     * ```
     */
    create({
        body
    }: {
        readonly body: import('./types').OwnerPromotionCreateInput;
    }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/owner-promotions`,
            body
        });
    },

    /**
     * Update an existing owner promotion (full replacement via PUT).
     * Only updates the fields provided in `body`; the server ignores absent fields.
     *
     * @param params - Promotion ID and partial update payload
     * @returns The updated promotion record
     *
     * @example
     * ```ts
     * const result = await ownerPromotionApi.update({ id: 'promo-uuid', body: { title: 'New title' } });
     * if (result.ok) console.log(result.data.updatedAt);
     * ```
     */
    update({
        id,
        body
    }: {
        readonly id: string;
        readonly body: import('./types').OwnerPromotionUpdateInput;
    }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.put({
            path: `${PROTECTED}/owner-promotions/${id}`,
            body
        });
    },

    /**
     * Soft-delete an owner promotion.
     *
     * @param params - Promotion ID to delete
     * @returns Whether the deletion succeeded
     *
     * @example
     * ```ts
     * const result = await ownerPromotionApi.remove({ id: 'promo-uuid' });
     * if (result.ok) console.log('Promotion deleted');
     * ```
     */
    remove({
        id
    }: {
        readonly id: string;
    }): Promise<ApiResult<{ readonly success: boolean }>> {
        return apiClient.delete({ path: `${PROTECTED}/owner-promotions/${id}` });
    }
};

// --- Accommodation Import from URL (Protected) ---

/** Protected accommodation import-from-URL API endpoint (SPEC-222). */
export const accommodationsImportApi = {
    /**
     * Import accommodation data from an external listing URL.
     *
     * The server extracts a per-field draft (with confidence + source) for the
     * host to review before saving. Nothing is persisted. Reviews/ratings are
     * never returned.
     *
     * @param body - The listing URL, optional locale, and the legal confirmation
     *   (must be `true` — the host confirms they have the right to import).
     * @returns The import response with the draft and hints, or an API error.
     *
     * @example
     * ```ts
     * const result = await accommodationsImportApi.importFromUrl({
     *   url: 'https://www.airbnb.com.ar/rooms/123',
     *   locale: 'es',
     *   legalConfirmed: true
     * });
     * if (result.ok) prefillForm(result.data.draft);
     * ```
     */
    importFromUrl(body: {
        readonly url: string;
        readonly locale?: string;
        readonly legalConfirmed: true;
    }): Promise<ApiResult<AccommodationImportResponse>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/accommodations/import-from-url`,
            body
        });
    }
};

// --- Accommodation Media (Protected — SPEC-204) ---

/**
 * Row shape returned by the accommodation_media relational endpoints.
 * The `id` is the DB UUID needed for removeMedia / setFeaturedMedia.
 */
export interface AccommodationMediaRow {
    readonly id: string;
    readonly url: string;
    readonly publicId?: string;
    readonly caption?: string;
    readonly description?: string;
    readonly alt?: string;
    readonly isFeatured: boolean;
    readonly sortOrder: number;
    readonly state: 'visible' | 'archived';
    readonly moderationState: string;
}

/**
 * Granular per-operation protected endpoints for accommodation photo management.
 *
 * These endpoints replace the old JSONB-embedded media approach (SPEC-204).
 * Each operation persists immediately to the `accommodation_media` relational
 * table — the parent PATCH no longer carries photo data.
 *
 * @example
 * ```ts
 * const list = await accommodationMediaApi.listMedia({ id: 'acc-uuid' });
 * const added = await accommodationMediaApi.addMedia({ id: 'acc-uuid', body: { url, publicId } });
 * await accommodationMediaApi.removeMedia({ id: 'acc-uuid', mediaId: added.data.media.id });
 * await accommodationMediaApi.setFeaturedMedia({ id: 'acc-uuid', mediaId: added.data.media.id });
 * ```
 */
export const accommodationMediaApi = {
    /**
     * List visible media rows for an accommodation.
     *
     * @param params - Accommodation ID, optional state filter, optional SSR cookie
     * @returns `{ media: AccommodationMediaRow[] }`
     */
    listMedia({
        id,
        state = 'visible',
        cookieHeader
    }: {
        readonly id: string;
        readonly state?: 'visible' | 'archived';
        readonly cookieHeader?: string;
    }): Promise<ApiResult<{ readonly media: readonly AccommodationMediaRow[] }>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/accommodations/${id}/media`,
            params: { state },
            cookieHeader
        });
    },

    /**
     * Add a new media row for an accommodation.
     * `sortOrder` and `isFeatured` are server-controlled.
     *
     * @param params - Accommodation ID and media body
     * @returns `{ media: AccommodationMediaRow }` — the newly created row (with DB id)
     */
    addMedia({
        id,
        body
    }: {
        readonly id: string;
        readonly body: {
            readonly url: string;
            readonly publicId?: string;
            readonly caption?: string;
            readonly description?: string;
            readonly alt?: string;
            readonly moderationState?: string;
        };
    }): Promise<ApiResult<{ readonly media: AccommodationMediaRow }>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/accommodations/${id}/media`,
            body
        });
    },

    /**
     * Delete a media row by its DB UUID.
     * Also removes the Cloudinary asset on the server side.
     *
     * @param params - Accommodation ID and media row ID (DB UUID)
     * @returns Delete result
     */
    removeMedia({
        id,
        mediaId
    }: {
        readonly id: string;
        readonly mediaId: string;
    }): Promise<ApiResult<Record<string, unknown>>> {
        return apiClient.delete({
            path: `${PROTECTED}/accommodations/${id}/media/${mediaId}`
        });
    },

    /**
     * Mark a media row as the featured (portada) image.
     * Enforces the single-featured invariant: the previous featured row is
     * automatically unmarked by the server and becomes a normal visible row.
     *
     * @param params - Accommodation ID and media row ID (DB UUID) to feature
     * @returns `{ media: AccommodationMediaRow }` — the updated row
     */
    setFeaturedMedia({
        id,
        mediaId
    }: {
        readonly id: string;
        readonly mediaId: string;
    }): Promise<ApiResult<{ readonly media: AccommodationMediaRow }>> {
        return apiClient.put({
            path: `${PROTECTED}/accommodations/${id}/media/${mediaId}/featured`
        });
    }
};
