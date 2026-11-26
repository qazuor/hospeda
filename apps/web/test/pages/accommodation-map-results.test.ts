import { beforeEach, expect, it, vi } from 'vitest';
import { accommodationsApi } from '@/lib/api/endpoints';

vi.mock('@/lib/api/endpoints', () => ({ accommodationsApi: { list: vi.fn() } }));
const list = vi.mocked(accommodationsApi.list);
const located = { approximateLocation: { lat: -32, lng: -58, radiusMeters: 300 } };
const filters = { q: 'cabaña', checkIn: '2026-12-01', checkOut: '2026-12-05' };
const failure = { ok: false, error: { status: 503, message: 'Unavailable' } } as const;

beforeEach(() => list.mockReset());

it('counts all 150 filtered stays while retaining at most 100 located rows', async () => {
    const { loadAccommodationMapResults } = await import('@/lib/accommodation-map-results');
    list.mockResolvedValueOnce({
        ok: true,
        data: {
            items: Array.from({ length: 100 }, () => located),
            pagination: { totalPages: 2, total: 150 }
        }
    } as Awaited<ReturnType<typeof list>>);
    list.mockResolvedValueOnce({
        ok: true,
        data: {
            items: [
                ...Array.from({ length: 30 }, () => located),
                ...Array.from({ length: 20 }, () => ({}))
            ],
            pagination: { totalPages: 2, total: 150 }
        }
    } as Awaited<ReturnType<typeof list>>);

    const result = await loadAccommodationMapResults({ filters, displayCap: 100 });

    expect(result).toMatchObject({ ok: true, data: { locatedCount: 130, unlocatedCount: 20 } });
    expect(result.ok && result.data.items).toHaveLength(100);
    expect(list.mock.calls).toEqual([
        [{ ...filters, page: 1, pageSize: 100 }],
        [{ ...filters, page: 2, pageSize: 100 }]
    ]);
});

it('never reports partial totals when a later page fails', async () => {
    const { loadAccommodationMapResults } = await import('@/lib/accommodation-map-results');
    list.mockResolvedValueOnce({
        ok: true,
        data: {
            items: [located],
            pagination: { totalPages: 2, total: 101 }
        }
    } as Awaited<ReturnType<typeof list>>).mockResolvedValueOnce(failure);

    const result = await loadAccommodationMapResults({ filters, displayCap: 100 });

    expect(result).toEqual(failure);
});
