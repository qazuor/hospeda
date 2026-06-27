/**
 * Admin schedule social post endpoint.
 * Schedules an APPROVED post for future publication (or reschedules a SCHEDULED post).
 */
import {
    IdSchema,
    PermissionEnum,
    ScheduleSocialPostSchema,
    SocialPostScheduleResponseSchema,
    SocialRecurrenceTypeEnum
} from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/schedule
 * Schedule an approved social post for future publication — Admin endpoint.
 */
export const adminScheduleSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/schedule',
    summary: 'Schedule social post (admin)',
    description: 'Schedules an APPROVED social post for future publication at the given datetime.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_SCHEDULE],
    requestParams: { id: IdSchema },
    requestBody: ScheduleSocialPostSchema,
    responseSchema: SocialPostScheduleResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const postId = params.id as string;
        const scheduledAt = body.scheduledAt as Date;
        const timezone = body.timezone as string;
        const recurrenceType =
            (body.recurrenceType as SocialRecurrenceTypeEnum | undefined) ??
            SocialRecurrenceTypeEnum.ONCE;
        const recurrenceParamsJson =
            (body.recurrenceParamsJson as Record<string, unknown> | undefined) ?? undefined;

        const result = await postService.schedule({
            actor,
            postId,
            scheduledAt,
            timezone,
            recurrenceType,
            recurrenceParamsJson
        });

        if (result.error) {
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        return result.data;
    }
});
