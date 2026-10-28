/**
 * The owner's menu QR and its printable image (HOS-1044 §6.2).
 *
 * ```
 * GET /api/v1/protected/venues/{id}/menu-qr
 * ```
 *
 * ## Order of refusals
 *
 * 1. **Authentication** — `createProtectedRoute`.
 * 2. **Ownership**, as a 404 — before anything is minted, so a caller who
 *    does not own the listing cannot create a `qr_codes` row for someone
 *    else's venue, and so no 403 ever confirms that the id exists.
 * 3. **Capability** — menu_qr_scan_metrics on the listing owner's effective set.
 *
 * ## Minting happens ONLY here (§6.2, AC-4)
 *
 * `QrCodeService.getOrCreateForEntity` is idempotent on
 * `(entityType, entityId, purpose)` — a second call for the same venue
 * returns the SAME row (AC-2). The public `/carta/` page must never call it:
 * doing so would let any visitor of a venue's menu create a live
 * `qr_codes` row as the side effect of a plain `GET`.
 *
 * The initial target is minted at the platform's default locale
 * (`@repo/i18n`'s `defaultLocale`) — the endpoint takes no `lang` parameter,
 * and a QR encodes one destination for the life of the sticker. A later slug
 * rename repoints the SAME code via `VenueService._afterUpdate`, which
 * reads the locale back out of the stored target rather than re-guessing it
 * (`gastronomy-qr.ts`).
 *
 * ## Why the SVG travels as a JSON field
 *
 * Mirrors `host-trade/protected/mine-qr.ts`: the caller is the owner's
 * dashboard, which needs to inline the image next to a download button. A
 * raw `image/svg+xml` response would force a second fetch for the metadata
 * this route already has to compute.
 *
 * @module routes/venue/protected/menuQr
 */

import { defaultLocale } from '@repo/i18n';
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import {
    buildVenueMenuQrLabel,
    buildVenueMenuQrTargetUrl,
    entityNotFoundError,
    QrCodeService,
    VENUE_MENU_QR_ENTITY_TYPE,
    VENUE_MENU_QR_PURPOSE,
    VenueService
} from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';

import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../utils/actor';
import { buildQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { renderQrSvg } from '../../../utils/qr-render';
import { createProtectedRoute } from '../../../utils/route-factory';

const venueService = new VenueService({ logger: apiLogger });
const qrCodeService = new QrCodeService({ logger: apiLogger });

/**
 * Rate budget for this route, per user per minute.
 *
 * Mirrors `host-trade/protected/mine-qr.ts`'s own limit: a dashboard reads
 * this once per visit and again on demand for the download button, never in
 * a loop.
 */
const MENU_QR_RATE_LIMIT_MAX = 30;

/** Response shape. Mirrors `HostTradeQrResponseSchema` field-for-field. */
const VenueMenuQrResponseSchema = z.object({
    svg: z.string(),
    url: z.string().url(),
    targetUrl: z.string().url(),
    slug: z.string(),
    qrSlug: z.string()
});

/** Fetches (minting on first call) and renders one venue's menu QR. */
export async function handleGetVenueMenuQr(
    ctx: Context,
    params: Record<string, unknown>
): Promise<z.infer<typeof VenueMenuQrResponseSchema>> {
    const actor = getActorFromContext(ctx);
    const venueId = params.id as string;

    const listing = await venueService.getById(actor, venueId);
    const entity = listing.error ? null : listing.data;

    // Listing access has already checked ownership; retain the missing-row 404.
    if (!entity) {
        throw entityNotFoundError({ entityName: VenueService.ENTITY_NAME });
    }

    const siteUrl = env.HOSPEDA_SITE_URL;
    const targetUrl = buildVenueMenuQrTargetUrl({
        siteUrl,
        lang: defaultLocale,
        slug: entity.slug
    });

    // Provisioned on READ, deliberately (§6.2, AC-4): a code is created the
    // first time an owner asks to SEE it, never as a side effect of the
    // public menu page being viewed.
    const code = await qrCodeService.getOrCreateForEntity({
        actor,
        entityType: VENUE_MENU_QR_ENTITY_TYPE,
        entityId: entity.id,
        purpose: VENUE_MENU_QR_PURPOSE,
        targetUrl,
        label: buildVenueMenuQrLabel({ name: entity.name, slug: entity.slug })
    });

    if (code.error) {
        throw new ServiceError(code.error.code, code.error.message);
    }
    if (!code.data?.slug) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Menu QR code could not be provisioned for this listing'
        );
    }

    const qrSlug = code.data.slug;
    const scanUrl = buildQrScanUrl({ qrSlug, siteUrl });

    return {
        svg: await renderQrSvg({ data: scanUrl }),
        url: scanUrl,
        targetUrl: code.data.targetUrl,
        slug: entity.slug,
        qrSlug
    };
}

/**
 * GET /api/v1/protected/venues/:id/menu-qr
 *
 * Owner-only menu QR read requiring menu_qr_scan_metrics on the listing owner.
 */
export const protectedGetVenueMenuQrRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/menu-qr',
    listingAccess: {
        vertical: VerticalEnum.VENUE,
        operation: 'READ_OWN_COMMERCIAL',
        idParam: 'id',
        step6Key: 'menu_qr_scan_metrics'
    },
    summary: 'Get the menu QR for a gastronomy listing',
    description:
        'Returns the SVG of the venue’s menu QR, the URL it encodes (`{site}/qr/{qrSlug}/`), and the carta page that URL redirects to. The code is created on the first call and reused afterwards, so the image stays byte-identical for the life of the listing even if the listing is renamed. Owner-only.',
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: VenueMenuQrResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetVenueMenuQr(ctx, params),
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: MENU_QR_RATE_LIMIT_MAX,
                keyPrefix: 'menu-qr:gastronomy'
            })
        ]
    }
});
