/**
 * The owner's menu QR scan aggregate (HOS-1044 §6.4).
 *
 * ```
 * GET /api/v1/protected/venues/{id}/menu-qr/scans
 * ```
 *
 * The same ownership and menu_qr_scan_metrics gate as `menuQr.ts` applies.
 *
 * ## The one thing this route does differently from `menuQr.ts`: it never mints
 *
 * `menuQr.ts` provisions the code on first read (§6.2). This route must not:
 * a venue that has never asked to SEE its QR has no `qrCodeId` to aggregate
 * scans for, and creating one here — as a side effect of opening the panel —
 * would be exactly the orphan-row failure mode §6.2 exists to prevent. So a
 * venue with no `MENU` code yet gets the all-zero aggregate
 * (`buildEmptyQrCodeScanStats`), never a 404 and never a freshly minted row.
 *
 * @module routes/venue/protected/menuQrScans
 */

import { QrCodeScanStatsSchema, QrCodeScanWindowSchema, VerticalEnum } from '@repo/schemas';
import {
    buildEmptyQrCodeScanStats,
    entityNotFoundError,
    QrCodeService,
    VENUE_MENU_QR_ENTITY_TYPE,
    VENUE_MENU_QR_PURPOSE,
    VenueService
} from '@repo/service-core';
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';

import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });
const qrCodeService = new QrCodeService({ logger: apiLogger });

/**
 * Rate budget for this route, per user per minute. Mirrors `menuQr.ts`: an
 * owner dashboard reads this on visit and on a window toggle, never in a loop.
 */
const MENU_QR_SCANS_RATE_LIMIT_MAX = 30;

/** Fetches the aggregate for one venue's menu QR, zero-filled if none exists yet. */
export async function handleGetVenueMenuQrScans(
    ctx: Context,
    params: Record<string, unknown>,
    query: Record<string, unknown>
): Promise<z.infer<typeof QrCodeScanStatsSchema>> {
    const actor = getActorFromContext(ctx);
    const venueId = params.id as string;
    const window = query.window as z.infer<typeof QrCodeScanWindowSchema>;

    const listing = await venueService.getById(actor, venueId);
    const entity = listing.error ? null : listing.data;

    // Listing access has already checked ownership; retain the missing-row 404.
    if (!entity) {
        throw entityNotFoundError({ entityName: VenueService.ENTITY_NAME });
    }

    const code = await qrCodeService.findLiveCodeForEntity({
        actor,
        entityType: VENUE_MENU_QR_ENTITY_TYPE,
        entityId: entity.id,
        purpose: VENUE_MENU_QR_PURPOSE
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
 * GET /api/v1/protected/venues/:id/menu-qr/scans
 *
 * Owner-only scan aggregate requiring menu_qr_scan_metrics on the listing owner.
 */
export const protectedGetVenueMenuQrScansRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/menu-qr/scans',
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'READ_OWN_COMMERCIAL',
        idParam: 'id',
        step6Key: 'menu_qr_scan_metrics'
    },
    summary: 'Get the scan aggregate for a gastronomy listing’s menu QR',
    description:
        'Returns the total scans, a gap-filled daily series, and device/OS/language breakdowns ' +
        'for the venue’s menu QR over a rolling window (7d or 30d, default 30d). A venue with no ' +
        'menu QR yet gets an all-zero aggregate — this endpoint never mints a code. Owner-only.',
    tags: ['Venue', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestQuery: {
        window: QrCodeScanWindowSchema.default('30d')
    },
    responseSchema: QrCodeScanStatsSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, _body, query) =>
        handleGetVenueMenuQrScans(ctx, params, query as Record<string, unknown>),
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
