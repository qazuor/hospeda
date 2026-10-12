import type { CoverageSource } from '@repo/billing-verticals-contract';
import { CoverageResponseSchema, coverageSourceClassOf } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { expect, vi } from 'vitest';
import type {
    PublicationAfterCommit,
    PublicationListing,
    PublicationTransaction,
    PublicationUnitOfWork
} from '../../src/publication/publication-types';

export const userId = '00000000-0000-4000-8000-000000000001';
export const listingId = '00000000-0000-4000-8000-000000000002';
export const vertical: VerticalEnum.ACCOMMODATION = VerticalEnum.ACCOMMODATION;
export const at = new Date('2026-10-10T12:00:00.000Z');
export const clock = { now: () => new Date(at) };
export const emailPseudonym = 'a'.repeat(64);
export const event = 'listing_published' as const;

export function makeHarness(
    args: {
        readonly status?: PublicationStatusEnum;
        readonly covered?: boolean;
        readonly limit?: number;
        readonly declaredLimit?: number | null;
        readonly failTransaction?: boolean;
        readonly trialAvailable?: boolean;
        readonly setReturnsFalse?: boolean;
        readonly listings?: readonly PublicationListing[];
        readonly sources?: readonly CoverageSource[];
        readonly declaredEvent?: typeof event | null;
        readonly trialPlanDays?: number | null;
        readonly userHasTrialRow?: boolean;
        readonly pseudonymOwnedByOther?: boolean;
        readonly insertConflict?: 'USER_VERTICAL' | 'EMAIL_PSEUDONYM';
        readonly retention?: { readonly stopped: boolean; readonly pauseEndedAt: Date | null };
        readonly archiveOrigins?: ReadonlyMap<string, PublicationStatusEnum>;
        readonly inactiveSince?: Date;
        readonly recordBillingCalls?: boolean;
    } = {}
) {
    let locked = false;
    let status = args.status ?? PublicationStatusEnum.DRAFT;
    const records = args.listings ?? [
        {
            id: listingId,
            ownerId: userId,
            publicationStatus: status,
            createdAt: at,
            inactiveSince: args.inactiveSince ?? at
        }
    ];
    const statuses = new Map(records.map((row) => [row.id, row.publicationStatus]));
    let publishedCount = records.filter(
        (row) => row.publicationStatus === PublicationStatusEnum.PUBLISHED
    ).length;
    const listing: PublicationListing = {
        id: listingId,
        ownerId: userId,
        publicationStatus: status,
        createdAt: at,
        inactiveSince: args.inactiveSince ?? at
    };
    const calls: string[] = [];
    const restitutionNotices: Parameters<PublicationTransaction['enqueueRestitutionNotice']>[0][] =
        [];
    const insertedRows: unknown[] = [];
    const sources =
        args.sources ??
        (args.covered === false
            ? []
            : [
                  {
                      type: 'SUBSCRIPTION' as const,
                      reference: { kind: 'PLAN_VERSION' as const, planVersionId: listingId },
                      scope: 'VERTICAL' as const,
                      target: null,
                      since: at,
                      until: 'NO_KNOWN_DATE' as const,
                      charged: false,
                      floor: null
                  }
              ]);
    const tx: PublicationTransaction = {
        async findActivationEvent() {
            return args.declaredEvent === undefined ? event : args.declaredEvent;
        },
        async findTrialPlan() {
            if (args.trialPlanDays === null) return null;
            return {
                planId: listingId,
                planVersionId: listingId,
                trialDays: args.trialPlanDays ?? 14
            };
        },
        async findSellableCurrentVersions() {
            return [
                {
                    id: listingId,
                    planId: listingId,
                    vertical,
                    rank: 1,
                    sellable: true,
                    current: true
                }
            ];
        },
        async findTrialOfUser() {
            return args.userHasTrialRow || args.trialAvailable === false ? { id: listingId } : null;
        },
        async findTrialByPseudonym() {
            return args.pseudonymOwnedByOther
                ? { userId: '00000000-0000-4000-8000-000000000009' }
                : null;
        },
        async insertTrial({ row }) {
            insertedRows.push(row);
            calls.push(row.status === TrialStatusEnum.TRIAL_ACTIVE ? 'trial' : 'consumedTrial');
            if (args.insertConflict) return { inserted: false, conflict: args.insertConflict };
            return { inserted: true };
        },
        async scheduleExpiryCampaign() {
            calls.push('campaign');
        },
        async readListing() {
            expect(locked).toBe(true);
            calls.push('read');
            return { ...listing, publicationStatus: statuses.get(listingId) ?? status };
        },
        async readRetentionListing() {
            expect(locked).toBe(true);
            calls.push('readRetention');
            return {
                ...listing,
                publicationStatus: statuses.get(listingId) ?? status,
                deletionAnnouncedAt: null,
                deadlinesVersion: 1,
                deadlines: { archiveAfterDays: 90, deletionAfterDays: 180, draftArchiveMonths: 3 }
            };
        },
        async readArchiveOrigins({ listingIds }) {
            calls.push('archiveOrigins');
            return new Map(
                listingIds.flatMap((id) =>
                    args.archiveOrigins?.has(id)
                        ? [[id, args.archiveOrigins.get(id)!] as const]
                        : []
                )
            );
        },
        async countPublished() {
            return publishedCount;
        },
        async listByOwner() {
            expect(locked).toBe(true);
            calls.push('list');
            return records.map((row) => ({
                ...row,
                publicationStatus: statuses.get(row.id) ?? row.publicationStatus
            }));
        },
        async readPublishLimit() {
            return args.limit ?? 1;
        },
        async readDeclaredPublishLimit() {
            calls.push('declaredLimit');
            return args.declaredLimit === undefined ? (args.limit ?? 1) : args.declaredLimit;
        },
        async readPublicationInstants({ listingIds }) {
            calls.push('instants');
            return new Map(listingIds.map((id, index) => [id, new Date(at.getTime() + index)]));
        },
        async setPublicationStatus({ listingId: targetId, from, to }) {
            if (args.setReturnsFalse) return false;
            if ((statuses.get(targetId) ?? status) !== from) return false;
            statuses.set(targetId, to);
            if (targetId === listingId) status = to;
            if (from === PublicationStatusEnum.PUBLISHED) publishedCount -= 1;
            if (to === PublicationStatusEnum.PUBLISHED) publishedCount += 1;
            calls.push('set');
            return true;
        },
        async stampInactiveSince() {
            calls.push('stamp');
        },
        async insertStatusChangedEvent() {
            calls.push('event');
        },
        async enqueueRestitutionNotice(args) {
            calls.push('enqueueRestitutionNotice');
            restitutionNotices.push(args);
        }
    };
    const unitOfWork: PublicationUnitOfWork = {
        async runLocked(_lock, work) {
            calls.push('lock');
            locked = true;
            const result = await work(tx);
            if (args.failTransaction) {
                restitutionNotices.splice(0);
                throw new Error('rollback');
            }
            locked = false;
            calls.push('commit');
            return result;
        }
    };
    const billing = {
        coverage: vi.fn(async () => {
            if (args.recordBillingCalls) calls.push('coverage');
            return CoverageResponseSchema.parse({
                covered: sources.some(
                    (source) => coverageSourceClassOf({ source }).sourceClass === 'TITLE'
                ),
                sources
            });
        }),
        retentionStopped: vi.fn(async () => {
            calls.push('retentionStopped');
            return {
                ...(args.retention ?? { stopped: false, pauseEndedAt: null }),
                coverageLostAt: null
            };
        })
    };
    const afterCommit: PublicationAfterCommit = {
        emitCoverageChanged: vi.fn(async () => {
            calls.push('coverageNotice');
        }),
        invalidateUser: vi.fn(async () => {
            calls.push('invalidate');
        }),
        revalidate: vi.fn(async () => {
            calls.push('revalidate');
        })
    };
    return {
        unitOfWork,
        billing,
        afterCommit,
        calls,
        insertedRows,
        restitutionNotices,
        getStatus: () => status
    };
}
