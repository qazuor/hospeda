import {
    AccountCloseOnRequestResponseSchema,
    AccountCloseOnRequestSchema,
    AccountClosurePreviewSchema,
    PermissionEnum,
    ServiceErrorCode,
    UserIdSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { AccountClosureService } from '../../../services/account-closure/account-closure.service';
import { ACCOUNT_CLOSURE_REJECTION_REASONS } from '../../../services/account-closure/account-closure-rejection';
import { getActorFromContext } from '../../../utils/actor';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new AccountClosureService();

/**
 * GET /api/v1/admin/users/{id}/close-on-request — the read that precedes
 * administrative action 24 (ACC:24): whose account it is and its three
 * preconditions, so the confirmation can say whose account it is and that
 * nothing can charge and no listing remains. It informs; the closure re-reads
 * everything under its own locks. Shares path and permission with the POST on
 * purpose: route middlewares are per path and method-agnostic.
 */
export const adminAccountClosurePreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/close-on-request',
    summary: 'Preview closing an account at the owner request (ACC:24)',
    description:
        'Administrative action 24: reads whose account it is and whether it can still be charged, still has listings outside PURGED or a partner presence with content. Requires USER_CLOSE_ON_REQUEST; refused on the actor own account.',
    tags: ['Users', 'Admin'],
    requiredPermissions: [PermissionEnum.USER_CLOSE_ON_REQUEST],
    requestParams: { id: UserIdSchema },
    responseSchema: AccountClosurePreviewSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        service.preview({ actor: getActorFromContext(ctx), userId: params.id as string })
});

/**
 * POST /api/v1/admin/users/{id}/close-on-request — administrative action 24
 * (ACC:24): support closes an account at its owner's request, with a mandatory
 * reason. The account is pseudonymised, stamped with `deleted_at` and left
 * without sessions or credentials; it is refused (422 `VALIDATION_ERROR`, `error.reason`) while it
 * can still be charged or still has a listing outside PURGED or a partner
 * presence with content.
 */
export const adminCloseAccountOnRequestRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/close-on-request',
    summary: 'Close an account at the owner request (ACC:24)',
    description:
        'Administrative action 24: pseudonymises the account, closes its sessions and deletes its credentials, with a mandatory reason. Requires USER_CLOSE_ON_REQUEST; refused on the actor own account and on system accounts.',
    tags: ['Users', 'Admin'],
    requiredPermissions: [PermissionEnum.USER_CLOSE_ON_REQUEST],
    requestParams: { id: UserIdSchema },
    requestBody: AccountCloseOnRequestSchema,
    responseSchema: AccountCloseOnRequestResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            return await service.closeOnRequest({
                actor: getActorFromContext(ctx),
                userId: params.id as string,
                reason: AccountCloseOnRequestSchema.parse(body).reason
            });
        } catch (error) {
            // An unmet precondition is a business rule, not a duplicate: 422 with its `reason`.
            if (
                error instanceof ServiceError &&
                error.code === ServiceErrorCode.VALIDATION_ERROR &&
                ACCOUNT_CLOSURE_REJECTION_REASONS.some((reason) => reason === error.reason)
            ) {
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: error.message,
                        reason: error.reason
                    },
                    ctx,
                    422
                );
            }
            throw error;
        }
    }
});
