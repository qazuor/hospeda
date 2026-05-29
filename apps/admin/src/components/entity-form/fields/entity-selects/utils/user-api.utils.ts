/**
 * User entity select utilities.
 *
 * SPEC-169 T-020: All list-based functions migrated from /api/v1/admin/users
 * (requires USER_READ_ALL) to /api/v1/admin/users/options (requires
 * ACCESS_PANEL_ADMIN only).
 *
 * /options response shape: { items: [{ id, label, slug }] }
 * label = displayName ?? email (D4 addendum — owner-approved PII tradeoff).
 *
 * loadUsersByIds is NOT migrated — it calls /api/v1/admin/users/batch which is
 * a POST that fetches specific records by ID. That route is unaffected by the
 * broad-grant removal (it resolves specific known IDs, not a list scan).
 */

import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Minimal user item returned by the /options endpoint.
 */
interface UserOptionItem {
    readonly id: string;
    readonly label: string;
    readonly slug: string;
}

/**
 * Standard response envelope from the /options endpoint.
 */
interface OptionsResponse {
    readonly data: {
        readonly items: UserOptionItem[];
    };
}

/**
 * Map a /options item to a SelectOption.
 * label = displayName ?? email (D4 addendum).
 */
const toSelectOption = (item: UserOptionItem): SelectOption => ({
    value: item.id,
    label: item.label,
    description: item.slug || undefined
});

/**
 * Search users by query string via the /options lightweight endpoint.
 * Requires ACCESS_PANEL_ADMIN (no USER_READ_ALL needed).
 */
export const searchUsers = async (
    query: string,
    _options?: {
        roleFilter?: string[];
        statusFilter?: string[];
    }
): Promise<SelectOption[]> => {
    if (!query.trim()) return [];

    try {
        const response = await fetchApi<OptionsResponse>({
            path: `/api/v1/admin/users/options?q=${encodeURIComponent(query)}&limit=20`,
            method: 'GET'
        });

        const items = response.data?.data?.items ?? [];
        return items.map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error searching users (options):',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Load users by IDs.
 *
 * Uses /api/v1/admin/users/batch (POST { ids, fields }) — this is a targeted
 * lookup of specific known IDs, not a broad list scan. Unchanged by SPEC-169.
 */
export const loadUsersByIds = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) return [];

    try {
        const response = await fetchApi<{
            data: Array<{
                id: string;
                displayName?: string;
                firstName?: string;
                lastName?: string;
                email?: string;
            } | null>;
        }>({
            path: '/api/v1/admin/users/batch',
            method: 'POST',
            body: { ids, fields: ['id', 'displayName', 'firstName', 'lastName', 'email'] }
        });

        if (!response.data.data) return [];

        return response.data.data
            .filter((user): user is NonNullable<typeof user> => user !== null)
            .map((user) => ({
                value: user.id,
                label:
                    user.displayName ||
                    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                    user.email ||
                    user.id,
                description: user.email
            }));
    } catch (error) {
        adminLogger.error(
            'Error loading users by IDs:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Load initial users (first 10) via the /options endpoint.
 * Requires ACCESS_PANEL_ADMIN (no USER_READ_ALL needed).
 */
export const loadInitialUsers = async (_options?: {
    roleFilter?: string[];
    statusFilter?: string[];
}): Promise<SelectOption[]> => {
    try {
        const response = await fetchApi<OptionsResponse>({
            path: '/api/v1/admin/users/options?limit=10',
            method: 'GET'
        });

        const items = response.data?.data?.items ?? [];
        return items.map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error loading initial users (options):',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Load all users via the /options endpoint.
 *
 * @deprecated Prefer loadInitialUsers + searchUsers for large datasets.
 */
export const loadAllUsers = async (_options?: {
    roleFilter?: string[];
    statusFilter?: string[];
}): Promise<SelectOption[]> => {
    adminLogger.warn('loadAllUsers called - not recommended for large user datasets');

    try {
        const response = await fetchApi<OptionsResponse>({
            path: '/api/v1/admin/users/options?limit=1000',
            method: 'GET'
        });

        const items = response.data?.data?.items ?? [];
        return items.map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error loading all users (options):',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
