/**
 * experience.faq-public.ts
 *
 * Public FAQ read for experience listings (HOS-2670).
 *
 * `listExperienceFaqs` is shared with the admin read, where staff must see the FAQs
 * of any listing. The public route must not: once the FAQs relation loaded
 * (HOS-2670), it served the FAQs of soft-deleted and unpublished listings,
 * because nothing checked the parent. This wrapper gates the parent with
 * `checkExperienceCanViewEntity`, the same predicate the public detail read uses
 * (`ExperienceService._canView`), before reading any FAQ.
 */

import type { ExperienceModel } from '@repo/db';
import {
    type ExperienceFaqListInput,
    ExperienceFaqListInputSchema,
    type ExperienceFaqListOutput,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { listExperienceFaqs } from './experience.faq';
import { checkExperienceCanViewEntity } from './experience.permissions';

/**
 * Lists the FAQs of a experience listing on the PUBLIC path.
 *
 * Answers like the public detail read for the parent listing: NOT_FOUND when it
 * does not exist or is not viewable (draft, unpublished, soft-deleted and never
 * published), GONE when it was published and then soft-deleted. Otherwise
 * delegates to `listExperienceFaqs`. Per-FAQ visibility (`isVisibleOnListing`) is
 * still filtered by the route (HOS-400).
 *
 * @param model - ExperienceModel instance.
 * @param actor - The actor performing the action.
 * @param data - List-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<ExperienceFaqListOutput>` with the FAQ array.
 */
export async function listPublicExperienceFaqs(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceFaqListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<ExperienceFaqListOutput>> {
    const parsed = ExperienceFaqListInputSchema.safeParse(data);
    if (!parsed.success) {
        // Same VALIDATION_ERROR shape as the shared helper.
        return listExperienceFaqs(model, actor, data, ctx);
    }
    try {
        const listing = await model.findById(parsed.data.experienceId, ctx?.tx);
        if (!listing) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Experience listing not found' }
            };
        }
        checkExperienceCanViewEntity(actor, listing);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
    return listExperienceFaqs(model, actor, data, ctx);
}
