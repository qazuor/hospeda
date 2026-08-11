/**
 * TanStack Query hooks for per-user permission overrides (SPEC-170).
 *
 * - `useUserPermissionOverrides` — GET the split view (fromRole/grant/deny).
 * - `useAssignUserPermission` — POST a grant/deny override (upsert).
 * - `useRevokeUserPermission` — DELETE an override.
 * - `useSetTrustedEditor` — PUT the atomic trusted-editor bundle (HOS-374).
 *
 * Mutations invalidate the user's overrides query on success so the panel
 * re-renders with the new state. No optimistic updates: permission changes are
 * security-sensitive, so the UI waits for server confirmation.
 */

import type {
    AssignUserPermissionOverrideBody,
    PermissionEnum,
    SetTrustedEditorBody,
    TrustedEditorResult,
    UserPermissionOverridesResponse
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

const API_PATH = '/api/v1/admin/users';

/** Query keys for per-user permission override operations. */
export const permissionOverrideKeys = {
    all: ['user-permission-overrides'] as const,
    detail: (userId: string) => [...permissionOverrideKeys.all, userId] as const
};

async function fetchOverrides(userId: string): Promise<UserPermissionOverridesResponse> {
    const result = await fetchApi<{ success: boolean; data: UserPermissionOverridesResponse }>({
        path: `${API_PATH}/${userId}/permissions`
    });
    return result.data.data;
}

async function assignOverride(
    userId: string,
    body: AssignUserPermissionOverrideBody
): Promise<{ assigned: boolean }> {
    const result = await fetchApi<{ success: boolean; data: { assigned: boolean } }>({
        path: `${API_PATH}/${userId}/permissions`,
        method: 'POST',
        body
    });
    return result.data.data;
}

async function revokeOverride(
    userId: string,
    permission: PermissionEnum
): Promise<{ removed: boolean }> {
    const result = await fetchApi<{ success: boolean; data: { removed: boolean } }>({
        path: `${API_PATH}/${userId}/permissions/${encodeURIComponent(permission)}`,
        method: 'DELETE'
    });
    return result.data.data;
}

async function setTrustedEditor(
    userId: string,
    body: SetTrustedEditorBody
): Promise<TrustedEditorResult> {
    const result = await fetchApi<{ success: boolean; data: TrustedEditorResult }>({
        path: `${API_PATH}/${userId}/trusted-editor`,
        method: 'PUT',
        body
    });
    return result.data.data;
}

/**
 * Fetch a user's permission overrides split into fromRole / grant / deny.
 */
export const useUserPermissionOverrides = (userId: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: permissionOverrideKeys.detail(userId),
        queryFn: () => fetchOverrides(userId),
        enabled: options?.enabled !== false && !!userId,
        staleTime: 30_000
    });
};

/**
 * Grant or deny a per-user permission override (upsert).
 */
export const useAssignUserPermission = (userId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: AssignUserPermissionOverrideBody) => assignOverride(userId, body),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: permissionOverrideKeys.detail(userId)
            });
        },
        onError: (error) => {
            adminLogger.error('[PermissionOverride] Failed to assign override', { userId, error });
        }
    });
};

/**
 * Remove a per-user permission override (grant or deny).
 */
export const useRevokeUserPermission = (userId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (permission: PermissionEnum) => revokeOverride(userId, permission),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: permissionOverrideKeys.detail(userId)
            });
        },
        onError: (error, permission) => {
            adminLogger.error('[PermissionOverride] Failed to revoke override', {
                userId,
                permission,
                error
            });
        }
    });
};

/**
 * Mark or unmark a user as a trusted editor (HOS-374 §5.1.2 / OQ-1).
 *
 * One `PUT` carrying the desired state, not a POST/DELETE pair: the four
 * `TRUSTED_EDITOR_PERMISSIONS` move together server-side, so the UI exposes a
 * single toggle. Invalidates the overrides query so the grant list and the
 * derived `isTrustedEditor` flag re-render from the server's verdict.
 */
export const useSetTrustedEditor = (userId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (trusted: boolean) => setTrustedEditor(userId, { trusted }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: permissionOverrideKeys.detail(userId)
            });
        },
        onError: (error, trusted) => {
            adminLogger.error('[PermissionOverride] Failed to set trusted-editor status', {
                userId,
                trusted,
                error
            });
        }
    });
};
