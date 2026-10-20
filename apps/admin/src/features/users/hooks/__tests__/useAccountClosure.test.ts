// @vitest-environment jsdom
/**
 * Tests for `useAccountClosure` (HOS-1494, action 24).
 *
 * The hooks decide WHICH account the server reads and closes: a wrong path
 * closes nothing (404) or another account. Both are asserted on the exact path,
 * method and body handed to `fetchApi`. The preview must not run while the
 * dialog is closed: rendering the user detail page alone must not ask the API
 * whether the account can be closed.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { useAccountClosurePreview, useCloseAccountOnRequestMutation } from '../useAccountClosure';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const PREVIEW = {
    userId: USER_ID,
    displayName: 'Juan Pérez',
    email: 'juan@example.com',
    canCharge: false,
    listingsNotPurged: 0,
    partnerPresenceWithContent: false,
    ready: true
} as const;

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

function createClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('useAccountClosurePreview — action 24 reads its preview only when asked', () => {
    it('GETs /api/v1/admin/users/:id/close-on-request and returns the preview', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: PREVIEW }, status: 200 });

        // Act
        const { result } = renderHook(
            () => useAccountClosurePreview({ userId: USER_ID, enabled: true }),
            { wrapper: createWrapper(createClient()) }
        );

        // Assert
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/users/${USER_ID}/close-on-request`
        });
        expect(result.current.data).toEqual(PREVIEW);
    });

    it('does not call the API with enabled: false', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({ data: { success: true, data: PREVIEW }, status: 200 });

        // Act
        const { result } = renderHook(
            () => useAccountClosurePreview({ userId: USER_ID, enabled: false }),
            { wrapper: createWrapper(createClient()) }
        );
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Assert
        expect(mockedFetchApi).not.toHaveBeenCalled();
        expect(result.current.fetchStatus).toBe('idle');
    });
});

describe('useCloseAccountOnRequestMutation — action 24 posts the reason to its route', () => {
    it('POSTs { reason } to /api/v1/admin/users/:id/close-on-request', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { closed: true } },
            status: 200
        });
        const { result } = renderHook(() => useCloseAccountOnRequestMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act
        const outcome = await result.current.mutateAsync({
            userId: USER_ID,
            reason: 'Juan lo pidió por correo'
        });

        // Assert
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/users/${USER_ID}/close-on-request`,
            method: 'POST',
            body: { reason: 'Juan lo pidió por correo' }
        });
        expect(outcome).toEqual({ closed: true });
    });

    it('invalidates the cached user queries after closing', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { closed: true } },
            status: 200
        });
        const queryClient = createClient();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useCloseAccountOnRequestMutation(), {
            wrapper: createWrapper(queryClient)
        });

        // Act
        await result.current.mutateAsync({ userId: USER_ID, reason: 'pedido del dueño' });

        // Assert
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
    });

    it('rejects when the route answers an error, so the caller can show it', async () => {
        // Arrange
        mockedFetchApi.mockRejectedValue(new Error('Request failed (409)'));
        const { result } = renderHook(() => useCloseAccountOnRequestMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act + Assert
        await expect(
            result.current.mutateAsync({ userId: USER_ID, reason: 'pedido del dueño' })
        ).rejects.toThrow('Request failed (409)');
    });
});
