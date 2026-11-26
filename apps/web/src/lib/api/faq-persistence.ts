/** Typed persistence ports for the shared, immediately saved FAQ controller. */
import type { buildFaqBody, FaqEnvelope } from '@/components/account/editor/faq-model';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { apiClient } from './client';
import { accommodationFaqApi } from './endpoints-protected';
import type { ApiResult } from './types';

/** Payload built by the controller after validation. */
export type FaqBody = ReturnType<typeof buildFaqBody>;

/** Immediate CRUD port; each result keeps the standard API result envelope. */
export interface FaqPersistence {
    readonly add: (body: FaqBody) => Promise<ApiResult<FaqEnvelope>>;
    readonly update: (input: {
        readonly faqId: string;
        readonly body: FaqBody;
    }) => Promise<ApiResult<FaqEnvelope>>;
    readonly remove: (input: {
        readonly faqId: string;
    }) => Promise<ApiResult<{ readonly success: boolean }>>;
    readonly reorder: (input: {
        readonly order: readonly { readonly faqId: string; readonly displayOrder: number }[];
    }) => Promise<ApiResult<{ readonly success: boolean }>>;
}

/** Binds accommodation identity to the existing protected API wrappers. */
export function createAccommodationFaqAdapter({
    accommodationId
}: {
    readonly accommodationId: string;
}): FaqPersistence {
    return {
        add: (body) => accommodationFaqApi.add({ accommodationId, ...body }),
        update: ({ faqId, body }) =>
            accommodationFaqApi.update({ accommodationId, faqId, ...body }),
        remove: ({ faqId }) => accommodationFaqApi.remove({ accommodationId, faqId }),
        reorder: ({ order }) => accommodationFaqApi.reorder({ accommodationId, order })
    };
}

/** Binds venue/experience identity, preserving authenticated POST and PUT edits. */
export function createListingFaqAdapter({
    vertical,
    listingId
}: {
    readonly vertical: VenueOrExperience;
    readonly listingId: string;
}): FaqPersistence {
    const entity = vertical === 'venue' ? 'venues' : 'experiences';
    const basePath = `/api/v1/protected/${entity}/${listingId}/faqs`;
    return {
        // POST is the only client verb whose unprotected variant omits credentials.
        add: (body) => apiClient.postProtected<FaqEnvelope>({ path: basePath, body }),
        update: ({ faqId, body }) =>
            apiClient.put<FaqEnvelope>({ path: `${basePath}/${faqId}`, body }),
        remove: ({ faqId }) => apiClient.delete({ path: `${basePath}/${faqId}` }),
        reorder: ({ order }) => apiClient.put({ path: `${basePath}/reorder`, body: { order } })
    };
}
