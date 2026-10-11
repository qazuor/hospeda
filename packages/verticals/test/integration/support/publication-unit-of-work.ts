import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { type DrizzleClient, plans, planVersions, trials, verticals } from '@repo/db';
import type { VerticalActivationEvent } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { listingPublicationModel } from '../../../../db/src/models/listing/listing-publication.model';
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
    readonly onLocked?: () => Promise<void>;
    readonly beforeSetPublicationStatus?: () => Promise<void>;
}): {
    readonly unitOfWork: PublicationUnitOfWork;
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
} {
    const billing: Pick<BillingForVerticals, 'coverage'> = {
        async coverage() {
            return { covered: args.covered.value, sources: [] };
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
                            listingPublicationModel.insertStatusChangedEvent({ tx, ...input })
                    };
                return work(port);
            });
        }
    };
    return { unitOfWork, billing };
}
