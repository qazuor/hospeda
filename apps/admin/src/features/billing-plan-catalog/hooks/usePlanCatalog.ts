import type {
    CreatePlanRequest,
    PlanPublicationConfirmation,
    PlanVersionContentInput,
    PublishedPlanVersion
} from '@repo/schemas';
import {
    AdminPlanCatalogResponseSchema,
    CreatePlanRequestSchema,
    PlanPublicationConfirmationSchema,
    PublishedPlanVersionSchema
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Cache key for one vertical's admin plan catalog. */
export function planCatalogQueryKey(vertical: string) {
    return ['admin-plan-catalog', vertical] as const;
}

/** Reads and validates one vertical's full admin plan catalog. */
export function useAdminPlanCatalog({ vertical }: { readonly vertical: string }) {
    return useQuery({
        queryKey: planCatalogQueryKey(vertical),
        queryFn: async () => {
            const response = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/plan-catalog/plans?vertical=${vertical}`
            });
            return AdminPlanCatalogResponseSchema.parse(response.data.data);
        },
        retry: false
    });
}

/** Requests the server's key-by-key publication preview. */
export function usePreviewPlanVersion() {
    return useMutation({
        mutationFn: async ({
            planId,
            content
        }: {
            readonly planId: string;
            readonly content: PlanVersionContentInput;
        }): Promise<PlanPublicationConfirmation> => {
            const response = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/plan-catalog/plans/${planId}/versions/preview`,
                method: 'POST',
                body: content
            });
            return PlanPublicationConfirmationSchema.parse(response.data.data);
        },
        retry: false
    });
}

/** Publishes a reviewed version and refreshes the selected catalog. */
export function usePublishPlanVersion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            planId,
            content
        }: {
            readonly planId: string;
            readonly content: PlanVersionContentInput;
        }): Promise<PublishedPlanVersion> => {
            const response = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/plan-catalog/plans/${planId}/versions`,
                method: 'POST',
                body: { ...content, confirmed: true }
            });
            return PublishedPlanVersionSchema.parse(response.data.data);
        },
        onSuccess: (_data, _variables) =>
            queryClient.invalidateQueries({ queryKey: ['admin-plan-catalog'] }),
        retry: false
    });
}

/** Creates a plan and refreshes the catalog for its vertical. */
export function useCreatePlan() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: CreatePlanRequest) => {
            const parsed = CreatePlanRequestSchema.parse(body);
            const response = await fetchApi<{ data: unknown }>({
                path: '/api/v1/admin/plan-catalog/plans',
                method: 'POST',
                body: parsed
            });
            return response.data.data;
        },
        onSuccess: (_data, variables) =>
            queryClient.invalidateQueries({ queryKey: planCatalogQueryKey(variables.vertical) }),
        retry: false
    });
}
