import {
    type ReconciliationMarkEventsResponseSchema,
    ReconciliationMarkParamsSchema
} from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import { fetchApi } from '@/lib/api/client';

type Response = z.infer<typeof ReconciliationMarkEventsResponseSchema>;

/** Builds the critical events API path for one mark. */
export function buildReconciliationMarkEventsPath({ markId }: { markId: string }): string {
    return `/api/v1/admin/billing-reconciliation/marks/${markId}/events`;
}

/** Reads a mark's critical events when its identifier is a UUID and enabled. */
export function useReconciliationMarkEvents({
    markId,
    enabled
}: {
    markId: string;
    enabled: boolean;
}) {
    const valid = ReconciliationMarkParamsSchema.safeParse({ markId }).success;
    return useQuery({
        queryKey: ['billing-reconciliation', 'events', markId],
        queryFn: async (): Promise<Response> => {
            const response = await fetchApi<{ data: Response }>({
                path: buildReconciliationMarkEventsPath({ markId })
            });
            return response.data.data;
        },
        enabled: enabled && valid,
        retry: false
    });
}
