/**
 * @file LanguageSwitcher.test.tsx
 * @description Tests the segmented locale switcher.
 */

import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoAltWarningGuard } from '@/components/host/editor/use-photo-alt-warning-guard';
import { __resetLeaveWarningRegistry } from '@/lib/forms/leave-warning-registry';
import { LanguageSwitcher } from '../../../../src/components/shared/preferences/LanguageSwitcher.client';

const { showConfirmationDialogMock } = vi.hoisted(() => ({
    showConfirmationDialogMock: vi.fn<(options: unknown) => Promise<boolean>>()
}));

vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: showConfirmationDialogMock
}));

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
        // On document (bubble) so it runs after React's root listener; a listener on
        // the link itself would mark the event prevented before the component sees it.
        const preventNavigation = (event: Event): void => event.preventDefault();
        document.addEventListener('click', preventNavigation);
        fireEvent.click(link);
        document.removeEventListener('click', preventNavigation);
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
        const preventNavigation = (event: Event): void => event.preventDefault();
        document.addEventListener('click', preventNavigation);
        fireEvent.click(link);
        document.removeEventListener('click', preventNavigation);

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

    describe('on the Fotos page with photos missing alt text (HOS-2032)', () => {
        const mountGuard = (): void => {
            renderHook(() =>
                usePhotoAltWarningGuard({
                    locale: 'es',
                    accommodationId: 'acc-language-switch',
                    featuredItem: null,
                    galleryItems: [
                        {
                            id: 'g1',
                            url: 'https://example.com/g1.jpg',
                            publicId: 'g1',
                            isFeatured: false,
                            alt: ''
                        }
                    ]
                })
            );
        };

        beforeEach(() => {
            showConfirmationDialogMock.mockReset();
            window.sessionStorage.clear();
            __resetLeaveWarningRegistry();
            // jsdom cannot navigate; swallow the default action of the replayed click.
            document.addEventListener('click', swallowNavigation);
        });

        afterEach(() => {
            document.removeEventListener('click', swallowNavigation);
            __resetLeaveWarningRegistry();
            window.sessionStorage.clear();
        });

        function swallowNavigation(event: Event): void {
            if (!event.defaultPrevented) event.preventDefault();
        }

        it('asks before switching language and changes nothing when the host stays', async () => {
            showConfirmationDialogMock.mockResolvedValue(false);
            mountGuard();
            render(
                <LanguageSwitcher
                    locale="es"
                    currentPath="/es/"
                />
            );

            fireEvent.click(screen.getByRole('link', { name: 'English' }));
            await waitFor(() => expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1));

            expect(localStorage.getItem('preferredLocale')).toBeNull();
        });

        it('persists the locale once the host confirms leaving', async () => {
            showConfirmationDialogMock.mockResolvedValue(true);
            mountGuard();
            render(
                <LanguageSwitcher
                    locale="es"
                    currentPath="/es/"
                />
            );

            fireEvent.click(screen.getByRole('link', { name: 'English' }));

            await waitFor(() => expect(localStorage.getItem('preferredLocale')).toBe('en'));
            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
        });
    });
});
