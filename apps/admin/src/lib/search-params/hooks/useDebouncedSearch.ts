import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';

/**
 * Hook for debounced search parameter updates
 * Useful for search inputs that shouldn't update the URL on every keystroke
 */
export const useDebouncedSearch = <TSchema extends z.ZodSchema>(
    currentValue: string | undefined,
    updateSearch: (updates: Partial<z.infer<TSchema>>) => void,
    options: {
        readonly delay?: number;
        readonly minLength?: number;
        readonly searchKey?: keyof z.infer<TSchema>;
    } = {}
) => {
    const { delay = 300, minLength = 0, searchKey = 'search' as keyof z.infer<TSchema> } = options;

    // Local state for the input value
    const [inputValue, setInputValue] = useState(currentValue || '');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update local state when external value changes
    useEffect(() => {
        setInputValue(currentValue || '');
    }, [currentValue]);

    /**
     * Handle input change with debouncing
     */
    const handleInputChange = useCallback(
        (value: string) => {
            setInputValue(value);

            // Clear existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout for debounced update
            timeoutRef.current = setTimeout(() => {
                if (value.length >= minLength) {
                    updateSearch({
                        [searchKey]: value,
                        page: 1 // Reset to first page when searching
                    } as Partial<z.infer<TSchema>>);
                } else if (value.length === 0 && currentValue) {
                    // Clear search when input is empty
                    updateSearch({
                        [searchKey]: undefined,
                        page: 1
                    } as Partial<z.infer<TSchema>>);
                }
            }, delay);
        },
        [updateSearch, searchKey, delay, minLength, currentValue]
    );

    /**
     * Clear the search immediately
     */
    const clearSearch = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setInputValue('');
        updateSearch({
            [searchKey]: undefined,
            page: 1
        } as Partial<z.infer<TSchema>>);
    }, [updateSearch, searchKey]);

    /**
     * Force immediate search update (bypass debounce)
     */
    const forceSearch = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        if (inputValue.length >= minLength) {
            updateSearch({
                [searchKey]: inputValue,
                page: 1
            } as Partial<z.infer<TSchema>>);
        }
    }, [updateSearch, searchKey, inputValue, minLength]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        inputValue,
        setInputValue: handleInputChange,
        clearSearch,
        forceSearch,
        isPending: timeoutRef.current !== undefined
    };
};

/**
 * Hook for debounced filter updates
 * Similar to search but for filter objects
 */
export const useDebouncedFilters = <TSchema extends z.ZodSchema>(
    currentFilters: Record<string, unknown> | undefined,
    updateSearch: (updates: Partial<z.infer<TSchema>>) => void,
    options: {
        readonly delay?: number;
        readonly filtersKey?: keyof z.infer<TSchema>;
    } = {}
) => {
    const { delay = 500, filtersKey = 'filters' as keyof z.infer<TSchema> } = options;

    const [localFilters, setLocalFilters] = useState(currentFilters || {});
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update local state when external filters change
    useEffect(() => {
        setLocalFilters(currentFilters || {});
    }, [currentFilters]);

    /**
     * Update a single filter with debouncing
     */
    const updateFilter = useCallback(
        (key: string, value: unknown) => {
            const newFilters = { ...localFilters, [key]: value };

            // Remove undefined/null values
            if (value === undefined || value === null || value === '') {
                delete newFilters[key];
            }

            setLocalFilters(newFilters);

            // Clear existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout for debounced update
            timeoutRef.current = setTimeout(() => {
                updateSearch({
                    [filtersKey]: Object.keys(newFilters).length > 0 ? newFilters : undefined,
                    page: 1 // Reset to first page when filtering
                } as Partial<z.infer<TSchema>>);
            }, delay);
        },
        [localFilters, updateSearch, filtersKey, delay]
    );

    /**
     * Update multiple filters at once
     */
    const updateFilters = useCallback(
        (filters: Record<string, unknown>) => {
            const newFilters = { ...localFilters, ...filters };

            // Remove undefined/null values
            for (const key of Object.keys(newFilters)) {
                if (
                    newFilters[key] === undefined ||
                    newFilters[key] === null ||
                    newFilters[key] === ''
                ) {
                    delete newFilters[key];
                }
            }

            setLocalFilters(newFilters);

            // Clear existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout for debounced update
            timeoutRef.current = setTimeout(() => {
                updateSearch({
                    [filtersKey]: Object.keys(newFilters).length > 0 ? newFilters : undefined,
                    page: 1
                } as Partial<z.infer<TSchema>>);
            }, delay);
        },
        [localFilters, updateSearch, filtersKey, delay]
    );

    /**
     * Clear all filters
     */
    const clearFilters = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setLocalFilters({});
        updateSearch({
            [filtersKey]: undefined,
            page: 1
        } as Partial<z.infer<TSchema>>);
    }, [updateSearch, filtersKey]);

    /**
     * Force immediate filter update (bypass debounce)
     */
    const forceUpdate = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        updateSearch({
            [filtersKey]: Object.keys(localFilters).length > 0 ? localFilters : undefined,
            page: 1
        } as Partial<z.infer<TSchema>>);
    }, [updateSearch, filtersKey, localFilters]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        filters: localFilters,
        updateFilter,
        updateFilters,
        clearFilters,
        forceUpdate,
        isPending: timeoutRef.current !== undefined
    };
};
