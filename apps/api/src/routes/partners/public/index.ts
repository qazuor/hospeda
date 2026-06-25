/**
 * Public partners list endpoint
 * Returns active partners for public display
 */
import {
    type HttpPartnerSearch,
    PartnerPublicSchema,
    PartnerSearchHttpSchema
} from '@repo/schemas';
import { PartnerService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/public/partners
 * List active partners for public display
 * No authentication required
 */
const publicListPartnersRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List active partners',
    description: 'Returns a paginated list of active partners for public display',
    tags: ['Partners'],
    requestQuery: PartnerSearchHttpSchema.shape,
    responseSchema: PartnerPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const partnerService = new PartnerService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await partnerService.search(actor, {
            ...(query as HttpPartnerSearch),
            page,
            pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

const router = createRouter();
router.route('/', publicListPartnersRoute);

export { router as publicPartnersRoutes };
