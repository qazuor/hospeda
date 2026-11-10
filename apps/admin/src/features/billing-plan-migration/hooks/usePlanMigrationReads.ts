import type { PlanMigrationListQuery } from '@repo/schemas';
import {
    PlanMigrationCancelInputSchema,
    PlanMigrationCancelResultSchema,
    PlanMigrationDetailSchema,
    PlanMigrationListQuerySchema,
    PlanMigrationListSchema
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

const path = '/api/v1/admin/plan-migrations';
/** Cache prefix for paginated migration lists. */
export const PLAN_MIGRATION_LIST_KEY = ['admin-plan-migrations'] as const;
/** Cache prefix for one migration detail. */
export const PLAN_MIGRATION_DETAIL_KEY = ['admin-plan-migration-detail'] as const;

/** Reads one validated page of announced migrations. */
export function usePlanMigrationList({ page, pageSize }: PlanMigrationListQuery) {
    return useQuery({
        queryKey: [...PLAN_MIGRATION_LIST_KEY, page, pageSize],
        queryFn: async () => {
            const query = PlanMigrationListQuerySchema.parse({ page, pageSize });
            const response = await fetchApi<{ data: unknown }>({
                path: `${path}?page=${query.page}&pageSize=${query.pageSize}`
            });
            const data = response.data.data as { items?: Array<Record<string, unknown>> };
            return PlanMigrationListSchema.parse({
                ...data,
                items: data.items?.map((item) => ({
                    ...item,
                    announcedAt: new Date(String(item.announcedAt)),
                    cancelledAt: item.cancelledAt ? new Date(String(item.cancelledAt)) : null
                }))
            });
        },
        retry: false
    });
}

/** Reads a validated migration and its scope rows. */
export function usePlanMigrationDetail({ id }: { readonly id: string | null }) {
    return useQuery({
        queryKey: [...PLAN_MIGRATION_DETAIL_KEY, id],
        enabled: id !== null,
        queryFn: async () => {
            const parsed = PlanMigrationCancelInputSchema.parse({ planMigrationId: id });
            const response = await fetchApi<{ data: Record<string, unknown> }>({
                path: `${path}/${parsed.planMigrationId}`
            });
            const data = response.data.data;
            return PlanMigrationDetailSchema.parse({
                ...data,
                announcedAt: new Date(String(data.announcedAt)),
                cancelledAt: data.cancelledAt ? new Date(String(data.cancelledAt)) : null,
                rows: (data.rows as Array<Record<string, unknown>>).map((row) => ({
                    ...row,
                    appliedAt: row.appliedAt ? new Date(String(row.appliedAt)) : null
                }))
            });
        },
        retry: false
    });
}

/** Cancels an announced migration and refreshes both read surfaces. */
export function useCancelPlanMigration() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id }: { readonly id: string }) => {
            const input = PlanMigrationCancelInputSchema.parse({ planMigrationId: id });
            const response = await fetchApi<{ data: Record<string, unknown> }>({
                path: `${path}/${input.planMigrationId}/cancel`,
                method: 'POST'
            });
            const data = response.data.data;
            return PlanMigrationCancelResultSchema.parse({
                ...data,
                cancelledAt: new Date(String(data.cancelledAt))
            });
        },
        onSuccess: async (_result, { id }) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: PLAN_MIGRATION_LIST_KEY }),
                queryClient.invalidateQueries({ queryKey: [...PLAN_MIGRATION_DETAIL_KEY, id] })
            ]);
        },
        retry: false
    });
}
