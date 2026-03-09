/**
 * Public get sponsorship level by ID endpoint
 * Returns a single sponsorship level by its ID
 */
import { SponsorshipLevelIdSchema, SponsorshipLevelSchema } from '@repo/schemas';
import { ServiceError, SponsorshipLevelService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const sponsorshipLevelService = new SponsorshipLevelService({ logger: apiLogger });

/**
 * GET /api/v1/public/sponsorship-levels/:id
 * Get sponsorship level by ID - Public endpoint
 */
export const sponsorshipLevelGetByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get sponsorship level by ID',
    description: 'Retrieves a sponsorship level by its ID',
    tags: ['Sponsorship Levels'],
    requestParams: { id: SponsorshipLevelIdSchema },
    responseSchema: SponsorshipLevelSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await sponsorshipLevelService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300
    }
});
