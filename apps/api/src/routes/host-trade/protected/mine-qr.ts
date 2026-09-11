/**
 * The provider's printable QR (HOS-376 T-032, HOS-981 PR 4).
 *
 * ```
 * GET /api/v1/protected/host-trades/mine/qr
 * ```
 *
 * Authorised by ROW OWNERSHIP, the same shape as the rest of `/mine`: an
 * approved provider holds no `HOST_TRADE_*` permission, and the path carries no
 * id, so "a provider cannot fetch another's QR" is structural. That ownership
 * check is also what stands in for the missing `QR_CODE_CREATE` gate on the
 * provisioning call below — a provider holds no QR permission at all, and
 * routing this through `QrCodeService.create()` would lock every one of them
 * out of their own sticker.
 *
 * The endpoint is no longer a pure function of the listing: the FIRST call for
 * a listing writes a `qr_codes` row. It stays a `GET` because it is idempotent
 * — every later call returns that same row — and because the alternative would
 * be asking a provider to POST before they may look at their own code.
 *
 * Serves the SVG as a JSON field rather than as an `image/svg+xml` body. The
 * caller is the provider's dashboard, which needs to inline it next to a
 * download button and a print stylesheet; a raw image response would force the
 * page to fetch it twice, and returning attacker-influenced markup under an
 * image content-type is a shape worth not having at all.
 *
 * @module routes/host-trade/protected/mine-qr
 */

import { ServiceErrorCode } from '@repo/schemas';
import {
    buildHostTradeQrLabel,
    HOST_TRADE_QR_ENTITY_TYPE,
    HOST_TRADE_QR_PURPOSE,
    HostTradeService,
    QrCodeService,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import {
    buildHostTradeQrScanUrl,
    buildHostTradeUsageUrl,
    renderHostTradeQrSvg
} from '../../../utils/host-trade-qr';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });
const qrCodeService = new QrCodeService({ logger: apiLogger });

/**
 * Response shape.
 *
 * ## What each field means since HOS-981 PR 4
 *
 * The QR stopped encoding the usage-registration page and started encoding the
 * platform's own redirect, so the two URLs that used to be one had to be told
 * apart. Nothing was removed — the field that changed meaning says so here.
 *
 * - `url` — **what the symbol actually encodes**, `{site}/qr/{qrSlug}/`. It
 *   carried the registration URL before. The field exists so a provider who
 *   cannot scan his own code (printing from a machine with no camera, or
 *   working out why a scan lands nowhere) can read it as text and type it, and
 *   that only works if it is the same string the camera would read.
 * - `targetUrl` — NEW. Where the redirect lands: the usage-registration page.
 *   This is the value `url` used to carry, kept as its own field so the panel
 *   can still say "leads to …" honestly.
 * - `slug` — unchanged: the LISTING's slug. It names the downloaded file and
 *   identifies the provider; it is no longer what the image is derived from.
 * - `qrSlug` — NEW. The QR code's own slug, the half that is printed and never
 *   changes. Surfaced because it is what an operator matches against
 *   `qr_codes.slug` when somebody reports a dead sticker.
 */
const HostTradeQrResponseSchema = z.object({
    svg: z.string(),
    url: z.string().url(),
    targetUrl: z.string().url(),
    slug: z.string(),
    qrSlug: z.string()
});

/** Renders the caller's own QR. Exported standalone for testability. */
export async function handleGetMyQr(ctx: Context) {
    const actor = getActorFromContext(ctx);

    const own = await hostTradeService.getOwn(actor);
    if (own.error) {
        throw new ServiceError(own.error.code, own.error.message);
    }
    if (!own.data?.trade) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Host trade listing not found');
    }

    const { id, slug, name } = own.data.trade;
    const siteUrl = env.HOSPEDA_SITE_URL;

    // Provisioned on READ, deliberately: it covers every listing already in
    // production with no backfill, and a provider who never asks to see a code
    // never burns a permanent slug on one.
    const code = await qrCodeService.getOrCreateForEntity({
        actor,
        entityType: HOST_TRADE_QR_ENTITY_TYPE,
        entityId: id,
        purpose: HOST_TRADE_QR_PURPOSE,
        targetUrl: buildHostTradeUsageUrl({ slug, siteUrl }),
        label: buildHostTradeQrLabel({ name, slug })
    });

    if (code.error) {
        throw new ServiceError(code.error.code, code.error.message);
    }
    if (!code.data) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'QR code could not be provisioned for this listing'
        );
    }

    const qrSlug = code.data.slug;

    return {
        svg: await renderHostTradeQrSvg({ qrSlug, siteUrl }),
        url: buildHostTradeQrScanUrl({ qrSlug, siteUrl }),
        targetUrl: code.data.targetUrl,
        slug,
        qrSlug
    };
}

/**
 * GET /api/v1/protected/host-trades/mine/qr
 *
 * The QR is now derived from a STORED code rather than from the listing's slug:
 * same `qr_codes.slug`, same image, every time, and nothing anybody can do to
 * the listing changes it. That is the stronger version of the old guarantee,
 * not a weaker one — renaming the listing used to invalidate every sticker
 * already printed, and now it only repoints where the redirect lands.
 */
export const protectedGetMyQrRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/qr',
    summary: 'Get the QR for your own listing',
    description:
        'Returns the SVG of the caller’s own QR, the URL it encodes (`{site}/qr/{qrSlug}/`), and the usage-registration page that URL redirects to. The code is created on the first call and reused afterwards, so the image stays byte-identical for the life of the listing even if the listing is renamed — a printed sticker never stops working.',
    tags: ['HostTrades'],
    responseSchema: HostTradeQrResponseSchema,
    handler: async (ctx: Context) => handleGetMyQr(ctx),
    options: {
        customRateLimit: { requests: 30, windowMs: 60_000 }
    }
});
