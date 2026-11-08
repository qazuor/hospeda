/**
 * @file catalog-vertical-scope.test.ts
 * @description The admin amenity/feature pickers offer only the catalog rows
 * that apply to the form's vertical (HOS-2061 AC-4), while label resolution
 * for already-linked ids stays unscoped.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
vi.mock('@/utils/logger', () => ({ adminLogger: { error: vi.fn() } }));

import { fetchApi } from '@/lib/api/client';
import { loadAllAmenities, loadAmenitiesByIds } from '../amenity-api.utils';
import { loadAllFeatures } from '../feature-api.utils';

const mockFetch = vi.mocked(fetchApi);

function page(items: readonly Record<string, unknown>[]) {
    return {
        data: {
            data: {
                items,
                pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 }
            }
        }
    } as never;
}

const CATALOG = [
    { id: 'a-1', slug: 'wifi', applicableVerticals: ['accommodation', 'venue', 'experience'] },
    { id: 'a-2', slug: 'crib', applicableVerticals: ['accommodation'] },
    { id: 'a-3', slug: 'outdoor_tables', applicableVerticals: ['venue'] }
];

describe('admin catalog loaders — vertical scope (HOS-2061 AC-4)', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(page(CATALOG));
    });

    it('offers only the amenities applicable to the requested vertical', async () => {
        const options = await loadAllAmenities({ applicableVertical: 'venue' });

        expect(options.map((option) => option.value)).toEqual(['a-1', 'a-3']);
    });

    it('scopes accommodation forms too', async () => {
        const options = await loadAllAmenities({ applicableVertical: 'accommodation' });

        expect(options.map((option) => option.value)).toEqual(['a-1', 'a-2']);
    });

    it('offers the whole catalog when no vertical is given', async () => {
        const options = await loadAllAmenities();

        expect(options).toHaveLength(3);
    });

    it('scopes features the same way', async () => {
        const options = await loadAllFeatures({ applicableVertical: 'experience' });

        expect(options.map((option) => option.value)).toEqual(['a-1']);
    });

    it('still labels an already-linked id outside the vertical', async () => {
        const options = await loadAmenitiesByIds(['a-2']);

        expect(options.map((option) => option.value)).toEqual(['a-2']);
    });
});
