/**
 * Admin list endpoint for one partner's mentions log (HOS-377 T-013).
 *
 * Paginated with `page`+`pageSize` — `createAdminListRoute` rejects `limit` along
 * with any other query parameter the schema does not declare.
 */
import {
    type AdminSearchPartnerMention,
    adminSearchPartnerMentionSchema,
    PermissionEnum,
    partnerMentionSchema
} from '@repo/schemas';
import { PartnerMentionService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

/**
 * GET /api/v1/admin/partners/{partnerId}/mentions
 * List one partner's mentions log - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminListPartnerMentionsRoute = createAdminListRoute({
    method: 'get',
    path: '/{partnerId}/mentions',
    summary: "List a partner's mentions log (admin)",
    description:
        'Returns a paginated list of the manual promotion actions logged for one partner, newest promotion first. Includes admin-only fields.',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { partnerId: z.string().uuid() },
    requestQuery: adminSearchPartnerMentionSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: partnerMentionSchema,
    handler: async (ctx, params, _body, query) => {
        const mentionService = new PartnerMentionService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const partnerId = params.partnerId as string;
        const { page, pageSize } = extractPaginationParams(query || {});

        // The partner comes from the PATH, never from the query: the search schema
        // deliberately declares no `partnerId`, so there is no second source that
        // could disagree with the URL.
        const filters = query as Partial<AdminSearchPartnerMention> | undefined;

        const result = await mentionService.listForPartner(actor, {
            partnerId,
            filters: {
                channel: filters?.channel,
                batchId: filters?.batchId,
                mentionedAfter: filters?.mentionedAfter,
                mentionedBefore: filters?.mentionedBefore,
                includeDeleted: filters?.includeDeleted,
                page,
                pageSize
            }
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.mentions ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});
