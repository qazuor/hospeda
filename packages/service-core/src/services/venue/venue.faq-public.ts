/**
 * venue.faq-public.ts
 *
 * Public FAQ read for venue listings (HOS-2670).
 *
 * `listVenueFaqs` is shared with the admin read, where staff must see the FAQs
 * of any listing. The public route must not: once the FAQs relation loaded
 * (HOS-2670), it served the FAQs of soft-deleted and unpublished listings,
 * because nothing checked the parent. This wrapper gates the parent with
 * `checkVenueCanViewEntity`, the same predicate the public detail read uses
 * (`VenueService._canView`), before reading any FAQ.
 */

import type { VenueModel } from '@repo/db';
import {
    ServiceErrorCode,
    type VenueFaqListInput,
    VenueFaqListInputSchema,
    type VenueFaqListOutput
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { listVenueFaqs } from './venue.faq';
import { checkVenueCanViewEntity } from './venue.permissions';

/**
 * Lists the FAQs of a venue listing on the PUBLIC path.
 *
 * Answers like the public detail read for the parent listing: NOT_FOUND when it
 * does not exist or is not viewable (draft, unpublished, soft-deleted and never
 * published), GONE when it was published and then soft-deleted. Otherwise
 * delegates to `listVenueFaqs`. Per-FAQ visibility (`isVisibleOnListing`) is
 * still filtered by the route (HOS-400).
 *
 * @param model - VenueModel instance.
 * @param actor - The actor performing the action.
 * @param data - List-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<VenueFaqListOutput>` with the FAQ array.
 */
export async function listPublicVenueFaqs(
    model: VenueModel,
    actor: Actor,
    data: VenueFaqListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<VenueFaqListOutput>> {
    const parsed = VenueFaqListInputSchema.safeParse(data);
    if (!parsed.success) {
        // Same VALIDATION_ERROR shape as the shared helper.
        return listVenueFaqs(model, actor, data, ctx);
    }
    try {
        const listing = await model.findById(parsed.data.venueId, ctx?.tx);
        if (!listing) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Venue listing not found' }
            };
        }
        checkVenueCanViewEntity(actor, listing);
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
    return listVenueFaqs(model, actor, data, ctx);
}
