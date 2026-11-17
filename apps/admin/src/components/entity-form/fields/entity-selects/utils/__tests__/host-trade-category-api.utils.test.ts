/**
 * @file host-trade-category-api.utils.test.ts
 * @description The provider category picker loads from the ADMIN catalog
 * endpoint (HOS-919 T-045): labels come from `nameI18n`, never the slug, the
 * offered options are the active rows, and a category the provider already has
 * stays resolvable (and therefore selectable) after it was deactivated.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
vi.mock('@/utils/logger', () => ({ adminLogger: { error: vi.fn() } }));

import { fetchApi } from '@/lib/api/client';
import {
    loadAllHostTradeCategories,
    loadHostTradeCategoriesByIds
} from '../host-trade-category-api.utils';

const mockFetch = vi.mocked(fetchApi);

const ACTIVE = {
    id: 'c-1',
    slug: 'plomeria',
    nameI18n: { es: 'Plomería', en: 'Plumbing', pt: 'Encanamento' },
    lifecycleState: 'ACTIVE'
};
const INACTIVE = {
    id: 'c-2',
    slug: 'telegrafia',
    nameI18n: { es: 'Telegrafía', en: 'Telegraphy', pt: 'Telegrafia' },
    lifecycleState: 'INACTIVE'
};

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

describe('host trade category loaders', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('asks the admin endpoint for ACTIVE categories only', async () => {
        mockFetch.mockResolvedValue(page([ACTIVE]));

        await loadAllHostTradeCategories();

        const path = mockFetch.mock.calls[0]?.[0].path ?? '';
        expect(path).toContain('/api/v1/admin/host-trade-categories');
        expect(path).toContain('lifecycleState=ACTIVE');
        expect(path).not.toContain('/public/');
    });

    it('labels options from nameI18n and never from the raw slug', async () => {
        mockFetch.mockResolvedValue(page([ACTIVE]));

        const options = await loadAllHostTradeCategories();

        expect(options).toEqual([expect.objectContaining({ value: 'c-1', label: 'Plomería' })]);
    });

    it('keeps an already-linked inactive category resolvable by id', async () => {
        mockFetch.mockResolvedValue(page([ACTIVE, INACTIVE]));

        const options = await loadHostTradeCategoriesByIds(['c-2']);

        const path = mockFetch.mock.calls[0]?.[0].path ?? '';
        expect(path).not.toContain('lifecycleState=');
        expect(options.map((option) => option.label)).toEqual(['Telegrafía']);
    });

    it('does not call the API for an empty id list', async () => {
        expect(await loadHostTradeCategoriesByIds([])).toEqual([]);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns an empty list when the request fails', async () => {
        mockFetch.mockRejectedValue(new Error('boom'));

        expect(await loadAllHostTradeCategories()).toEqual([]);
    });
});
