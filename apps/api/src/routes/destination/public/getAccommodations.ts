/**
 * Public destination accommodations endpoint
 * Returns accommodations for a specific destination
 */
import { AccommodationPublicSchema, DestinationIdSchema } from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * Removes the premium `richDescription` field from an accommodation card.
 *
 * This is a public card listing that never renders rich text, so the
 * premium-gated `richDescription` must not appear in the payload. Stripping it
 * at the data level keeps the endpoint fail-closed regardless of the response
 * schema (see SPEC-187 entitlement-by-omission).
 *
 * The list service returns `AccommodationListItem` whose static type does not
 * declare `richDescription`, but the underlying `findAll` runs `SELECT *` so the
 * column is present at runtime. The constraint is therefore `T extends object`
 * (not `{ richDescription?: unknown }`) with an internal cast, so the strip
 * works against the lying type while still removing the field at runtime.
 *
 * @param item - The accommodation object to sanitize.
 * @returns The accommodation object with richDescription removed.
 */
function stripRichDescription<T extends object>(item: T): Omit<T, 'richDescription'> {
    const { richDescription: _dropped, ...rest } = item as T & { richDescription?: unknown };
    return rest as Omit<T, 'richDescription'>;
}

/**
 * GET /api/v1/public/destinations/:id/accommodations
 * Get destination accommodations - Public endpoint
 */
export const publicGetDestinationAccommodationsRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/accommodations',
    summary: 'Get destination accommodations',
    description: 'Retrieves all accommodations for a specific destination',
    tags: ['Destinations'],
    requestParams: {
        id: DestinationIdSchema
    },
    responseSchema: z.array(AccommodationPublicSchema),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await destinationService.getAccommodations(actor, {
            destinationId: params.id as string,
            page: 1,
            pageSize: 100
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        // Service wraps the value as { accommodations: [...] }; the responseSchema
        // is the bare array, so unwrap before returning. Strip the premium
        // richDescription field — this is a public card listing (SPEC-187).
        return (result.data?.accommodations ?? []).map((a) => stripRichDescription(a));
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
