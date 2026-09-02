/**
 * Protected owner-operational PATCH endpoint for gastronomy listings (T-043)
 * Applies a partial operational update (schedule, contact, media, etc.) to a listing.
 *
 * ## Enforcement contract
 *
 * - Validates the payload through GastronomyOwnerUpdateInputSchema. Since
 *   HOS-166 D-1, `name`, `description`, and `destinationId` are
 *   owner-editable identity fields (SPEC-239 decision #5 reversed — see the
 *   schema's docstring). Only `slug` (never owner-editable directly; it now
 *   auto-follows draft renames server-side, HOS-784 stage 1)
 *   plus the control fields (`lifecycleState`, `visibility`,
 *   `moderationState`, `isFeatured`, `ownerId`) are ABSENT from the schema,
 *   so any forged keys for those are silently stripped by Zod.
 * - GastronomyService.updateOwn() enforces ownership (non-owner → NOT_FOUND) and
 *   per-section COMMERCE_*_EDIT_OWN permission checks.
 * - HOS-1074: gated on `EDIT_GASTRONOMY_INFO`, the gastronomy mirror of the
 *   `requireEntitlement(EDIT_ACCOMMODATION_INFO)` gate on
 *   `accommodation/protected/patch.ts`. The permission check above and this
 *   entitlement gate answer different questions and both stay: the permission
 *   says WHO may touch this row, the entitlement says whether their PLAN
 *   includes editing at all.
 */
import { EntitlementKey } from '@repo/billing';
import {
    type GastronomyOwnerUpdateInput,
    GastronomyOwnerUpdateInputSchema,
    GastronomyProtectedSchema
} from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/gastronomies/:id
 * Owner operational update — Protected endpoint.
 *
 * Only operational sections are accepted (openingHours, contactInfo,
 * socialNetworks, media, menuUrl, priceRange, richDescription,
 * amenityIds, featureIds). The service enforces ownership and per-section
 * permission gates internally.
 */
export const protectedPatchGastronomyRoute = createProtectedRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Update gastronomy listing (owner)',
    description:
        'Partially updates operational fields of a gastronomy listing. Requires ownership.',
    tags: ['Gastronomy'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: GastronomyOwnerUpdateInputSchema,
    responseSchema: GastronomyProtectedSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.updateOwn(
            params.id as string,
            body as GastronomyOwnerUpdateInput,
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
        // context, and that set never carries a gastronomy key — so a gate
        // mounted without this ahead of it refuses every caller, including the
        // ones whose plan grants exactly this.
        middlewares: [
            commerceVerticalEntitlementMiddleware('gastronomy'),
            requireEntitlement(EntitlementKey.EDIT_GASTRONOMY_INFO)
        ]
    }
});
