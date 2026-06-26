/**
 * Admin "publish now" social post endpoint.
 * Immediately dispatches all targets of an APPROVED post to Make.com,
 * bypassing the cron schedule.  Terminal targets (PUBLISHED/FAILED/PUBLISHING)
 * are reset to APPROVED before dispatch so re-posting works out of the box.
 *
 * @see SPEC-254 "Publish Now" endpoint
 */
import { IdSchema, PermissionEnum, PublishNowResponseSchema } from '@repo/schemas';
import { ServiceError, SocialPublishDispatchService } from '@repo/service-core';
import type { Context } from 'hono';
import { env } from '../../../../utils/env.js';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const dispatchService = new SocialPublishDispatchService({ logger: apiLogger });

/**
 * POST /api/v1/admin/social/posts/:id/publish-now
 * Publish a social post immediately — Admin endpoint.
 *
 * Guards (enforced by the service):
 *  - Post must exist (404 when absent or soft-deleted).
 *  - Post `approvalStatus` must be `APPROVED` (422 with reason NOT_APPROVED).
 *  - Post must have at least one media item (422 with reason NO_MEDIA).
 *
 * Make.com not configured:
 *  When `HOSPEDA_MAKE_API_KEY` is absent or empty, the service receives an
 *  empty string as `makeApiKey`. `dispatchTarget` will look up `make_webhook_url`
 *  from `social_settings` and — if that is also empty — return
 *  `{ outcome: 'skipped_no_webhook' }` for every target.  The route returns
 *  HTTP 200 with the `skipped` counter populated; it does NOT throw a 500.
 */
export const adminPublishNowSocialPostRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/publish-now',
    summary: 'Publish social post now (admin)',
    description:
        'Immediately dispatches all targets of an APPROVED social post to Make.com, resetting any terminal targets first.',
    tags: ['Social Posts'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_SCHEDULE],
    requestParams: { id: IdSchema },
    responseSchema: PublishNowResponseSchema,
    successStatusCode: 200,
    handler: async (_ctx: Context, params: Record<string, unknown>) => {
        const postId = params.id as string;

        // Read env at call time so tests can stub process.env without the
        // module-level singleton capturing a stale value.
        // env.HOSPEDA_MAKE_API_KEY is optional (z.string().optional()). When
        // absent we pass '' — the service then reads the webhook URL from the
        // social_settings table and returns skipped_no_webhook if that is also
        // empty.
        const makeApiKey = env.HOSPEDA_MAKE_API_KEY ?? '';

        const result = await dispatchService
            .dispatchPostNow({
                postId,
                makeApiKey
            })
            .catch((err: unknown) => {
                if (err instanceof ServiceError) throw err;
                throw err;
            });

        return result;
    }
});
