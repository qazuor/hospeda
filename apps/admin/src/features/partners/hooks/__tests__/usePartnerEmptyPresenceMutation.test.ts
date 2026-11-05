import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePartnerEmptyPresenceMutation } from '../usePartnerEmptyPresenceMutation';

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ fetchApi }));

const partnerId = '41000000-0000-4000-8000-000000000001';
const response = {
    id: partnerId,
    clearedFields: ['description'],
    remoteAssetsDeleted: 0,
    remoteAssetsSkipped: 0
};

function setup() {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
        createElement(QueryClientProvider, { client, children });
    return { client, wrapper };
}

describe('usePartnerEmptyPresenceMutation', () => {
    afterEach(() => vi.clearAllMocks());

    it('posts the exact confirmed request and returns the parsed response', async () => {
        fetchApi.mockResolvedValue({ data: { data: response } });
        const { wrapper } = setup();
        const { result } = renderHook(() => usePartnerEmptyPresenceMutation(partnerId), {
            wrapper
        });

        await expect(result.current.mutateAsync({ reason: 'x' })).resolves.toEqual(response);
        expect(fetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/partners/${partnerId}/empty-presence`,
            method: 'POST',
            body: { reason: 'x', confirm: true }
        });
    });

    it('rejects a response that does not match the response schema', async () => {
        fetchApi.mockResolvedValue({ data: { data: { id: 'invalid' } } });
        const { wrapper } = setup();
        const { result } = renderHook(() => usePartnerEmptyPresenceMutation(partnerId), {
            wrapper
        });
        await expect(result.current.mutateAsync({ reason: 'x' })).rejects.toThrow();
    });

    it('invalidates only the Partner detail query after success', async () => {
        fetchApi.mockResolvedValue({ data: { data: response } });
        const { client, wrapper } = setup();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const { result } = renderHook(() => usePartnerEmptyPresenceMutation(partnerId), {
            wrapper
        });
        await result.current.mutateAsync({ reason: 'x' });
        await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['partners', 'detail', partnerId] });
    });

    it('propagates API errors without invalidating queries', async () => {
        const error = new Error('API failed');
        fetchApi.mockRejectedValue(error);
        const { client, wrapper } = setup();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const { result } = renderHook(() => usePartnerEmptyPresenceMutation(partnerId), {
            wrapper
        });
        await expect(result.current.mutateAsync({ reason: 'x' })).rejects.toBe(error);
        expect(invalidate).not.toHaveBeenCalled();
    });
});
