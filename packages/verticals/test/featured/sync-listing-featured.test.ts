import { CoverageSourceSchema } from '@repo/billing-verticals-contract';
import { EntitlementKeyEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type {
    ListingFeaturedPorts,
    ListingFeaturedRow
} from '../../src/featured/listing-featured-types';
import { syncListingFeatured } from '../../src/featured/sync-listing-featured';

const listingSource = (target: string, version = 'boost-v1') =>
    CoverageSourceSchema.parse({
        type: 'ADDON',
        reference: { kind: 'ADDON_VERSION', addonVersionId: version },
        scope: 'LISTING',
        target,
        since: new Date('2026-01-01T00:00:00Z'),
        until: new Date('2026-12-31T00:00:00Z'),
        charged: null,
        floor: null
    });
const scopedSource = (scope: 'VERTICAL' | 'USER' | 'GLOBAL') =>
    CoverageSourceSchema.parse({
        type: 'ADDON',
        reference: { kind: 'ADDON_VERSION', addonVersionId: 'boost-v1' },
        scope,
        target: null,
        since: new Date('2026-01-01T00:00:00Z'),
        until: new Date('2026-12-31T00:00:00Z'),
        charged: null,
        floor: null
    });

function harness(
    options: {
        rows?: readonly ListingFeaturedRow[];
        sources?: readonly ReturnType<typeof listingSource>[];
        cas?: boolean;
        reader?: boolean;
    } = {}
) {
    const calls: string[] = [];
    const rows = options.rows ?? [
        { id: 'A', featured: false },
        { id: 'B', featured: false }
    ];
    const revalidate = vi.fn(
        async (args: {
            vertical: typeof VerticalEnum.ACCOMMODATION;
            listingIds: readonly string[];
        }) => {
            calls.push('revalidate');
            expect(args.listingIds).toEqual(args.listingIds);
        }
    );
    const findAddonVersionEffects = vi.fn(async ({ id }: { id: string }) => ({
        entitlements:
            id === 'boost-v1'
                ? [
                      {
                          key: EntitlementKeyEnum.FEATURED_LISTING,
                          aggregationStrategy: 'MAX' as const
                      }
                  ]
                : id === 'brand-v1'
                  ? [{ key: 'custom_branding', aggregationStrategy: 'MAX' as const }]
                  : [],
        limits:
            id === 'limit-v1'
                ? [{ key: 'photos', value: 5, aggregationStrategy: 'MAX' as const }]
                : []
    }));
    const ports: ListingFeaturedPorts = {
        billing: {
            coverage: vi.fn(async () => {
                calls.push('coverage');
                return { covered: true, sources: [...(options.sources ?? [])] };
            })
        },
        reader: options.reader === false ? {} : { findAddonVersionEffects },
        unitOfWork: {
            runLocked: async (_key, work) => {
                calls.push('lock');
                const result = await work({
                    listOwnerListings: async () => {
                        calls.push('list');
                        return rows;
                    },
                    setFeatured: async ({ listingId, to }) => {
                        calls.push(`set:${listingId}:${to}`);
                        return options.cas ?? true;
                    }
                });
                calls.push('unlock');
                return result;
            }
        },
        afterCommit: { revalidate }
    };
    return { ports, calls, revalidate, findAddonVersionEffects };
}

describe('HOS-1718 a live LISTING boost features its listing and nothing else', () => {
    it('a live LISTING addon granting featured_listing features its listing', async () => {
        // Arrange
        const h = harness({ sources: [listingSource('A')] });
        // Act
        const result = await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(result.featuredOn).toEqual(['A']);
        expect(result.featuredOff).toEqual([]);
        expect(h.calls).toContain('set:A:true');
        expect(h.revalidate).toHaveBeenCalledWith({
            vertical: VerticalEnum.ACCOMMODATION,
            listingIds: ['A']
        });
    });

    it('a listing loses the flag when no live boost targets it', async () => {
        // Arrange
        const h = harness({ rows: [{ id: 'A', featured: true }], sources: [] });
        // Act
        const result = await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(result.featuredOff).toEqual(['A']);
    });

    it('a LISTING addon that does not grant featured_listing features nothing', async () => {
        // Arrange
        const h = harness({
            sources: [listingSource('A', 'limit-v1'), listingSource('A', 'brand-v1')]
        });
        // Act
        const result = await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(result.featuredOn).toEqual([]);
        expect(h.revalidate).toHaveBeenCalledTimes(0);
    });

    it.each([
        'VERTICAL',
        'USER',
        'GLOBAL'
    ] as const)('a featured_listing grant with %s scope features no listing', async (scope) => {
        // Arrange
        const h = harness({ sources: [scopedSource(scope)] });
        // Act
        const result = await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(result.featuredOn).toEqual([]);
        expect(h.findAddonVersionEffects).toHaveBeenCalledTimes(0);
    });

    it('a target outside the owner listings is never written', async () => {
        // Arrange
        const h = harness({ sources: [listingSource('X')] });
        // Act
        const result = await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(result.featuredOn).toEqual([]);
        expect(h.calls).toEqual(['lock', 'coverage', 'list', 'unlock']);
    });

    it('a listing already in the wanted state is neither written nor revalidated', async () => {
        // Arrange
        const h = harness({
            rows: [
                { id: 'A', featured: true },
                { id: 'B', featured: false }
            ],
            sources: [listingSource('A')]
        });
        // Act
        await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(h.calls.filter((call) => call.startsWith('set:'))).toEqual([]);
        expect(h.revalidate).toHaveBeenCalledTimes(0);
    });

    it('coverage is read inside the lock and revalidation runs after it', async () => {
        // Arrange
        const h = harness({ rows: [{ id: 'A', featured: false }], sources: [listingSource('A')] });
        // Act
        await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(h.calls).toEqual(['lock', 'coverage', 'list', 'set:A:true', 'unlock', 'revalidate']);
    });

    it('a lost compare-and-set is not reported nor revalidated', async () => {
        // Arrange
        const h = harness({
            rows: [{ id: 'A', featured: false }],
            sources: [listingSource('A')],
            cas: false
        });
        // Act
        const result = await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(result.featuredOn).toEqual([]);
        expect(h.revalidate).toHaveBeenCalledTimes(0);
    });

    it('two boosts on one listing and one boost on two calls read the version once', async () => {
        // Arrange
        const h = harness({
            rows: [
                { id: 'A', featured: false },
                { id: 'B', featured: false }
            ],
            sources: [listingSource('A'), listingSource('B')]
        });
        // Act
        const result = await syncListingFeatured({
            ports: h.ports,
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        // Assert
        expect(h.findAddonVersionEffects).toHaveBeenCalledTimes(1);
        expect(result.featuredOn).toEqual(['A', 'B']);
    });

    it('a reader without findAddonVersionEffects fails loudly', async () => {
        // Arrange
        const h = harness({
            rows: [{ id: 'A', featured: false }],
            sources: [listingSource('A')],
            reader: false
        });
        // Act / Assert
        await expect(
            syncListingFeatured({
                ports: h.ports,
                userId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION
            })
        ).rejects.toThrow(/findAddonVersionEffects/);
    });
});
