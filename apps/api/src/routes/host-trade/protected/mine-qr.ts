/**
 * The provider's printable QR (HOS-376 T-032).
 *
 * ```
 * GET /api/v1/protected/host-trades/mine/qr
 * ```
 *
 * Authorised by ROW OWNERSHIP, the same shape as the rest of `/mine`: an
 * approved provider holds no `HOST_TRADE_*` permission, and the path carries no
 * id, so "a provider cannot fetch another's QR" is structural.
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
import { HostTradeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { buildHostTradeUsageUrl, renderHostTradeQrSvg } from '../../../utils/host-trade-qr';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * Response shape.
 *
 * The URL travels alongside the image on purpose: a provider who cannot scan
 * his own code (printing from a machine with no camera, or debugging why a
 * scan lands nowhere) needs to be able to read the destination as text.
 */
const HostTradeQrResponseSchema = z.object({
    svg: z.string(),
    url: z.string().url(),
    slug: z.string()
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

    const { slug } = own.data.trade;
    const siteUrl = env.HOSPEDA_SITE_URL;

    return {
        svg: await renderHostTradeQrSvg({ slug, siteUrl }),
        url: buildHostTradeUsageUrl({ slug, siteUrl }),
        slug
    };
}

/**
 * GET /api/v1/protected/host-trades/mine/qr
 *
 * The QR is derived, not stored: same slug, same image, every time. Nothing is
 * persisted here and nothing expires, which is what lets the provider print it
 * once and stick it on a van.
 */
export const protectedGetMyQrRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/qr',
    summary: 'Get the QR for your own listing',
    description:
        'Returns the SVG of the QR that sends a host to the usage-registration page for the caller’s own listing, plus the URL it encodes. Derived from the listing’s slug on every call — no token, no expiry, and the same slug always renders the same image, so a printed sticker stays valid.',
    tags: ['HostTrades'],
    responseSchema: HostTradeQrResponseSchema,
    handler: async (ctx: Context) => handleGetMyQr(ctx),
    options: {
        customRateLimit: { requests: 30, windowMs: 60_000 }
    }
});
