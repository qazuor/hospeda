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

/**
 * Built on FIRST USE, never at module load — the same rule, and for the same
 * reason, as `services/publish-listing-reads`.
 *
 * A service constructor reads a model off `@repo/db`, and `test/setup.ts`
 * replaces that module wholesale with a `vi.mock` that declares only some of
 * its exports. Constructing at import time makes every test file that reaches
 * this module throw before its first assertion. Only one route imports this one
 * today, so it does not throw yet; its sibling was imported by a middleware and
 * did (CI shard 5/5). The difference is who imports it, which is not a property
 * this file controls, so it does not get to rely on it.
 */
let gastronomyService: GastronomyService | null = null;
let experienceService: ExperienceService | null = null;

const getGastronomyService = (): GastronomyService => {
    gastronomyService ??= new GastronomyService({ logger: apiLogger });
    return gastronomyService;
};

const getExperienceService = (): ExperienceService => {
    experienceService ??= new ExperienceService({ logger: apiLogger });
    return experienceService;
};

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
            return getGastronomyService().softDeleteOwnDraft(actor, id);
        case 'experience':
            return getExperienceService().softDeleteOwnDraft(actor, id);
    }
}
