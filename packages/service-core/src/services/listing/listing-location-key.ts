/**
 * listing-location-key.ts
 *
 * The one-address rule (HOS-1810) on the service side: keeps `location_key` in
 * step with `location` + `destinationId`, and answers the 409 when a listing
 * would occupy a place another listing of the SAME owner already occupies.
 *
 * The rule is per vertical: accommodation checks accommodations, venue checks
 * venues. A venue never collides with an accommodation.
 */

import { type LocationKeyVertical, listingLocationModel } from '@repo/db';
import {
    DUPLICATE_LOCATION_REASON,
    LOCATION_KEY_UNIQUE_INDEXES,
    PublicationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { buildLocationKey } from '@repo/utils';
import { type DrizzleClient, ServiceError } from '../../types';
import { extractPostgresErrorCause } from '../../utils/postgres-error-cause';

/** The slice of a stored listing the key depends on. */
export interface LocationKeySource {
    readonly destinationId?: string | null;
    readonly location?: {
        readonly street?: string | null;
        readonly number?: string | null;
        readonly floor?: string | null;
        readonly apartment?: string | null;
    } | null;
}

/**
 * Computes the `location_key` patch for a create or update.
 *
 * Returns `{}` when neither `location` nor `destinationId` is in the payload
 * (the key stays as stored). Otherwise the payload location is merged over the
 * stored one key by key (`''` clears a field, as the model does) and the key is
 * rebuilt; it is `null` when the address is not comparable (`s/n`, no number).
 *
 * @param args.payload - The validated create/update body.
 * @param args.current - The stored row, `null` on create.
 * @returns `{ locationKey }` or `{}`.
 */
export function resolveLocationKeyPatch(args: {
    readonly payload: Record<string, unknown>;
    readonly current: LocationKeySource | null;
}): { locationKey?: string | null } {
    const hasLocation = args.payload.location !== undefined;
    const hasDestination = args.payload.destinationId !== undefined;
    if (!hasLocation && !hasDestination) return {};

    const patchLocation = (args.payload.location ?? {}) as NonNullable<
        LocationKeySource['location']
    >;
    const merged = { ...(args.current?.location ?? {}), ...patchLocation };
    const destinationId =
        (args.payload.destinationId as string | undefined) ?? args.current?.destinationId;

    return {
        locationKey: buildLocationKey({
            street: merged.street,
            number: merged.number,
            floor: merged.floor,
            apartment: merged.apartment,
            destinationId
        })
    };
}

/**
 * Throws the 409 when another PUBLISHED, live listing of the same owner and the
 * same vertical, without an exception, holds the same key.
 *
 * Callers skip the call when the listing itself has an exception. A duplicate of
 * ANOTHER owner never reaches this function's query (it filters by owner), so
 * nothing about it can leak to the caller.
 *
 * @param args.vertical - Accommodation or venue.
 * @param args.listingId - The listing being published or edited.
 * @param args.ownerId - Its owner.
 * @param args.locationKey - The resulting key, `null` means nothing to check.
 * @param args.tx - Optional transaction.
 * @throws {ServiceError} `ALREADY_EXISTS` with reason `DUPLICATE_LOCATION`.
 */
export async function assertNoOwnLocationConflict(args: {
    readonly vertical: LocationKeyVertical;
    readonly listingId: string;
    readonly ownerId: string;
    readonly locationKey: string | null;
    readonly tx?: DrizzleClient;
}): Promise<void> {
    if (!args.locationKey) return;
    const existingListingId = await listingLocationModel.findOwnOccupant({
        vertical: args.vertical,
        locationKey: args.locationKey,
        ownerId: args.ownerId,
        excludeId: args.listingId,
        tx: args.tx
    });
    if (!existingListingId) return;
    throw new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'Another published listing of yours already occupies this address',
        { reason: DUPLICATE_LOCATION_REASON, existingListingId },
        DUPLICATE_LOCATION_REASON
    );
}

/** The slice of a stored row the update-time rule needs. */
export interface LocationRuleCurrent extends LocationKeySource {
    readonly id?: string;
    readonly ownerId?: string;
    readonly publicationStatus?: string | null;
    readonly locationKey?: string | null;
    readonly locationExceptionAt?: Date | string | null;
    /** The `location_key` the exception was granted for. */
    readonly locationExceptionKey?: string | null;
}

/**
 * Update-time half of the one-address rule: computes the key patch and, when the
 * edit MOVES a PUBLISHED listing (no exception) onto a place its owner already
 * occupies with another published listing, throws the 409 so the stored address
 * is not changed.
 *
 * Drafts are never blocked (they hold no quota slot); the block happens when
 * they publish.
 *
 * @param args.vertical - Accommodation or venue.
 * @param args.payload - The validated update body.
 * @param args.current - The stored row (`null` when it could not be read).
 * @param args.tx - The update transaction.
 * @returns The `{ locationKey }` patch, or `{}` when the address is untouched.
 * @throws {ServiceError} `ALREADY_EXISTS` with reason `DUPLICATE_LOCATION`.
 */
export async function applyLocationRuleOnUpdate(args: {
    readonly vertical: LocationKeyVertical;
    readonly payload: Record<string, unknown>;
    readonly current: LocationRuleCurrent | null;
    readonly tx?: DrizzleClient;
}): Promise<{ locationKey?: string | null }> {
    const patch = resolveLocationKeyPatch({ payload: args.payload, current: args.current });
    const { current } = args;
    if (
        patch.locationKey &&
        current?.id &&
        current.ownerId &&
        current.publicationStatus === PublicationStatusEnum.PUBLISHED &&
        // An exception exempts only the address it was granted for: moving to another
        // one is checked like any other listing.
        !(current.locationExceptionAt && current.locationExceptionKey === patch.locationKey) &&
        patch.locationKey !== current.locationKey
    ) {
        await assertNoOwnLocationConflict({
            vertical: args.vertical,
            listingId: current.id,
            ownerId: current.ownerId,
            locationKey: patch.locationKey,
            tx: args.tx
        });
    }
    return patch;
}

/**
 * Maps the unique violation of the one-address index to the 409.
 *
 * The service pre-check cannot see a concurrent publish: two requests can both
 * read "no occupant" and then both write `PUBLISHED`. The partial unique index
 * lets exactly one through and raises `23505` (possibly several `cause` levels
 * down) for the other; this turns that into the same error the pre-check throws.
 *
 * @param error - Whatever the write threw.
 * @param existingListingId - The occupant, when the caller could look it up.
 * @returns The `ServiceError`, or `null` when `error` is anything else.
 */
export function asDuplicateLocationError(
    error: unknown,
    existingListingId?: string | null
): ServiceError | null {
    const cause = extractPostgresErrorCause(error);
    if (cause?.code !== '23505' || !cause.constraint) return null;
    if (!LOCATION_KEY_UNIQUE_INDEXES.includes(cause.constraint)) return null;
    return new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'Another published listing of yours already occupies this address',
        existingListingId
            ? { reason: DUPLICATE_LOCATION_REASON, existingListingId }
            : { reason: DUPLICATE_LOCATION_REASON },
        DUPLICATE_LOCATION_REASON
    );
}
