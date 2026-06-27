/**
 * @file use-self-profile.ts
 * @description Hook for fetching the authenticated user's own profile (SPEC-243 T-050).
 *
 * Endpoint: GET /api/v1/protected/users/:id
 * Response: UserSelfSchema — includes contactInfo, location, socialNetworks, settings.
 *
 * `UserSelfSchema` is available from `@repo/schemas` (re-exported via
 * user.access.schema.ts → entities/user/index.ts → packages/schemas/src/index.ts).
 *
 * @module lib/api/hooks/use-self-profile
 */

import { UserSelfSchema } from '@repo/schemas';
import type { z } from 'zod';
import { useApiQuery } from '../use-api-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the authenticated user's own profile as returned by the API. */
export type UserSelf = z.infer<typeof UserSelfSchema>;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/**
 * TanStack Query key factory for the self-profile query.
 *
 * Using a factory allows easy targeted invalidation from `usePatchUser`.
 */
export const selfProfileKeys = {
    all: ['user', 'self'] as const,
    detail: (id: string) => ['user', 'self', id] as const
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches the full profile for the authenticated user.
 *
 * Calls `GET /api/v1/protected/users/:id` which returns `UserSelfSchema` —
 * the self-scoped response that includes `contactInfo`, `location`, and
 * `socialNetworks` JSONB blobs needed by the profile edit form.
 *
 * The query is disabled when `userId` is falsy (e.g. session not yet loaded).
 *
 * @param userId - The authenticated user's id (from `useSession().data.user.id`).
 * @returns TanStack `UseQueryResult<UserSelf>`.
 *
 * @example
 * ```ts
 * const { data: session } = useSession();
 * const { data, isLoading, error } = useSelfProfile(session?.user.id ?? '');
 * if (data) {
 *   console.log(data.contactInfo?.mobilePhone, data.location?.city);
 * }
 * ```
 */
export function useSelfProfile(userId: string) {
    return useApiQuery({
        queryKey: selfProfileKeys.detail(userId),
        path: `/api/v1/protected/users/${userId}`,
        schema: UserSelfSchema.nullable(),
        enabled: Boolean(userId),
        staleTime: 2 * 60 * 1000 // 2 minutes — profile data is relatively stable
    });
}
