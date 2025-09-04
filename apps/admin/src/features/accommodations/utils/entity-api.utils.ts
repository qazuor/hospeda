import { fetchApi } from '@/lib/api/client';
import type { SelectOption } from '@/lib/utils/enum-to-options.utils';
import { adminLogger } from '@/utils/logger';

/**
 * Utility functions for entity API calls used in EntitySelectField
 */

/**
 * Search destinations with query
 * @param query - Search query
 * @returns Promise with destination options
 */
export const searchDestinations = async (query: string): Promise<SelectOption[]> => {
    try {
        const response = await fetchApi<{
            items: Array<{ id: string; name: string; description?: string }>;
            pagination: { total: number; page: number; limit: number; totalPages: number };
        }>({
            path: `/api/v1/public/destinations?search=${encodeURIComponent(query)}&limit=50`
        });

        if (!response.data?.items) {
            return [];
        }

        return response.data.items.map((destination) => ({
            value: destination.id,
            label: destination.name
        }));
    } catch (error) {
        adminLogger.error(error, 'Error searching destinations');
        return [];
    }
};

/**
 * Load all destinations for client-side search
 * @returns Promise with all destination options
 */
export const loadAllDestinations = async (): Promise<SelectOption[]> => {
    try {
        const response = await fetchApi<{
            data: { items: Array<{ id: string; name: string; description?: string }> };
            pagination: { total: number; page: number; limit: number; totalPages: number };
        }>({
            path: '/api/v1/public/destinations?limit=100'
        });

        if (!response.data?.data?.items) {
            return [];
        }

        return response.data.data.items.map((destination) => ({
            value: destination.id,
            label: destination.name
        }));
    } catch (error) {
        adminLogger.error(error, 'Error loading all destinations');
        return [];
    }
};

/**
 * Load destinations by IDs
 * @param ids - Array of destination IDs
 * @returns Promise with destination options
 */
export const loadDestinationsByIds = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) return [];

    try {
        const response = await fetchApi<{
            data: Array<{ id: string; name: string; description?: string } | null>;
        }>({
            path: '/api/v1/public/destinations/batch',
            method: 'POST',
            body: {
                ids,
                fields: ['id', 'name', 'description']
            }
        });

        if (!response.data.data) {
            return [];
        }

        return response.data.data
            .filter(
                (destination): destination is { id: string; name: string; description?: string } =>
                    destination !== null
            )
            .map((destination) => ({
                value: destination.id,
                label: destination.name
            }));
    } catch (error) {
        adminLogger.error(error, 'Error loading destinations by IDs');
        return [];
    }
};

/**
 * Search users with query using server-side search
 * @param query - Search query
 * @returns Promise with user options
 */
export const searchUsers = async (query: string): Promise<SelectOption[]> => {
    try {
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
            pagination: { total: number; page: number; limit: number; totalPages: number };
        }>({
            path: `/api/v1/public/users?search=${encodeURIComponent(query)}&limit=50`
        });

        if (!response.data?.data?.items) {
            return [];
        }

        return response.data.data.items.map((user) => ({
            value: user.id,
            label:
                user.displayName ||
                `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                user.email ||
                user.id
        }));
    } catch (error) {
        adminLogger.error(error, 'Error searching users');
        return [];
    }
};

/**
 * Load users by IDs
 * @param ids - Array of user IDs
 * @returns Promise with user options
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
            body: {
                ids,
                fields: ['id', 'displayName', 'firstName', 'lastName', 'email']
            }
        });

        if (!response.data.data) {
            return [];
        }

        return response.data.data
            .filter(
                (
                    user
                ): user is {
                    id: string;
                    displayName?: string;
                    firstName?: string;
                    lastName?: string;
                    email?: string;
                } => user !== null
            )
            .map((user) => ({
                value: user.id,
                label:
                    user.displayName ||
                    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                    user.email ||
                    user.id
            }));
    } catch (error) {
        adminLogger.error(error, 'Error loading users by IDs');
        return [];
    }
};
