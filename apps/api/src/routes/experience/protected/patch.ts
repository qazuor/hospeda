/**
 * Protected owner-operational PATCH endpoint for experience listings (T-020)
 * Applies a partial operational update (schedule, contact, media, etc.) to a listing.
 *
 * ## Enforcement contract
 *
 * - Validates the payload through ExperienceOwnerUpdateInputSchema (operational
 *   fields only). Identity fields (name, slug, type, destinationId, priceFrom,
 *   priceUnit) are ABSENT from the schema so any forged keys are silently stripped
 *   by Zod.
 * - ExperienceService.updateOwn() enforces ownership (non-owner → NOT_FOUND) and
 *   per-section COMMERCE_*_EDIT_OWN permission checks.
 */
import {
    type ExperienceOwnerUpdateInput,
    ExperienceOwnerUpdateInputSchema,
    ExperienceProtectedSchema
} from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/experiences/:id
 * Owner operational update — Protected endpoint.
 *
 * Only operational sections are accepted (openingHours, contactInfo,
 * socialNetworks, media, isPriceOnRequest, richDescription,
 * amenityIds, featureIds). The service enforces ownership and per-section
 * permission gates internally.
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
    }
});
