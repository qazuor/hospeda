// @vitest-environment jsdom
/**
 * Tests for EntityViewStatChips component (SPEC-197 T-016).
 *
 * Coverage:
 * - AC-20: skeleton chips while loading (not "—" or "0").
 * - AC-21: zero state shows "0" chips, not hidden.
 * - Error state shows "—" chips.
 * - AC-23: no render + no fetch when user lacks ANALYTICS_VIEW.
 * - Aria-labels present on chips when loaded.
 */

import { EntityViewStatChips } from '@/components/views/EntityViewStatChips';
import { fetchApi } from '@/lib/api/client';
import type { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

/**
 * Permission flag controlled per test via this variable.
 * The mock reads `mockHasPermission` at call time, so tests can toggle it.
 */
let mockHasPermission = true;

vi.mock('@/hooks/use-user-permissions', () => ({
    useHasPermission: (_permission: PermissionEnum) => mockHasPermission,
    useUserPermissions: () => []
}));

const mockedFetchApi = vi.mocked(fetchApi);

afterEach(() => {
    vi.clearAllMocks();
    mockHasPermission = true; // reset to default between tests
});

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

function renderChips(props?: Partial<React.ComponentProps<typeof EntityViewStatChips>>) {
    const Wrapper = createWrapper();
    return render(
        React.createElement(
            Wrapper,
            null,
            React.createElement(EntityViewStatChips, {
                entityId: 'entity-001',
                entityType: 'ACCOMMODATION',
                ...props
            })
        )
    );
}

// ---------------------------------------------------------------------------
// AC-23 — no render + no fetch without ANALYTICS_VIEW
// ---------------------------------------------------------------------------

describe('EntityViewStatChips — no ANALYTICS_VIEW permission (AC-23)', () => {
    it('should render nothing when user lacks ANALYTICS_VIEW', () => {
        // Arrange
        mockHasPermission = false;

        // Act
        const { container } = renderChips();

        // Assert — nothing rendered
        expect(container).toBeEmptyDOMElement();
    });

    it('should NOT call fetchApi when user lacks ANALYTICS_VIEW (AC-23)', () => {
        // Arrange
        mockHasPermission = false;

        // Act
        renderChips();

        // Assert — no API call
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// AC-20 — loading state: skeleton chips, not "—" or "0"
// ---------------------------------------------------------------------------

describe('EntityViewStatChips — loading state (AC-20)', () => {
    it('should render skeleton elements while requests are in-flight', () => {
        // Arrange — never resolves
        mockedFetchApi.mockImplementation(() => new Promise(() => {}));

        // Act
        renderChips();

        // Assert — skeleton is rendered (animate-pulse), no numeric value
        const skeletons = document.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);

        // No "0" or "—" while loading
        expect(screen.queryByText('0')).toBeNull();
        expect(screen.queryByText('—')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// AC-21 — zero state: "0" chips, not hidden
// ---------------------------------------------------------------------------

describe('EntityViewStatChips — zero views state (AC-21)', () => {
    it('should render "0" chips for an entity with no views — chips NOT hidden', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: [{ entityId: 'entity-001', unique: 0, total: 0 }]
            },
            status: 200
        });

        // Act
        renderChips();

        // Assert — four "0" values rendered
        await waitFor(() => {
            const zeros = screen.getAllByText('0');
            expect(zeros.length).toBe(4);
        });
    });
});

// ---------------------------------------------------------------------------
// Error state — "—" chips
// ---------------------------------------------------------------------------

describe('EntityViewStatChips — error state', () => {
    it('should render "—" chips when API calls fail', async () => {
        // Arrange
        mockedFetchApi.mockRejectedValue(new Error('Network error'));

        // Act
        renderChips();

        // Assert — four "—" values rendered
        await waitFor(() => {
            const dashes = screen.getAllByText('—');
            expect(dashes.length).toBe(4);
        });
    });
});

// ---------------------------------------------------------------------------
// Happy path — correct values rendered
// ---------------------------------------------------------------------------

describe('EntityViewStatChips — happy path', () => {
    it('should render unique and total counts for both 7d and 30d windows', async () => {
        // Arrange — 7d and 30d responses
        mockedFetchApi.mockImplementation((params) => {
            const path = params?.path ?? '';
            if (path.includes('window=7d')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: [{ entityId: 'entity-001', unique: 10, total: 25 }]
                    },
                    status: 200
                });
            }
            // window=30d
            return Promise.resolve({
                data: {
                    success: true,
                    data: [{ entityId: 'entity-001', unique: 50, total: 120 }]
                },
                status: 200
            });
        });

        // Act
        renderChips();

        // Assert
        await waitFor(() => {
            expect(screen.getByText('10')).toBeInTheDocument();
            expect(screen.getByText('25')).toBeInTheDocument();
            expect(screen.getByText('50')).toBeInTheDocument();
            expect(screen.getByText('120')).toBeInTheDocument();
        });
    });

    it('should have aria-labels on the chips (AC-17)', async () => {
        // Arrange
        mockedFetchApi.mockImplementation((params) => {
            const path = params?.path ?? '';
            if (path.includes('window=7d')) {
                return Promise.resolve({
                    data: {
                        success: true,
                        data: [{ entityId: 'entity-001', unique: 5, total: 10 }]
                    },
                    status: 200
                });
            }
            return Promise.resolve({
                data: {
                    success: true,
                    data: [{ entityId: 'entity-001', unique: 20, total: 40 }]
                },
                status: 200
            });
        });

        // Act
        renderChips();

        // Assert — chips have aria-labels
        await waitFor(() => {
            const elements = screen.getAllByRole('generic', { hidden: false });
            const withAria = elements.filter((el) => el.getAttribute('aria-label'));
            expect(withAria.length).toBeGreaterThan(0);
        });
    });
});

// ---------------------------------------------------------------------------
// entityType propagation
// ---------------------------------------------------------------------------

describe('EntityViewStatChips — entityType propagation', () => {
    it('should call the batch endpoint with entityType=POST when entityType is POST', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [{ entityId: 'post-001', unique: 1, total: 2 }] },
            status: 200
        });

        // Act
        renderChips({ entityId: 'post-001', entityType: 'POST' });

        await waitFor(() => expect(mockedFetchApi).toHaveBeenCalled());

        // Assert — all calls include entityType=POST
        for (const call of mockedFetchApi.mock.calls) {
            expect(call[0]?.path).toContain('entityType=POST');
        }
    });
});
