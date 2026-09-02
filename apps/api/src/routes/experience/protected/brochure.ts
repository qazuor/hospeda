/**
 * The owner's printable PDF ficha of an experience listing (HOS-1058).
 *
 * ```
 * GET /api/v1/protected/experiences/{id}/brochure
 * ```
 *
 * The gastronomy twin (`routes/gastronomy/protected/brochure.ts`) carries the
 * full reasoning for the order of the checks, for why the response is a raw
 * `Response`, and for why the projection is explicit. Two things differ here,
 * both because the two verticals publish different things:
 *
 * - The experience ficha DOES publish a narrow `contactInfo` (work e-mail, work
 *   phone, mobile, website), so the printed sheet carries it. It never carries
 *   `whatsapp`, which HOS-19 keeps behind a separate authenticated endpoint.
 * - It also publishes `meetingPoint` — public by explicit owner decision
 *   (HOS-1048), which is what makes it printable at all.
 *
 * R-1: the grant is on the experience premium plan, separately from
 * gastronomy's. There is no shared "commerce" plan to grant it once.
 *
 * @module routes/experience/protected/brochure
 */

import { EntitlementKey } from '@repo/billing';
import { PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import { ExperienceService, entityNotFoundError, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { buildExperienceBrochureContent } from '../../../services/commerce-brochure/brochure-content';
import { buildBrochureResponse } from '../../../services/commerce-brochure/brochure-response';
import { ExperienceBrochureSourceSchema } from '../../../services/commerce-brochure/brochure-source';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { resolveReturnUrlLocale } from '../../billing/checkout-return-urls';

const experienceService = new ExperienceService({ logger: apiLogger });

/** Builds the PDF. Exported standalone so the route test can call it directly. */
export async function handleGetExperienceBrochure(
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

    if (entity.visibility !== VisibilityEnum.PUBLIC) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'experience listing has no public page to print'
        );
    }

    const parsed = ExperienceBrochureSourceSchema.safeParse(entity);
    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'experience listing could not be projected for printing'
        );
    }

    const content = buildExperienceBrochureContent({
        listing: parsed.data,
        locale: resolveReturnUrlLocale(ctx),
        siteUrl: env.HOSPEDA_SITE_URL
    });

    return buildBrochureResponse({ content, slug: parsed.data.slug });
}

/**
 * GET /api/v1/protected/experiences/:id/brochure
 *
 * Premium, in both verticals (owner decision, 2026-09-01).
 */
export const protectedGetExperienceBrochureRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/brochure',
    summary: 'Download the printable PDF sheet of an experience listing',
    description:
        'Returns a print-ready A4 PDF of the listing’s PUBLIC page — cover photo, meeting point, opening hours, contact, services and a QR back to the online sheet. Owner-only, and only for a listing that is publicly visible. Requires the download_listing_pdf entitlement, granted by the premium experience plan.',
    tags: ['Experience'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: z.null(),
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleGetExperienceBrochure(ctx, params),
    options: {
        middlewares: [
            commerceVerticalEntitlementMiddleware('experience'),
            requireEntitlement(EntitlementKey.DOWNLOAD_LISTING_PDF)
        ],
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
