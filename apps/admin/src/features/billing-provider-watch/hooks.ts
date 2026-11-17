/**
 * TanStack Query hooks of the provider watch battery admin screens (HOS-1512): the provider
 * account of this environment, the one-run authorization and the response-shape review.
 *
 * @module features/billing-provider-watch/hooks
 */
import type {
    ProviderWatchAcceptShapeInput,
    ProviderWatchAccount,
    ProviderWatchAuthorizeInput,
    ProviderWatchShapeReview
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Query keys of the provider watch screens. */
export const providerWatchQueryKeys = {
    account: ['provider-watch', 'account'] as const,
    shapes: ['provider-watch', 'shapes'] as const
} as const;

async function send<T>(args: {
    readonly path: string;
    readonly method?: 'GET' | 'POST';
    readonly body?: unknown;
}): Promise<T> {
    const response = await fetchApi<unknown>({
        path: args.path,
        ...(args.method ? { method: args.method } : {}),
        ...(args.body === undefined ? {} : { body: args.body })
    });
    return (response.data as { data: T }).data;
}

/**
 * Reads the provider account this environment's token belongs to, for the owner to confirm.
 *
 * @param args.enabled - Only the owner (with the manage permission) can read it
 */
export function useProviderWatchAccount(args: { readonly enabled: boolean }) {
    return useQuery({
        queryKey: providerWatchQueryKeys.account,
        queryFn: () => send<ProviderWatchAccount>({ path: '/api/v1/admin/provider-watch/account' }),
        enabled: args.enabled,
        retry: false,
        staleTime: 0
    });
}

/** Writes the one-run authorization with the account id the owner confirmed. */
export function useAuthorizeProviderWatch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: ProviderWatchAuthorizeInput) =>
            send<unknown>({
                path: '/api/v1/admin/provider-watch/authorization',
                method: 'POST',
                body: input
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
        }
    });
}

/**
 * Reads, per measurement, the accepted shapes against what the latest completed run observed.
 *
 * @param args.enabled - Only the owner can read it
 */
export function useProviderWatchShapes(args: { readonly enabled: boolean }) {
    return useQuery({
        queryKey: providerWatchQueryKeys.shapes,
        queryFn: async () =>
            (
                await send<{ items: ProviderWatchShapeReview[] }>({
                    path: '/api/v1/admin/provider-watch/shapes'
                })
            ).items,
        enabled: args.enabled,
        staleTime: 30_000
    });
}

/** Accepts what a run observed for a measurement: the only way the baseline advances. */
export function useAcceptProviderWatchShape() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { readonly measurementId: string } & ProviderWatchAcceptShapeInput) =>
            send<{ acceptedAt: string }>({
                path: `/api/v1/admin/provider-watch/shapes/${encodeURIComponent(input.measurementId)}/accept`,
                method: 'POST',
                body: { account: input.account, runId: input.runId }
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: providerWatchQueryKeys.shapes });
        }
    });
}
