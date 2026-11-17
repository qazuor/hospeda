/**
 * HOS-2184 T-038 — `list_amenities_and_features`: the catalog of one vertical
 * through the services behind the public catalog endpoints. The services are
 * spied on their prototypes and answer from a dataset that honours
 * `applicableVertical` the way the real `search` does.
 *
 * @module test/mcp/tools/listing/list-amenities-and-features
 */

import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, AmenityService, FeatureService } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
    CATALOG_PAGE_SIZE,
    listAmenitiesAndFeaturesTool
} from '../../../../src/mcp/tools/listing/list-amenities-and-features';
import { runTool } from '../../../../src/mcp/tools/run-tool';

const context = { channel: 'mcp' } as const;
const actor = {
    id: '1f2e3d4c-5b6a-4789-8abc-def012345678',
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;

interface Row {
    readonly id: string;
    readonly slug: string;
    readonly applicableVerticals: readonly string[];
    /** Amenity `type`. */
    readonly type?: string;
    /** Feature `category`. */
    readonly category?: string;
}

const AMENITIES: readonly Row[] = [
    {
        id: 'a0000000-0000-4000-8000-000000000001',
        slug: 'wifi',
        applicableVerticals: ['accommodation', 'venue']
    },
    {
        id: 'a0000000-0000-4000-8000-000000000002',
        slug: 'pool',
        applicableVerticals: ['accommodation']
    },
    {
        id: 'a0000000-0000-4000-8000-000000000003',
        slug: 'zz_unknown_amenity',
        applicableVerticals: ['experience'],
        type: 'OUTDOORS'
    }
];
const FEATURES: readonly Row[] = [
    {
        id: 'f0000000-0000-4000-8000-000000000001',
        slug: 'pet_friendly',
        applicableVerticals: ['accommodation', 'venue']
    },
    {
        id: 'f0000000-0000-4000-8000-000000000002',
        slug: 'river_view',
        applicableVerticals: ['accommodation', 'experience'],
        category: 'VIEW'
    }
];

const scoped = (rows: readonly Row[], vertical: unknown) =>
    rows.filter((row) => row.applicableVerticals.includes(vertical as string));

describe('list_amenities_and_features', () => {
    let amenitySearch: MockInstance<AmenityService['search']>;
    let featureSearch: MockInstance<FeatureService['search']>;

    beforeEach(() => {
        amenitySearch = vi
            .spyOn(AmenityService.prototype, 'search')
            .mockImplementation(async (_actor, params) => {
                const items = scoped(
                    AMENITIES,
                    (params as { applicableVertical?: string }).applicableVertical
                );
                return { data: { items, total: items.length } } as never;
            });
        featureSearch = vi
            .spyOn(FeatureService.prototype, 'search')
            .mockImplementation(async (_actor, params) => {
                const items = scoped(
                    FEATURES,
                    (params as { applicableVertical?: string }).applicableVertical
                );
                return { data: { items, total: items.length } } as never;
            });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is a read-only tool available to unverified emails as READ_OWN', () => {
        expect(listAmenitiesAndFeaturesTool.name).toBe('list_amenities_and_features');
        expect(listAmenitiesAndFeaturesTool.isWrite).toBe(false);
        expect(listAmenitiesAndFeaturesTool.emailUnverifiedOperation).toBe('READ_OWN');
    });

    it('tells the model that update_listing_basic replaces the set', () => {
        expect(listAmenitiesAndFeaturesTool.description).toContain('update_listing_basic');
        expect(listAmenitiesAndFeaturesTool.description).toContain('REPLACES');
        expect(listAmenitiesAndFeaturesTool.description).toContain('get_listing');
    });

    it('scopes both catalogs to the requested vertical', async () => {
        // Act
        const outcome = await runTool({
            definition: listAmenitiesAndFeaturesTool,
            actor,
            input: { vertical: 'accommodation' },
            context
        });

        // Assert
        expect(amenitySearch).toHaveBeenCalledWith(
            actor,
            expect.objectContaining({
                applicableVertical: 'accommodation',
                pageSize: CATALOG_PAGE_SIZE
            })
        );
        expect(featureSearch).toHaveBeenCalledWith(
            actor,
            expect.objectContaining({ applicableVertical: 'accommodation' })
        );
        expect(outcome.ok && outcome.data.amenities.map((a) => a.slug)).toEqual(['pool', 'wifi']);
        expect(outcome.ok && outcome.data.features.map((f) => f.slug)).toEqual([
            'pet_friendly',
            'river_view'
        ]);
    });

    it.each([
        ['venue', ['wifi'], ['pet_friendly']],
        ['experience', ['zz_unknown_amenity'], ['river_view']]
    ])('returns only the %s rows', async (vertical, amenities, features) => {
        // Act
        const outcome = await runTool({
            definition: listAmenitiesAndFeaturesTool,
            actor,
            input: { vertical },
            context
        });

        // Assert
        expect(outcome.ok && outcome.data.amenities.map((a) => a.slug)).toEqual(amenities);
        expect(outcome.ok && outcome.data.features.map((f) => f.slug)).toEqual(features);
    });

    it('returns Spanish names, falls back to the humanized slug, sorted by name', async () => {
        // Act
        const outcome = await runTool({
            definition: listAmenitiesAndFeaturesTool,
            actor,
            input: { vertical: 'experience' },
            context
        });

        // Assert
        expect(outcome.ok && outcome.data.amenities).toEqual([
            {
                id: 'a0000000-0000-4000-8000-000000000003',
                slug: 'zz_unknown_amenity',
                name: 'Zz unknown amenity',
                category: 'OUTDOORS'
            }
        ]);
        const accommodation = await runTool({
            definition: listAmenitiesAndFeaturesTool,
            actor,
            input: { vertical: 'accommodation' },
            context
        });
        const names = accommodation.ok ? accommodation.data.amenities.map((a) => a.name) : [];
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
        // A key that exists resolves to its translation, never the raw slug.
        expect(names).toContain('Pileta');
        expect(names).not.toContain('wifi');
        expect(names).not.toContain('pool');
    });

    it('adds the category of each entry: type for amenities, category for features', async () => {
        // Act
        const outcome = await runTool({
            definition: listAmenitiesAndFeaturesTool,
            actor,
            input: { vertical: 'experience' },
            context
        });

        // Assert
        expect(outcome.ok && outcome.data.amenities.map((a) => a.category)).toEqual(['OUTDOORS']);
        expect(outcome.ok && outcome.data.features.map((f) => f.category)).toEqual(['VIEW']);
    });

    it('reads every page of a catalog larger than one page', async () => {
        // Arrange
        const big = Array.from({ length: 130 }, (_, i) => ({
            id: `a${String(i).padStart(7, '0')}-0000-4000-8000-000000000000`,
            slug: `amenity_${i}`
        }));
        amenitySearch.mockImplementation(async (_actor, params) => {
            const { page } = params as { page: number };
            const items = big.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE);
            return { data: { items, total: big.length } } as never;
        });

        // Act
        const outcome = await runTool({
            definition: listAmenitiesAndFeaturesTool,
            actor,
            input: { vertical: 'accommodation' },
            context
        });

        // Assert
        expect(amenitySearch).toHaveBeenCalledTimes(2);
        expect(outcome.ok && outcome.data.amenities).toHaveLength(130);
    });

    it('fails the call when a catalog read fails', async () => {
        // Arrange
        featureSearch.mockResolvedValue({
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'boom' }
        } as never);

        // Act
        const outcome = await runTool({
            definition: listAmenitiesAndFeaturesTool,
            actor,
            input: { vertical: 'venue' },
            context
        });

        // Assert
        expect(outcome.ok).toBe(false);
    });

    it('rejects an unknown vertical and extra fields', async () => {
        for (const input of [{ vertical: 'tourist' }, { vertical: 'venue', extra: 1 }, {}]) {
            const outcome = await runTool({
                definition: listAmenitiesAndFeaturesTool,
                actor,
                input,
                context
            });
            expect(outcome.ok).toBe(false);
        }
    });
});
