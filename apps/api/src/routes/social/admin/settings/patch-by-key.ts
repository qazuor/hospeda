/**
 * Admin update social setting by key endpoint.
 * Path param is the setting KEY (string), not a UUID.
 * Secret values are echoed back in full on the PATCH response per spec;
 * GET list masks them as '***'.
 */
import { PermissionEnum, SocialSettingSchema } from '@repo/schemas';
import { SocialSettingService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const settingService = new SocialSettingService({ logger: apiLogger });

/** Body schema for updating a setting value. */
const UpdateSettingValueSchema = z.object({
    value: z.string().min(1, { message: 'zodError.socialSetting.value.required' })
});

/**
 * PATCH /api/v1/admin/social/settings/:key
 * Update a social setting identified by its unique key.
 * Unknown key → 404. Secret values are returned unmasked in this response
 * (the service's updateByKey returns the raw updated entity before masking).
 */
export const adminPatchSocialSettingByKeyRoute = createAdminRoute({
    method: 'patch',
    path: '/{key}',
    summary: 'Update social setting by key (admin)',
    description:
        'Updates the value of a social setting identified by its unique string key. ' +
        'Returns 404 when the key does not exist. ' +
        'Secret-typed values are returned in full in this response; GET list masks them.',
    tags: ['Social Settings'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    requestParams: { key: z.string().min(1) },
    requestBody: UpdateSettingValueSchema,
    responseSchema: SocialSettingSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const key = params.key as string;
        const value = (body as { value: string }).value;

        const result = await settingService.updateByKey(actor, key, value);

        // updateByKey throws ServiceError(NOT_FOUND) if the key does not exist;
        // the route-factory's handleRouteError converts that to a 404 response.
        return result.entity;
    }
});
