/**
 * The owner's menu QR scan aggregate (HOS-1044 §6.4).
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import { PermissionEnum, QrCodeScanStatsSchema, QrCodeScanWindowSchema } from '@repo/schemas';
import {
    buildEmptyQrCodeScanStats,
    entityNotFoundError,
    GASTRONOMY_MENU_QR_ENTITY_TYPE,
    GASTRONOMY_MENU_QR_PURPOSE,
    GastronomyService,
    QrCodeService
} from '@repo/service-core';
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';

import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });
const qrCodeService = new QrCodeService({ logger: apiLogger });

/**
 * Rate budget for this route, per user per minute. Mirrors `menuQr.ts`: an
 * owner dashboard reads this on visit and on a window toggle, never in a loop.
 */
const MENU_QR_SCANS_RATE_LIMIT_MAX = 30;

/** Fetches the aggregate for one venue's menu QR, zero-filled if none exists yet. */
export async function handleGetGastronomyMenuQrScans(
    ctx: Context,
    params: Record<string, unknown>,
    query: Record<string, unknown>
): Promise<z.infer<typeof QrCodeScanStatsSchema>> {
    const actor = getActorFromContext(ctx);
    const gastronomyId = params.id as string;
    const window = query.window as z.infer<typeof QrCodeScanWindowSchema>;

    const listing = await gastronomyService.getById(actor, gastronomyId);
    const entity = listing.error ? null : listing.data;

    // Same gate, same wording as `menuQr.ts` / `protected/getById.ts` — a
    // divergent message here would tell a caller that the id they hold is
    // real (HOS-600). A 403 would confirm the id exists, so this is a 404.
    const hasViewAll = actor.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
    if (!entity || (!hasViewAll && entity.ownerId !== actor.id)) {
        throw entityNotFoundError({ entityName: GastronomyService.ENTITY_NAME });
    }

    const code = await qrCodeService.findLiveCodeForEntity({
        actor,
        entityType: GASTRONOMY_MENU_QR_ENTITY_TYPE,
        entityId: entity.id,
        purpose: GASTRONOMY_MENU_QR_PURPOSE
    });

    if (code.error) {
        throw new ServiceError(code.error.code, code.error.message);
    }

    // No code minted yet: zero aggregate, never a 404 and never a mint
    // (§6.4 — minting happens ONLY in `menuQr.ts`).
    if (!code.data) {
        return buildEmptyQrCodeScanStats(window);
    }

    const stats = await qrCodeService.getScanStatsForCode({
        actor,
        qrCodeId: code.data.id,
        window
    });

    if (stats.error) {
        throw new ServiceError(stats.error.code, stats.error.message);
    }

    return stats.data as z.infer<typeof QrCodeScanStatsSchema>;
}

/**
 * GET /api/v1/protected/gastronomies/:id/menu-qr/scans
 *
 * Owner-only. The former plan entitlement was removed with HOS-1416.
 */
export const protectedGetGastronomyMenuQrScansRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/menu-qr/scans',
    summary: 'Get the scan aggregate for a gastronomy listing’s menu QR',
    description:
        'Returns the total scans, a gap-filled daily series, and device/OS/language breakdowns ' +
        'for the venue’s menu QR over a rolling window (7d or 30d, default 30d). A venue with no ' +
        'menu QR yet gets an all-zero aggregate — this endpoint never mints a code. Owner-only.',
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        window: QrCodeScanWindowSchema.default('30d')
    },
    responseSchema: QrCodeScanStatsSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MENU_QR_SCAN_METRICS entitlement gate.
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) =>
        handleGetGastronomyMenuQrScans(ctx, params, query as Record<string, unknown>),
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: MENU_QR_SCANS_RATE_LIMIT_MAX,
                keyPrefix: 'menu-qr-scans:gastronomy'
            })
        ]
    }
});
