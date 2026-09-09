/**
 * DELETE /api/v1/protected/experiences/:id/faqs/:faqId
 * Remove (soft-delete) a FAQ from an experience listing (T-020)
 *
 * Gated on COMMERCE_EDIT_OWN (listing owner) or COMMERCE_EDIT_ALL (staff).
 * The FAQ must belong to the specified experience (enforced inside removeExperienceFaq).
 */
import { EntitlementKey } from '@repo/billing';
import { ExperienceFaqRemoveOutputSchema, ProductDomainEnum } from '@repo/schemas';
import { ExperienceService, removeExperienceFaq, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { requireLiveSubscription } from '../../../middlewares/require-live-subscription';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — soft-deletes a specific FAQ from an experience listing.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service instance
 * to pass to the standalone FAQ helper without requiring a public accessor.
 */
export const protectedRemoveExperienceFaqRoute = createCRUDRoute({
    method: 'delete',
    path: '/{id}/faqs/{faqId}',
    summary: 'Remove FAQ from experience listing',
    description: 'Soft-deletes a FAQ from an experience listing',
    tags: ['Experience', 'Experience FAQs'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        faqId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceFaqRemoveOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as { model: Parameters<typeof removeExperienceFaq>[0] }
        ).model;
        const result = await removeExperienceFaq(model, actor, {
            experienceId: params.id as string,
            faqId: params.faqId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data ?? { success: true };
    },
    options: {
        // HOS-1275: DELETING content is mutating it. These two routes carried no
        // entitlement gate at all — not in commerce, and not in accommodation
        // either, which PR #3299's own write-up missed because it only surveyed
        // commerce. Wired here with the same pair every sibling content route
        // carries, so the six of them stop being the exception that the next
        // change to the EDIT_* keys would silently leave behind.
        middlewares: [
            commerceVerticalEntitlementMiddleware('experience'),
            requireEntitlement(EntitlementKey.EDIT_EXPERIENCE_INFO),
            requireLiveSubscription(ProductDomainEnum.EXPERIENCE)
        ]
    }
});
