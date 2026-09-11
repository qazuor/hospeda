/**
 * The owner's printable QR sheet for a gastronomy listing (HOS-982).
 *
 * ```
 * GET /api/v1/protected/gastronomies/{id}/qr-sheet
 * ```
 *
 * The accommodation twin (`routes/accommodation/protected/qrSheet.ts`) carries
 * the full reasoning for the order of the checks, for why there is NO
 * entitlement gate, for why the code is minted once and reused, and for why the
 * minted destination ignores the downloader's language. One thing differs here:
 * the staff bypass is `COMMERCE_VIEW_ALL`, not `ACCOMMODATION_UPDATE_ANY`.
 *
 * ## The publicity check is BOTH clauses, as in accommodation
 *
 * `visibility === PUBLIC` alone is not "published". `GastronomyService._canView`
 * answers NOT_FOUND to every non-owner on a `lifecycleState !== ACTIVE` row, and
 * `public/list.ts` states the public contract as
 * `lifecycleState=ACTIVE AND visibility=PUBLIC`. The normal publish path writes
 * the two columns together (`reconcileCommerceListingVisibility`), but the admin
 * schemas accept `lifecycleState` on its own — so a listing PATCHed to INACTIVE
 * with its visibility untouched would otherwise pass this route, mint a code and
 * be printed, and every scan of that paper would 404 permanently. Paper is not
 * correctable; this check is cheap.
 *
 * Not to be confused with `menuQr.ts`, which is the code printed on a TABLE and
 * opens the menu (`purpose: MENU`). This one goes on the door and opens the
 * ficha (`purpose: LISTING`). Both are live rows for one restaurant, and
 * `purpose` is the third part of the identity that keeps the lookup from handing
 * one document the other's code.
 *
 * @module routes/gastronomy/protected/qrSheet
 */

import {
    EntityTypeEnum,
    LifecycleStatusEnum,
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
import { buildListingQrCodeLabel } from '../../../services/listing-qr-sheet/listing-qr-code';
import { buildListingQrSheetContent } from '../../../services/listing-qr-sheet/qr-sheet-content';
import { buildListingQrSheetResponse } from '../../../services/listing-qr-sheet/qr-sheet-response';
import { getActorFromContext } from '../../../utils/actor';
import { resolveEntityQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { resolveReturnUrlLocale } from '../../billing/checkout-return-urls';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Builds the PDF.
 *
 * A named export rather than an inline lambda, so the handler carries a name in
 * a stack trace. What EXERCISES it is `test/routes/listing-qr-sheet.test.ts`,
 * which mounts the route rather than calling this: the factory, its error
 * formatter and the `ServiceError` class identity are half of what those tests
 * assert, and calling the function directly would skip all three. The
 * anti-enumeration half lives in
 * `test/routes/existence-disclosure.paired-probe.test.ts`.
 */
export async function handleGetGastronomyQrSheet(
    ctx: Context,
    params: Record<string, unknown>
): Promise<Response> {
    const actor = getActorFromContext(ctx);
    const result = await gastronomyService.getById(actor, params.id as string);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    const entity = result.data;

    const hasViewAll = actor.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
    if (!entity || (!hasViewAll && entity.ownerId !== actor.id)) {
        throw entityNotFoundError({ entityName: GastronomyService.ENTITY_NAME });
    }

    // BOTH clauses — see the docblock. A row that is PUBLIC but not ACTIVE has
    // no public page, and a code printed for it 404s on every scan, forever.
    if (
        entity.lifecycleState !== LifecycleStatusEnum.ACTIVE ||
        entity.visibility !== VisibilityEnum.PUBLIC
    ) {
        // Same canonical message as the branch above, deliberately (HOS-600).
        throw entityNotFoundError({ entityName: GastronomyService.ENTITY_NAME });
    }

    if (!entity.slug) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'gastronomy listing has no slug to print a QR sheet for'
        );
    }

    const content = buildListingQrSheetContent({
        listingName: entity.name,
        slug: entity.slug,
        vertical: 'gastronomy',
        locale: resolveReturnUrlLocale(ctx),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    const qrUrl = await resolveEntityQrScanUrl({
        actor,
        entityType: EntityTypeEnum.GASTRONOMY,
        entityId: entity.id,
        purpose: QrCodePurposeEnum.LISTING,
        targetUrl: content.url,
        // Shared with `qrCode.ts`, which now mints FIRST in practice (the
        // dashboard panel renders before anybody downloads) — `label` is a
        // creation-only field, so two spellings would mean this one is never
        // the one written. See `services/listing-qr-sheet/listing-qr-code.ts`.
        label: buildListingQrCodeLabel({
            vertical: 'gastronomy',
            name: entity.name,
            slug: entity.slug
        }),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    return buildListingQrSheetResponse({ content, slug: entity.slug, qrUrl });
}

/**
 * GET /api/v1/protected/gastronomies/:id/qr-sheet
 *
 * No entitlement gate — owner decision, see the accommodation twin.
 */
export const protectedGetGastronomyQrSheetRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/qr-sheet',
    summary: 'Download the printable QR sheet of a gastronomy listing',
    description:
        'Returns a print-ready A4 PDF carrying a large QR code that resolves to the listing’s public page, the business name, an invitation to scan and the Hospeda brand. Designed to be taped to a door or left on a counter. Owner-only, and only for a listing that is publicly visible. No plan entitlement is required.',
    tags: ['Gastronomy'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: z.null(),
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetGastronomyQrSheet(ctx, params),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
