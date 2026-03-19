/**
 * Newsletter subscription toggle endpoint.
 * Toggles the user's newsletter email preference.
 * @route POST /api/v1/protected/users/me/newsletter/toggle
 */
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/** Response schema for newsletter toggle */
const NewsletterToggleResponseSchema = z.object({
    subscribed: z.boolean()
});

export const newsletterToggleRoute = createProtectedRoute({
    method: 'post',
    path: '/me/newsletter/toggle',
    summary: 'Toggle newsletter subscription',
    description:
        'Toggles the authenticated user newsletter email preference (settings.notifications.allowEmails).',
    tags: ['Users'],
    responseSchema: NewsletterToggleResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);

        // Fetch current user to read current settings
        const getResult = await userService.getById(actor, actor.id);

        if (getResult.error) {
            throw new ServiceError(getResult.error.code, getResult.error.message);
        }

        const user = getResult.data;
        if (!user) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');
        }

        // Toggle allowEmails
        const currentSettings = user.settings ?? {
            notifications: { enabled: true, allowEmails: false, allowSms: false, allowPush: false }
        };
        const currentAllowEmails = currentSettings.notifications?.allowEmails ?? false;
        const newAllowEmails = !currentAllowEmails;

        // Update user settings via service
        const updateResult = await userService.update(actor, actor.id, {
            settings: {
                ...currentSettings,
                notifications: {
                    ...currentSettings.notifications,
                    allowEmails: newAllowEmails
                }
            }
        } as never);

        if (updateResult.error) {
            throw new ServiceError(updateResult.error.code, updateResult.error.message);
        }

        return { subscribed: newAllowEmails };
    },
    options: {
        customRateLimit: { requests: 10, windowMs: 60000 }
    }
});
