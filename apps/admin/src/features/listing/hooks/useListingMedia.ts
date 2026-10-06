/**
 * useListingMedia — TanStack Query hooks for granular gallery CRUD on the
 * relational `gastronomy_media` / `experience_media` tables (HOS-372 → HOS-382).
 *
 * Vertical-agnostic: every hook takes a `vertical` argument (`'gastronomy'` or
 * `'experience'`) and resolves the correct admin endpoint from it. This
 * mirrors `useFaqs`'s `(entityType, parentId)` shape — the same two listing
 * verticals already share that hook — rather than duplicating one hook file
 * per vertical.
 *
 * Exposes:
 *  - useListingMediaList(vertical, entityId)        → list query (GET)
 *  - useListingMediaAdd(vertical, entityId)         → add mutation (POST)
 *  - useListingMediaAddFeatured(vertical, entityId) → cover upload (POST, HOS-803)
 *  - useListingMediaRemove(vertical, entityId)      → remove mutation (DELETE)
 *  - useListingMediaSetFeatured(vertical, entityId) → set-featured mutation (PUT)
 *
 * All mutations invalidate BOTH the list query and the cached entity on success
 * via the shared query key factories (HOS-389 §3). Reorder is intentionally omitted, mirroring the accommodation
 * gallery precedent (SPEC-204 locked decision: no drag/reorder in the admin
 * gallery UI). Archive/restore are also omitted — unlike `accommodation_media`,
 * the admin API exposes no archive/restore routes for `gastronomy_media` /
 * `experience_media` (see `apps/api/src/routes/gastronomy/admin/` and
 * `apps/api/src/routes/experience/admin/` — only get/add/remove/setFeatured/
 * reorder exist, and reorder is deliberately unused here too).
 *
 * Response envelope shape (mirrors the accommodation media endpoints):
 *   GET  → { success: true, data: { media: ListingMedia[] } }
 *   POST → { success: true, data: { media: ListingMedia } }
 *   PUT  → { success: true, data: { media: ListingMedia } }
 */

import type {
    ExperienceMedia,
    ExperienceMediaAddPayload,
    GastronomyMedia,
    GastronomyMediaAddPayload
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { createEntityQueryKeys } from '@/lib/query-keys/factory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Listing verticals whose gallery is managed via the relational media tables. */
export type ListingMediaVertical = 'gastronomy' | 'experience';

/**
 * A single gallery photo row, from either listing vertical.
 *
 * `GastronomyMedia` and `ExperienceMedia` differ only in their parent FK
 * field (`gastronomyId` vs `experienceId`) — every field the UI reads
 * (`id`, `url`, `isFeatured`, `caption`, `alt`, `state`, `sortOrder`, …) is
 * shared via `BaseListingMediaSchema`, so a union is safe to consume here.
 */
export type ListingMedia = GastronomyMedia | ExperienceMedia;

/**
 * Payload for adding a single photo to a listing gallery.
 * Identical shape across both verticals (both extend the same base schema).
 */
export type ListingMediaAddPayload = GastronomyMediaAddPayload | ExperienceMediaAddPayload;

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Centralised query key factory for listing media queries.
 * Using a factory keeps all invalidations consistent and avoids typo-driven
 * stale-data bugs.
 */
export const listingMediaQueryKeys = {
    all: (vertical: ListingMediaVertical, entityId: string) =>
        ['listingMedia', vertical, entityId] as const,
    list: (vertical: ListingMediaVertical, entityId: string) =>
        [...listingMediaQueryKeys.all(vertical, entityId), 'list'] as const
};

// ---------------------------------------------------------------------------
// Endpoint helper
// ---------------------------------------------------------------------------

/** Maps the singular vertical name to its plural admin route segment. */
const VERTICAL_ROUTE_SEGMENT: Record<ListingMediaVertical, string> = {
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

const mediaEndpoint = (vertical: ListingMediaVertical, entityId: string) =>
    `/api/v1/admin/${VERTICAL_ROUTE_SEGMENT[vertical]}/${entityId}/media`;

/**
 * Invalidates everything a gallery mutation just made stale (HOS-389 §3).
 *
 * The media list is the obvious half. The other half is the cached ENTITY: its
 * server-composed `media` object is what feeds the edit page's quality score
 * (`score-signals.ts`), so invalidating only the list left the page reporting
 * "no cover" right after one was uploaded, until some unrelated refetch
 * happened to refresh it.
 *
 * The entity key is built from the same `VERTICAL_ROUTE_SEGMENT` map the
 * endpoint uses, which is also the `entityName` the listing entity hooks are
 * created with (`'gastronomies'` / `'experiences'`) — so the two cannot drift
 * apart into invalidating a key nobody reads.
 *
 * Written once and shared by all three mutations rather than pasted into each
 * `onSuccess`: three copies is how one of them silently keeps the stale-entity
 * bug after the others are fixed.
 */
function invalidateAfterMediaMutation(
    queryClient: ReturnType<typeof useQueryClient>,
    vertical: ListingMediaVertical,
    entityId: string
): void {
    queryClient.invalidateQueries({
        queryKey: listingMediaQueryKeys.list(vertical, entityId)
    });
    queryClient.invalidateQueries({
        queryKey: createEntityQueryKeys(VERTICAL_ROUTE_SEGMENT[vertical]).detail(entityId)
    });
}

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

/**
 * Fetches the list of visible media rows for a given listing.
 *
 * The endpoint defaults to `state=visible` when no filter is supplied, which
 * is what `ListingGalleryManager` always uses (archive management is out of
 * scope for the admin panel's gallery tab — see module docs above).
 *
 * @param vertical - `'gastronomy'` or `'experience'`.
 * @param entityId - UUID of the gastronomy/experience listing.
 */
export function useListingMediaList(vertical: ListingMediaVertical, entityId: string) {
    return useQuery({
        queryKey: listingMediaQueryKeys.list(vertical, entityId),
        queryFn: async () => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(vertical, entityId)}?state=visible`
            });
            // API returns { success: true, data: { media: ListingMedia[] } }
            const body = response.data as { data?: { media?: ListingMedia[] } };
            return body.data?.media ?? [];
        },
        enabled: Boolean(entityId),
        staleTime: 2 * 60 * 1000
    });
}

// ---------------------------------------------------------------------------
// Add mutation
// ---------------------------------------------------------------------------

/**
 * Mutation to add a new photo to a listing gallery.
 *
 * The caller must first upload the file via `uploadEntityImage.mutateAsync`
 * (from `useMediaUpload`) to get the `{ url, publicId }` pair, then pass
 * both to this mutation as part of the `ListingMediaAddPayload`.
 *
 * On success the list query is invalidated so the UI refetches the updated
 * gallery from the server.
 *
 * @param vertical - `'gastronomy'` or `'experience'`.
 * @param entityId - UUID of the gastronomy/experience listing.
 */
export function useListingMediaAdd(vertical: ListingMediaVertical, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: ListingMediaAddPayload) => {
            const response = await fetchApi<unknown>({
                path: mediaEndpoint(vertical, entityId),
                method: 'POST',
                body: payload
            });
            const body = response.data as { data?: { media?: ListingMedia } };
            const media = body.data?.media;
            if (!media) {
                throw new Error(
                    'addMedia response did not include the expected data.media payload'
                );
            }
            return media;
        },
        onSuccess: () => {
            invalidateAfterMediaMutation(queryClient, vertical, entityId);
        }
    });
}

// ---------------------------------------------------------------------------
// Add-featured mutation (HOS-803)
// ---------------------------------------------------------------------------

/**
 * Mutation to register an uploaded photo as the listing's COVER, in one request.
 *
 * Replaces the `add` + `setFeatured` pair the portada uploader used to run. That
 * pair was refused at its first step once the gallery reached the per-entity cap
 * — the cap counts the gallery alone, because a cover is not a gallery item
 * (HOS-791) — so a listing with a full gallery could not replace the one photo
 * that does not occupy a slot in it. The row is now created already featured and
 * the photo it replaces is DELETED (soft-deleted) in the same transaction — it
 * does NOT fall back into the gallery — so the swap moves no count and there is
 * no intermediate gallery row to be capped.
 *
 * The response reports the id of the previous cover, which is soft-deleted in
 * the same transaction — unconditionally, so the swap costs the gallery nothing.
 * This hook invalidates and refetches rather than branching on it, but the id is
 * returned so an optimistic caller can drop that row.
 *
 * @param vertical - `'gastronomy'` or `'experience'`.
 * @param entityId - UUID of the listing.
 */
export function useListingMediaAddFeatured(vertical: ListingMediaVertical, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: ListingMediaAddPayload) => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(vertical, entityId)}/featured`,
                method: 'POST',
                body: payload
            });
            const body = response.data as {
                data?: {
                    media?: ListingMedia;
                    previousFeatured?: { readonly id: string } | null;
                };
            };
            const media = body.data?.media;
            if (!media) {
                throw new Error(
                    'addFeaturedMedia response did not include the expected data.media payload'
                );
            }
            return { media, previousFeatured: body.data?.previousFeatured ?? null };
        },
        onSuccess: () => {
            invalidateAfterMediaMutation(queryClient, vertical, entityId);
        }
    });
}

// ---------------------------------------------------------------------------
// Remove mutation
// ---------------------------------------------------------------------------

/**
 * Mutation to remove (soft-delete) a single media row from the gallery.
 *
 * After removal the remaining visible rows are resequenced server-side.
 * On success the list query is invalidated.
 *
 * @param vertical - `'gastronomy'` or `'experience'`.
 * @param entityId - UUID of the gastronomy/experience listing.
 */
export function useListingMediaRemove(vertical: ListingMediaVertical, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mediaId }: { readonly mediaId: string }) => {
            await fetchApi({
                path: `${mediaEndpoint(vertical, entityId)}/${mediaId}`,
                method: 'DELETE'
            });
            return mediaId;
        },
        onSuccess: () => {
            invalidateAfterMediaMutation(queryClient, vertical, entityId);
        }
    });
}

// ---------------------------------------------------------------------------
// Set-featured mutation
// ---------------------------------------------------------------------------

/**
 * Mutation to promote a gallery photo to the featured (portada) slot.
 *
 * The backend's single-featured invariant automatically unmarks the
 * previous featured row in the same transaction. After this mutation
 * succeeds the list query is invalidated so the UI sees the updated
 * `isFeatured` flags without any manual state juggling.
 *
 * @param vertical - `'gastronomy'` or `'experience'`.
 * @param entityId - UUID of the gastronomy/experience listing.
 */
export function useListingMediaSetFeatured(vertical: ListingMediaVertical, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mediaId }: { readonly mediaId: string }) => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(vertical, entityId)}/${mediaId}/featured`,
                method: 'PUT'
            });
            const body = response.data as { data?: { media?: ListingMedia } };
            const media = body.data?.media;
            if (!media) {
                throw new Error(
                    'setFeatured response did not include the expected data.media payload'
                );
            }
            return media;
        },
        onSuccess: () => {
            invalidateAfterMediaMutation(queryClient, vertical, entityId);
        }
    });
}
