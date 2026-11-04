import type { CoverageResponse, CoverageSource } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    recalculateCoverage,
    type PublicationListing,
    type PublicationTransaction,
    type PublicationUnitOfWork
} from '@repo/verticals';
import { describe, expect, it, vi } from 'vitest';
import { createBillingCoverage } from '../../../../src/services/billing/coverage/billing-coverage';
import type { BillingCoveragePorts } from '../../../../src/services/billing/coverage/coverage-ports';
import { resolveAddonSources } from '../../../../src/services/billing/coverage/addon-sources';
import { resolveCourtesySources } from '../../../../src/services/billing/coverage/courtesy-sources';
import { resolveGrantSources } from '../../../../src/services/billing/coverage/grant-sources';
import { resolveSubscriptionSources } from '../../../../src/services/billing/coverage/subscription-sources';

vi.mock('../../../../src/services/billing/coverage/subscription-sources', () => ({
    resolveSubscriptionSources: vi.fn()
}));
vi.mock('../../../../src/services/billing/coverage/addon-sources', () => ({
    resolveAddonSources: vi.fn(async () => ({ sources: [] }))
}));
vi.mock('../../../../src/services/billing/coverage/courtesy-sources', () => ({
    resolveCourtesySources: vi.fn(async () => ({ sources: [] }))
}));
vi.mock('../../../../src/services/billing/coverage/grant-sources', () => ({
    resolveGrantSources: vi.fn(async () => ({ sources: [] }))
}));

const userId = '11111111-1111-4111-8111-111111111111';
const olderId = '22222222-2222-4222-8222-222222222222';
const newerId = '33333333-3333-4333-8333-333333333333';
const vertical: VerticalEnum.ACCOMMODATION = VerticalEnum.ACCOMMODATION;
const at = new Date('2026-10-12T00:00:00.000Z');
const trialSource: CoverageSource = {
    type: 'TRIAL',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'trial-version' },
    scope: 'VERTICAL',
    target: null,
    since: at,
    until: new Date('2026-11-01T00:00:00.000Z'),
    charged: null,
    floor: null
};
const baseSource: CoverageSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'floor-version' },
    scope: 'VERTICAL',
    target: null,
    since: at,
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};
const subscriptionSource: CoverageSource = {
    type: 'SUBSCRIPTION',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'paid-version' },
    scope: 'VERTICAL',
    target: null,
    since: at,
    until: 'NO_KNOWN_DATE',
    charged: false,
    floor: null
};

function billingPorts(trialAndBase: CoverageResponse): BillingCoveragePorts {
    return {
        clock: { now: () => new Date(at) },
        payments: { hasCreditedPayment: vi.fn(async () => false) },
        addonPolicy: vi.fn(async () => {
            throw new Error('unexpected addon policy read');
        }),
        listing: vi.fn(async () => {
            throw new Error('unexpected listing read');
        }),
        trialAndBase: vi.fn(async () => trialAndBase)
    };
}

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
        async setPublicationStatus(input: Parameters<PublicationTransaction['setPublicationStatus']>[0]) {
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

async function recalculateWithLimitSequence(limits: readonly number[]) {
    const harness = listingHarness();
    let limitIndex = 0;
    const billing = {
        coverage: async () => ({ covered: true, sources: [subscriptionSource] }),
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

describe('trial supersession across coverage recalculation', () => {
    it('omits TRIAL when the same-vertical active subscription is emitted', async () => {
        vi.mocked(resolveSubscriptionSources).mockResolvedValue({ sources: [subscriptionSource] });
        vi.mocked(resolveAddonSources).mockResolvedValue({ sources: [] });
        vi.mocked(resolveCourtesySources).mockResolvedValue({ sources: [] });
        vi.mocked(resolveGrantSources).mockResolvedValue({ sources: [] });

        const result = await createBillingCoverage({
            ports: billingPorts({ covered: true, sources: [trialSource, baseSource] })
        }).coverage({ userId, vertical });

        expect(result.sources).toEqual([baseSource, subscriptionSource]);
        expect(result.sources.some((source) => source.type === 'TRIAL')).toBe(false);
    });

    it('keeps B published with [1, 1], while the pre-fix [2, 1] sequence swaps in older A', async () => {
        // [2, 1] was the pre-fix effective limit: TRIAL + SUBSCRIPTION were summed.
        const fixed = await recalculateWithLimitSequence([1, 1]);
        expect(fixed.statuses.get(newerId)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(fixed.statusWrites.filter((write) => write.listingId === newerId)).toHaveLength(0);

        const preFix = await recalculateWithLimitSequence([2, 1]);
        expect(preFix.statuses.get(newerId)).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        expect(preFix.statusWrites.filter((write) => write.listingId === newerId)).toHaveLength(1);
        expect(preFix.statuses.get(olderId)).toBe(PublicationStatusEnum.PUBLISHED);
    });
});
