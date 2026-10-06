/**
 * Protected owner-operational PATCH endpoint for gastronomy listings (T-043)
 * HOS-1352: transitional until V3 (HOS-1357), see PR — the former plan gate or limit is removed.
 */

import {
    type GastronomyOwnerUpdateInput,
    GastronomyOwnerUpdateInputSchema,
    GastronomyProtectedSchema
} from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

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
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_GASTRONOMY_INFO entitlement gate.
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
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});
