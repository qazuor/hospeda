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
 *   per-section COMMERCE_*_EDIT_OWN permission checks.
 * - HOS-1074: gated on `EDIT_EXPERIENCE_INFO`, the experience mirror of the
 *   `requireEntitlement(EDIT_ACCOMMODATION_INFO)` gate on
 *   `accommodation/protected/patch.ts`. The permission check above and this
 *   entitlement gate answer different questions and both stay: the permission
 *   says WHO may touch this row, the entitlement says whether their PLAN
 *   includes editing at all.
 * - HOS-1049: one FIELD gate on top of that route gate —
 *   `meetingPointDirections` additionally requires
 *   `MANAGE_EXPERIENCE_DIRECTIONS`, and only when the body actually names it.
 *   See {@link assertExperienceDirectionsEntitlement} for why it is not a
 *   second `requireEntitlement` in `options.middlewares`.
 */
import { EntitlementKey } from '@repo/billing';
import {
    type ExperienceOwnerUpdateInput,
    ExperienceOwnerUpdateInputSchema,
    ExperienceProtectedSchema,
    ServiceErrorCode
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
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { hasEntitlement, requireEntitlement } from '../../../middlewares/entitlement';
import type { AppBindings } from '../../../types';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * The one field on this body that is not free (HOS-1049).
 *
 * Named as a constant rather than inlined so the block below and its test refer
 * to the same string: a typo would make the gate silently unreachable, and the
 * failure mode of an unreachable entitlement gate is giving the product away.
 */
const GATED_FIELD = 'meetingPointDirections' as const;

/**
 * Refuses a body that touches `meetingPointDirections` without the plan for it
 * (HOS-1049).
 *
 * ## Why a FIELD gate and not another route-level `requireEntitlement`
 *
 * Everything else this PATCH carries — the meeting point itself, the price,
 * the checklists, the cancellation policy — is ficha data free on
 * `experience-basico`. Mounting `requireEntitlement(MANAGE_EXPERIENCE_DIRECTIONS)`
 * as middleware would lock a `-basico` provider out of editing their own
 * listing entirely. So the route keeps its `EDIT_EXPERIENCE_INFO` gate (may
 * this caller's plan edit AT ALL) and this adds a second, narrower question
 * asked only when the body actually names the paid field.
 *
 * ## Why it is checked before ownership resolves
 *
 * It reads nothing about the row, so it leaks no id: an unentitled caller gets
 * the same 403 whether or not the listing exists. That is also the ordering the
 * route's own `requireEntitlement` middleware already establishes, and the
 * error contract's auth → permission → shape → existence sequence puts an
 * entitlement refusal in the permission tier, ahead of the 404.
 *
 * A body that OMITS the key passes untouched — omission means "no change", and
 * a provider who lost the entitlement must still be able to edit their price.
 *
 * @param ctx - The request context, after `commerceVerticalEntitlementMiddleware`.
 * @param body - The already-validated owner-update body.
 * @throws {ServiceError} ENTITLEMENT_REQUIRED (403) when the field is present
 *   and the caller's experience plan does not grant it.
 */
export function assertExperienceDirectionsEntitlement(
    ctx: Context<AppBindings>,
    body: Record<string, unknown>
): void {
    if (!Object.hasOwn(body, GATED_FIELD)) {
        return;
    }

    if (hasEntitlement(ctx, EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS)) {
        return;
    }

    throw new ServiceError(
        ServiceErrorCode.ENTITLEMENT_REQUIRED,
        `Access denied. Publishing how to reach the meeting point requires the '${EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS}' entitlement.`,
        {
            requiredEntitlement: EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS,
            upgradeUrl: '/billing/plans'
        }
    );
}

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
    summary: 'Update experience listing (owner)',
    description:
        'Partially updates operational fields of an experience listing. Requires ownership.',
    tags: ['Experience'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ExperienceOwnerUpdateInputSchema,
    responseSchema: ExperienceProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        // HOS-1049. Before ownership resolves, and before the service is
        // touched: see the helper's doc for why the narrow gate lives here and
        // not in `options.middlewares` alongside the route-wide one.
        assertExperienceDirectionsEntitlement(ctx as Context<AppBindings>, body);

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
        // HOS-1074. The loader MUST come first: the global
        // `entitlementMiddleware` has already put the ACCOMMODATION set in the
        // context, and that set never carries an experience key — so a gate
        // mounted without this ahead of it refuses every caller, including the
        // ones whose plan grants exactly this.
        middlewares: [
            commerceVerticalEntitlementMiddleware('experience'),
            requireEntitlement(EntitlementKey.EDIT_EXPERIENCE_INFO)
        ]
    }
});
