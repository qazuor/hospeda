/**
 * The owner's listing QR, as an image they can look at (HOS-982 PR 2).
 *
 * ```
 * GET /api/v1/protected/accommodations/{id}/qr
 * ```
 *
 * ## Why this exists next to `qr-sheet`
 *
 * `qr-sheet` returns `application/pdf`, and a dashboard cannot show a PDF: the
 * web app's CSP sends `object-src 'none'`, and no branch of its `frame-src`
 * carries `blob:` (`apps/web/src/lib/middleware-helpers.ts` — dev does add
 * `'self'`, which does not authorise a blob URL), so an embedded file renders
 * nothing and reports nothing. Drawing the symbol in the
 * browser instead would mean a second QR generator, which
 * `scripts/check-qrcode-engine-isolation.sh` exists to forbid. What the CSP DOES
 * allow is `img-src … data:`, which is how `ProviderQrPanel` and
 * `GastronomyMenuQrWidget` already put a code on screen. So the panel needs the
 * SVG, and this is the route that hands it over.
 *
 * A button that downloads a PDF blind tells the owner nothing about what they
 * got. Seeing the code first is the point of the endpoint.
 *
 * ## THE SAME code as the sheet, never a second one — row AND symbol
 *
 * `qr_codes` is keyed on `(entity_type, entity_id, purpose)` and
 * `getOrCreateForEntity` is idempotent on that triple, so this route passing the
 * SAME three values as `qrSheet.ts` is what guarantees both surfaces resolve one
 * ROW. A second row would put one QR on the door and a different one on the
 * counter and split the listing's scan counts between them — which is why
 * `test/routes/listing-qr-code.test.ts` executes both routes and compares the
 * two mint calls argument for argument, and why
 * `test/utils/entity-qr-purpose.guard.test.ts` accounts for this call site by
 * name.
 *
 * Same row is NOT same picture, and this route shipped a review believing it
 * was: `renderQrSvg`'s default error correction is M and the sheet prints at Q,
 * so one URL was drawn as two different symbols (29 modules against 33) under
 * three docblocks claiming one artifact. It matters because showing a code
 * invites photographing it, and a screenshot printed for the counter would carry
 * the damage tolerance the sheet deliberately refused. {@link renderListingQrSvg}
 * reads the sheet's own constant, so the two cannot drift again.
 *
 * The two creation-only fields the triple does NOT cover — `targetUrl` and
 * `label` — come from the same shared module. This route now mints FIRST in
 * practice (the panel renders before anyone downloads), so those are the values
 * that stick.
 *
 * ## Same authorisation as the sheet, and the same 404
 *
 * Session, then ownership, then BOTH clauses of "published"
 * (`lifecycleState === ACTIVE` **and** `visibility === PUBLIC`). The accommodation
 * sheet twin carries the full reasoning; the short version is that a PUBLIC row
 * that is not ACTIVE has no public page, so its code would 404 on every scan.
 * The 404 is deliberately identical for "does not exist", "is not yours" and "is
 * not published" — a distinguishable refusal confirms which ids are real
 * (HOS-600), and `test/routes/existence-disclosure.paired-probe.test.ts` compares
 * the two bodies byte for byte.
 *
 * ## No entitlement gate
 *
 * Owner decision, same as the sheet: a QR on a door brings people to the
 * platform, so restricting it costs US, not the subscriber. Do not "harmonise"
 * this with the brochure.
 *
 * @module routes/accommodation/protected/qrCode
 */

import {
    AccommodationIdSchema,
    EntityTypeEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    QrCodePurposeEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { AccommodationService, entityNotFoundError } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import type { z } from 'zod';
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

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Resolves (minting on the first call) and renders one accommodation's code.
 *
 * A named export rather than an inline lambda so the handler carries a name in a
 * stack trace. What EXERCISES it is `test/routes/listing-qr-code.test.ts`, which
 * mounts the route rather than calling this: the factory, its error formatter
 * and the `ServiceError` class identity are half of what those tests assert.
 */
export async function handleGetAccommodationQrCode(
    ctx: Context,
    params: Record<string, unknown>
): Promise<z.infer<typeof ListingQrCodeResponseSchema>> {
    const actor = getActorFromContext(ctx);
    const result = await accommodationService.getById(actor, params.id as string);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    const entity = result.data;

    const hasUpdateAny = actor.permissions?.includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY);
    if (!entity || (!hasUpdateAny && entity.ownerId !== actor.id)) {
        throw entityNotFoundError({ entityName: AccommodationService.ENTITY_NAME });
    }

    // BOTH clauses — see the docblock. Checked BEFORE anything is minted, so a
    // listing with no public page never leaves a live `qr_codes` row behind.
    if (
        entity.lifecycleState !== LifecycleStatusEnum.ACTIVE ||
        entity.visibility !== VisibilityEnum.PUBLIC
    ) {
        // Same canonical message as the branch above, deliberately (HOS-600).
        throw entityNotFoundError({ entityName: AccommodationService.ENTITY_NAME });
    }

    if (!entity.slug) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'accommodation has no slug to build a QR code for'
        );
    }

    const url = await resolveEntityQrScanUrl({
        actor,
        entityType: EntityTypeEnum.ACCOMMODATION,
        entityId: entity.id,
        purpose: QrCodePurposeEnum.LISTING,
        targetUrl: buildListingQrTargetUrl({
            vertical: 'accommodation',
            slug: entity.slug,
            siteUrl: env.HOSPEDA_SITE_URL
        }),
        label: buildListingQrCodeLabel({
            vertical: 'accommodation',
            name: entity.name,
            slug: entity.slug
        }),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    return { svg: await renderListingQrSvg({ url }), url, slug: entity.slug };
}

/**
 * GET /api/v1/protected/accommodations/:id/qr
 *
 * No entitlement gate — see the module docblock.
 */
export const protectedGetAccommodationQrCodeRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/qr',
    summary: 'Get the listing QR of an accommodation as an image',
    description:
        'Returns the SVG of the accommodation’s listing QR and the URL that symbol encodes (`{site}/qr/{qrSlug}/`). It is the SAME code the printable sheet carries — the same `qr_codes` row, created on the first call and reused afterwards, drawn at the same error-correction level the sheet prints at — so the image an owner sees in the dashboard is, module for module, the one that ends up on the door. Owner-only, and only for a listing that is publicly visible. No plan entitlement is required.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: ListingQrCodeResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetAccommodationQrCode(ctx, params),
    options: {
        customRateLimit: LISTING_QR_CODE_RATE_LIMIT
    }
});
