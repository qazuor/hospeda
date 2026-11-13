import type { LaunchPlanMigrationRequest, PlanMigrationPreviewRequest } from '@repo/schemas';
import {
    LaunchPlanMigrationRequestSchema,
    PlanMigrationLaunchResponseSchema,
    PlanMigrationOptionsSchema,
    PlanMigrationPreviewRequestSchema,
    PlanMigrationPreviewSchema
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { PLAN_MIGRATION_LIST_KEY } from './usePlanMigrationReads';

const path = '/api/v1/admin/plan-migrations';

/** Reads action 17 source and destination options. */
export function usePlanMigrationOptions() {
    return useQuery({
        queryKey: ['admin-plan-migration-options'],
        queryFn: async () => {
            const response = await fetchApi<{ data: unknown }>({ path: `${path}/options` });
            return PlanMigrationOptionsSchema.parse(response.data.data);
        },
        retry: false
    });
}

/** Requests a fresh, validated cohort preview. */
export function usePreviewPlanMigration() {
    return useMutation({
        mutationFn: async (input: PlanMigrationPreviewRequest) => {
            const body = PlanMigrationPreviewRequestSchema.parse(input);
            const response = await fetchApi<{ data: Record<string, unknown> }>({
                path: `${path}/preview`,
                method: 'POST',
                body
            });
            const data = response.data.data;
            return PlanMigrationPreviewSchema.parse({
                ...data,
                announcedAt: new Date(String(data.announcedAt))
            });
        },
        retry: false
    });
}

/** Launches exactly the cohort identified by the preview fingerprint. */
export function useLaunchPlanMigration() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: LaunchPlanMigrationRequest) => {
            const body = LaunchPlanMigrationRequestSchema.parse(input);
            const response = await fetchApi<{ data: Record<string, unknown> }>({
                path,
                method: 'POST',
                body
            });
            const data = response.data.data;
            return PlanMigrationLaunchResponseSchema.parse({
                ...data,
                announcedAt: new Date(String(data.announcedAt))
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: PLAN_MIGRATION_LIST_KEY });
        },
        retry: false
    });
}
