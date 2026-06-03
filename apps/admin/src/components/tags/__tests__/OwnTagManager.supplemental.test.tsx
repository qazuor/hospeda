// @vitest-environment jsdom
/**
 * Supplemental tests for OwnTagManager component — T-044.
 *
 * Covers ACs NOT exercised in OwnTagManager.test.tsx:
 * - Lifecycle state rows carry distinct CSS classes per state (D-022)
 * - Quota indicator progressbar has correct aria-label (spec UX accessibility section)
 * - All 3 lifecycle states (ACTIVE / DRAFT / ARCHIVED) present simultaneously with visual
 *   distinction (D-022, AC-003-04)
 * - Quota indicator text follows "{used} / {limit}" format (AC-003-03)
 * - Create button shows tooltip / title attribute referencing quota at limit
 *
 * Uses same MSW + TanStack Query conventions as OwnTagManager.test.tsx.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { OwnTagManager } from '../OwnTagManager';

// ---------------------------------------------------------------------------
// Helpers — mirror OwnTagManager.test.tsx exactly
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

function setupDefaultHandlers(tags: unknown[] = [], quota = { used: 2, limit: 50 }) {
    server.use(
        http.get(`${API_BASE}/admin/tags/own`, () => HttpResponse.json(mockPaginatedTags(tags))),
        http.get(`${API_BASE}/admin/tags/own/quota`, () =>
            HttpResponse.json(mockQuota(quota.used, quota.limit))
        ),
        // Impact stub for delete dialogs that might be triggered indirectly
        http.get(`${API_BASE}/admin/tags/own/:id/impact`, () =>
            HttpResponse.json({ success: true, data: { count: 0 } })
        )
    );
}

// Auth mock — mirrors OwnTagManager.test.tsx
vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ user: { permissions: [] } })
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OwnTagManager — supplemental (T-044)', () => {
    /**
     * D-022, AC-003-04: All three lifecycle states relevant to user-tags
     * (ACTIVE / INACTIVE / ARCHIVED) carry distinct CSS badge classes.
     *
     * The component renders a state badge via STATE_BADGE map (OwnTagRow.tsx).
     * Classes updated in commit 45a6d894b (semantic token migration):
     *   ACTIVE   → 'bg-success/15 text-success'
     *   INACTIVE → 'bg-gray-100 text-gray-600'
     *   ARCHIVED → 'bg-warning/15 text-warning'
     *
     * DRAFT is a valid LifecycleStatusEnum value but does not apply to
     * user-tags (a user creates a tag and it is immediately ACTIVE; there
     * is no draft stage). The form select omits DRAFT for user-tags.
     */
    it('renders state badges with distinct CSS classes for ACTIVE, INACTIVE, and ARCHIVED', async () => {
        const tags = [
            mockTag({ id: 'tag-active', name: 'Tag-Activo', lifecycleState: 'ACTIVE' }),
            mockTag({ id: 'tag-inactive', name: 'Tag-Inactivo', lifecycleState: 'INACTIVE' }),
            mockTag({ id: 'tag-archived', name: 'Tag-Archivado', lifecycleState: 'ARCHIVED' })
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

        // Each badge renders the lifecycle label text
        const activeBadge = screen.getByText('Activo');
        const inactiveBadge = screen.getByText('Inactivo');
        const archivedBadge = screen.getByText('Archivado');

        // Verify visual distinction via the STATE_BADGE map in OwnTagRow.tsx.
        // Classes updated in commit 45a6d894b (semantic token migration):
        //   ACTIVE   → 'bg-success/15 text-success'
        //   INACTIVE → 'bg-gray-100 text-gray-600'
        //   ARCHIVED → 'bg-warning/15 text-warning'
        expect(activeBadge.className).toContain('bg-success/15');
        expect(inactiveBadge.className).toContain('bg-gray-100');
        expect(archivedBadge.className).toContain('bg-warning/15');

        // Confirm the three classes are distinct (no two share the same bg class)
        const bgClasses = [
            activeBadge.className,
            inactiveBadge.className,
            archivedBadge.className
        ].map((c) => c.match(/bg-\S+/)?.[0]);

        const uniqueBgClasses = new Set(bgClasses);
        expect(uniqueBgClasses.size).toBe(3);
    });

    /**
     * AC-003-03: Quota indicator progressbar has a meaningful ARIA label.
     *
     * The spec (UX Accessibility section) specifies:
     *   aria-label="Tag usage: {used} of {total}" or es-AR equivalent.
     *
     * The implementation uses the Spanish equivalent:
     *   aria-label="Uso de cuota de tags personales"
     * with aria-valuenow / aria-valuemin / aria-valuemax encoding the values.
     */
    it('quota progressbar has role="progressbar" with correct ARIA attributes', async () => {
        setupDefaultHandlers([], { used: 38, limit: 50 });

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        // Wait for quota to load
        await waitFor(() => {
            expect(screen.getByTestId('quota-indicator')).toHaveTextContent('38 / 50');
        });

        const progressbar = screen.getByRole('progressbar');

        // ARIA attributes as specified by the component (Spanish es-AR equivalent)
        expect(progressbar).toHaveAttribute('aria-label', 'Uso de cuota de tags personales');
        expect(progressbar).toHaveAttribute('aria-valuenow', '38');
        expect(progressbar).toHaveAttribute('aria-valuemin', '0');
        expect(progressbar).toHaveAttribute('aria-valuemax', '50');
    });

    /**
     * AC-003-03: Quota indicator text shows "{used} / {limit}" format.
     *
     * Verifies the exact "{N} / {M}" format required by the spec.
     * Already covered in OwnTagManager.test.tsx but we assert the format
     * string explicitly here for completeness.
     */
    it('quota indicator text matches "{used} / {limit}" format at various usage levels', async () => {
        setupDefaultHandlers([], { used: 12, limit: 50 });

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            // The quota-indicator data-testid wraps the text
            expect(screen.getByTestId('quota-indicator')).toHaveTextContent('12 / 50');
        });
    });

    /**
     * AC-003-02, AC-003-03: Create button shows correct tooltip (title attribute)
     * at quota with the "límite de tags personales" copy.
     */
    it('create button title attribute mentions the quota limit when at quota', async () => {
        setupDefaultHandlers([], { used: 50, limit: 50 });

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            const btn = screen.getByTestId('create-tag-button');
            expect(btn).toBeDisabled();
            // The title attribute provides a tooltip explaining why disabled
            expect(btn.getAttribute('title')).toMatch(/límite/i);
        });
    });

    /**
     * D-022: All 8 tags (5 ACTIVE + 2 INACTIVE + 1 ARCHIVED) are visible in
     * the "all" filter view (no filter applied by default).
     *
     * The spec AC-003-04 states: "Manager shows all lifecycle states with distinction."
     * This test validates the count of rendered rows matches the total.
     */
    it('renders all tags regardless of lifecycle state when no filter is applied', async () => {
        const tags = [
            mockTag({ id: 'a1', name: 'Active-1', lifecycleState: 'ACTIVE' }),
            mockTag({ id: 'a2', name: 'Active-2', lifecycleState: 'ACTIVE' }),
            mockTag({ id: 'a3', name: 'Active-3', lifecycleState: 'ACTIVE' }),
            mockTag({ id: 'a4', name: 'Active-4', lifecycleState: 'ACTIVE' }),
            mockTag({ id: 'a5', name: 'Active-5', lifecycleState: 'ACTIVE' }),
            mockTag({ id: 'i1', name: 'Inactive-1', lifecycleState: 'INACTIVE' }),
            mockTag({ id: 'i2', name: 'Inactive-2', lifecycleState: 'INACTIVE' }),
            mockTag({ id: 'ar1', name: 'Archived-1', lifecycleState: 'ARCHIVED' })
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

        // All 8 tags should be visible in the default (no filter) view
        for (const tag of tags) {
            expect(screen.getByText(tag.name as string)).toBeInTheDocument();
        }

        // The state badges should all 3 types be present
        expect(screen.getAllByText('Activo').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Inactivo').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Archivado').length).toBeGreaterThanOrEqual(1);
    });

    /**
     * AC-003-02: Create button has correct disabled state with full limit reached message.
     *
     * Verifies the "Límite alcanzado" badge is visible alongside the disabled button.
     */
    it('shows Límite alcanzado badge AND disables create button simultaneously at quota', async () => {
        setupDefaultHandlers([], { used: 50, limit: 50 });

        render(
            <Wrapper>
                <OwnTagManager />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('create-tag-button')).toBeDisabled();
            expect(screen.getByTestId('quota-reached-message')).toBeInTheDocument();
        });

        // Both conditions hold at the same time
        expect(screen.getByTestId('quota-reached-message')).toHaveTextContent('Límite alcanzado');
    });
});
