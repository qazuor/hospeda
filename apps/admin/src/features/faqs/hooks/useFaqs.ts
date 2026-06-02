/**
 * useFaqs — TanStack Query hooks for FAQ CRUD operations on destinations and accommodations.
 *
 * Exposes:
 *  - useFaqList(entityType, parentId)   → list query
 *  - useFaqCreate(entityType, parentId) → create mutation
 *  - useFaqUpdate(entityType, parentId) → update mutation
 *  - useFaqDelete(entityType, parentId) → delete mutation
 *  - useFaqReorder(entityType, parentId)→ reorder mutation
 *
 * All mutations invalidate the list query on success.
 */

import { fetchApi } from '@/lib/api/client';
import type { FaqCreatePayloadType, FaqUpdatePayloadType } from '@repo/schemas';
import type { FaqReorderPayload } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** Supported entity types for FAQ management. */
export type FaqEntityType = 'destinations' | 'accommodations';

/** Shape returned by the admin FAQs list endpoint. */
export interface FaqItem {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
    readonly category?: string | null;
    readonly displayOrder?: number | null;
    readonly createdAt?: string | null;
    readonly updatedAt?: string | null;
}

/**
 * Query key factory for FAQ queries.
 * Centralises key generation so invalidations are consistent.
 */
export const faqQueryKeys = {
    all: (entityType: FaqEntityType, parentId: string) => ['faqs', entityType, parentId] as const,
    list: (entityType: FaqEntityType, parentId: string) =>
        [...faqQueryKeys.all(entityType, parentId), 'list'] as const
};

const faqEndpoint = (entityType: FaqEntityType, parentId: string) =>
    `/api/v1/admin/${entityType}/${parentId}/faqs`;

/**
 * Fetches the FAQ list for a given parent entity.
 *
 * @param entityType - 'destinations' or 'accommodations'
 * @param parentId   - UUID of the parent entity
 */
export function useFaqList(entityType: FaqEntityType, parentId: string) {
    return useQuery({
        queryKey: faqQueryKeys.list(entityType, parentId),
        queryFn: async () => {
            const response = await fetchApi<unknown>({
                path: faqEndpoint(entityType, parentId)
            });
            // API returns { success: true, data: { faqs: FaqItem[] } }
            const body = response.data as { data?: { faqs?: FaqItem[] } };
            return body.data?.faqs ?? [];
        },
        enabled: Boolean(parentId),
        staleTime: 2 * 60 * 1000
    });
}

/**
 * Mutation to create a new FAQ entry under a parent entity.
 *
 * @param entityType - 'destinations' or 'accommodations'
 * @param parentId   - UUID of the parent entity
 */
export function useFaqCreate(entityType: FaqEntityType, parentId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: FaqCreatePayloadType) => {
            const response = await fetchApi<unknown>({
                path: faqEndpoint(entityType, parentId),
                method: 'POST',
                body: payload
            });
            const body = response.data as { data?: { faq?: FaqItem } };
            return body.data?.faq as FaqItem;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: faqQueryKeys.list(entityType, parentId)
            });
        }
    });
}

/**
 * Mutation to update an existing FAQ entry.
 *
 * @param entityType - 'destinations' or 'accommodations'
 * @param parentId   - UUID of the parent entity
 */
export function useFaqUpdate(entityType: FaqEntityType, parentId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            faqId,
            payload
        }: {
            readonly faqId: string;
            readonly payload: FaqUpdatePayloadType;
        }) => {
            const response = await fetchApi<unknown>({
                path: `${faqEndpoint(entityType, parentId)}/${faqId}`,
                method: 'PUT',
                body: payload
            });
            const body = response.data as { data?: { faq?: FaqItem } };
            return body.data?.faq as FaqItem;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: faqQueryKeys.list(entityType, parentId)
            });
        }
    });
}

/**
 * Mutation to delete a FAQ entry.
 *
 * @param entityType - 'destinations' or 'accommodations'
 * @param parentId   - UUID of the parent entity
 */
export function useFaqDelete(entityType: FaqEntityType, parentId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (faqId: string) => {
            await fetchApi({
                path: `${faqEndpoint(entityType, parentId)}/${faqId}`,
                method: 'DELETE'
            });
            return faqId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: faqQueryKeys.list(entityType, parentId)
            });
        }
    });
}

/**
 * Mutation to reorder FAQs via the PATCH .../faqs/reorder endpoint.
 *
 * On both success and failure the FAQ list is refetched from the server so
 * that a failed reorder snaps the UI back to the persisted order instead of
 * keeping the optimistic (un-persisted) sequence under an error banner.
 *
 * @param entityType - 'destinations' or 'accommodations'
 * @param parentId   - UUID of the parent entity
 */
export function useFaqReorder(entityType: FaqEntityType, parentId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: FaqReorderPayload) => {
            await fetchApi({
                path: `${faqEndpoint(entityType, parentId)}/reorder`,
                method: 'PATCH',
                body: payload
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: faqQueryKeys.list(entityType, parentId)
            });
        }
    });
}
