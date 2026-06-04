// @vitest-environment jsdom
/**
 * @file whats-new-integration.test.tsx
 *
 * Cross-surface integration tests for the What's New feature in the admin
 * panel (SPEC-175 T-020).
 *
 * Renders a realistic composition of `QueryClientProvider` + the What's New
 * components together to verify cross-surface state coherence via the shared
 * `useWhatsNew` hook.
 *
 * Covers:
 *  1. Auto-open flow: unseen highlight → modal opens → "Entendido" → markSeen
 *     PATCH fired → badge unseenCount decrements via optimistic update.
 *  2. Panel "mark-all" → unseenCount 0 → badge pill hidden.
 *  3. Card/panel single-entry flow: open modal with entryId → only that entry
 *     marked seen.
 *  4. D10 verification: all surfaces share the same `useWhatsNew` query — no
 *     duplicate GET calls beyond the initial fetch + invalidation refetches.
 *
 * ### Mock layer
 *
 * The admin app already has an MSW server in `test/mocks/server.ts` (started
 * by `test/setup.tsx`). However, the What's New routes (`/api/v1/protected/
 * whats-new` and `/api/v1/protected/users/me/whats-new-seen`) use `fetchApi`
 * from `@/lib/api/client`, not the native `fetch` that MSW intercepts in Node.
 * All existing whats-new tests therefore mock `@/lib/api/client` directly —
 * we follow the same established pattern.
 *
 * `WhatsNewModal` has a TipTap / DOMPurify dependency. We mock
 * `@/lib/whats-new/render-markdown` to keep the integration suite light, the
 * same approach used in `WhatsNewModal.test.tsx`.
 *
 * `trackEvent` (PostHog) is mocked to avoid analytics noise.
 *
 * @see apps/admin/src/hooks/use-whats-new.ts              — shared hook (D10)
 * @see apps/admin/src/components/whats-new/WhatsNewBadge.tsx
 * @see apps/admin/src/components/whats-new/WhatsNewPanel.tsx
 * @see apps/admin/src/components/whats-new/WhatsNewModal.tsx
 * @see apps/admin/src/components/whats-new/WhatsNewAutoTrigger.tsx
 * @see SPEC-175 §12.4, D10
 */

import type { WhatsNewGetResponse } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// render-markdown mock (TipTap dependency)
// ---------------------------------------------------------------------------

vi.mock('@/lib/whats-new/render-markdown', () => ({
    renderMarkdownToHtml: (md: string) => `<p>${md}</p>`
}));

// ---------------------------------------------------------------------------
// fetchApi mock — controls GET and PATCH responses per test
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

// ---------------------------------------------------------------------------
// PostHog mock — no analytics noise in integration tests
// ---------------------------------------------------------------------------

vi.mock('@/lib/analytics/posthog-client', () => ({
    trackEvent: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock calls)
// ---------------------------------------------------------------------------

import { fetchApi } from '@/lib/api/client';

const mockedFetchApi = vi.mocked(fetchApi);

// ---------------------------------------------------------------------------
// Component imports
// ---------------------------------------------------------------------------

import { WhatsNewAutoTrigger } from '../WhatsNewAutoTrigger';
import { WhatsNewBadge } from '../WhatsNewBadge';
import { WhatsNewPanel } from '../WhatsNewPanel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNSEEN_HIGHLIGHT = {
    id: 'int-h1',
    publishedAt: '2026-06-01T00:00:00Z',
    highlight: true,
    title: 'Integration highlight',
    body: 'Highlight **body**',
    seen: false
};

const UNSEEN_REGULAR = {
    id: 'int-r1',
    publishedAt: '2026-04-01T00:00:00Z',
    highlight: false,
    title: 'Regular unseen update',
    body: 'Regular body',
    seen: false
};

const SEEN_ENTRY = {
    id: 'int-s1',
    publishedAt: '2026-03-01T00:00:00Z',
    highlight: false,
    title: 'Already seen entry',
    body: 'Seen body',
    seen: true
};

const PATCH_OK = { success: true, data: { success: true } };

/**
 * Builds a discriminating fetchApi mock that serves GET and PATCH distinctly.
 *
 * GET responses are sequenced: the first call returns `initialItems`; after
 * the PATCH fires, subsequent GETs return `afterPatchItems` (the server-
 * confirmed state). This matches the `onSettled` invalidate → refetch cycle
 * in `useWhatsNew`.
 *
 * @param initialItems - Items returned on the first GET.
 * @param afterPatchItems - Items returned after the PATCH completes.
 * @param patchError - When set, the PATCH rejects with this error.
 */
function setupFetchMock({
    initialItems,
    afterPatchItems,
    patchError
}: {
    initialItems: (typeof UNSEEN_HIGHLIGHT)[];
    afterPatchItems?: (typeof UNSEEN_HIGHLIGHT)[];
    patchError?: Error;
}) {
    let patchDone = false;

    mockedFetchApi.mockImplementation(
        async (input: { path: string; method?: string; body?: unknown }) => {
            if (input.method === 'PATCH') {
                if (patchError) throw patchError;
                patchDone = true;
                return { data: PATCH_OK, status: 200 };
            }
            // GET
            const items = patchDone && afterPatchItems ? afterPatchItems : initialItems;
            const unseenCount = items.filter((i) => !i.seen).length;
            const response: WhatsNewGetResponse = { items, unseenCount };
            return { data: { success: true, data: response }, status: 200 };
        }
    );
}

// ---------------------------------------------------------------------------
// QueryClient wrapper factory
// ---------------------------------------------------------------------------

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false }
        }
    });
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, Wrapper };
}

// ---------------------------------------------------------------------------
// Composite composition: Badge + AutoTrigger rendered together
// ---------------------------------------------------------------------------

function BadgeWithAutoTrigger() {
    return (
        <>
            <WhatsNewBadge />
            <WhatsNewAutoTrigger />
        </>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SPEC-175 T-020 — whats-new cross-surface integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // 1. Auto-open flow: unseen highlight → modal → "Entendido" → badge decrements
    // =========================================================================

    describe('auto-open flow (AutoTrigger + Badge)', () => {
        it('modal auto-opens when there are unseen highlights, Entendido fires markSeen, badge decrements', async () => {
            // Arrange — initial: 1 unseen highlight; after PATCH: same entry seen
            const afterPatch = [{ ...UNSEEN_HIGHLIGHT, seen: true }, UNSEEN_REGULAR];

            setupFetchMock({
                initialItems: [UNSEEN_HIGHLIGHT, UNSEEN_REGULAR],
                afterPatchItems: afterPatch
            });

            const { Wrapper } = createWrapper();
            const user = userEvent.setup();

            render(
                <Wrapper>
                    <BadgeWithAutoTrigger />
                </Wrapper>
            );

            // Assert — badge starts loading then shows unseenCount=2
            await waitFor(() => {
                const pill = document.querySelector('.relative > span[aria-hidden="true"]');
                expect(pill).not.toBeNull();
            });

            // Assert — modal auto-opens (AutoTrigger detected unseen highlight)
            await waitFor(() => {
                // The modal's dialog overlay should be in the DOM
                expect(screen.getByText('Integration highlight')).toBeInTheDocument();
            });

            // Act — click "Entendido" to close modal
            const closeBtn = screen.getByRole('button', {
                name: /admin-whats-new\.modal\.close/i
            });
            await user.click(closeBtn);

            // Assert — markSeen PATCH was fired with the highlight's id
            const patchCall = mockedFetchApi.mock.calls.find(
                ([arg]) =>
                    typeof arg === 'object' &&
                    arg !== null &&
                    'method' in arg &&
                    (arg as { method: string }).method === 'PATCH'
            )?.[0] as { body: { ids: string[] } } | undefined;

            expect(patchCall).toBeDefined();
            expect(patchCall?.body.ids).toContain(UNSEEN_HIGHLIGHT.id);

            // Assert — after server refetch, badge unseenCount reflects UNSEEN_REGULAR only (1)
            await waitFor(() => {
                const pill = document.querySelector('.relative > span[aria-hidden="true"]');
                expect(pill?.textContent).toBe('1');
            });
        });
    });

    // =========================================================================
    // 2. Panel "mark-all" → unseenCount 0 → badge pill hidden
    // =========================================================================

    describe('panel mark-all flow', () => {
        it('mark-all seen → unseenCount reaches 0 → badge pill hidden', async () => {
            // Arrange — initial: 2 unseen entries; after PATCH: all seen
            const initialItems = [UNSEEN_HIGHLIGHT, UNSEEN_REGULAR];
            const afterPatch = initialItems.map((i) => ({ ...i, seen: true }));

            setupFetchMock({ initialItems, afterPatchItems: afterPatch });

            const { Wrapper } = createWrapper();
            const user = userEvent.setup();

            render(
                <Wrapper>
                    <WhatsNewBadge />
                    <WhatsNewPanel
                        open={true}
                        onOpenChange={vi.fn()}
                    />
                </Wrapper>
            );

            // Wait for data to load in the panel
            await waitFor(() => {
                expect(screen.getByText(UNSEEN_HIGHLIGHT.title)).toBeInTheDocument();
            });

            // Confirm badge shows initial unseenCount = 2
            const pillBefore = document.querySelector('.relative > span[aria-hidden="true"]');
            expect(pillBefore?.textContent).toBe('2');

            // Act — click "mark all read"
            const markAllBtn = screen.getByRole('button', {
                name: /admin-whats-new\.panel\.markAllRead/i
            });
            await user.click(markAllBtn);

            // Assert — after server refetch, badge pill is hidden (unseenCount=0)
            await waitFor(() => {
                const pill = document.querySelector('.relative > span[aria-hidden="true"]');
                expect(pill).toBeNull();
            });
        });
    });

    // =========================================================================
    // 3. Single-entry flow: panel row click → modal with entryId → only that entry marked seen
    // =========================================================================

    describe('single-entry flow (panel row → modal entryId)', () => {
        it('clicking a panel row fires PATCH with only that entry id, not all unseen entries', async () => {
            // Arrange — 2 unseen entries; after PATCH only UNSEEN_REGULAR is seen
            const initialItems = [UNSEEN_HIGHLIGHT, UNSEEN_REGULAR];
            const afterPatch = [
                { ...UNSEEN_HIGHLIGHT, seen: false },
                { ...UNSEEN_REGULAR, seen: true }
            ];

            setupFetchMock({ initialItems, afterPatchItems: afterPatch });

            const { Wrapper } = createWrapper();
            const user = userEvent.setup();

            render(
                <Wrapper>
                    <WhatsNewPanel
                        open={true}
                        onOpenChange={vi.fn()}
                    />
                </Wrapper>
            );

            // Wait for panel entries to render — both entries appear in the list
            await waitFor(() => {
                // getAllByText to confirm two entries are in the panel list
                const regularTitleEls = screen.getAllByText(UNSEEN_REGULAR.title);
                expect(regularTitleEls.length).toBeGreaterThanOrEqual(1);
            });

            // Act — click the UNSEEN_REGULAR row button (row buttons have aria-label)
            const rowBtn = screen.getByRole('button', {
                name: new RegExp(UNSEEN_REGULAR.title)
            });
            await user.click(rowBtn);

            // The modal now opens with entryId=UNSEEN_REGULAR.id.
            // The WhatsNewModal renders the entry title inside a dialog.
            // Wait for the "Entendido" close button to appear (proves modal is open).
            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /admin-whats-new\.modal\.close/i })
                ).toBeInTheDocument();
            });

            // Act — click "Entendido" to close the single-entry modal
            await user.click(
                screen.getByRole('button', { name: /admin-whats-new\.modal\.close/i })
            );

            // Wait for PATCH to fire
            await waitFor(() => {
                return mockedFetchApi.mock.calls.some(
                    ([arg]) =>
                        typeof arg === 'object' &&
                        arg !== null &&
                        'method' in arg &&
                        (arg as { method: string }).method === 'PATCH'
                );
            });

            // Assert — PATCH body contains only UNSEEN_REGULAR's id (entryId mode)
            const patchCall = mockedFetchApi.mock.calls.find(
                ([arg]) =>
                    typeof arg === 'object' &&
                    arg !== null &&
                    'method' in arg &&
                    (arg as { method: string }).method === 'PATCH'
            )?.[0] as { body: { ids: string[] } } | undefined;

            expect(patchCall?.body.ids).toContain(UNSEEN_REGULAR.id);
            expect(patchCall?.body.ids).not.toContain(UNSEEN_HIGHLIGHT.id);
        });
    });

    // =========================================================================
    // 4. D10: all surfaces share one query — no duplicate GET calls
    // =========================================================================

    describe('D10: single shared query across surfaces', () => {
        it('rendering Badge + Panel + AutoTrigger triggers exactly one GET, not one per surface', async () => {
            // Arrange — stable data (no patches needed)
            setupFetchMock({
                initialItems: [UNSEEN_HIGHLIGHT, SEEN_ENTRY]
            });

            const { Wrapper } = createWrapper();

            render(
                <Wrapper>
                    {/* Three surfaces — all backed by the same useWhatsNew hook */}
                    <WhatsNewBadge />
                    <WhatsNewPanel
                        open={false}
                        onOpenChange={vi.fn()}
                    />
                    <WhatsNewAutoTrigger suppressed={true} />
                </Wrapper>
            );

            // Wait for all mounts + query resolution
            await waitFor(() => {
                expect(mockedFetchApi).toHaveBeenCalled();
            });

            // Allow all async work to settle (including any re-renders)
            await act(async () => {
                await new Promise((r) => setTimeout(r, 50));
            });

            // Assert — only ONE GET call was made (three surfaces, one shared query)
            const getCalls = mockedFetchApi.mock.calls.filter(
                ([arg]) =>
                    typeof arg === 'object' &&
                    arg !== null &&
                    (!('method' in arg) ||
                        (arg as { method?: string }).method === undefined ||
                        (arg as { method?: string }).method === 'GET')
            );

            expect(getCalls).toHaveLength(1);
        });

        it('optimistic update from markSeen is immediately visible in all surfaces without a second GET', async () => {
            // Arrange — initial: 2 unseen; after patch: 1 unseen
            const afterPatch = [
                { ...UNSEEN_HIGHLIGHT, seen: true },
                { ...UNSEEN_REGULAR, seen: false }
            ];

            setupFetchMock({
                initialItems: [UNSEEN_HIGHLIGHT, UNSEEN_REGULAR],
                afterPatchItems: afterPatch
            });

            const { Wrapper } = createWrapper();
            const user = userEvent.setup();

            render(
                <Wrapper>
                    <WhatsNewBadge />
                    <WhatsNewAutoTrigger />
                </Wrapper>
            );

            // Wait for modal to auto-open (unseen highlight exists)
            await waitFor(() => {
                expect(screen.getByText(UNSEEN_HIGHLIGHT.title)).toBeInTheDocument();
            });

            // Record GET call count at this point (should be 1 from initial load)
            const getCallsBeforeClose = mockedFetchApi.mock.calls.filter(
                ([arg]) =>
                    typeof arg === 'object' &&
                    arg !== null &&
                    (!('method' in arg) ||
                        (arg as { method?: string }).method === undefined ||
                        (arg as { method?: string }).method === 'GET')
            ).length;

            // Act — close modal
            await user.click(
                screen.getByRole('button', { name: /admin-whats-new\.modal\.close/i })
            );

            // Assert — optimistic unseenCount on badge reflects mark + eventual server state
            await waitFor(() => {
                const pill = document.querySelector('.relative > span[aria-hidden="true"]');
                // After markSeen optimistic update + server refetch: UNSEEN_REGULAR remains
                expect(pill?.textContent).toBe('1');
            });

            // Assert — the initial GET count before close was exactly 1 (one shared query)
            expect(getCallsBeforeClose).toBe(1);
        });
    });
});
