import {
    AccountCloseOnRequestSchema,
    PartnerApplicationEmailReplacementPreviewSchema,
    PartnerApplicationEmailReplacementResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { ApplicationEmailReplacementService } from '../../../services/account-closure/application-email-replacement.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new ApplicationEmailReplacementService();

/**
 * GET /api/v1/admin/partner-applications/{id}/replace-email — the read that
 * precedes administrative action 24 (ACC:24) over a partner application made
 * without an account: which application's mailbox the action replaces (id,
 * current mailbox, status and creation date). It informs; the replacement
 * re-reads everything under its own lock. Shares path and permission with the
 * POST on purpose: route middlewares are per path and method-agnostic.
 */
export const adminPartnerApplicationEmailReplacementPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/replace-email',
    summary: 'Preview replacing the mailbox of a partner application (ACC:24)',
    description:
        'Administrative action 24 over a partner application made without an account: reads which application the mailbox belongs to. Requires USER_CLOSE_ON_REQUEST; refused when the mailbox is the actor own.',
    tags: ['Partner applications', 'Admin'],
    requiredPermissions: [PermissionEnum.USER_CLOSE_ON_REQUEST],
    requestParams: { id: z.string().uuid() },
    responseSchema: PartnerApplicationEmailReplacementPreviewSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        service.previewApplication({
            actor: getActorFromContext(ctx),
            applicationId: params.id as string
        })
});

/**
 * POST /api/v1/admin/partner-applications/{id}/replace-email — administrative
 * action 24 (ACC:24) over a partner application made without an account: support
 * replaces its mailbox at the applicant's request, with a mandatory reason. The
 * account preconditions are not evaluated (there is no account); a mailbox that
 * belongs to a live account is refused with 409 `APPLICATION_HAS_ACCOUNT`.
 */
export const adminReplacePartnerApplicationEmailRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/replace-email',
    summary: 'Replace the mailbox of a partner application (ACC:24)',
    description:
        'Administrative action 24 over a partner application made without an account: replaces its mailbox with a pseudonym, with a mandatory reason. Requires USER_CLOSE_ON_REQUEST; refused when a live account carries the mailbox.',
    tags: ['Partner applications', 'Admin'],
    requiredPermissions: [PermissionEnum.USER_CLOSE_ON_REQUEST],
    requestParams: { id: z.string().uuid() },
    requestBody: AccountCloseOnRequestSchema,
    responseSchema: PartnerApplicationEmailReplacementResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        service.replaceApplicationEmailOnRequest({
            actor: getActorFromContext(ctx),
            applicationId: params.id as string,
            reason: AccountCloseOnRequestSchema.parse(body).reason
        })
});
