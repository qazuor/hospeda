/**
 * @file use-social-catalog.ts
 * @description TanStack Query hooks for the five social catalog entities:
 * hashtags, footers, campaigns, batches, and audiences (SPEC-254 T-020).
 *
 * Each entity follows the same pattern as use-social-posts.ts:
 * query-key factory + fetchApi helper + list/create/update/delete hooks.
 *
 * API routes (all under /api/v1/admin/social/):
 *   GET    /hashtags          — list
 *   POST   /hashtags          — create (201)
 *   PATCH  /hashtags/:id      — update
 *   DELETE /hashtags/:id      — soft-delete
 *   (same pattern for footers, campaigns, batches, audiences)
 */

import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors/api-error';
import type {
    SocialAudience,
    SocialAudienceCreate,
    SocialAudienceUpdate,
    SocialCampaign,
    SocialCampaignCreate,
    SocialCampaignUpdate,
    SocialContentBatch,
    SocialContentBatchCreate,
    SocialContentBatchUpdate,
    SocialHashtag,
    SocialHashtagCreate,
    SocialHashtagUpdate,
    SocialPostFooter,
    SocialPostFooterCreate,
    SocialPostFooterUpdate
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Standard pagination metadata returned by admin list endpoints. */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** Wrapper returned by every admin catalog list endpoint. */
interface CatalogListResponse<T> {
    readonly success: boolean;
    readonly data: {
        readonly items: T[];
        readonly pagination: PaginationMeta;
    };
}

/** Wrapper returned by create/update/getById catalog endpoints. */
interface CatalogItemResponse<T> {
    readonly success: boolean;
    readonly data: T;
}

/** Common list filter params (page + pageSize + optional search). */
export interface CatalogListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly search?: string;
    readonly active?: boolean;
    readonly platform?: string;
    readonly category?: string;
}

// ---------------------------------------------------------------------------
// Generic helper to build URLSearchParams from filters
// ---------------------------------------------------------------------------

function buildSearchParams(filters: CatalogListFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.search) params.set('search', filters.search);
    if (filters.platform) params.set('platform', filters.platform);
    if (filters.category) params.set('category', filters.category);
    if (filters.active !== undefined) params.set('active', String(filters.active));
    return params;
}

// ---------------------------------------------------------------------------
// Generic list fetcher
// ---------------------------------------------------------------------------

async function fetchCatalogList<T>(
    base: string,
    filters: CatalogListFilters
): Promise<CatalogListResponse<T>['data']> {
    const params = buildSearchParams(filters);
    const qs = params.toString();
    const path = qs ? `${base}?${qs}` : base;
    const result = await fetchApi<CatalogListResponse<T>>({ path });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Generic create/update/delete
// ---------------------------------------------------------------------------

async function createCatalogItem<TCreate, TItem>(base: string, input: TCreate): Promise<TItem> {
    const result = await fetchApi<CatalogItemResponse<TItem>>({
        path: base,
        method: 'POST',
        body: input
    });
    return result.data.data;
}

async function updateCatalogItem<TUpdate, TItem>(
    base: string,
    id: string,
    input: TUpdate
): Promise<TItem> {
    const result = await fetchApi<CatalogItemResponse<TItem>>({
        path: `${base}/${id}`,
        method: 'PATCH',
        body: input
    });
    return result.data.data;
}

async function deleteCatalogItem(base: string, id: string): Promise<void> {
    await fetchApi({ path: `${base}/${id}`, method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// HASHTAGS
// ---------------------------------------------------------------------------

const HASHTAGS_BASE = '/api/v1/admin/social/hashtags';

export const socialHashtagQueryKeys = {
    all: ['social-hashtags'] as const,
    lists: () => [...socialHashtagQueryKeys.all, 'list'] as const,
    list: (f: CatalogListFilters) => [...socialHashtagQueryKeys.lists(), f] as const
};

/**
 * Fetches the paginated list of social hashtags for the admin catalog.
 * Gate: SOCIAL_HASHTAG_VIEW (server-side).
 */
export function useSocialHashtagsList(filters: CatalogListFilters = {}) {
    return useQuery({
        queryKey: socialHashtagQueryKeys.list(filters),
        queryFn: () => fetchCatalogList<SocialHashtag>(HASHTAGS_BASE, filters),
        staleTime: 30_000
    });
}

/**
 * Creates a new social hashtag.
 * Gate: SOCIAL_HASHTAG_MANAGE (server-side).
 * Surfaces 409/CONFLICT as a typed boolean flag in `isConflict`.
 */
export function useCreateSocialHashtag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SocialHashtagCreate) =>
            createCatalogItem<SocialHashtagCreate, SocialHashtag>(HASHTAGS_BASE, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialHashtagQueryKeys.lists() });
        }
    });
}

/**
 * Updates an existing social hashtag.
 * Gate: SOCIAL_HASHTAG_MANAGE (server-side).
 */
export function useUpdateSocialHashtag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: SocialHashtagUpdate }) =>
            updateCatalogItem<SocialHashtagUpdate, SocialHashtag>(HASHTAGS_BASE, id, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialHashtagQueryKeys.lists() });
        }
    });
}

/**
 * Soft-deletes a social hashtag.
 * Gate: SOCIAL_HASHTAG_MANAGE (server-side).
 */
export function useDeleteSocialHashtag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCatalogItem(HASHTAGS_BASE, id),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialHashtagQueryKeys.lists() });
        }
    });
}

// ---------------------------------------------------------------------------
// FOOTERS
// ---------------------------------------------------------------------------

const FOOTERS_BASE = '/api/v1/admin/social/footers';

export const socialFooterQueryKeys = {
    all: ['social-footers'] as const,
    lists: () => [...socialFooterQueryKeys.all, 'list'] as const,
    list: (f: CatalogListFilters) => [...socialFooterQueryKeys.lists(), f] as const
};

/**
 * Fetches the paginated list of social post footers.
 * Gate: SOCIAL_FOOTER_MANAGE (server-side — read is bundled with manage for footers).
 */
export function useSocialFootersList(filters: CatalogListFilters = {}) {
    return useQuery({
        queryKey: socialFooterQueryKeys.list(filters),
        queryFn: () => fetchCatalogList<SocialPostFooter>(FOOTERS_BASE, filters),
        staleTime: 30_000
    });
}

/**
 * Creates a new social post footer.
 * Gate: SOCIAL_FOOTER_MANAGE (server-side).
 */
export function useCreateSocialFooter() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SocialPostFooterCreate) =>
            createCatalogItem<SocialPostFooterCreate, SocialPostFooter>(FOOTERS_BASE, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialFooterQueryKeys.lists() });
        }
    });
}

/**
 * Updates an existing social post footer.
 * Gate: SOCIAL_FOOTER_MANAGE (server-side).
 */
export function useUpdateSocialFooter() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: SocialPostFooterUpdate }) =>
            updateCatalogItem<SocialPostFooterUpdate, SocialPostFooter>(FOOTERS_BASE, id, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialFooterQueryKeys.lists() });
        }
    });
}

/**
 * Soft-deletes a social post footer.
 * Gate: SOCIAL_FOOTER_MANAGE (server-side).
 */
export function useDeleteSocialFooter() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCatalogItem(FOOTERS_BASE, id),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialFooterQueryKeys.lists() });
        }
    });
}

// ---------------------------------------------------------------------------
// CAMPAIGNS
// ---------------------------------------------------------------------------

const CAMPAIGNS_BASE = '/api/v1/admin/social/campaigns';

export const socialCampaignQueryKeys = {
    all: ['social-campaigns'] as const,
    lists: () => [...socialCampaignQueryKeys.all, 'list'] as const,
    list: (f: CatalogListFilters) => [...socialCampaignQueryKeys.lists(), f] as const
};

/**
 * Fetches the paginated list of social campaigns.
 * Gate: SOCIAL_CAMPAIGN_MANAGE (server-side).
 */
export function useSocialCampaignsList(filters: CatalogListFilters = {}) {
    return useQuery({
        queryKey: socialCampaignQueryKeys.list(filters),
        queryFn: () => fetchCatalogList<SocialCampaign>(CAMPAIGNS_BASE, filters),
        staleTime: 30_000
    });
}

/**
 * Creates a new social campaign.
 * Gate: SOCIAL_CAMPAIGN_MANAGE (server-side).
 */
export function useCreateSocialCampaign() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SocialCampaignCreate) =>
            createCatalogItem<SocialCampaignCreate, SocialCampaign>(CAMPAIGNS_BASE, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialCampaignQueryKeys.lists() });
        }
    });
}

/**
 * Updates an existing social campaign.
 * Gate: SOCIAL_CAMPAIGN_MANAGE (server-side).
 */
export function useUpdateSocialCampaign() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: SocialCampaignUpdate }) =>
            updateCatalogItem<SocialCampaignUpdate, SocialCampaign>(CAMPAIGNS_BASE, id, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialCampaignQueryKeys.lists() });
        }
    });
}

/**
 * Soft-deletes a social campaign.
 * Gate: SOCIAL_CAMPAIGN_MANAGE (server-side).
 */
export function useDeleteSocialCampaign() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCatalogItem(CAMPAIGNS_BASE, id),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialCampaignQueryKeys.lists() });
        }
    });
}

// ---------------------------------------------------------------------------
// BATCHES
// ---------------------------------------------------------------------------

const BATCHES_BASE = '/api/v1/admin/social/batches';

export const socialBatchQueryKeys = {
    all: ['social-batches'] as const,
    lists: () => [...socialBatchQueryKeys.all, 'list'] as const,
    list: (f: CatalogListFilters) => [...socialBatchQueryKeys.lists(), f] as const
};

/**
 * Fetches the paginated list of social content batches.
 * Gate: SOCIAL_BATCH_MANAGE (server-side).
 */
export function useSocialBatchesList(filters: CatalogListFilters = {}) {
    return useQuery({
        queryKey: socialBatchQueryKeys.list(filters),
        queryFn: () => fetchCatalogList<SocialContentBatch>(BATCHES_BASE, filters),
        staleTime: 30_000
    });
}

/**
 * Creates a new social content batch.
 * Gate: SOCIAL_BATCH_MANAGE (server-side).
 */
export function useCreateSocialBatch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SocialContentBatchCreate) =>
            createCatalogItem<SocialContentBatchCreate, SocialContentBatch>(BATCHES_BASE, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialBatchQueryKeys.lists() });
        }
    });
}

/**
 * Updates an existing social content batch.
 * Gate: SOCIAL_BATCH_MANAGE (server-side).
 */
export function useUpdateSocialBatch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: SocialContentBatchUpdate }) =>
            updateCatalogItem<SocialContentBatchUpdate, SocialContentBatch>(
                BATCHES_BASE,
                id,
                input
            ),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialBatchQueryKeys.lists() });
        }
    });
}

/**
 * Soft-deletes a social content batch.
 * Gate: SOCIAL_BATCH_MANAGE (server-side).
 */
export function useDeleteSocialBatch() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCatalogItem(BATCHES_BASE, id),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialBatchQueryKeys.lists() });
        }
    });
}

// ---------------------------------------------------------------------------
// AUDIENCES
// ---------------------------------------------------------------------------

const AUDIENCES_BASE = '/api/v1/admin/social/audiences';

export const socialAudienceQueryKeys = {
    all: ['social-audiences'] as const,
    lists: () => [...socialAudienceQueryKeys.all, 'list'] as const,
    list: (f: CatalogListFilters) => [...socialAudienceQueryKeys.lists(), f] as const
};

/**
 * Fetches the paginated list of social audiences.
 * Gate: SOCIAL_AUDIENCE_MANAGE (server-side).
 */
export function useSocialAudiencesList(filters: CatalogListFilters = {}) {
    return useQuery({
        queryKey: socialAudienceQueryKeys.list(filters),
        queryFn: () => fetchCatalogList<SocialAudience>(AUDIENCES_BASE, filters),
        staleTime: 30_000
    });
}

/**
 * Creates a new social audience.
 * Gate: SOCIAL_AUDIENCE_MANAGE (server-side).
 */
export function useCreateSocialAudience() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SocialAudienceCreate) =>
            createCatalogItem<SocialAudienceCreate, SocialAudience>(AUDIENCES_BASE, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialAudienceQueryKeys.lists() });
        }
    });
}

/**
 * Updates an existing social audience.
 * Gate: SOCIAL_AUDIENCE_MANAGE (server-side).
 */
export function useUpdateSocialAudience() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: SocialAudienceUpdate }) =>
            updateCatalogItem<SocialAudienceUpdate, SocialAudience>(AUDIENCES_BASE, id, input),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialAudienceQueryKeys.lists() });
        }
    });
}

/**
 * Soft-deletes a social audience.
 * Gate: SOCIAL_AUDIENCE_MANAGE (server-side).
 */
export function useDeleteSocialAudience() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCatalogItem(AUDIENCES_BASE, id),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: socialAudienceQueryKeys.lists() });
        }
    });
}

// ---------------------------------------------------------------------------
// Helper re-export: detect 409 CONFLICT from an API error
// ---------------------------------------------------------------------------

/**
 * Returns true if the error is a 409 Conflict (duplicate normalizedHashtag).
 * Used by the hashtag create modal to surface a friendly duplicate message.
 */
export function isConflictError(error: unknown): boolean {
    return isApiError(error) && error.status === 409;
}
