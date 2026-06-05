/**
 * useWhatsNew — single source of truth for all What's New surfaces.
 *
 * This hook is the **mandatory** data layer for every What's New UI surface in
 * the admin panel (modal, topbar badge, panel, dashboard card). Bypassing it
 * with an independent fetch is explicitly forbidden by SPEC-175 §7.1 / D10.
 *
 * Internals:
 * - `useQuery(['whats-new', userId])` → GET /api/v1/protected/whats-new
 *   Returns role-filtered, locale-resolved, newest-first items + unseenCount.
 * - `useMutation` → PATCH /api/v1/protected/users/me/whats-new-seen
 *   Applies an optimistic update on `items[*].seen` + `unseenCount` before
 *   the server confirms. Rolls back on error and invalidates the query on settle.
 *
 * Important constraints (SPEC-175 §2.3, §7.1):
 * - MUST NOT use `useUserProfile` or `useUpdateUserSettings` — those are the
 *   dead admin-tier hooks that do not work for HOST/EDITOR roles.
 * - The query key includes `userId` so data is isolated per user and is
 *   automatically evicted when the user changes.
 *
 * @module use-whats-new
 * @see packages/schemas/src/entities/whats-new/whats-new.http.schema.ts — types
 * @see apps/admin/src/lib/whats-new/has-unseen-highlights.ts              — helper
 * @see SPEC-175 §7.1, §12.4
 */

import { fetchApi } from '@/lib/api/client';
import type { WhatsNewGetResponse, WhatsNewItem, WhatsNewSeenBody } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from './use-auth-context';

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

/** Envelope returned by the protected GET endpoint. */
interface WhatsNewApiResponse {
    readonly success: boolean;
    readonly data: WhatsNewGetResponse;
}

/** Envelope returned by the PATCH seen endpoint. */
interface WhatsNewSeenApiResponse {
    readonly success: boolean;
    readonly data: { readonly success: boolean };
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Query key factory for the What's New hook.
 * The `userId` segment ensures cache isolation per user.
 */
export const whatsNewQueryKeys = {
    all: (userId: string) => ['whats-new', userId] as const
} as const;

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

/**
 * Return shape of `useWhatsNew()`.
 *
 * All fields are `readonly` — callers must not mutate them. State changes go
 * through `markSeen` / `markAllSeen`.
 */
export interface UseWhatsNewReturn {
    /** Role-filtered, locale-resolved, newest-first list of applicable entries. */
    readonly items: readonly WhatsNewItem[];
    /** Number of items where `seen === false`. Kept in sync optimistically. */
    readonly unseenCount: number;
    /** `true` while the initial query is in flight. */
    readonly isLoading: boolean;
    /** Non-null when the query or mutation has failed. */
    readonly error: Error | null;
    /**
     * Marks the given entry ids as seen.
     *
     * Applies an optimistic update immediately (decrements `unseenCount` and
     * flips `seen` on matching items) then sends the PATCH request. The update
     * is rolled back automatically if the mutation fails.
     *
     * @param ids - Array of entry ids to mark as seen. Must be non-empty.
     */
    readonly markSeen: (ids: string[]) => void;
    /**
     * Marks ALL currently unseen applicable entries as seen.
     *
     * Derives the unseen ids from `items` and delegates to `markSeen`.
     * No-op when `unseenCount === 0`.
     */
    readonly markAllSeen: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns live What's New data and mutation functions for marking entries seen.
 *
 * Must be used inside a component that is a descendant of both
 * `QueryClientProvider` and the `AuthContext` provider (the `_authed` guard
 * tree satisfies this). Calling this hook outside those providers throws.
 *
 * @returns {@link UseWhatsNewReturn} — reactive state + actions.
 *
 * @example
 * ```tsx
 * function WhatsNewBadge() {
 *   const { unseenCount } = useWhatsNew();
 *   if (unseenCount === 0) return null;
 *   return <span>{unseenCount}</span>;
 * }
 * ```
 */
export function useWhatsNew(): UseWhatsNewReturn {
    const { user } = useAuthContext();
    const userId = user?.id ?? '';
    const queryClient = useQueryClient();
    const queryKey = whatsNewQueryKeys.all(userId);

    // -------------------------------------------------------------------------
    // Query
    // -------------------------------------------------------------------------

    const { data, isLoading, error } = useQuery({
        queryKey,
        queryFn: async (): Promise<WhatsNewGetResponse> => {
            const response = await fetchApi<WhatsNewApiResponse>({
                path: '/api/v1/protected/whats-new'
            });
            return response.data.data;
        },
        // Only fetch when we have a real authenticated user.
        enabled: Boolean(userId),
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });

    const items: readonly WhatsNewItem[] = data?.items ?? [];
    const unseenCount: number = data?.unseenCount ?? 0;

    // -------------------------------------------------------------------------
    // Mutation — mark seen
    // -------------------------------------------------------------------------

    const { mutate } = useMutation<
        WhatsNewSeenApiResponse,
        Error,
        string[],
        { previous: WhatsNewGetResponse | undefined }
    >({
        mutationFn: async (ids: string[]): Promise<WhatsNewSeenApiResponse> => {
            const body: WhatsNewSeenBody = { ids };
            const response = await fetchApi<WhatsNewSeenApiResponse>({
                path: '/api/v1/protected/users/me/whats-new-seen',
                method: 'PATCH',
                body
            });
            return response.data;
        },

        // Optimistic update: flip seen on matching items + recompute unseenCount.
        onMutate: async (ids: string[]) => {
            // Cancel any in-flight queries to avoid overwriting the optimistic state.
            await queryClient.cancelQueries({ queryKey });

            const previous = queryClient.getQueryData<WhatsNewGetResponse>(queryKey);

            if (previous) {
                const idSet = new Set(ids);
                const updatedItems = previous.items.map((item) =>
                    idSet.has(item.id) ? { ...item, seen: true } : item
                );
                const updatedUnseenCount = updatedItems.filter((item) => !item.seen).length;

                queryClient.setQueryData<WhatsNewGetResponse>(queryKey, {
                    items: updatedItems,
                    unseenCount: updatedUnseenCount
                });
            }

            return { previous };
        },

        // On error: roll back to the snapshot captured in onMutate.
        onError: (_err, _ids, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData<WhatsNewGetResponse>(queryKey, context.previous);
            }
        },

        // On settle (success or error): invalidate so the server state is re-fetched.
        // Also invalidate the dashboard source cache (`whats-new.recent`) so the
        // dashboard card reflects the updated seen state (SPEC-175 T-016 note).
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
            // Prefix invalidation matches all ['dashboard', 'whats-new.recent', ...]
            // query keys registered by the dashboard source (any role / scope).
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'whats-new.recent'] });
        }
    });

    // -------------------------------------------------------------------------
    // Public actions
    // -------------------------------------------------------------------------

    /**
     * Marks specific entry ids as seen, applying an optimistic update.
     * Calls are no-ops when `ids` is empty (nothing to mark).
     */
    const markSeen = (ids: string[]): void => {
        if (ids.length === 0) return;
        mutate(ids);
    };

    /**
     * Marks all currently unseen entries as seen.
     * Derives unseen ids from the local `items` snapshot.
     */
    const markAllSeen = (): void => {
        const unseenIds = items.filter((item) => !item.seen).map((item) => item.id);
        if (unseenIds.length === 0) return;
        mutate(unseenIds);
    };

    return {
        items,
        unseenCount,
        isLoading,
        error: error as Error | null,
        markSeen,
        markAllSeen
    };
}
