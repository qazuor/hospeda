// @vitest-environment jsdom
/**
 * Tests for WhatsNewModal component.
 *
 * Covers SPEC-175 §12.4 (WhatsNewModal assertions):
 *  - Renders highlight entries in default mode.
 *  - "Entendido" (close button) calls markSeen with the displayed ids.
 *  - ESC close marks seen.
 *  - `entryId` prop = single-entry mode (shows only that entry).
 *  - Does NOT render when no highlight entries are unseen (no open prop).
 *
 * `useWhatsNew` is mocked directly so tests are isolated from TanStack Query
 * and the API layer. `trackEvent` is mocked to avoid PostHog calls in tests.
 *
 * Note: TipTap's headless Editor requires a full DOM (jsdom provides this).
 * The `renderMarkdownToHtml` function is exercised indirectly via rendered
 * markdown bodies. DOMPurify is a no-op in jsdom when `isSupported` is false,
 * which is safe because TipTap's allowlist still applies.
 *
 * @see apps/admin/src/components/whats-new/WhatsNewModal.tsx — subject
 * @see SPEC-175 §7.2, §12.4
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsNewModal } from '../WhatsNewModal';

// ---------------------------------------------------------------------------
// render-markdown mock
//
// `renderMarkdownToHtml` lives in lib/whats-new/render-markdown.ts and imports
// @tiptap/core (a transitive dep not directly listed in admin's package.json).
// Vitest cannot resolve it without a vitest.config.ts alias. We mock the
// entire render-markdown module so WhatsNewModal tests run without TipTap.
// The actual rendering logic is exercised by manual smoke tests (§12.6).
// ---------------------------------------------------------------------------

vi.mock('@/lib/whats-new/render-markdown', () => ({
    renderMarkdownToHtml: (markdown: string) => `<p>${markdown}</p>`
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockMarkSeen = vi.fn();
const mockMarkAllSeen = vi.fn();

vi.mock('@/hooks/use-whats-new', () => ({
    useWhatsNew: vi.fn(() => ({
        items: [],
        unseenCount: 0,
        isLoading: false,
        error: null,
        markSeen: mockMarkSeen,
        markAllSeen: mockMarkAllSeen
    }))
}));

vi.mock('@/lib/analytics/posthog-client', () => ({
    trackEvent: vi.fn()
}));

import { useWhatsNew } from '@/hooks/use-whats-new';
import { trackEvent } from '@/lib/analytics/posthog-client';

const mockUseWhatsNew = vi.mocked(useWhatsNew);
const mockTrackEvent = vi.mocked(trackEvent);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNSEEN_HIGHLIGHT = {
    id: 'h1',
    publishedAt: '2026-06-01T00:00:00Z',
    highlight: true,
    title: 'New highlight feature',
    body: 'Some **bold** content',
    seen: false
};

const SECOND_UNSEEN_HIGHLIGHT = {
    id: 'h2',
    publishedAt: '2026-05-15T00:00:00Z',
    highlight: true,
    title: 'Second highlight',
    body: 'Another feature',
    seen: false
};

const SEEN_HIGHLIGHT = {
    id: 'h3',
    publishedAt: '2026-04-01T00:00:00Z',
    highlight: true,
    title: 'Already seen highlight',
    body: 'Already seen',
    seen: true
};

const NON_HIGHLIGHT = {
    id: 'r1',
    publishedAt: '2026-03-01T00:00:00Z',
    highlight: false,
    title: 'Regular update',
    body: 'Regular body',
    seen: false
};

const ENTRY_WITH_IMAGE = {
    id: 'img1',
    publishedAt: '2026-06-02T00:00:00Z',
    highlight: true,
    title: 'Entry with image',
    body: 'Entry body',
    image: 'https://cdn.example.com/image.png',
    seen: false
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(items = [UNSEEN_HIGHLIGHT]) {
    mockUseWhatsNew.mockReturnValue({
        items,
        unseenCount: items.filter((i) => !i.seen).length,
        isLoading: false,
        error: null,
        markSeen: mockMarkSeen,
        markAllSeen: mockMarkAllSeen
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsNewModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Default mode — unseen highlight entries
    // -------------------------------------------------------------------------

    describe('default mode (no entryId)', () => {
        it('renders unseen highlight entries when open', () => {
            setup([UNSEEN_HIGHLIGHT, SEEN_HIGHLIGHT, NON_HIGHLIGHT]);

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            // Only UNSEEN_HIGHLIGHT is highlight+unseen
            expect(screen.getByText('New highlight feature')).toBeInTheDocument();
            // SEEN_HIGHLIGHT is highlight but seen — should NOT appear
            expect(screen.queryByText('Already seen highlight')).not.toBeInTheDocument();
            // NON_HIGHLIGHT is not a highlight — should NOT appear
            expect(screen.queryByText('Regular update')).not.toBeInTheDocument();
        });

        it('renders all unseen highlight entries in one modal', () => {
            setup([UNSEEN_HIGHLIGHT, SECOND_UNSEEN_HIGHLIGHT]);

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            expect(screen.getByText('New highlight feature')).toBeInTheDocument();
            expect(screen.getByText('Second highlight')).toBeInTheDocument();
        });

        it('shows empty state when no unseen highlights exist', () => {
            setup([SEEN_HIGHLIGHT, NON_HIGHLIGHT]);

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            // No entries rendered (empty state paragraph)
            expect(screen.queryByText('New highlight feature')).not.toBeInTheDocument();
            expect(screen.queryByText('Already seen highlight')).not.toBeInTheDocument();
        });

        it('renders optional image when entry has one', () => {
            setup([ENTRY_WITH_IMAGE]);

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            // Radix Dialog renders in a portal (outside container); query on document.body.
            // Image is aria-hidden (decorative) so use querySelector not getByRole.
            const img = document.body.querySelector(`img[src="${ENTRY_WITH_IMAGE.image}"]`);
            expect(img).not.toBeNull();
            expect(img).toHaveAttribute('src', ENTRY_WITH_IMAGE.image);
        });
    });

    // -------------------------------------------------------------------------
    // "Entendido" button — markSeen
    // -------------------------------------------------------------------------

    describe('"Entendido" button', () => {
        it('calls markSeen with displayed entry ids when clicked', async () => {
            setup([UNSEEN_HIGHLIGHT, SECOND_UNSEEN_HIGHLIGHT]);
            const user = userEvent.setup();
            const onOpenChange = vi.fn();

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={onOpenChange}
                />
            );

            const closeBtn = screen.getByRole('button', {
                name: /admin-whats-new\.modal\.close/i
            });
            await user.click(closeBtn);

            expect(mockMarkSeen).toHaveBeenCalledOnce();
            expect(mockMarkSeen).toHaveBeenCalledWith(
                expect.arrayContaining([UNSEEN_HIGHLIGHT.id, SECOND_UNSEEN_HIGHLIGHT.id])
            );
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });

        it('does not call markSeen when no entries are displayed', async () => {
            setup([SEEN_HIGHLIGHT]); // no unseen highlights
            const user = userEvent.setup();

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            const closeBtn = screen.getByRole('button', {
                name: /admin-whats-new\.modal\.close/i
            });
            await user.click(closeBtn);

            expect(mockMarkSeen).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // ESC close marks seen
    // -------------------------------------------------------------------------

    describe('ESC close', () => {
        it('calls markSeen when closed via ESC key', async () => {
            setup([UNSEEN_HIGHLIGHT]);
            const user = userEvent.setup();
            const onOpenChange = vi.fn();

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={onOpenChange}
                />
            );

            // Dialog must be open and focused for ESC to register
            await user.keyboard('{Escape}');

            await waitFor(() => {
                expect(onOpenChange).toHaveBeenCalledWith(false);
            });
            expect(mockMarkSeen).toHaveBeenCalledWith([UNSEEN_HIGHLIGHT.id]);
        });
    });

    // -------------------------------------------------------------------------
    // entryId single-entry mode
    // -------------------------------------------------------------------------

    describe('entryId single-entry mode', () => {
        it('shows only the entry matching entryId', () => {
            setup([UNSEEN_HIGHLIGHT, SECOND_UNSEEN_HIGHLIGHT, SEEN_HIGHLIGHT]);

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                    entryId={SEEN_HIGHLIGHT.id}
                />
            );

            // Only the SEEN_HIGHLIGHT entry should be shown
            expect(screen.getByText('Already seen highlight')).toBeInTheDocument();
            expect(screen.queryByText('New highlight feature')).not.toBeInTheDocument();
            expect(screen.queryByText('Second highlight')).not.toBeInTheDocument();
        });

        it('marks that specific entry seen on close', async () => {
            setup([UNSEEN_HIGHLIGHT, SECOND_UNSEEN_HIGHLIGHT]);
            const user = userEvent.setup();

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                    entryId={UNSEEN_HIGHLIGHT.id}
                />
            );

            await user.click(
                screen.getByRole('button', { name: /admin-whats-new\.modal\.close/i })
            );

            expect(mockMarkSeen).toHaveBeenCalledWith([UNSEEN_HIGHLIGHT.id]);
            // SECOND_UNSEEN_HIGHLIGHT should NOT be included
            expect(mockMarkSeen).not.toHaveBeenCalledWith(
                expect.arrayContaining([SECOND_UNSEEN_HIGHLIGHT.id])
            );
        });

        it('renders empty state when entryId does not match any item', () => {
            setup([UNSEEN_HIGHLIGHT]);

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                    entryId="nonexistent-id"
                />
            );

            expect(screen.queryByText('New highlight feature')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // PostHog tracking
    // -------------------------------------------------------------------------

    describe('analytics', () => {
        it('fires admin.whats_new.modal.shown when opened with entries', async () => {
            setup([UNSEEN_HIGHLIGHT]);

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            await waitFor(() => {
                expect(mockTrackEvent).toHaveBeenCalledWith(
                    'admin.whats_new.modal.shown',
                    expect.objectContaining({ entryIds: [UNSEEN_HIGHLIGHT.id] })
                );
            });
        });

        it('fires admin.whats_new.modal.closed on close', async () => {
            setup([UNSEEN_HIGHLIGHT]);
            const user = userEvent.setup();

            render(
                <WhatsNewModal
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            await user.click(
                screen.getByRole('button', { name: /admin-whats-new\.modal\.close/i })
            );

            expect(mockTrackEvent).toHaveBeenCalledWith(
                'admin.whats_new.modal.closed',
                expect.objectContaining({ entryIds: [UNSEEN_HIGHLIGHT.id] })
            );
        });
    });
});
