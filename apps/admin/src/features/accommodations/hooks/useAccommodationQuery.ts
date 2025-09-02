import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccommodationCore } from '../schemas/accommodation-client.schema';
import {
    type AccommodationListFilters,
    type AccommodationSearchFilters,
    accommodationQueryKeys,
    invalidateAccommodationDetail,
    invalidateAccommodationLists
} from './accommodationQueryKeys';

/**
 * Custom hooks for accommodation data fetching and mutations
 *
 * These hooks provide a clean interface for interacting with accommodation data,
 * including proper caching, error handling, and optimistic updates.
 */

/**
 * Hook for fetching a single accommodation by ID
 */
export const useAccommodationQuery = (
    id: string,
    options?: {
        enabled?: boolean;
        staleTime?: number;
        cacheTime?: number;
    }
) => {
    return useQuery({
        queryKey: accommodationQueryKeys.detail(id),
        queryFn: async (): Promise<AccommodationCore> => {
            const response = await fetchApi({ path: `/api/v1/public/accommodations/${id}` });

            // The API returns: { success: true, data: AccommodationCore, metadata: {...} }
            // We need to extract just the data part
            const apiResponse = response.data as {
                success: boolean;
                data: AccommodationCore;
                metadata: unknown;
            };

            // Return only the accommodation data, not the full API response
            return apiResponse.data;
        },
        enabled: options?.enabled ?? Boolean(id),
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
        gcTime: options?.cacheTime ?? 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error) => {
            // Don't retry on 404 errors
            // biome-ignore lint/suspicious/noExplicitAny: Error type from fetch is unknown
            if ((error as any)?.status === 404) return false;
            return failureCount < 3;
        }
    });
};

/**
 * Hook for fetching accommodation list with filters
 */
export const useAccommodationListQuery = (
    filters?: AccommodationListFilters,
    options?: {
        enabled?: boolean;
        keepPreviousData?: boolean;
    }
) => {
    return useQuery({
        queryKey: accommodationQueryKeys.list(filters),
        queryFn: async (): Promise<{
            accommodations: AccommodationCore[];
            total: number;
            page: number;
            limit: number;
        }> => {
            const searchParams = new URLSearchParams();

            if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                    if (value !== undefined && value !== null) {
                        if (Array.isArray(value)) {
                            for (const v of value) {
                                searchParams.append(key, String(v));
                            }
                        } else if (typeof value === 'object') {
                            searchParams.append(key, JSON.stringify(value));
                        } else {
                            searchParams.append(key, String(value));
                        }
                    }
                }
            }

            const response = await fetchApi({
                path: `/api/v1/public/accommodations?${searchParams.toString()}`
            });
            const apiResponse = response.data as {
                items: AccommodationCore[];
                pagination: {
                    page: number;
                    limit: number;
                    total: number;
                    totalPages: number;
                };
            };
            return {
                accommodations: apiResponse.items,
                total: apiResponse.pagination.total,
                page: apiResponse.pagination.page,
                limit: apiResponse.pagination.limit
            };
        },
        enabled: options?.enabled ?? true,
        placeholderData: options?.keepPreviousData ? (previousData) => previousData : undefined,
        staleTime: 2 * 60 * 1000, // 2 minutes for lists
        gcTime: 5 * 60 * 1000 // 5 minutes for lists
    });
};

/**
 * Hook for searching accommodations
 */
export const useAccommodationSearchQuery = (
    query: string,
    filters?: AccommodationSearchFilters,
    options?: {
        enabled?: boolean;
        debounceMs?: number;
    }
) => {
    return useQuery({
        queryKey: accommodationQueryKeys.search(query, filters),
        queryFn: async (): Promise<AccommodationCore[]> => {
            const searchParams = new URLSearchParams({
                q: query
            });

            if (filters) {
                for (const [key, value] of Object.entries(filters)) {
                    if (value !== undefined && value !== null) {
                        if (Array.isArray(value)) {
                            for (const v of value) {
                                searchParams.append(key, String(v));
                            }
                        } else {
                            searchParams.append(key, String(value));
                        }
                    }
                }
            }

            const response = await fetchApi({
                path: `/api/v1/public/accommodations/search?${searchParams.toString()}`
            });
            const apiResponse = response.data as { items: AccommodationCore[] };
            return apiResponse.items;
        },
        enabled: (options?.enabled ?? true) && query.length >= 2,
        staleTime: 30 * 1000, // 30 seconds for search
        gcTime: 2 * 60 * 1000 // 2 minutes for search
    });
};

/**
 * Hook for fetching accommodation section data
 * Useful for lazy loading specific sections
 */
export const useAccommodationSectionQuery = (
    id: string,
    sectionId: string,
    options?: {
        enabled?: boolean;
    }
) => {
    return useQuery({
        queryKey: accommodationQueryKeys.section(id, sectionId),
        queryFn: async (): Promise<Record<string, unknown>> => {
            const response = await fetchApi({
                path: `/api/v1/public/accommodations/${id}/sections/${sectionId}`
            });
            return response.data as Record<string, unknown>;
        },
        enabled: options?.enabled ?? Boolean(id && sectionId),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes
    });
};

/**
 * Mutation hook for creating accommodations
 */
export const useCreateAccommodationMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<AccommodationCore>): Promise<AccommodationCore> => {
            const response = await fetchApi({
                path: '/api/v1/public/accommodations',
                method: 'POST',
                body: data
            });
            return response.data as AccommodationCore;
        },
        onSuccess: (newAccommodation) => {
            // Invalidate lists to show the new accommodation
            queryClient.invalidateQueries({ queryKey: invalidateAccommodationLists() });

            // Set the new accommodation in cache
            queryClient.setQueryData(
                accommodationQueryKeys.detail(newAccommodation.id as string),
                newAccommodation
            );
        }
    });
};

/**
 * Mutation hook for updating accommodations
 */
export const useUpdateAccommodationMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Partial<AccommodationCore>): Promise<AccommodationCore> => {
            const response = await fetchApi({
                path: `/api/v1/public/accommodations/${id}`,
                method: 'PATCH',
                body: data
            });

            // The API returns: { success: true, data: AccommodationCore, metadata: {...} }
            // We need to extract just the data part
            const apiResponse = response.data as {
                success: boolean;
                data: AccommodationCore;
                metadata: unknown;
            };

            return apiResponse.data;
        },
        onMutate: async (newData) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: accommodationQueryKeys.detail(id) });

            // Snapshot previous value
            const previousAccommodation = queryClient.getQueryData(
                accommodationQueryKeys.detail(id)
            );

            // Optimistically update
            queryClient.setQueryData(
                accommodationQueryKeys.detail(id),
                (old: AccommodationCore | undefined) => {
                    if (!old) return old;
                    return { ...old, ...newData };
                }
            );

            return { previousAccommodation };
        },
        onError: (_err, _newData, context) => {
            // Rollback on error
            if (context?.previousAccommodation) {
                queryClient.setQueryData(
                    accommodationQueryKeys.detail(id),
                    context.previousAccommodation
                );
            }
        },
        onSuccess: (updatedAccommodation) => {
            // Update the cache with the accommodation data
            queryClient.setQueryData(accommodationQueryKeys.detail(id), updatedAccommodation);

            // Invalidate lists to reflect changes
            queryClient.invalidateQueries({ queryKey: invalidateAccommodationLists() });
        }
    });
};

/**
 * Mutation hook for updating accommodation sections
 */
export const useUpdateAccommodationSectionMutation = (id: string, sectionId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Record<string, unknown>): Promise<Record<string, unknown>> => {
            const response = await fetchApi({
                path: `/api/v1/public/accommodations/${id}/sections/${sectionId}`,
                method: 'PATCH',
                body: data
            });
            return response.data as Record<string, unknown>;
        },
        onSuccess: (updatedSection) => {
            // Update section cache
            queryClient.setQueryData(accommodationQueryKeys.section(id, sectionId), updatedSection);

            // Invalidate main accommodation to reflect changes
            queryClient.invalidateQueries({ queryKey: invalidateAccommodationDetail(id) });
        }
    });
};

/**
 * Mutation hook for deleting accommodations
 */
export const useDeleteAccommodationMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string): Promise<void> => {
            await fetchApi({
                path: `/api/v1/public/accommodations/${id}`,
                method: 'DELETE'
            });
        },
        onSuccess: (_, deletedId) => {
            // Remove from cache
            queryClient.removeQueries({ queryKey: accommodationQueryKeys.detail(deletedId) });

            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: invalidateAccommodationLists() });
        }
    });
};

/**
 * Hook for async field validation
 */
export const useAccommodationValidation = () => {
    return {
        /**
         * Check if a field value is unique
         */
        checkUnique: (field: string, value: string, excludeId?: string) => {
            return useQuery({
                queryKey: accommodationQueryKeys.uniqueCheck(field, value, excludeId),
                queryFn: async (): Promise<{ isUnique: boolean }> => {
                    const searchParams = new URLSearchParams({
                        field,
                        value
                    });

                    if (excludeId) {
                        searchParams.append('excludeId', excludeId);
                    }

                    const response = await fetchApi({
                        path: `/api/v1/public/accommodations/validate/unique?${searchParams.toString()}`
                    });
                    return response.data as { isUnique: boolean };
                },
                enabled: Boolean(field && value),
                staleTime: 30 * 1000, // 30 seconds
                gcTime: 60 * 1000 // 1 minute
            });
        }
    };
};
