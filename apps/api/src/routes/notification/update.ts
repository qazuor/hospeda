import { z } from '@hono/zod-openapi';
import { HttpUpdateNotificationSchema, NotificationSchema } from '@repo/schemas';
import { NotificationService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const notificationUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update notification',
    description: 'Updates an existing notification',
    tags: ['Notifications'],
    requestParams: { id: z.string().uuid() },
    requestBody: HttpUpdateNotificationSchema,
    responseSchema: NotificationSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new NotificationService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof HttpUpdateNotificationSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
