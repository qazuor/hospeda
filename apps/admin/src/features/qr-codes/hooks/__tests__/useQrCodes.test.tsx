// @vitest-environment jsdom
/**
 * QR-code hooks — cache invalidation and the delete no-op (HOS-981 PR 3).
 *
 * ## The bug this file exists for
 *
 * Edit a code's colour to red, save, go back to the detail page: the preview was
 * still BLACK for five minutes while "Download SVG" handed over the red one.
 *
 * `invalidateQueries` matches by PREFIX. The preview lives at
 * `['qr-codes', 'preview', id]` — a SIBLING of `['qr-codes', 'detail', id]` and
 * `['qr-codes', 'list']`, not a descendant — so invalidating those two leaves it
 * untouched. With a five-minute `staleTime` and no refetch on focus, it simply
 * stays. That is the divergence `routes/qr-code/admin/download.ts` calls
 * unacceptable in its own header: a code that differs from what the panel showed
 * is a code somebody prints and discovers is wrong once it is on a wall.
 *
 * ## What is asserted, and why it is the effect and not the call
 *
 * A REAL `QueryClient` is seeded with all three queries and the assertion is on
 * `getQueryState(key).isInvalidated` afterwards. Spying on `invalidateQueries`
 * and checking its argument would pass just as happily against two narrow calls
 * that happen to include the right key — this fails the moment somebody narrows
 * the invalidation back to the two child keys.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApiMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ fetchApi: fetchApiMock }));

import { qrCodePreviewKey, qrCodeQueryKeys, useDeleteQrCode, useUpdateQrCode } from '../useQrCodes';

const QR_ID = '11111111-1111-4111-8111-111111111111';

/** The three cache entries a QR detail page has live at once. */
const KEYS = {
    list: [...qrCodeQueryKeys.all, 'list'] as const,
    detail: qrCodeQueryKeys.detail(QR_ID),
    preview: qrCodePreviewKey(QR_ID)
};

function buildClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                // The production settings, because they are half the bug: without
                // them a stale preview would refetch on its own and the defect
                // would be invisible here.
                staleTime: 5 * 60 * 1000,
                refetchOnWindowFocus: false
            },
            mutations: { retry: false }
        }
    });
}

function wrapperFor(client: QueryClient) {
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

/** Seeds the three queries as fresh, non-invalidated cache entries. */
function seedCache(client: QueryClient): void {
    client.setQueryData(KEYS.list, { data: [], total: 0, page: 1, pageSize: 20 });
    client.setQueryData(KEYS.detail, { id: QR_ID });
    client.setQueryData(KEYS.preview, { format: 'SVG', svg: '<svg data-colour="black" />' });
}

const isInvalidated = (client: QueryClient, key: readonly unknown[]): boolean =>
    client.getQueryState([...key])?.isInvalidated === true;

beforeEach(() => {
    fetchApiMock.mockReset();
});

describe('useUpdateQrCode', () => {
    it('PATCHes the code', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { id: QR_ID } }, status: 200 });
        const client = buildClient();
        const { result } = renderHook(() => useUpdateQrCode(), { wrapper: wrapperFor(client) });

        await act(async () => {
            await result.current.mutateAsync({
                id: QR_ID,
                data: { renderOptions: { margin: 8 } }
            });
        });

        expect(fetchApiMock).toHaveBeenCalledWith({
            path: `/api/v1/admin/qr-codes/${QR_ID}`,
            method: 'PATCH',
            body: { renderOptions: { margin: 8 } }
        });
    });

    /**
     * THE REGRESSION PROBE. All three, compared individually so a failure names
     * which cache entry survived.
     */
    it('invalidates the preview as well as the detail and the list', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { id: QR_ID } }, status: 200 });
        const client = buildClient();
        seedCache(client);

        // Instrument check: nothing is invalidated before the mutation, so the
        // assertions below cannot pass on a cache that started that way.
        expect(isInvalidated(client, KEYS.preview)).toBe(false);
        expect(isInvalidated(client, KEYS.detail)).toBe(false);
        expect(isInvalidated(client, KEYS.list)).toBe(false);

        const { result } = renderHook(() => useUpdateQrCode(), { wrapper: wrapperFor(client) });
        await act(async () => {
            await result.current.mutateAsync({ id: QR_ID, data: { targetUrl: 'https://x.test/' } });
        });

        await waitFor(() => {
            // The one that used to survive. Named first and on its own so the
            // failure message says "preview", not "one of three".
            expect(isInvalidated(client, KEYS.preview)).toBe(true);
        });
        expect(isInvalidated(client, KEYS.detail)).toBe(true);
        expect(isInvalidated(client, KEYS.list)).toBe(true);
    });

    /**
     * Non-vacuity for the probe above: the preview key really IS a sibling, so
     * invalidating `detail` alone genuinely leaves it alone. Without this, the
     * test above could be passing because the keys happen to nest.
     */
    it('the preview is a sibling of the detail, not a descendant', async () => {
        const client = buildClient();
        seedCache(client);

        await client.invalidateQueries({ queryKey: KEYS.detail });

        expect(isInvalidated(client, KEYS.detail)).toBe(true);
        expect(isInvalidated(client, KEYS.preview)).toBe(false);
    });
});

describe('useDeleteQrCode', () => {
    it('resolves and invalidates when the row was really deleted', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { success: true } }, status: 200 });
        const client = buildClient();
        seedCache(client);
        const { result } = renderHook(() => useDeleteQrCode(), { wrapper: wrapperFor(client) });

        await act(async () => {
            await result.current.mutateAsync(QR_ID);
        });

        await waitFor(() => expect(isInvalidated(client, KEYS.list)).toBe(true));
    });

    /**
     * A soft delete that matched no row answers `200 {success: false}`. Two
     * operators working from stale lists: the second must not be told they
     * deleted something they never touched, so the hook rejects rather than
     * letting the page toast "deleted" and navigate away.
     */
    it('REJECTS a 200 that reports success: false', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { success: false } }, status: 200 });
        const client = buildClient();
        const { result } = renderHook(() => useDeleteQrCode(), { wrapper: wrapperFor(client) });

        await expect(
            act(async () => {
                await result.current.mutateAsync(QR_ID);
            })
        ).rejects.toThrow();
    });

    it('rejects an answer with no success flag at all', async () => {
        fetchApiMock.mockResolvedValue({ data: {}, status: 200 });
        const client = buildClient();
        const { result } = renderHook(() => useDeleteQrCode(), { wrapper: wrapperFor(client) });

        await expect(
            act(async () => {
                await result.current.mutateAsync(QR_ID);
            })
        ).rejects.toThrow();
    });
});
