import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearWhatsNewCache, useWhatsNew } from '@/hooks/use-whats-new';

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

describe('useWhatsNew', () => {
    beforeEach(() => {
        clearWhatsNewCache();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('parses items from body.data.items (not body.data as array)', async () => {
        const items = [
            {
                id: 'e1',
                title: 'First',
                body: 'Hello',
                publishedAt: '2026-01-01T00:00:00Z',
                highlight: true,
                seen: false
            },
            {
                id: 'e2',
                title: 'Second',
                body: 'World',
                publishedAt: '2026-01-02T00:00:00Z',
                highlight: false,
                seen: true
            }
        ];
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: { items, unseenCount: 1 } }));

        const { result } = renderHook(() => useWhatsNew());

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(result.current.items).toHaveLength(2);
        expect(result.current.items[0].id).toBe('e1');
        expect(result.current.unseenCount).toBe(1);
    });

    it('sends { ids: [...] } in markSeen request body (not entryIds)', async () => {
        const items = [
            {
                id: 'e1',
                title: 'First',
                body: 'Hello',
                publishedAt: '2026-01-01T00:00:00Z',
                highlight: true,
                seen: false
            }
        ];
        vi.mocked(fetch)
            .mockResolvedValueOnce(jsonResponse({ data: { items, unseenCount: 1 } }))
            .mockResolvedValueOnce(jsonResponse({ success: true }));

        const { result } = renderHook(() => useWhatsNew());

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        act(() => {
            result.current.markSeen(['e1']);
        });

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        const patchCall = vi
            .mocked(fetch)
            .mock.calls.find(
                (call) => typeof call[0] === 'string' && call[0].includes('whats-new-seen')
            );
        expect(patchCall).toBeDefined();
        const body = JSON.parse((patchCall?.[1] as RequestInit).body as string);
        expect(body).toEqual({ ids: ['e1'] });
        expect(body).not.toHaveProperty('entryIds');
    });

    it('handles empty items array gracefully', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: { items: [], unseenCount: 0 } }));

        const { result } = renderHook(() => useWhatsNew());

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(result.current.items).toHaveLength(0);
        expect(result.current.unseenCount).toBe(0);
        expect(result.current.isLoading).toBe(false);
    });

    it('computes unseenCount from items where seen is false', async () => {
        const items = [
            {
                id: 'e1',
                title: 'A',
                body: 'a',
                publishedAt: '2026-01-01T00:00:00Z',
                highlight: false,
                seen: true
            },
            {
                id: 'e2',
                title: 'B',
                body: 'b',
                publishedAt: '2026-01-02T00:00:00Z',
                highlight: false,
                seen: false
            },
            {
                id: 'e3',
                title: 'C',
                body: 'c',
                publishedAt: '2026-01-03T00:00:00Z',
                highlight: false,
                seen: false
            }
        ];
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: { items, unseenCount: 2 } }));

        const { result } = renderHook(() => useWhatsNew());

        await act(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });

        expect(result.current.unseenCount).toBe(2);
    });
});
