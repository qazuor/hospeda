/**
 * @file owner-listings.ts
 * @description Fetches the authenticated commerce owner's own listings across
 * both verticals (gastronomy + experiences) for the `mi-cuenta/comercio`
 * self-service area (SPEC-249).
 *
 * Each vertical exposes its own protected `GET /{vertical}/mine` endpoint
 * (owner-scoped in the service). This helper fans out to both, merges the
 * results, and degrades cleanly: if one vertical fails, the other's listings
 * are still returned rather than failing the whole page.
 */
import type {
    CommerceOwnerListingSummary,
    ExperienceProtected,
    GastronomyProtected
} from '@repo/schemas';
import { apiClient } from '../api/client';

const GASTRONOMY_MINE_PATH = '/api/v1/protected/gastronomies/mine';
const EXPERIENCE_MINE_PATH = '/api/v1/protected/experiences/mine';

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
 * The protected getById endpoint does NOT enforce ownership (any authenticated
 * user may read), so callers MUST verify `ownerId` against the session user
 * before exposing the editor — the write path (`updateOwn`) is the hard gate
 * (NOT_FOUND for non-owners), this is just a defensive UX gate.
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
