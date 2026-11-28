/**
 * @file use-send-direct-email.test.tsx
 * HOS-2685: a failed send still refreshes the history list, because the request may have
 * sent (a proxy timeout cuts the response, not the batch).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { directEmailQueryKeys, useSendDirectEmail } from '@/hooks/direct-email/use-direct-emails';

const mocks = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ fetchApi: mocks.fetchApi }));

const PAYLOAD = {
    subject: 's',
    bodyJson: { type: 'doc', content: [] },
    recipients: ['a@x.com'],
    idempotencyKey: '33333333-3333-4333-8333-333333333333'
} as never;

function setup() {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { invalidate, wrapper };
}

describe('useSendDirectEmail', () => {
    it('invalidates the history list when the send fails', async () => {
        mocks.fetchApi.mockRejectedValueOnce(new Error('timeout'));
        const { invalidate, wrapper } = setup();
        const { result } = renderHook(() => useSendDirectEmail(), { wrapper });

        await act(async () => {
            await result.current.mutateAsync(PAYLOAD).catch(() => undefined);
        });

        expect(invalidate).toHaveBeenCalledWith({ queryKey: directEmailQueryKeys.lists() });
    });

    it('invalidates the history list when the send succeeds', async () => {
        mocks.fetchApi.mockResolvedValueOnce({ data: { data: { messageId: 'm', results: [] } } });
        const { invalidate, wrapper } = setup();
        const { result } = renderHook(() => useSendDirectEmail(), { wrapper });

        await act(async () => {
            await result.current.mutateAsync(PAYLOAD);
        });

        expect(invalidate).toHaveBeenCalledWith({ queryKey: directEmailQueryKeys.lists() });
    });
});
