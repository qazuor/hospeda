import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { EntitlementKeyEnum, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { UnresolvedCoverageSourceError } from '../../src/effective-set/resolve-effective-set';
import type {
    ListingFeaturedPorts,
    ListingFeaturedRow
} from '../../src/featured/listing-featured-types';
import { syncListingFeatured } from '../../src/featured/sync-listing-featured';
import type {
    PlanCatalogReader,
    PlanVersionEffectsRow
} from '../../src/plan-catalog/catalog-reader';
import type { ReconcilerPorts } from '../../src/publication/coverage-reconciler-types';

const sub = (id: string) =>
    CoverageSourceSchema.parse({
        type: 'SUBSCRIPTION',
        reference: { kind: 'PLAN_VERSION', planVersionId: id },
        scope: 'VERTICAL',
        target: null,
        since: new Date('2026-01-01'),
        until: new Date('2027-01-01'),
        charged: true,
        floor: null
    });
const addon = (target: string) =>
    CoverageSourceSchema.parse({
        type: 'ADDON',
        reference: { kind: 'ADDON_VERSION', addonVersionId: 'boost-v1' },
        scope: 'LISTING',
        target,
        since: new Date('2026-01-01'),
        until: new Date('2027-01-01'),
        charged: null,
        floor: null
    });
const rows = (): ListingFeaturedRow[] => ['A', 'B', 'C'].map((id) => ({ id, featured: false }));

function setup(
    options: {
        sources?: ReturnType<typeof sub>[];
        rowSet?: ListingFeaturedRow[];
        unresolved?: boolean;
        trials?: ListingFeaturedPorts['trials'];
    } = {}
) {
    const writes = vi.fn(async () => true);
    const revalidate = vi.fn(async () => {});
    const coverage = vi.fn(async () => ({ covered: true, sources: [...(options.sources ?? [])] }));
    const addonEffects = new Map<string, PlanVersionEffectsRow>([
        [
            'boost-v1',
            {
                entitlements: [
                    {
                        key: EntitlementKeyEnum.FEATURED_LISTING,
                        planQuota: null,
                        aggregationStrategy: 'MAX'
                    }
                ],
                limits: []
            }
        ]
    ]);
    const reader: PlanCatalogReader & { addonEffects: Map<string, PlanVersionEffectsRow> } = {
        addonEffects,
        async findPlanVersion() {
            return null;
        },
        async findPlanVersionEffects({ id }) {
            return id === 'trial-v1' || id === 'floor-v1'
                ? { entitlements: [], limits: [] }
                : id === 'pro-v1'
                  ? {
                        entitlements: [
                            {
                                key: EntitlementKeyEnum.FEATURED_LISTING,
                                planQuota: null,
                                aggregationStrategy: 'MAX'
                            },
                            { key: 'write_reviews', planQuota: null, aggregationStrategy: 'MAX' }
                        ],
                        limits: [
                            { key: 'max_accommodations', value: 5, aggregationStrategy: 'MAX' }
                        ]
                    }
                  : {
                        entitlements: [
                            { key: 'write_reviews', planQuota: null, aggregationStrategy: 'MAX' }
                        ],
                        limits: [
                            { key: 'max_accommodations', value: 2, aggregationStrategy: 'MAX' }
                        ]
                    };
        },
        async findPlanVersionSummary({ id }) {
            return options.unresolved && id === 'broken-v1'
                ? null
                : {
                      id,
                      planId: id,
                      vertical: VerticalEnum.ACCOMMODATION,
                      rank: 1,
                      sellable: true,
                      current: true
                  };
        },
        async findSellableCurrentVersions() {
            return [];
        },
        async findCurrentPlanVersion({ planId }) {
            return planId === 'trial-v1'
                ? {
                      id: 'trial-v1',
                      planId,
                      vertical: VerticalEnum.ACCOMMODATION,
                      rank: 1,
                      sellable: false,
                      current: true
                  }
                : null;
        },
        async findAddonVersion({ id }) {
            return { addonId: id, validity: 'FIXED_DAYS', validityDays: 30, scopeType: 'LISTING' };
        },
        async findAddonVersionEffects({ id }) {
            return this.addonEffects.get(id) ?? { entitlements: [], limits: [] };
        }
    };
    const ports: ListingFeaturedPorts = {
        billing: { coverage },
        reader,
        trials: { findTrial: async () => null },
        unitOfWork: {
            runLocked: async (_args, work) =>
                work({
                    listOwnerListings: async () => options.rowSet ?? rows(),
                    setFeatured: writes
                })
        },
        ...(options.trials ? { trials: options.trials } : {}),
        afterCommit: { revalidate }
    };
    return { ports, writes, revalidate, coverage, reader };
}

const sync = (ports: ListingFeaturedPorts) =>
    syncListingFeatured({ ports, userId: 'owner', vertical: VerticalEnum.ACCOMMODATION });

describe('HOS-1718 a plan that grants featured_listing features every listing of the owner', () => {
    it("a live subscription to a plan with featured_listing features all the owner's listings", async () => {
        const h = setup({ sources: [sub('pro-v1')] });
        const result = await sync(h.ports);
        expect(result.featuredOn).toEqual(['A', 'B', 'C']);
        expect(h.revalidate).toHaveBeenCalledWith({
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: ['A', 'B', 'C']
        });
    });
    it('a plan without featured_listing features nothing', async () => {
        const h = setup({ sources: [sub('basic-v1')] });
        await sync(h.ports);
        expect(h.writes).toHaveBeenCalledTimes(0);
    });
    it('when the plan lapses only the boosted listing stays featured', async () => {
        const h = setup({
            sources: [addon('B')],
            rowSet: ['A', 'B', 'C'].map((id) => ({ id, featured: true }))
        });
        const result = await sync(h.ports);
        expect(result.featuredOff).toEqual(['A', 'C']);
        expect(h.writes).toHaveBeenCalledTimes(2);
    });
    it('plan and boost read coverage once', async () => {
        const h = setup({ sources: [sub('pro-v1'), addon('A')] });
        await sync(h.ports);
        expect(h.coverage).toHaveBeenCalledTimes(1);
        expect(h.writes).toHaveBeenCalledTimes(3);
    });
    it('a trial whose plan lacks featured_listing features nothing', async () => {
        const source = CoverageSourceSchema.parse({
            type: 'TRIAL',
            reference: { kind: 'PLAN_VERSION', planVersionId: 'trial-v1' },
            scope: 'VERTICAL',
            target: null,
            since: new Date('2026-01-01'),
            until: new Date('2026-12-01'),
            charged: null,
            floor: null
        });
        const trialReader: ListingFeaturedPorts['trials'] = {
            findTrial: async () => ({
                userId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION,
                status: TrialStatusEnum.TRIAL_ACTIVE,
                trialPlanId: 'trial-v1',
                startedAt: new Date('2026-01-01'),
                endsAt: new Date('2026-12-01'),
                floor: {
                    entitlementsVersionId: 'floor-v1',
                    limitsVersionId: 'floor-v1',
                    trialPlanVersionId: 'floor-v1'
                }
            })
        };
        const withTrial = setup({ sources: [source], trials: trialReader });
        await sync(withTrial.ports);
        expect(withTrial.writes).toHaveBeenCalledTimes(0);
    });
    it('a plan that cannot be resolved fails the sync and writes nothing', async () => {
        const h = setup({ sources: [sub('broken-v1')], unresolved: true });
        await expect(sync(h.ports)).rejects.toThrow(UnresolvedCoverageSourceError);
        expect(h.writes).toHaveBeenCalledTimes(0);
        expect(h.revalidate).toHaveBeenCalledTimes(0);
    });
    it('the plan term is mandatory in the ports', async () => {
        const h = setup();
        // @ts-expect-error HOS-1718 c3: ports without `trials` must not compile.
        const missingTrials: ListingFeaturedPorts = {
            billing: h.ports.billing,
            reader: h.reader,
            unitOfWork: h.ports.unitOfWork,
            afterCommit: h.ports.afterCommit
        };
        // @ts-expect-error HOS-1718 c3: the reconciler's featured port must carry `trials`.
        const featuredWithoutTrials: NonNullable<ReconcilerPorts['featured']> = {
            reader: h.reader,
            unitOfWork: h.ports.unitOfWork
        };
        expect(Boolean(missingTrials) || Boolean(featuredWithoutTrials)).toBe(true);
    });
});
