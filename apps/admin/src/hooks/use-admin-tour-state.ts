/**
 * useAdminTourState — client-side persistence layer for admin tour seen-state.
 *
 * This hook is the **mandatory** data layer for all tour seen-state reads and
 * writes in the admin panel. Do NOT bypass it with an independent fetch or by
 * reusing the dead admin-tier hooks `useUserProfile` / `useUpdateUserSettings`
 * (those routes require `MANAGE_USERS` / `USER_READ_ALL` which HOST and EDITOR
 * do not hold — see SPEC-174 §4).
 *
 * Internals:
 * - `useQuery(['user', 'settings', userId])` → `GET /api/v1/protected/users/{userId}`
 *   Returns the actor's own `UserProtected` record including the `settings` field.
 *   The query is owner-scoped (host/editor can read their own record via the
 *   protected GET endpoint, which enforces `actor.id === param.id` ownership).
 * - `useMutation` → `PATCH /api/v1/protected/users/me/tour-progress`
 *   Writes `{ tourId, version }` with an optimistic update on the cached settings
 *   (`adminTours[tourId] = version`) before the server confirms. Rolls back on
 *   error and invalidates the query on settle.
 *
 * Important constraints (SPEC-174 §7.5, §4):
 * - MUST NOT use `useUserProfile` or `useUpdateUserSettings` — those are the
 *   dead admin-tier hooks that do not work for HOST/EDITOR roles.
 * - The query key `['user', 'settings', userId]` ensures cache isolation per
 *   user and is automatically evicted when the user changes.
 *
 * @module use-admin-tour-state
 * @see packages/schemas/src/entities/user/user.settings.schema.ts — UserSettings type
 * @see apps/api/src/routes/user/protected/tourProgress.ts — PATCH endpoint
 * @see SPEC-174 §7.5, §6.4
 */

import { fetchApi } from '@/lib/api/client';
import type { TourProgressBody, UserProtected, UserSettings } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthContext } from './use-auth-context';

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

/** Envelope returned by GET /api/v1/protected/users/{id}. */
interface UserSettingsApiResponse {
    readonly success: boolean;
    readonly data: UserProtected | null;
}

/** Envelope returned by PATCH .../me/tour-progress. */
interface TourProgressApiResponse {
    readonly success: boolean;
    readonly data: { readonly success: boolean };
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Query key factory for the admin tour state hook.
 * The `userId` segment ensures cache isolation per user.
 * The `'settings'` segment allows selective invalidation of settings-related queries.
 */
export const adminTourStateQueryKeys = {
    settings: (userId: string) => ['user', 'settings', userId] as const
} as const;

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

/**
 * Mutation input for `markSeen`.
 */
export interface MarkSeenInput {
    /** Catalog id of the tour being acknowledged (e.g. `'host.welcome'`). */
    readonly tourId: string;
    /** Config version of the tour being acknowledged (positive integer). */
    readonly version: number;
}

/**
 * Return shape of `useAdminTourState()`.
 *
 * All fields are `readonly` — callers must not mutate them. State changes
 * go through `markSeen`.
 */
export interface UseAdminTourStateReturn {
    /**
     * `true` while the initial settings query is in flight.
     * Components should gate tour auto-trigger logic behind `!isLoaded`.
     */
    readonly isLoading: boolean;

    /**
     * Non-null when the query or mutation has failed.
     */
    readonly error: Error | null;

    /**
     * Returns `true` when the stored seenVersion for `tourId` is greater
     * than or equal to the given `version`. A stored version higher than
     * `version` is also treated as "seen" (the user already acknowledged a
     * newer tour — no re-offer).
     *
     * Returns `false` when:
     * - The tour has never been acknowledged (absent from the map).
     * - The stored version is strictly lower than the given `version`
     *   (i.e. the config was bumped and the tour should be re-offered).
     *
     * @param tourId - Catalog id of the tour to check.
     * @param version - Config version to compare against.
     *
     * @example
     * ```ts
     * // Tour not yet seen → false
     * hasSeen({ tourId: 'host.welcome', version: 1 }) // false
     *
     * // Tour seen at v1, config still at v1 → true
     * hasSeen({ tourId: 'host.welcome', version: 1 }) // true
     *
     * // Tour seen at v1, config bumped to v2 → false (re-offer)
     * hasSeen({ tourId: 'host.welcome', version: 2 }) // false
     * ```
     */
    readonly hasSeen: (input: { tourId: string; version: number }) => boolean;

    /**
     * Marks a tour as seen at the given config version.
     *
     * Applies an optimistic update immediately (writes `adminTours[tourId] = version`
     * on the cached settings) then sends the PATCH request. The update is
     * rolled back automatically if the mutation fails.
     *
     * This function fires on **finish OR skip** of a tour — the version stored
     * is the one that was shown, not `version+1`.
     *
     * @param input - `{ tourId, version }` — the tour catalog id and config version.
     */
    readonly markSeen: (input: MarkSeenInput) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the `adminTours` map from a potentially null/undefined settings
 * object, returning an empty record when the key is absent.
 *
 * @param settings - The raw `UserSettings` value from the API response.
 * @returns The `adminTours` record or an empty object.
 */
function extractAdminTours(settings: UserSettings | null | undefined): Record<string, number> {
    return (settings?.onboarding?.adminTours as Record<string, number> | undefined) ?? {};
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current tour seen-state and mutation functions for marking
 * tours as seen.
 *
 * Must be used inside a component that is a descendant of both
 * `QueryClientProvider` and the `AuthContext` provider (the `_authed` guard
 * tree satisfies this). Calling this hook outside those providers throws.
 *
 * @returns {@link UseAdminTourStateReturn} — reactive state + actions.
 *
 * @example
 * ```tsx
 * function TourAutoTrigger() {
 *   const { isLoading, hasSeen, markSeen } = useAdminTourState();
 *   const tourVersion = 1;
 *
 *   useEffect(() => {
 *     if (isLoading) return;
 *     if (!hasSeen({ tourId: 'host.welcome', version: tourVersion })) {
 *       startTour({ tourId: 'host.welcome' });
 *     }
 *   }, [isLoading, hasSeen]);
 *
 *   // On tour finish or skip:
 *   // markSeen({ tourId: 'host.welcome', version: tourVersion });
 * }
 * ```
 */
export function useAdminTourState(): UseAdminTourStateReturn {
    const { user } = useAuthContext();
    const userId = user?.id ?? '';
    const queryClient = useQueryClient();
    const queryKey = adminTourStateQueryKeys.settings(userId);

    // -------------------------------------------------------------------------
    // Query — GET /api/v1/protected/users/{userId}
    // -------------------------------------------------------------------------

    const { data, isLoading, error } = useQuery({
        queryKey,
        queryFn: async (): Promise<UserProtected | null> => {
            const response = await fetchApi<UserSettingsApiResponse>({
                path: `/api/v1/protected/users/${userId}`
            });
            return response.data.data;
        },
        // Only fetch when we have a real authenticated user.
        enabled: Boolean(userId),
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });

    // -------------------------------------------------------------------------
    // Mutation — PATCH /api/v1/protected/users/me/tour-progress
    // -------------------------------------------------------------------------

    const { mutate } = useMutation<
        TourProgressApiResponse,
        Error,
        MarkSeenInput,
        { previous: UserProtected | null | undefined }
    >({
        mutationFn: async (input: MarkSeenInput): Promise<TourProgressApiResponse> => {
            const body: TourProgressBody = {
                tourId: input.tourId,
                version: input.version
            };
            const response = await fetchApi<TourProgressApiResponse>({
                path: '/api/v1/protected/users/me/tour-progress',
                method: 'PATCH',
                body
            });
            return response.data;
        },

        // Optimistic update: set adminTours[tourId] = version in the cached settings.
        onMutate: async (input: MarkSeenInput) => {
            // Cancel any in-flight queries to avoid overwriting the optimistic state.
            await queryClient.cancelQueries({ queryKey });

            const previous = queryClient.getQueryData<UserProtected | null>(queryKey);

            if (previous) {
                const currentAdminTours = extractAdminTours(previous.settings);
                const updatedAdminTours = {
                    ...currentAdminTours,
                    [input.tourId]: input.version
                };
                const updatedSettings: UserSettings = {
                    ...previous.settings,
                    onboarding: {
                        ...(previous.settings?.onboarding ?? {}),
                        adminTours: updatedAdminTours
                    }
                };
                queryClient.setQueryData<UserProtected | null>(queryKey, {
                    ...previous,
                    settings: updatedSettings
                });
            }

            return { previous };
        },

        // On error: roll back to the snapshot captured in onMutate.
        onError: (_err, _input, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData<UserProtected | null>(queryKey, context.previous);
            }
        },

        // On settle (success or error): invalidate so the server state is re-fetched.
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Returns true when the stored seenVersion >= the given version.
     * Missing entry (never seen) returns false.
     *
     * Memoized on `data` so consumers (TourAutoTrigger's effect deps,
     * useWelcomeTourPending's useMemo) only re-evaluate when the settings
     * actually change, not on every render.
     */
    const hasSeen = useCallback(
        ({ tourId, version }: { tourId: string; version: number }): boolean => {
            const adminTours = extractAdminTours(data?.settings);
            const seenVersion = adminTours[tourId];
            if (seenVersion === undefined) return false;
            return seenVersion >= version;
        },
        [data]
    );

    /**
     * Marks a tour as seen at the given config version, applying an optimistic update.
     */
    const markSeen = (input: MarkSeenInput): void => {
        mutate(input);
    };

    return {
        isLoading,
        error: error as Error | null,
        hasSeen,
        markSeen
    };
}
