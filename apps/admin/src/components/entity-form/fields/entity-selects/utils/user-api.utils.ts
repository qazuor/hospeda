import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Search users by query string with optional filters
 */
export const searchUsers = async (
    query: string,
    options?: {
        roleFilter?: string[];
        statusFilter?: string[];
    }
): Promise<SelectOption[]> => {
    if (!query.trim()) return [];

    try {
        let path = `/api/v1/public/users?search=${encodeURIComponent(query)}&pageSize=20`;

        if (options?.roleFilter && options.roleFilter.length > 0) {
            path += `&roles=${options.roleFilter.join(',')}`;
        }

        if (options?.statusFilter && options.statusFilter.length > 0) {
            path += `&status=${options.statusFilter.join(',')}`;
        }

        const response = await fetchApi<{
            success: boolean;
            data: {
                items: Array<{
                    id: string;
                    displayName?: string;
                    firstName?: string;
                    lastName?: string;
                    email?: string;
                }>;
            };
        }>({
            path,
            method: 'GET'
        });

        // The API returns: { data: { success: true, data: { items: [...] } } }
        const items = response.data?.data?.items || [];

        if (!items || items.length === 0) return [];

        const results = items.map((user) => ({
            value: user.id,
            label:
                user.displayName ||
                `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                user.email ||
                user.id,
            description: user.email
        }));

        return results;
    } catch (error) {
        adminLogger.error(
            'Error searching users:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Load users by IDs
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
            path: '/api/v1/public/users/batch',
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
 * Load initial users (first 10) for server-side search when no query is provided
 */
export const loadInitialUsers = async (options?: {
    roleFilter?: string[];
    statusFilter?: string[];
}): Promise<SelectOption[]> => {
    try {
        let path = '/api/v1/public/users?pageSize=10';

        if (options?.roleFilter && options.roleFilter.length > 0) {
            path += `&roles=${options.roleFilter.join(',')}`;
        }

        if (options?.statusFilter && options.statusFilter.length > 0) {
            path += `&status=${options.statusFilter.join(',')}`;
        }

        const response = await fetchApi<{
            data: {
                items: Array<{
                    id: string;
                    displayName?: string;
                    firstName?: string;
                    lastName?: string;
                    email?: string;
                }>;
            };
        }>({
            path,
            method: 'GET'
        });

        if (!response.data.data?.items) return [];

        return response.data.data.items.map((user) => ({
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
            'Error loading initial users:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Load all users (for client-side search) - Not recommended for large datasets
 */
export const loadAllUsers = async (options?: {
    roleFilter?: string[];
    statusFilter?: string[];
}): Promise<SelectOption[]> => {
    adminLogger.warn('loadAllUsers called - not recommended for large user datasets');

    try {
        let path = '/api/v1/public/users?pageSize=1000';

        if (options?.roleFilter && options.roleFilter.length > 0) {
            path += `&roles=${options.roleFilter.join(',')}`;
        }

        if (options?.statusFilter && options.statusFilter.length > 0) {
            path += `&status=${options.statusFilter.join(',')}`;
        }

        const response = await fetchApi<{
            data: {
                items: Array<{
                    id: string;
                    displayName?: string;
                    firstName?: string;
                    lastName?: string;
                    email?: string;
                }>;
            };
        }>({
            path,
            method: 'GET'
        });

        if (!response.data.data?.items) return [];

        return response.data.data.items.map((user) => ({
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
            'Error loading all users:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
