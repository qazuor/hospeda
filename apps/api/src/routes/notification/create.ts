import { HttpCreateNotificationSchema, NotificationSchema } from '@repo/schemas';
import { NotificationService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const notificationCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create notification',
    description: 'Creates a new notification',
    tags: ['Notifications'],
    requestBody: HttpCreateNotificationSchema,
    responseSchema: NotificationSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new NotificationService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof HttpCreateNotificationSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
