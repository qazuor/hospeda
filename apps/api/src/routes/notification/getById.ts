import { z } from '@hono/zod-openapi';
import { NotificationSchema } from '@repo/schemas';
import { NotificationService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const notificationGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get notification by ID',
    description: 'Returns a single notification by ID',
    tags: ['Notifications'],
    requestParams: { id: z.string().uuid() },
    responseSchema: NotificationSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new NotificationService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
