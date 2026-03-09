/**
 * Public get sponsorship package by ID endpoint
 * Returns a single sponsorship package by its ID
 */
import { SponsorshipPackageIdSchema, SponsorshipPackageSchema } from '@repo/schemas';
import { ServiceError, SponsorshipPackageService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const sponsorshipPackageService = new SponsorshipPackageService({ logger: apiLogger });

/**
 * GET /api/v1/public/sponsorship-packages/:id
 * Get sponsorship package by ID - Public endpoint
 */
export const sponsorshipPackageGetByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get sponsorship package by ID',
    description: 'Retrieves a sponsorship package by its ID',
    tags: ['Sponsorship Packages'],
    requestParams: { id: SponsorshipPackageIdSchema },
    responseSchema: SponsorshipPackageSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await sponsorshipPackageService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 300
    }
});
