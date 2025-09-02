import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';

// Error tracking for circuit breaker pattern
const destinationLoadErrors = new Map<string, { count: number; lastError: number }>();
const MAX_RETRIES = 2;
const ERROR_RESET_TIME = 30000; // 30 seconds

/**
 * Destination item type for API responses
 */
interface DestinationItem {
    id: string;
    name: string;
    description?: string;
}

/**
 * API response types for destinations
 */
interface DestinationSearchResponse {
    success: boolean;
    data: {
        items: DestinationItem[];
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
    };
    metadata: {
        timestamp: string;
        requestId: string;
        total: number;
    };
}

interface DestinationBatchResponse {
    success: boolean;
    data: DestinationItem[]; // Directamente el array
    metadata: {
        timestamp: string;
        requestId: string;
        total: number;
        count: number;
    };
}

/**
 * Stable destination search function
 * This function is created once and never changes, preventing infinite loops
 */
export const stableDestinationSearchFn = async (query: string): Promise<SelectOption[]> => {
    if (!query || query.length < 2) {
        return [];
    }

    try {
        const searchPath = `/api/v1/public/destinations?search=${encodeURIComponent(query)}&limit=15`;

        const response = await fetchApi({
            path: searchPath
        });

        // The API returns: { data: { success: true, data: { items: [...] } } }
        const searchResponse = response.data as DestinationSearchResponse;
        const items = searchResponse?.data?.items;

        const mappedResults =
            items?.map((item: DestinationItem) => ({
                value: item.id,
                label: item.name,
                description: item.description
            })) || [];

        return mappedResults;
    } catch (_error) {
        return [];
    }
};

/**
 * Stable destination load by IDs function
 * This function is created once and never changes, preventing infinite loops
 */
export const stableDestinationLoadByIdsFn = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) {
        return [];
    }

    const cacheKey = ids.sort().join(',');
    const now = Date.now();

    // Check circuit breaker
    const errorInfo = destinationLoadErrors.get(cacheKey);
    if (errorInfo) {
        // Reset error count if enough time has passed
        if (now - errorInfo.lastError > ERROR_RESET_TIME) {
            destinationLoadErrors.delete(cacheKey);
        } else if (errorInfo.count >= MAX_RETRIES) {
            return []; // Circuit breaker: stop trying
        }
    }

    try {
        const requestBody = {
            ids,
            fields: ['id', 'name', 'description'] // Only request fields needed for entity selector
        };

        const response = await fetchApi({
            path: '/api/v1/public/destinations/batch',
            method: 'POST',
            body: requestBody
        });

        // Success: clear any error tracking
        destinationLoadErrors.delete(cacheKey);

        const data = (response.data as DestinationBatchResponse)?.data;

        const mappedResults =
            data?.map((item: DestinationItem) => ({
                value: item.id,
                label: item.name,
                description: item.description
            })) || [];

        return mappedResults;
    } catch (_error) {
        // Track error for circuit breaker
        const currentErrors = destinationLoadErrors.get(cacheKey) || { count: 0, lastError: 0 };
        destinationLoadErrors.set(cacheKey, {
            count: currentErrors.count + 1,
            lastError: now
        });

        return [];
    }
};

/**
 * Stable destination load all function for client-side search
 * This function loads all destinations at once for client-side filtering
 */
export const stableDestinationLoadAllFn = async (): Promise<SelectOption[]> => {
    const searchPath = '/api/v1/public/destinations?limit=100'; // Load all destinations

    const response = await fetchApi({
        path: searchPath
    });

    // Check if the response indicates an error
    if (response.status >= 400) {
        throw new Error(`API returned status ${response.status}`);
    }

    // The API returns: { data: { success: true, data: { items: [...] } } }
    const searchResponse = response.data as DestinationSearchResponse;

    // Check if the response structure is valid
    if (!searchResponse || !searchResponse.data || !searchResponse.data.items) {
        throw new Error('Invalid response structure from API');
    }

    const items = searchResponse.data.items;

    const mappedResults =
        items?.map((item: DestinationItem) => ({
            value: item.id,
            label: item.name,
            description: item.description
        })) || [];

    return mappedResults;
};

/**
 * Factory function to create stable destination functions
 * This ensures the functions are created once and reused
 */
export const createStableDestinationFunctions = () => {
    return {
        searchFn: stableDestinationSearchFn,
        loadByIdsFn: stableDestinationLoadByIdsFn,
        loadAllFn: stableDestinationLoadAllFn
    };
};
