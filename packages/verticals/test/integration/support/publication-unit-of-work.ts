import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    buildScheduleOccurrence,
    type DrizzleClient,
    emailOutboxModel,
    listingPurgeModel,
    plans,
    planVersions,
    trials,
    verticals
} from '@repo/db';
import type { VerticalActivationEvent } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { listingModerationModel } from '../../../../db/src/models/listing/listing-moderation.model';
import { listingPublicationModel } from '../../../../db/src/models/listing/listing-publication.model';
import { listingRetentionModel } from '../../../../db/src/models/listing/listing-retention.model';
import { listingRetentionScheduleModel } from '../../../../db/src/models/listing/listing-retention-schedule.model';
import { users } from '../../../../db/src/schemas/user/user.dbschema';
import type {
    PublicationUnitOfWork,
    PublicationVertical
} from '../../../src/publication/publication-types';
import { trialMachineLockKey } from '../../../src/trial/trial-lock-key';
import type { NewTrialRow, PlanVersionSummaryRow } from '../../../src/trial/trial-start-types';

/** A test adapter with real DB transactions and controllable commercial answers. */
export function createPublicationTestAdapter(args: {
    readonly db: DrizzleClient;
    readonly covered: { value: boolean };
    readonly limit: { value: number };
    readonly declaredLimit?: { value: number | null };
    readonly billing?: Pick<BillingForVerticals, 'coverage'>;
    readonly retention?: {
        readonly stopped: boolean;
        readonly pauseEndedAt: Date | null;
        readonly coverageLostAt?: Date | null;
    };
    readonly onLocked?: () => Promise<void>;
    readonly beforeSetPublicationStatus?: () => Promise<void>;
    readonly afterEnqueueListingNotice?: () => Promise<void>;
}): {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: Pick<BillingForVerticals, 'coverage' | 'retentionStopped'>;
} {
    const billing: Pick<BillingForVerticals, 'coverage' | 'retentionStopped'> = {
        coverage:
            args.billing?.coverage.bind(args.billing) ??
            (async () => ({ covered: args.covered.value, sources: [] })),
        async retentionStopped() {
            return {
                ...(args.retention ?? { stopped: false, pauseEndedAt: null }),
                coverageLostAt: args.retention?.coverageLostAt ?? null
            };
        }
    };
    const unitOfWork: PublicationUnitOfWork = {
        async runLocked<T>(
            lockArgs: { readonly userId: string; readonly vertical: PublicationVertical },
            work: (
                tx: import('../../../src/publication/publication-types').PublicationTransaction
            ) => Promise<T>
        ): Promise<T> {
            return args.db.transaction(async (handle) => {
                const tx = handle as DrizzleClient;
                await listingPublicationModel.lock({ tx, key: trialMachineLockKey(lockArgs).key });
                await args.onLocked?.();
                const port: import('../../../src/publication/publication-types').PublicationTransaction =
                    {
                        async purgeListingContent(input) {
                            return listingPurgeModel.purgeListingContent({ ...input, tx });
                        },
                        async findActivationEvent({ vertical }) {
                            const [row] = await tx
                                .select({ event: verticals.activationEvent })
                                .from(verticals)
                                .where(eq(verticals.id, vertical))
                                .limit(1);
                            return (row?.event ?? null) as VerticalActivationEvent | null;
                        },
                        async findTrialPlan({ vertical }) {
                            const [row] = await tx
                                .select({
                                    planId: plans.id,
                                    planVersionId: planVersions.id,
                                    trialDays: planVersions.trialDays
                                })
                                .from(planVersions)
                                .innerJoin(plans, eq(planVersions.planId, plans.id))
                                .where(
                                    sql`${plans.vertical} = ${vertical} AND ${plans.role} = 'trial' AND ${planVersions.current} = true`
                                )
                                .limit(1);
                            return row ?? null;
                        },
                        async findSellableCurrentVersions({ vertical }) {
                            const rows = await tx
                                .select({
                                    id: planVersions.id,
                                    planId: planVersions.planId,
                                    vertical: planVersions.vertical,
                                    rank: planVersions.rank,
                                    sellable: planVersions.sellable,
                                    current: planVersions.current
                                })
                                .from(planVersions)
                                .where(
                                    sql`${planVersions.vertical} = ${vertical} AND ${planVersions.sellable} = true AND ${planVersions.current} = true`
                                )
                                .orderBy(planVersions.rank);
                            return rows as readonly PlanVersionSummaryRow[];
                        },
                        async findTrialOfUser({ userId, vertical }) {
                            const [row] = await tx
                                .select({ id: trials.id })
                                .from(trials)
                                .where(
                                    sql`${trials.userId} = ${userId} AND ${trials.vertical} = ${vertical}`
                                )
                                .limit(1);
                            return row ?? null;
                        },
                        async findTrialByPseudonym({ emailPseudonym, vertical }) {
                            const [row] = await tx
                                .select({ userId: trials.userId })
                                .from(trials)
                                .where(
                                    sql`${trials.emailPseudonym} = ${emailPseudonym} AND ${trials.vertical} = ${vertical}`
                                )
                                .limit(1);
                            return row ?? null;
                        },
                        async insertTrial({ row }: { readonly row: NewTrialRow }) {
                            const inserted = await tx
                                .insert(trials)
                                .values({ ...row })
                                .onConflictDoNothing()
                                .returning({ id: trials.id });
                            if (inserted.length > 0) return { inserted: true } as const;
                            const [existing] = await tx
                                .select({ id: trials.id })
                                .from(trials)
                                .where(
                                    sql`${trials.userId} = ${row.userId} AND ${trials.vertical} = ${row.vertical}`
                                )
                                .limit(1);
                            return {
                                inserted: false,
                                conflict: existing ? 'USER_VERTICAL' : 'EMAIL_PSEUDONYM'
                            } as const;
                        },
                        async scheduleExpiryCampaign() {},
                        readListing: ({ vertical, listingId }) =>
                            listingPublicationModel.readListing({ tx, vertical, listingId }),
                        readRetentionListing: ({ vertical, listingId }) =>
                            listingRetentionModel.readRetentionListing({ tx, vertical, listingId }),
                        readLastOwnerActAt: ({ vertical, listingId }) =>
                            listingRetentionScheduleModel.readLastOwnerActAt({
                                tx,
                                vertical,
                                listingId
                            }),
                        readRetentionNoticeDeadlines: (input) =>
                            listingRetentionScheduleModel.readRetentionNoticeDeadlines({
                                ...input,
                                tx
                            }),
                        readArchiveOrigins: (input) =>
                            listingRetentionModel.readArchiveOrigins({ ...input, tx }),
                        async readIncompleteListingIds() {
                            return new Map();
                        },
                        readModerationOrigin: (input) =>
                            listingModerationModel.readModerationOrigin({ ...input, tx }),
                        readOpenFixRequest: (input) =>
                            listingModerationModel.readOpenFixRequest({ ...input, tx }),
                        openFixRequest: (input) =>
                            listingModerationModel.openFixRequest({ ...input, tx }),
                        closeOpenFixRequest: (input) =>
                            listingModerationModel.closeOpenFixRequest({ ...input, tx }),
                        insertFixRequestEvent: (input) =>
                            listingModerationModel.insertFixRequestEvent({ ...input, tx }),
                        countPublished: ({ vertical, ownerId }) =>
                            listingPublicationModel.countPublished({ tx, vertical, ownerId }),
                        listByOwner: ({ vertical, ownerId }) =>
                            listingPublicationModel.listByOwner({ tx, vertical, ownerId }),
                        readPublicationInstants: (input) =>
                            listingPublicationModel.readPublicationInstants({ ...input, tx }),
                        async readDeclaredPublishLimit() {
                            return args.declaredLimit === undefined
                                ? args.limit.value
                                : args.declaredLimit.value;
                        },
                        async readPublishLimit() {
                            return args.limit.value;
                        },
                        setPublicationStatus: async (input) => {
                            await args.beforeSetPublicationStatus?.();
                            return listingPublicationModel.setPublicationStatus({ tx, ...input });
                        },
                        stampInactiveSince: (input) =>
                            listingPublicationModel.stampInactiveSince({ tx, ...input }),
                        insertStatusChangedEvent: (input) =>
                            listingPublicationModel.insertStatusChangedEvent({ tx, ...input }),
                        async enqueueRestitutionNotice() {},
                        async enqueueListingNotice(input) {
                            const [recipient] = await tx
                                .select({ email: users.email })
                                .from(users)
                                .where(eq(users.id, input.recipientUserId))
                                .limit(1);
                            if (!recipient?.email) return;
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
                            await args.afterEnqueueListingNotice?.();
                        },
                        async enqueueRetentionNotice(input) {
                            const [recipient] = await tx
                                .select({ email: users.email })
                                .from(users)
                                .where(eq(users.id, input.recipientUserId))
                                .limit(1);
                            if (!recipient?.email) return { enqueued: false };
                            const dedupKey = buildEmailDedupKey({
                                recipient: input.recipientUserId,
                                template: input.template,
                                occurrence: buildScheduleOccurrence({
                                    subjectKind: 'listing',
                                    subjectId: input.listingId,
                                    milestone: input.milestone,
                                    targetDate: input.targetDate
                                })
                            });
                            const result = await emailOutboxModel.enqueue(
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
                            return { enqueued: result.enqueued };
                        }
                    };
                return work(port);
            });
        }
    };
    return { unitOfWork, billing };
}
