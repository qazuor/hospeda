import type { ReconciliationMarkListResponseSchema } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import { fetchApi } from '@/lib/api/client';

type Response = z.infer<typeof ReconciliationMarkListResponseSchema>;

/** Builds the paginated actionable reconciliation marks API path. */
export function buildReconciliationMarksPath({
    page,
    pageSize
}: {
    page: number;
    pageSize: number;
}): string {
    return `/api/v1/admin/billing-reconciliation/marks?page=${page}&pageSize=${pageSize}`;
}

/** Reads one page of actionable reconciliation marks. */
export function useReconciliationMarks({ page, pageSize }: { page: number; pageSize: number }) {
    return useQuery({
        queryKey: ['billing-reconciliation', 'marks', page, pageSize],
        queryFn: async (): Promise<Response> => {
            const response = await fetchApi<{ data: Response }>({
                path: buildReconciliationMarksPath({ page, pageSize })
            });
            return response.data.data;
        },
        retry: false
    });
}
