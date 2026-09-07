/**
 * The owner's listing QR for a gastronomy listing, as an image (HOS-982 PR 2).
 *
 * ```
 * GET /api/v1/protected/gastronomies/{id}/qr
 * ```
 *
 * The accommodation twin (`routes/accommodation/protected/qrCode.ts`) carries
 * the full reasoning: why the dashboard needs the SVG rather than the PDF, why
 * this is the SAME code the printable sheet carries and not a second one, why
 * both clauses of "published" are checked before anything is minted, and why
 * there is no entitlement gate. One thing differs here: the staff bypass is
 * `COMMERCE_VIEW_ALL`, not `ACCOMMODATION_UPDATE_ANY`.
 *
 * ## Not to be confused with `menuQr.ts`
 *
 * A restaurant carries TWO live codes and they are not duplicates. `MENU` goes
 * on the TABLE and opens the carta; it is premium-gated and its route mints
 * through `QrCodeService` directly. `LISTING` — this one — goes on the DOOR and
 * opens the ficha, and it is free. `purpose` is the third part of the identity
 * that keeps the lookup from handing one surface the other's code, which is what
 * `test/utils/entity-qr-purpose.guard.test.ts` accounts for by name.
 *
 * @module routes/gastronomy/protected/qrCode
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
import {
    buildListingQrCodeLabel,
    buildListingQrTargetUrl,
    renderListingQrSvg
} from '../../../services/listing-qr-sheet/listing-qr-code';
import { getActorFromContext } from '../../../utils/actor';
import { resolveEntityQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import {
    LISTING_QR_CODE_RATE_LIMIT,
    ListingQrCodeResponseSchema
} from '../../../utils/listing-qr-code-route';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Resolves (minting on the first call) and renders one venue's listing code.
 *
 * A named export rather than an inline lambda so the handler carries a name in a
 * stack trace. What EXERCISES it is `test/routes/listing-qr-code.test.ts`, which
 * mounts the route rather than calling this.
 */
export async function handleGetGastronomyQrCode(
    ctx: Context,
    params: Record<string, unknown>
): Promise<z.infer<typeof ListingQrCodeResponseSchema>> {
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

    // BOTH clauses — see the accommodation twin. Checked BEFORE anything is
    // minted, so a listing with no public page leaves no live `qr_codes` row.
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
            'gastronomy listing has no slug to build a QR code for'
        );
    }

    const url = await resolveEntityQrScanUrl({
        actor,
        entityType: EntityTypeEnum.GASTRONOMY,
        entityId: entity.id,
        purpose: QrCodePurposeEnum.LISTING,
        targetUrl: buildListingQrTargetUrl({
            vertical: 'gastronomy',
            slug: entity.slug,
            siteUrl: env.HOSPEDA_SITE_URL
        }),
        label: buildListingQrCodeLabel({
            vertical: 'gastronomy',
            name: entity.name,
            slug: entity.slug
        }),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    return { svg: await renderListingQrSvg({ url }), url, slug: entity.slug };
}

/**
 * GET /api/v1/protected/gastronomies/:id/qr
 *
 * No entitlement gate — owner decision, see the accommodation twin.
 */
export const protectedGetGastronomyQrCodeRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/qr',
    summary: 'Get the listing QR of a gastronomy listing as an image',
    description:
        'Returns the SVG of the venue’s listing QR and the URL that symbol encodes (`{site}/qr/{qrSlug}/`). It is the SAME code the printable sheet carries — the same `qr_codes` row, created on the first call and reused afterwards, drawn at the same error-correction level the sheet prints at — so the image an owner sees in the dashboard is, module for module, the one that ends up on the door. Distinct from the menu QR, which opens the carta and is premium-gated. Owner-only, and only for a listing that is publicly visible. No plan entitlement is required.',
    tags: ['Gastronomy'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ListingQrCodeResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetGastronomyQrCode(ctx, params),
    options: {
        customRateLimit: LISTING_QR_CODE_RATE_LIMIT
    }
});
