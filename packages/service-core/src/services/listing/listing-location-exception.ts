/**
 * listing-location-exception.ts
 *
 * Owner-requested exceptions to the one-address rule (HOS-2192), on top of the
 * admin grant of HOS-1810: request, approve, reject, direct grant and revoke.
 *
 * Every function runs in ONE transaction that locks the listing row (`FOR UPDATE`),
 * so the checks and the writes see the same state, and writes the audit event in
 * that same transaction: an audited action either happened and is on the record, or
 * did not happen. A failed check that must still leave a mark (a request found
 * stale becomes `SUPERSEDED`) returns an outcome instead of throwing, because a
 * thrown error would roll the mark back; the function throws after the commit.
 *
 * Notifications are NOT sent here: callers send them after the commit.
 */

import {
    type LocationKeyVertical,
    listingLocationExceptionModel,
    listingLocationModel,
    withTransaction
} from '@repo/db';
import {
    LOCATION_EXCEPTION_REASONS,
    type LocationExceptionOwnerView,
    type LocationExceptionState,
    PublicationStatusEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { type DrizzleClient, ServiceError } from '../../types';
import { extractPostgresErrorCause } from '../../utils/postgres-error-cause';

const PENDING_UNIQUE_INDEX = 'location_exception_request_one_pending_uidx';

function conflict(reason: string, message: string, details?: Record<string, unknown>) {
    return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, message, details, reason);
}

function notFound(vertical: LocationKeyVertical) {
    return new ServiceError(ServiceErrorCode.NOT_FOUND, `${vertical} not found`);
}

/** What a notification needs after a request was decided. */
export interface LocationExceptionDecision {
    readonly requestId: string;
    readonly status: 'APPROVED' | 'REJECTED';
    readonly vertical: LocationKeyVertical;
    readonly listingId: string;
    readonly listingName: string;
    readonly ownerId: string;
    /** The admin's reason (the grant reason on approve, the refusal on reject). */
    readonly decisionReason: string;
}

/**
 * The owner asks for an exception on one of their own listings.
 *
 * @param args.vertical - Accommodation or venue.
 * @param args.listingId - The listing.
 * @param args.actorId - The requester; must own the listing (anything else is 404).
 * @param args.reason - The owner's reason (already validated, 10 to 500 characters).
 * @param args.tx - Optional outer transaction.
 * @returns The created request.
 * @throws {ServiceError} 404 for a missing or foreign listing; 409 `ALREADY_EXISTS` with
 *   `LOCATION_EXCEPTION_NEEDS_KEY`, `_ALREADY_GRANTED`, `_REQUEST_PENDING` or `_NOT_NEEDED`.
 */
export async function requestLocationException(args: {
    readonly vertical: LocationKeyVertical;
    readonly listingId: string;
    readonly actorId: string;
    readonly reason: string;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly id: string; readonly status: 'PENDING'; readonly requestedAt: Date }> {
    const m = listingLocationExceptionModel;
    return withTransaction(async (tx) => {
        const listing = await m.lockListing({ vertical: args.vertical, id: args.listingId, tx });
        // A listing of somebody else answers exactly like a missing one.
        if (!listing || listing.ownerId !== args.actorId) throw notFound(args.vertical);
        const key = listing.locationKey;
        if (!key)
            throw conflict(
                LOCATION_EXCEPTION_REASONS.NEEDS_KEY,
                'The listing has no comparable address to ask an exception for'
            );
        if (listing.hasException)
            throw conflict(
                LOCATION_EXCEPTION_REASONS.ALREADY_GRANTED,
                'The listing already has an exception for this address'
            );
        const pending = await m.findPendingForListing({
            vertical: args.vertical,
            listingId: args.listingId,
            tx
        });
        if (pending) {
            if (pending.locationKey === key)
                throw conflict(
                    LOCATION_EXCEPTION_REASONS.REQUEST_PENDING,
                    'There is already a pending request for this listing'
                );
            // The address moved after that request: it is obsolete, not a blocker.
            await m.resolveRequest({
                requestId: pending.id,
                status: 'SUPERSEDED',
                decidedBy: null,
                decisionReason: null,
                at: new Date(),
                tx
            });
        }
        const occupant = await listingLocationModel.findOwnOccupant({
            vertical: args.vertical,
            locationKey: key,
            ownerId: listing.ownerId,
            excludeId: listing.id,
            tx
        });
        if (!occupant)
            throw conflict(
                LOCATION_EXCEPTION_REASONS.NOT_NEEDED,
                'No other published listing of yours shares this address'
            );
        let created: Awaited<ReturnType<typeof m.insertRequest>>;
        try {
            created = await m.insertRequest({
                vertical: args.vertical,
                listingId: args.listingId,
                requestedBy: args.actorId,
                locationKey: key,
                reason: args.reason,
                tx
            });
        } catch (error) {
            // Two concurrent requests: the partial unique index lets one through.
            if (extractPostgresErrorCause(error)?.constraint === PENDING_UNIQUE_INDEX)
                throw conflict(
                    LOCATION_EXCEPTION_REASONS.REQUEST_PENDING,
                    'There is already a pending request for this listing'
                );
            throw error;
        }
        await m.insertEvent({
            vertical: args.vertical,
            listingId: args.listingId,
            action: 'REQUESTED',
            actorId: args.actorId,
            reason: args.reason,
            locationKey: key,
            requestId: created.id,
            tx
        });
        return { id: created.id, status: 'PENDING' as const, requestedAt: created.requestedAt };
    }, args.tx);
}

type DecideOutcome =
    | { readonly kind: 'ok'; readonly decision: LocationExceptionDecision }
    | { readonly kind: 'not_pending' }
    | { readonly kind: 'stale' };

async function decide(args: {
    readonly vertical: LocationKeyVertical;
    readonly requestId: string;
    readonly adminId: string;
    readonly approve: boolean;
    readonly reason?: string;
    readonly tx?: DrizzleClient;
}): Promise<LocationExceptionDecision> {
    const m = listingLocationExceptionModel;
    const at = new Date();
    const outcome = await withTransaction<DecideOutcome>(async (tx) => {
        const request = await m.findRequestForUpdate({
            vertical: args.vertical,
            requestId: args.requestId,
            tx
        });
        if (!request) throw notFound(args.vertical);
        if (request.status !== 'PENDING') return { kind: 'not_pending' };
        const listing = await m.lockListing({
            vertical: args.vertical,
            id: request.entityId,
            tx
        });
        if (!listing || listing.locationKey !== request.locationKey) {
            await m.resolveRequest({
                requestId: request.id,
                status: 'SUPERSEDED',
                decidedBy: null,
                decisionReason: null,
                at,
                tx
            });
            return { kind: 'stale' };
        }
        const decisionReason = args.reason ?? request.reason;
        if (args.approve) {
            await listingLocationModel.setException({
                vertical: args.vertical,
                id: listing.id,
                adminId: args.adminId,
                reason: decisionReason,
                at,
                tx
            });
        }
        await m.resolveRequest({
            requestId: request.id,
            status: args.approve ? 'APPROVED' : 'REJECTED',
            decidedBy: args.adminId,
            decisionReason,
            at,
            tx
        });
        await m.insertEvent({
            vertical: args.vertical,
            listingId: listing.id,
            action: args.approve ? 'APPROVED' : 'REJECTED',
            actorId: args.adminId,
            reason: decisionReason,
            locationKey: listing.locationKey,
            requestId: request.id,
            tx
        });
        return {
            kind: 'ok',
            decision: {
                requestId: request.id,
                status: args.approve ? 'APPROVED' : 'REJECTED',
                vertical: args.vertical,
                listingId: listing.id,
                listingName: listing.name,
                ownerId: listing.ownerId,
                decisionReason
            }
        };
    }, args.tx);
    if (outcome.kind === 'not_pending')
        throw conflict(
            LOCATION_EXCEPTION_REASONS.REQUEST_NOT_PENDING,
            'The request has already been resolved'
        );
    if (outcome.kind === 'stale')
        throw conflict(
            LOCATION_EXCEPTION_REASONS.REQUEST_STALE,
            'The listing changed address after the request was made'
        );
    return outcome.decision;
}

/**
 * Approves a pending request: grants the exception exactly like the direct grant
 * (bound to the listing's current key, recording admin, reason and date).
 *
 * @param args.reason - Grant reason; defaults to the owner's own reason.
 * @throws {ServiceError} 404; 409 `LOCATION_EXCEPTION_REQUEST_NOT_PENDING` or `_REQUEST_STALE`.
 */
export function approveLocationExceptionRequest(args: {
    readonly vertical: LocationKeyVertical;
    readonly requestId: string;
    readonly adminId: string;
    readonly reason?: string;
    readonly tx?: DrizzleClient;
}): Promise<LocationExceptionDecision> {
    return decide({ ...args, approve: true });
}

/**
 * Rejects a pending request. The listing does not change.
 *
 * @param args.reason - The admin's reason, which reaches the owner.
 * @throws {ServiceError} 404; 409 `LOCATION_EXCEPTION_REQUEST_NOT_PENDING` or `_REQUEST_STALE`.
 */
export function rejectLocationExceptionRequest(args: {
    readonly vertical: LocationKeyVertical;
    readonly requestId: string;
    readonly adminId: string;
    readonly reason: string;
    readonly tx?: DrizzleClient;
}): Promise<LocationExceptionDecision> {
    return decide({ ...args, approve: false });
}

/**
 * The admin grants an exception directly (the HOS-1810 route), now audited. A
 * pending request of the same listing and key is resolved as approved by this
 * grant so no zombie request is left in the queue.
 *
 * @returns The owner's decision to notify when a pending request was resolved, else `null`.
 * @throws {ServiceError} 404; 409 `LOCATION_EXCEPTION_NEEDS_KEY`.
 */
export async function grantLocationException(args: {
    readonly vertical: LocationKeyVertical;
    readonly listingId: string;
    readonly adminId: string;
    readonly reason: string;
    readonly tx?: DrizzleClient;
}): Promise<LocationExceptionDecision | null> {
    const m = listingLocationExceptionModel;
    const at = new Date();
    return withTransaction(async (tx) => {
        const listing = await m.lockListing({ vertical: args.vertical, id: args.listingId, tx });
        if (!listing) throw notFound(args.vertical);
        const done = await listingLocationModel.setException({
            vertical: args.vertical,
            id: args.listingId,
            adminId: args.adminId,
            reason: args.reason,
            at,
            tx
        });
        if (done !== 'granted')
            throw conflict(
                LOCATION_EXCEPTION_REASONS.NEEDS_KEY,
                'The listing has no comparable address to grant an exception for'
            );
        const pending = await m.findPendingForListing({
            vertical: args.vertical,
            listingId: args.listingId,
            tx
        });
        const resolves = pending !== null && pending.locationKey === listing.locationKey;
        if (pending) {
            await m.resolveRequest({
                requestId: pending.id,
                status: resolves ? 'APPROVED' : 'SUPERSEDED',
                decidedBy: resolves ? args.adminId : null,
                decisionReason: resolves ? args.reason : null,
                at,
                tx
            });
        }
        await m.insertEvent({
            vertical: args.vertical,
            listingId: args.listingId,
            action: resolves ? 'APPROVED' : 'GRANTED',
            actorId: args.adminId,
            reason: args.reason,
            locationKey: listing.locationKey,
            requestId: resolves ? pending.id : null,
            tx
        });
        return resolves
            ? {
                  requestId: pending.id,
                  status: 'APPROVED' as const,
                  vertical: args.vertical,
                  listingId: listing.id,
                  listingName: listing.name,
                  ownerId: listing.ownerId,
                  decisionReason: args.reason
              }
            : null;
    }, args.tx);
}

/**
 * The admin removes the exception and the removal is recorded (`REVOKED`, with
 * actor, date, reason and the key). Refused when the listing is `PUBLISHED` and
 * another published listing of the same owner holds the same key: it would leave
 * two on one address. Removing an exception that is not in force is a no-op.
 *
 * @returns `true` when an exception was removed.
 * @throws {ServiceError} 404; 409 `LOCATION_EXCEPTION_REVOKE_CONFLICT` with the owner's own
 *   `existingListingId` in `details`.
 */
export async function revokeLocationException(args: {
    readonly vertical: LocationKeyVertical;
    readonly listingId: string;
    readonly adminId: string;
    readonly reason?: string;
    readonly tx?: DrizzleClient;
}): Promise<boolean> {
    const m = listingLocationExceptionModel;
    const outcome = await withTransaction<
        | { readonly kind: 'done'; readonly removed: boolean }
        | { readonly kind: 'conflict'; readonly id: string }
    >(async (tx) => {
        const listing = await m.lockListing({ vertical: args.vertical, id: args.listingId, tx });
        if (!listing) throw notFound(args.vertical);
        if (!listing.hasException || !listing.locationKey) return { kind: 'done', removed: false };
        if (listing.publicationStatus === PublicationStatusEnum.PUBLISHED) {
            const occupant = await listingLocationModel.findOwnOccupant({
                vertical: args.vertical,
                locationKey: listing.locationKey,
                ownerId: listing.ownerId,
                excludeId: listing.id,
                tx
            });
            if (occupant) return { kind: 'conflict', id: occupant };
        }
        await listingLocationModel.clearException({
            vertical: args.vertical,
            id: args.listingId,
            tx
        });
        await m.insertEvent({
            vertical: args.vertical,
            listingId: args.listingId,
            action: 'REVOKED',
            actorId: args.adminId,
            reason: args.reason ?? null,
            locationKey: listing.locationKey,
            tx
        });
        return { kind: 'done', removed: true };
    }, args.tx);
    if (outcome.kind === 'conflict')
        throw conflict(
            LOCATION_EXCEPTION_REASONS.REVOKE_CONFLICT,
            'Removing the exception would leave two published listings of the owner on one address',
            { reason: LOCATION_EXCEPTION_REASONS.REVOKE_CONFLICT, existingListingId: outcome.id }
        );
    return outcome.removed;
}

/**
 * What the owner sees of the exception on their own listing: whether one is in
 * force and the latest request for the address the listing has now.
 */
export async function getOwnerLocationExceptionView(args: {
    readonly vertical: LocationKeyVertical;
    readonly listingId: string;
    readonly tx?: DrizzleClient;
}): Promise<LocationExceptionOwnerView> {
    const state = await listingLocationModel.getState({
        vertical: args.vertical,
        id: args.listingId,
        tx: args.tx
    });
    const latest = await listingLocationExceptionModel.findLatestForListing({
        vertical: args.vertical,
        listingId: args.listingId,
        locationKey: state?.locationKey ?? null,
        tx: args.tx
    });
    return {
        hasException: state?.hasException ?? false,
        request: latest
            ? {
                  id: latest.id,
                  status: latest.status,
                  reason: latest.reason,
                  decisionReason: latest.decisionReason,
                  requestedAt: latest.requestedAt.toISOString(),
                  decidedAt: latest.decidedAt ? latest.decidedAt.toISOString() : null
              }
            : null
    };
}

/** Admin read of a listing's exception: the grant columns plus the audit history. */
export async function getLocationExceptionState(args: {
    readonly vertical: LocationKeyVertical;
    readonly listingId: string;
}): Promise<LocationExceptionState> {
    const grant = await listingLocationExceptionModel.getGrant({
        vertical: args.vertical,
        id: args.listingId
    });
    if (!grant) throw notFound(args.vertical);
    const events = await listingLocationExceptionModel.listEvents({
        vertical: args.vertical,
        listingId: args.listingId
    });
    return {
        id: args.listingId,
        hasException: grant.hasException,
        by: grant.hasException ? grant.by : null,
        reason: grant.hasException ? grant.reason : null,
        at: grant.hasException && grant.at ? grant.at.toISOString() : null,
        events: events.map((e) => ({
            id: e.id,
            action: e.action,
            actorId: e.actorId,
            actorName: e.actorName,
            reason: e.reason,
            requestId: e.requestId,
            createdAt: e.createdAt.toISOString()
        }))
    };
}
