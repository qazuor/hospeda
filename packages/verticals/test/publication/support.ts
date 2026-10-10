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
        readonly failTransaction?: boolean;
        readonly trialAvailable?: boolean;
    } = {}
) {
    let locked = false;
    let status = args.status ?? PublicationStatusEnum.DRAFT;
    let publishedCount = 0;
    const listing: PublicationListing = {
        id: listingId,
        ownerId: userId,
        publicationStatus: status,
        createdAt: at,
        inactiveSince: at
    };
    const calls: string[] = [];
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
            return { ...listing, publicationStatus: status };
        },
        async countPublished() {
            return publishedCount;
        },
        async listByOwner() {
            expect(locked).toBe(true);
            calls.push('list');
            return [{ ...listing, publicationStatus: status }];
        },
        async readPublishLimit() {
            return args.limit ?? 1;
        },
        async setPublicationStatus({ from, to }) {
            if (status !== from) return false;
            status = to;
            publishedCount = to === PublicationStatusEnum.PUBLISHED ? 1 : 0;
            calls.push('set');
            return true;
        },
        async stampInactiveSince() {
            calls.push('stamp');
        },
        async insertStatusChangedEvent() {
            calls.push('event');
        }
    };
    const unitOfWork: PublicationUnitOfWork = {
        async runLocked(_lock, work) {
            calls.push('lock');
            locked = true;
            const result = await work(tx);
            if (args.failTransaction) throw new Error('rollback');
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
    return { unitOfWork, billing, afterCommit, calls, getStatus: () => status };
}
