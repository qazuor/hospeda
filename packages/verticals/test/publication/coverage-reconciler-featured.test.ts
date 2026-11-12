import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { EntitlementKeyEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { runDailyCoverageReconciler } from '../../src/publication/coverage-reconciler';
import type { ReconcilerPorts } from '../../src/publication/coverage-reconciler-types';

const source = CoverageSourceSchema.parse({
    type: 'ADDON',
    reference: { kind: 'ADDON_VERSION', addonVersionId: 'boost-v1' },
    scope: 'LISTING',
    target: 'A',
    since: new Date('2026-01-01T00:00:00Z'),
    until: new Date('2026-12-31T00:00:00Z'),
    charged: null,
    floor: null
});
const planSource = CoverageSourceSchema.parse({
    type: 'SUBSCRIPTION',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'pro-v1' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2026-01-01'),
    until: new Date('2027-01-01'),
    charged: true,
    floor: null
});

function harness(
    featured = false,
    failSet = false,
    published = 0,
    failPublication = false,
    coverageSource = source,
    listingFeatured = false
) {
    const ping = vi.fn(async () => {});
    const revalidate = vi.fn(async () => {});
    const setFeatured = vi.fn(async () => {
        if (failSet) throw new Error('featured write failed');
        return true;
    });
    const ports: ReconcilerPorts = {
        population: {
            listOwnerVerticals: async () => ({
                items: [{ userId: 'owner', vertical: VerticalEnum.ACCOMMODATION }],
                next: null
            }),
            listPartnerUsers: async () => ({ items: [], next: null })
        },
        reader: {
            summarize: async () => ({
                published,
                unpublishedByBilling: 0,
                archived: 0,
                archivedReturnable: 0
            })
        },
        liveLimit: async () => 2,
        billing: { coverage: async () => ({ covered: true, sources: [coverageSource] }) },
        presence: {
            liveKeys: async () => [],
            cachedKeys: async () => null,
            invalidate: async () => {}
        },
        unitOfWork: {
            runLocked: vi.fn(async () => {
                if (failPublication) throw new Error('publication recalculation reached');
                throw new Error('publication reconciliation was not expected');
            })
        },
        afterCommit: {
            emitCoverageChanged: async () => {},
            invalidateUser: async () => {},
            revalidate
        },
        clock: { now: () => new Date('2026-10-11T00:00:00Z') },
        monitor: { ping },
        ...(featured
            ? {
                  featured: {
                      reader: {
                          async findPlanVersion() {
                              return null;
                          },
                          async findPlanVersionEffects() {
                              return {
                                  entitlements: [
                                      {
                                          key: EntitlementKeyEnum.FEATURED_LISTING,
                                          planQuota: null,
                                          aggregationStrategy: 'MAX' as const
                                      }
                                  ],
                                  limits: []
                              };
                          },
                          async findPlanVersionSummary() {
                              return {
                                  id: 'pro-v1',
                                  planId: 'pro',
                                  vertical: VerticalEnum.ACCOMMODATION,
                                  rank: 1,
                                  sellable: true,
                                  current: true
                              };
                          },
                          async findSellableCurrentVersions() {
                              return [];
                          },
                          async findCurrentPlanVersion() {
                              return null;
                          },
                          async findAddonVersion() {
                              return null;
                          },
                          findAddonVersionEffects: async () => ({
                              entitlements: [
                                  {
                                      key: EntitlementKeyEnum.FEATURED_LISTING,
                                      aggregationStrategy: 'MAX' as const
                                  }
                              ],
                              limits: []
                          })
                      },
                      unitOfWork: {
                          runLocked: async (_key, work) =>
                              work({
                                  listOwnerListings: async () => [
                                      { id: 'A', featured: listingFeatured }
                                  ],
                                  setFeatured
                              })
                      }
                  }
              }
            : {})
    };
    return { ports, ping, setFeatured, revalidate };
}

describe('HOS-1718 the daily reconciler is the net for the listing featured flag', () => {
    it('runs the featured sync for a pair whose publication needs nothing', async () => {
        // Arrange
        const h = harness(true);
        // Act
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        // Assert
        expect(h.setFeatured).toHaveBeenCalledTimes(1);
        expect(h.revalidate).toHaveBeenCalledWith({
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: ['A']
        });
        expect(result.featuredChanged).toBe(1);
        expect(result.ran).toBe(0);
    });

    it('a featured sync failure is a reconciler failure and skips the ping', async () => {
        // Arrange
        const h = harness(true, true);
        // Act
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        // Assert
        expect(result.failures).toMatchObject([
            { userId: 'owner', vertical: VerticalEnum.ACCOMMODATION }
        ]);
        expect(result.complete).toBe(false);
        expect(h.ping).toHaveBeenCalledTimes(0);
    });

    it('a featured sync failure still starts publication recalculation for the pair', async () => {
        // Arrange
        const h = harness(true, true, 3, true);
        // Act
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        // Assert
        expect(h.ports.unitOfWork.runLocked).toHaveBeenCalledTimes(1);
        expect(result.failures).toMatchObject([
            { userId: 'owner', vertical: VerticalEnum.ACCOMMODATION },
            { userId: 'owner', vertical: VerticalEnum.ACCOMMODATION }
        ]);
        expect(result.complete).toBe(false);
    });

    it('without the featured port the summary keeps its old shape', async () => {
        // Arrange
        const h = harness();
        // Act
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        // Assert
        expect(result).toEqual({
            pairsRead: 1,
            ran: 0,
            lowered: 0,
            restored: 0,
            partnerChecked: 0,
            partnerInvalidated: 0,
            failures: [],
            complete: true,
            pinged: true
        });
    });

    it('the nightly pass keeps a plan-featured listing on', async () => {
        // Arrange
        const h = harness(true, false, 0, false, planSource, true);
        // Act
        const result = await runDailyCoverageReconciler({ ports: h.ports });
        // Assert
        expect(h.setFeatured).toHaveBeenCalledTimes(0);
        expect(result.featuredChanged).toBe(0);
    });
});
