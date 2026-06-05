// @vitest-environment jsdom
/**
 * Tests for the "Vistas (30d)" derived column on the accommodations list.
 *
 * Coverage:
 * - AC-24 / AC-30: column present when user has ANALYTICS_VIEW; absent without it.
 * - AC-28: skeleton / loading state shows "…" while batch request is in-flight.
 * - AC-29: error state shows "—" when batch request fails.
 * - AC-26: "0" rendered for an entity with zero views (not blank).
 *
 * Uses the same renderHook + QueryClientProvider pattern as billing-addons tests.
 */

import { Views30dCell } from '@/components/entity-list/Views30dCell';
import { createAccommodationsColumns } from '@/features/accommodations/config/accommodations.columns';
import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

afterEach(() => {
    vi.clearAllMocks();
});

/** Minimal QueryClientProvider wrapper with retries disabled. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

// ---------------------------------------------------------------------------
// createAccommodationsColumns — permission guard
// ---------------------------------------------------------------------------

describe('createAccommodationsColumns — views30d column permission guard (AC-24, AC-30)', () => {
    const t = (key: string) => key;

    it('should include views30d column when hasAnalyticsView is true', () => {
        // Arrange + Act
        const columns = createAccommodationsColumns(t, { hasAnalyticsView: true });

        // Assert
        const viewsCol = columns.find((c) => c.id === 'views30d');
        expect(viewsCol).toBeDefined();
    });

    it('should NOT include views30d column when hasAnalyticsView is false', () => {
        // Arrange + Act
        const columns = createAccommodationsColumns(t, { hasAnalyticsView: false });

        // Assert
        const viewsCol = columns.find((c) => c.id === 'views30d');
        expect(viewsCol).toBeUndefined();
    });

    it('should NOT include views30d column when options is omitted', () => {
        // Arrange + Act
        const columns = createAccommodationsColumns(t);

        // Assert
        const viewsCol = columns.find((c) => c.id === 'views30d');
        expect(viewsCol).toBeUndefined();
    });

    it('should have enableSorting=false on the views30d column (AC-27)', () => {
        // Arrange + Act
        const columns = createAccommodationsColumns(t, { hasAnalyticsView: true });
        const viewsCol = columns.find((c) => c.id === 'views30d');

        // Assert
        expect(viewsCol?.enableSorting).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Views30dCell — cell rendering states
// ---------------------------------------------------------------------------

describe('Views30dCell — loading state (AC-28)', () => {
    it('should render "…" while the batch request is in-flight', () => {
        // Arrange — never resolves
        mockedFetchApi.mockImplementation(() => new Promise(() => {}));

        const Wrapper = createWrapper();

        // Act
        render(
            React.createElement(
                Wrapper,
                null,
                React.createElement(Views30dCell, {
                    entityId: 'entity-001',
                    entityType: 'ACCOMMODATION'
                })
            )
        );

        // Assert
        expect(screen.getByText('…')).toBeInTheDocument();
    });
});

describe('Views30dCell — error state (AC-29)', () => {
    it('should render "—" when the batch request fails', async () => {
        // Arrange
        mockedFetchApi.mockRejectedValue(new Error('Network error'));

        const Wrapper = createWrapper();

        // Act
        render(
            React.createElement(
                Wrapper,
                null,
                React.createElement(Views30dCell, {
                    entityId: 'entity-001',
                    entityType: 'ACCOMMODATION'
                })
            )
        );

        // Assert
        await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument());
    });
});

describe('Views30dCell — zero views (AC-26)', () => {
    it('should render "0" for an entity with zero views', async () => {
        // Arrange — batch endpoint returns 0 for this entity
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: [{ entityId: 'entity-001', unique: 0, total: 0 }]
            },
            status: 200
        });

        const Wrapper = createWrapper();

        // Act
        render(
            React.createElement(
                Wrapper,
                null,
                React.createElement(Views30dCell, {
                    entityId: 'entity-001',
                    entityType: 'ACCOMMODATION'
                })
            )
        );

        // Assert — zero renders as "0", not blank
        await waitFor(() => expect(screen.getByText('0')).toBeInTheDocument());
    });
});

describe('Views30dCell — successful data (AC-24, AC-26)', () => {
    it('should render the total view count when data loads', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: [{ entityId: 'entity-001', unique: 15, total: 42 }]
            },
            status: 200
        });

        const Wrapper = createWrapper();

        // Act
        render(
            React.createElement(
                Wrapper,
                null,
                React.createElement(Views30dCell, {
                    entityId: 'entity-001',
                    entityType: 'ACCOMMODATION'
                })
            )
        );

        // Assert
        await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    });

    it('should call the correct batch endpoint path', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [{ entityId: 'entity-001', unique: 1, total: 5 }] },
            status: 200
        });

        const Wrapper = createWrapper();

        // Act
        render(
            React.createElement(
                Wrapper,
                null,
                React.createElement(Views30dCell, {
                    entityId: 'entity-001',
                    entityType: 'ACCOMMODATION'
                })
            )
        );

        await waitFor(() => expect(mockedFetchApi).toHaveBeenCalled());

        // Assert — verify the endpoint path and entityType param
        const callArgs = mockedFetchApi.mock.calls[0]?.[0];
        expect(callArgs?.path).toContain('/api/v1/admin/views/batch');
        expect(callArgs?.path).toContain('entityType=ACCOMMODATION');
        expect(callArgs?.path).toContain('entity-001');
        expect(callArgs?.path).toContain('window=30d');
    });
});
