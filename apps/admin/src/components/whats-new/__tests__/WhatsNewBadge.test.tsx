// @vitest-environment jsdom
/**
 * Tests for WhatsNewBadge component.
 *
 * Covers SPEC-175 §12.4 (WhatsNewBadge assertions):
 *  - Count pill shown when unseenCount > 0.
 *  - Count pill hidden when unseenCount === 0.
 *  - Clicking the button opens WhatsNewPanel.
 *  - aria-label uses correct i18n key based on count.
 *
 * `useWhatsNew` is mocked directly. WhatsNewPanel is mocked to avoid
 * Sheet + TipTap complexity in badge unit tests.
 *
 * @see apps/admin/src/components/whats-new/WhatsNewBadge.tsx — subject
 * @see SPEC-175 §7.3, §12.4
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsNewBadge } from '../WhatsNewBadge';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-whats-new', () => ({
    useWhatsNew: vi.fn(() => ({
        items: [],
        unseenCount: 0,
        isLoading: false,
        error: null,
        markSeen: vi.fn(),
        markAllSeen: vi.fn()
    }))
}));

// Mock WhatsNewPanel so badge tests don't depend on Sheet/TipTap.
vi.mock('../WhatsNewPanel', () => ({
    WhatsNewPanel: ({
        open,
        onOpenChange
    }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
        <button
            type="button"
            data-testid="whats-new-panel"
            data-open={String(open)}
            onClick={() => onOpenChange(false)}
        />
    )
}));

import { useWhatsNew } from '@/hooks/use-whats-new';

const mockUseWhatsNew = vi.mocked(useWhatsNew);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupHook(unseenCount: number) {
    mockUseWhatsNew.mockReturnValue({
        items: [],
        unseenCount,
        isLoading: false,
        error: null,
        markSeen: vi.fn(),
        markAllSeen: vi.fn()
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsNewBadge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Count pill visibility
    // The pill is rendered as a <span aria-hidden="true"> inside .relative.
    // We query it specifically by its sibling relationship with the button.
    // -------------------------------------------------------------------------

    describe('count pill', () => {
        it('shows count pill when unseenCount > 0', () => {
            setupHook(3);

            const { container } = render(<WhatsNewBadge />);

            // The pill is the span sibling of the button inside the .relative wrapper.
            // It follows the <button> inside .relative (not inside the button itself).
            const pill = container.querySelector('.relative > span[aria-hidden="true"]');
            expect(pill).not.toBeNull();
            expect(pill?.textContent).toContain('3');
        });

        it('hides count pill when unseenCount === 0', () => {
            setupHook(0);

            const { container } = render(<WhatsNewBadge />);

            // When unseenCount is 0 the pill span is not rendered at all.
            const pill = container.querySelector('.relative > span[aria-hidden="true"]');
            expect(pill).toBeNull();
        });

        it('shows "99+" when unseenCount > 99', () => {
            setupHook(150);

            const { container } = render(<WhatsNewBadge />);

            const pill = container.querySelector('.relative > span[aria-hidden="true"]');
            expect(pill?.textContent).toBe('99+');
        });

        it('shows exact count when unseenCount is 99', () => {
            setupHook(99);

            const { container } = render(<WhatsNewBadge />);

            const pill = container.querySelector('.relative > span[aria-hidden="true"]');
            expect(pill?.textContent).toBe('99');
        });
    });

    // -------------------------------------------------------------------------
    // Button click opens panel
    // -------------------------------------------------------------------------

    describe('click opens panel', () => {
        it('opens WhatsNewPanel when button is clicked', async () => {
            setupHook(2);
            const user = userEvent.setup();

            render(<WhatsNewBadge />);

            // Panel starts closed
            const panel = screen.getByTestId('whats-new-panel');
            expect(panel).toHaveAttribute('data-open', 'false');

            // Click the badge button
            const button = screen.getByRole('button', {
                // aria-label uses badge.label key with count interpolation
                name: /admin-whats-new\.badge\.label/i
            });
            await user.click(button);

            expect(panel).toHaveAttribute('data-open', 'true');
        });

        it('opens panel even when unseenCount === 0', async () => {
            setupHook(0);
            const user = userEvent.setup();

            render(<WhatsNewBadge />);

            const button = screen.getByRole('button', {
                name: /admin-whats-new\.badge\.labelNone/i
            });
            await user.click(button);

            expect(screen.getByTestId('whats-new-panel')).toHaveAttribute('data-open', 'true');
        });
    });

    // -------------------------------------------------------------------------
    // aria-label
    // -------------------------------------------------------------------------

    describe('aria-label', () => {
        it('uses badge.label when unseenCount > 0', () => {
            setupHook(5);

            render(<WhatsNewBadge />);

            // useTranslations mock returns the key as-is (plus interpolation arg).
            // Query specifically the badge trigger button (has SparkleIcon inside).
            const sparkle = screen.getByTestId('icon-SparkleIcon');
            const button = sparkle.closest('button');
            expect(button?.getAttribute('aria-label')).toContain('admin-whats-new.badge.label');
        });

        it('uses badge.labelNone when unseenCount === 0', () => {
            setupHook(0);

            render(<WhatsNewBadge />);

            const sparkle = screen.getByTestId('icon-SparkleIcon');
            const button = sparkle.closest('button');
            expect(button?.getAttribute('aria-label')).toBe('admin-whats-new.badge.labelNone');
        });
    });

    // -------------------------------------------------------------------------
    // SparkleIcon rendered
    // -------------------------------------------------------------------------

    it('renders SparkleIcon', () => {
        setupHook(0);

        render(<WhatsNewBadge />);

        expect(screen.getByTestId('icon-SparkleIcon')).toBeInTheDocument();
    });
});
