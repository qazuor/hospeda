/**
 * Deleting one of the caller's own commerce DRAFT listings (HOS-1156 T-015).
 *
 * A three-line dispatcher, kept out of the route for the same reason
 * `publish-listing-reads` is: the route layer decides HTTP, and which of two
 * services owns a vertical is not an HTTP fact. The rules themselves — ownership,
 * DRAFT-only, and the 404-not-403 posture — live one layer further down, in
 * `BaseCommerceListingService.softDeleteOwnDraft`.
 *
 * Accommodation is deliberately not reachable here: it keeps
 * `DELETE /protected/accommodations/{id}`, which already accepts its owner. See
 * the route's module doc.
 *
 * @module services/publish-draft-delete
 */

import type { CommerceVertical } from '@repo/billing';
import type { Actor, ServiceOutput } from '@repo/service-core';
import { ExperienceService, GastronomyService } from '@repo/service-core';
import { apiLogger } from '../utils/logger';

const gastronomyService = new GastronomyService({ logger: apiLogger });
const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Soft-deletes one DRAFT listing the actor owns, in one commerce vertical.
 *
 * @param input.actor - The authenticated actor, who must own the listing.
 * @param input.vertical - Which vertical the listing belongs to.
 * @param input.id - The listing to delete.
 * @returns The service's own output — `{ deleted: true }`, or the error it
 *   raised, unmodified, so the route maps one contract rather than inventing a
 *   second one.
 */
export async function deleteOwnCommerceDraft(input: {
    actor: Actor;
    vertical: CommerceVertical;
    id: string;
}): Promise<ServiceOutput<{ deleted: true }>> {
    const { actor, vertical, id } = input;

    // An exhaustive switch, not a ternary: `vertical !== 'gastronomy'` meaning
    // experience is the exact shape HOS-1079 removed from five call sites, and
    // widening CommerceVertical must be a compile error here rather than a
    // silently mis-routed delete.
    switch (vertical) {
        case 'gastronomy':
            return gastronomyService.softDeleteOwnDraft(actor, id);
        case 'experience':
            return experienceService.softDeleteOwnDraft(actor, id);
    }
}
