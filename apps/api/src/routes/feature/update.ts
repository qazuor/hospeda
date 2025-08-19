import { z } from '@hono/zod-openapi';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

const featureUpdateBodySchema = z
    .object({
        name: z.string().min(2).optional(),
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .optional(),
        icon: z.string().optional(),
        description: z.string().optional(),
        isFeatured: z.boolean().optional()
    })
    .strict();

export const updateFeatureRoute = createCRUDRoute({
    method: 'put',
    path: '/features/{id}',
    summary: 'Update feature',
    description: 'Updates an existing feature',
    tags: ['Features'],
    requestParams: { id: z.string().uuid() },
    requestBody: featureUpdateBodySchema,
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof featureUpdateBodySchema>;
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.update(actor, params.id as string, input);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
