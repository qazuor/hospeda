/** Admin newsletter CRUD and write-free dynamic preview endpoints. */
import { renderNewsletterEmail, renderTiptapEmailContent } from '@repo/notifications';
import {
    CreateNewsletterCampaignSchema,
    NewsletterCampaignAdminSearchSchema,
    NewsletterCampaignSchema,
    PermissionEnum,
    UpdateNewsletterCampaignSchema
} from '@repo/schemas';
import { DrizzleDynamicSource, resolveCampaignPreview, ServiceError } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';
import { z } from '../../../utils/zod';
import { getDefaultCampaignService } from './_singletons';
import { CampaignResolvePreviewSchema } from './campaign-dynamic.schemas';
import { handleCampaignError } from './campaign-errors';
import {
    defaultQueryCampaignById,
    defaultQueryCampaigns,
    type GetCampaignByIdDeps,
    type ListCampaignsDeps
} from './campaign-queries';

export {
    adminCampaignAudienceCountRoute,
    adminCampaignErrorsRoute,
    adminCampaignMetricsRoute,
    adminCancelCampaignRoute,
    adminSendCampaignRoute,
    adminTestSendCampaignRoute
} from './campaign-actions';
export type { GetCampaignByIdDeps, ListCampaignsDeps } from './campaign-queries';

/** Build the paginated campaign list with an injectable read-only query. */
export function buildAdminListCampaignsRoute(
    deps: ListCampaignsDeps = { queryCampaigns: defaultQueryCampaigns }
) {
    return createAdminListRoute({
        method: 'get',
        path: '/campaigns',
        summary: 'List newsletter campaigns (admin)',
        description: 'Paginated campaigns with status, locale and title filters.',
        tags: ['Newsletter'],
        requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
        requestQuery: NewsletterCampaignAdminSearchSchema.omit({ page: true, pageSize: true })
            .shape,
        responseSchema: NewsletterCampaignSchema,
        handler: async (_ctx, _params, _body, query) => {
            const { page, pageSize } = extractPaginationParams(query ?? {});
            const q = (query ?? {}) as Record<string, unknown>;
            const { items, total } = await deps.queryCampaigns({
                campaignStatus: q.campaignStatus as string | undefined,
                localeFilter: q.localeFilter as string | undefined,
                titleSearch: q.titleSearch as string | undefined,
                sort: q.sort as string | undefined,
                page,
                pageSize
            });
            return { items, pagination: getPaginationResponse(total, { page, pageSize }) };
        }
    });
}

/** Production campaign list. */
export const adminListCampaignsRoute = buildAdminListCampaignsRoute();

/** Create a campaign in draft status. */
export const adminCreateCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns',
    summary: 'Create newsletter campaign (admin)',
    description: 'Creates a new newsletter campaign in draft status.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE],
    requestBody: CreateNewsletterCampaignSchema,
    responseSchema: NewsletterCampaignSchema,
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = await getDefaultCampaignService();
        const result = await service.create(actor, {
            ...CreateNewsletterCampaignSchema.parse(body),
            createdBy: actor.id
        });
        if (result.error)
            throw new ServiceError(
                result.error.code,
                result.error.message,
                result.error.details,
                result.error.reason
            );
        return result.data;
    }
});

/** Build a single-campaign read with an injectable query. */
export function buildAdminGetCampaignRoute(
    deps: GetCampaignByIdDeps = { queryCampaignById: defaultQueryCampaignById }
) {
    return createAdminRoute({
        method: 'get',
        path: '/campaigns/{id}',
        summary: 'Get newsletter campaign (admin)',
        description: 'Returns a newsletter campaign including audit fields.',
        tags: ['Newsletter'],
        requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
        requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
        responseSchema: NewsletterCampaignSchema,
        handler: async (_ctx, params) => {
            const campaign = await deps.queryCampaignById(params.id as string);
            if (!campaign)
                throw new HTTPException(404, { message: `Campaign not found: ${params.id}` });
            return campaign;
        }
    });
}

/** Production single-campaign read. */
export const adminGetCampaignRoute = buildAdminGetCampaignRoute();

/** Update a draft campaign; other states produce a conflict. */
export const adminUpdateCampaignRoute = createAdminRoute({
    method: 'patch',
    path: '/campaigns/{id}',
    summary: 'Update draft newsletter campaign (admin)',
    description: 'Partially updates a draft campaign; returns 409 for other states.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    requestBody: UpdateNewsletterCampaignSchema,
    responseSchema: NewsletterCampaignSchema,
    handler: async (ctx, params, body) => {
        const service = await getDefaultCampaignService();
        try {
            const result = await service.update(getActorFromContext(ctx), {
                id: params.id as string,
                data: UpdateNewsletterCampaignSchema.parse(body)
            });
            if (result.error)
                throw new ServiceError(
                    result.error.code,
                    result.error.message,
                    result.error.details,
                    result.error.reason
                );
            return result.data;
        } catch (error) {
            return handleCampaignError({ error, ctx });
        }
    }
});

/** Soft-delete a draft campaign; sending/sent campaigns cannot be deleted. */
export const adminDeleteCampaignRoute = createAdminRoute({
    method: 'delete',
    path: '/campaigns/{id}',
    summary: 'Soft-delete newsletter campaign (admin)',
    description: 'Soft-deletes a draft campaign; returns 409 for other states.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: z.null(),
    handler: async (ctx, params) => {
        const service = await getDefaultCampaignService();
        try {
            const result = await service.softDelete(getActorFromContext(ctx), {
                id: params.id as string
            });
            if (result.error)
                throw new ServiceError(
                    result.error.code,
                    result.error.message,
                    result.error.details,
                    result.error.reason
                );
            return null;
        } catch (error) {
            return handleCampaignError({ error, ctx });
        }
    }
});

/** Resolve current campaign content without persisting a snapshot or delivering email. */
export const adminResolvePreviewCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns/{id}/resolve-preview',
    summary: 'Resolve newsletter campaign preview (admin)',
    description: 'Renders current content and returns per-block diagnostics without writes.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: CampaignResolvePreviewSchema,
    successStatusCode: 200,
    handler: async (ctx, params) => {
        ctx.header('Cache-Control', 'no-store');
        try {
            return await resolveCampaignPreview({
                actor: getActorFromContext(ctx),
                id: params.id as string,
                port: new DrizzleDynamicSource({
                    siteUrl: env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar'
                }),
                renderNewsletterEmailFn: renderNewsletterEmail,
                renderTiptapEmailFn: ({ content }) =>
                    renderTiptapEmailContent({ content: content as never })
            });
        } catch (error) {
            return handleCampaignError({ error, ctx });
        }
    }
});
