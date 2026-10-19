import { PublicPlanCatalogResponseSchema, PublicPlanCatalogVerticalSchema } from '@repo/schemas';
import { createRouter } from '../../../utils/create-app';
import { createPublicRoute } from '../../../utils/route-factory-tiered';
import { readSellablePlanCatalog } from './read-sellable-catalog';

/** Public route for the current sellable plans of one vertical. */
export const publicReadPlanCatalogRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'Read the public sellable plan catalog',
    description: 'Returns current sellable plan versions and the optional current floor plan.',
    tags: ['Plan Catalog'],
    requestQuery: { vertical: PublicPlanCatalogVerticalSchema },
    responseSchema: PublicPlanCatalogResponseSchema,
    handler: async (_ctx, _params, _body, query) =>
        readSellablePlanCatalog({
            vertical: PublicPlanCatalogVerticalSchema.parse(query?.vertical)
        })
});

const router = createRouter();
router.route('/', publicReadPlanCatalogRoute);

/** Public plan catalog router. */
export { router as publicPlanCatalogRoutes };
