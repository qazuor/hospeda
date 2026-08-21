/**
 * @file ToastViewport.test.tsx
 * @description Tests the global toast renderer.
 *
 * Covers variant rendering, action wiring, i18n of the close label, the
 * always-mounted aria-live region, hover-pause integration with the store,
 * and the in-place loading -> success transition driven by `updateToast`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastViewport } from '../../../src/components/ui/ToastViewport.client';
import { addToast, clearToasts, getToastTimer, updateToast } from '../../../src/store/toast-store';

/** Flush the exit-animation timeout that delays removal from the store. */
function flushExitAnimation() {
    act(() => {
        vi.advanceTimersByTime(220);
    });
}

describe('ToastViewport', () => {
    beforeEach(() => {
        clearToasts();
        vi.useFakeTimers();
    });

    afterEach(() => {
        clearToasts();
        vi.useRealTimers();
    });

    it('keeps the aria-live region mounted even with no toasts', () => {
        render(<ToastViewport />);
        const region = document.querySelector('[aria-live="polite"]');
        expect(region).not.toBeNull();
    });

    it('renders a toast when one is added to the store', () => {
        const { rerender } = render(<ToastViewport />);
        act(() => {
            addToast({ type: 'info', message: 'Hello world' });
        });
        rerender(<ToastViewport />);
        expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders the primary action as a link when href is provided', () => {
        render(<ToastViewport />);
        act(() => {
            addToast({
                type: 'info',
                message: 'CTA',
                action: { label: 'Sign in', href: '/auth/signin' }
            });
        });
        const link = screen.getByRole('link', { name: 'Sign in' });
        expect(link).toHaveAttribute('href', '/auth/signin');
    });

    it('renders the secondary action alongside the primary', () => {
        render(<ToastViewport />);
        act(() => {
            addToast({
                type: 'info',
                message: 'Two CTAs',
                action: { label: 'Sign in', href: '/auth/signin' },
                secondaryAction: { label: 'View benefits', href: '/beneficios' }
            });
        });
        expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View benefits' })).toBeInTheDocument();
    });

    /**
     * HOS-723 — the primary action must READ first, not just look primary.
     *
     * `.actions` is a plain `display: flex` row with no `row-reverse`, so DOM
     * order IS visual order here (and tab order). Before HOS-723 the secondary
     * rendered first, which put the recommended CTA second from the left. That
     * is invisible to any assertion that only checks both links exist — which
     * is exactly what the test above does, and why it stayed green through the
     * wrong order.
     *
     * Asserted on the RENDERED DOM via `compareDocumentPosition`, never on the
     * component source: a source check cannot tell a declared order from a
     * rendered one.
     */
    it('renders the primary action BEFORE the secondary one', () => {
        render(<ToastViewport />);
        act(() => {
            addToast({
                type: 'error',
                message: 'Ordered CTAs',
                action: { label: 'Buy add-on', href: '/es/mi-cuenta/addons/' },
                secondaryAction: { label: 'Upgrade plan', href: '/es/mi-cuenta/suscripcion/' }
            });
        });

        const primary = screen.getByRole('link', { name: 'Buy add-on' });
        const secondary = screen.getByRole('link', { name: 'Upgrade plan' });

        // Both live in the same actions row...
        expect(primary.parentElement).toBe(secondary.parentElement);
        // ...and the secondary FOLLOWS the primary in document order.
        expect(
            primary.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        // Sanity: the row is not reversed by CSS, so document order is what the
        // reader sees. A `row-reverse` here would silently invert the result.
        expect(getComputedStyle(primary.parentElement as HTMLElement).flexDirection).not.toBe(
            'row-reverse'
        );
        // And the two slots really are styled differently, so "primary" is a
        // visual fact and not only a position.
        expect(primary.className).not.toBe(secondary.className);
    });

    it('dismisses the toast (with exit animation) when close is clicked', () => {
        render(<ToastViewport />);
        act(() => {
            addToast({ type: 'info', message: 'Dismiss me', duration: 0 });
        });
        const closeBtn = screen.getByRole('button', { name: /cerrar notificación/i });
        fireEvent.click(closeBtn);
        // Still in DOM during the exit animation.
        expect(screen.queryByText('Dismiss me')).toBeInTheDocument();
        flushExitAnimation();
        expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
    });

    it('dismisses the toast when an action link is clicked', () => {
        render(<ToastViewport />);
        act(() => {
            addToast({
                type: 'info',
                message: 'CTA toast',
                duration: 0,
                action: { label: 'Sign in', href: '/auth/signin' }
            });
        });
        const link = screen.getByRole('link', { name: 'Sign in' });
        fireEvent.click(link);
        flushExitAnimation();
        expect(screen.queryByText('CTA toast')).not.toBeInTheDocument();
    });

    it('uses role="alert" for error toasts and role="status" otherwise', () => {
        render(<ToastViewport />);
        act(() => {
            addToast({ type: 'error', message: 'Boom', duration: 0 });
            addToast({ type: 'info', message: 'Info', duration: 0 });
        });
        expect(screen.getByRole('alert')).toHaveTextContent('Boom');
        expect(screen.getByRole('status')).toHaveTextContent('Info');
    });

    it('renders a loading toast variant', () => {
        render(<ToastViewport />);
        act(() => {
            addToast({ type: 'loading', message: 'Saving' });
        });
        const toast = screen.getByText('Saving').closest('[data-toast-type]');
        expect(toast?.getAttribute('data-toast-type')).toBe('loading');
    });

    it('updates a loading toast into success without re-mounting the row', () => {
        render(<ToastViewport />);
        let id = '';
        act(() => {
            id = addToast({ type: 'loading', message: 'Saving' });
        });
        const beforeRow = screen.getByText('Saving').closest('[data-toast-type]');
        act(() => {
            updateToast(id, { type: 'success', message: 'Saved' });
        });
        const afterRow = screen.getByText('Saved').closest('[data-toast-type]');
        expect(afterRow?.getAttribute('data-toast-type')).toBe('success');
        // The DOM row is preserved (same key based on stable id), only its
        // contents flip — this is what allows the progress bar to restart
        // cleanly via the `version` key on the bar element.
        expect(afterRow).toBe(beforeRow);
    });

    it('pauses the dismiss timer while hovered, resumes on leave', () => {
        render(<ToastViewport />);
        let id = '';
        act(() => {
            id = addToast({ type: 'info', message: 'Hover me', duration: 2000 });
        });
        const toast = screen.getByText('Hover me').closest('[data-toast-type]') as HTMLElement;

        fireEvent.pointerEnter(toast);
        expect(getToastTimer(id)?.paused).toBe(true);

        fireEvent.pointerLeave(toast);
        expect(getToastTimer(id)?.paused).toBe(false);
    });
});

describe('ToastViewport — repositions to the top while the CompareBar is visible (HOS-85 post-review fix)', () => {
    // The CSS module is loaded verbatim (no proxy mock in this file), so the
    // reposition rule is asserted via source text — the project's documented
    // approach for style-source coverage (see apps/web/CLAUDE.md > Testing,
    // and CompareBar.test.tsx's own z-index source-assert tests).
    const cssPath = resolve(__dirname, '../../../src/components/ui/ToastViewport.module.css');
    const cssSrc = readFileSync(cssPath, 'utf8');

    it('anchors the viewport to the top when html[data-compare-bar-visible] is present', () => {
        // `:global(...)` wraps the html[...] selector — same CSS Modules
        // convention as MapCardsSidebar.module.css's drawer/menu flags.
        expect(cssSrc).toContain(':global(html[data-compare-bar-visible]) .viewport');
        expect(cssSrc).toContain('inset-block-start: var(--space-4, 1rem);');
        expect(cssSrc).toContain('inset-block-end: auto;');
    });

    it('keeps the top-anchor override on the desktop breakpoint too', () => {
        // The desktop `.viewport` rule (min-width: 768px) sets
        // `inset-block-start: auto`; the reposition rule must re-override it
        // inside the same media query, not just at the mobile base rule.
        const desktopBlock = cssSrc.slice(cssSrc.indexOf('@media (min-width: 768px)'));
        expect(desktopBlock).toContain(':global(html[data-compare-bar-visible]) .viewport');
        expect(desktopBlock).toContain('inset-block-start: var(--space-6, 1.5rem);');
    });

    it('does not touch horizontal (inset-inline) positioning in the reposition rule', () => {
        // Only the vertical anchor should flip; horizontal placement stays
        // whatever the normal (non-compare-bar) rules already set.
        const repositionBlockStart = cssSrc.indexOf(
            ':global(html[data-compare-bar-visible]) .viewport'
        );
        const repositionBlockEnd = cssSrc.indexOf('}', repositionBlockStart);
        const repositionBlock = cssSrc.slice(repositionBlockStart, repositionBlockEnd);
        expect(repositionBlock).not.toContain('inset-inline');
    });
});
