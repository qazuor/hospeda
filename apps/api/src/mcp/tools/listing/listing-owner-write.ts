/**
 * @file listing-owner-write.ts
 * @description The owner-write steps the listing edit tools share
 * (`update_listing_basic`, `update_listing_amenities`): what the owner PATCH
 * route of each vertical does around the service call, run once and identically
 * whichever tool writes (spec HOS-2335 C-1 and C-6).
 *
 * 1. {@link authorizeOwnerEdit}: the route's `listingAccess` step
 *    (`decideListingAccess`, operation `EDIT`; venue/experience also the sections
 *    the patch writes, shared through `utils/listing-access/owner-edit-listing-access.ts`),
 *    owner-only: a foreign or missing listing is not found, never a staff edit.
 * 2. {@link writeAccommodationPatch} / {@link writeScheduledPatch}: the service call
 *    the route makes. Accommodation: `httpToDomainAccommodationUpdate` then
 *    `AccommodationService.update`; venue/experience: `updateOwn`. Edge
 *    revalidation, junction sync of amenities/features and auto-translation live in
 *    the services' update hooks, so they run exactly as for the route.
 * 3. Public API cache eviction (accommodation, HOS-2323). The route gets it from
 *    `accommodationCacheInvalidationMiddleware`, which wraps the HTTP router and so
 *    never runs for a tool call. {@link writeAccommodationPatch} evicts the same
 *    path prefixes after a successful write; otherwise the public detail keeps
 *    serving the pre-edit body from this process's response cache. Venue and
 *    experience routes mount no such middleware, so their writes evict nothing.
 */

import {
    type AccommodationUpdateHttp,
    type ExperienceOwnerUpdateInput,
    httpToDomainAccommodationUpdate,
    type VenueOwnerUpdateInput,
    VerticalEnum
} from '@repo/schemas';
import { type Actor, entityNotFoundError } from '@repo/service-core';
import { ACCOMMODATION_CACHE_INVALIDATION_PREFIXES } from '../../../middlewares/accommodation-cache-invalidation';
import { invalidateCacheByPathPrefix } from '../../../middlewares/cache';
import {
    decideListingAccess,
    type ListingAccessWithSections,
    throwListingAccessRefusal
} from '../../../middlewares/listing-access';
import {
    experienceOwnerEditSections,
    experienceOwnerEditSectionTraits,
    venueOwnerEditSections,
    venueOwnerEditSectionTraits
} from '../../../utils/listing-access/owner-edit-listing-access';
import type { ToolHandlerResult } from '../tool-definition';
import {
    type ListingToolVertical,
    listingToolAccommodationService,
    listingToolExperienceService,
    listingToolVenueService
} from './listing-services';

/** A vertical whose listings have opening hours (venue, experience). */
export type ScheduledVertical = Exclude<ListingToolVertical, VerticalEnum.ACCOMMODATION>;

/** The uniform not-found error, whatever the vertical. */
export function notFound(): ToolHandlerResult<never> {
    const error = entityNotFoundError({ entityName: 'listing' });
    return { error: { code: error.code, message: error.message } };
}

/** The owner PATCH route's listing-access declaration for a vertical. */
function ownerEditDeclaration(vertical: ListingToolVertical): ListingAccessWithSections {
    if (vertical === VerticalEnum.ACCOMMODATION) {
        return { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT', idParam: 'id' };
    }
    if (vertical === VerticalEnum.VENUE) {
        return {
            vertical: VerticalEnum.VENUE,
            operation: 'EDIT',
            idParam: 'id',
            listingSection: venueOwnerEditSections,
            sectionTraits: venueOwnerEditSectionTraits
        };
    }
    return {
        vertical: VerticalEnum.EXPERIENCE,
        operation: 'EDIT',
        idParam: 'id',
        listingSection: experienceOwnerEditSections,
        sectionTraits: experienceOwnerEditSectionTraits
    };
}

/**
 * Runs the route's listing-access step, owner-only. Resolves to `undefined`
 * when allowed, to the not-found error for a foreign or missing listing;
 * every other refusal is thrown as the route throws it (a `ServiceError`,
 * mapped by the tool executor).
 *
 * @param input - Actor, vertical, listing id and the patch the call will write
 * @returns `undefined` when allowed, the error to answer with otherwise
 */
export async function authorizeOwnerEdit(input: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
    readonly id: string;
    readonly patch: Record<string, unknown>;
}): Promise<ToolHandlerResult<never> | undefined> {
    const config = ownerEditDeclaration(input.vertical);
    const decision = await decideListingAccess({
        actor: input.actor,
        listingId: input.id,
        config,
        tier: 'protected',
        body: input.patch,
        ownerOnly: true
    });
    if (decision === null) {
        return notFound(); // never for EDIT; fail closed
    }
    const { result, subjectId, ports } = decision;
    if (result.allowed) {
        return undefined;
    }
    if (result.reason === 'NOT_FOUND') {
        return notFound();
    }
    return throwListingAccessRefusal({ config, result, subjectId, ports });
}

/**
 * Converts the flat patch and calls `AccommodationService.update`, as the
 * accommodation owner PATCH route does, then evicts the public cache.
 *
 * @param input - Actor, listing id and the flat accommodation patch
 * @returns `undefined` on success, the service error otherwise
 */
export async function writeAccommodationPatch(input: {
    readonly actor: Actor;
    readonly id: string;
    readonly patch: AccommodationUpdateHttp;
}): Promise<ToolHandlerResult<never> | undefined> {
    const result = await listingToolAccommodationService.update(
        input.actor,
        input.id,
        httpToDomainAccommodationUpdate(input.patch)
    );
    if (result.error) {
        return { error: result.error };
    }
    // The route's HTTP-level eviction (HOS-2063) does not wrap a tool call.
    for (const pathPrefix of ACCOMMODATION_CACHE_INVALIDATION_PREFIXES) {
        invalidateCacheByPathPrefix({ pathPrefix });
    }
    return undefined;
}

/**
 * Calls the vertical's `updateOwn`, as the owner PATCH route does.
 *
 * @param input - Actor, vertical, listing id and the owner patch
 * @returns `undefined` on success, the service error otherwise
 */
export async function writeScheduledPatch(input: {
    readonly actor: Actor;
    readonly vertical: ScheduledVertical;
    readonly id: string;
    readonly patch: VenueOwnerUpdateInput & ExperienceOwnerUpdateInput;
}): Promise<ToolHandlerResult<never> | undefined> {
    const { actor, vertical, id, patch } = input;
    const result =
        vertical === VerticalEnum.VENUE
            ? await listingToolVenueService.updateOwn(id, patch, actor)
            : await listingToolExperienceService.updateOwn(id, patch, actor);
    if (result.error) {
        return { error: result.error };
    }
    return undefined;
}
