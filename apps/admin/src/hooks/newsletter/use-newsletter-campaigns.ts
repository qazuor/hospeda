/**
 * @file use-newsletter-campaigns.ts
 * @description TanStack Query hooks for the admin newsletter campaign API
 * (SPEC-101 T-101-30). Covers all CRUD endpoints (T-101-27) plus the
 * action endpoints (T-101-28):
 *
 *   useNewsletterCampaigns(filters)  list
 *   useNewsletterCampaign(id)        get one
 *   useCreateCampaign()              POST /campaigns           → 201
 *   useUpdateCampaign(id)            PATCH /campaigns/:id      → 409 if not draft
 *   useDeleteCampaign()              DELETE /campaigns/:id     → 409 if sending/sent
 *   useTestSendCampaign(id)          POST /campaigns/:id/test-send
 *   useSendCampaign(id)              POST /campaigns/:id/send  → 202 / 200 / 409
 *   useCancelCampaign(id)            POST /campaigns/:id/cancel → 200 / 409
 *   useCampaignAudienceCount(id)     GET  /campaigns/:id/audience-count (send estimate)
 *
 * The metrics + errors queries live in their own files (use-campaign-metrics
 * and use-campaign-errors) because they have specialised polling /
 * pagination behaviour.
 */

import type {
    CreateNewsletterCampaign,
    NewsletterCampaign,
    NewsletterCampaignLocaleFilterEnum,
    NewsletterCampaignStatusEnum,
    NewsletterPreviewSelection,
    UpdateNewsletterCampaign
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { CampaignResolutionReport } from './use-campaign-resolution';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const newsletterCampaignQueryKeys = {
    all: ['newsletter-campaigns'] as const,
    lists: () => [...newsletterCampaignQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
        [...newsletterCampaignQueryKeys.lists(), filters] as const,
    details: () => [...newsletterCampaignQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...newsletterCampaignQueryKeys.details(), id] as const
};

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

interface NewsletterCampaignListResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: NewsletterCampaign[];
        readonly pagination: {
            readonly page: number;
            readonly pageSize: number;
            readonly total: number;
            readonly totalPages: number;
        };
    };
}

interface NewsletterCampaignItemResponse {
    readonly success: boolean;
    readonly data: NewsletterCampaign;
}

interface SendResponse {
    readonly success: boolean;
    readonly data: {
        readonly dispatched: boolean;
        readonly enqueued?: number;
        readonly softcapped?: number;
        readonly reason?: string;
        /** Dynamic resolution diagnostics, present when the campaign has dynamic blocks. */
        readonly report?: CampaignResolutionReport;
    };
}

interface CancelResponse {
    readonly success: boolean;
    readonly data: {
        readonly cancelled: boolean;
        readonly skipped: number;
    };
}

interface TestSendResponse {
    readonly success: boolean;
    readonly data: {
        readonly sent: true;
        readonly sentTo: string;
    };
}

/** Estimated audience of a campaign, computed with the same filter the send uses. */
export interface CampaignAudienceCount {
    /** Subscribers a send would enqueue now. */
    readonly eligible: number;
    /** Matching subscribers skipped by the frequency limit. */
    readonly softCapped: number;
    /** All active subscribers matching the language and content filters. */
    readonly totalCandidates: number;
}

interface AudienceCountResponse {
    readonly success: boolean;
    readonly data: CampaignAudienceCount;
}

/** Filters accepted by the admin campaign list endpoint. */
export interface NewsletterCampaignListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly campaignStatus?: NewsletterCampaignStatusEnum;
    readonly localeFilter?: NewsletterCampaignLocaleFilterEnum;
    /** Partial title match (case-insensitive). Maximum 255 characters. */
    readonly titleSearch?: string;
    /** Sort direction by createdAt — 'desc' (default) shows newest first. */
    readonly sort?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function buildCampaignQueryString(filters: NewsletterCampaignListFilters): string {
    const params = new URLSearchParams();
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
    if (filters.campaignStatus) params.set('campaignStatus', filters.campaignStatus);
    if (filters.localeFilter) params.set('localeFilter', filters.localeFilter);
    if (filters.titleSearch) params.set('titleSearch', filters.titleSearch);
    // AdminSearchBaseSchema.sort enforces the `field:direction` shape (regex
    // /^[a-zA-Z_]+:(asc|desc)$/). The hook only exposes a direction, so we
    // anchor it to createdAt here (SPEC-117 N-1).
    if (filters.sort) params.set('sort', `createdAt:${filters.sort}`);
    return params.toString();
}

async function fetchNewsletterCampaigns(filters: NewsletterCampaignListFilters) {
    const query = buildCampaignQueryString(filters);
    const path = `/api/v1/admin/newsletter/campaigns${query ? `?${query}` : ''}`;
    const result = await fetchApi<NewsletterCampaignListResponse>({ path });
    return result.data.data;
}

async function fetchNewsletterCampaign(id: string) {
    const result = await fetchApi<NewsletterCampaignItemResponse>({
        path: `/api/v1/admin/newsletter/campaigns/${id}`
    });
    return result.data.data;
}

async function createCampaignRequest(input: CreateNewsletterCampaign) {
    const result = await fetchApi<NewsletterCampaignItemResponse>({
        path: '/api/v1/admin/newsletter/campaigns',
        method: 'POST',
        body: input
    });
    return result.data.data;
}

async function updateCampaignRequest(id: string, input: UpdateNewsletterCampaign) {
    const result = await fetchApi<NewsletterCampaignItemResponse>({
        path: `/api/v1/admin/newsletter/campaigns/${id}`,
        method: 'PATCH',
        body: input
    });
    return result.data.data;
}

async function deleteCampaignRequest(id: string) {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/newsletter/campaigns/${id}`,
        method: 'DELETE'
    });
}

async function testSendCampaignRequest(id: string, toEmail?: string) {
    const result = await fetchApi<TestSendResponse>({
        path: `/api/v1/admin/newsletter/campaigns/${id}/test-send`,
        method: 'POST',
        body: toEmail ? { toEmail } : {}
    });
    return result.data.data;
}

async function fetchCampaignAudienceCount(id: string, ignoreSoftCap: boolean) {
    const query = ignoreSoftCap ? '?ignoreSoftCap=true' : '';
    const result = await fetchApi<AudienceCountResponse>({
        path: `/api/v1/admin/newsletter/campaigns/${id}/audience-count${query}`
    });
    return result.data.data;
}

/** Options of a send: the soft-cap override and the selection the admin previewed. */
export interface SendCampaignInput {
    readonly ignoreSoftCap?: boolean;
    readonly previewSelection?: NewsletterPreviewSelection;
}

async function sendCampaignRequest(id: string, input: SendCampaignInput = {}) {
    const result = await fetchApi<SendResponse>({
        path: `/api/v1/admin/newsletter/campaigns/${id}/send`,
        method: 'POST',
        body: {
            ignoreSoftCap: input.ignoreSoftCap ?? false,
            ...(input.previewSelection ? { previewSelection: input.previewSelection } : {})
        }
    });
    return result.data.data;
}

async function cancelCampaignRequest(id: string) {
    const result = await fetchApi<CancelResponse>({
        path: `/api/v1/admin/newsletter/campaigns/${id}/cancel`,
        method: 'POST'
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useNewsletterCampaigns(filters: NewsletterCampaignListFilters = {}) {
    return useQuery({
        queryKey: newsletterCampaignQueryKeys.list(filters as Record<string, unknown>),
        queryFn: () => fetchNewsletterCampaigns(filters),
        staleTime: 30_000
    });
}

export function useNewsletterCampaign(id: string) {
    return useQuery({
        queryKey: newsletterCampaignQueryKeys.detail(id),
        queryFn: () => fetchNewsletterCampaign(id),
        enabled: !!id,
        staleTime: 30_000
    });
}

/**
 * Audience estimate for a campaign (what a send would enqueue now).
 *
 * Always refetched (`staleTime: 0`) so reopening the confirmation dialog after
 * an edit shows the current number. Pass `enabled: false` until the dialog is open.
 */
export function useCampaignAudienceCount({
    id,
    ignoreSoftCap = false,
    enabled = true
}: {
    readonly id: string;
    readonly ignoreSoftCap?: boolean;
    readonly enabled?: boolean;
}) {
    return useQuery({
        queryKey: [
            ...newsletterCampaignQueryKeys.detail(id),
            'audience-count',
            { ignoreSoftCap }
        ] as const,
        queryFn: () => fetchCampaignAudienceCount(id, ignoreSoftCap),
        enabled: enabled && !!id,
        staleTime: 0,
        gcTime: 0
    });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateCampaign() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateNewsletterCampaign) => createCampaignRequest(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: newsletterCampaignQueryKeys.lists() });
        }
    });
}

export function useUpdateCampaign(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: UpdateNewsletterCampaign) => updateCampaignRequest(id, input),
        onSuccess: (updated) => {
            queryClient.setQueryData(newsletterCampaignQueryKeys.detail(id), updated);
            queryClient.invalidateQueries({ queryKey: newsletterCampaignQueryKeys.lists() });
        }
    });
}

export function useDeleteCampaign() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCampaignRequest(id),
        onSuccess: (_data, id) => {
            queryClient.removeQueries({ queryKey: newsletterCampaignQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: newsletterCampaignQueryKeys.lists() });
        }
    });
}

export function useTestSendCampaign(id: string) {
    return useMutation({
        mutationFn: (toEmail?: string) => testSendCampaignRequest(id, toEmail)
    });
}

/**
 * Triggers the campaign dispatch. Returns the API response shape — callers
 * should branch on `dispatched` (false means "no eligible subscribers"):
 *
 *   { dispatched: true,  enqueued: N, softcapped: M }   // 202
 *   { dispatched: false, reason: 'no_eligible_subscribers' }  // 200
 *
 * 409 conflicts (campaign not in 'draft' state) bubble up as fetchApi errors.
 */
export function useSendCampaign(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input?: SendCampaignInput) => sendCampaignRequest(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: newsletterCampaignQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: newsletterCampaignQueryKeys.lists() });
        }
    });
}

export function useCancelCampaign(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => cancelCampaignRequest(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: newsletterCampaignQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: newsletterCampaignQueryKeys.lists() });
        }
    });
}
