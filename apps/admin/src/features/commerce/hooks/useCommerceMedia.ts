/**
 * useCommerceMedia — TanStack Query hooks for granular gallery CRUD on the
 * relational `gastronomy_media` / `experience_media` tables (HOS-372 → HOS-382).
 *
 * Vertical-agnostic: every hook takes a `vertical` argument (`'gastronomy'` or
 * `'experience'`) and resolves the correct admin endpoint from it. This
 * mirrors `useFaqs`'s `(entityType, parentId)` shape — the same two commerce
 * verticals already share that hook — rather than duplicating one hook file
 * per vertical.
 *
 * Exposes:
 *  - useCommerceMediaList(vertical, entityId)        → list query (GET)
 *  - useCommerceMediaAdd(vertical, entityId)         → add mutation (POST)
 *  - useCommerceMediaRemove(vertical, entityId)      → remove mutation (DELETE)
 *  - useCommerceMediaSetFeatured(vertical, entityId) → set-featured mutation (PUT)
 *
 * All mutations invalidate the list query on success via the shared query key
 * factory. Reorder is intentionally omitted, mirroring the accommodation
 * gallery precedent (SPEC-204 locked decision: no drag/reorder in the admin
 * gallery UI). Archive/restore are also omitted — unlike `accommodation_media`,
 * the admin API exposes no archive/restore routes for `gastronomy_media` /
 * `experience_media` (see `apps/api/src/routes/gastronomy/admin/` and
 * `apps/api/src/routes/experience/admin/` — only get/add/remove/setFeatured/
 * reorder exist, and reorder is deliberately unused here too).
 *
 * Response envelope shape (mirrors the accommodation media endpoints):
 *   GET  → { success: true, data: { media: CommerceMedia[] } }
 *   POST → { success: true, data: { media: CommerceMedia } }
 *   PUT  → { success: true, data: { media: CommerceMedia } }
 */

import type {
    ExperienceMedia,
    ExperienceMediaAddPayload,
    GastronomyMedia,
    GastronomyMediaAddPayload
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Commerce verticals whose gallery is managed via the relational media tables. */
export type CommerceMediaVertical = 'gastronomy' | 'experience';

/**
 * A single gallery photo row, from either commerce vertical.
 *
 * `GastronomyMedia` and `ExperienceMedia` differ only in their parent FK
 * field (`gastronomyId` vs `experienceId`) — every field the UI reads
 * (`id`, `url`, `isFeatured`, `caption`, `alt`, `state`, `sortOrder`, …) is
 * shared via `BaseCommerceMediaSchema`, so a union is safe to consume here.
 */
export type CommerceMedia = GastronomyMedia | ExperienceMedia;

/**
 * Payload for adding a single photo to a commerce listing gallery.
 * Identical shape across both verticals (both extend the same base schema).
 */
export type CommerceMediaAddPayload = GastronomyMediaAddPayload | ExperienceMediaAddPayload;

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Centralised query key factory for commerce media queries.
 * Using a factory keeps all invalidations consistent and avoids typo-driven
 * stale-data bugs.
 */
export const commerceMediaQueryKeys = {
    all: (vertical: CommerceMediaVertical, entityId: string) =>
        ['commerceMedia', vertical, entityId] as const,
    list: (vertical: CommerceMediaVertical, entityId: string) =>
        [...commerceMediaQueryKeys.all(vertical, entityId), 'list'] as const
};

// ---------------------------------------------------------------------------
// Endpoint helper
// ---------------------------------------------------------------------------

/** Maps the singular vertical name to its plural admin route segment. */
const VERTICAL_ROUTE_SEGMENT: Record<CommerceMediaVertical, string> = {
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

const mediaEndpoint = (vertical: CommerceMediaVertical, entityId: string) =>
    `/api/v1/admin/${VERTICAL_ROUTE_SEGMENT[vertical]}/${entityId}/media`;

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

/**
 * Fetches the list of visible media rows for a given commerce listing.
 *
 * The endpoint defaults to `state=visible` when no filter is supplied, which
 * is what `CommerceGalleryManager` always uses (archive management is out of
 * scope for the admin panel's gallery tab — see module docs above).
 *
 * @param vertical - `'gastronomy'` or `'experience'`.
 * @param entityId - UUID of the gastronomy/experience listing.
 */
export function useCommerceMediaList(vertical: CommerceMediaVertical, entityId: string) {
    return useQuery({
        queryKey: commerceMediaQueryKeys.list(vertical, entityId),
        queryFn: async () => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(vertical, entityId)}?state=visible`
            });
            // API returns { success: true, data: { media: CommerceMedia[] } }
            const body = response.data as { data?: { media?: CommerceMedia[] } };
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
 * Mutation to add a new photo to a commerce listing gallery.
 *
 * The caller must first upload the file via `uploadEntityImage.mutateAsync`
 * (from `useMediaUpload`) to get the `{ url, publicId }` pair, then pass
 * both to this mutation as part of the `CommerceMediaAddPayload`.
 *
 * On success the list query is invalidated so the UI refetches the updated
 * gallery from the server.
 *
 * @param vertical - `'gastronomy'` or `'experience'`.
 * @param entityId - UUID of the gastronomy/experience listing.
 */
export function useCommerceMediaAdd(vertical: CommerceMediaVertical, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CommerceMediaAddPayload) => {
            const response = await fetchApi<unknown>({
                path: mediaEndpoint(vertical, entityId),
                method: 'POST',
                body: payload
            });
            const body = response.data as { data?: { media?: CommerceMedia } };
            const media = body.data?.media;
            if (!media) {
                throw new Error(
                    'addMedia response did not include the expected data.media payload'
                );
            }
            return media;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: commerceMediaQueryKeys.list(vertical, entityId)
            });
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
export function useCommerceMediaRemove(vertical: CommerceMediaVertical, entityId: string) {
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
            queryClient.invalidateQueries({
                queryKey: commerceMediaQueryKeys.list(vertical, entityId)
            });
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
export function useCommerceMediaSetFeatured(vertical: CommerceMediaVertical, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mediaId }: { readonly mediaId: string }) => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(vertical, entityId)}/${mediaId}/featured`,
                method: 'PUT'
            });
            const body = response.data as { data?: { media?: CommerceMedia } };
            const media = body.data?.media;
            if (!media) {
                throw new Error(
                    'setFeatured response did not include the expected data.media payload'
                );
            }
            return media;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: commerceMediaQueryKeys.list(vertical, entityId)
            });
        }
    });
}
