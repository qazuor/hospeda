// @vitest-environment jsdom
/**
 * HOS-2679 — the tag and campaign hooks of the admin QR list.
 *
 * Same method as `useQrCodes.test.tsx`: a REAL QueryClient, assertions on
 * `isInvalidated` (the effect) rather than on `invalidateQueries` (the call),
 * and on the exact request each mutation sends.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchApiMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ fetchApi: fetchApiMock }));

import { qrCodeQueryKeys } from '../useQrCodes';
import {
    qrCodeTagQueryKeys,
    useCreateQrCodeTag,
    useDeleteQrCodeTag,
    useQrCodeCampaigns,
    useQrCodeTagCatalog,
    useSetQrCodeTags,
    useUpdateQrCodeTag
} from '../useQrCodeTags';

const QR_ID = '11111111-1111-4111-8111-111111111111';
const TAG_ID = '22222222-2222-4222-8222-222222222222';
const LIST_KEY = [...qrCodeQueryKeys.all, 'list'] as const;

function buildClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
            mutations: { retry: false }
        }
    });
}

function wrapperFor(client: QueryClient) {
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

const isInvalidated = (client: QueryClient, key: readonly unknown[]): boolean =>
    client.getQueryState([...key])?.isInvalidated === true;

beforeEach(() => {
    fetchApiMock.mockReset();
});

describe('query keys', () => {
    it('live under the QR root, so the root invalidation reaches them', () => {
        for (const key of [
            qrCodeTagQueryKeys.catalog(),
            qrCodeTagQueryKeys.campaigns(),
            qrCodeTagQueryKeys.tagsOf(QR_ID)
        ]) {
            expect(key.slice(0, qrCodeQueryKeys.all.length)).toStrictEqual([
                ...qrCodeQueryKeys.all
            ]);
        }
    });
});

describe('reads', () => {
    it('loads one catalog page of 100', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { items: [{ id: TAG_ID }] } } });
        const client = buildClient();

        const { result } = renderHook(() => useQrCodeTagCatalog(), { wrapper: wrapperFor(client) });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(fetchApiMock).toHaveBeenCalledWith({
            path: '/api/v1/admin/qr-code-tags?page=1&pageSize=100'
        });
        expect(result.current.data).toStrictEqual([{ id: TAG_ID }]);
    });

    it('loads the campaigns', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { items: ['verano'] } } });
        const client = buildClient();

        const { result } = renderHook(() => useQrCodeCampaigns(), { wrapper: wrapperFor(client) });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(fetchApiMock).toHaveBeenCalledWith({ path: '/api/v1/admin/qr-codes/campaigns' });
        expect(result.current.data).toStrictEqual(['verano']);
    });
});

describe('useSetQrCodeTags', () => {
    it('PUTs the whole set and invalidates the list', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { items: [] } } });
        const client = buildClient();
        client.setQueryData(LIST_KEY, { data: [] });

        const { result } = renderHook(() => useSetQrCodeTags(), { wrapper: wrapperFor(client) });
        await act(async () => {
            await result.current.mutateAsync({ id: QR_ID, tagIds: [TAG_ID] });
        });

        expect(fetchApiMock).toHaveBeenCalledWith({
            path: `/api/v1/admin/qr-codes/${QR_ID}/tags`,
            method: 'PUT',
            body: { tagIds: [TAG_ID] }
        });
        expect(isInvalidated(client, LIST_KEY)).toBe(true);
    });
});

describe('catalog writes', () => {
    it('create invalidates the catalog only', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { id: TAG_ID } } });
        const client = buildClient();
        client.setQueryData(qrCodeTagQueryKeys.catalog(), []);
        client.setQueryData(LIST_KEY, { data: [] });

        const { result } = renderHook(() => useCreateQrCodeTag(), { wrapper: wrapperFor(client) });
        await act(async () => {
            await result.current.mutateAsync({ name: 'Verano' });
        });

        expect(fetchApiMock).toHaveBeenCalledWith({
            path: '/api/v1/admin/qr-code-tags',
            method: 'POST',
            body: { name: 'Verano' }
        });
        expect(isInvalidated(client, qrCodeTagQueryKeys.catalog())).toBe(true);
        expect(isInvalidated(client, LIST_KEY)).toBe(false);
    });

    /** A rename changes what every row shows, so the list must refetch too. */
    it('rename invalidates the list rows', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { id: TAG_ID } } });
        const client = buildClient();
        client.setQueryData(LIST_KEY, { data: [] });

        const { result } = renderHook(() => useUpdateQrCodeTag(), { wrapper: wrapperFor(client) });
        await act(async () => {
            await result.current.mutateAsync({ id: TAG_ID, data: { name: 'Invierno' } });
        });

        expect(fetchApiMock).toHaveBeenCalledWith({
            path: `/api/v1/admin/qr-code-tags/${TAG_ID}`,
            method: 'PATCH',
            body: { name: 'Invierno' }
        });
        expect(isInvalidated(client, LIST_KEY)).toBe(true);
    });

    it('delete refuses a zero-row answer', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { success: false } } });
        const client = buildClient();

        const { result } = renderHook(() => useDeleteQrCodeTag(), { wrapper: wrapperFor(client) });

        await expect(
            act(async () => {
                await result.current.mutateAsync(TAG_ID);
            })
        ).rejects.toThrow('qr-code-tag-delete-no-op');
    });

    it('delete resolves on a real delete', async () => {
        fetchApiMock.mockResolvedValue({ data: { data: { success: true } } });
        const client = buildClient();

        const { result } = renderHook(() => useDeleteQrCodeTag(), { wrapper: wrapperFor(client) });
        let deleted: string | undefined;
        await act(async () => {
            deleted = await result.current.mutateAsync(TAG_ID);
        });

        expect(deleted).toBe(TAG_ID);
        expect(fetchApiMock).toHaveBeenCalledWith({
            path: `/api/v1/admin/qr-code-tags/${TAG_ID}`,
            method: 'DELETE'
        });
    });
});
