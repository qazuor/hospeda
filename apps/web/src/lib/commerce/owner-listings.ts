/**
 * @file owner-listings.ts
 * @description Fetches the authenticated commerce owner's own listings across
 * both verticals (gastronomy + experiences) for the `mi-cuenta/comercio`
 * self-service area (SPEC-249), extended in HOS-166 PR-C with the owner
 * self-service create + checkout calls and a per-listing completeness
 * enrichment used to drive the listing-card state machine.
 *
 * Each vertical exposes its own protected `GET /{vertical}/mine` endpoint
 * (owner-scoped in the service). This helper fans out to both, merges the
 * results, and degrades cleanly: if one vertical fails, the other's listings
 * are still returned rather than failing the whole page.
 */
import type {
    CommerceListingCompletenessListing,
    CommerceOwnerListingSummary,
    ExperienceOwnerCreateInput,
    ExperienceProtected,
    GastronomyOwnerCreateInput,
    GastronomyProtected,
    PlanChangeResponse,
    ResolveListingCompletenessResult,
    StartPaidSubscriptionResponse
} from '@repo/schemas';
import { resolveListingCompleteness } from '@repo/schemas';
import { apiClient } from '../api/client';
import type { ApiResult } from '../api/types';

const GASTRONOMY_MINE_PATH = '/api/v1/protected/gastronomies/mine';
const EXPERIENCE_MINE_PATH = '/api/v1/protected/experiences/mine';
const COMMERCE_LISTINGS_PATH = '/api/v1/protected/commerce/listings';

/** Owner-tier detail of a single commerce listing, one of the two verticals. */
export type CommerceListingDetail = GastronomyProtected | ExperienceProtected;

/** The two supported commerce verticals (matches the URL segment + enum value). */
export type CommerceVertical = 'gastronomy' | 'experience';

type ListResponse = { readonly listings: readonly CommerceOwnerListingSummary[] };

/**
 * Fetches and merges the owner's gastronomy + experience listings.
 *
 * @param cookieHeader - Raw `Cookie` header from the SSR request, forwarded so
 *   the protected endpoints can resolve the session (browser callers may omit
 *   it and rely on `credentials: 'include'`).
 * @returns The merged list of owner listing summaries (empty when the owner
 *   has none or every vertical request fails).
 */
export async function fetchOwnerCommerceListings({
    cookieHeader
}: {
    cookieHeader?: string;
}): Promise<readonly CommerceOwnerListingSummary[]> {
    const [gastronomy, experience] = await Promise.all([
        apiClient.getProtected<ListResponse>({ path: GASTRONOMY_MINE_PATH, cookieHeader }),
        apiClient.getProtected<ListResponse>({ path: EXPERIENCE_MINE_PATH, cookieHeader })
    ]);

    const listings: CommerceOwnerListingSummary[] = [];
    if (gastronomy.ok) {
        listings.push(...gastronomy.data.listings);
    }
    if (experience.ok) {
        listings.push(...experience.data.listings);
    }
    return listings;
}

/**
 * Fetches a single owner listing's protected detail (identity + operational
 * fields) for the editor, from the vertical's `GET /{vertical}/{id}` endpoint.
 *
 * The protected getById endpoint enforces ownership server-side: non-owners
 * (without COMMERCE_VIEW_ALL) receive NOT_FOUND, so this call already fails
 * cleanly for non-owners. The `editar.astro` page redirects on null/NOT_FOUND,
 * which remains the correct UX behaviour.
 *
 * @returns The listing detail, or `null` when not found / request failed.
 */
export async function fetchOwnerListingDetail({
    vertical,
    id,
    cookieHeader
}: {
    vertical: CommerceVertical;
    id: string;
    cookieHeader?: string;
}): Promise<CommerceListingDetail | null> {
    const path =
        vertical === 'gastronomy'
            ? `/api/v1/protected/gastronomies/${id}`
            : `/api/v1/protected/experiences/${id}`;

    const result = await apiClient.getProtected<CommerceListingDetail | null>({
        path,
        cookieHeader
    });

    return result.ok ? (result.data ?? null) : null;
}

// ---------------------------------------------------------------------------
// HOS-166 PR-C — owner self-service create + checkout
// ---------------------------------------------------------------------------

/**
 * A listing summary enriched with a completeness preview (HOS-166 §6.6,
 * §8 point 4/6) — used by the `mi-cuenta/comercio` index to drive the
 * listing-card state machine (`resolveCommerceListingCardState`).
 *
 * `completeness` is `null` when the listing is already public (no need to
 * compute it — a public listing is complete by construction, per G-3) or
 * when its detail fetch failed (degrades to an "unknown" card state rather
 * than a wrong one — see `resolveCommerceListingCardState`).
 */
export interface CommerceOwnerListingSummaryWithState extends CommerceOwnerListingSummary {
    readonly completeness: ResolveListingCompletenessResult | null;
}

/**
 * Fetches the owner's listings (both verticals) and enriches every
 * non-public one with a completeness preview, fetched from the same
 * protected getById the editor uses. Public listings are skipped (G-3: a
 * public listing is complete by construction, and paying for the extra
 * fetch would tell the owner nothing new).
 *
 * The per-listing detail fetch is fanned out with `Promise.all` — commerce
 * owners are expected to hold a handful of listings (HOS-166 OQ-4: no cap in
 * v1, but not a bulk-catalog use case), so an N+1 SSR fetch here is an
 * accepted tradeoff over adding new API surface. This preview calls the SAME
 * canonical `resolveListingCompleteness` (from `@repo/schemas`, HOS-166
 * judgment-day R-5) as the checkout route's server-side gate and the
 * visibility reconciler — one definition, three consumers, no separately
 * maintained web mirror to drift out of lockstep with the other two.
 *
 * @param cookieHeader - Raw `Cookie` header from the SSR request.
 * @returns The merged, enriched list.
 */
export async function fetchOwnerCommerceListingsWithState({
    cookieHeader
}: {
    cookieHeader?: string;
}): Promise<readonly CommerceOwnerListingSummaryWithState[]> {
    const summaries = await fetchOwnerCommerceListings({ cookieHeader });

    return Promise.all(
        summaries.map(async (summary): Promise<CommerceOwnerListingSummaryWithState> => {
            if (summary.isPublic) {
                return { ...summary, completeness: null };
            }

            const detail = await fetchOwnerListingDetail({
                vertical: summary.vertical,
                id: summary.id,
                cookieHeader
            });

            if (!detail) {
                return { ...summary, completeness: null };
            }

            // `detail` is a gastronomy|experience union whose two members share no
            // nameable structural supertype; the canonical function reads a narrow,
            // field-compatible subset (`CommerceListingCompletenessListing`).
            const completeness = resolveListingCompleteness({
                entityType: summary.vertical,
                // TYPE-WORKAROUND: union detail → narrow completeness subset (see above).
                listing: detail as unknown as CommerceListingCompletenessListing
            });

            return { ...summary, completeness };
        })
    );
}

/** Payload accepted by {@link createOwnerListing} — one per vertical. */
export type CreateOwnerListingPayload =
    | { readonly vertical: 'gastronomy'; readonly data: GastronomyOwnerCreateInput }
    | { readonly vertical: 'experience'; readonly data: ExperienceOwnerCreateInput };

/**
 * Creates a new commerce listing owned by the caller (HOS-166 §7.2).
 *
 * `POST /api/v1/protected/commerce/listings/{gastronomy|experience}`. The
 * server forces `ownerId = actor.id`, `visibility: PRIVATE`,
 * `lifecycleState: DRAFT`, and derives `slug` from `name` — none of those are
 * ever sent from here (D-3).
 *
 * D-4 compliance: this function takes plain listing data and has never heard
 * of the commerce-leads DB table — any lead-derived pre-fill happens in the CALLER
 * (`CommerceCreateForm.client.tsx`'s initial state), never here.
 *
 * @param params - Which vertical, and the create payload for it.
 * @returns The created listing (protected view) on success.
 */
export function createOwnerListing(
    params: CreateOwnerListingPayload
): Promise<ApiResult<CommerceListingDetail>> {
    return apiClient.postProtected<CommerceListingDetail>({
        path: `${COMMERCE_LISTINGS_PATH}/${params.vertical}`,
        body: params.data
    });
}

/**
 * Starts the owner's self-checkout for one of their own commerce listings
 * (HOS-166 §6.3). Mirrors `billingApi.createCheckout`'s idempotency-key
 * pattern (`X-Idempotency-Key: crypto.randomUUID()` per click — AC-15).
 *
 * Status contract (spec §7.1): `201` with `{checkoutUrl, localSubscriptionId,
 * expiresAt}`; `422` with `{error: {code: 'LISTING_INCOMPLETE', missing}}`
 * when the listing is not publish-ready; `409` when already subscribed;
 * `403` on a non-owner or a still-`mustChangePassword` caller. HOS-1119 added
 * `400` when `planSlug` names a tier that does not belong to this vertical.
 *
 * `payerEmail` (HOS-1008) is the address the owner confirmed on the
 * pre-redirect screen. `planSlug` (HOS-1119) is the tier the owner picked on
 * the {@link CommercePlanOption} picker, when the vertical has more than one
 * active tier and the owner is choosing their FIRST subscription. Each is
 * sent ONLY when defined — with BOTH omitted **no body is sent at all** and
 * the request is byte-identical to the pre-HOS-1008 one; the backend already
 * defaults an absent `planSlug` to the vertical's default tier, so this
 * function must never invent one.
 *
 * @param params - Vertical + listing id, plus the confirmed payer email
 *   and/or chosen tier slug when the owner went through those screens.
 */
export function startOwnerListingCheckout({
    vertical,
    listingId,
    payerEmail,
    planSlug
}: {
    readonly vertical: CommerceVertical;
    readonly listingId: string;
    readonly payerEmail?: string;
    readonly planSlug?: string;
}): Promise<ApiResult<StartPaidSubscriptionResponse>> {
    const body: { payerEmail?: string; planSlug?: string } = {};
    if (payerEmail !== undefined) {
        body.payerEmail = payerEmail;
    }
    if (planSlug !== undefined) {
        body.planSlug = planSlug;
    }
    const hasBody = payerEmail !== undefined || planSlug !== undefined;

    return apiClient.postProtected<StartPaidSubscriptionResponse>({
        path: `${COMMERCE_LISTINGS_PATH}/${vertical}/${listingId}/start-subscription`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
        ...(hasBody ? { body } : {})
    });
}

// ---------------------------------------------------------------------------
// HOS-1119 — owner self-service tier change
// ---------------------------------------------------------------------------

const COMMERCE_SUBSCRIPTIONS_PATH = '/api/v1/protected/commerce/subscriptions';

/**
 * Moves the caller's own commerce subscription for one vertical to another
 * tier (HOS-1119, both directions since HOS-1122).
 *
 * `POST /api/v1/protected/commerce/subscriptions/{vertical}/change-plan`.
 * Mirrors {@link startOwnerListingCheckout}'s idempotency-key pattern — a
 * fresh `X-Idempotency-Key` per call, so a retried click cannot open two
 * changes.
 *
 * Only `422` is now reserved for a target priced IDENTICALLY to the current
 * tier: it is neither direction. This docblock said "upgrades only" until
 * HOS-1122 gave commerce a downgrade, and the caller that acts on it —
 * `CommercePlanChange.client.tsx` — still offers dearer tiers only. That is a
 * UI gap, not a contract one: a cheaper target answers `scheduled` here.
 *
 * Other error codes: `400` (malformed/foreign-vertical slug), `404` (no live
 * subscription for this vertical, or the target plan does not exist), `409`
 * (a cancellation is already pending, or the subscription moved mid-request),
 * `410` (target plan retired), `503` (billing unavailable).
 *
 * @param params - Vertical to act on, and the target tier's slug.
 * @returns A discriminated `PlanChangeResponse`: `pending_payment` (redirect
 *   to `checkoutUrl` to pay the prorated delta), `active` (applied at once,
 *   no charge — the subscription was still trialing), or `scheduled` (a
 *   downgrade, effective at period end, carrying a
 *   `commerceRestrictionPreview` of the listings the smaller cap stops
 *   covering).
 */
export function changeCommercePlan({
    vertical,
    planSlug
}: {
    readonly vertical: CommerceVertical;
    readonly planSlug: string;
}): Promise<ApiResult<PlanChangeResponse>> {
    return apiClient.postProtected<PlanChangeResponse>({
        path: `${COMMERCE_SUBSCRIPTIONS_PATH}/${vertical}/change-plan`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() },
        body: { planSlug }
    });
}
