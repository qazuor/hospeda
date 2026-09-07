/**
 * The owner's printable QR sheet for an experience listing (HOS-982).
 *
 * ```
 * GET /api/v1/protected/experiences/{id}/qr-sheet
 * ```
 *
 * The accommodation twin (`routes/accommodation/protected/qrSheet.ts`) carries
 * the full reasoning for the order of the checks, for why there is NO
 * entitlement gate, for why the code is minted once and reused, and for why the
 * minted destination ignores the downloader's language. As in gastronomy, the
 * staff bypass is `COMMERCE_VIEW_ALL`.
 *
 * ## The publicity check is BOTH clauses, as in accommodation
 *
 * `ExperienceService._canView` answers NOT_FOUND to every non-owner on a
 * `lifecycleState !== ACTIVE` row, so `visibility === PUBLIC` alone is not
 * "published". A listing PATCHed to INACTIVE with its visibility untouched would
 * otherwise mint a code and be printed, and every scan of that paper would 404
 * permanently. The gastronomy twin carries the same clause and the same reason.
 *
 * An experience now carries three codes at once, and none of them is a
 * duplicate: `CERTIFICATE` (printed on the certificate), `BROCHURE` (printed on
 * the handed-out ficha) and `LISTING` (this sheet, stuck to the door). They may
 * resolve to the same page today; what distinguishes them is where they are
 * printed, and knowing which one brings people in is the product.
 *
 * @module routes/experience/protected/qrSheet
 */

import {
    EntityTypeEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    QrCodePurposeEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { ExperienceService, entityNotFoundError } from '@repo/service-core';
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

const experienceService = new ExperienceService({ logger: apiLogger });

/** Builds the PDF. Exported standalone so the route test can call it directly. */
export async function handleGetExperienceQrSheet(
    ctx: Context,
    params: Record<string, unknown>
): Promise<Response> {
    const actor = getActorFromContext(ctx);
    const result = await experienceService.getById(actor, params.id as string);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    const entity = result.data;

    const hasViewAll = actor.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
    if (!entity || (!hasViewAll && entity.ownerId !== actor.id)) {
        throw entityNotFoundError({ entityName: ExperienceService.ENTITY_NAME });
    }

    // BOTH clauses — see the docblock. A row that is PUBLIC but not ACTIVE has
    // no public page, and a code printed for it 404s on every scan, forever.
    if (
        entity.lifecycleState !== LifecycleStatusEnum.ACTIVE ||
        entity.visibility !== VisibilityEnum.PUBLIC
    ) {
        // Same canonical message as the branch above, deliberately (HOS-600).
        throw entityNotFoundError({ entityName: ExperienceService.ENTITY_NAME });
    }

    if (!entity.slug) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'experience listing has no slug to print a QR sheet for'
        );
    }

    const content = buildListingQrSheetContent({
        listingName: entity.name,
        slug: entity.slug,
        vertical: 'experience',
        locale: resolveReturnUrlLocale(ctx),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    const qrUrl = await resolveEntityQrScanUrl({
        actor,
        entityType: EntityTypeEnum.EXPERIENCE,
        entityId: entity.id,
        purpose: QrCodePurposeEnum.LISTING,
        targetUrl: content.url,
        label: buildEntityQrLabel({
            description: 'Experience listing QR',
            name: entity.name,
            slug: entity.slug
        }),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    return buildListingQrSheetResponse({ content, slug: entity.slug, qrUrl });
}

/**
 * GET /api/v1/protected/experiences/:id/qr-sheet
 *
 * No entitlement gate — owner decision, see the accommodation twin.
 */
export const protectedGetExperienceQrSheetRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/qr-sheet',
    summary: 'Download the printable QR sheet of an experience listing',
    description:
        'Returns a print-ready A4 PDF carrying a large QR code that resolves to the listing’s public page, the business name, an invitation to scan and the Hospeda brand. Designed to be taped to a door or left on a counter. Owner-only, and only for a listing that is publicly visible. No plan entitlement is required.',
    tags: ['Experience'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: z.null(),
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetExperienceQrSheet(ctx, params),
    options: {
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
