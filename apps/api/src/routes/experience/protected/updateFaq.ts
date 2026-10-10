/**
 * PUT /api/v1/protected/experiences/:id/faqs/:faqId
 * Update an existing FAQ on an experience listing (T-020)
 *
 * Gated on EXPERIENCE_EDIT_OWN (listing owner) or EXPERIENCE_EDIT_ALL (staff).
 * The FAQ must belong to the specified experience (enforced inside updateExperienceFaq).
 */

import {
    ExperienceFaqSingleOutputSchema,
    type ExperienceFaqUpdateInput,
    FaqWithChannelVisibilityUpdatePayloadSchema,
    type FaqWithChannelVisibilityUpdatePayloadType,
    VerticalEnum
} from '@repo/schemas';
import { ExperienceService, ServiceError, updateExperienceFaq } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';

import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — updates a specific FAQ on an experience listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedUpdateExperienceFaqRoute = createProtectedRoute({
    method: 'put',
    path: '/{id}/faqs/{faqId}',
    summary: 'Update FAQ on experience listing',
    description: 'Updates an existing FAQ on an experience listing',
    listingAccess: { vertical: VerticalEnum.EXPERIENCE, operation: 'EDIT', idParam: 'id' },
    tags: ['Experience', 'Experience FAQs'],
    protectedTag: false,
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: FaqWithChannelVisibilityUpdatePayloadSchema,
    responseSchema: ExperienceFaqSingleOutputSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed EDIT_EXPERIENCE_INFO entitlement gate.
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: ExperienceFaqUpdateInput = {
            experienceId: params.id as string,
            faqId: params.faqId as string,
            faq: body as FaqWithChannelVisibilityUpdatePayloadType
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof updateExperienceFaq>[0] }
        ).model;
        const result = await updateExperienceFaq(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});
