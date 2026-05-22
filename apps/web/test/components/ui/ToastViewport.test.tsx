/**
 * @file ToastViewport.test.tsx
 * @description Tests the global toast renderer.
 *
 * Covers variant rendering, action wiring, i18n of the close label, the
 * always-mounted aria-live region, hover-pause integration with the store,
 * and the in-place loading -> success transition driven by `updateToast`.
 */

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
