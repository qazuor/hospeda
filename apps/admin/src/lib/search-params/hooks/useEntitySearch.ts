import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { z } from 'zod';

/**
 * Hook for managing entity search parameters
 * Provides type-safe methods to update search params with validation
 */
export const useEntitySearch = <TSchema extends z.ZodSchema>(
    currentSearch: z.infer<TSchema>,
    schema: TSchema,
    defaults: Partial<z.infer<TSchema>> = {}
) => {
    const navigate = useNavigate();

    /**
     * Update search parameters with validation
     * @param updates - Partial search parameter updates
     * @param options - Navigation options
     */
    const updateSearch = useCallback(
        (
            updates:
                | Partial<z.infer<TSchema>>
                | ((prev: z.infer<TSchema>) => Partial<z.infer<TSchema>>),
            options: {
                readonly replace?: boolean;
                readonly resetOthers?: boolean;
            } = {}
        ) => {
            const { replace = true, resetOthers = false } = options;

            // Calculate new search params
            const newUpdates = typeof updates === 'function' ? updates(currentSearch) : updates;

            const newSearch = resetOthers
                ? { ...defaults, ...newUpdates }
                : { ...currentSearch, ...newUpdates };

            // Validate the new search params
            const validationResult = schema.safeParse(newSearch);

            if (!validationResult.success) {
                console.warn('Invalid search params update:', validationResult.error.issues);
                return;
            }

            // Navigate with the new search params
            navigate({
                search: validationResult.data,
                replace
            });
        },
        [currentSearch, schema, defaults, navigate]
    );

    /**
     * Reset search parameters to defaults
     */
    const resetSearch = useCallback(() => {
        navigate({
            // biome-ignore lint/suspicious/noExplicitAny: TanStack Router search type compatibility
            search: defaults as any,
            replace: true
        });
    }, [defaults, navigate]);

    /**
     * Update a single search parameter
     * @param key - Parameter key
     * @param value - New value
     */
    const updateParam = useCallback(
        <K extends keyof z.infer<TSchema>>(key: K, value: z.infer<TSchema>[K]) => {
            updateSearch({ [key]: value } as Partial<z.infer<TSchema>>);
        },
        [updateSearch]
    );

    /**
     * Remove a search parameter (set to undefined)
     * @param key - Parameter key to remove
     */
    const removeParam = useCallback(
        <K extends keyof z.infer<TSchema>>(key: K) => {
            updateSearch({ [key]: undefined } as Partial<z.infer<TSchema>>);
        },
        [updateSearch]
    );

    /**
     * Toggle a boolean search parameter
     * @param key - Boolean parameter key
     */
    const toggleParam = useCallback(
        <K extends keyof z.infer<TSchema>>(
            key: K extends keyof z.infer<TSchema>
                ? z.infer<TSchema>[K] extends boolean | undefined
                    ? K
                    : never
                : never
        ) => {
            const currentValue = currentSearch[key] as boolean | undefined;
            updateParam(key, !currentValue as z.infer<TSchema>[K]);
        },
        [currentSearch, updateParam]
    );

    /**
     * Check if search params have been modified from defaults
     */
    const hasChanges = useCallback(() => {
        const defaultKeys = Object.keys(defaults);
        const currentKeys = Object.keys(currentSearch);

        // Check if any current values differ from defaults
        for (const key of currentKeys) {
            if (
                currentSearch[key as keyof z.infer<TSchema>] !==
                defaults[key as keyof z.infer<TSchema>]
            ) {
                return true;
            }
        }

        // Check if any default values are missing
        for (const key of defaultKeys) {
            if (!(key in currentSearch)) {
                return true;
            }
        }

        return false;
    }, [currentSearch, defaults]);

    /**
     * Get URL with current search params
     */
    const getSearchUrl = useCallback(() => {
        const searchParams = new URLSearchParams();

        for (const [key, value] of Object.entries(currentSearch)) {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    for (const item of value) {
                        searchParams.append(key, String(item));
                    }
                } else if (typeof value === 'object') {
                    searchParams.set(key, JSON.stringify(value));
                } else {
                    searchParams.set(key, String(value));
                }
            }
        }

        return searchParams.toString();
    }, [currentSearch]);

    return {
        // Current state
        search: currentSearch,
        hasChanges: hasChanges(),
        searchUrl: getSearchUrl(),

        // Update methods
        updateSearch,
        updateParam,
        removeParam,
        toggleParam,
        resetSearch
    };
};

/**
 * Hook specifically for entity list search parameters
 */
export const useEntityListSearch = (
    currentSearch: Parameters<typeof useEntitySearch>[0],
    schema: Parameters<typeof useEntitySearch>[1],
    defaults: Parameters<typeof useEntitySearch>[2] = {}
) => {
    const baseHook = useEntitySearch(currentSearch, schema, defaults);

    /**
     * Navigate to a specific page
     * @param page - Page number (1-based)
     */
    const goToPage = useCallback(
        (page: number) => {
            baseHook.updateParam('page' as keyof typeof currentSearch, page);
        },
        [baseHook]
    );

    /**
     * Update the search query
     * @param query - Search query string
     */
    const setSearchQuery = useCallback(
        (query: string) => {
            baseHook.updateSearch({
                search: query,
                page: 1 // Reset to first page when searching
            } as Partial<typeof currentSearch>);
        },
        [baseHook]
    );

    /**
     * Update sorting
     * @param field - Field to sort by
     * @param direction - Sort direction
     */
    const setSort = useCallback(
        (field: string, direction: 'asc' | 'desc' = 'asc') => {
            baseHook.updateSearch({
                sort: field,
                order: direction,
                page: 1 // Reset to first page when sorting
            } as Partial<typeof currentSearch>);
        },
        [baseHook]
    );

    /**
     * Update filters
     * @param filters - Filter object
     */
    const setFilters = useCallback(
        (filters: Record<string, unknown>) => {
            baseHook.updateSearch({
                filters,
                page: 1 // Reset to first page when filtering
            } as Partial<typeof currentSearch>);
        },
        [baseHook]
    );

    return {
        ...baseHook,

        // List-specific methods
        goToPage,
        setSearchQuery,
        setSort,
        setFilters
    };
};

/**
 * Hook specifically for entity detail search parameters
 */
export const useEntityDetailSearch = (
    currentSearch: Parameters<typeof useEntitySearch>[0],
    schema: Parameters<typeof useEntitySearch>[1],
    defaults: Parameters<typeof useEntitySearch>[2] = {}
) => {
    const baseHook = useEntitySearch(currentSearch, schema, defaults);

    /**
     * Switch to a different tab
     * @param tab - Tab name
     */
    const switchTab = useCallback(
        (tab: string) => {
            baseHook.updateParam('tab' as keyof typeof currentSearch, tab);
        },
        [baseHook]
    );

    /**
     * Toggle edit mode
     */
    const toggleEdit = useCallback(() => {
        baseHook.toggleParam('edit' as keyof typeof currentSearch);
    }, [baseHook]);

    /**
     * Set layout mode
     * @param layout - Layout preference
     */
    const setLayout = useCallback(
        (layout: string) => {
            baseHook.updateParam('layout' as keyof typeof currentSearch, layout);
        },
        [baseHook]
    );

    return {
        ...baseHook,

        // Detail-specific methods
        switchTab,
        toggleEdit,
        setLayout
    };
};
