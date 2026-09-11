/**
 * The owner's printable PDF ficha of a gastronomy listing (HOS-1058).
 *
 * ```
 * GET /api/v1/protected/gastronomies/{id}/brochure
 * ```
 *
 * ## What it answers, and in what order
 *
 * 1. **Authentication** — `createProtectedRoute`, before anything else.
 * 2. **The plan's terms** — `commerceVerticalEntitlementMiddleware('gastronomy')`
 *    loads the caller's gastronomy grants and `requireEntitlement` refuses a
 *    caller whose plan does not carry `DOWNLOAD_LISTING_PDF`. The loader MUST
 *    stay ahead of the gate: the global `entitlementMiddleware` has already put
 *    the ACCOMMODATION set in the context, and that set never carries a commerce
 *    key (HOS-1074).
 * 3. **Ownership** — the service's owner-tier read, then the same explicit
 *    `ownerId === actor.id || COMMERCE_VIEW_ALL` check `protected/getById.ts`
 *    makes, answering NOT_FOUND for a listing that is not the caller's. A 403
 *    would confirm the id exists.
 * 4. **Is there a public ficha at all** — a listing that is not `PUBLIC` has no
 *    public page to print, and the QR would point at a 404. NOT_FOUND.
 *
 * ## Why the response is a raw `Response`
 *
 * `createCRUDRoute` returns a handler's `Response` untouched, which is what lets
 * a route answer with something that is not JSON. The consequence to keep in
 * mind is that `stripWithSchema` does NOT run on this path — so the projection
 * that keeps owner-private fields out of the document is done explicitly, by
 * parsing the entity through `GastronomyBrochureSourceSchema`, whose every key
 * is proven to exist in `GastronomyPublicSchema` by
 * `test/services/commerce-brochure.test.ts`.
 *
 * @module routes/gastronomy/protected/brochure
 */

import { EntitlementKey } from '@repo/billing';
import {
    EntityTypeEnum,
    PermissionEnum,
    QrCodePurposeEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { entityNotFoundError, GastronomyService } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { buildGastronomyBrochureContent } from '../../../services/commerce-brochure/brochure-content';
import { buildBrochureResponse } from '../../../services/commerce-brochure/brochure-response';
import { GastronomyBrochureSourceSchema } from '../../../services/commerce-brochure/brochure-source';
import { getActorFromContext } from '../../../utils/actor';
import { buildEntityQrLabel, resolveEntityQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { resolveReturnUrlLocale } from '../../billing/checkout-return-urls';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/** Builds the PDF. Exported standalone so the route test can call it directly. */
export async function handleGetGastronomyBrochure(
    ctx: Context,
    params: Record<string, unknown>
): Promise<Response> {
    const actor = getActorFromContext(ctx);
    const result = await gastronomyService.getById(actor, params.id as string);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    const entity = result.data;

    // Same gate, same wording as `protected/getById.ts` — a divergent message
    // here would tell a caller that the id they hold is real (HOS-600).
    const hasViewAll = actor.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
    if (!entity || (!hasViewAll && entity.ownerId !== actor.id)) {
        throw entityNotFoundError({ entityName: GastronomyService.ENTITY_NAME });
    }

    // The brochure is a print of the PUBLIC ficha. A listing with no public
    // ficha has nothing to print, and its QR would send every reader to a 404.
    if (entity.visibility !== VisibilityEnum.PUBLIC) {
        // Same canonical message as the branch above, deliberately: the error
        // contract's anti-enumeration rule wants one spelling of a 404, and two
        // would let a caller tell "not yours" from "not published" (HOS-600).
        throw entityNotFoundError({ entityName: GastronomyService.ENTITY_NAME });
    }

    const parsed = GastronomyBrochureSourceSchema.safeParse(entity);
    if (!parsed.success) {
        // Unreachable for a row that passed its own write validation: every
        // field below the three identity ones is optional here. Loud rather
        // than silent, because a listing that cannot be projected is a schema
        // drift worth seeing in the logs.
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'gastronomy listing could not be projected for printing'
        );
    }

    const content = buildGastronomyBrochureContent({
        listing: parsed.data,
        locale: resolveReturnUrlLocale(ctx),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    // The sheet's QR encodes the platform's own redirect, never `content.url`
    // (HOS-1129). The code is minted on the first download and reused for every
    // later one, so a reprint matches the sheet already on the wall.
    const qrUrl = await resolveEntityQrScanUrl({
        actor,
        entityType: EntityTypeEnum.GASTRONOMY,
        entityId: entity.id,
        purpose: QrCodePurposeEnum.BROCHURE,
        targetUrl: content.url,
        label: buildEntityQrLabel({
            description: 'Gastronomy brochure QR',
            name: entity.name,
            slug: parsed.data.slug
        }),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    return buildBrochureResponse({ content, slug: parsed.data.slug, qrUrl });
}

/**
 * GET /api/v1/protected/gastronomies/:id/brochure
 *
 * Premium, in both verticals (owner decision, 2026-09-01). The grant lives on
 * each vertical's premium plan row rather than in
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`, because that map is the floor EVERY
 * tier of the vertical gets.
 */
export const protectedGetGastronomyBrochureRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/brochure',
    summary: 'Download the printable PDF sheet of a gastronomy listing',
    description:
        'Returns a print-ready A4 PDF of the listing’s PUBLIC page — cover photo, opening hours, contact, services and a QR back to the online sheet. Owner-only, and only for a listing that is publicly visible. Requires the download_listing_pdf entitlement, granted by the premium gastronomy plan.',
    tags: ['Gastronomy'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    // Never used: the handler always returns a raw `Response`. Declared because
    // the factory requires a concrete schema, and `z.null()` is the honest
    // description of "this route answers with a file, not with JSON".
    responseSchema: z.null(),
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetGastronomyBrochure(ctx, params),
    options: {
        middlewares: [
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.DOWNLOAD_LISTING_PDF)
        ],
        // Generating a PDF fetches and embeds a photo. Cheaper than a page
        // render, dearer than a JSON read — and nobody legitimately needs a
        // printable sheet twice a second.
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
