/**
 * @file use-patch-accommodation.ts
 * @description Hook for PATCHing operational fields on a host's own accommodation
 * (SPEC-243 T-042).
 *
 * Endpoint: PATCH /api/v1/protected/accommodations/:id
 * Body: Partial<AccommodationUpdateHttp> (operational fields only — contact, social,
 *       summary, description).
 * Response: AccommodationProtected
 *
 * NOTE: openingHours is intentionally excluded from the editable fields.
 * TODO(SPEC-243 T-042): schedule editor — openingHours maps through extraInfo,
 *   confirm mapper before adding.
 *
 * @module lib/api/hooks/use-patch-accommodation
 */
import { AccommodationProtectedSchema, AccommodationUpdateHttpSchema } from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import type { z } from 'zod';
import { apiFetch } from '../client';
import { hostDashboardQueryKey } from './use-host-dashboard';
import { ownAccommodationKeys } from './use-own-accommodations';

// ---------------------------------------------------------------------------
// Operational fields schema — only the fields exposed by the mobile edit form
// ---------------------------------------------------------------------------

/**
 * Schema for the operational fields the mobile edit form can update.
 *
 * Restricts `AccommodationUpdateHttpSchema` to the flat contact / social /
 * summary / description fields that don't require the schedule editor.
 * All fields are optional (it's a PATCH).
 */
export const AccommodationOperationalUpdateSchema = AccommodationUpdateHttpSchema.partial().pick({
    // Contact
    phone: true,
    email: true,
    website: true,
    // Social
    twitter: true,
    facebook: true,
    instagram: true,
    linkedin: true,
    tiktok: true,
    youtube: true,
    // Description
    summary: true,
    description: true
});

export type AccommodationOperationalUpdate = z.infer<typeof AccommodationOperationalUpdateSchema>;

// ---------------------------------------------------------------------------
// Input type for the mutation variable
// ---------------------------------------------------------------------------

/** Variables passed to `mutation.mutate(vars)`. */
export interface PatchAccommodationVariables {
    /** Accommodation UUID. */
    readonly id: string;
    /** Partial operational fields to update. */
    readonly body: AccommodationOperationalUpdate;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Mutation hook for partially updating a host's own accommodation (operational
 * fields only: contact, social networks, summary, description).
 *
 * Uses a dynamic path (`/api/v1/protected/accommodations/:id`) built from the
 * mutation variables, so `apiFetch` is called directly rather than via the
 * static-path `useApiMutation` helper.
 *
 * On success, invalidates the detail and list queries so stale data is refreshed.
 *
 * @returns TanStack `UseMutationResult<AccommodationProtected, Error, PatchAccommodationVariables>`.
 *
 * @example
 * ```ts
 * const mutation = usePatchAccommodation();
 * mutation.mutate({
 *   id: 'abc-123',
 *   body: { phone: '+54 11 1234-5678', summary: 'Nuevo resumen' },
 * });
 * ```
 */
export function usePatchAccommodation(): UseMutationResult<
    z.infer<typeof AccommodationProtectedSchema>,
    Error,
    PatchAccommodationVariables
> {
    const queryClient = useQueryClient();

    return useMutation<
        z.infer<typeof AccommodationProtectedSchema>,
        Error,
        PatchAccommodationVariables
    >({
        mutationFn: async ({ id, body }: PatchAccommodationVariables) => {
            const { data } = await apiFetch({
                path: `/api/v1/protected/accommodations/${id}`,
                method: 'PATCH',
                body,
                schema: AccommodationProtectedSchema
            });
            return data;
        },
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: ownAccommodationKeys.detail(variables.id)
            });
            void queryClient.invalidateQueries({
                queryKey: ownAccommodationKeys.lists()
            });
            void queryClient.invalidateQueries({
                queryKey: hostDashboardQueryKey
            });
        }
    });
}
