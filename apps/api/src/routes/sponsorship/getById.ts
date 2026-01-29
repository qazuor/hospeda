/**
 * Protected get sponsorship by ID endpoint
 * Returns a single sponsorship by its ID
 */
import { type ServiceErrorCode, SponsorshipIdSchema, SponsorshipSchema } from '@repo/schemas';
import { ServiceError, SponsorshipService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createProtectedRoute } from '../../utils/route-factory';

const sponsorshipService = new SponsorshipService({ logger: apiLogger });

/**
 * GET /api/v1/sponsorships/:id
 * Get sponsorship by ID - Protected endpoint
 */
export const sponsorshipGetByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get sponsorship by ID',
    description: 'Retrieves a sponsorship by its ID. Requires authentication.',
    tags: ['Sponsorships'],
    requestParams: { id: SponsorshipIdSchema },
    responseSchema: SponsorshipSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await sponsorshipService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }

        return result.data;
    }
});
