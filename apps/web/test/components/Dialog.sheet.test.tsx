import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '../../src/components/shared/ui/Dialog.client';
import styles from '../../src/components/shared/ui/Dialog.module.css';
import { resetDialogHistoryForTests } from '../../src/lib/dialog-history';
import { markRouterAgrees } from '../../src/lib/dialog-history.router-sync';
import { __setNavigateImpl } from '../stubs/astro-transitions-client';

function ControlledSheet() {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
            >
                Open inquiry
            </button>
            <Dialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                ariaLabel="Inquiry"
                variant="sheet"
            >
                <button
                    type="button"
                    disabled
                >
                    Disabled
                </button>
                <div hidden>
                    <button type="button">Hidden</button>
                </div>
                <button
                    type="button"
                    tabIndex={-1}
                >
                    Skipped
                </button>
                <button type="button">First action</button>
                <button type="button">Second action</button>
                <button
                    type="button"
                    tabIndex={-2}
                >
                    Skipped after actions
                </button>
            </Dialog>
        </>
    );
}

describe('Dialog sheet', () => {
    it.each([
        { shift: true, from: 'First action', to: 'Second action' },
        { shift: false, from: 'Second action', to: 'First action' }
    ])('wraps Tab from $from to $to without leaving the sheet', async ({ shift, from, to }) => {
        const user = userEvent.setup();
        render(<ControlledSheet />);
        await user.click(screen.getByRole('button', { name: 'Open inquiry' }));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus()
        );
        screen.getByRole('button', { name: from }).focus();

        await user.tab({ shift });

        expect(screen.getByRole('button', { name: to })).toHaveFocus();
    });

    it('uses md sizing and renders a decorative handle inside the modal', () => {
        render(
            <Dialog
                isOpen
                onClose={vi.fn()}
                ariaLabel="Inquiry"
                variant="sheet"
                size="full"
            >
                Content
            </Dialog>
        );

        const panel = screen.getByRole('dialog', { name: 'Inquiry' });

        expect(panel).toHaveAttribute('data-size', 'md');
        expect(panel).toHaveAttribute('data-variant', 'sheet');
        expect(panel).toHaveClass('dialog-panel');
        expect(panel.querySelector(`.${styles.sheetHandle}`)).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });

    it.each([
        'Escape',
        'backdrop',
        'Back'
    ] as const)('focuses the first eligible control and restores trigger focus after %s', async (dismissal) => {
        const url = window.location.href;
        const state = window.history.state;
        const meta = document.createElement('meta');
        if (dismissal === 'Back') {
            meta.name = 'astro-view-transitions-enabled';
            document.head.append(meta);
            window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', url);
            markRouterAgrees();
            __setNavigateImpl((href, options) => {
                const claim = options as { readonly state: Record<string, unknown> };
                window.history.pushState(
                    { ...claim.state, index: 1, scrollX: 0, scrollY: 0 },
                    '',
                    href
                );
            });
        }
        const user = userEvent.setup();
        const { unmount } = render(<ControlledSheet />);
        const trigger = screen.getByRole('button', { name: 'Open inquiry' });

        try {
            await user.click(trigger);
            const first = screen.getByRole('button', { name: 'First action' });
            await waitFor(() => expect(first).toHaveFocus());
            await user.click(first);
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            if (dismissal === 'Back') {
                await waitFor(() => expect(window.location.hash).toMatch(/^#hospeda-dialog-/));
                await act(async () => {
                    const popped = new Promise<void>((resolve) => {
                        window.addEventListener('popstate', () => resolve(), { once: true });
                    });
                    window.history.back();
                    await popped;
                });
                expect(window.location.href).toBe(url);
            } else if (dismissal === 'Escape') {
                await user.keyboard('{Escape}');
            } else {
                fireEvent.click(screen.getByRole('presentation'));
            }

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(trigger).toHaveFocus();
        } finally {
            unmount();
            if (dismissal === 'Back') {
                meta.remove();
                __setNavigateImpl(null);
                resetDialogHistoryForTests();
                window.history.replaceState(state, '', url);
            }
        }
    });

    it.each([
        'sheet',
        'solid',
        'transparent'
    ] as const)('focuses the panel root for %s when appropriate', async (variant) => {
        render(
            <Dialog
                isOpen
                onClose={vi.fn()}
                ariaLabel="Inquiry"
                variant={variant}
            >
                {variant === 'sheet' ? (
                    <button
                        type="button"
                        disabled
                    >
                        Unavailable
                    </button>
                ) : (
                    <button type="button">Action</button>
                )}
            </Dialog>
        );

        await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    });

    it('anchors the sheet at the mobile breakpoint and opts into motion only when allowed', () => {
        const css = readFileSync('src/components/shared/ui/Dialog.module.css', 'utf8');
        const mobile = css.split('@media (max-width: 767px)')[1];

        expect(mobile).toMatch(
            /\.overlay:has\(\.panel\[data-variant="sheet"\]\)\s*\{[^}]*align-items: flex-end;[^}]*padding: 0;/
        );
        expect(mobile).toMatch(
            /\.panel\[data-variant="sheet"\]\s*\{[^}]*--dialog-max-height: 90dvh;[^}]*max-width: none;[^}]*border-radius: var\(--radius-card\) var\(--radius-card\) 0 0;/
        );
        expect(mobile).toMatch(
            /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.panel\[data-variant="sheet"\]\s*\{\s*animation: dialogSheetIn/
        );
        expect(css).toMatch(
            /@keyframes dialogSheetIn\s*\{\s*from\s*\{\s*transform: translateY\(100%\);\s*\}\s*to\s*\{\s*transform: translateY\(0\);/
        );
    });
});
