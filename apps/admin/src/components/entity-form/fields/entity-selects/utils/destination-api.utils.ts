/**
 * Destination entity select utilities.
 *
 * SPEC-169 T-021: All list-based functions migrated from /api/v1/admin/destinations
 * (requires DESTINATION_VIEW_ALL) to /api/v1/admin/destinations/options (requires
 * ACCESS_PANEL_ADMIN only).
 *
 * /options response shape: { items: [{ id, label, slug }] }
 *
 * loadDestinationsByIds is NOT migrated — it calls /api/v1/admin/destinations/batch
 * which is a targeted POST for specific known IDs. Unchanged by SPEC-169.
 */

import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Minimal destination item returned by the /options endpoint.
 */
interface DestinationOptionItem {
    readonly id: string;
    readonly label: string;
    readonly slug: string;
}

/**
 * Standard response envelope from the /options endpoint.
 */
interface OptionsResponse {
    readonly data: {
        readonly items: DestinationOptionItem[];
    };
}

/**
 * Map a /options item to a SelectOption.
 */
const toSelectOption = (item: DestinationOptionItem): SelectOption => ({
    value: item.id,
    label: item.label,
    description: item.slug || undefined
});

/**
 * Search destinations by query string via the /options lightweight endpoint.
 * Requires ACCESS_PANEL_ADMIN (no DESTINATION_VIEW_ALL needed).
 */
export const searchDestinations = async (query: string): Promise<SelectOption[]> => {
    if (!query.trim()) return [];

    try {
        const response = await fetchApi<OptionsResponse>({
            path: `/api/v1/admin/destinations/options?q=${encodeURIComponent(query)}&limit=20`,
            method: 'GET'
        });

        const items = response.data?.data?.items ?? [];
        return items.map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error searching destinations (options):',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Load destinations by IDs.
 *
 * Uses /api/v1/admin/destinations/batch (POST { ids, fields }) — targeted lookup
 * of specific known IDs. Unchanged by SPEC-169.
 */
export const loadDestinationsByIds = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) return [];

    try {
        const response = await fetchApi<{
            data: Array<{ id: string; name: string; description?: string } | null>;
        }>({
            path: '/api/v1/admin/destinations/batch',
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
 * Load all destinations via the /options endpoint.
 * Requires ACCESS_PANEL_ADMIN (no DESTINATION_VIEW_ALL needed).
 */
export const loadAllDestinations = async (): Promise<SelectOption[]> => {
    try {
        const response = await fetchApi<OptionsResponse>({
            path: '/api/v1/admin/destinations/options?limit=100',
            method: 'GET'
        });

        const items = response.data?.data?.items ?? [];
        return items.map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error loading all destinations (options):',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
