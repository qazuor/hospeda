import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service within handler to cooperate with Vitest mocks

// Partial update schema mirrors Create schema but all optional
const amenityUpdateBodySchema = z
    .object({
        name: z.string().min(2).optional(),
        type: z.string().optional(),
        icon: z.string().optional(),
        description: z.string().optional(),
        isBuiltin: z.boolean().optional(),
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .optional(),
        isFeatured: z.boolean().optional()
    })
    .strict();

export const updateAmenityRoute = createCRUDRoute({
    method: 'put',
    path: '/amenities/{id}',
    summary: 'Update amenity',
    description: 'Updates an existing amenity',
    tags: ['Amenities'],
    requestParams: { id: z.string().uuid() },
    requestBody: amenityUpdateBodySchema,
    // TODO: Replace with AmenityDetail schema when available
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof amenityUpdateBodySchema>;
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.update(actor, params.id as string, input);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
