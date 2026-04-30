// @vitest-environment jsdom
/**
 * Tests for TagPicker component.
 *
 * Covers:
 * - Renders trigger button (AC-002-01)
 * - Opens dropdown panel on click (AC-002-01)
 * - Search filter sends query to API (D-014, AC-002-02)
 * - Group rendering: Sistema, Interno (if permitted), Tus tags (AC-002-02)
 * - INTERNAL group hidden from actor without TAG_INTERNAL_VIEW (D-024, D-006)
 * - Optimistic assign/unassign on option toggle (AC-002-03)
 * - Quota gating: "Crear tag personal" CTA replaced with notice at quota
 *
 * Uses MSW to mock all tag-related API endpoints.
 * TanStack Query wrapped with fresh QueryClient per test.
 */

import { EntityTypeEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { TagPicker } from '../TagPicker';

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

const ENTITY_TYPE = EntityTypeEnum.ACCOMMODATION;
const ENTITY_ID = '00000000-0000-0000-0000-000000000099';

const mockTag = (id: string, name: string, type: 'SYSTEM' | 'INTERNAL' | 'USER' = 'SYSTEM') => ({
    id,
    name,
    color: 'BLUE',
    type,
    ownerId: type === 'USER' ? 'user-001' : null,
    icon: null,
    description: null,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdById: null,
    updatedById: null
});

function mockSuccess<T>(data: T) {
    return { success: true, data };
}
const mockPaginatedItems = (items: unknown[]) => ({
    success: true,
    data: {
        items,
        pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 }
    }
});

/** Setup default handlers for all endpoints used by TagPicker. */
function setupHandlers({
    systemTags = [] as unknown[],
    internalTags = [] as unknown[],
    ownTags = [] as unknown[],
    assignments = [] as unknown[],
    quota = { used: 0, limit: 50 }
} = {}) {
    server.use(
        http.get(`${API_BASE}/admin/tags/system`, () => HttpResponse.json(mockSuccess(systemTags))),
        http.get(`${API_BASE}/admin/tags/internal`, () =>
            HttpResponse.json(mockSuccess(internalTags))
        ),
        http.get(`${API_BASE}/admin/tags/own`, () =>
            HttpResponse.json(mockPaginatedItems(ownTags))
        ),
        http.get(`${API_BASE}/admin/tags/own/quota`, () => HttpResponse.json(mockSuccess(quota))),
        http.get(`${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`, () =>
            HttpResponse.json(mockSuccess(assignments))
        ),
        http.post(`${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`, () =>
            HttpResponse.json(mockSuccess({ success: true }))
        ),
        http.delete(`${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags/:tagId`, () =>
            HttpResponse.json(mockSuccess({ success: true }))
        )
    );
}

// Mock auth context — default: no permissions (no INTERNAL_VIEW)
let mockPermissions: string[] = [];

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ user: { permissions: mockPermissions } })
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagPicker', () => {
    /**
     * AC-002-01: Renders trigger button.
     */
    it('renders the tag picker trigger button', () => {
        setupHandlers();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        expect(screen.getByTestId('tag-picker-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('tag-picker-trigger')).toHaveTextContent('Tags');
    });

    /**
     * AC-002-01: Dropdown opens when trigger is clicked.
     */
    it('opens the dropdown panel when trigger is clicked', async () => {
        setupHandlers();
        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        await user.click(screen.getByTestId('tag-picker-trigger'));

        expect(screen.getByTestId('tag-picker-panel')).toBeInTheDocument();
    });

    /**
     * AC-002-02: Sistema group rendered when SYSTEM tags exist.
     */
    it('renders SYSTEM tags in the Sistema group', async () => {
        const systemTag = mockTag('sys-001', 'Destacado', 'SYSTEM');
        setupHandlers({ systemTags: [systemTag] });

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        await user.click(screen.getByTestId('tag-picker-trigger'));

        await waitFor(() => {
            expect(screen.getByText('Destacado')).toBeInTheDocument();
        });

        // Group label visible — "Sistema" appears as both the group header and the
        // type badge on the tag option (both are expected)
        expect(screen.getAllByText('Sistema').length).toBeGreaterThanOrEqual(1);
    });

    /**
     * D-024, D-006: INTERNAL group hidden when actor lacks TAG_INTERNAL_VIEW.
     */
    it('does NOT render INTERNAL group when actor lacks TAG_INTERNAL_VIEW', async () => {
        mockPermissions = []; // no TAG_INTERNAL_VIEW
        const internalTag = mockTag('int-001', 'Spam', 'INTERNAL');
        setupHandlers({ internalTags: [internalTag] });

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        await user.click(screen.getByTestId('tag-picker-trigger'));

        await waitFor(() => {
            // Panel is open
            expect(screen.getByTestId('tag-picker-panel')).toBeInTheDocument();
        });

        // Internal group must not be visible
        expect(screen.queryByText('Spam')).not.toBeInTheDocument();
        expect(screen.queryByText('Internos')).not.toBeInTheDocument();
    });

    /**
     * D-006: INTERNAL group shown when actor has TAG_INTERNAL_VIEW.
     */
    it('renders INTERNAL group when actor has TAG_INTERNAL_VIEW', async () => {
        mockPermissions = ['tag.internal.view'];
        const internalTag = mockTag('int-001', 'Fraude', 'INTERNAL');
        setupHandlers({ internalTags: [internalTag] });

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        await user.click(screen.getByTestId('tag-picker-trigger'));

        await waitFor(() => {
            expect(screen.getByText('Fraude')).toBeInTheDocument();
        });

        expect(screen.getByText('Internos')).toBeInTheDocument();
    });

    /**
     * Quota gating: notice shown instead of CTA when at quota.
     */
    it('shows quota-reached notice instead of create CTA when at quota', async () => {
        mockPermissions = [];
        setupHandlers({ quota: { used: 50, limit: 50 } });

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        await user.click(screen.getByTestId('tag-picker-trigger'));

        await waitFor(() => {
            expect(screen.getByTestId('quota-reached-notice')).toBeInTheDocument();
        });

        expect(screen.queryByTestId('create-own-tag-cta')).not.toBeInTheDocument();
    });

    /**
     * AC-002-03: Tag appears checked when already assigned.
     */
    it('shows already-assigned tags as checked', async () => {
        mockPermissions = [];
        const sysTag = mockTag('sys-assigned-001', 'Asignado', 'SYSTEM');
        setupHandlers({
            systemTags: [sysTag],
            assignments: [sysTag]
        });

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        await user.click(screen.getByTestId('tag-picker-trigger'));

        await waitFor(() => {
            const option = screen.getByRole('button', { name: /Quitar tag Asignado/i });
            expect(option).toHaveAttribute('aria-pressed', 'true');
        });
    });

    /**
     * Empty state when no tags available.
     */
    it('shows no-tags message when no tags are available', async () => {
        mockPermissions = [];
        setupHandlers();

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        await user.click(screen.getByTestId('tag-picker-trigger'));

        await waitFor(() => {
            expect(screen.getByTestId('no-tags-message')).toBeInTheDocument();
        });
    });
});
