// @vitest-environment jsdom
/**
 * Unit tests for useSocialDashboard date-range filtering (HOS-66 T-009).
 *
 * Coverage:
 * - No filters: fetchApi called with the bare dashboard path (no query string) —
 *   preserves current unfiltered behavior.
 * - dateFrom + dateTo: both forwarded as query params.
 * - Only dateFrom: only that param is present.
 * - Query key varies with filters so ranged and unranged views cache separately.
 */

import { useSocialDashboard } from '@/hooks/use-social-dashboard';
import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
const mockedFetchApi = vi.mocked(fetchApi);

afterEach(() => {
    vi.clearAllMocks();
});

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

const emptyDashboardResponse = {
    kpis: {
        totalPosts: 0,
        pendingReview: 0,
        scheduled: 0,
        publishedLast30Days: 0,
        failedActionNeeded: 0
    },
    quickApprovalQueue: [],
    recentFailures: [],
    makeWebhookConfigured: true,
    platformBreakdown: []
};

describe('useSocialDashboard — no filters (regression)', () => {
    it('calls fetchApi with the bare dashboard path when no filters are passed', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: emptyDashboardResponse },
            status: 200
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSocialDashboard(), { wrapper });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockedFetchApi).toHaveBeenCalledOnce();
        const path = mockedFetchApi.mock.calls[0]?.[0]?.path ?? '';
        expect(path).toBe('/api/v1/admin/social/dashboard');
    });
});

describe('useSocialDashboard — date-range filters', () => {
    it('forwards both dateFrom and dateTo as query params', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: emptyDashboardResponse },
            status: 200
        });

        const wrapper = createWrapper();
        const { result } = renderHook(
            () => useSocialDashboard({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }),
            { wrapper }
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const path = mockedFetchApi.mock.calls[0]?.[0]?.path ?? '';
        expect(path).toContain('dateFrom=2026-01-01');
        expect(path).toContain('dateTo=2026-01-31');
    });

    it('forwards only dateFrom when dateTo is omitted', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: emptyDashboardResponse },
            status: 200
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useSocialDashboard({ dateFrom: '2026-02-01' }), {
            wrapper
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const path = mockedFetchApi.mock.calls[0]?.[0]?.path ?? '';
        expect(path).toContain('dateFrom=2026-02-01');
        expect(path).not.toContain('dateTo=');
    });

    it('uses a different query key for ranged vs unranged calls (no cache collision)', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: emptyDashboardResponse },
            status: 200
        });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        });
        const wrapper = ({ children }: { readonly children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client: queryClient }, children);

        renderHook(() => useSocialDashboard(), { wrapper });
        renderHook(() => useSocialDashboard({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }), {
            wrapper
        });

        await waitFor(() => expect(mockedFetchApi).toHaveBeenCalledTimes(2));
    });
});
