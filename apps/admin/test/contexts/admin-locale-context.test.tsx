/**
 * HOS-992: the account's saved admin language must drive the panel's copy.
 */
import { useTranslations } from '@repo/i18n';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLocaleProvider, resolveAdminLocale } from '@/contexts/admin-locale-context';

const profileState = vi.hoisted(() => ({
    data: undefined as { settings?: Record<string, unknown> } | undefined
}));

vi.mock('@/hooks/use-user-profile', () => ({
    useUserProfile: () => ({ data: profileState.data })
}));
vi.mock('@/lib/locale', () => ({ getSupportedLocales: () => ['es', 'en', 'pt'] }));
vi.mock('@/env', () => ({ env: { VITE_DEFAULT_LOCALE: 'es' } }));

/** Renders a key from the shared catalog through the argument-less hook. */
function Probe() {
    const { t, locale } = useTranslations();
    return (
        <p
            data-testid="probe"
            data-locale={locale}
        >
            {t('ui.pages.mySettings')}
        </p>
    );
}

const renderProvider = ({ initialLanguage }: { initialLanguage: string | null }) =>
    render(
        <AdminLocaleProvider
            userId="u1"
            initialLanguage={initialLanguage}
        >
            <Probe />
        </AdminLocaleProvider>
    );

describe('AdminLocaleProvider', () => {
    beforeEach(() => {
        profileState.data = undefined;
    });

    it('renders the session language on first paint, before the profile loads', () => {
        renderProvider({ initialLanguage: 'en' });

        expect(screen.getByTestId('probe').textContent).toBe('My Settings');
    });

    it('renders Portuguese when that is the stored preference', () => {
        profileState.data = { settings: { languageAdmin: 'pt' } };
        renderProvider({ initialLanguage: null });

        expect(screen.getByTestId('probe').getAttribute('data-locale')).toBe('pt');
        expect(screen.getByTestId('probe').textContent).not.toBe('Mi Configuración');
    });

    it('switches the rendered copy when the saved profile changes', () => {
        profileState.data = { settings: { languageAdmin: 'es' } };
        const { rerender } = renderProvider({ initialLanguage: 'es' });
        expect(screen.getByTestId('probe').textContent).toBe('Mi Configuración');

        profileState.data = { settings: { languageAdmin: 'en' } };
        rerender(
            <AdminLocaleProvider
                userId="u1"
                initialLanguage="es"
            >
                <Probe />
            </AdminLocaleProvider>
        );

        expect(screen.getByTestId('probe').textContent).toBe('My Settings');
    });

    it('prefers the live profile over a stale session value', () => {
        profileState.data = { settings: { languageAdmin: 'es' } };
        renderProvider({ initialLanguage: 'en' });

        expect(screen.getByTestId('probe').textContent).toBe('Mi Configuración');
    });

    it('keeps <html lang> in sync with the active locale', () => {
        profileState.data = { settings: { languageAdmin: 'pt' } };
        renderProvider({ initialLanguage: null });

        expect(document.documentElement.lang).toBe('pt');
    });

    it('stays on the default locale when nothing is stored', () => {
        renderProvider({ initialLanguage: null });

        expect(screen.getByTestId('probe').textContent).toBe('Mi Configuración');
    });
});

describe('resolveAdminLocale', () => {
    const base = { supportedLocales: ['es', 'en', 'pt'], defaultLocale: 'es' } as const;

    it('falls back to the legacy single `language` field', () => {
        expect(resolveAdminLocale({ ...base, profileSettings: { language: 'pt' } })).toBe('pt');
    });

    it('ignores an unsupported stored value', () => {
        expect(resolveAdminLocale({ ...base, initialLanguage: 'fr' })).toBe('es');
    });
});
