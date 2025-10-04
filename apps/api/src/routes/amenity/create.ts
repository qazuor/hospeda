import { z } from '@hono/zod-openapi';
import { type AmenitiesTypeEnum, LifecycleStatusEnum } from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service within handler to cooperate with Vitest mocks

// Matches CreateAmenitySchema in service (name, type, optional icon/description/isBuiltin/slug/isFeatured)
const amenityCreateBodySchema = z
    .object({
        name: z.string().min(2),
        type: z.string(),
        icon: z.string().optional(),
        description: z.string().optional(),
        isBuiltin: z.boolean().optional(),
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .optional(),
        isFeatured: z.boolean().optional().default(false)
    })
    .strict();

export const createAmenityRoute = createCRUDRoute({
    method: 'post',
    path: '/amenities',
    summary: 'Create amenity',
    description: 'Creates a new amenity',
    tags: ['Amenities'],
    requestBody: amenityCreateBodySchema,
    // TODO [4296f2da-6f2a-4bb5-bc09-3236ed96d2ec]: Replace with AmenityDetail schema when available
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const bodyData = body as z.infer<typeof amenityCreateBodySchema>;
        const input = {
            ...bodyData,
            type: bodyData.type as AmenitiesTypeEnum,
            isBuiltin: bodyData.isBuiltin ?? false,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.create(actor, input);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
