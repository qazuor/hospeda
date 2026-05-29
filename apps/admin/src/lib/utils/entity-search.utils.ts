import { EntityTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Explicit plural map for known entity types.
 *
 * Used to build fallback API endpoint URLs when `config.endpoint` is not provided.
 * Avoids incorrect naive `s` suffix (e.g. "amenity" -> "amenitys" instead of "amenities").
 *
 * @internal
 */
const ENTITY_PLURAL_MAP: Readonly<Record<string, string>> = {
    accommodation: 'accommodations',
    amenity: 'amenities',
    attraction: 'attractions',
    destination: 'destinations',
    event: 'events',
    'event-location': 'event-locations',
    'event-organizer': 'event-organizers',
    feature: 'features',
    'owner-promotion': 'owner-promotions',
    post: 'posts',
    sponsor: 'sponsors',
    tag: 'tags',
    user: 'users'
} as const;

/**
 * Returns the pluralized entity path segment for use in API URLs.
 * Falls back to a naive `s` suffix if the entity type is not in the known map.
 *
 * @param entityType - The entity type string (e.g. "amenity", "destination")
 * @returns Pluralized path segment (e.g. "amenities", "destinations")
 *
 * @internal
 */
const getEntityPluralPath = (entityType: string): string => {
    const normalized = entityType.toLowerCase();
    return ENTITY_PLURAL_MAP[normalized] ?? `${normalized}s`;
};

/**
 * Configuration for entity search functionality
 */
export type EntitySearchConfig = {
    entityType: EntityTypeEnum;
    endpoint?: string;
    searchFields?: string[];
    limit?: number;
    filters?: Record<string, unknown>;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
};

/**
 * Configuration for entity load by IDs functionality
 */
export type EntityLoadConfig = {
    entityType: EntityTypeEnum;
    endpoint?: string;
    includeFields?: string[];
};

/**
 * Response from entity search API
 */
export type EntitySearchResponse = {
    data: EntitySearchItem[];
    total: number;
    hasMore: boolean;
};

/**
 * Individual entity item from search
 */
export type EntitySearchItem = {
    id: string;
    name?: string;
    title?: string;
    label?: string;
    description?: string;
    summary?: string;
    slug?: string;
    type?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
};

/**
 * Generic search function for entity selects.
 *
 * SPEC-169 T-021: The fallback endpoint was previously
 * `/api/v1/admin/<entity>/search` (which never existed — all requests 404ed).
 * Migrated to `/api/v1/admin/<entity>/options` (ACCESS_PANEL_ADMIN-gated,
 * shape: `{ items: [{ id, label, slug }] }`, DRAFT-inclusive).
 *
 * When `config.endpoint` is provided it is used as-is. The generic fallback
 * now correctly resolves to `/options` instead of the dead `/search` path.
 *
 * @param config - Configuration for the search
 * @returns Function that performs entity search and returns SelectOptions
 */
export const createEntitySearchFn = (config: EntitySearchConfig) => {
    return async (query: string): Promise<SelectOption[]> => {
        if (!query || query.length < (config.limit || 2)) {
            return [];
        }

        // SPEC-169: use /options instead of /search (which never existed).
        const endpoint =
            config.endpoint || `/api/v1/admin/${getEntityPluralPath(config.entityType)}/options`;

        const params = new URLSearchParams({
            q: query,
            limit: (config.limit || 10).toString(),
            ...(config.searchFields && { fields: config.searchFields.join(',') }),
            ...(config.sortBy && { sortBy: config.sortBy }),
            ...(config.sortOrder && { sortOrder: config.sortOrder }),
            ...(config.filters &&
                Object.entries(config.filters).reduce(
                    (acc, [key, value]) => {
                        acc[key] = String(value);
                        return acc;
                    },
                    {} as Record<string, string>
                ))
        });

        try {
            const response = await fetchApi({ path: `${endpoint}?${params}` });
            // SPEC-169: /options returns { data: { items: [...] } }; legacy /search
            // returned { data: [...], total, hasMore }. Normalise both shapes.
            const raw = response.data as Record<string, unknown>;
            let items: EntitySearchItem[];

            if (raw && typeof raw === 'object' && 'items' in raw && Array.isArray(raw.items)) {
                // /options shape: { items: [...] }
                items = raw.items as EntitySearchItem[];
            } else if (raw && typeof raw === 'object' && 'data' in raw) {
                const inner = raw.data as EntitySearchItem[] | { items?: EntitySearchItem[] };
                if (Array.isArray(inner)) {
                    items = inner;
                } else if (inner && 'items' in inner && Array.isArray(inner.items)) {
                    items = inner.items;
                } else {
                    items = [];
                }
            } else {
                items = [];
            }

            return items.map((item) => ({
                value: item.id,
                label: item.label || item.name || item.title || `${config.entityType} ${item.id}`,
                description: item.description || item.summary,
                metadata: {
                    ...item.metadata,
                    slug: item.slug,
                    type: item.type,
                    status: item.status
                }
            }));
        } catch (error) {
            adminLogger.error(`Entity search error for ${config.entityType}`, error);
            return [];
        }
    };
};

/**
 * Generic load by IDs function for entity selects
 * Creates a function that loads specific entities by their IDs
 *
 * @param config - Configuration for loading entities
 * @returns Function that loads entities by IDs and returns SelectOptions
 */
export const createEntityLoadByIdsFn = (config: EntityLoadConfig) => {
    return async (ids: string[]): Promise<SelectOption[]> => {
        if (ids.length === 0) return [];

        // Check if we have a batch endpoint or need to use individual calls
        const hasBatchEndpoint = config.endpoint?.includes('/batch');

        if (hasBatchEndpoint) {
            // Use batch endpoint
            try {
                const response = await fetchApi({
                    path:
                        config.endpoint ||
                        `/api/v1/admin/${getEntityPluralPath(config.entityType)}/batch`,
                    method: 'POST',
                    body: {
                        ids,
                        ...(config.includeFields && { fields: config.includeFields })
                    }
                });

                return (response.data as { data: EntitySearchItem[] }).data.map(
                    (item: EntitySearchItem) => ({
                        value: item.id,
                        label:
                            item.name ||
                            item.title ||
                            item.label ||
                            `${config.entityType} ${item.id}`,
                        description: item.description || item.summary,
                        metadata: {
                            ...item.metadata,
                            slug: item.slug,
                            type: item.type,
                            status: item.status
                        }
                    })
                );
            } catch (error) {
                adminLogger.error(`Entity load by IDs error for ${config.entityType}`, error);
                return [];
            }
        } else {
            // Use individual getById calls
            const baseEndpoint =
                config.endpoint || `/api/v1/admin/${getEntityPluralPath(config.entityType)}`;

            try {
                const results = await Promise.all(
                    ids.map(async (id) => {
                        try {
                            const response = await fetchApi({
                                path: `${baseEndpoint}/${id}`
                            });
                            return response.data as EntitySearchItem;
                        } catch (error) {
                            adminLogger.error(`Failed to load ${config.entityType} ${id}`, error);
                            return null;
                        }
                    })
                );

                return results
                    .filter((item): item is EntitySearchItem => item !== null)
                    .map((item) => ({
                        value: item.id,
                        label:
                            item.name ||
                            item.title ||
                            item.label ||
                            `${config.entityType} ${item.id}`,
                        description: item.description || item.summary,
                        metadata: {
                            ...item.metadata,
                            slug: item.slug,
                            type: item.type,
                            status: item.status
                        }
                    }));
            } catch (error) {
                adminLogger.error(`Entity load by IDs error for ${config.entityType}`, error);
                return [];
            }
        }
    };
};

/**
 * Advanced search function with pagination support.
 *
 * SPEC-169 T-021: Fallback endpoint migrated from /search (non-existent) to
 * /options (ACCESS_PANEL_ADMIN-gated, DRAFT-inclusive).
 *
 * @param config - Configuration for the search
 * @returns Function that performs paginated entity search
 */
export const createPaginatedEntitySearchFn = (config: EntitySearchConfig) => {
    return async (
        query: string,
        page = 1,
        pageSize = 10
    ): Promise<{
        options: SelectOption[];
        hasMore: boolean;
        total: number;
    }> => {
        if (!query || query.length < (config.limit || 2)) {
            return { options: [], hasMore: false, total: 0 };
        }

        // SPEC-169: use /options instead of /search (which never existed).
        const endpoint =
            config.endpoint || `/api/v1/admin/${getEntityPluralPath(config.entityType)}/options`;

        const params = new URLSearchParams({
            q: query,
            page: page.toString(),
            limit: pageSize.toString(),
            ...(config.searchFields && { fields: config.searchFields.join(',') }),
            ...(config.sortBy && { sortBy: config.sortBy }),
            ...(config.sortOrder && { sortOrder: config.sortOrder }),
            ...(config.filters &&
                Object.entries(config.filters).reduce(
                    (acc, [key, value]) => {
                        acc[key] = String(value);
                        return acc;
                    },
                    {} as Record<string, string>
                ))
        });

        try {
            const response = await fetchApi({ path: `${endpoint}?${params}` });
            // SPEC-169: normalise /options shape vs legacy /search shape.
            const raw = response.data as Record<string, unknown>;
            let items: EntitySearchItem[];
            let hasMore = false;
            let total = 0;

            if (raw && typeof raw === 'object' && 'items' in raw && Array.isArray(raw.items)) {
                // /options shape: { items: [...] }
                items = raw.items as EntitySearchItem[];
                total = items.length;
            } else if (raw && typeof raw === 'object' && 'data' in raw) {
                const inner = raw.data as EntitySearchItem[] | EntitySearchResponse;
                if (Array.isArray(inner)) {
                    items = inner;
                    total = items.length;
                } else {
                    const typed = inner as EntitySearchResponse;
                    items = typed.data ?? [];
                    hasMore = typed.hasMore ?? false;
                    total = typed.total ?? items.length;
                }
            } else {
                items = [];
            }

            const options = items.map((item) => ({
                value: item.id,
                label: item.label || item.name || item.title || `${config.entityType} ${item.id}`,
                description: item.description || item.summary,
                metadata: {
                    ...item.metadata,
                    slug: item.slug,
                    type: item.type,
                    status: item.status
                }
            }));

            return { options, hasMore, total };
        } catch (error) {
            adminLogger.error(`Paginated entity search error for ${config.entityType}`, error);
            return { options: [], hasMore: false, total: 0 };
        }
    };
};

/**
 * Predefined search configurations for common entities
 * These provide sensible defaults for each entity type
 */
export const entitySearchConfigs: Record<EntityTypeEnum, EntitySearchConfig> = {
    [EntityTypeEnum.DESTINATION]: {
        entityType: EntityTypeEnum.DESTINATION,
        searchFields: ['name', 'slug', 'description'],
        limit: 15,
        sortBy: 'name',
        sortOrder: 'asc',
        filters: {
            status: 'active'
        }
    },

    [EntityTypeEnum.USER]: {
        entityType: EntityTypeEnum.USER,
        searchFields: ['name', 'email', 'username'],
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        filters: {
            status: 'active'
        }
    },

    [EntityTypeEnum.FEATURE]: {
        entityType: EntityTypeEnum.FEATURE,
        searchFields: ['name', 'description', 'category'],
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        filters: {
            status: 'active'
        }
    },

    [EntityTypeEnum.AMENITY]: {
        entityType: EntityTypeEnum.AMENITY,
        searchFields: ['name', 'description', 'category'],
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        filters: {
            status: 'active'
        }
    },

    [EntityTypeEnum.TAG]: {
        entityType: EntityTypeEnum.TAG,
        searchFields: ['name', 'slug'],
        limit: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        filters: {
            status: 'active'
        }
    },

    [EntityTypeEnum.EVENT]: {
        entityType: EntityTypeEnum.EVENT,
        searchFields: ['name', 'slug', 'description'],
        limit: 15,
        sortBy: 'startDate',
        sortOrder: 'desc',
        filters: {
            status: 'active'
        }
    },

    [EntityTypeEnum.POST]: {
        entityType: EntityTypeEnum.POST,
        searchFields: ['title', 'slug', 'summary'],
        limit: 15,
        sortBy: 'publishedAt',
        sortOrder: 'desc',
        filters: {
            status: 'published'
        }
    },

    [EntityTypeEnum.ACCOMMODATION]: {
        entityType: EntityTypeEnum.ACCOMMODATION,
        searchFields: ['name', 'slug', 'summary'],
        limit: 15,
        sortBy: 'name',
        sortOrder: 'asc',
        filters: {
            status: 'active'
        }
    },

    [EntityTypeEnum.EVENT_LOCATION]: {
        entityType: EntityTypeEnum.EVENT_LOCATION,
        searchFields: ['name', 'city'],
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        filters: {}
    },

    [EntityTypeEnum.EVENT_ORGANIZER]: {
        entityType: EntityTypeEnum.EVENT_ORGANIZER,
        searchFields: ['name', 'description'],
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        filters: {}
    },

    [EntityTypeEnum.POST_SPONSORSHIP]: {
        entityType: EntityTypeEnum.POST_SPONSORSHIP,
        searchFields: ['message', 'description'],
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        filters: {}
    }
};

/**
 * Predefined load configurations for common entities
 */
export const entityLoadConfigs: Record<EntityTypeEnum, EntityLoadConfig> = {
    [EntityTypeEnum.DESTINATION]: {
        entityType: EntityTypeEnum.DESTINATION,
        includeFields: ['id', 'name', 'slug', 'description', 'type', 'status']
    },

    [EntityTypeEnum.USER]: {
        entityType: EntityTypeEnum.USER,
        includeFields: ['id', 'name', 'email', 'username', 'role', 'status']
    },

    [EntityTypeEnum.FEATURE]: {
        entityType: EntityTypeEnum.FEATURE,
        includeFields: ['id', 'name', 'description', 'category', 'icon', 'status']
    },

    [EntityTypeEnum.AMENITY]: {
        entityType: EntityTypeEnum.AMENITY,
        includeFields: ['id', 'name', 'description', 'category', 'icon', 'status']
    },

    [EntityTypeEnum.TAG]: {
        entityType: EntityTypeEnum.TAG,
        includeFields: ['id', 'name', 'slug', 'color', 'status']
    },

    [EntityTypeEnum.EVENT]: {
        entityType: EntityTypeEnum.EVENT,
        includeFields: ['id', 'name', 'slug', 'description', 'startDate', 'endDate', 'status']
    },

    [EntityTypeEnum.POST]: {
        entityType: EntityTypeEnum.POST,
        includeFields: ['id', 'title', 'slug', 'summary', 'publishedAt', 'status']
    },

    [EntityTypeEnum.ACCOMMODATION]: {
        entityType: EntityTypeEnum.ACCOMMODATION,
        includeFields: ['id', 'name', 'slug', 'summary', 'status']
    },

    [EntityTypeEnum.EVENT_LOCATION]: {
        entityType: EntityTypeEnum.EVENT_LOCATION,
        includeFields: ['id', 'name', 'city']
    },

    [EntityTypeEnum.EVENT_ORGANIZER]: {
        entityType: EntityTypeEnum.EVENT_ORGANIZER,
        includeFields: ['id', 'name', 'description']
    },

    [EntityTypeEnum.POST_SPONSORSHIP]: {
        entityType: EntityTypeEnum.POST_SPONSORSHIP,
        includeFields: ['id', 'message', 'description', 'sponsor']
    }
};

/**
 * Utility to create search and load functions for a specific entity type
 *
 * @param entityType - The entity type to create functions for
 * @param customConfig - Optional custom configuration to override defaults
 * @returns Object with search and load functions
 */
export const createEntityFunctions = (
    entityType: EntityTypeEnum,
    customConfig?: Partial<EntitySearchConfig & EntityLoadConfig>
) => {
    const searchConfig = {
        ...entitySearchConfigs[entityType],
        ...customConfig
    };

    const loadConfig = {
        ...entityLoadConfigs[entityType],
        ...(customConfig?.endpoint && { endpoint: customConfig.endpoint })
    };

    return {
        searchFn: createEntitySearchFn(searchConfig),
        loadByIdsFn: createEntityLoadByIdsFn(loadConfig),
        paginatedSearchFn: createPaginatedEntitySearchFn(searchConfig)
    };
};

/**
 * Utility to create a cached search function
 * Caches search results to avoid repeated API calls
 *
 * @param searchFn - The original search function
 * @param cacheSize - Maximum number of cached queries (default: 50)
 * @param cacheTtl - Cache TTL in milliseconds (default: 5 minutes)
 * @returns Cached search function
 */
export const createCachedSearchFn = (
    searchFn: (query: string) => Promise<SelectOption[]>,
    cacheSize = 50,
    cacheTtl = 5 * 60 * 1000 // 5 minutes
) => {
    const cache = new Map<string, { data: SelectOption[]; timestamp: number }>();

    return async (query: string): Promise<SelectOption[]> => {
        const now = Date.now();
        const cached = cache.get(query);

        // Return cached result if valid
        if (cached && now - cached.timestamp < cacheTtl) {
            return cached.data;
        }

        // Fetch new data
        const data = await searchFn(query);

        // Clean old entries if cache is full
        if (cache.size >= cacheSize) {
            const oldestKey = Array.from(cache.keys())[0];
            cache.delete(oldestKey);
        }

        // Cache new data
        cache.set(query, { data, timestamp: now });

        return data;
    };
};
