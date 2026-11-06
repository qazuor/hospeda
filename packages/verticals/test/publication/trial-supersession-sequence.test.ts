/**
 * HOS-2027: the limit fed to the recalculation is computed by the REAL fold from
 * the live source set, so removing the TRIAL-supersession rule from
 * `selectPlegableSources` changes the sequence and fails this scenario.
 *
 * Scenario: A (older, UNPUBLISHED_BY_BILLING, no owner publish instant) and B
 * (newer, PUBLISHED, owner instant) under a cap-1 plan plus a cap-1 trial. While
 * the trial and the not-yet-charged subscription coexist, and after the trial
 * converts, B must stay published and A unpublished.
 */
import { type CoverageSource, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { foldPlegableSet } from '../../src/effective-set/fold';
import { selectPlegableSources } from '../../src/effective-set/plegable';
import type { FoldableSource } from '../../src/effective-set/types';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import type {
    PublicationListing,
    PublicationTransaction,
    PublicationUnitOfWork
} from '../../src/publication/publication-types';

const LIMIT_KEY = 'max_accommodations';
const userId = '11111111-1111-4111-8111-111111111111';
const olderId = '22222222-2222-4222-8222-222222222222';
const newerId = '33333333-3333-4333-8333-333333333333';
const vertical: VerticalEnum.ACCOMMODATION = VerticalEnum.ACCOMMODATION;
const at = new Date('2026-10-12T00:00:00.000Z');
const reference = { kind: 'PLAN_VERSION', planVersionId: 'plan-v1' } as const;
const foldable = (args: {
    readonly type: 'TRIAL' | 'SUBSCRIPTION';
    readonly value: number;
}): FoldableSource => {
    const source: CoverageSource = CoverageSourceSchema.parse({
        type: args.type,
        reference,
        scope: 'VERTICAL',
        target: null,
        since: at,
        until: new Date('2026-12-01T00:00:00.000Z'),
        charged: args.type === 'SUBSCRIPTION' ? false : null,
        floor: null
    });
    return { source, grants: [{ key: LIMIT_KEY, value: args.value, strategy: 'SUM' }] };
};
const trial = (): FoldableSource => foldable({ type: 'TRIAL', value: 1 });
const subscription = (): FoldableSource => foldable({ type: 'SUBSCRIPTION', value: 1 });

/** The limit the effective set resolves for each live-source snapshot, via the real fold. */
const limitOf = (sources: readonly FoldableSource[]): number =>
    foldPlegableSet({ sources }).get(LIMIT_KEY) ?? 0;

function listingHarness() {
    const listings: PublicationListing[] = [
        {
            id: olderId,
            ownerId: userId,
            publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            inactiveSince: at
        },
        {
            id: newerId,
            ownerId: userId,
            publicationStatus: PublicationStatusEnum.PUBLISHED,
            createdAt: new Date('2026-02-01T00:00:00Z'),
            inactiveSince: at
        }
    ];
    const statuses = new Map(listings.map((listing) => [listing.id, listing.publicationStatus]));
    const statusWrites: Parameters<PublicationTransaction['setPublicationStatus']>[0][] = [];
    let publishedCount = 1;
    const tx = {
        async listByOwner() {
            return listings.map((listing) => ({
                ...listing,
                publicationStatus: statuses.get(listing.id) ?? listing.publicationStatus
            }));
        },
        async readArchiveOrigins() {
            return new Map();
        },
        async readPublicationInstants({ listingIds }: { readonly listingIds: readonly string[] }) {
            // B has a recorded owner publication instant; A has no owner instant.
            return new Map(listingIds.filter((id) => id === newerId).map((id) => [id, at]));
        },
        async readIncompleteListingIds() {
            return new Map();
        },
        async countPublished() {
            return publishedCount;
        },
        async setPublicationStatus(
            input: Parameters<PublicationTransaction['setPublicationStatus']>[0]
        ) {
            statusWrites.push(input);
            if (statuses.get(input.listingId) !== input.from) return false;
            statuses.set(input.listingId, input.to);
            if (input.from === PublicationStatusEnum.PUBLISHED) publishedCount -= 1;
            if (input.to === PublicationStatusEnum.PUBLISHED) publishedCount += 1;
            return true;
        },
        async insertStatusChangedEvent() {},
        async stampInactiveSince() {},
        async enqueueRestitutionNotice() {}
    } as unknown as PublicationTransaction;
    const unitOfWork: PublicationUnitOfWork = {
        async runLocked(_lock, work) {
            return work(tx);
        }
    };
    return { unitOfWork, statuses, statusWrites };
}

async function recalculateWithLimits(limits: readonly number[]) {
    const harness = listingHarness();
    let limitIndex = 0;
    const billing = {
        coverage: async () => ({
            covered: true,
            sources: [foldable({ type: 'SUBSCRIPTION', value: 1 }).source]
        }),
        retentionStopped: async () => ({ stopped: false, pauseEndedAt: null, coverageLostAt: null })
    };
    const args = {
        unitOfWork: harness.unitOfWork,
        billing,
        clock: { now: () => new Date(at) },
        afterCommit: {
            emitCoverageChanged: async () => {},
            invalidateUser: async () => {},
            revalidate: async () => {}
        },
        userId,
        vertical,
        correlationId: olderId,
        liveLimit: async () => limits[limitIndex++] ?? limits.at(-1) ?? 1
    };
    for (const _limit of limits) await recalculateCoverage(args);
    return harness;
}

describe('trial supersession across coverage recalculation (HOS-2027)', () => {
    it('keeps B published through subscribe-during-trial and trial conversion', async () => {
        // Window with both titles, then after the trial left: both folded by the real fold.
        const limits = [limitOf([trial(), subscription()]), limitOf([subscription()])];
        expect(limits).toEqual([1, 1]);
        // The direction is pinned: the subscription survives, the trial is dropped.
        const survivors = selectPlegableSources({ sources: [trial(), subscription()] }).map(
            ({ source }) => source.type
        );
        expect(survivors).toEqual(['SUBSCRIPTION']);

        const harness = await recalculateWithLimits(limits);

        expect(harness.statuses.get(newerId)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(harness.statuses.get(olderId)).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        expect(harness.statusWrites.filter((write) => write.listingId === newerId)).toHaveLength(0);
    });
});
