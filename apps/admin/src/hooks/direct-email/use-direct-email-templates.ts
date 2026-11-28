/**
 * @file use-direct-email-templates.ts
 * @description TanStack Query hooks for the direct email template endpoints (HOS-2685).
 */

import type {
    CreateDirectEmailTemplate,
    DirectEmailTemplate,
    UpdateDirectEmailTemplate
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import {
    buildListQuery,
    type DirectEmailListFilters,
    type DirectEmailPage
} from './use-direct-emails';

const BASE_PATH = '/api/v1/admin/direct-email-templates';

/** Query key factory for direct email templates. */
export const directEmailTemplateQueryKeys = {
    all: ['direct-email-templates'] as const,
    lists: () => [...directEmailTemplateQueryKeys.all, 'list'] as const,
    list: (filters: DirectEmailListFilters) =>
        [...directEmailTemplateQueryKeys.lists(), filters] as const
};

interface Envelope<T> {
    readonly success: boolean;
    readonly data: T;
}

/** Paginated template list (also feeds the compose screen's template select). */
export function useDirectEmailTemplates(filters: DirectEmailListFilters = {}) {
    return useQuery({
        queryKey: directEmailTemplateQueryKeys.list(filters),
        queryFn: async () => {
            const result = await fetchApi<Envelope<DirectEmailPage<DirectEmailTemplate>>>({
                path: `${BASE_PATH}${buildListQuery({ filters })}`
            });
            return result.data.data;
        },
        staleTime: 30_000
    });
}

/** Creates a template. */
export function useCreateDirectEmailTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateDirectEmailTemplate) => {
            const result = await fetchApi<Envelope<DirectEmailTemplate>>({
                path: BASE_PATH,
                method: 'POST',
                body: input
            });
            return result.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: directEmailTemplateQueryKeys.lists() });
        }
    });
}

/** Updates a template (partial). */
export function useUpdateDirectEmailTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            readonly id: string;
            readonly data: UpdateDirectEmailTemplate;
        }) => {
            const result = await fetchApi<Envelope<DirectEmailTemplate>>({
                path: `${BASE_PATH}/${input.id}`,
                method: 'PATCH',
                body: input.data
            });
            return result.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: directEmailTemplateQueryKeys.lists() });
        }
    });
}

/** Soft-deletes a template (the API answers 204). */
export function useDeleteDirectEmailTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { readonly id: string }) => {
            await fetchApi<unknown>({ path: `${BASE_PATH}/${input.id}`, method: 'DELETE' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: directEmailTemplateQueryKeys.lists() });
        }
    });
}
