/**
 * Tests for Toast and AccountToastRegion (HOS-2413 T-025).
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountToastRegion, toneForToast } from '../../../../src/components/account/ui';
import * as store from '../../../../src/store/toast-store';

afterEach(() => {
    act(() => store.clearToasts());
    vi.useRealTimers();
});

describe('toneForToast', () => {
    it.each([
        ['success', 'success'],
        ['error', 'danger'],
        ['warning', 'info'],
        ['info', 'info'],
        ['loading', 'neutral']
    ] as const)('store type %s maps to tone %s', (type, tone) => {
        expect(toneForToast({ type })).toBe(tone);
    });
});

describe('AccountToastRegion', () => {
    it('keeps two permanent live regions, polite and assertive, even while empty', () => {
        const { container } = render(<AccountToastRegion locale="es" />);
        expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
        expect(container.querySelector('[aria-live="assertive"]')).not.toBeNull();
    });

    it('renders a toast added through the store and removes it with removeToast', async () => {
        render(<AccountToastRegion locale="es" />);
        let id = '';
        act(() => {
            id = store.addToast({ type: 'success', message: 'Guardado' });
        });
        expect(await screen.findByText('Guardado')).toBeInTheDocument();
        act(() => store.removeToast(id));
        await waitFor(() => expect(screen.queryByText('Guardado')).toBeNull());
    });

    it('puts a danger toast in the assertive region and the others in the polite one', () => {
        const { container } = render(<AccountToastRegion locale="es" />);
        act(() => {
            store.addToast({ type: 'error', message: 'Falló' });
            store.addToast({ type: 'info', message: 'Aviso' });
        });
        const assertive = container.querySelector('[aria-live="assertive"]') as HTMLElement;
        const polite = container.querySelector('[aria-live="polite"]') as HTMLElement;
        expect(assertive).toHaveTextContent('Falló');
        expect(polite).toHaveTextContent('Aviso');
        expect(polite).not.toHaveTextContent('Falló');
    });

    it('maps the store warning to the info tone', () => {
        const { container } = render(<AccountToastRegion locale="es" />);
        act(() => {
            store.addToast({ type: 'warning', message: 'Ojo' });
        });
        expect(container.querySelector('[data-toast-tone="info"]')).not.toBeNull();
        expect(container.querySelector('[data-toast-tone="danger"]')).toBeNull();
    });

    it('a toast with an action does not auto-dismiss', async () => {
        vi.useFakeTimers();
        render(<AccountToastRegion locale="es" />);
        act(() => {
            store.addToast({
                type: 'info',
                message: 'Límite alcanzado',
                duration: 1000,
                action: { label: 'Ver planes', href: '/planes/' }
            });
        });
        await act(async () => {
            vi.advanceTimersByTime(10_000);
        });
        expect(screen.getByText('Límite alcanzado')).toBeInTheDocument();
        // the action is a link reachable with Tab
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
            'href',
            '/planes/'
        );
    });

    it('pauses the store timer on hover and resumes on leave', async () => {
        const user = userEvent.setup();
        const pause = vi.spyOn(store, 'pauseToast');
        const resume = vi.spyOn(store, 'resumeToast');
        render(<AccountToastRegion locale="es" />);
        act(() => {
            store.addToast({ type: 'success', message: 'Hola', duration: 60_000 });
        });
        const toast = (await screen.findByText('Hola')).closest('[data-toast-tone]') as HTMLElement;
        await user.hover(toast);
        expect(pause).toHaveBeenCalled();
        await user.unhover(toast);
        expect(resume).toHaveBeenCalled();
    });

    it('closes from the translated close button without taking focus', async () => {
        const user = userEvent.setup();
        render(<AccountToastRegion locale="es" />);
        act(() => {
            store.addToast({ type: 'success', message: 'Listo', duration: 60_000 });
        });
        expect(document.body).toHaveFocus();
        await user.click(await screen.findByRole('button', { name: 'Cerrar' }));
        await waitFor(() => expect(screen.queryByText('Listo')).toBeNull());
    });
});
