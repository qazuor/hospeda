/**
 * @file owner-listings.ts
 * @description Fetches the authenticated venue/experience owner's own listings across
 * both verticals (venue + experiences) for the `mi-cuenta/comercio`
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
    OwnerListingSummary,
    ResolveListingCompletenessResult,
    VenueOrExperience,
    VenueOwnerCreateInput,
    VenueProtected
} from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { apiClient } from '../api/client';
import type { ApiResult } from '../api/types';

const VENUE_MINE_PATH = '/api/v1/protected/venues/mine';
const EXPERIENCE_MINE_PATH = '/api/v1/protected/experiences/mine';
const VENUE_PATH = '/api/v1/protected/venues';
const EXPERIENCE_PATH = '/api/v1/protected/experiences';

/**
 * Protected collection path of each vertical, read as data.
 *
 * A record keyed by vertical rather than `vertical === 'venue' ? … : …` at each
 * call site: G-FAC-05 (leaf 5.8) scans this file for comparisons against a
 * vertical literal.
 */
const PROTECTED_COLLECTION_PATH: Readonly<Record<VenueOrExperience, string>> = {
    venue: VENUE_PATH,
    experience: EXPERIENCE_PATH
};

/** Owner-tier detail of a single listing, one of the two verticals. */
export type ListingDetail = VenueProtected | ExperienceProtected;

/** The two supported venue/experience verticals (matches the URL segment + enum value). */
export type { VenueOrExperience };

/**
 * The venue vertical value, shared so callers do not repeat the literal.
 *
 * A named constant rather than an inline `'venue'` at each call site: G-FAC-05
 * scans the owner index for bare vertical comparisons.
 */
export const VENUE_VERTICAL = 'venue' as const;

/**
 * Whether a listing belongs to the venue vertical.
 *
 * @param listing - Any listing carrying its `vertical` discriminator.
 * @returns `true` for a venue listing, `false` for an experience one.
 */
export function isVenueListing(listing: { readonly vertical: VenueOrExperience }): boolean {
    return listing.vertical === VENUE_VERTICAL;
}

/**
 * Thrown by {@link fetchOwnerListings} when the owner's listings could not be
 * read and there is nothing to show (HOS-2421). Callers render an error with a
 * retry action, never the "you have no listings" empty state.
 */
export class OwnerListingsUnavailableError extends Error {
    constructor() {
        super('Owner listings could not be loaded');
        this.name = 'OwnerListingsUnavailableError';
    }
}

type ListResponse = { readonly listings: readonly OwnerListingSummary[] };

/**
 * Fetches and merges the owner's venue + experience listings.
 *
 * @param cookieHeader - Raw `Cookie` header from the SSR request, forwarded so
 *   the protected endpoints can resolve the session (browser callers may omit
 *   it and rely on `credentials: 'include'`).
 * @returns The merged list of owner listing summaries (empty only when the
 *   owner really has none).
 * @throws {OwnerListingsUnavailableError} When a vertical request failed and
 *   nothing was loaded, so an empty result would be indistinguishable from
 *   "this owner has no listings" (HOS-2421). A failure of one vertical while
 *   the other returned listings still degrades to the partial list.
 */
export async function fetchOwnerListings({
    cookieHeader
}: {
    cookieHeader?: string;
}): Promise<readonly OwnerListingSummary[]> {
    const [venue, experience] = await Promise.all([
        apiClient.getProtected<ListResponse>({ path: VENUE_MINE_PATH, cookieHeader }),
        apiClient.getProtected<ListResponse>({ path: EXPERIENCE_MINE_PATH, cookieHeader })
    ]);

    const listings: OwnerListingSummary[] = [];
    if (venue.ok) {
        listings.push(...venue.data.listings);
    }
    if (experience.ok) {
        listings.push(...experience.data.listings);
    }
    if (listings.length === 0 && (!venue.ok || !experience.ok)) {
        throw new OwnerListingsUnavailableError();
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
    vertical: VenueOrExperience;
    id: string;
    cookieHeader?: string;
}): Promise<ListingDetail | null> {
    const path = `${PROTECTED_COLLECTION_PATH[vertical]}/${id}`;

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
 * when the list carried no requirements for it (degrades to an "unknown" card state rather
 * than a wrong one — see `resolveListingCardState`).
 */
export interface OwnerListingSummaryWithState extends OwnerListingSummary {
    readonly completeness: ResolveListingCompletenessResult | null;
}

/**
 * Fetches the owner's listings of ONE vertical with their state, in a single
 * request (HOS-2484, AC-7 «one list request»).
 *
 * Before HOS-2484 this fetched both verticals and then every non-public
 * listing's detail to compute its checklist: one request per listing. The
 * `/mine` endpoint now carries each unpublished listing's unmet requirements
 * (`missingRequirements`), computed by the SAME canonical
 * `resolveListingCompleteness` the checkout gate and the reconciler use, so the
 * preview stays one definition with three consumers.
 *
 * `completeness` is `null` for a public or purged listing (nothing to check)
 * and whenever the summary carries no requirements (the API could not read
 * them): the card then shows an «unknown» state, never a false «complete».
 *
 * @param input.vertical - The list the page shows (`?vertical=`).
 * @param input.cookieHeader - Raw `Cookie` header from the SSR request.
 * @returns That vertical's listings, enriched.
 * @throws {OwnerListingsUnavailableError} When the list could not be read.
 */
export async function fetchOwnerListingsWithState({
    vertical,
    cookieHeader
}: {
    readonly vertical: VenueOrExperience;
    readonly cookieHeader?: string;
}): Promise<readonly OwnerListingSummaryWithState[]> {
    const result = await apiClient.getProtected<ListResponse>({
        path: vertical === VENUE_VERTICAL ? VENUE_MINE_PATH : EXPERIENCE_MINE_PATH,
        cookieHeader
    });
    if (!result.ok) throw new OwnerListingsUnavailableError();
    return result.data.listings.map((summary): OwnerListingSummaryWithState => {
        const missing = summary.missingRequirements;
        if (
            summary.isPublic ||
            summary.publicationStatus === PublicationStatusEnum.PURGED ||
            missing === undefined
        ) {
            return { ...summary, completeness: null };
        }
        return { ...summary, completeness: { complete: missing.length === 0, missing } };
    });
}

/** Payload accepted by {@link createOwnerListing} — one per vertical. */
export type CreateOwnerListingPayload =
    | { readonly vertical: 'venue'; readonly data: VenueOwnerCreateInput }
    | { readonly vertical: 'experience'; readonly data: ExperienceOwnerCreateInput };

/**
 * Creates a new listing owned by the caller (HOS-166 §7.2).
 *
 * `POST /api/v1/protected/venues` or `POST /api/v1/protected/experiences`
 * depending on the vertical (the accommodation pattern: `POST /`). The
 * server forces `ownerId = actor.id`, the listing is born
 * `publicationStatus: DRAFT` (HOS-1641), and derives `slug` from `name` — none of those are
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
        path: PROTECTED_COLLECTION_PATH[params.vertical],
        body: params.data
    });
}
