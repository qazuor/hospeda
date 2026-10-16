// @vitest-environment jsdom
import { AdminTrialSummaryResponseSchema, SubscribeDestinationVerticalSchema } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { buildUserTrialSummaryPath, useUserTrialSummaries } from '../useUserTrialSummaries';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
const mockedFetch = vi.mocked(fetchApi);
const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const response = { summary: { status: 'NONE' }, ceilingDays: null };

function wrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        children
    );
}

afterEach(() => vi.clearAllMocks());

describe('useUserTrialSummaries', () => {
    it('builds the literal route and reads once per schema vertical', async () => {
        mockedFetch.mockResolvedValue({ data: { data: response }, status: 200 });
        expect(
            buildUserTrialSummaryPath({
                userId,
                vertical: SubscribeDestinationVerticalSchema.options[0]
            })
        ).toBe(`/api/v1/admin/users/${userId}/trial-summary?vertical=accommodation`);
        const { result } = renderHook(() => useUserTrialSummaries({ userId, enabled: true }), {
            wrapper
        });
        await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(3));
        await waitFor(() =>
            expect(result.current.every((row) => row.data?.summary.status === 'NONE')).toBe(true)
        );
        expect(mockedFetch.mock.calls.map(([arg]) => arg.path).sort()).toEqual(
            SubscribeDestinationVerticalSchema.options
                .map(
                    (vertical) => `/api/v1/admin/users/${userId}/trial-summary?vertical=${vertical}`
                )
                .sort()
        );
        expect(result.current).toHaveLength(3);
        expect(result.current.every((row) => row.data?.summary.status === 'NONE')).toBe(true);
        expect(AdminTrialSummaryResponseSchema.parse(response)).toEqual(response);
    });

    it('does not read when disabled', async () => {
        const { result } = renderHook(() => useUserTrialSummaries({ userId, enabled: false }), {
            wrapper
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(mockedFetch).not.toHaveBeenCalled();
        expect(result.current.every((row) => row.isLoading === false)).toBe(true);
    });

    it('keeps a failed vertical independent from the others', async () => {
        mockedFetch.mockImplementation(async ({ path }) => {
            if (path.endsWith('vertical=gastronomy')) throw new Error('failed');
            return { data: { data: response }, status: 200 };
        });
        const { result } = renderHook(() => useUserTrialSummaries({ userId, enabled: true }), {
            wrapper
        });
        await waitFor(() => expect(result.current.filter((row) => row.isError)).toHaveLength(1));
        expect(result.current.filter((row) => row.data?.summary.status === 'NONE')).toHaveLength(2);
    });
});
