import { randomUUID } from 'node:crypto';
import { getDb } from '@repo/db';
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { sql } from 'drizzle-orm';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import {
    type PurgeFailure,
    purgeListing
} from '../../../../../packages/verticals/src/publication/purge-listing';
import { getListingPublicationPorts } from '../../utils/listing-publication/ports';
import { getPurgeAfterCommit } from '../../utils/listing-publication/purge-ports';
import { apiLogger } from '../../utils/logger';

const LISTING_TABLES: Readonly<Record<PublicationVertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'venues',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};

/**
 * Maps a PB12 rejection of administrative action 23 to its HTTP error
 * (`apps/api/docs/error-contract.md`): a missing or already purged listing is
 * 404; a missing reason is 400; a concurrent state change is 409. `NOT_OWNER`
 * is also 409 here: the owner PB12 compares under its row lock is the subject
 * the route authorized, so a mismatch means the listing changed owner between
 * authorization and purge, and nothing is written.
 */
export function mapPurgeOnRequestFailure(reason: PurgeFailure): ServiceError {
    switch (reason) {
        case 'LISTING_NOT_FOUND':
        case 'INVALID_FROM':
            return new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        case 'REASON_REQUIRED':
            return new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason required');
        case 'NOT_OWNER':
            return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing owner changed');
        case 'STATE_CHANGED':
            return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed');
        default: {
            const exhaustive: never = reason;
            throw new Error(`Unhandled purge failure: ${String(exhaustive)}`);
        }
    }
}

/** Coordinates the authenticated owner's PB12 request with its production adapters. */
export class ListingPurgeService {
    /** Hides missing and foreign listings behind the same not-found response. */
    async assertOwnerAccess(args: {
        readonly actor: Actor;
        readonly vertical: PublicationVertical;
        readonly id: string;
    }): Promise<void> {
        const facts = await this.readOwnerFacts(args.vertical, args.id);
        if (!facts || (facts.ownerId !== args.actor.id && facts.createdById !== args.actor.id))
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
    }

    /** Purges a listing owned by the actor. */
    async purge(args: {
        readonly actor: Actor;
        readonly vertical: PublicationVertical;
        readonly id: string;
    }): Promise<{ purged: true }> {
        const facts = await this.readOwnerFacts(args.vertical, args.id);
        if (!facts || (facts.ownerId !== args.actor.id && facts.createdById !== args.actor.id))
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        const ownerId = facts.ownerId;
        const result = await purgeListing({
            ...getListingPublicationPorts(),
            afterCommit: getPurgeAfterCommit(),
            actor: { kind: 'owner', userId: ownerId },
            vertical: args.vertical,
            listingId: args.id,
            correlationId: randomUUID()
        });
        if (!result.purged) {
            if (result.reason === 'LISTING_NOT_FOUND' || result.reason === 'NOT_OWNER')
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
            throw new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed');
        }
        if (result.warnings.length > 0)
            apiLogger.warn(
                { listingId: args.id, vertical: args.vertical, warnings: result.warnings },
                'Listing purge post-commit effects incomplete'
            );
        return { purged: true };
    }

    /**
     * Administrative action 23 (ACC:23): support runs PB12 on another owner's
     * listing at that owner's request, with a mandatory reason. The owner is the
     * subject the route's listing access authorized (steps 3 to 7 on that owner),
     * never the request: PB12 re-reads the row under its lock (`FOR UPDATE`) and
     * refuses with `NOT_OWNER` (409) if the owner changed in between, so support
     * can never purge a listing for an owner who did not ask.
     */
    async purgeOnRequest(args: {
        readonly actor: Actor;
        readonly vertical: PublicationVertical;
        readonly id: string;
        readonly reason: string;
        readonly expectedOwnerId: string | null;
    }): Promise<{ purged: true }> {
        if (!args.expectedOwnerId)
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        const result = await purgeListing({
            ...getListingPublicationPorts(),
            afterCommit: getPurgeAfterCommit(),
            actor: {
                kind: 'support',
                adminId: args.actor.id,
                ownerId: args.expectedOwnerId,
                reason: args.reason
            },
            vertical: args.vertical,
            listingId: args.id,
            correlationId: randomUUID()
        });
        if (!result.purged) throw mapPurgeOnRequestFailure(result.reason);
        if (result.warnings.length > 0)
            apiLogger.warn(
                { listingId: args.id, vertical: args.vertical, warnings: result.warnings },
                'Listing purge-on-request post-commit effects incomplete'
            );
        return { purged: true };
    }

    private async readOwnerFacts(
        vertical: PublicationVertical,
        id: string
    ): Promise<{ ownerId: string; createdById: string | null } | null> {
        const rows = await getDb().execute(
            sql<{
                ownerId: string;
                createdById: string | null;
            }>`SELECT owner_id AS "ownerId", created_by_id AS "createdById" FROM ${sql.identifier(LISTING_TABLES[vertical])} WHERE id = ${id}::uuid`
        );
        const row = rows.rows[0];
        if (!row || typeof row.ownerId !== 'string') return null;
        return {
            ownerId: row.ownerId,
            createdById: typeof row.createdById === 'string' ? row.createdById : null
        };
    }
}
