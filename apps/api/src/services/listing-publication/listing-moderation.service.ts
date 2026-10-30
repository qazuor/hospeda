import { randomUUID } from 'node:crypto';
import { getDb, listingModerationModel } from '@repo/db';
import {
    type ListingModerationAction,
    type PublicationStatusEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { type Actor, isSystemActor, ServiceError } from '@repo/service-core';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { sql } from 'drizzle-orm';
import {
    closeListingFixRequest,
    requestListingFix
} from '../../../../../packages/verticals/src/publication/fix-request';
import { liftModeration } from '../../../../../packages/verticals/src/publication/lift-moderation';
import { takeDownListing } from '../../../../../packages/verticals/src/publication/moderate-listing';
import type { PublicationVertical } from '../../../../../packages/verticals/src/publication/publication-types';
import { getListingPublicationPorts } from '../../utils/listing-publication/ports';

const LISTING_TABLES: Readonly<Record<PublicationVertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'venues',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};

/** API adapter for the four gestures; ACC:12 step 3 follows the missing-listing 404 because the subject comes from its row. */
export class ListingModerationService {
    /** Applies one administrative gesture and returns the resulting state. */
    async moderate(args: {
        readonly actor: Actor;
        readonly vertical: PublicationVertical;
        readonly id: string;
        readonly body: ListingModerationAction;
    }) {
        const ports = getListingPublicationPorts();
        const table = LISTING_TABLES[args.vertical];
        const rows = await getDb().execute(
            sql<{
                ownerId: string;
                publicationStatus: string;
            }>`SELECT owner_id AS "ownerId", publication_status AS "publicationStatus" FROM ${sql.identifier(table)} WHERE id = ${args.id}::uuid`
        );
        const ownerValue: unknown = rows.rows[0]?.ownerId;
        if (typeof ownerValue !== 'string')
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        const ownerId = ownerValue;
        const action = 'ACC_12' as const;
        const step = resolveAdministrativeActionStep({
            action,
            actorId: args.actor.id,
            subjectId: ownerId,
            permitted: isAdministrativeActionPermitted({
                action,
                actorPermissions: args.actor.permissions
            }),
            isSystemActor: isSystemActor(args.actor)
        });
        if (!step.allowed) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        const common = {
            unitOfWork: ports.unitOfWork,
            clock: ports.clock,
            adminId: args.actor.id,
            ownerId,
            vertical: args.vertical,
            listingId: args.id,
            reason: args.body.reason,
            correlationId: randomUUID()
        };
        let failure: string | null = null;
        switch (args.body.action) {
            case 'REQUEST_FIX': {
                const result = await requestListingFix({
                    ...common,
                    suggestedDate: args.body.suggestedDate ?? null
                });
                failure = result.ok ? null : result.reason;
                break;
            }
            case 'TAKE_DOWN': {
                const result = await takeDownListing({ ...common, afterCommit: ports.afterCommit });
                failure = result.ok ? null : result.reason;
                break;
            }
            case 'LIFT': {
                const result = await liftModeration({
                    ...common,
                    afterCommit: ports.afterCommit,
                    billing: ports.billing,
                    keepFixRequest: args.body.keepFixRequest
                });
                failure = result.ok ? null : result.reason;
                break;
            }
            case 'CLOSE_FIX_REQUEST': {
                const result = await closeListingFixRequest(common);
                failure = result.ok ? null : result.reason;
                break;
            }
            default: {
                const neverAction: never = args.body;
                throw new Error(`Unsupported moderation action: ${neverAction}`);
            }
        }
        if (failure) throw mapModerationDenial(failure);
        const after = await getDb().execute(
            sql<{
                publicationStatus: PublicationStatusEnum;
                fixRequestOpen: boolean;
            }>`SELECT l.publication_status AS "publicationStatus", EXISTS (SELECT 1 FROM fix_request f WHERE f.entity_type = ${args.vertical} AND f.entity_id = l.id AND f.closed_at IS NULL) AS "fixRequestOpen" FROM ${sql.identifier(table)} l WHERE l.id = ${args.id}::uuid`
        );
        const current = after.rows[0];
        if (!current) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        return current;
    }

    /** Reads a listing's current publication and open fix-request state. */
    async readState(args: { readonly vertical: PublicationVertical; readonly id: string }) {
        const table = LISTING_TABLES[args.vertical];
        const result = await getDb().execute(
            sql<{
                publicationStatus: PublicationStatusEnum;
            }>`SELECT publication_status AS "publicationStatus" FROM ${sql.identifier(table)} WHERE id = ${args.id}::uuid AND deleted_at IS NULL`
        );
        const row = result.rows[0];
        if (!row) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        const tx = getDb();
        const request = await listingModerationModel.readOpenFixRequest({
            tx,
            vertical: args.vertical,
            listingId: args.id
        });
        return {
            publicationStatus: row.publicationStatus,
            fixRequest: request
                ? {
                      reason: request.reason,
                      suggestedDate: request.suggestedDate,
                      openedAt: request.openedAt.toISOString(),
                      ownerReportedFixedAt: request.ownerReportedFixedAt?.toISOString() ?? null
                  }
                : null
        };
    }
}

function mapModerationDenial(reason: string): ServiceError {
    if (reason === 'LISTING_NOT_FOUND')
        return new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
    if (reason === 'INVALID_FROM' || reason === 'STATE_CHANGED')
        return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Listing state changed');
    if (reason === 'ALREADY_OPEN')
        return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'Fix request already open');
    if (reason === 'NO_OPEN_FIX_REQUEST')
        return new ServiceError(ServiceErrorCode.ALREADY_EXISTS, 'No open fix request');
    return new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'A reason is required');
}
