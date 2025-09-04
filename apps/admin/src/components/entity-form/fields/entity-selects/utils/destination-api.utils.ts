import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Search destinations by query string
 */
export const searchDestinations = async (query: string): Promise<SelectOption[]> => {
    if (!query.trim()) return [];

    try {
        const response = await fetchApi<{
            data: { items: Array<{ id: string; name: string; description?: string }> };
        }>({
            path: `/api/v1/public/destinations?search=${encodeURIComponent(query)}&limit=20`,
            method: 'GET'
        });

        if (!response.data.data?.items) return [];

        return response.data.data.items.map((destination) => ({
            value: destination.id,
            label: destination.name,
            description: destination.description
        }));
    } catch (error) {
        adminLogger.error(
            'Error searching destinations:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Load destinations by IDs
 */
export const loadDestinationsByIds = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) return [];

    try {
        const response = await fetchApi<{
            data: Array<{ id: string; name: string; description?: string } | null>;
        }>({
            path: '/api/v1/public/destinations/batch',
            method: 'POST',
            body: { ids, fields: ['id', 'name', 'description'] }
        });

        if (!response.data.data) return [];

        return response.data.data
            .filter(
                (dest): dest is { id: string; name: string; description?: string } => dest !== null
            )
            .map((dest) => ({
                value: dest.id,
                label: dest.name,
                description: dest.description
            }));
    } catch (error) {
        adminLogger.error(
            'Error loading destinations by IDs:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Load all destinations (for client-side search)
 */
export const loadAllDestinations = async (): Promise<SelectOption[]> => {
    try {
        const response = await fetchApi<{
            data: { items: Array<{ id: string; name: string; description?: string }> };
        }>({
            path: '/api/v1/public/destinations?limit=100',
            method: 'GET'
        });

        if (!response.data.data?.items) return [];

        return response.data.data.items.map((destination) => ({
            value: destination.id,
            label: destination.name,
            description: destination.description
        }));
    } catch (error) {
        adminLogger.error(
            'Error loading all destinations:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
