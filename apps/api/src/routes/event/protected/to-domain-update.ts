/**
 * Shared HTTP-to-domain conversion for the protected event write routes.
 *
 * ## Why this exists instead of two inline calls
 *
 * The protected event surface speaks HTTP names (`startDate`, `endDate`) and
 * `EventService` speaks domain names (`date.start`, `date.end`). Exactly one
 * thing knows the translation: `httpToDomainEventUpdate`. The PATCH route used
 * to forward the raw body instead, so date edits answered
 * `400 Unrecognized keys: "startDate","endDate"` against the strict domain
 * schema while the PUT on the same resource worked (H-30). Routing both writes
 * through one function makes that divergence impossible to reintroduce by
 * editing one file and not the other.
 *
 * @module routes/event/protected/to-domain-update
 */

import {
    type EventUpdateHttp,
    type EventUpdateInput,
    httpToDomainEventUpdate,
    ServiceErrorCode
} from '@repo/schemas';
// Imported from `@repo/service-core/types`, NOT the package barrel. The route
// factory's `handleRouteError` does `error instanceof ServiceError` against the
// class from this exact subpath (`apps/api/src/utils/response-helpers.ts`); a
// barrel-constructed instance can fail that check and collapse to a 500
// INTERNAL_ERROR, which is what this guard's own test caught before the import
// was corrected.
import { ServiceError } from '@repo/service-core/types';

/**
 * Converts a validated protected-event HTTP body into domain update input.
 *
 * Rejects an `endDate` sent without a `startDate`. The domain `date` object
 * requires `start`, so the mapper can only emit one when `startDate` is present
 * — meaning a lone `endDate` would map to nothing and be discarded behind a
 * `200`, which is the silent-discard failure H-134 is about. Merging a lone end
 * date into the stored start would need the current row, which neither the
 * mapper nor the service reads on this path, so the honest answer is to tell the
 * caller to send both bounds. The web editor already does: `buildEventPatchPayload`
 * sends `startDate` whenever either bound changed.
 *
 * @param params - The validated HTTP request body.
 * @returns Domain-shaped update input for `EventService.update`.
 * @throws ServiceError with `VALIDATION_ERROR` when `endDate` arrives alone.
 */
export const toEventDomainUpdate = ({
    body
}: {
    readonly body: Record<string, unknown>;
}): EventUpdateInput => {
    if (body.endDate !== undefined && body.startDate === undefined) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'endDate cannot be updated on its own: send startDate alongside it.'
        );
    }

    return httpToDomainEventUpdate(body as EventUpdateHttp);
};
