/**
 * Admin direct email suppression list routes (HOS-2685), mounted at
 * `/api/v1/admin/direct-email-suppressions`. Reads need `DIRECT_EMAIL_VIEW`; adding and
 * removing an address need `DIRECT_EMAIL_SEND`.
 *
 * @module routes/direct-email/admin/suppressions
 */

import {
    CreateDirectEmailSuppressionSchema,
    DirectEmailSuppressionAdminSearchSchema,
    DirectEmailSuppressionSchema,
    PermissionEnum
} from '@repo/schemas';
import { getActorFromContext } from '../../../utils/actor';
import { getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';
import { z } from '../../../utils/zod';
import { getDirectEmailSuppressionService, unwrapDirectEmailResult } from '../_singletons';

/** GET /: paginated suppression list. */
export const adminListDirectEmailSuppressionsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List direct email suppressions (admin)',
    description: 'Paginated addresses direct emails are no longer sent to.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_VIEW],
    requestQuery: DirectEmailSuppressionAdminSearchSchema.shape,
    responseSchema: DirectEmailSuppressionSchema,
    handler: async (ctx, _params, _body, query) => {
        const { page, pageSize, search, reason } = DirectEmailSuppressionAdminSearchSchema.parse(
            query ?? {}
        );
        const { items, total } = unwrapDirectEmailResult(
            await getDirectEmailSuppressionService().list(getActorFromContext(ctx), {
                page,
                pageSize,
                ...(search ? { search } : {}),
                ...(reason ? { reason } : {})
            })
        );
        return { items, pagination: getPaginationResponse(total, { page, pageSize }) };
    }
});

/** POST /: add an address by hand. Idempotent. */
export const adminCreateDirectEmailSuppressionRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Add direct email suppression (admin)',
    description: 'Adds an address to the suppression list (reason manual). Idempotent.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_SEND],
    requestBody: CreateDirectEmailSuppressionSchema,
    responseSchema: DirectEmailSuppressionSchema,
    handler: async (ctx, _params, body) =>
        unwrapDirectEmailResult(
            await getDirectEmailSuppressionService().add(
                getActorFromContext(ctx),
                CreateDirectEmailSuppressionSchema.parse(body)
            )
        )
});

/** DELETE /{id}: remove an address from the list. */
export const adminDeleteDirectEmailSuppressionRoute = createAdminRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Remove direct email suppression (admin)',
    description: 'Removes an address from the suppression list.',
    tags: ['Direct emails'],
    requiredPermissions: [PermissionEnum.DIRECT_EMAIL_SEND],
    requestParams: { id: z.string().uuid('Suppression ID must be a valid UUID') },
    responseSchema: z.null(),
    handler: async (ctx, params) => {
        unwrapDirectEmailResult(
            await getDirectEmailSuppressionService().remove(getActorFromContext(ctx), {
                id: params.id as string
            })
        );
        return null;
    }
});
