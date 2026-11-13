import type { AdminAddonCatalogResponse } from '@repo/schemas';
import {
    AddonVersionContentSchema,
    AddonVersionPublicationConfirmationSchema,
    AddonVersionPublicationPreviewRequestSchema,
    AddonVersionPublishedResponseSchema,
    AdminAddonCatalogResponseSchema,
    AdminAddonProductSchema,
    CreateAddonProductRequestSchema,
    CreateAddonRequestSchema,
    PublishAddonVersionRequestSchema
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { fetchApi } from '@/lib/api/client';

const catalogKey = ['admin-addon-catalog'] as const;
const CreatedAddonSchema = z.object({
    addon: z.object({ id: z.uuid() }),
    version: z.object({ id: z.uuid() })
});
const CreatedVersionSchema = z.object({ id: z.uuid() });
const CreatedProductSchema = AdminAddonProductSchema.extend({ addonId: z.uuid() });
const RetirementSchema = z.strictObject({
    productId: z.uuid(),
    retiredAt: z.iso.datetime().nullable()
});
type AddonCreate = typeof CreateAddonRequestSchema._output;
type ProductCreate = typeof CreateAddonProductRequestSchema._output;
type VersionContent = typeof AddonVersionContentSchema._output;
type PreviewInput = typeof AddonVersionPublicationPreviewRequestSchema._output;
type PublishInput = typeof PublishAddonVersionRequestSchema._output;

/** Reads the action 20 catalog. */
export function useAddonCatalog() {
    return useQuery({
        queryKey: catalogKey,
        queryFn: async (): Promise<AdminAddonCatalogResponse> => {
            const response = await fetchApi<{ data: unknown }>({
                path: '/api/v1/admin/addon-catalog'
            });
            return AdminAddonCatalogResponseSchema.parse(response.data.data);
        },
        retry: false
    });
}

/** Reads the persisted retirement state without changing the shared catalog response. */
export function useAddonProductRetirement(input: { readonly productId: string }) {
    return useQuery({
        queryKey: [...catalogKey, 'retirement', input.productId],
        queryFn: async () => {
            const response = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/billing-addon-products/${input.productId}/retirement`
            });
            return RetirementSchema.parse(response.data.data);
        },
        retry: false
    });
}

/** Retires or restores a product while preserving every acquired instance. */
export function useChangeAddonProductRetirement(input: { readonly productId: string }) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (retire: boolean) => {
            const response = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/billing-addon-products/${input.productId}/retirement`,
                method: retire ? 'POST' : 'DELETE'
            });
            return RetirementSchema.parse(response.data.data);
        },
        onSuccess: (state) =>
            queryClient.setQueryData([...catalogKey, 'retirement', input.productId], state),
        retry: false
    });
}

/** Creates identity and its first immutable version. */
export function useCreateAddon() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: AddonCreate) => {
            const response = await fetchApi<{
                data: { addon: { id: string }; version: { id: string } };
            }>({
                path: '/api/v1/admin/addon-catalog/addons',
                method: 'POST',
                body: CreateAddonRequestSchema.parse(input)
            });
            return CreatedAddonSchema.parse(response.data.data);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKey }),
        retry: false
    });
}

/** Creates the saleable product for an already created version. */
export function useCreateAddonProduct() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: ProductCreate) => {
            const response = await fetchApi<{ data: unknown }>({
                path: '/api/v1/admin/billing-addon-products',
                method: 'POST',
                body: CreateAddonProductRequestSchema.parse(input)
            });
            return CreatedProductSchema.parse(response.data.data);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKey }),
        retry: false
    });
}

/** Appends a new immutable version before preview. */
export function useCreateAddonVersion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ addonId, content }: { addonId: string; content: VersionContent }) => {
            const response = await fetchApi<{ data: { id: string } }>({
                path: `/api/v1/admin/addon-catalog/addons/${addonId}/versions`,
                method: 'POST',
                body: AddonVersionContentSchema.parse(content)
            });
            return CreatedVersionSchema.parse(response.data.data);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKey }),
        retry: false
    });
}

/** Previews the proposed version and price against the current product. */
export function usePreviewAddonVersion() {
    return useMutation({
        mutationFn: async ({ productId, input }: { productId: string; input: PreviewInput }) => {
            const response = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/billing-addon-products/${productId}/version-publication/preview`,
                method: 'POST',
                body: AddonVersionPublicationPreviewRequestSchema.parse(input)
            });
            return AddonVersionPublicationConfirmationSchema.parse(response.data.data);
        },
        retry: false
    });
}

/** Publishes exactly the reviewed version with strict current-state expectations. */
export function usePublishAddonVersion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ productId, input }: { productId: string; input: PublishInput }) => {
            const response = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/billing-addon-products/${productId}/version-publication`,
                method: 'POST',
                body: PublishAddonVersionRequestSchema.parse(input)
            });
            return AddonVersionPublishedResponseSchema.parse(response.data.data);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogKey }),
        retry: false
    });
}
