/**
 * @file owner-listings.ts
 * @description Fetches the authenticated gastronomy/experience owner's own listings across
 * both verticals (gastronomy + experiences) for the `mi-cuenta/comercio`
 * self-service area (SPEC-249), extended in HOS-166 PR-C with the owner
 * self-service create call and a per-listing completeness
 * enrichment used to drive the listing-card state machine.
 *
 * Each vertical exposes its own protected `GET /{vertical}/mine` endpoint
 * (owner-scoped in the service). This helper fans out to both, merges the
 * results, and degrades cleanly: if one vertical fails, the other's listings
 * are still returned rather than failing the whole page.
 */
import type {
    ExperienceOwnerCreateInput,
    ExperienceProtected,
    GastronomyOrExperience,
    GastronomyOwnerCreateInput,
    GastronomyProtected,
    ListingCompletenessListing,
    OwnerListingSummary,
    ResolveListingCompletenessResult
} from '@repo/schemas';
import { resolveListingCompleteness } from '@repo/schemas';
import { apiClient } from '../api/client';
import type { ApiResult } from '../api/types';

const GASTRONOMY_MINE_PATH = '/api/v1/protected/gastronomies/mine';
const EXPERIENCE_MINE_PATH = '/api/v1/protected/experiences/mine';
const GASTRONOMY_PATH = '/api/v1/protected/gastronomies';
const EXPERIENCE_PATH = '/api/v1/protected/experiences';

/** Owner-tier detail of a single listing, one of the two verticals. */
export type ListingDetail = GastronomyProtected | ExperienceProtected;

/** The two supported gastronomy/experience verticals (matches the URL segment + enum value). */
export type { GastronomyOrExperience };

type ListResponse = { readonly listings: readonly OwnerListingSummary[] };

/**
 * Fetches and merges the owner's gastronomy + experience listings.
 *
 * @param cookieHeader - Raw `Cookie` header from the SSR request, forwarded so
 *   the protected endpoints can resolve the session (browser callers may omit
 *   it and rely on `credentials: 'include'`).
 * @returns The merged list of owner listing summaries (empty when the owner
 *   has none or every vertical request fails).
 */
export async function fetchOwnerListings({
    cookieHeader
}: {
    cookieHeader?: string;
}): Promise<readonly OwnerListingSummary[]> {
    const [gastronomy, experience] = await Promise.all([
        apiClient.getProtected<ListResponse>({ path: GASTRONOMY_MINE_PATH, cookieHeader }),
        apiClient.getProtected<ListResponse>({ path: EXPERIENCE_MINE_PATH, cookieHeader })
    ]);

    const listings: OwnerListingSummary[] = [];
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
 * (without the vertical's VIEW_ALL permission) receive NOT_FOUND, so this call already fails
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
    vertical: GastronomyOrExperience;
    id: string;
    cookieHeader?: string;
}): Promise<ListingDetail | null> {
    const path =
        vertical === 'gastronomy' ? `${GASTRONOMY_PATH}/${id}` : `${EXPERIENCE_PATH}/${id}`;

    const result = await apiClient.getProtected<ListingDetail | null>({
        path,
        cookieHeader
    });

    return result.ok ? (result.data ?? null) : null;
}

// ---------------------------------------------------------------------------
// HOS-166 PR-C — owner self-service create
// ---------------------------------------------------------------------------

/**
 * A listing summary enriched with a completeness preview (HOS-166 §6.6,
 * §8 point 4/6) — used by the `mi-cuenta/comercio` index to drive the
 * listing-card state machine (`resolveListingCardState`).
 *
 * `completeness` is `null` when the listing is already public (no need to
 * compute it — a public listing is complete by construction, per G-3) or
 * when its detail fetch failed (degrades to an "unknown" card state rather
 * than a wrong one — see `resolveListingCardState`).
 */
export interface OwnerListingSummaryWithState extends OwnerListingSummary {
    readonly completeness: ResolveListingCompletenessResult | null;
}

/**
 * Fetches the owner's listings (both verticals) and enriches every
 * non-public one with a completeness preview, fetched from the same
 * protected getById the editor uses. Public listings are skipped (G-3: a
 * public listing is complete by construction, and paying for the extra
 * fetch would tell the owner nothing new).
 *
 * The per-listing detail fetch is fanned out with `Promise.all` — gastronomy/experience
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
export async function fetchOwnerListingsWithState({
    cookieHeader
}: {
    cookieHeader?: string;
}): Promise<readonly OwnerListingSummaryWithState[]> {
    const summaries = await fetchOwnerListings({ cookieHeader });

    return Promise.all(
        summaries.map(async (summary): Promise<OwnerListingSummaryWithState> => {
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
            // field-compatible subset (`ListingCompletenessListing`).
            const completeness = resolveListingCompleteness({
                entityType: summary.vertical,
                // TYPE-WORKAROUND: union detail → narrow completeness subset (see above).
                listing: detail as unknown as ListingCompletenessListing
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
 * Creates a new listing owned by the caller (HOS-166 §7.2).
 *
 * `POST /api/v1/protected/gastronomies` or `POST /api/v1/protected/experiences`
 * depending on the vertical (the accommodation pattern: `POST /`). The
 * server forces `ownerId = actor.id`, `visibility: PRIVATE`,
 * `lifecycleState: DRAFT`, and derives `slug` from `name` — none of those are
 * ever sent from here (D-3).
 *
 * D-4 compliance: this function takes plain listing data and has never heard
 * of the retired leads table — any lead-derived pre-fill happens in the CALLER
 * (`ListingCreateForm.client.tsx`'s initial state), never here.
 *
 * @param params - Which vertical, and the create payload for it.
 * @returns The created listing (protected view) on success.
 */
export function createOwnerListing(
    params: CreateOwnerListingPayload
): Promise<ApiResult<ListingDetail>> {
    return apiClient.postProtected<ListingDetail>({
        path: params.vertical === 'gastronomy' ? GASTRONOMY_PATH : EXPERIENCE_PATH,
        body: params.data
    });
}
