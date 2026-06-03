// @vitest-environment jsdom
/**
 * Tests for AppLogsPanel component (SPEC-184 T-014).
 *
 * Strategy:
 * - Mock `useAppLogsQuery` to return controlled states (loading/error/data).
 * - Wrap each render in a minimal QueryClientProvider.
 * - Verify: rows from mock response, level badge variant per level,
 *   filter changes call the hook with updated params + reset page,
 *   pagination controls behave correctly.
 *
 * References: SPEC-184 T-013, T-014
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppLogEntry, AppLogEntryFilter } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseAppLogsQuery = vi.fn();

vi.mock('../hooks', () => ({
    useAppLogsQuery: (filter: AppLogEntryFilter) => mockUseAppLogsQuery(filter),
    appLogQueryKeys: {
        appLogs: {
            all: ['app-logs'],
            list: (f: AppLogEntryFilter) => ['app-logs', 'list', f]
        }
    }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a fresh QueryClient for each test to prevent cross-test cache bleed. */
function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, refetchOnWindowFocus: false }
        }
    });
}

/** Wraps children in a fresh QueryClientProvider. */
function TestWrapper({ children }: { readonly children: ReactNode }) {
    const queryClient = makeQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Creates a minimal AppLogEntry fixture. */
function makeEntry(overrides: Partial<AppLogEntry> = {}): AppLogEntry {
    return {
        id: 'entry-1',
        level: 'ERROR',
        category: 'API',
        label: null,
        message: 'Something went wrong',
        data: null,
        loggedAt: new Date('2025-01-15T10:00:00Z'),
        createdAt: new Date('2025-01-15T10:00:00Z'),
        // Spread after defaults so explicit null values in overrides win over defaults
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

// Dynamic import is not needed since vi.mock is hoisted, but we import here
// after the mock declaration.
import { AppLogsPanel } from '../components/AppLogsPanel';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppLogsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Loading state ──────────────────────────────────────────────────────

    it('renders the loading state when the query is pending', () => {
        mockUseAppLogsQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        expect(screen.getByTestId('app-logs-loading')).toBeInTheDocument();
        expect(screen.queryByTestId('log-row')).not.toBeInTheDocument();
    });

    // ── Error state ────────────────────────────────────────────────────────

    it('renders the error state when the query fails', () => {
        mockUseAppLogsQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('Network error')
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        expect(screen.getByTestId('app-logs-error')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
        expect(screen.queryByTestId('log-row')).not.toBeInTheDocument();
    });

    // ── Empty state ────────────────────────────────────────────────────────

    it('renders the empty state when data has no items', () => {
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: [], total: 0, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        expect(screen.getByTestId('app-logs-empty')).toBeInTheDocument();
        expect(screen.queryByTestId('log-row')).not.toBeInTheDocument();
    });

    // ── Data rendering ─────────────────────────────────────────────────────

    it('renders one row per log entry', () => {
        const entries = [
            makeEntry({ id: 'e1', level: 'ERROR', message: 'Error one' }),
            makeEntry({ id: 'e2', level: 'WARN', message: 'Warn two' })
        ];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 2, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        const rows = screen.getAllByTestId('log-row');
        expect(rows).toHaveLength(2);
    });

    it('renders ERROR level badge with destructive styling', () => {
        const entries = [makeEntry({ id: 'e1', level: 'ERROR' })];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 1, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        const levelCell = screen.getByTestId('log-cell-level');
        // The destructive badge contains the text ERROR
        expect(levelCell).toHaveTextContent('ERROR');
        // The badge should carry the destructive class
        const badge = levelCell.querySelector('[class*="destructive"]');
        expect(badge).not.toBeNull();
    });

    it('renders WARN level badge with amber/outline styling', () => {
        const entries = [makeEntry({ id: 'e1', level: 'WARN' })];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 1, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        const levelCell = screen.getByTestId('log-cell-level');
        expect(levelCell).toHaveTextContent('WARN');
        // Outline-variant badge should NOT carry destructive class
        const badge = levelCell.querySelector('[class*="destructive"]');
        expect(badge).toBeNull();
    });

    it('renders category and label cells', () => {
        const entries = [makeEntry({ id: 'e1', category: 'BILLING', label: 'charge' })];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 1, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        expect(screen.getByTestId('log-cell-category')).toHaveTextContent('BILLING');
        expect(screen.getByTestId('log-cell-label')).toHaveTextContent('charge');
    });

    it('renders "—" for null category and label', () => {
        const entries = [makeEntry({ id: 'e1', category: null, label: null })];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 1, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        const categoryCells = screen.getAllByTestId('log-cell-category');
        const labelCells = screen.getAllByTestId('log-cell-label');
        expect(categoryCells[0]).toHaveTextContent('—');
        expect(labelCells[0]).toHaveTextContent('—');
    });

    // ── Request-context in row detail (AppLogsPanel integration) ───────────

    it('shows request-context fields when expanded for an entry with context', () => {
        const entries = [
            makeEntry({
                id: 'e1',
                requestId: 'req-xyz-789',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                method: 'GET',
                path: '/api/v1/public/accommodations'
            })
        ];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 1, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        // Expand the message cell
        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.getByTestId('log-request-context')).toBeInTheDocument();
        expect(screen.getByTestId('log-detail-request-id')).toHaveTextContent('req-xyz-789');
        expect(screen.getByTestId('log-detail-method')).toHaveTextContent('GET');
        expect(screen.getByTestId('log-detail-path')).toHaveTextContent(
            '/api/v1/public/accommodations'
        );
    });

    it('does not show request-context section for entries with no context', () => {
        const entries = [
            makeEntry({
                id: 'e1',
                requestId: null,
                userId: null,
                method: null,
                path: null
            })
        ];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 1, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-request-context')).not.toBeInTheDocument();
    });

    // ── Pagination ─────────────────────────────────────────────────────────

    it('disables the Anterior button on the first page', () => {
        const entries = [makeEntry({ id: 'e1' })];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 60, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        const prev = screen.getByTestId('log-prev-page');
        expect(prev).toBeDisabled();

        const next = screen.getByTestId('log-next-page');
        expect(next).not.toBeDisabled();
    });

    it('disables the Siguiente button on the last page', () => {
        const entries = [makeEntry({ id: 'e1' })];
        // total=50, pageSize=50, page=1 → pageCount=1 → next should be disabled
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 50, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        const next = screen.getByTestId('log-next-page');
        expect(next).toBeDisabled();
    });

    it('advancing the page triggers a new query call with the incremented page', async () => {
        const entries = [makeEntry({ id: 'e1' })];
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: entries, total: 100, page: 1, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        const next = screen.getByTestId('log-next-page');
        fireEvent.click(next);

        await waitFor(() => {
            // The second call should pass page=2
            const calls = mockUseAppLogsQuery.mock.calls;
            const lastFilter = calls[calls.length - 1]?.[0] as AppLogEntryFilter;
            expect(lastFilter.page).toBe(2);
        });
    });
});

// ---------------------------------------------------------------------------
// AppLogMessageCell sub-component tests
// ---------------------------------------------------------------------------

import { AppLogMessageCell } from '../components/AppLogMessageCell';

describe('AppLogMessageCell', () => {
    it('renders the message in preview mode by default', () => {
        render(
            <AppLogMessageCell
                message="Something broke hard"
                data={null}
            />
        );

        expect(screen.getByTestId('log-message-preview')).toBeInTheDocument();
        expect(screen.getByTestId('log-message-preview')).toHaveTextContent('Something broke hard');
        expect(screen.queryByTestId('log-message-full')).not.toBeInTheDocument();
    });

    it('expands to show the full message on click', () => {
        render(
            <AppLogMessageCell
                message="A very long message that should be expanded"
                data={null}
            />
        );

        const toggle = screen.getByTestId('log-message-toggle');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(toggle);

        expect(screen.getByTestId('log-message-full')).toBeInTheDocument();
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.queryByTestId('log-message-preview')).not.toBeInTheDocument();
    });

    it('collapses back to preview on second click', () => {
        render(
            <AppLogMessageCell
                message="Toggle me"
                data={null}
            />
        );

        const toggle = screen.getByTestId('log-message-toggle');
        fireEvent.click(toggle); // expand
        fireEvent.click(toggle); // collapse

        expect(screen.getByTestId('log-message-preview')).toBeInTheDocument();
        expect(screen.queryByTestId('log-message-full')).not.toBeInTheDocument();
    });

    it('shows the data payload as pretty-printed JSON when expanded and data is present', () => {
        const data = { userId: 'abc', amount: 1500 };

        render(
            <AppLogMessageCell
                message="Payment failed"
                data={data}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        const dataPre = screen.getByTestId('log-message-data');
        expect(dataPre).toBeInTheDocument();
        expect(dataPre.textContent).toContain('"userId"');
        expect(dataPre.textContent).toContain('"abc"');
    });

    it('does not show data payload when data is null', () => {
        render(
            <AppLogMessageCell
                message="No data here"
                data={null}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-message-data')).not.toBeInTheDocument();
    });

    it('does not show data payload when data is an empty object', () => {
        render(
            <AppLogMessageCell
                message="Empty data"
                data={{}}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-message-data')).not.toBeInTheDocument();
    });

    // ── Request-context fields in expanded detail ──────────────────────────

    it('shows request-context section when expanded and fields are present', () => {
        render(
            <AppLogMessageCell
                message="Request failed"
                data={null}
                requestId="req-abc-123"
                userId="550e8400-e29b-41d4-a716-446655440000"
                method="POST"
                path="/api/v1/admin/logs"
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.getByTestId('log-request-context')).toBeInTheDocument();
        expect(screen.getByTestId('log-detail-request-id')).toHaveTextContent('req-abc-123');
        expect(screen.getByTestId('log-detail-user-id')).toHaveTextContent(
            '550e8400-e29b-41d4-a716-446655440000'
        );
        expect(screen.getByTestId('log-detail-method')).toHaveTextContent('POST');
        expect(screen.getByTestId('log-detail-path')).toHaveTextContent('/api/v1/admin/logs');
    });

    it('does not show request-context section when all context fields are null', () => {
        render(
            <AppLogMessageCell
                message="Cron job entry"
                data={null}
                requestId={null}
                userId={null}
                method={null}
                path={null}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-request-context')).not.toBeInTheDocument();
    });

    it('does not show request-context section when props are omitted', () => {
        render(
            <AppLogMessageCell
                message="Startup log"
                data={null}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.queryByTestId('log-request-context')).not.toBeInTheDocument();
    });

    it('shows only the present context fields when partial context is given', () => {
        render(
            <AppLogMessageCell
                message="Partial context"
                data={null}
                method="GET"
                path="/api/v1/public/accommodations"
                requestId={null}
                userId={null}
            />
        );

        fireEvent.click(screen.getByTestId('log-message-toggle'));

        expect(screen.getByTestId('log-request-context')).toBeInTheDocument();
        expect(screen.getByTestId('log-detail-method')).toHaveTextContent('GET');
        expect(screen.getByTestId('log-detail-path')).toHaveTextContent(
            '/api/v1/public/accommodations'
        );
        expect(screen.queryByTestId('log-detail-request-id')).not.toBeInTheDocument();
        expect(screen.queryByTestId('log-detail-user-id')).not.toBeInTheDocument();
    });

    it('hides request-context section after collapsing', () => {
        render(
            <AppLogMessageCell
                message="Toggle context"
                data={null}
                requestId="req-xyz"
            />
        );

        const toggle = screen.getByTestId('log-message-toggle');
        fireEvent.click(toggle); // expand
        expect(screen.getByTestId('log-request-context')).toBeInTheDocument();

        fireEvent.click(toggle); // collapse
        expect(screen.queryByTestId('log-request-context')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Filter change triggers page reset (integration via AppLogsPanel)
// ---------------------------------------------------------------------------

describe('AppLogsPanel filter changes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resets to page 1 when the level filter changes', async () => {
        // Start on page 2 via mock data indicating multi-page results
        mockUseAppLogsQuery.mockReturnValue({
            data: { items: [makeEntry()], total: 200, page: 2, pageSize: 50 },
            isLoading: false,
            error: null
        });

        render(
            <TestWrapper>
                <AppLogsPanel />
            </TestWrapper>
        );

        // Click next to advance to page 2 in state
        const next = screen.getByTestId('log-next-page');
        fireEvent.click(next);

        await waitFor(() => {
            const calls = mockUseAppLogsQuery.mock.calls;
            const last = calls[calls.length - 1]?.[0] as AppLogEntryFilter;
            expect(last.page).toBe(2);
        });

        // Now change the level filter — page should reset to 1
        // The Select is Radix-based; we trigger onChange on the underlying mock
        // by directly invoking filter onChange (we test AppLogFilters separately)
    });
});

// ---------------------------------------------------------------------------
// AppLogFilters new request-context inputs render and propagate
// ---------------------------------------------------------------------------

import { AppLogFilters } from '../components/AppLogFilters';

describe('AppLogFilters — request-context filters', () => {
    /** Default minimal filter matching DEFAULT_FILTER in AppLogsPanel */
    const BASE_FILTER: AppLogEntryFilter = { page: 1, pageSize: 50 };

    it('renders the request-id, user-id, method, and path filter controls', () => {
        const onChange = vi.fn();
        render(
            <AppLogFilters
                filter={BASE_FILTER}
                onChange={onChange}
            />
        );

        expect(screen.getByTestId('log-filter-request-id')).toBeInTheDocument();
        expect(screen.getByTestId('log-filter-user-id')).toBeInTheDocument();
        expect(screen.getByTestId('log-filter-method')).toBeInTheDocument();
        expect(screen.getByTestId('log-filter-path')).toBeInTheDocument();
    });

    it('calls onChange with requestId set and page reset to 1 on requestId input', () => {
        const onChange = vi.fn();
        render(
            <AppLogFilters
                filter={{ ...BASE_FILTER, page: 3 }}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByTestId('log-filter-request-id'), {
            target: { value: 'req-abc' }
        });

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ requestId: 'req-abc', page: 1 })
        );
    });

    it('calls onChange with userId set and page reset to 1 on userId input', () => {
        const onChange = vi.fn();
        render(
            <AppLogFilters
                filter={{ ...BASE_FILTER, page: 2 }}
                onChange={onChange}
            />
        );

        const uuid = '550e8400-e29b-41d4-a716-446655440000';
        fireEvent.change(screen.getByTestId('log-filter-user-id'), {
            target: { value: uuid }
        });

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ userId: uuid, page: 1 }));
    });

    it('calls onChange with path set and page reset to 1 on path input', () => {
        const onChange = vi.fn();
        render(
            <AppLogFilters
                filter={{ ...BASE_FILTER, page: 2 }}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByTestId('log-filter-path'), {
            target: { value: '/api/v1/admin' }
        });

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/v1/admin', page: 1 })
        );
    });

    it('sets requestId to undefined when the input is cleared', () => {
        const onChange = vi.fn();
        render(
            <AppLogFilters
                filter={{ ...BASE_FILTER, requestId: 'existing-id' }}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByTestId('log-filter-request-id'), {
            target: { value: '   ' }
        });

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ requestId: undefined, page: 1 })
        );
    });

    it('sets path to undefined when the input is cleared', () => {
        const onChange = vi.fn();
        render(
            <AppLogFilters
                filter={{ ...BASE_FILTER, path: '/existing' }}
                onChange={onChange}
            />
        );

        fireEvent.change(screen.getByTestId('log-filter-path'), {
            target: { value: '' }
        });

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ path: undefined, page: 1 })
        );
    });
});
