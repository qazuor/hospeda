/**
 * @file LanguageSwitcher.test.tsx
 * @description Tests the segmented locale switcher.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from '../../../../src/components/shared/preferences/LanguageSwitcher.client';

describe('LanguageSwitcher', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('renders ES, EN, PT options', () => {
        render(
            <LanguageSwitcher
                locale="es"
                currentPath="/es/"
            />
        );
        expect(screen.getByRole('link', { name: 'Español' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'English' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Português' })).toBeInTheDocument();
    });

    it('marks the active locale with aria-current="true"', () => {
        render(
            <LanguageSwitcher
                locale="en"
                currentPath="/en/alojamientos/"
            />
        );
        const en = screen.getByRole('link', { name: 'English' });
        const es = screen.getByRole('link', { name: 'Español' });
        expect(en).toHaveAttribute('aria-current', 'true');
        expect(es).not.toHaveAttribute('aria-current');
    });

    it('builds locale-swap URLs that preserve the current pathname', () => {
        render(
            <LanguageSwitcher
                locale="es"
                currentPath="/es/destinos/colon/"
            />
        );
        expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute(
            'href',
            '/en/destinos/colon/'
        );
        expect(screen.getByRole('link', { name: 'Português' })).toHaveAttribute(
            'href',
            '/pt/destinos/colon/'
        );
    });

    it('persists the chosen locale to localStorage on click', () => {
        render(
            <LanguageSwitcher
                locale="es"
                currentPath="/es/"
            />
        );
        // Prevent navigation
        const link = screen.getByRole('link', { name: 'English' });
        link.addEventListener('click', (event) => event.preventDefault());
        fireEvent.click(link);
        expect(localStorage.getItem('preferredLocale')).toBe('en');
    });

    it('dispatches a preferences:change event when a non-active locale is clicked', () => {
        const listener = vi.fn();
        window.addEventListener('preferences:change', listener);

        render(
            <LanguageSwitcher
                locale="es"
                currentPath="/es/"
            />
        );
        const link = screen.getByRole('link', { name: 'English' });
        link.addEventListener('click', (event) => event.preventDefault());
        fireEvent.click(link);

        expect(listener).toHaveBeenCalledTimes(1);
        const event = listener.mock.calls[0]?.[0] as CustomEvent;
        expect(event.detail).toEqual({ kind: 'locale', value: 'en' });

        window.removeEventListener('preferences:change', listener);
    });

    it('does NOT dispatch the event when clicking the already-active locale', () => {
        const listener = vi.fn();
        window.addEventListener('preferences:change', listener);

        render(
            <LanguageSwitcher
                locale="es"
                currentPath="/es/"
            />
        );
        const link = screen.getByRole('link', { name: 'Español' });
        link.addEventListener('click', (event) => event.preventDefault());
        fireEvent.click(link);

        expect(listener).not.toHaveBeenCalled();
        window.removeEventListener('preferences:change', listener);
    });
});
