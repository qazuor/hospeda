/**
 * useAccommodationMedia — TanStack Query hooks for granular gallery CRUD on
 * the relational `accommodation_media` table (SPEC-204).
 *
 * Exposes:
 *  - useAccommodationMediaList(accommodationId)        → list query (GET)
 *  - useAccommodationMediaAdd(accommodationId)         → add mutation (POST)
 *  - useAccommodationMediaRemove(accommodationId)      → remove mutation (DELETE)
 *  - useAccommodationMediaSetFeatured(accommodationId) → set-featured mutation (PUT)
 *
 * All mutations invalidate the list query on success via the shared query key
 * factory. Reorder is intentionally omitted — admin decided no drag/reorder
 * in the admin gallery UI (SPEC-204 locked decision).
 *
 * Response envelope shape (mirrors the FAQ endpoints):
 *   GET  → { success: true, data: { media: AccommodationMedia[] } }
 *   POST → { success: true, data: { media: AccommodationMedia } }
 *   PUT  → { success: true, data: { media: AccommodationMedia } }
 */

import { fetchApi } from '@/lib/api/client';
import type { AccommodationMedia, AccommodationMediaAddPayload } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Centralised query key factory for accommodation media queries.
 * Using a factory keeps all invalidations consistent and avoids typo-driven
 * stale-data bugs.
 */
export const accommodationMediaQueryKeys = {
    all: (accommodationId: string) => ['accommodationMedia', accommodationId] as const,
    list: (accommodationId: string) =>
        [...accommodationMediaQueryKeys.all(accommodationId), 'list'] as const
};

// ---------------------------------------------------------------------------
// Endpoint helper
// ---------------------------------------------------------------------------

const mediaEndpoint = (accommodationId: string) =>
    `/api/v1/admin/accommodations/${accommodationId}/media`;

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

/**
 * Fetches the list of visible media rows for a given accommodation.
 *
 * The endpoint defaults to `state=visible` when no filter is supplied, which
 * is what the GalleryManager always uses (archive management is out of scope
 * for the admin panel's gallery tab).
 *
 * @param accommodationId - UUID of the accommodation.
 */
export function useAccommodationMediaList(accommodationId: string) {
    return useQuery({
        queryKey: accommodationMediaQueryKeys.list(accommodationId),
        queryFn: async () => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(accommodationId)}?state=visible`
            });
            // API returns { success: true, data: { media: AccommodationMedia[] } }
            const body = response.data as { data?: { media?: AccommodationMedia[] } };
            return body.data?.media ?? [];
        },
        enabled: Boolean(accommodationId),
        staleTime: 2 * 60 * 1000
    });
}

// ---------------------------------------------------------------------------
// Add mutation
// ---------------------------------------------------------------------------

/**
 * Mutation to add a new photo to the accommodation gallery.
 *
 * The caller must first upload the file via `uploadEntityImage.mutateAsync`
 * (from `useMediaUpload`) to get the `{ url, publicId }` pair, then pass
 * both to this mutation as part of the `AccommodationMediaAddPayload`.
 *
 * On success the list query is invalidated so the UI refetches the updated
 * gallery from the server.
 *
 * @param accommodationId - UUID of the accommodation.
 */
export function useAccommodationMediaAdd(accommodationId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: AccommodationMediaAddPayload) => {
            const response = await fetchApi<unknown>({
                path: mediaEndpoint(accommodationId),
                method: 'POST',
                body: payload
            });
            const body = response.data as { data?: { media?: AccommodationMedia } };
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
                queryKey: accommodationMediaQueryKeys.list(accommodationId)
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
 * @param accommodationId - UUID of the accommodation.
 */
export function useAccommodationMediaRemove(accommodationId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mediaId }: { readonly mediaId: string }) => {
            await fetchApi({
                path: `${mediaEndpoint(accommodationId)}/${mediaId}`,
                method: 'DELETE'
            });
            return mediaId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: accommodationMediaQueryKeys.list(accommodationId)
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
 * @param accommodationId - UUID of the accommodation.
 */
export function useAccommodationMediaSetFeatured(accommodationId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mediaId }: { readonly mediaId: string }) => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(accommodationId)}/${mediaId}/featured`,
                method: 'PUT'
            });
            const body = response.data as { data?: { media?: AccommodationMedia } };
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
                queryKey: accommodationMediaQueryKeys.list(accommodationId)
            });
        }
    });
}
