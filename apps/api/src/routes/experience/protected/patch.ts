/**
 * Protected owner-operational PATCH endpoint for experience listings (T-020)
 * Applies a partial operational update (schedule, contact, media, etc.) to a listing.
 *
 * ## Enforcement contract
 *
 * - Validates the payload through ExperienceOwnerUpdateInputSchema. Since
 *   HOS-166 D-1, `name`, `description`, and `destinationId` are
 *   owner-editable identity fields (SPEC-239 decision #5 reversed — see the
 *   schema's docstring). Only `slug` (never owner-editable directly; it now
 *   auto-follows draft renames server-side, HOS-784 stage 1)
 *   plus the control fields (`lifecycleState`, `visibility`,
 *   `moderationState`, `isFeatured`, `ownerId`) are ABSENT from the schema,
 *   so any forged keys for those are silently stripped by Zod.
 * - ExperienceService.updateOwn() enforces ownership (non-owner → NOT_FOUND) and
 *   per-section GASTRONOMY_/EXPERIENCE_EDIT_OWN permission checks.
 * Owner updates run without the former route and directions-field plan entitlements during the billing transition.
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import {
    type ExperienceOwnerUpdateInput,
    ExperienceOwnerUpdateInputSchema,
    ExperienceProtectedSchema,
    VerticalEnum
} from '@repo/schemas';
import { ExperienceService } from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against. The root
// import resolves to a SECOND copy under this workspace's resolver and
// `instanceof` then fails, so every ServiceError thrown here would be answered
// as a 500 — see `brochure.ts`. HOS-1049 hit exactly that on the new field
// gate; the pre-existing NOT_FOUND re-throw below was silently affected too.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/** Former paid-field marker retained for compatibility with the existing route shape. */
const _GATED_FIELD = 'meetingPointDirections' as const;

/**
 * The field key remains available to the existing route shape; its plan gate is disabled during the billing transition.
 *
 * @param ctx - The request context.
 * @param body - The already-validated owner-update body.
 * @throws {ServiceError} Plan entitlement refusal is disabled during the billing transition.
 */
/** HOS-1352: transitional until V3 (HOS-1357), see PR — field-level directions gate is removed. */
/**
 * PATCH /api/v1/protected/experiences/:id
 * Owner operational update — Protected endpoint.
 *
 * Only operational sections are accepted (openingHours, contactInfo,
 * socialNetworks, media, isPriceOnRequest, richDescription,
 * amenityIds, featureIds, the meetingPoint trio, and the practical ficha
 * fields durationMinutes / whatToBring / requirements / cancellationPolicy /
 * acceptsPrivateGroups). The service enforces ownership and per-section
 * permission gates internally.
 *
 * The accepted set is `ExperienceOwnerUpdateInputSchema` itself, so a new
 * ficha field reaches this route with no edit here — and a field MISSING from
 * that schema is stripped in silence while the PATCH still answers 200. None
 * of the ficha fields is entitlement-gated (owner decision 2026-09-01) with
 * exactly ONE exception: `meetingPointDirections`, the how-to-get-there half
 * added by HOS-1049, which is refused by
 * {@link assertExperienceDirectionsEntitlement} when the caller's plan does not
 * carry `MANAGE_EXPERIENCE_DIRECTIONS`. Because that check is a FIELD gate, the
 * "reaches this route with no edit here" property still holds for every free
 * field — only the one paid key had to be named.
 */
export const protectedPatchExperienceRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'EDIT', idParam: 'id' },
    summary: 'Update experience listing (owner)',
    description:
        'Partially updates operational fields of an experience listing. Requires ownership.',
    tags: ['Experience'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ExperienceOwnerUpdateInputSchema,
    responseSchema: ExperienceProtectedSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed MANAGE_EXPERIENCE_DIRECTIONS entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        // HOS-1049. Before ownership resolves, and before the service is
        // touched: see the helper's doc for why the narrow gate lives here and
        // not in `options.middlewares` alongside the route-wide one.

        const actor = getActorFromContext(ctx);
        const result = await experienceService.updateOwn(
            params.id as string,
            body as ExperienceOwnerUpdateInput,
            actor
        );

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});
