import type {
    LivePermanentGrantResponse,
    PermanentGrantAnchorBody,
    PermanentGrantAnchorResponse,
    PermanentGrantCreateRequest,
    PermanentGrantCreateResponse,
    PermanentGrantPreviewResponse,
    PermanentGrantRevocationPreviewResponse,
    PermanentGrantRevocationResponse
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

export const buildLivePermanentGrantPath = (userId: string) =>
    `/api/v1/admin/billing-permanent-grants/by-beneficiary/${userId}`;
export const buildPermanentGrantPath = () => '/api/v1/admin/billing-permanent-grants';
export const buildPermanentGrantPreviewPath = () =>
    '/api/v1/admin/billing-permanent-grants/preview';
export const buildPermanentGrantAnchorPath = (permanentGrantId: string) =>
    `/api/v1/admin/billing-permanent-grants/${permanentGrantId}/anchors`;
export const buildPermanentGrantAnchorPreviewPath = (permanentGrantId: string) =>
    `/api/v1/admin/billing-permanent-grants/${permanentGrantId}/anchors/preview`;
export const buildPermanentGrantRevocationPath = (permanentGrantId: string) =>
    `/api/v1/admin/billing-permanent-grants/${permanentGrantId}/revocation`;

const liveKey = (userId: string) => ['billing-permanent-grants', 'live', userId] as const;
const previewKey = (body: PermanentGrantCreateRequest | null) =>
    ['billing-permanent-grants', 'grant-preview', body] as const;
const anchorPreviewKey = (permanentGrantId: string, body: PermanentGrantAnchorBody | null) =>
    ['billing-permanent-grants', 'anchor-preview', permanentGrantId, body] as const;
const revocationPreviewKey = (permanentGrantId: string) =>
    ['billing-permanent-grants', 'revocation-preview', permanentGrantId] as const;

export function useLivePermanentGrant({ userId, enabled }: { userId: string; enabled: boolean }) {
    return useQuery({
        queryKey: liveKey(userId),
        queryFn: async (): Promise<LivePermanentGrantResponse> =>
            (
                await fetchApi<{ data: LivePermanentGrantResponse }>({
                    path: buildLivePermanentGrantPath(userId)
                })
            ).data.data,
        enabled: enabled && userId.length > 0,
        retry: false,
        staleTime: 0
    });
}

export function usePermanentGrantPreview({
    body,
    enabled
}: {
    body: PermanentGrantCreateRequest | null;
    enabled: boolean;
}) {
    return useQuery({
        queryKey: previewKey(body),
        queryFn: async (): Promise<PermanentGrantPreviewResponse> =>
            (
                await fetchApi<{ data: PermanentGrantPreviewResponse }>({
                    path: buildPermanentGrantPreviewPath(),
                    method: 'POST',
                    body
                })
            ).data.data,
        enabled: enabled && body !== null,
        retry: false,
        staleTime: 0
    });
}

export function usePermanentGrant() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (
            body: PermanentGrantCreateRequest
        ): Promise<PermanentGrantCreateResponse> =>
            (
                await fetchApi<{ data: PermanentGrantCreateResponse }>({
                    path: buildPermanentGrantPath(),
                    method: 'POST',
                    body
                })
            ).data.data,
        onSuccess: (_result, body) => {
            client.invalidateQueries({ queryKey: previewKey(body) });
            client.invalidateQueries({ queryKey: liveKey(body.beneficiaryUserId) });
        }
    });
}

export function usePermanentGrantAnchorPreview({
    permanentGrantId,
    body,
    enabled
}: {
    permanentGrantId: string;
    body: PermanentGrantAnchorBody | null;
    enabled: boolean;
}) {
    return useQuery({
        queryKey: anchorPreviewKey(permanentGrantId, body),
        queryFn: async (): Promise<PermanentGrantPreviewResponse> =>
            (
                await fetchApi<{ data: PermanentGrantPreviewResponse }>({
                    path: buildPermanentGrantAnchorPreviewPath(permanentGrantId),
                    method: 'POST',
                    body
                })
            ).data.data,
        enabled: enabled && permanentGrantId.length > 0 && body !== null,
        retry: false,
        staleTime: 0
    });
}

export function usePermanentGrantAnchor() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({
            permanentGrantId,
            body
        }: {
            permanentGrantId: string;
            body: PermanentGrantAnchorBody;
            userId: string;
        }): Promise<PermanentGrantAnchorResponse> =>
            (
                await fetchApi<{ data: PermanentGrantAnchorResponse }>({
                    path: buildPermanentGrantAnchorPath(permanentGrantId),
                    method: 'POST',
                    body
                })
            ).data.data,
        onSuccess: (_result, { permanentGrantId, body, userId }) => {
            client.invalidateQueries({ queryKey: anchorPreviewKey(permanentGrantId, body) });
            client.invalidateQueries({ queryKey: liveKey(userId) });
        }
    });
}

export function usePermanentGrantRevocationPreview({
    permanentGrantId,
    enabled
}: {
    permanentGrantId: string;
    enabled: boolean;
}) {
    return useQuery({
        queryKey: revocationPreviewKey(permanentGrantId),
        queryFn: async (): Promise<PermanentGrantRevocationPreviewResponse> =>
            (
                await fetchApi<{ data: PermanentGrantRevocationPreviewResponse }>({
                    path: buildPermanentGrantRevocationPath(permanentGrantId)
                })
            ).data.data,
        enabled: enabled && permanentGrantId.length > 0,
        retry: false,
        staleTime: 0
    });
}

export function usePermanentGrantRevocation() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({
            permanentGrantId,
            reason
        }: {
            permanentGrantId: string;
            userId: string;
            reason: string;
        }): Promise<PermanentGrantRevocationResponse> =>
            (
                await fetchApi<{ data: PermanentGrantRevocationResponse }>({
                    path: buildPermanentGrantRevocationPath(permanentGrantId),
                    method: 'POST',
                    body: { reason: reason.trim() }
                })
            ).data.data,
        onSuccess: (_result, { permanentGrantId, userId }) => {
            client.invalidateQueries({ queryKey: revocationPreviewKey(permanentGrantId) });
            client.invalidateQueries({ queryKey: liveKey(userId) });
        }
    });
}
