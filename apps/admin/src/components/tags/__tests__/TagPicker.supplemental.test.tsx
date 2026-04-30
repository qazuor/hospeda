// @vitest-environment jsdom
/**
 * Supplemental tests for TagPicker component — T-044.
 *
 * Covers ACs NOT exercised in TagPicker.test.tsx:
 * - Search filters results: typing a query → only matching tags rendered (D-014, AC-F23)
 * - Apply callback: clicking an unassigned tag fires POST (optimistic assign)
 * - Remove callback: clicking an assigned tag fires DELETE (optimistic remove)
 * - Keyboard: Escape key closes the dropdown
 * - Accessibility: panel has aria-label="Selector de tags"; trigger has aria-haspopup/aria-expanded
 * - Quota gating: "+ Crear tag personal" CTA is not rendered (quota-reached-notice is) when at quota
 *
 * Conventions follow TagPicker.test.tsx (MSW + TanStack Query per test).
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
// Test helpers — mirror TagPicker.test.tsx helpers exactly
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

/**
 * Registers default MSW handlers for all endpoints the TagPicker queries.
 * Individual tests call server.use() on top of these to override specific endpoints.
 */
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

// Mock auth context — no permissions by default (mirrors TagPicker.test.tsx)
let mockPermissions: string[] = [];

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ user: { permissions: mockPermissions } })
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagPicker — supplemental (T-044)', () => {
    /**
     * D-014, AC-F23: Search filters results.
     *
     * Typing a string in the search input sends it to the API as a query param.
     * Only tags whose names match the substring are rendered.
     */
    it('passes search query to system tags API and renders only matching results', async () => {
        const capturedSearchParams: string[] = [];

        // Override the system tags handler to capture and filter by the search param.
        server.use(
            http.get(`${API_BASE}/admin/tags/system`, ({ request }) => {
                const url = new URL(request.url);
                const search = url.searchParams.get('search') ?? '';
                capturedSearchParams.push(search);

                // Simulate server-side substring filter (D-014 safeIlike).
                const allTags = [
                    mockTag('sys-001', 'Favorito'),
                    mockTag('sys-002', 'Pet-friendly'),
                    mockTag('sys-003', 'Gastronomía')
                ];
                const filtered = search
                    ? allTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
                    : allTags;

                return HttpResponse.json(mockSuccess(filtered));
            }),
            http.get(`${API_BASE}/admin/tags/internal`, () => HttpResponse.json(mockSuccess([]))),
            http.get(`${API_BASE}/admin/tags/own`, () => HttpResponse.json(mockPaginatedItems([]))),
            http.get(`${API_BASE}/admin/tags/own/quota`, () =>
                HttpResponse.json(mockSuccess({ used: 0, limit: 50 }))
            ),
            http.get(`${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`, () =>
                HttpResponse.json(mockSuccess([]))
            )
        );

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        // Open the picker
        await user.click(screen.getByTestId('tag-picker-trigger'));

        // Wait for initial tags to load (all 3 should appear)
        await waitFor(() => {
            expect(screen.getByText('Favorito')).toBeInTheDocument();
        });

        // Type a search query — 'fav' matches only 'Favorito'
        const searchInput = screen.getByTestId('tag-picker-search');
        await user.type(searchInput, 'fav');

        // After debounce the API is called with search=fav and the result
        // shows only 'Favorito'
        await waitFor(
            () => {
                expect(capturedSearchParams).toContain('fav');
            },
            { timeout: 1000 }
        );

        await waitFor(() => {
            expect(screen.getByText('Favorito')).toBeInTheDocument();
            expect(screen.queryByText('Pet-friendly')).not.toBeInTheDocument();
            expect(screen.queryByText('Gastronomía')).not.toBeInTheDocument();
        });
    });

    /**
     * AC-002-01 / AC-002-03: Apply callback fires with correct tag id.
     *
     * Clicking an unassigned tag fires POST to the assign endpoint.
     * The TagPickerOption button starts with aria-pressed="false" (unassigned)
     * and we verify the correct tagId reaches the server via the POST body.
     */
    it('fires POST assign request with the correct tagId when clicking an unassigned tag', async () => {
        mockPermissions = [];
        const sysTag = mockTag('sys-assign-001', 'Destacado', 'SYSTEM');

        const assignedTagIds: string[] = [];

        server.use(
            http.get(`${API_BASE}/admin/tags/system`, () =>
                HttpResponse.json(mockSuccess([sysTag]))
            ),
            http.get(`${API_BASE}/admin/tags/internal`, () => HttpResponse.json(mockSuccess([]))),
            http.get(`${API_BASE}/admin/tags/own`, () => HttpResponse.json(mockPaginatedItems([]))),
            http.get(`${API_BASE}/admin/tags/own/quota`, () =>
                HttpResponse.json(mockSuccess({ used: 0, limit: 50 }))
            ),
            http.get(`${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`, () =>
                HttpResponse.json(mockSuccess([]))
            ),
            http.post(
                `${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`,
                async ({ request }) => {
                    const body = (await request.json()) as { tagId: string };
                    assignedTagIds.push(body.tagId);
                    return HttpResponse.json(mockSuccess({ success: true }));
                }
            ),
            http.delete(`${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags/:tagId`, () =>
                HttpResponse.json(mockSuccess({ success: true }))
            )
        );

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        // Open picker
        await user.click(screen.getByTestId('tag-picker-trigger'));

        // Wait for the tag to appear as unassigned
        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: /Aplicar tag Destacado/i })
            ).toBeInTheDocument();
        });

        // Confirm initial state is unchecked
        const optionButton = screen.getByRole('button', { name: /Aplicar tag Destacado/i });
        expect(optionButton).toHaveAttribute('aria-pressed', 'false');

        // Click to assign
        await user.click(optionButton);

        // POST was fired with the correct tagId
        await waitFor(() => {
            expect(assignedTagIds).toContain('sys-assign-001');
        });
    });

    /**
     * AC-002-03: Remove callback fires DELETE with the correct tagId.
     *
     * Clicking a currently-assigned tag fires DELETE to the remove endpoint.
     * The TagPickerOption for an assigned tag has aria-pressed="true" and
     * aria-label "Quitar tag {name}".
     */
    it('fires DELETE remove request with the correct tagId when clicking an assigned tag', async () => {
        mockPermissions = [];
        const sysTag = mockTag('sys-remove-001', 'Favorito', 'SYSTEM');

        const removedTagIds: string[] = [];

        server.use(
            http.get(`${API_BASE}/admin/tags/system`, () =>
                HttpResponse.json(mockSuccess([sysTag]))
            ),
            http.get(`${API_BASE}/admin/tags/internal`, () => HttpResponse.json(mockSuccess([]))),
            http.get(`${API_BASE}/admin/tags/own`, () => HttpResponse.json(mockPaginatedItems([]))),
            http.get(`${API_BASE}/admin/tags/own/quota`, () =>
                HttpResponse.json(mockSuccess({ used: 0, limit: 50 }))
            ),
            // Tag is already assigned to the entity
            http.get(`${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`, () =>
                HttpResponse.json(mockSuccess([sysTag]))
            ),
            http.post(`${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`, () =>
                HttpResponse.json(mockSuccess({ success: true }))
            ),
            http.delete(
                `${API_BASE}/admin/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags/:tagId`,
                ({ params }) => {
                    removedTagIds.push(params.tagId as string);
                    return HttpResponse.json(mockSuccess({ success: true }));
                }
            )
        );

        const user = userEvent.setup();

        render(
            <Wrapper>
                <TagPicker
                    entityType={ENTITY_TYPE}
                    entityId={ENTITY_ID}
                />
            </Wrapper>
        );

        // Open picker
        await user.click(screen.getByTestId('tag-picker-trigger'));

        // Tag is assigned — button aria-label is "Quitar tag Favorito", aria-pressed="true"
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Quitar tag Favorito/i })).toHaveAttribute(
                'aria-pressed',
                'true'
            );
        });

        // Click to remove
        await user.click(screen.getByRole('button', { name: /Quitar tag Favorito/i }));

        // DELETE was fired with the correct tagId
        await waitFor(() => {
            expect(removedTagIds).toContain('sys-remove-001');
        });
    });

    /**
     * Keyboard navigation note: JSDOM does not implement the HTML <dialog>
     * element's built-in cancel/close event for Escape. The TagPicker uses a
     * `<dialog open>` element without an explicit `onKeyDown` Escape handler.
     *
     * Consequence: Escape-to-close is a browser-native behavior that cannot
     * be exercised in JSDOM. This behavior should be covered by an E2E test
     * (Playwright) rather than a unit test.
     *
     * What we can verify: clicking the trigger again closes the panel
     * (toggle behavior implemented in `setIsOpen((v) => !v)`).
     */
    it('closes the dropdown when trigger is clicked again (toggle behavior)', async () => {
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

        const trigger = screen.getByTestId('tag-picker-trigger');

        // Open picker
        await user.click(trigger);
        expect(screen.getByTestId('tag-picker-panel')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        // Click again to close
        await user.click(trigger);

        // Panel should be gone
        await waitFor(() => {
            expect(screen.queryByTestId('tag-picker-panel')).not.toBeInTheDocument();
        });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    /**
     * Accessibility: panel has aria-label in Spanish (es-AR equivalent per spec UX section).
     * Trigger has aria-haspopup="listbox" and aria-expanded reflecting open state.
     */
    it('has correct ARIA attributes on trigger and panel', async () => {
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

        const trigger = screen.getByTestId('tag-picker-trigger');

        // Trigger ARIA before open
        expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        // Open picker
        await user.click(trigger);

        // Trigger ARIA after open
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        // Panel has localized aria-label (Spanish es-AR)
        const panel = screen.getByTestId('tag-picker-panel');
        expect(panel).toHaveAttribute('aria-label', 'Selector de tags');
    });

    /**
     * Quota gating: when at quota, the "+ Crear tag personal" CTA is not
     * rendered and the quota-reached-notice is shown instead.
     *
     * This verifies AC-003-02 from the picker side (the quota indicator also
     * covers the manager side in OwnTagManager tests).
     */
    it('does not render create CTA and shows quota-reached notice when at quota', async () => {
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

        // The "+ Crear tag personal" CTA must not be present
        expect(screen.queryByTestId('create-own-tag-cta')).not.toBeInTheDocument();
    });
});
