import { z } from '@hono/zod-openapi';
import { FeatureService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Mirror CreateFeatureSchema shape used in service
const featureCreateBodySchema = z
    .object({
        name: z.string().min(2),
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .optional(),
        icon: z.string().optional(),
        description: z.string().optional(),
        isFeatured: z.boolean().optional().default(false)
    })
    .strict();

export const createFeatureRoute = createCRUDRoute({
    method: 'post',
    path: '/features',
    summary: 'Create feature',
    description: 'Creates a new feature',
    tags: ['Features'],
    requestBody: featureCreateBodySchema,
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const input = body as z.infer<typeof featureCreateBodySchema>;
        const service = new FeatureService({ logger: apiLogger });
        const result = await service.create(actor, input);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
