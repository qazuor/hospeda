import type { DrizzleClient } from '@repo/db';
import { listingPublicationModel } from '../../../../db/src/models/listing/listing-publication.model';
import type { ReconcilerPorts } from '../../../src/publication/coverage-reconciler-types';
import { createPublicationTestAdapter } from './publication-unit-of-work';

/** Builds reconciler ports over the real test database and controllable coverage answers. */
export function createReconcilerTestPorts(args: {
    readonly db: DrizzleClient;
    readonly coveredByUser: ReadonlyMap<string, boolean>;
    readonly limitByUser: ReadonlyMap<string, number | null>;
    readonly invalidated?: string[];
    readonly cachedPresenceByUser?: ReadonlyMap<
        string,
        readonly ('partner_public_page' | 'partner_carousel_presence')[] | null
    >;
    readonly livePresenceByUser?: ReadonlyMap<
        string,
        readonly ('partner_public_page' | 'partner_carousel_presence')[]
    >;
    readonly monitorCalls?: string[];
    readonly failUserId?: string;
}): ReconcilerPorts {
    const fallbackCovered = { value: true };
    const fallbackLimit = { value: 0 };
    const base = createPublicationTestAdapter({
        db: args.db,
        covered: fallbackCovered,
        limit: fallbackLimit
    });
    return {
        population: {
            listOwnerVerticals: (input) =>
                args.db.transaction((tx) =>
                    listingPublicationModel.listReconcilerPopulation({ ...input, tx })
                ),
            listPartnerUsers: (input) =>
                args.db.transaction((tx) =>
                    listingPublicationModel.listPartnerPresenceUsers({ ...input, tx })
                )
        },
        reader: {
            summarize: ({ userId, vertical }) => {
                if (userId === args.failUserId) throw new Error('test pair failure');
                return args.db.transaction((tx) =>
                    listingPublicationModel.summarizeOwnerListings({
                        tx,
                        vertical,
                        ownerId: userId
                    })
                );
            }
        },
        liveLimit: async ({ userId }) => {
            const value = args.limitByUser.get(userId);
            return value === undefined ? null : value;
        },
        billing: {
            async coverage({ userId }) {
                return {
                    covered: args.coveredByUser.get(userId) ?? fallbackCovered.value,
                    sources: []
                };
            }
        },
        presence: {
            liveKeys: async ({ userId }) => args.livePresenceByUser?.get(userId) ?? [],
            cachedKeys: async ({ userId }) => args.cachedPresenceByUser?.get(userId) ?? null,
            async invalidate({ userId }) {
                args.invalidated?.push(userId);
            }
        },
        unitOfWork: {
            runLocked(lockArgs, work) {
                fallbackCovered.value = args.coveredByUser.get(lockArgs.userId) ?? true;
                fallbackLimit.value = args.limitByUser.get(lockArgs.userId) ?? 0;
                return base.unitOfWork.runLocked(lockArgs, work);
            }
        },
        afterCommit: {
            emitCoverageChanged: async () => {},
            async invalidateUser({ userId }) {
                args.invalidated?.push(userId);
            },
            revalidate: async () => {}
        },
        clock: { now: () => new Date('2026-10-11T05:00:00Z') },
        monitor: {
            async ping({ job }) {
                args.monitorCalls?.push(job);
            }
        }
    };
}
