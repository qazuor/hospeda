import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    getDb,
    listingModerationModel,
    listingPublicationModel,
    listingPurgeModel,
    listingRetentionModel,
    trials,
    users
} from '@repo/db';
import { getRevalidationService } from '@repo/service-core';
import { and, eq, sql } from 'drizzle-orm';
import { LISTING_RESTITUTION_TEMPLATE } from '../../../../../packages/verticals/src/publication/publication-notices';
import type {
    PublicationAfterCommit,
    PublicationTransaction,
    PublicationUnitOfWork,
    PublicationVertical
} from '../../../../../packages/verticals/src/publication/publication-types';
import { PUBLICATION_LIMIT_KEYS } from '../../../../../packages/verticals/src/publication/publication-types';
import { trialMachineLockKey } from '../../../../../packages/verticals/src/trial/trial-lock-key';
import { getClock } from '../clock';
import { invalidateEffectiveSetsForUser } from '../effective-set-cache';
import { getListingAccessPorts } from '../listing-access/ports';
import { apiLogger } from '../logger';
import { buildTrialCampaignOutbox } from '../trial/trial-campaign-outbox';
import { buildTrialStartReader } from './trial-start-reader';

const LISTING_TABLE_BY_VERTICAL: Readonly<Record<PublicationVertical, string>> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

/** Transaction-bound adapter shared by owner transitions and coverage reconciliation. */
export function getListingPublicationPorts(options?: {
    readonly liveLimit?: (input: {
        readonly userId: string;
        readonly vertical: PublicationVertical;
    }) => Promise<number | null>;
}): {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly afterCommit: PublicationAfterCommit;
    readonly billing: ReturnType<typeof getListingAccessPorts>['billing'];
    readonly clock: ReturnType<typeof getClock>['clock'];
} {
    const access = getListingAccessPorts();
    const unitOfWork: PublicationUnitOfWork = {
        runLocked<T>(
            args: { readonly userId: string; readonly vertical: PublicationVertical },
            work: (tx: PublicationTransaction) => Promise<T>
        ) {
            return getDb().transaction(async (rawTx) => {
                const tx = rawTx as DrizzleClient;
                await tx.execute(
                    sql`SELECT pg_advisory_xact_lock(hashtextextended(${trialMachineLockKey(args).key}, 0))`
                );
                const publication: PublicationTransaction = {
                    async purgeListingContent(input) {
                        return listingPurgeModel.purgeListingContent({ ...input, tx });
                    },
                    async readModerationOrigin(input) {
                        return listingModerationModel.readModerationOrigin({ ...input, tx });
                    },
                    async readOpenFixRequest(input) {
                        return listingModerationModel.readOpenFixRequest({ ...input, tx });
                    },
                    async openFixRequest(input) {
                        return listingModerationModel.openFixRequest({ ...input, tx });
                    },
                    async closeOpenFixRequest(input) {
                        return listingModerationModel.closeOpenFixRequest({ ...input, tx });
                    },
                    async insertFixRequestEvent(input) {
                        await listingModerationModel.insertFixRequestEvent({ ...input, tx });
                    },
                    async readRetentionListing(input) {
                        return listingRetentionModel.readRetentionListing({ ...input, tx });
                    },
                    async readArchiveOrigins(input) {
                        return listingRetentionModel.readArchiveOrigins({ ...input, tx });
                    },
                    async readListing(input) {
                        return listingPublicationModel.readListing({ ...input, tx });
                    },
                    async countPublished(input) {
                        return listingPublicationModel.countPublished({ ...input, tx });
                    },
                    async listByOwner(input) {
                        return listingPublicationModel.listByOwner({ ...input, tx });
                    },
                    async readPublicationInstants(input) {
                        return listingPublicationModel.readPublicationInstants({ ...input, tx });
                    },
                    async readPublishLimit(input) {
                        if (options?.liveLimit) return (await options.liveLimit(input)) ?? 0;
                        const effective = await access.effectiveSet({
                            userId: input.userId,
                            vertical: input.vertical
                        });
                        return (
                            effective.limits.get({
                                key: PUBLICATION_LIMIT_KEYS[input.vertical],
                                userId: input.userId,
                                vertical: input.vertical
                            }) ?? 0
                        );
                    },
                    async readDeclaredPublishLimit(input) {
                        if (options?.liveLimit) return options.liveLimit(input);
                        const effective = await access.effectiveSet({
                            userId: input.userId,
                            vertical: input.vertical
                        });
                        return (
                            effective.limits.get({
                                key: PUBLICATION_LIMIT_KEYS[input.vertical],
                                userId: input.userId,
                                vertical: input.vertical
                            }) ?? null
                        );
                    },
                    async setPublicationStatus(input) {
                        return listingPublicationModel.setPublicationStatus({ ...input, tx });
                    },
                    async stampInactiveSince(input) {
                        await listingPublicationModel.stampInactiveSince({ ...input, tx });
                    },
                    async insertStatusChangedEvent(input) {
                        await listingPublicationModel.insertStatusChangedEvent({
                            ...input,
                            tx,
                            correlationId: input.correlationId || randomUUID()
                        });
                    },
                    ...buildTrialStartReader({ client: tx }),
                    async enqueueRestitutionNotice(input) {
                        const [owner] = await tx
                            .select({ email: users.email })
                            .from(users)
                            .where(eq(users.id, input.ownerId))
                            .limit(1);
                        if (!owner?.email) {
                            apiLogger.warn(
                                { ownerId: input.ownerId, correlationId: input.correlationId },
                                'Listing restitution notice has no owner email'
                            );
                            return;
                        }
                        const template = LISTING_RESTITUTION_TEMPLATE;
                        const dedupKey = buildEmailDedupKey({
                            recipient: input.ownerId,
                            template,
                            occurrence: buildEventOccurrence({ eventId: input.correlationId })
                        });
                        await emailOutboxModel.enqueue(
                            {
                                recipientUserId: input.ownerId,
                                recipientEmail: owner.email,
                                template,
                                payload: { ...input.payload },
                                dedupKey,
                                correlationId: input.correlationId
                            },
                            tx
                        );
                    },
                    async enqueueListingNotice(input) {
                        const [recipient] = await tx
                            .select({ email: users.email })
                            .from(users)
                            .where(eq(users.id, input.recipientUserId))
                            .limit(1);
                        if (!recipient?.email) {
                            apiLogger.warn(
                                {
                                    recipientUserId: input.recipientUserId,
                                    correlationId: input.correlationId
                                },
                                'Listing notice has no recipient email'
                            );
                            return;
                        }
                        const dedupKey = buildEmailDedupKey({
                            recipient: input.recipientUserId,
                            template: input.template,
                            occurrence: buildEventOccurrence({
                                eventId: `${input.correlationId}:${input.occurrenceKey}`
                            })
                        });
                        await emailOutboxModel.enqueue(
                            {
                                recipientUserId: input.recipientUserId,
                                recipientEmail: recipient.email,
                                template: input.template,
                                payload: { ...input.payload },
                                dedupKey,
                                correlationId: input.correlationId
                            },
                            tx
                        );
                    },
                    async insertTrial({ row }) {
                        const inserted = await tx
                            .insert(trials)
                            .values(row)
                            .onConflictDoNothing()
                            .returning({ id: trials.id });
                        if (inserted.length > 0) return { inserted: true };
                        const [pseudonymMatch] = await tx
                            .select({ id: trials.id })
                            .from(trials)
                            .where(
                                and(
                                    eq(trials.emailPseudonym, row.emailPseudonym),
                                    eq(trials.vertical, row.vertical)
                                )
                            )
                            .limit(1);
                        return {
                            inserted: false,
                            conflict: pseudonymMatch ? 'EMAIL_PSEUDONYM' : 'USER_VERTICAL'
                        };
                    },
                    scheduleExpiryCampaign: buildTrialCampaignOutbox({
                        tx,
                        clock: getClock().clock
                    }).scheduleExpiryCampaign
                } as PublicationTransaction;
                return work(publication);
            });
        }
    };
    const afterCommit: PublicationAfterCommit = {
        emitCoverageChanged: (event) => access.billing.emitCoverageChanged(event),
        async invalidateUser({ userId }) {
            invalidateEffectiveSetsForUser(userId);
        },
        async revalidate({ vertical, listingIds }) {
            for (const id of listingIds) {
                try {
                    const result = await getDb().execute(sql<{
                        slug: string;
                        destinationSlug: string | null;
                    }>`
                        SELECT l.slug, d.slug AS "destinationSlug"
                        FROM ${sql.identifier(LISTING_TABLE_BY_VERTICAL[vertical])} l
                        LEFT JOIN destinations d ON d.id = l.destination_id
                        WHERE l.id = ${id}`);
                    const row = result.rows[0];
                    if (row && typeof row.slug === 'string') {
                        getRevalidationService()?.scheduleRevalidation({
                            entityType: vertical,
                            id,
                            slug: row.slug,
                            destinationSlug:
                                typeof row.destinationSlug === 'string'
                                    ? row.destinationSlug
                                    : undefined
                        });
                    }
                } catch (error) {
                    // Revalidation is best-effort after a committed state change.
                    apiLogger.warn(
                        { error, vertical, listingId: id },
                        'Listing revalidation scheduling failed'
                    );
                }
            }
        }
    };
    return { unitOfWork, afterCommit, billing: access.billing, clock: getClock().clock };
}
