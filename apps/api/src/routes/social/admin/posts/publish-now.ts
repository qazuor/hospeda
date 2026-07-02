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
import { getDecryptedSocialCredential } from '../../../../services/social-credential-vault.service.js';
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
 *  When no active `make_api_key` and/or `make_webhook_url` vault credential
 *  exists, the service receives an empty string for the missing one(s).
 *  `dispatchTarget` returns `{ outcome: 'skipped_no_webhook' }` for every
 *  target when `webhookUrl` is empty (HOS-64 T-024 — both credentials are
 *  vault-sourced, never read from `social_settings`).  The route returns
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

        // Decrypt at call time so tests can stub the vault without a
        // module-level singleton capturing a stale value.
        // When no active credential exists for either key we pass '' — the
        // service returns skipped_no_webhook per target when webhookUrl is empty.
        const [makeApiKeyResult, webhookUrlResult] = await Promise.all([
            getDecryptedSocialCredential({ key: 'make_api_key' }),
            getDecryptedSocialCredential({ key: 'make_webhook_url' })
        ]);
        const makeApiKey = makeApiKeyResult.data?.plaintext ?? '';
        const webhookUrl = webhookUrlResult.data?.plaintext ?? '';

        const result = await dispatchService
            .dispatchPostNow({
                postId,
                makeApiKey,
                webhookUrl
            })
            .catch((err: unknown) => {
                if (err instanceof ServiceError) throw err;
                throw err;
            });

        return result;
    }
});
