/**
 * @file ThemeControl.test.tsx
 * @description Tests the segmented light / system / dark control.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeControl } from '../../../../src/components/shared/preferences/ThemeControl.client';

function mockMatchMedia(matches: boolean) {
    const listeners = new Set<(e: MediaQueryListEvent) => void>();
    const mediaQueryList = {
        matches,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_type: string, handler: (e: MediaQueryListEvent) => void) => {
            listeners.add(handler);
        }),
        removeEventListener: vi.fn((_type: string, handler: (e: MediaQueryListEvent) => void) => {
            listeners.delete(handler);
        }),
        dispatchEvent: vi.fn()
    };
    window.matchMedia = vi.fn().mockReturnValue(mediaQueryList);
    return { mediaQueryList, listeners };
}

describe('ThemeControl', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        mockMatchMedia(false);
    });

    afterEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    it('renders three radio buttons (light, system, dark)', () => {
        render(<ThemeControl />);
        expect(screen.getByRole('button', { name: /tema claro/i })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /preferencia del sistema/i })
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /tema oscuro/i })).toBeInTheDocument();
    });

    it('reads the initial choice from localStorage', () => {
        localStorage.setItem('theme', 'dark');
        render(<ThemeControl />);
        const dark = screen.getByRole('button', { name: /tema oscuro/i });
        expect(dark).toHaveAttribute('aria-pressed', 'true');
    });

    it('defaults to "light" when localStorage has no value', () => {
        render(<ThemeControl />);
        const light = screen.getByRole('button', { name: /tema claro/i });
        expect(light).toHaveAttribute('aria-pressed', 'true');
    });

    it('persists the chosen theme to localStorage', () => {
        render(<ThemeControl />);
        fireEvent.click(screen.getByRole('button', { name: /tema oscuro/i }));
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('applies data-theme="dark" on <html> when dark is chosen', () => {
        render(<ThemeControl />);
        fireEvent.click(screen.getByRole('button', { name: /tema oscuro/i }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('removes data-theme when light is chosen', () => {
        // Component must start with a non-light choice; otherwise clicking
        // "light" is a no-op (handleSelect early-returns when next === choice).
        localStorage.setItem('theme', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        render(<ThemeControl />);
        fireEvent.click(screen.getByRole('button', { name: /tema claro/i }));
        expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    });

    it('resolves system preference to dark when OS reports dark', () => {
        mockMatchMedia(true);
        render(<ThemeControl />);
        fireEvent.click(screen.getByRole('button', { name: /preferencia del sistema/i }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('system');
    });

    it('resolves system preference to light when OS reports light', () => {
        mockMatchMedia(false);
        render(<ThemeControl />);
        fireEvent.click(screen.getByRole('button', { name: /preferencia del sistema/i }));
        expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
        expect(localStorage.getItem('theme')).toBe('system');
    });

    it('dispatches preferences:change with kind=theme and the chosen value', () => {
        const listener = vi.fn();
        window.addEventListener('preferences:change', listener);

        render(<ThemeControl />);
        fireEvent.click(screen.getByRole('button', { name: /tema oscuro/i }));

        expect(listener).toHaveBeenCalledTimes(1);
        const event = listener.mock.calls[0]?.[0] as CustomEvent;
        expect(event.detail).toEqual({ kind: 'theme', value: 'dark' });

        window.removeEventListener('preferences:change', listener);
    });

    it('does not re-dispatch when clicking the already-active option', () => {
        localStorage.setItem('theme', 'dark');
        const listener = vi.fn();
        window.addEventListener('preferences:change', listener);

        render(<ThemeControl />);
        fireEvent.click(screen.getByRole('button', { name: /tema oscuro/i }));

        expect(listener).not.toHaveBeenCalled();
        window.removeEventListener('preferences:change', listener);
    });
});
