/**
 * Admin direct email message routes (HOS-2685), mounted at `/api/v1/admin/direct-emails`.
 *
 * Every route declares its own permission gate: reads and previews need
 * `DIRECT_EMAIL_VIEW`, sends need `DIRECT_EMAIL_SEND`.
 *
 * @module routes/direct-email/admin/messages
 */

import {
    CheckDirectEmailRecipientsRequestSchema,
    CheckDirectEmailRecipientsResponseSchema,
    DirectEmailAdminSearchSchema,
    DirectEmailMessageDetailSchema,
    DirectEmailMessageListItemSchema,
    PermissionEnum,
    PreviewDirectEmailRequestSchema,
    PreviewDirectEmailResponseSchema,
    SendDirectEmailRequestSchema,
    SendDirectEmailResponseSchema,
    TestSendDirectEmailRequestSchema,
    TestSendDirectEmailResponseSchema
} from '@repo/schemas';
import { getActorFromContext } from '../../../utils/actor';
import { getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';
import { z } from '../../../utils/zod';
import { getDirectEmailMessageService, unwrapDirectEmailResult } from '../_singletons';

/** Per-admin cap on sends and test sends: each call can reach up to 20 mailboxes. */
const SEND_RATE_LIMIT = { requests: 10, windowMs: 60_000 } as const;

/** GET /: paginated history, newest first. */
export const adminListDirectEmailsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List direct emails (admin)',
    description: 'Paginated history of sent direct emails with the recipient count.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_VIEW],
    requestQuery: DirectEmailAdminSearchSchema.shape,
    responseSchema: DirectEmailMessageListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const { page, pageSize, search } = DirectEmailAdminSearchSchema.parse(query ?? {});
        const { items, total } = unwrapDirectEmailResult(
            await getDirectEmailMessageService().list(getActorFromContext(ctx), {
                page,
                pageSize,
                ...(search ? { search } : {})
            })
        );
        return { items, pagination: getPaginationResponse(total, { page, pageSize }) };
    }
});

/** GET /{id}: one message with each recipient's status. */
export const adminGetDirectEmailRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get direct email (admin)',
    description: 'Returns a sent direct email with the status of each recipient.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_VIEW],
    requestParams: { id: z.string().uuid('Direct email ID must be a valid UUID') },
    responseSchema: DirectEmailMessageDetailSchema,
    handler: async (ctx, params) =>
        unwrapDirectEmailResult(
            await getDirectEmailMessageService().getById(getActorFromContext(ctx), {
                id: params.id as string
            })
        )
});

/** POST /preview: the exact HTML a recipient would get. */
export const adminPreviewDirectEmailRoute = createAdminRoute({
    method: 'post',
    path: '/preview',
    summary: 'Preview direct email (admin)',
    description:
        'Renders the subject and TipTap body with the real layout. Sends and writes nothing.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_VIEW],
    requestBody: PreviewDirectEmailRequestSchema,
    responseSchema: PreviewDirectEmailResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, _params, body) => {
        ctx.header('Cache-Control', 'no-store');
        return unwrapDirectEmailResult(
            await getDirectEmailMessageService().preview(
                getActorFromContext(ctx),
                PreviewDirectEmailRequestSchema.parse(body)
            )
        );
    }
});

/** POST /test-send: one test email, default to the admin's own address. */
export const adminTestSendDirectEmailRoute = createAdminRoute({
    method: 'post',
    path: '/test-send',
    summary: 'Test-send direct email (admin)',
    description:
        'Sends one test email marked [PRUEBA] to the given address (default: the admin). Creates no history row.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_SEND],
    requestBody: TestSendDirectEmailRequestSchema,
    responseSchema: TestSendDirectEmailResponseSchema,
    successStatusCode: 200,
    options: { customRateLimit: SEND_RATE_LIMIT },
    handler: async (ctx, _params, body) =>
        unwrapDirectEmailResult(
            await getDirectEmailMessageService().testSend(
                getActorFromContext(ctx),
                TestSendDirectEmailRequestSchema.parse(body)
            )
        )
});

/** POST /check-recipients: which typed addresses are suppressed. */
export const adminCheckDirectEmailRecipientsRoute = createAdminRoute({
    method: 'post',
    path: '/check-recipients',
    summary: 'Check direct email recipients (admin)',
    description: 'Returns which of the given addresses are on the suppression list.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_VIEW],
    requestBody: CheckDirectEmailRecipientsRequestSchema,
    responseSchema: CheckDirectEmailRecipientsResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, _params, body) =>
        unwrapDirectEmailResult(
            await getDirectEmailMessageService().checkRecipients(
                getActorFromContext(ctx),
                CheckDirectEmailRecipientsRequestSchema.parse(body)
            )
        )
});

/** POST /: send one message per recipient, with a per-recipient result. */
export const adminSendDirectEmailRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Send direct email (admin)',
    description:
        'Sends one message per recipient (1 to 20), sequentially. A failure on one recipient does not stop the others; suppressed addresses are skipped.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_SEND],
    requestBody: SendDirectEmailRequestSchema,
    responseSchema: SendDirectEmailResponseSchema,
    successStatusCode: 201,
    options: { customRateLimit: SEND_RATE_LIMIT },
    handler: async (ctx, _params, body) =>
        unwrapDirectEmailResult(
            await getDirectEmailMessageService().send(
                getActorFromContext(ctx),
                SendDirectEmailRequestSchema.parse(body)
            )
        )
});
