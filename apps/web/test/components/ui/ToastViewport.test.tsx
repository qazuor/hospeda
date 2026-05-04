/**
 * @file ToastViewport.test.tsx
 * @description Tests the global toast renderer.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastViewport } from '../../../src/components/ui/ToastViewport.client';
import { addToast, clearToasts } from '../../../src/store/toast-store';

describe('ToastViewport', () => {
    beforeEach(() => {
        clearToasts();
    });

    afterEach(() => {
        clearToasts();
    });

    it('renders nothing when there are no toasts', () => {
        const { container } = render(<ToastViewport />);
        expect(container.firstChild).toBeNull();
    });

    it('renders a toast when one is added to the store', () => {
        const { rerender } = render(<ToastViewport />);
        addToast({ type: 'info', message: 'Hello world' });
        rerender(<ToastViewport />);
        expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders the primary action as a link when href is provided', () => {
        addToast({
            type: 'info',
            message: 'CTA',
            action: { label: 'Sign in', href: '/auth/signin' }
        });
        const { rerender } = render(<ToastViewport />);
        rerender(<ToastViewport />);
        const link = screen.getByRole('link', { name: 'Sign in' });
        expect(link).toHaveAttribute('href', '/auth/signin');
    });

    it('renders the secondary action alongside the primary', () => {
        addToast({
            type: 'info',
            message: 'Two CTAs',
            action: { label: 'Sign in', href: '/auth/signin' },
            secondaryAction: { label: 'View benefits', href: '/beneficios' }
        });
        render(<ToastViewport />);
        expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'View benefits' })).toBeInTheDocument();
    });

    it('dismisses the toast when the close button is clicked', () => {
        addToast({ type: 'info', message: 'Dismiss me', duration: 0 });
        render(<ToastViewport />);
        const closeBtn = screen.getByRole('button', { name: /cerrar notificación/i });
        fireEvent.click(closeBtn);
        expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
    });

    it('dismisses the toast when an action link is clicked', () => {
        addToast({
            type: 'info',
            message: 'CTA toast',
            duration: 0,
            action: { label: 'Sign in', href: '/auth/signin' }
        });
        render(<ToastViewport />);
        const link = screen.getByRole('link', { name: 'Sign in' });
        fireEvent.click(link);
        expect(screen.queryByText('CTA toast')).not.toBeInTheDocument();
    });

    it('uses role="alert" for error toasts and role="status" otherwise', () => {
        addToast({ type: 'error', message: 'Boom', duration: 0 });
        addToast({ type: 'info', message: 'Info', duration: 0 });
        render(<ToastViewport />);
        expect(screen.getByRole('alert')).toHaveTextContent('Boom');
        expect(screen.getByRole('status')).toHaveTextContent('Info');
    });
});
