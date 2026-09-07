/**
 * The owner's printable QR sheet for an accommodation (HOS-982).
 *
 * ```
 * GET /api/v1/protected/accommodations/{id}/qr-sheet
 * ```
 *
 * ## What it answers, and in what order
 *
 * 1. **Authentication** — `createProtectedRoute`, before anything else.
 * 2. **Ownership** — the service's owner-tier read, then the same explicit
 *    `ownerId === actor.id || ACCOMMODATION_UPDATE_ANY` check
 *    `protected/getById.ts` makes, answering NOT_FOUND for a listing that is not
 *    the caller's. A 403 would confirm the id exists (HOS-600).
 * 3. **Is there a public ficha at all** — a listing with no public page has
 *    nothing to point a code at, and the QR would send every scanner to a 404.
 *    NOT_FOUND, with the SAME message as the branch above, deliberately: the
 *    error contract's anti-enumeration rule wants one spelling of a 404, and two
 *    would let a caller tell "not yours" from "not published".
 *
 * ## There is NO entitlement gate here, and that is the decision
 *
 * The brochure requires `DOWNLOAD_LISTING_PDF`; this sheet requires nothing but
 * a published ficha (owner decision, 2026-09-07). A QR taped to a door brings
 * people to the platform, so restricting it costs US, not the subscriber. Do not
 * "harmonise" this with the brochure by adding `requireEntitlement` — the two
 * documents exist for opposite reasons, one is a premium marketing asset handed
 * to a customer and the other is an acquisition channel we WANT on every door.
 *
 * ## Why the accommodation check has two clauses where commerce has one
 *
 * `visibility === PUBLIC` alone is not "published" for an accommodation: a DRAFT
 * row can carry PUBLIC visibility and has no page. `AccommodationService`'s own
 * predicate is `lifecycleState === ACTIVE && visibility === PUBLIC`, and that is
 * what decides whether the public page exists, so it is what decides whether a
 * code may be printed for it.
 *
 * @module routes/accommodation/protected/qrSheet
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
import { z } from 'zod';
import { buildListingQrSheetContent } from '../../../services/listing-qr-sheet/qr-sheet-content';
import { buildListingQrSheetResponse } from '../../../services/listing-qr-sheet/qr-sheet-response';
import { getActorFromContext } from '../../../utils/actor';
import { buildEntityQrLabel, resolveEntityQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { resolveReturnUrlLocale } from '../../billing/checkout-return-urls';

const accommodationService = new AccommodationService({ logger: apiLogger });

/** Builds the PDF. Exported standalone so the route test can call it directly. */
export async function handleGetAccommodationQrSheet(
    ctx: Context,
    params: Record<string, unknown>
): Promise<Response> {
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

    if (
        entity.lifecycleState !== LifecycleStatusEnum.ACTIVE ||
        entity.visibility !== VisibilityEnum.PUBLIC
    ) {
        throw entityNotFoundError({ entityName: AccommodationService.ENTITY_NAME });
    }

    // A listing with no slug has no address to resolve to. Unreachable for a row
    // that passed its own write validation, and loud rather than silent because
    // it would otherwise mint a code pointing at a directory listing.
    if (!entity.slug) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'accommodation has no slug to print a QR sheet for'
        );
    }

    const content = buildListingQrSheetContent({
        listingName: entity.name,
        slug: entity.slug,
        vertical: 'accommodation',
        locale: resolveReturnUrlLocale(ctx),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    // The symbol encodes the platform's own redirect, never `content.url`
    // (HOS-981). The code is minted on the first download and REUSED for every
    // later one — the unique index on `(entity_type, entity_id, purpose)` is
    // what guarantees that. Minting per download would leave the same business
    // with one code on the door and a different one on the counter, and split
    // its scan counts between them.
    const qrUrl = await resolveEntityQrScanUrl({
        actor,
        entityType: EntityTypeEnum.ACCOMMODATION,
        entityId: entity.id,
        purpose: QrCodePurposeEnum.LISTING,
        targetUrl: content.url,
        label: buildEntityQrLabel({
            description: 'Accommodation listing QR',
            name: entity.name,
            slug: entity.slug
        }),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    return buildListingQrSheetResponse({ content, slug: entity.slug, qrUrl });
}

/**
 * GET /api/v1/protected/accommodations/:id/qr-sheet
 *
 * No entitlement gate — see the module docblock.
 */
export const protectedGetAccommodationQrSheetRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/qr-sheet',
    summary: 'Download the printable QR sheet of an accommodation',
    description:
        'Returns a print-ready A4 PDF carrying a large QR code that resolves to the listing’s public page, the listing name, an invitation to scan and the Hospeda brand. Designed to be taped to a door or left on a counter. Owner-only, and only for a listing that is publicly visible. No plan entitlement is required.',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    // Never used: the handler always returns a raw `Response`. Declared because
    // the factory requires a concrete schema, and `z.null()` is the honest
    // description of "this route answers with a file, not with JSON".
    responseSchema: z.null(),
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetAccommodationQrSheet(ctx, params),
    options: {
        // Rendering is cheap (no photo is fetched), but minting the code on the
        // first call writes a row, and nobody legitimately needs a printable
        // sheet twice a second.
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
