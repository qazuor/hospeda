import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
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
            inactiveSince: at
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
        inactiveSince: at
    };
    const calls: string[] = [];
    const restitutionNotices: Parameters<PublicationTransaction['enqueueRestitutionNotice']>[0][] =
        [];
    const tx: PublicationTransaction = {
        async findActivationEvent() {
            return event;
        },
        async findTrialPlan() {
            return { planId: listingId, planVersionId: listingId, trialDays: 14 };
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
            return args.trialAvailable === false ? { id: listingId } : null;
        },
        async findTrialByPseudonym() {
            return null;
        },
        async insertTrial() {
            calls.push('trial');
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
            publishedCount += to === PublicationStatusEnum.PUBLISHED ? 1 : -1;
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
        coverage: vi.fn(async () => ({ covered: args.covered ?? true, sources: [] }))
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
    return { unitOfWork, billing, afterCommit, calls, restitutionNotices, getStatus: () => status };
}
