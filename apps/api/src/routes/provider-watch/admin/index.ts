/**
 * Admin routes of the provider watch battery (HOS-1512). Mounted at
 * `/api/v1/admin/provider-watch`. Every route needs `PROVIDER_WATCH_MANAGE`, which only SUPER_ADMIN
 * holds: they read the provider account, write the monthly authorization and accept changed
 * response shapes.
 */
import {
    PermissionEnum,
    ProviderWatchAcceptShapeInputSchema,
    ProviderWatchAccountSchema,
    ProviderWatchAuthorizeInputSchema,
    ProviderWatchShapeReviewSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { PlatformSettingsService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { createRouter } from '../../../utils/create-app.js';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger.js';
import { readProviderAccount } from '../../../utils/provider-watch/provider-watch-account.js';
import {
    acceptShape,
    listShapeReviews
} from '../../../utils/provider-watch/provider-watch-review.js';
import { resolveWatchAccount } from '../../../utils/provider-watch/provider-watch-schedule.js';
import { buildWatchTransport } from '../../../utils/provider-watch/provider-watch-transport.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

const service = new PlatformSettingsService({ logger: apiLogger });

/** The account kind this environment watches, or a configuration error when it is not set. */
function environmentAccount() {
    const account = resolveWatchAccount({ slugPrefix: env.HOSPEDA_HEALTHCHECKS_SLUG_PREFIX });
    if (account === null) {
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'The environment does not say which provider account to watch'
        );
    }
    return account;
}

/** Reads the provider account of this environment, or answers why it cannot be confirmed. */
async function readConfirmedAccount(account: ReturnType<typeof environmentAccount>) {
    const read = await readProviderAccount({ transport: buildWatchTransport(), account });
    if (!read.ok) {
        throw new ServiceError(
            read.refusal === 'WRONG_KIND'
                ? ServiceErrorCode.VALIDATION_ERROR
                : ServiceErrorCode.SERVICE_UNAVAILABLE,
            read.refusal === 'WRONG_KIND'
                ? `The provider token of this environment is not a ${account === 'sandbox' ? 'test' : 'production'} account`
                : 'The provider account could not be read'
        );
    }
    return read.account;
}

/**
 * GET /api/v1/admin/provider-watch/account: the provider account this environment's token
 * belongs to, for the owner to confirm before authorizing.
 */
export const adminGetProviderWatchAccountRoute = createAdminRoute({
    method: 'get',
    path: '/account',
    summary: 'Read the provider account of this environment',
    description:
        'Reads GET /users/me with the environment token and answers the account id and nickname the owner confirms before authorizing the watch battery.',
    tags: ['Provider watch'],
    requiredPermissions: [PermissionEnum.PROVIDER_WATCH_MANAGE],
    responseSchema: ProviderWatchAccountSchema,
    handler: async () => readConfirmedAccount(environmentAccount())
});

/**
 * POST /api/v1/admin/provider-watch/authorization: authorizes ONE run of the month. The API reads
 * the account again and refuses unless it is the id the owner confirmed; it stores the id it read.
 */
export const adminAuthorizeProviderWatchRoute = createAdminRoute({
    method: 'post',
    path: '/authorization',
    summary: 'Authorize the provider watch battery for a month',
    description:
        'Writes the one-run authorization: the month, the exact maximum charge in centavos and the provider account the owner confirmed.',
    tags: ['Provider watch'],
    requiredPermissions: [PermissionEnum.PROVIDER_WATCH_MANAGE],
    requestBody: ProviderWatchAuthorizeInputSchema,
    responseSchema: z.object({
        month: z.string(),
        maxChargeMinor: z.number(),
        accountId: z.string(),
        accountNickname: z.string().nullable()
    }),
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = ProviderWatchAuthorizeInputSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const account = await readConfirmedAccount(environmentAccount());
        if (account.id !== input.confirmedAccountId) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'The provider account is not the one the owner confirmed'
            );
        }
        const result = await service.setProviderWatchAuthorization({
            actor,
            value: {
                month: input.month,
                maxChargeMinor: input.maxChargeMinor,
                accountId: account.id,
                ...(account.nickname === null ? {} : { accountNickname: account.nickname })
            }
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return {
            month: input.month,
            maxChargeMinor: input.maxChargeMinor,
            accountId: account.id,
            accountNickname: account.nickname
        };
    }
});

/**
 * GET /api/v1/admin/provider-watch/shapes: for every measurement of the latest completed run, the
 * accepted shapes against what was observed.
 */
export const adminListProviderWatchShapesRoute = createAdminRoute({
    method: 'get',
    path: '/shapes',
    summary: 'Review the response shapes the watch battery observed',
    description:
        'Lists, per measurement, the shapes the owner accepted, the ones the latest completed run observed and their differences.',
    tags: ['Provider watch'],
    requiredPermissions: [PermissionEnum.PROVIDER_WATCH_MANAGE],
    responseSchema: z.object({ items: z.array(ProviderWatchShapeReviewSchema) }),
    handler: async () => ({
        items: [...(await listShapeReviews({ account: environmentAccount() }))]
    })
});

/**
 * POST /api/v1/admin/provider-watch/shapes/{measurementId}/accept: accepts what a run observed.
 * This is the only way the baseline advances.
 */
export const adminAcceptProviderWatchShapeRoute = createAdminRoute({
    method: 'post',
    path: '/shapes/{measurementId}/accept',
    summary: 'Accept the observed shape of a measurement',
    description:
        'Makes the shapes observed by the given completed run the accepted baseline of the measurement, recording who accepted and when.',
    tags: ['Provider watch'],
    requiredPermissions: [PermissionEnum.PROVIDER_WATCH_MANAGE],
    requestParams: { measurementId: z.string().regex(/^(?:M|RP)\d{1,2}$/) },
    requestBody: ProviderWatchAcceptShapeInputSchema,
    responseSchema: z.object({ acceptedAt: z.string().datetime({ offset: true }) }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = ProviderWatchAcceptShapeInputSchema.parse(body);
        const account = environmentAccount();
        if (input.account !== account) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'This environment does not watch that account'
            );
        }
        const actor = getActorFromContext(ctx);
        const result = await acceptShape({
            account,
            measurementId: String(params.measurementId),
            runId: input.runId,
            acceptedBy: actor.id
        });
        if (!result.accepted) {
            throw new ServiceError(
                result.refusal === 'RUN_NOT_FOUND'
                    ? ServiceErrorCode.NOT_FOUND
                    : ServiceErrorCode.VALIDATION_ERROR,
                `The shape cannot be accepted: ${result.refusal}`
            );
        }
        return { acceptedAt: result.acceptedAt.toISOString() };
    }
});

const router = createRouter();
router.route('/', adminGetProviderWatchAccountRoute);
router.route('/', adminAuthorizeProviderWatchRoute);
router.route('/', adminListProviderWatchShapesRoute);
router.route('/', adminAcceptProviderWatchShapeRoute);

export { router as adminProviderWatchRoutes };
