/**
 * @file use-patch-user.ts
 * @description Mutation hook for PATCHing the authenticated user's own profile (SPEC-243 T-050/T-051).
 *
 * Endpoint: PATCH /api/v1/protected/users/:id
 *
 * Body allowlist (from apps/api/src/routes/user/protected/patch.ts):
 *   - `displayName`, `firstName`, `lastName`, `image`
 *   - `contactInfo` (nested object — only `mobilePhone` used here)
 *   - `location` (nested object — city / province / country)
 *   - `settings` (restricted to UserSettingsWebPatchSchema: notifications, themeWeb, languageWeb, newsletter)
 *
 * Uses `apiFetch` directly with a dynamic path (same pattern as
 * `use-patch-accommodation.ts`) instead of the static-path `useApiMutation`.
 *
 * On success, invalidates the self-profile query so the UI reflects fresh data.
 *
 * @module lib/api/hooks/use-patch-user
 */

import { InternationalPhoneRegex, UserSelfSchema } from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../client';
import { selfProfileKeys } from './use-self-profile';

// ---------------------------------------------------------------------------
// Patch body schema (mobile subset of UserProtectedPatchInputSchema)
// ---------------------------------------------------------------------------

/**
 * Schema for the notification toggles sub-object accepted by the PATCH endpoint.
 * Must match `UserNotificationsSchema` in `@repo/schemas`.
 */
const NotificationsPatchSchema = z.object({
    enabled: z.boolean().optional(),
    allowPush: z.boolean().optional(),
    allowEmails: z.boolean().optional(),
    allowSms: z.boolean().optional()
});

/**
 * Schema for the location sub-object passed in the PATCH body.
 * Mirrors the fields from `UserLocationSchema` that the mobile form edits.
 * Note: `UserLocationSchema` uses `region` (not `province`) as the sub-region field.
 */
const LocationPatchSchema = z.object({
    city: z.string().optional(),
    region: z.string().optional(),
    country: z.string().optional()
});

/**
 * Schema for the contactInfo sub-object passed in the PATCH body.
 * The API stores phone under `contactInfo.mobilePhone`.
 * Validates against the canonical {@link InternationalPhoneRegex} so invalid
 * formats (e.g. hyphenated) are caught client-side before reaching the server.
 */
const ContactInfoPatchSchema = z.object({
    mobilePhone: z
        .string()
        .regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.mobilePhone.international'
        })
        .optional()
});

/**
 * Mobile-scoped PATCH body schema.
 *
 * Matches the allowlist defined in
 * `apps/api/src/routes/user/protected/patch.ts` (`UserProtectedPatchInputSchema`).
 * All fields are optional (it's a PATCH).
 */
export const UserPatchBodySchema = z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    displayName: z.string().min(2).max(50).optional(),
    contactInfo: ContactInfoPatchSchema.optional(),
    location: LocationPatchSchema.optional(),
    settings: z
        .object({
            notifications: NotificationsPatchSchema.optional()
        })
        .optional()
});

/** Inferred type for the PATCH body. */
export type UserPatchBody = z.infer<typeof UserPatchBodySchema>;

// ---------------------------------------------------------------------------
// Mutation variables
// ---------------------------------------------------------------------------

/** Variables passed to `mutation.mutate(vars)`. */
export interface PatchUserVariables {
    /** Authenticated user UUID. */
    readonly id: string;
    /** Partial fields to update. */
    readonly body: UserPatchBody;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Mutation hook for partially updating the authenticated user's profile.
 *
 * Calls `PATCH /api/v1/protected/users/:id` with a mobile-scoped body.
 * On success, invalidates the self-profile query so stale data is refreshed.
 *
 * @returns TanStack `UseMutationResult<UserSelf, Error, PatchUserVariables>`.
 *
 * @example
 * ```ts
 * const mutation = usePatchUser();
 * mutation.mutate({
 *   id: session.user.id,
 *   body: {
 *     firstName: 'Juan',
 *     contactInfo: { mobilePhone: '+54 11 12345678' },
 *     location: { city: 'Concepción del Uruguay', country: 'Argentina' },
 *   },
 * });
 * ```
 */
export function usePatchUser(): UseMutationResult<
    z.infer<typeof UserSelfSchema>,
    Error,
    PatchUserVariables
> {
    const queryClient = useQueryClient();

    return useMutation<z.infer<typeof UserSelfSchema>, Error, PatchUserVariables>({
        mutationFn: async ({ id, body }: PatchUserVariables) => {
            const { data } = await apiFetch({
                path: `/api/v1/protected/users/${id}`,
                method: 'PATCH',
                body,
                schema: UserSelfSchema
            });
            return data;
        },
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: selfProfileKeys.detail(variables.id)
            });
        }
    });
}
