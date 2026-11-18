/**
 * HOS-2336 AC-4.2: the partner list filter loads every partner type, in every
 * lifecycle state, as slug values.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
vi.mock('@/utils/logger', () => ({ adminLogger: { error: vi.fn() } }));

import { fetchApi } from '@/lib/api/client';
import { loadPartnerTypeFilterOptions } from '../partner-type-api.utils';

const mockFetch = vi.mocked(fetchApi);

const rows = [
    { id: '1', slug: 'media', nameI18n: { es: 'Medio' }, lifecycleState: 'ACTIVE' },
    { id: '2', slug: 'legacy', nameI18n: { es: '' }, lifecycleState: 'INACTIVE' }
];

describe('loadPartnerTypeFilterOptions', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('maps every lifecycle state to slug values from the admin endpoint', async () => {
        mockFetch.mockResolvedValue({ data: { data: { items: rows } }, status: 200 } as never);

        expect(await loadPartnerTypeFilterOptions()).toEqual([
            { value: 'media', label: 'Medio' },
            { value: 'legacy', label: 'legacy' }
        ]);
        expect(mockFetch).toHaveBeenCalledWith({
            path: '/api/v1/admin/partner-types?page=1&pageSize=100',
            method: 'GET'
        });
    });

    it('returns an empty list when the request fails', async () => {
        mockFetch.mockRejectedValue(new Error('boom'));

        expect(await loadPartnerTypeFilterOptions()).toEqual([]);
    });
});
