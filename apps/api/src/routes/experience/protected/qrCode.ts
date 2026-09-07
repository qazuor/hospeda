/**
 * The owner's listing QR for an experience, as an image (HOS-982 PR 2).
 *
 * ```
 * GET /api/v1/protected/experiences/{id}/qr
 * ```
 *
 * The accommodation twin (`routes/accommodation/protected/qrCode.ts`) carries
 * the full reasoning: why the dashboard needs the SVG rather than the PDF, why
 * this is the SAME code the printable sheet carries and not a second one, why
 * both clauses of "published" are checked before anything is minted, and why
 * there is no entitlement gate. As in gastronomy, the staff bypass is
 * `COMMERCE_VIEW_ALL`.
 *
 * ## An experience holds three codes and this route touches exactly one
 *
 * `CERTIFICATE` is issued to a person, `BROCHURE` is handed to a person, and
 * `LISTING` — this one — is stuck to a door. They may resolve to the same page
 * today; what separates them is where they are printed, and knowing which one
 * brings people in is the product. Asking for the wrong `purpose` here would
 * return a perfectly good symbol belonging to another document and silently
 * merge two scan counts, which is why
 * `test/utils/entity-qr-purpose.guard.test.ts` accounts for this call site by
 * name.
 *
 * @module routes/experience/protected/qrCode
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
import {
    buildListingQrCodeLabel,
    buildListingQrTargetUrl
} from '../../../services/listing-qr-sheet/listing-qr-code';
import { getActorFromContext } from '../../../utils/actor';
import { resolveEntityQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import {
    LISTING_QR_CODE_RATE_LIMIT,
    ListingQrCodeResponseSchema
} from '../../../utils/listing-qr-code-route';
import { apiLogger } from '../../../utils/logger';
import { renderQrSvg } from '../../../utils/qr-render';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Resolves (minting on the first call) and renders one experience's listing code.
 *
 * A named export rather than an inline lambda so the handler carries a name in a
 * stack trace. What EXERCISES it is `test/routes/listing-qr-code.test.ts`, which
 * mounts the route rather than calling this.
 */
export async function handleGetExperienceQrCode(
    ctx: Context,
    params: Record<string, unknown>
): Promise<z.infer<typeof ListingQrCodeResponseSchema>> {
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

    // BOTH clauses — see the accommodation twin. Checked BEFORE anything is
    // minted, so a listing with no public page leaves no live `qr_codes` row.
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
            'experience listing has no slug to build a QR code for'
        );
    }

    const url = await resolveEntityQrScanUrl({
        actor,
        entityType: EntityTypeEnum.EXPERIENCE,
        entityId: entity.id,
        purpose: QrCodePurposeEnum.LISTING,
        targetUrl: buildListingQrTargetUrl({
            vertical: 'experience',
            slug: entity.slug,
            siteUrl: env.HOSPEDA_SITE_URL
        }),
        label: buildListingQrCodeLabel({
            vertical: 'experience',
            name: entity.name,
            slug: entity.slug
        }),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    return { svg: await renderQrSvg({ data: url }), url, slug: entity.slug };
}

/**
 * GET /api/v1/protected/experiences/:id/qr
 *
 * No entitlement gate — owner decision, see the accommodation twin.
 */
export const protectedGetExperienceQrCodeRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/qr',
    summary: 'Get the listing QR of an experience as an image',
    description:
        'Returns the SVG of the experience’s listing QR and the URL that symbol encodes (`{site}/qr/{qrSlug}/`). It is the SAME code the printable sheet carries — created on the first call and reused afterwards — so the image an owner sees in the dashboard is the one that ends up on the door. Distinct from the experience’s brochure and certificate codes. Owner-only, and only for a listing that is publicly visible. No plan entitlement is required.',
    tags: ['Experience'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ListingQrCodeResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetExperienceQrCode(ctx, params),
    options: {
        customRateLimit: LISTING_QR_CODE_RATE_LIMIT
    }
});
