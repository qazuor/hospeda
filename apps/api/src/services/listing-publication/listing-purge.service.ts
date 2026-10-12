import { randomUUID } from 'node:crypto';
import { getDb } from '@repo/db';
import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { sql } from 'drizzle-orm';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { purgeListing } from '../../../../../packages/verticals/src/publication/purge-listing';
import { getListingPublicationPorts } from '../../utils/listing-publication/ports';
import { getPurgeAfterCommit } from '../../utils/listing-publication/purge-ports';
import { apiLogger } from '../../utils/logger';

const LISTING_TABLES: Readonly<Record<PublicationVertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.GASTRONOMY]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};

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
