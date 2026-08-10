/**
 * Admin usage audit and declaration suspension (HOS-376 T-038).
 *
 * ```
 * GET  /api/v1/admin/host-trades/usages
 * POST /api/v1/admin/host-trades/{id}/declaration-suspension
 * ```
 *
 * THE LISTING IS AN ABUSE-TRIAGE TOOL, not a browsing screen. Its filters are
 * chosen for one question — is this provider manufacturing usages? — and
 * `creationChannel` is the sharp one: the email fallback is the only channel a
 * provider can drive without the host being present (R-5), so isolating
 * `EMAIL_LOOKUP` is how a suspected pattern gets read.
 *
 * SUSPENDING AND LIFTING SHARE ONE ENDPOINT because they are one decision with
 * two values, and an admin who can do one can do the other. The body carries
 * which, so the screen cannot end up with a "suspend" button that silently
 * lifts.
 *
 * @module routes/host-trade/admin/usages
 */

import {
    HostTradeBenefitUsageAdminSchema,
    HostTradeBenefitUsageAdminSearchSchema,
    HostTradeIdSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { HostTradeUsageService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';

const usageService = new HostTradeUsageService({ logger: apiLogger });

/**
 * Body of a suspension decision.
 *
 * The reason is required to SUSPEND and absent when LIFTING: a suspension takes
 * away a provider's ability to record work at all and he is owed an answer, while
 * lifting one restores the normal state and explains itself. Enforced by a
 * refinement rather than two endpoints, so the screen has one thing to call.
 */
const DeclarationSuspensionBodySchema = z
    .object({
        suspended: z.boolean(),
        reason: z.string().min(1).max(1000).optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        if (value.suspended && !value.reason) {
            ctx.addIssue({
                code: 'custom',
                path: ['reason'],
                message: 'zodError.hostTrade.declarationSuspension.reason.required'
            });
        }
    });

/** GET /api/v1/admin/host-trades/usages */
export const adminListHostTradeUsagesRoute = createAdminListRoute({
    method: 'get',
    path: '/usages',
    summary: 'List benefit usages (admin)',
    description:
        'Returns a paginated list of benefit usages across every provider, for abuse triage. Filterable by provider, host, state, declaring side, creation channel and date range. Filtering by creationChannel=EMAIL_LOOKUP isolates the one channel a provider can drive without the host being present.',
    tags: ['HostTrades', 'Moderation'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL],
    requestQuery: HostTradeBenefitUsageAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: HostTradeBenefitUsageAdminSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query ?? {});

        const result = await usageService.adminList(actor, query ?? {});
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});

/**
 * POST /api/v1/admin/host-trades/{id}/declaration-suspension
 *
 * The body is re-parsed in the handler for the HOS-425 reason documented in
 * `protected/mine-usages.ts`: in Zod 4 a `.superRefine()` leaves a `ZodObject`
 * whose `_def.typeName` is gone, so the route factory's Zod-3-era probe reads
 * this schema as plain and rebuilds it, dropping the refinement. Without the
 * re-parse a suspension with no reason would reach the service, which refuses
 * it too — the rule holds either way, but the refusal would come from the wrong
 * layer.
 */
export const adminSetDeclarationSuspensionRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/declaration-suspension',
    summary: 'Suspend or restore a provider’s ability to declare',
    description:
        'Suspends a provider from declaring benefit usages, or lifts an existing suspension. Suspending requires a reason and records which admin decided it — the automatic threshold suspension leaves that empty on purpose, so the two can be told apart. Lifting restores declaring and clears the record; doing it twice succeeds without writing.',
    tags: ['HostTrades', 'Moderation'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_USAGE_MANAGE],
    requestParams: { id: HostTradeIdSchema },
    requestBody: DeclarationSuspensionBodySchema,
    responseSchema: z.object({ suspended: z.boolean() }),
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const parsed = DeclarationSuspensionBodySchema.safeParse(body);
        if (!parsed.success) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                parsed.error.issues[0]?.message ?? 'Invalid body'
            );
        }

        const actor = getActorFromContext(ctx);
        const hostTradeId = params.id as string;

        if (parsed.data.suspended) {
            const result = await usageService.applyDeclarationSuspension(
                { hostTradeId, reason: parsed.data.reason as string },
                actor
            );
            if (result.error) {
                throw new ServiceError(result.error.code, result.error.message);
            }
            return { suspended: true };
        }

        const result = await usageService.liftDeclarationSuspension({ hostTradeId }, actor);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        return { suspended: false };
    }
});
