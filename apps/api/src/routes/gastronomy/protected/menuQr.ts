/**
 * The owner's menu QR and its printable image (HOS-1044 §6.2).
 *
 * ```
 * GET /api/v1/protected/gastronomies/{id}/menu-qr
 * ```
 *
 * ## Order of refusals
 *
 * 1. **Authentication** — `createProtectedRoute`.
 * 2. **The plan's terms** — `commerceVerticalEntitlementMiddleware('gastronomy')`
 *    loads the caller's GASTRONOMY grants and `requireEntitlement` refuses a
 *    caller whose plan does not carry `MENU_QR_SCAN_METRICS`. The loader MUST
 *    stay ahead of the gate: the global `entitlementMiddleware` has already
 *    put the ACCOMMODATION set in the context, and that set never carries a
 *    commerce key (HOS-1074).
 * 3. **Ownership**, as a 404 — before anything is minted, so a caller who
 *    does not own the listing cannot create a `qr_codes` row for someone
 *    else's venue, and so no 403 ever confirms that the id exists.
 *
 * ## Minting happens ONLY here (§6.2, AC-4)
 *
 * `QrCodeService.getOrCreateForEntity` is idempotent on
 * `(entityType, entityId, purpose)` — a second call for the same venue
 * returns the SAME row (AC-2). The public `/carta/` page must never call it:
 * doing so would let any visitor of a non-premium venue's menu create a live
 * `qr_codes` row as the side effect of a plain `GET`.
 *
 * The initial target is minted at the platform's default locale
 * (`@repo/i18n`'s `defaultLocale`) — the endpoint takes no `lang` parameter,
 * and a QR encodes one destination for the life of the sticker. A later slug
 * rename repoints the SAME code via `GastronomyService._afterUpdate`, which
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
 * @module routes/gastronomy/protected/menuQr
 */

import { EntitlementKey } from '@repo/billing';
import { defaultLocale } from '@repo/i18n';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import {
    buildGastronomyMenuQrLabel,
    buildGastronomyMenuQrTargetUrl,
    entityNotFoundError,
    GASTRONOMY_MENU_QR_ENTITY_TYPE,
    GASTRONOMY_MENU_QR_PURPOSE,
    GastronomyService,
    QrCodeService
} from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { createSlidingWindowPerUserRateLimit } from '../../../middlewares/rate-limit';
import { getActorFromContext } from '../../../utils/actor';
import { buildQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { renderQrSvg } from '../../../utils/qr-render';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });
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
const GastronomyMenuQrResponseSchema = z.object({
    svg: z.string(),
    url: z.string().url(),
    targetUrl: z.string().url(),
    slug: z.string(),
    qrSlug: z.string()
});

/** Fetches (minting on first call) and renders one venue's menu QR. */
export async function handleGetGastronomyMenuQr(
    ctx: Context,
    params: Record<string, unknown>
): Promise<z.infer<typeof GastronomyMenuQrResponseSchema>> {
    const actor = getActorFromContext(ctx);
    const gastronomyId = params.id as string;

    const listing = await gastronomyService.getById(actor, gastronomyId);
    const entity = listing.error ? null : listing.data;

    // Same gate, same wording as `protected/getById.ts` / `protected/brochure.ts`
    // — a divergent message here would tell a caller that the id they hold is
    // real (HOS-600). A 403 would confirm the id exists, so this is a 404.
    const hasViewAll = actor.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
    if (!entity || (!hasViewAll && entity.ownerId !== actor.id)) {
        throw entityNotFoundError({ entityName: GastronomyService.ENTITY_NAME });
    }

    const siteUrl = env.HOSPEDA_SITE_URL;
    const targetUrl = buildGastronomyMenuQrTargetUrl({
        siteUrl,
        lang: defaultLocale,
        slug: entity.slug
    });

    // Provisioned on READ, deliberately (§6.2, AC-4): a code is created the
    // first time an owner asks to SEE it, never as a side effect of the
    // public menu page being viewed.
    const code = await qrCodeService.getOrCreateForEntity({
        actor,
        entityType: GASTRONOMY_MENU_QR_ENTITY_TYPE,
        entityId: entity.id,
        purpose: GASTRONOMY_MENU_QR_PURPOSE,
        targetUrl,
        label: buildGastronomyMenuQrLabel({ name: entity.name, slug: entity.slug })
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
 * GET /api/v1/protected/gastronomies/:id/menu-qr
 *
 * Premium-only: gated on `MENU_QR_SCAN_METRICS`, granted by `gastronomy-premium`
 * alone (HOS-1044 §6.5), NOT by `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that
 * map is the floor every tier gets, and this key is a tier differentiator.
 */
export const protectedGetGastronomyMenuQrRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/menu-qr',
    summary: 'Get the menu QR for a gastronomy listing',
    description:
        'Returns the SVG of the venue’s menu QR, the URL it encodes (`{site}/qr/{qrSlug}/`), and the carta page that URL redirects to. The code is created on the first call and reused afterwards, so the image stays byte-identical for the life of the listing even if the listing is renamed. Owner-only, and requires the menu_qr_scan_metrics entitlement granted by the premium gastronomy plan.',
    tags: ['Gastronomy', 'Gastronomy Menu'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: GastronomyMenuQrResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetGastronomyMenuQr(ctx, params),
    options: {
        middlewares: [
            createSlidingWindowPerUserRateLimit({
                windowMs: 60_000,
                max: MENU_QR_RATE_LIMIT_MAX,
                keyPrefix: 'menu-qr:gastronomy'
            }),
            // Loader before checker (HOS-1074) — the global entitlement
            // middleware resolves the ACCOMMODATION set, which never carries a
            // commerce key, so `commerceVerticalEntitlementMiddleware` MUST run
            // before `requireEntitlement` on every commerce route.
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.MENU_QR_SCAN_METRICS)
        ]
    }
});
