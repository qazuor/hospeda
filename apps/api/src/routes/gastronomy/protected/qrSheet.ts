/**
 * The owner's printable QR sheet for a gastronomy listing (HOS-982).
 *
 * ```
 * GET /api/v1/protected/gastronomies/{id}/qr-sheet
 * ```
 *
 * The accommodation twin (`routes/accommodation/protected/qrSheet.ts`) carries
 * the full reasoning for the order of the checks, for why there is NO
 * entitlement gate, and for why the code is minted once and reused. Two things
 * differ here, both inherited from how commerce listings publish:
 *
 * - The publicity check is `visibility === PUBLIC` alone, matching
 *   `protected/brochure.ts` and the rest of the vertical's protected routes.
 * - The staff bypass is `COMMERCE_VIEW_ALL`, not `ACCOMMODATION_UPDATE_ANY`.
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
import { buildListingQrSheetContent } from '../../../services/listing-qr-sheet/qr-sheet-content';
import { buildListingQrSheetResponse } from '../../../services/listing-qr-sheet/qr-sheet-response';
import { getActorFromContext } from '../../../utils/actor';
import { buildEntityQrLabel, resolveEntityQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { resolveReturnUrlLocale } from '../../billing/checkout-return-urls';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/** Builds the PDF. Exported standalone so the route test can call it directly. */
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

    if (entity.visibility !== VisibilityEnum.PUBLIC) {
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
        label: buildEntityQrLabel({
            description: 'Gastronomy listing QR',
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
