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
    ResolveListingCompletenessResult,
    StartPaidSubscriptionResponse
} from '@repo/schemas';
import { resolveListingCompleteness } from '@repo/schemas';
import { apiClient } from '../api/client';
import type { ApiResult } from '../api/types';

const GASTRONOMY_MINE_PATH = '/api/v1/protected/gastronomies/mine';
const EXPERIENCE_MINE_PATH = '/api/v1/protected/experiences/mine';
const COMMERCE_LISTINGS_PATH = '/api/v1/protected/commerce/listings';
const COMMERCE_MY_LEAD_PATH = '/api/v1/protected/commerce/leads/mine';

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

// ---------------------------------------------------------------------------
// HOS-257 — owner self-service create-form pre-fill
// ---------------------------------------------------------------------------

/**
 * Pre-fill-shaped subset of the caller's own commerce lead, as returned by
 * `GET /api/v1/protected/commerce/leads/mine`. Field names already match
 * `CommerceCreateForm`'s `prefill` prop naming (`businessName` -> `name` is
 * done server-side).
 */
export interface MyCommerceLead {
    readonly name: string;
    readonly destinationId: string | null;
    readonly contactName: string;
    readonly email: string;
    readonly phone: string | null;
}

/**
 * Fetches the caller's own most-recent provisioned commerce lead, for
 * pre-filling the create form (HOS-257).
 *
 * D-4 compliance: this is the ONLY place `apps/web` talks to the lead
 * subsystem, and it does so exclusively over HTTP via the protected read
 * endpoint — never by importing the lead service or table directly (enforced
 * by the AC-14 static guard, `test/static-guards/commerce-lead-isolation.test.ts`).
 * Degrades to `null` on ANY failure (network error, 401, 5xx, no lead) —
 * this is a pre-fill convenience, never a gate; the create page must render
 * fully usable regardless of the outcome (AC-10/AC-11).
 *
 * @param cookieHeader - Raw `Cookie` header from the SSR request, forwarded so
 *   the protected endpoint can resolve the session.
 * @returns The pre-fill-shaped lead, or `null` when the caller has none / the
 *   request failed.
 */
export async function fetchMyCommerceLead({
    cookieHeader
}: {
    cookieHeader?: string;
}): Promise<MyCommerceLead | null> {
    const result = await apiClient.getProtected<{ readonly lead: MyCommerceLead | null }>({
        path: COMMERCE_MY_LEAD_PATH,
        cookieHeader
    });

    return result.ok ? (result.data.lead ?? null) : null;
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
 * `403` on a non-owner or a still-`mustChangePassword` caller.
 *
 * @param params - Vertical + listing id to start a subscription for.
 */
export function startOwnerListingCheckout({
    vertical,
    listingId
}: {
    readonly vertical: CommerceVertical;
    readonly listingId: string;
}): Promise<ApiResult<StartPaidSubscriptionResponse>> {
    return apiClient.postProtected<StartPaidSubscriptionResponse>({
        path: `${COMMERCE_LISTINGS_PATH}/${vertical}/${listingId}/start-subscription`,
        headers: { 'X-Idempotency-Key': crypto.randomUUID() }
    });
}
