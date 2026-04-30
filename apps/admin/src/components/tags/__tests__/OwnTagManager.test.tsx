// @vitest-environment jsdom
/**
 * Tests for OwnTagManager component.
 *
 * Covers:
 * - Quota bar reflects used/limit from API (AC-003-01)
 * - Create button is disabled when at quota (AC-003-02)
 * - Quota-reached message shown at quota (AC-003-02)
 * - Filter tabs change visible tags (AC-003-03)
 * - All 3 lifecycle states render with visual distinction (D-022)
 *
 * Uses MSW to mock `/api/v1/admin/tags/own` and `/api/v1/admin/tags/own/quota`.
 * TanStack Query is wrapped with a fresh QueryClient per test.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { OwnTagManager } from '../OwnTagManager';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });
}

function Wrapper({ children }: { readonly children: ReactNode }) {
    const qc = makeQueryClient();
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const API_BASE = 'http://localhost:3001/api/v1';

const mockPaginatedTags = (items: unknown[], page = 1) => ({
    success: true,
    data: {
        items,
        pagination: {
            page,
            pageSize: 25,
            total: items.length,
            totalPages: Math.ceil(items.length / 25)
        }
    }
});

const mockQuota = (used: number, limit: number) => ({
    success: true,
    data: { used, limit }
});

const mockTag = (overrides: Record<string, unknown> = {}) => ({
    id: 'tag-own-001',
    name: 'Revisar',
    color: 'BLUE',
    type: 'USER',
    ownerId: 'user-001',
    icon: null,
    description: null,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: 'user-001',
    updatedById: 'user-001',
    ...overrides
});

// Default handlers (registered per-test via server.use)
function setupDefaultHandlers(tags: unknown[] = [], quota = { used: 2, limit: 50 }) {
    server.use(
        http.get(`${API_BASE}/admin/tags/own`, () => HttpResponse.json(mockPaginatedTags(tags))),
        http.get(`${API_BASE}/admin/tags/own/quota`, () =>
            HttpResponse.json(mockQuota(quota.used, quota.limit))
        )
    );
}

// Also mock useAuthContext so useHasPermission doesn't throw
vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ user: { permissions: [] } })
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OwnTagManager', () => {
    /**
     * AC-003-01: Quota bar reflects API data.
     */
    it('renders quota bar with correct fill percentage', async () => {
        setupDefaultHandlers([], { used: 25, limit: 50 });

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        // Wait for quota data to load and bar to update
        await waitFor(() => {
            const bar = screen.getByTestId('quota-bar');
            expect(bar).toHaveStyle({ width: '50%' });
        });

        // Shows text indicator
        expect(screen.getByTestId('quota-indicator')).toHaveTextContent('25 / 50');
    });

    /**
     * AC-003-02: Create button disabled when at quota.
     */
    it('disables the create button when at quota', async () => {
        setupDefaultHandlers([], { used: 50, limit: 50 });

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('create-tag-button')).toBeDisabled();
        });
    });

    /**
     * AC-003-02: Quota-reached message shown at quota.
     */
    it('shows quota-reached message when at quota', async () => {
        setupDefaultHandlers([], { used: 50, limit: 50 });

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('quota-reached-message')).toBeInTheDocument();
        });

        expect(screen.getByTestId('quota-reached-message')).toHaveTextContent('Límite alcanzado');
    });

    /**
     * AC-003-02: Create button is enabled when below quota.
     */
    it('enables the create button when below quota', async () => {
        setupDefaultHandlers([], { used: 10, limit: 50 });

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            const btn = screen.getByTestId('create-tag-button');
            expect(btn).not.toBeDisabled();
        });
    });

    /**
     * D-022: List renders ACTIVE, DRAFT, and ARCHIVED tags.
     */
    it('renders tags with different lifecycle states', async () => {
        const tags = [
            mockTag({ id: 'tag-001', name: 'Tag-Activo', lifecycleState: 'ACTIVE' }),
            mockTag({ id: 'tag-002', name: 'Tag-Borrador', lifecycleState: 'DRAFT' }),
            mockTag({ id: 'tag-003', name: 'Tag-Archivado', lifecycleState: 'ARCHIVED' })
        ];

        setupDefaultHandlers(tags);

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('tag-list')).toBeInTheDocument();
        });

        // Tag names are rendered in the name column
        expect(screen.getByText('Tag-Activo')).toBeInTheDocument();
        expect(screen.getByText('Tag-Borrador')).toBeInTheDocument();
        expect(screen.getByText('Tag-Archivado')).toBeInTheDocument();

        // State badges are rendered with translated labels
        expect(screen.getByText('Activo')).toBeInTheDocument();
        expect(screen.getByText('Borrador')).toBeInTheDocument();
        expect(screen.getByText('Archivado')).toBeInTheDocument();
    });

    /**
     * AC-003-03: Lifecycle tab filter changes API request.
     */
    it('changes filter when lifecycle tab is clicked', async () => {
        const capturedSearchParams: string[] = [];

        server.use(
            http.get(`${API_BASE}/admin/tags/own`, ({ request }) => {
                const url = new URL(request.url);
                capturedSearchParams.push(url.searchParams.get('lifecycleState') ?? '');
                return HttpResponse.json(mockPaginatedTags([]));
            }),
            http.get(`${API_BASE}/admin/tags/own/quota`, () => HttpResponse.json(mockQuota(0, 50)))
        );

        const user = userEvent.setup();

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        // Wait for initial render
        await waitFor(() => {
            expect(screen.getByTestId('tab-all')).toBeInTheDocument();
        });

        // Click "Activos" tab
        await user.click(screen.getByTestId('tab-ACTIVE'));

        await waitFor(() => {
            // At least one request with lifecycleState=ACTIVE should have been made
            expect(capturedSearchParams).toContain('ACTIVE');
        });
    });

    /**
     * Shows empty state when no tags.
     */
    it('shows empty state when no tags are returned', async () => {
        setupDefaultHandlers([]);

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });
    });

    /**
     * Shows error state when API fails.
     */
    it('shows error message when API fails', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own`, () =>
                HttpResponse.json(
                    { success: false, error: { message: 'Server error' } },
                    { status: 500 }
                )
            ),
            http.get(`${API_BASE}/admin/tags/own/quota`, () => HttpResponse.json(mockQuota(0, 50)))
        );

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('error-message')).toBeInTheDocument();
        });
    });
});
