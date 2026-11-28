/** Admin campaign delivery actions and read-only metrics. */
import type { NewsletterPreviewSelection as PreviewSelection } from '@repo/schemas';
import { PermissionEnum, SendNewsletterCampaignRequestSchema } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../utils/actor';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';
import { z } from '../../../utils/zod';
import { getDefaultUserService } from '../protected/_singletons';
import { getDefaultCampaignService } from './_singletons';
import { CampaignResolutionReportSchema } from './campaign-dynamic.schemas';
import { handleCampaignError } from './campaign-errors';

const TestSendBodySchema = z.object({ toEmail: z.string().email().optional() });
const SendResponseSchema = z.union([
    z.object({
        dispatched: z.literal(true),
        enqueued: z.number().int().min(0),
        softcapped: z.number().int().min(0),
        report: CampaignResolutionReportSchema.optional()
    }),
    z.object({ dispatched: z.literal(false), reason: z.literal('no_eligible_subscribers') })
]);

/** Send one test email, using the actor's address when no override is supplied. */
export const adminTestSendCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns/{id}/test-send',
    summary: 'Test-send newsletter campaign (admin)',
    description:
        'Sends a preview email without creating delivery rows or changing campaign status.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    requestBody: TestSendBodySchema,
    responseSchema: z.object({ sent: z.literal(true), sentTo: z.string().email() }),
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const campaignSvc = await getDefaultCampaignService();
        const parsedBody = TestSendBodySchema.parse(body);
        let toEmail: string;
        if (parsedBody.toEmail) {
            toEmail = parsedBody.toEmail;
        } else {
            const userResult = await getDefaultUserService().getById(actor, actor.id);
            if (userResult.error)
                throw new Error(`${userResult.error.code}: ${userResult.error.message}`);
            if (!userResult.data?.email) {
                throw new HTTPException(400, {
                    message: 'Admin user has no email on file. Provide toEmail in the request body.'
                });
            }
            toEmail = userResult.data.email;
        }
        try {
            const result = await campaignSvc.testSend(actor, { id: params.id as string, toEmail });
            if (result.error) {
                // Preserve domain reasons/details rather than reducing errors to strings.
                return handleCampaignError({
                    error: new ServiceError(
                        result.error.code,
                        result.error.message,
                        result.error.details,
                        result.error.reason
                    ),
                    ctx
                });
            }
            return { sent: true as const, sentTo: result.data.sentTo };
        } catch (error) {
            return handleCampaignError({ error, ctx });
        }
    }
});

/** Dispatch a campaign, returning 202 when enqueued or 200 for an empty audience. */
export const adminSendCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns/{id}/send',
    summary: 'Send newsletter campaign (admin)',
    description:
        'Dispatches to eligible subscribers; returns 422 when a dynamic block is below minimum.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    requestBody: SendNewsletterCampaignRequestSchema,
    requestBodyRequired: false,
    responseSchema: SendResponseSchema,
    options: { customRateLimit: { requests: 1, windowMs: 60_000 } },
    handler: async (ctx, params, body) => {
        const campaignSvc = await getDefaultCampaignService();
        const sendBody = body as
            | { ignoreSoftCap?: boolean; previewSelection?: PreviewSelection }
            | undefined;
        const previewSelection = sendBody?.previewSelection;
        try {
            const result = await campaignSvc.send(getActorFromContext(ctx), {
                id: params.id as string,
                ...(sendBody?.ignoreSoftCap === true ? { ignoreSoftCap: true } : {}),
                ...(previewSelection ? { previewSelection } : {})
            });
            if (result.error)
                throw new ServiceError(
                    result.error.code,
                    result.error.message,
                    result.error.details,
                    result.error.reason
                );
            const { enqueued, softcapped, resolutionReport } = result.data;
            // Preserve the existing action response (not an envelope).
            if (enqueued === 0)
                return ctx.json(
                    { dispatched: false as const, reason: 'no_eligible_subscribers' as const },
                    200
                );
            return ctx.json(
                {
                    dispatched: true as const,
                    enqueued,
                    softcapped,
                    ...(resolutionReport ? { report: resolutionReport } : {})
                },
                202
            );
        } catch (error) {
            return handleCampaignError({ error, ctx });
        }
    }
});

/** Cancel a sending campaign by skipping its pending deliveries. */
export const adminCancelCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns/{id}/cancel',
    summary: 'Cancel newsletter campaign (admin)',
    description: 'Cancels a sending campaign, flipping pending deliveries to skipped.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: z.object({ cancelled: z.literal(true), skipped: z.number().int().min(0) }),
    successStatusCode: 200,
    handler: async (ctx, params) => {
        const campaignSvc = await getDefaultCampaignService();
        try {
            const result = await campaignSvc.cancel(getActorFromContext(ctx), {
                id: params.id as string
            });
            if (result.error)
                throw new ServiceError(
                    result.error.code,
                    result.error.message,
                    result.error.details,
                    result.error.reason
                );
            return { cancelled: true as const, skipped: result.data.skipped };
        } catch (error) {
            return handleCampaignError({ error, ctx });
        }
    }
});

/** Fresh campaign delivery counters. */
export const adminCampaignMetricsRoute = createAdminRoute({
    method: 'get',
    path: '/campaigns/{id}/metrics',
    summary: 'Get campaign metrics (admin)',
    description: 'Returns aggregated delivery metrics with no-store caching.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: z.object({
        campaignId: z.string().uuid(),
        totalRecipients: z.number().int().min(0),
        totalSoftcapped: z.number().int().min(0),
        pending: z.number().int().min(0),
        delivered: z.number().int().min(0),
        failed: z.number().int().min(0),
        skipped: z.number().int().min(0),
        opened: z.number().int().min(0),
        clicked: z.number().int().min(0)
    }),
    handler: async (ctx, params) => {
        const campaignSvc = await getDefaultCampaignService();
        ctx.header('Cache-Control', 'no-store');
        const result = await campaignSvc.computeMetrics(getActorFromContext(ctx), {
            id: params.id as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    }
});

/** Estimate recipients using the same audience filter as send, without writes. */
export const adminCampaignAudienceCountRoute = createAdminRoute({
    method: 'get',
    path: '/campaigns/{id}/audience-count',
    summary: 'Estimate campaign audience (admin)',
    description: 'Returns eligible, soft-capped and total matching subscriber counts.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    requestQuery: { ignoreSoftCap: z.enum(['true', 'false']).optional() },
    responseSchema: z.object({
        eligible: z.number().int().min(0),
        softCapped: z.number().int().min(0),
        totalCandidates: z.number().int().min(0)
    }),
    handler: async (ctx, params, _body, query) => {
        const campaignSvc = await getDefaultCampaignService();
        ctx.header('Cache-Control', 'no-store');
        const result = await campaignSvc.getAudienceEstimate(getActorFromContext(ctx), {
            id: params.id as string,
            ignoreSoftCap: query?.ignoreSoftCap === 'true'
        });
        if (result.error) throw new Error(`${result.error.code}: ${result.error.message}`);
        return result.data;
    }
});

/** List failed deliveries with masked subscriber identifiers (the query has no email join). */
export const adminCampaignErrorsRoute = createAdminListRoute({
    method: 'get',
    path: '/campaigns/{id}/errors',
    summary: 'Get campaign delivery errors (admin)',
    description: 'Paginated failed deliveries with masked subscriber email placeholders.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: z.object({
        id: z.string().uuid(),
        subscriberId: z.string().uuid(),
        channel: z.string(),
        maskedEmail: z.string(),
        errorMessage: z.string().nullable(),
        retryCount: z.number().int().min(0),
        createdAt: z.union([z.string().datetime(), z.date()]),
        updatedAt: z.union([z.string().datetime(), z.date()])
    }),
    handler: async (ctx, params, _body, query) => {
        const campaignSvc = await getDefaultCampaignService();
        const { page, pageSize } = extractPaginationParams(query ?? {});
        const result = await campaignSvc.getFailedDeliveries(getActorFromContext(ctx), {
            id: params.id as string,
            page,
            pageSize
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        const { items, total } = result.data;
        return {
            items: items.map((item) => ({
                id: item.id,
                subscriberId: item.subscriberId,
                channel: item.channel,
                // Existing placeholder starts with "sub-", whose first two characters are "su".
                maskedEmail: 'su***@masked.invalid',
                errorMessage: item.errorMessage,
                retryCount: item.retryCount,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            })),
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    }
});
