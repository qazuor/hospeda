/**
 * POST /api/v1/protected/gastronomies/:id/faqs
 * Add a new FAQ to a gastronomy listing (T-044)
 *
 * Gated on GASTRONOMY_EDIT_OWN (listing owner) or GASTRONOMY_EDIT_ALL (staff).
 * displayOrder is auto-assigned by addGastronomyFaq() as max(existing)+1.
 */

import {
    FaqWithChannelVisibilityCreatePayloadSchema,
    type FaqWithChannelVisibilityCreatePayloadType,
    type GastronomyFaqAddInput,
    GastronomyFaqSingleOutputSchema,
    VerticalEnum
} from '@repo/schemas';
import { addGastronomyFaq, GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — adds a FAQ to the specified gastronomy listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedAddGastronomyFaqRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/faqs',
    summary: 'Add FAQ to gastronomy listing',
    description: 'Adds a new frequently asked question to a gastronomy listing',
    listingAccess: { vertical: VerticalEnum.GASTRONOMY, operation: 'EDIT', idParam: 'id' },
    tags: ['Gastronomy', 'Gastronomy FAQs'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqWithChannelVisibilityCreatePayloadSchema,
    responseSchema: GastronomyFaqSingleOutputSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_GASTRONOMY_INFO entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: GastronomyFaqAddInput = {
            gastronomyId: params.id as string,
            faq: body as FaqWithChannelVisibilityCreatePayloadType
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as { model: Parameters<typeof addGastronomyFaq>[0] }
        ).model;
        const result = await addGastronomyFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});
