/**
 * useContentMedia — TanStack Query hooks for granular gallery CRUD on the
 * relational `post_media` / `event_media` tables (HOS-390).
 *
 * Entity-agnostic: every hook takes an `entity` argument (`'post'` or
 * `'event'`) and resolves the correct admin endpoint from it. Direct port of
 * `useCommerceMedia` (HOS-382), which does the same for the two commerce
 * verticals. `post_media` and `event_media` share a row shape, so one hook
 * file serves both rather than duplicating per entity.
 *
 * Exposes:
 *  - useContentMediaList(entity, entityId)        → list query (GET)
 *  - useContentMediaAdd(entity, entityId)         → add mutation (POST)
 *  - useContentMediaRemove(entity, entityId)      → remove mutation (DELETE)
 *  - useContentMediaSetFeatured(entity, entityId) → set-featured mutation (PUT)
 *
 * All mutations invalidate the list query on success via the shared query key
 * factory. Reorder is intentionally omitted, mirroring the accommodation
 * and commerce gallery precedent (SPEC-204 locked decision: no drag/reorder in
 * the admin gallery UI). Archive/restore are also omitted — the admin API
 * exposes no archive/restore routes for `post_media` / `event_media` (see
 * `apps/api/src/routes/post/admin/` and `apps/api/src/routes/event/admin/` —
 * only get/add/remove/setFeatured/reorder exist, and reorder is deliberately
 * unused here too).
 *
 * Response envelope shape (mirrors the accommodation media endpoints):
 *   GET  → { success: true, data: { media: ContentMedia[] } }
 *   POST → { success: true, data: { media: ContentMedia } }
 *   PUT  → { success: true, data: { media: ContentMedia } }
 */

import type {
    EventMedia,
    EventMediaAddPayload,
    PostMedia,
    PostMediaAddPayload
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Editorial entities whose gallery is managed via the relational media tables. */
export type ContentMediaEntity = 'post' | 'event';

/**
 * A single gallery photo row, from either editorial entity.
 *
 * `PostMedia` and `EventMedia` differ only in their parent FK field
 * (`postId` vs `eventId`) — every field the UI reads (`id`, `url`,
 * `isFeatured`, `caption`, `alt`, `state`, `sortOrder`, …) is shared via
 * `BaseContentMediaSchema`, so a union is safe to consume here.
 */
export type ContentMedia = PostMedia | EventMedia;

/**
 * Payload for adding a single photo to a post or event gallery.
 * Identical shape across both entities (both alias the same base payload).
 */
export type ContentMediaAddPayload = PostMediaAddPayload | EventMediaAddPayload;

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Centralised query key factory for content media queries.
 * Using a factory keeps all invalidations consistent and avoids typo-driven
 * stale-data bugs.
 */
export const contentMediaQueryKeys = {
    all: (entity: ContentMediaEntity, entityId: string) =>
        ['contentMedia', entity, entityId] as const,
    list: (entity: ContentMediaEntity, entityId: string) =>
        [...contentMediaQueryKeys.all(entity, entityId), 'list'] as const
};

// ---------------------------------------------------------------------------
// Endpoint helper
// ---------------------------------------------------------------------------

/** Maps the singular entity name to its plural admin route segment. */
const ENTITY_ROUTE_SEGMENT: Record<ContentMediaEntity, string> = {
    post: 'posts',
    event: 'events'
};

const mediaEndpoint = (entity: ContentMediaEntity, entityId: string) =>
    `/api/v1/admin/${ENTITY_ROUTE_SEGMENT[entity]}/${entityId}/media`;

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

/**
 * Fetches the list of visible media rows for a given post or event.
 *
 * The endpoint defaults to `state=visible` when no filter is supplied, which
 * is what `ContentGalleryManager` always uses (archive management is out of
 * scope for the admin panel's gallery tab — see module docs above).
 *
 * @param entity - `'post'` or `'event'`.
 * @param entityId - UUID of the post or event.
 */
export function useContentMediaList(entity: ContentMediaEntity, entityId: string) {
    return useQuery({
        queryKey: contentMediaQueryKeys.list(entity, entityId),
        queryFn: async () => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(entity, entityId)}?state=visible`
            });
            // API returns { success: true, data: { media: ContentMedia[] } }
            const body = response.data as { data?: { media?: ContentMedia[] } };
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
 * Mutation to add a new photo to a post or event gallery.
 *
 * The caller must first upload the file via `uploadEntityImage.mutateAsync`
 * (from `useMediaUpload`) to get the `{ url, publicId }` pair, then pass
 * both to this mutation as part of the `ContentMediaAddPayload`.
 *
 * On success the list query is invalidated so the UI refetches the updated
 * gallery from the server.
 *
 * @param entity - `'post'` or `'event'`.
 * @param entityId - UUID of the post or event.
 */
export function useContentMediaAdd(entity: ContentMediaEntity, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: ContentMediaAddPayload) => {
            const response = await fetchApi<unknown>({
                path: mediaEndpoint(entity, entityId),
                method: 'POST',
                body: payload
            });
            const body = response.data as { data?: { media?: ContentMedia } };
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
                queryKey: contentMediaQueryKeys.list(entity, entityId)
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
 * @param entity - `'post'` or `'event'`.
 * @param entityId - UUID of the post or event.
 */
export function useContentMediaRemove(entity: ContentMediaEntity, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mediaId }: { readonly mediaId: string }) => {
            await fetchApi({
                path: `${mediaEndpoint(entity, entityId)}/${mediaId}`,
                method: 'DELETE'
            });
            return mediaId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: contentMediaQueryKeys.list(entity, entityId)
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
 * @param entity - `'post'` or `'event'`.
 * @param entityId - UUID of the post or event.
 */
export function useContentMediaSetFeatured(entity: ContentMediaEntity, entityId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mediaId }: { readonly mediaId: string }) => {
            const response = await fetchApi<unknown>({
                path: `${mediaEndpoint(entity, entityId)}/${mediaId}/featured`,
                method: 'PUT'
            });
            const body = response.data as { data?: { media?: ContentMedia } };
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
                queryKey: contentMediaQueryKeys.list(entity, entityId)
            });
        }
    });
}
