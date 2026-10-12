import { getDb, listingRetentionModel } from '@repo/db';
import type { runInactivityArchive } from '@repo/verticals';
import { getListingPublicationPorts } from './ports.js';

/** Builds production ports for the daily PB4/PB5 inactivity archive. */
export function getListingArchivePorts(): Parameters<typeof runInactivityArchive>[0]['ports'] {
    const publication = getListingPublicationPorts();
    return {
        ...publication,
        population: {
            async listDue(input) {
                return getDb().transaction((tx) =>
                    listingRetentionModel.listRetentionCandidates({ ...input, tx })
                );
            }
        }
    };
}
