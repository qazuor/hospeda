/**
 * HOS-2327 — `readVerticalCatalog`: the catalog of one kind scoped to one
 * vertical through the service's `applicableVertical` filter, every page read,
 * the category taken from `type` (amenity) or `category` (feature).
 *
 * @module test/mcp/tools/listing/catalog-reader
 */

import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { type Actor, AmenityService, FeatureService } from '@repo/service-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CATALOG_PAGE_SIZE,
    readVerticalCatalog
} from '../../../../src/mcp/tools/listing/catalog-reader';

const actor = { id: 'u', roles: ['HOST'], permissions: [] } as unknown as Actor;

describe('readVerticalCatalog', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE,
        VerticalEnum.EXPERIENCE
    ] as const)('asks the amenity service for the %s rows only', async (vertical) => {
        // Arrange
        const search = vi
            .spyOn(AmenityService.prototype, 'search')
            .mockResolvedValue({ data: { items: [], total: 0 } } as never);

        // Act
        await readVerticalCatalog({ actor, vertical, kind: 'amenity' });

        // Assert
        expect(search).toHaveBeenCalledWith(
            actor,
            expect.objectContaining({ applicableVertical: vertical, pageSize: CATALOG_PAGE_SIZE })
        );
    });

    it('asks the feature service, not the amenity one, for a feature catalog', async () => {
        // Arrange
        const amenities = vi.spyOn(AmenityService.prototype, 'search');
        const features = vi
            .spyOn(FeatureService.prototype, 'search')
            .mockResolvedValue({ data: { items: [], total: 0 } } as never);

        // Act
        await readVerticalCatalog({ actor, vertical: VerticalEnum.VENUE, kind: 'feature' });

        // Assert
        expect(features).toHaveBeenCalledWith(
            actor,
            expect.objectContaining({ applicableVertical: 'venue' })
        );
        expect(amenities).not.toHaveBeenCalled();
    });

    it('takes the category from `type` for an amenity and `category` for a feature', async () => {
        // Arrange
        vi.spyOn(AmenityService.prototype, 'search').mockResolvedValue({
            data: { items: [{ id: 'a1', slug: 'oven', type: 'KITCHEN' }], total: 1 }
        } as never);
        vi.spyOn(FeatureService.prototype, 'search').mockResolvedValue({
            data: { items: [{ id: 'f1', slug: 'river_view', category: 'VIEW' }], total: 1 }
        } as never);

        // Act
        const amenities = await readVerticalCatalog({
            actor,
            vertical: VerticalEnum.ACCOMMODATION,
            kind: 'amenity'
        });
        const features = await readVerticalCatalog({
            actor,
            vertical: VerticalEnum.ACCOMMODATION,
            kind: 'feature'
        });

        // Assert
        expect(amenities.rows).toEqual([{ id: 'a1', slug: 'oven', category: 'KITCHEN' }]);
        expect(features.rows).toEqual([{ id: 'f1', slug: 'river_view', category: 'VIEW' }]);
    });

    it('reads every page', async () => {
        // Arrange
        const all = Array.from({ length: CATALOG_PAGE_SIZE + 30 }, (_, i) => ({
            id: `a${i}`,
            slug: `s${i}`,
            type: 'KITCHEN'
        }));
        vi.spyOn(AmenityService.prototype, 'search').mockImplementation((async (
            _actor: Actor,
            params: { page: number }
        ) => ({
            data: {
                items: all.slice(
                    (params.page - 1) * CATALOG_PAGE_SIZE,
                    params.page * CATALOG_PAGE_SIZE
                ),
                total: all.length
            }
        })) as never);

        // Act
        const result = await readVerticalCatalog({
            actor,
            vertical: VerticalEnum.VENUE,
            kind: 'amenity'
        });

        // Assert
        expect(result.rows).toHaveLength(all.length);
    });

    it('fails the whole read on a service error, never a partial catalog', async () => {
        // Arrange
        vi.spyOn(AmenityService.prototype, 'search').mockResolvedValue({
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'db down' }
        } as never);

        // Act
        const result = await readVerticalCatalog({
            actor,
            vertical: VerticalEnum.VENUE,
            kind: 'amenity'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.rows).toBeUndefined();
    });
});
