// @vitest-environment jsdom
/**
 * Tests for the "Vistas (30d)" derived column on the posts list (AC-25, T-018).
 *
 * Coverage:
 * - AC-25 / AC-30: column present when user has ANALYTICS_VIEW; absent without it.
 * - views30d column is NOT sortable (AC-27).
 * - Cell shows correct total, "0" for zero, "—" on error, "…" while loading.
 *
 * Cell rendering states are integration-tested via Views30dCell directly;
 * see accommodations views-column.test.tsx for the full cell state suite.
 */

import { Views30dCell } from '@/components/entity-list/Views30dCell';
import { createPostsColumns } from '@/features/posts/config/posts.columns';
import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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

const t = (key: string) => key;

// ---------------------------------------------------------------------------
// Permission guard
// ---------------------------------------------------------------------------

describe('createPostsColumns — views30d column permission guard (AC-25, AC-30)', () => {
    it('should include views30d column when hasAnalyticsView is true', () => {
        const columns = createPostsColumns(t, { hasAnalyticsView: true });
        expect(columns.find((c) => c.id === 'views30d')).toBeDefined();
    });

    it('should NOT include views30d column when hasAnalyticsView is false', () => {
        const columns = createPostsColumns(t, { hasAnalyticsView: false });
        expect(columns.find((c) => c.id === 'views30d')).toBeUndefined();
    });

    it('should NOT include views30d column when options is omitted', () => {
        const columns = createPostsColumns(t);
        expect(columns.find((c) => c.id === 'views30d')).toBeUndefined();
    });

    it('should have enableSorting=false on the views30d column (AC-27)', () => {
        const columns = createPostsColumns(t, { hasAnalyticsView: true });
        expect(columns.find((c) => c.id === 'views30d')?.enableSorting).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Cell — entityType=POST is passed to the endpoint
// ---------------------------------------------------------------------------

describe('Views30dCell with entityType=POST', () => {
    it('should call the batch endpoint with entityType=POST', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [{ entityId: 'post-001', unique: 3, total: 10 }] },
            status: 200
        });

        const Wrapper = createWrapper();

        render(
            React.createElement(
                Wrapper,
                null,
                React.createElement(Views30dCell, { entityId: 'post-001', entityType: 'POST' })
            )
        );

        await waitFor(() => expect(mockedFetchApi).toHaveBeenCalled());

        const callArgs = mockedFetchApi.mock.calls[0]?.[0];
        expect(callArgs?.path).toContain('entityType=POST');
    });

    it('should render "0" for a post with zero views', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [{ entityId: 'post-001', unique: 0, total: 0 }] },
            status: 200
        });

        const Wrapper = createWrapper();

        render(
            React.createElement(
                Wrapper,
                null,
                React.createElement(Views30dCell, { entityId: 'post-001', entityType: 'POST' })
            )
        );

        await waitFor(() => expect(screen.getByText('0')).toBeInTheDocument());
    });

    it('should render "—" on error', async () => {
        mockedFetchApi.mockRejectedValue(new Error('Server error'));

        const Wrapper = createWrapper();

        render(
            React.createElement(
                Wrapper,
                null,
                React.createElement(Views30dCell, { entityId: 'post-001', entityType: 'POST' })
            )
        );

        await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument());
    });
});
