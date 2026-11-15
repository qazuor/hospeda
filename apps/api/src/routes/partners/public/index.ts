/**
 * Public partners list endpoint
 * Returns partners whose owners hold the carousel key and whose presence is unmoderated.
 */
import { PartnerCarouselItemSchema, PartnerSearchHttpSchema } from '@repo/schemas';
import { listCarouselPartners } from '../../../services/partner-presence/partner-presence-read.service.js';
import { createRouter } from '../../../utils/create-app';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';
import { publicGetPartnerBySlugRoute } from './get-by-slug.js';

/**
 * GET /api/v1/public/partners
 * List partners with carousel presence.
 * AC:V7:13; V7 §1.6 (V/18 §1.6).
 * No authentication required
 */
const publicListPartnersRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List partners with carousel presence',
    description: 'Returns owners with the carousel presence key and an unmoderated presence.',
    tags: ['Partners'],
    requestQuery: PartnerSearchHttpSchema.shape,
    responseSchema: PartnerCarouselItemSchema,
    handler: async (_ctx, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query || {});
        const result = await listCarouselPartners({
            filters: {
                q: query?.q as string | undefined,
                type: query?.type as string | undefined
            },
            page,
            pageSize
        });
        return {
            items: result.items,
            pagination: getPaginationResponse(result.total, { page, pageSize })
        };
    },
    options: {
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});

const router = createRouter();
router.route('/', publicListPartnersRoute);
// Registered AFTER the list so the bare `/` collection route is matched by its
// own handler and never swallowed by the `{slug}` param route.
router.route('/', publicGetPartnerBySlugRoute);

export { router as publicPartnersRoutes };
