/**
 * TanStack Query hooks for a user's multi-role set (HOS-296).
 *
 * - `useUserRoles` — GET the held roles with their grant provenance.
 * - `useGrantUserRole` — POST a role (additive; never replaces another).
 * - `useRevokeUserRole` — DELETE a role.
 *
 * Modelled on `useUserPermissionOverrides` deliberately: role changes are the
 * same class of security-sensitive mutation as permission overrides, so they
 * follow the same rules — no optimistic updates, invalidate on success and let
 * the server be the source of truth for the resulting set.
 *
 * @module features/users/hooks/useUserRoles
 */

import type { RoleEnum, UserRoleGrantsResponse, UserRoleMutationResponse } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

const API_PATH = '/api/v1/admin/users';

/** Query keys for per-user role operations. */
export const userRoleKeys = {
    all: ['user-roles'] as const,
    detail: (userId: string) => [...userRoleKeys.all, userId] as const
};

/** Payload accepted by {@link useGrantUserRole}. */
export interface GrantUserRoleInput {
    readonly role: RoleEnum;
    /** Operator justification, written to the audit row. */
    readonly reason?: string;
}

/** Payload accepted by {@link useRevokeUserRole}. */
export interface RevokeUserRoleInput {
    readonly role: RoleEnum;
    /** Operator justification, written to the audit row. */
    readonly reason?: string;
}

/**
 * Reads the roles a user holds, each with when it was granted and by whom.
 *
 * @param userId - User whose hats to read.
 * @returns TanStack Query result over {@link UserRoleGrantsResponse}.
 */
async function fetchUserRoles(userId: string): Promise<UserRoleGrantsResponse> {
    // `/role-grants`, NOT `/roles`: the API keeps the read on its own path so
    // it is gated on `USER_READ_ALL` alone. Route middlewares are registered
    // per path and are method-agnostic, so sharing `/roles` with the POST would
    // additionally demand `USER_UPDATE_ROLES` — which `CLIENT_MANAGER` does not
    // hold.
    const result = await fetchApi<{ success: boolean; data: UserRoleGrantsResponse }>({
        path: `${API_PATH}/${userId}/role-grants`
    });
    return result.data.data;
}

async function grantUserRole(
    userId: string,
    input: GrantUserRoleInput
): Promise<UserRoleMutationResponse> {
    const result = await fetchApi<{ success: boolean; data: UserRoleMutationResponse }>({
        path: `${API_PATH}/${userId}/roles`,
        method: 'POST',
        body: { role: input.role, ...(input.reason ? { reason: input.reason } : {}) }
    });
    return result.data.data;
}

async function revokeUserRole(
    userId: string,
    input: RevokeUserRoleInput
): Promise<UserRoleMutationResponse> {
    // The reason travels as a query parameter, not a body: Hono discards DELETE
    // bodies, so a body here would silently drop the operator's justification
    // from the audit row.
    const query = input.reason ? `?reason=${encodeURIComponent(input.reason)}` : '';
    const result = await fetchApi<{ success: boolean; data: UserRoleMutationResponse }>({
        path: `${API_PATH}/${userId}/roles/${encodeURIComponent(input.role)}${query}`,
        method: 'DELETE'
    });
    return result.data.data;
}

/**
 * Fetches a user's held roles with their grant metadata.
 *
 * @param userId - User whose hats to read.
 * @param options.enabled - Set `false` to defer the request.
 * @returns The TanStack Query result.
 */
export const useUserRoles = (userId: string, options?: { readonly enabled?: boolean }) => {
    return useQuery({
        queryKey: userRoleKeys.detail(userId),
        queryFn: () => fetchUserRoles(userId),
        enabled: options?.enabled !== false && !!userId,
        staleTime: 30_000
    });
};

/**
 * Grants a role to a user. Additive — it never removes another hat.
 *
 * @param userId - User receiving the hat.
 * @returns The TanStack mutation.
 */
export const useGrantUserRole = (userId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: GrantUserRoleInput) => grantUserRole(userId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userRoleKeys.detail(userId) });
        },
        onError: (error, input) => {
            adminLogger.error('[UserRoles] Failed to grant role', { userId, input, error });
        }
    });
};

/**
 * Revokes a role from a user.
 *
 * The API refuses to remove the user's LAST role and answers 400; the caller is
 * expected to surface that message rather than treat it as an outage.
 *
 * @param userId - User losing the hat.
 * @returns The TanStack mutation.
 */
export const useRevokeUserRole = (userId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: RevokeUserRoleInput) => revokeUserRole(userId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userRoleKeys.detail(userId) });
        },
        onError: (error, input) => {
            adminLogger.error('[UserRoles] Failed to revoke role', { userId, input, error });
        }
    });
};
