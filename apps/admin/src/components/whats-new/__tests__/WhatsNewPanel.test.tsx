// @vitest-environment jsdom
/**
 * Tests for WhatsNewPanel component.
 *
 * Covers SPEC-175 §12.4 (WhatsNewPanel assertions):
 *  - "Marcar todo como leído" calls markAllSeen and is disabled when unseenCount===0.
 *  - Empty state renders when items.length === 0.
 *  - Row click opens WhatsNewModal with the correct entryId.
 *  - PostHog `admin.whats_new.panel.opened` fires on open.
 *
 * `useWhatsNew` is mocked directly. `trackEvent` is mocked to avoid PostHog calls.
 *
 * @see apps/admin/src/components/whats-new/WhatsNewPanel.tsx — subject
 * @see SPEC-175 §7.4, §12.4
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsNewPanel } from '../WhatsNewPanel';

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

// Mock WhatsNewModal to avoid TipTap/DOMPurify in unit tests.
// We only care that it receives the correct entryId prop.
vi.mock('../WhatsNewModal', () => ({
    WhatsNewModal: ({ open, entryId }: { open: boolean; entryId?: string }) =>
        open ? (
            <div
                data-testid="whats-new-modal"
                data-entry-id={entryId ?? 'none'}
            />
        ) : null
}));

import { useWhatsNew } from '@/hooks/use-whats-new';
import { trackEvent } from '@/lib/analytics/posthog-client';

const mockUseWhatsNew = vi.mocked(useWhatsNew);
const mockTrackEvent = vi.mocked(trackEvent);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNSEEN_ENTRY = {
    id: 'u1',
    publishedAt: '2026-06-01T00:00:00Z',
    highlight: true,
    title: 'Unseen entry',
    body: 'Unseen body',
    seen: false
};

const SEEN_ENTRY = {
    id: 's1',
    publishedAt: '2026-05-01T00:00:00Z',
    highlight: false,
    title: 'Seen entry',
    body: 'Seen body',
    seen: true
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupHook(items: (typeof UNSEEN_ENTRY)[], unseenCount?: number) {
    mockUseWhatsNew.mockReturnValue({
        items,
        unseenCount: unseenCount ?? items.filter((i) => !i.seen).length,
        isLoading: false,
        error: null,
        markSeen: mockMarkSeen,
        markAllSeen: mockMarkAllSeen
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsNewPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Empty state
    // -------------------------------------------------------------------------

    describe('empty state', () => {
        it('shows empty state text when items list is empty', () => {
            setupHook([]);

            render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            // i18n key returned as-is by the mock useTranslations
            expect(screen.getByText('admin-whats-new.panel.empty')).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // markAllRead button
    // -------------------------------------------------------------------------

    describe('"Marcar todo como leído" button', () => {
        it('calls markAllSeen when clicked', async () => {
            setupHook([UNSEEN_ENTRY], 1);
            const user = userEvent.setup();

            render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            const btn = screen.getByRole('button', {
                name: /admin-whats-new\.panel\.markAllRead/i
            });
            await user.click(btn);

            expect(mockMarkAllSeen).toHaveBeenCalledOnce();
        });

        it('is disabled when unseenCount === 0', () => {
            setupHook([SEEN_ENTRY], 0);

            render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            const btn = screen.getByRole('button', {
                name: /admin-whats-new\.panel\.markAllRead/i
            });
            expect(btn).toBeDisabled();
        });

        it('is enabled when unseenCount > 0', () => {
            setupHook([UNSEEN_ENTRY], 1);

            render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            const btn = screen.getByRole('button', {
                name: /admin-whats-new\.panel\.markAllRead/i
            });
            expect(btn).not.toBeDisabled();
        });
    });

    // -------------------------------------------------------------------------
    // Row click opens modal with entryId
    // -------------------------------------------------------------------------

    describe('row click', () => {
        it('opens WhatsNewModal with the clicked entryId', async () => {
            setupHook([UNSEEN_ENTRY, SEEN_ENTRY]);
            const user = userEvent.setup();

            render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            // Click the row for UNSEEN_ENTRY
            const rowBtn = screen.getByRole('button', {
                name: new RegExp(UNSEEN_ENTRY.title)
            });
            await user.click(rowBtn);

            await waitFor(() => {
                const modal = screen.getByTestId('whats-new-modal');
                expect(modal).toBeInTheDocument();
                expect(modal).toHaveAttribute('data-entry-id', UNSEEN_ENTRY.id);
            });
        });

        it('opens WhatsNewModal with the correct entryId for a seen entry', async () => {
            setupHook([UNSEEN_ENTRY, SEEN_ENTRY]);
            const user = userEvent.setup();

            render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            const rowBtn = screen.getByRole('button', {
                name: new RegExp(SEEN_ENTRY.title)
            });
            await user.click(rowBtn);

            await waitFor(() => {
                const modal = screen.getByTestId('whats-new-modal');
                expect(modal).toHaveAttribute('data-entry-id', SEEN_ENTRY.id);
            });
        });
    });

    // -------------------------------------------------------------------------
    // PostHog tracking
    // -------------------------------------------------------------------------

    describe('analytics', () => {
        it('fires admin.whats_new.panel.opened when panel opens', async () => {
            setupHook([UNSEEN_ENTRY], 1);

            render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            await waitFor(() => {
                expect(mockTrackEvent).toHaveBeenCalledWith(
                    'admin.whats_new.panel.opened',
                    expect.objectContaining({ unseenCount: 1 })
                );
            });
        });

        it('does NOT re-fire panel.opened when panel stays open', () => {
            setupHook([UNSEEN_ENTRY], 1);

            const { rerender } = render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            // Re-render without changing `open` — event must not fire again.
            rerender(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            expect(mockTrackEvent).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // Unseen / seen visual state
    // -------------------------------------------------------------------------

    describe('entry visual styling', () => {
        it('renders entries from the items list', () => {
            setupHook([UNSEEN_ENTRY, SEEN_ENTRY]);

            render(
                <WhatsNewPanel
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            expect(screen.getByText(UNSEEN_ENTRY.title)).toBeInTheDocument();
            expect(screen.getByText(SEEN_ENTRY.title)).toBeInTheDocument();
        });
    });
});
