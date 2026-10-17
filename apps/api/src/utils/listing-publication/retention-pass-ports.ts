import { getDb, listingRetentionScheduleModel } from '@repo/db';
import type { runRetentionPass } from '@repo/verticals';
import { getListingPublicationPorts } from './ports.js';
import { getPurgeAfterCommit } from './purge-ports.js';

/** Production adapters for the daily V9b retention pass. */
export function getRetentionPassPorts(input: {
    readonly previousPassStartedAt: Date | null;
}): Parameters<typeof runRetentionPass>[0]['ports'] {
    const publication = getListingPublicationPorts();
    return {
        unitOfWork: publication.unitOfWork,
        billing: publication.billing,
        clock: publication.clock,
        afterCommit: getPurgeAfterCommit(),
        previousPassStartedAt: input.previousPassStartedAt,
        population: {
            async listNoticeDue(args) {
                return getDb().transaction((tx) =>
                    listingRetentionScheduleModel.listRetentionNoticeCandidates({ ...args, tx })
                );
            },
            async listPurgeDue(args) {
                return getDb().transaction((tx) =>
                    listingRetentionScheduleModel.listPurgeCandidates({ ...args, tx })
                );
            }
        }
    };
}
