import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';
import { createPaginatedResponseSchema } from '@repo/schemas';
import type { z } from 'zod';
import type { FilterBarConfig } from '../filters/filter-types';
import type { EntityQueryParams, EntityQueryResponse } from '../types';

/**
 * Parameters for creating an entity API client.
 * When filterBarConfig is provided, UI manages all filter state and defaultFilters is ignored.
 */
export type CreateEntityApiParams<TData> = {
    readonly endpoint: string;
    readonly itemSchema: z.ZodSchema<TData>;
    /** Legacy: static filters always applied. Ignored when filterBarConfig is provided. */
    readonly defaultFilters?: Readonly<Record<string, string>>;
    /** When provided, UI manages all filter state via useFilterState. defaultFilters is ignored. */
    readonly filterBarConfig?: FilterBarConfig;
};

/**
 * Creates a generic API client for entity lists
 *
 * Supports two filter modes:
 * - Legacy mode: `defaultFilters` are applied as static base filters.
 * - Filter bar mode: when `filterBarConfig` is provided, all filter state is managed
 *   by the UI (useFilterState). `defaultFilters` is ignored in this mode.
 *   An empty `filters` object means the user cleared all filters — no fallback to defaults.
 *
 * ✅ Now using createPaginatedResponseSchema from @repo/schemas
 * after Zod v4 compatibility has been resolved
 */
export const createEntityApi = <TData>({
    endpoint,
    itemSchema,
    defaultFilters,
    filterBarConfig
}: CreateEntityApiParams<TData>) => {
    // Use centralized schema from @repo/schemas
    const PaginatedResponseSchema = createPaginatedResponseSchema(itemSchema);

    type ApiResponse = {
        success: true;
        data: {
            items: TData[];
            pagination: {
                page: number;
                pageSize: number;
                total: number;
                totalPages: number;
                hasNextPage: boolean;
                hasPreviousPage: boolean;
            };
        };
        metadata?: {
            timestamp: string;
            requestId?: string;
            version?: string;
        };
    };

    /**
     * Fetch entities with query parameters
     */
    const getEntities = async ({
        page,
        pageSize,
        q,
        sort,
        filters
    }: EntityQueryParams): Promise<EntityQueryResponse<TData>> => {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize)); // API uses consistent pageSize

        if (q) {
            params.set('search', q); // API uses 'search' instead of 'q'
        }

        // Transform SortConfig[] to "field:direction" string format expected by backend
        if (sort && sort.length > 0) {
            params.set('sort', `${sort[0].id}:${sort[0].desc ? 'desc' : 'asc'}`);
        }

        if (filterBarConfig) {
            // UI-managed mode: filter state comes exclusively from useFilterState.
            // An empty filters object means "user cleared all" - do NOT fall back to defaultFilters.
            if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                    if (value !== undefined && value !== null && value !== '') {
                        params.set(key, String(value));
                    }
                }
            }
        } else if (defaultFilters) {
            // Legacy path: no filter UI, apply static defaults
            for (const [key, value] of Object.entries(defaultFilters)) {
                params.set(key, value);
            }
            // Also apply any programmatic filters passed through
            if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                    if (value !== undefined && value !== null && value !== '') {
                        params.set(key, String(value));
                    }
                }
            }
        }

        const { data } = await fetchApi<unknown>({
            path: `${endpoint}?${params.toString()}`
        });

        // Parse the API response using the centralized schema
        const parseResult = PaginatedResponseSchema.safeParse(data);

        if (!parseResult.success) {
            adminLogger.error(
                `[createEntityApi] Zod validation failed for ${endpoint}:`,
                parseResult.error.issues,
                'Response data:',
                data
            );
            throw new Error(
                `API response validation failed for ${endpoint}: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
            );
        }

        const apiResponse = parseResult.data as ApiResponse;

        // Adapt to the expected format
        return {
            data: apiResponse.data.items,
            total: apiResponse.data.pagination.total,
            page: apiResponse.data.pagination.page,
            pageSize: apiResponse.data.pagination.pageSize
        };
    };

    return {
        getEntities,
        itemSchema,
        responseSchema: PaginatedResponseSchema
    };
};
