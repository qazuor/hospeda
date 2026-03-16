/**
 * TanStack Query hooks for ISR Revalidation API
 *
 * Provides typed query and mutation hooks that wrap the revalidation HTTP adapter.
 * All hooks follow the standard pattern used across the admin application:
 * queries for reads, mutations for writes, with automatic cache invalidation.
 *
 * @module hooks/useRevalidation
 */

import {
    getRevalidationConfigs,
    getRevalidationLogs,
    getRevalidationStats,
    manualRevalidate,
    revalidateEntity,
    updateRevalidationConfig,
} from '@/lib/revalidation-http-adapter';
import type {
    ManualRevalidateRequest,
    UpdateRevalidationConfigInput,
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Stable query key constants for all revalidation-related queries.
 * Use these when manually invalidating or pre-fetching revalidation data.
 */
export const REVALIDATION_QUERY_KEYS = {
    configs: ['revalidation', 'configs'] as const,
    logs: ['revalidation', 'logs'] as const,
    stats: ['revalidation', 'stats'] as const,
} as const;

/**
 * Fetches all revalidation configuration records (one per entity type).
 *
 * @returns TanStack Query result with `RevalidationConfig[]` data
 */
export function useRevalidationConfigs() {
    return useQuery({
        queryKey: REVALIDATION_QUERY_KEYS.configs,
        queryFn: getRevalidationConfigs,
    });
}

/**
 * Fetches recent revalidation log entries.
 *
 * @returns TanStack Query result with `RevalidationLog[]` data
 */
export function useRevalidationLogs() {
    return useQuery({
        queryKey: REVALIDATION_QUERY_KEYS.logs,
        queryFn: getRevalidationLogs,
    });
}

/**
 * Fetches aggregated revalidation statistics for the admin dashboard.
 *
 * @returns TanStack Query result with `RevalidationStats` data
 */
export function useRevalidationStats() {
    return useQuery({
        queryKey: REVALIDATION_QUERY_KEYS.stats,
        queryFn: getRevalidationStats,
    });
}

/**
 * Mutation hook for updating a revalidation configuration record.
 * Automatically invalidates the configs query on success.
 *
 * @returns TanStack Query mutation for `updateRevalidationConfig`
 */
export function useUpdateRevalidationConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            input,
        }: {
            readonly id: string;
            readonly input: UpdateRevalidationConfigInput;
        }) => updateRevalidationConfig(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.configs });
        },
    });
}

/**
 * Mutation hook for triggering a manual revalidation of specific URL paths.
 * Automatically invalidates logs and stats queries on success.
 *
 * @returns TanStack Query mutation for `manualRevalidate`
 */
export function useManualRevalidate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: ManualRevalidateRequest) => manualRevalidate(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.logs });
            queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.stats });
        },
    });
}

/**
 * Mutation hook for revalidating all paths associated with a specific entity instance.
 * Automatically invalidates the logs query on success.
 *
 * @returns TanStack Query mutation for `revalidateEntity`
 */
export function useRevalidateEntity() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            entityType,
            entityId,
        }: {
            readonly entityType: string;
            readonly entityId: string;
        }) => revalidateEntity(entityType, entityId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: REVALIDATION_QUERY_KEYS.logs });
        },
    });
}
